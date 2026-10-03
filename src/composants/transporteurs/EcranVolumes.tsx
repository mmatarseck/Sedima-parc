"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { BandeauKpi } from "@/composants/interface/BandeauKpi";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Echeance } from "@/composants/interface/Pastille";
import { normaliserLocalite } from "@/domaine/flotte-tierce";
import { STATUT_FACTURATION, facturer, grilleSemaine, syntheseParTransporteur, type StatutFacturation, type VoyageFacture } from "@/domaine/volumes-transport";
import type { DonneesVolumes } from "@/donnees/volumes-transport";
import { date as formaterDate, montant, montantCourt, nombre } from "@/lib/format";
import { classeurRapport, telecharger, type ValeurCellule } from "@/lib/xlsx";
import { rattacherLocalite } from "@/lib/zones-actions";

/* ============================================================================
 * Volumes et facturation des transporteurs (métier, 3 octobre 2026).
 *
 * Deux vues sur le même relevé de tonnage :
 *  - **la semaine**, vendredi à jeudi : la grille que Jacques envoie, camion
 *    par camion, jour par jour, tonnage et destination — tirée de la base ;
 *  - **la facturation** du mois : chaque voyage au prix de la grille de son
 *    transporteur pour sa zone (directe, rattachée, ou la plus chère d'une
 *    destination composée), la synthèse par transporteur, et ce qui reste en
 *    suspens — localités à rattacher, à régler sur place.
 * ==========================================================================*/

const t1 = (x: number) => nombre(Math.round(x * 10) / 10, Number.isInteger(Math.round(x * 10) / 10) ? 0 : 1);
const JOURS_COURTS = ["Ven.", "Sam.", "Dim.", "Lun.", "Mar.", "Mer.", "Jeu."];

function decaler(jour: string, jours: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function moisVoisin(mois: string, delta: number): string {
  const [a, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(a!, m! - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

const libelleMois = (mois: string) => new Date(`${mois}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

export function EcranVolumes({ vue, jours, mois, du, au, donnees }: { vue: "semaine" | "facturation"; jours: string[]; mois: string; du: string; au: string; donnees: DonneesVolumes }) {
  const segment = (actif: boolean) => `flex h-6 items-center rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${actif ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`;
  const precedent = vue === "semaine" ? `/transporteurs/volumes?semaine=${decaler(jours[0]!, -7)}` : `/transporteurs/volumes?vue=facturation&mois=${moisVoisin(mois, -1)}`;
  const suivant = vue === "semaine" ? `/transporteurs/volumes?semaine=${decaler(jours[0]!, 7)}` : `/transporteurs/volumes?vue=facturation&mois=${moisVoisin(mois, 1)}`;
  const periode = vue === "semaine" ? `Semaine du ${formaterDate(du)} au ${formaterDate(au)}` : `Mois de ${libelleMois(mois)}`;

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran
        titre="Volumes et facturation"
        sousTitre={`${periode} · relevé de tonnage de la Direction des Opérations, grilles des transporteurs et zones de rapprochement`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/transporteurs" className="bouton-secondaire h-8">
              <ArrowLeft className="size-4" strokeWidth={1.8} />
              Transporteurs
            </Link>
            <div className="flex h-8 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Vue">
              <Link href={`/transporteurs/volumes?semaine=${jours[0]}`} aria-current={vue === "semaine" ? "page" : undefined} className={segment(vue === "semaine")}>
                Semaine
              </Link>
              <Link href={`/transporteurs/volumes?vue=facturation&mois=${vue === "semaine" ? jours[6]!.slice(0, 7) : mois}`} aria-current={vue === "facturation" ? "page" : undefined} className={segment(vue === "facturation")}>
                Facturation du mois
              </Link>
            </div>
            <div className="flex items-center gap-1">
              <Link href={precedent} className="bouton-discret h-8 px-2" aria-label="Période précédente">
                <ChevronLeft className="size-4" strokeWidth={2} />
              </Link>
              <Link href={suivant} className="bouton-discret h-8 px-2" aria-label="Période suivante">
                <ChevronRight className="size-4" strokeWidth={2} />
              </Link>
            </div>
          </div>
        }
      />
      {vue === "semaine" ? <Semaine jours={jours} donnees={donnees} /> : <Facturation mois={mois} donnees={donnees} />}
    </div>
  );
}

/* -- La semaine ------------------------------------------------------------------- */

function Semaine({ jours, donnees }: { jours: string[]; donnees: DonneesVolumes }) {
  const g = useMemo(() => grilleSemaine(donnees.voyages, jours), [donnees.voyages, jours]);
  const tiers = g.lignes.filter((l) => l.transporteurNumero !== null);
  const tonnesTiers = tiers.reduce((s, l) => s + l.total, 0);
  const voyages = donnees.voyages.length;

  function exporter() {
    const lignes: ValeurCellule[][] = g.lignes.map((l) => [
      { type: "texte", valeur: l.transporteur },
      { type: "texte", valeur: l.chauffeur ?? "" },
      { type: "texte", valeur: l.plaqueAffichee },
      { type: "texte", valeur: `${l.type}${l.capaciteTonnes ? ` ${l.capaciteTonnes} t` : ""}` },
      ...l.jours.map((j): ValeurCellule => (j.tonnage ? { type: "texte", valeur: `${t1(j.tonnage)} t · ${j.destinations.join(" + ")}` } : { type: "vide" })),
      { type: "nombre", valeur: Math.round(l.total * 100) / 100 },
    ]);
    const blob = classeurRapport({
      onglet: "Tonnage hebdomadaire",
      titre: "Récapitulatif du tonnage hebdomadaire",
      sousTitre: "Tonnage et destination par camion et par jour, du vendredi au jeudi",
      cartouche: [{ libelle: "Semaine", valeur: `du ${formaterDate(jours[0]!)} au ${formaterDate(jours[6]!)}` }],
      colonnes: [
        { entete: "Transporteur", format: "texte", largeurPx: 140 },
        { entete: "Chauffeur", format: "texte", largeurPx: 150 },
        { entete: "Immat.", format: "texte", largeurPx: 100 },
        { entete: "Type", format: "texte", largeurPx: 100 },
        ...jours.map((j, i) => ({ entete: `${JOURS_COURTS[i]} ${j.slice(8, 10)}/${j.slice(5, 7)}`, format: "texte" as const, largeurPx: 150 })),
        { entete: "Tonnage de la semaine", format: "decimal", largeurPx: 120 },
      ],
      lignes,
      totaux: [{ type: "texte", valeur: "Tonnage journalier" }, null, null, null, ...g.totauxJour.map((x): ValeurCellule => ({ type: "nombre", valeur: x })), { type: "nombre", valeur: g.total }],
    });
    telecharger(blob, `tonnage-semaine-${jours[0]}.xlsx`);
  }

  return (
    <>
      <BandeauKpi
        kpis={[
          { label: "Tonnage de la semaine", valeur: t1(g.total), unite: "t", precision: `${voyages} voyages` },
          { label: "Par les transporteurs", valeur: t1(tonnesTiers), unite: "t", precision: g.total ? `${Math.round((tonnesTiers / g.total) * 100)} % du tonnage` : "—" },
          { label: "Par le parc SEDIMA", valeur: t1(g.total - tonnesTiers), unite: "t", precision: `${g.lignes.length - tiers.length} camions` },
          { label: "Camions de transporteurs", valeur: String(tiers.length), unite: "", precision: `${new Set(tiers.map((l) => l.transporteur)).size} transporteurs` },
        ]}
      />
      <Carte
        titre="Tonnage hebdomadaire"
        precision="Une ligne par camion ; dans chaque case, le tonnage et la destination du jour"
        action={
          <button type="button" className="bouton-secondaire h-8" onClick={exporter}>
            <Download className="size-4 text-texte-2" strokeWidth={1.7} />
            Exporter
          </button>
        }
        sansMarge
      >
        <div className="defilement-discret overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="bg-surface-2">
              <tr>
                <th className="border-b border-bordure px-3 py-2 text-left font-medium text-texte-2">Transporteur</th>
                <th className="border-b border-bordure px-3 py-2 text-left font-medium text-texte-2">Chauffeur</th>
                <th className="border-b border-bordure px-3 py-2 text-left font-medium text-texte-2">Immat.</th>
                {jours.map((j, i) => (
                  <th key={j} className="border-b border-bordure px-3 py-2 text-left font-medium text-texte-2">
                    {JOURS_COURTS[i]} <span className="meta">{j.slice(8, 10)}/{j.slice(5, 7)}</span>
                  </th>
                ))}
                <th className="border-b border-bordure px-3 py-2 text-right font-medium text-texte-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {g.lignes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-attenue">
                    Aucun voyage au relevé cette semaine.
                  </td>
                </tr>
              ) : (
                g.lignes.map((l, i) => {
                  const premier = i === 0 || g.lignes[i - 1]!.transporteur !== l.transporteur;
                  return (
                    <tr key={`${l.transporteur}-${l.plaque}`} className={`border-b border-bordure ${premier ? "border-t-2 border-t-bordure-champ" : ""}`}>
                      <td className="px-3 py-1.5 font-medium whitespace-nowrap text-texte">{premier ? l.transporteur : ""}</td>
                      <td className="max-w-[160px] truncate px-3 py-1.5 text-texte-2">{l.chauffeur ?? "—"}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className="code">{l.plaqueAffichee}</span>
                        <span className="meta"> {l.type}{l.capaciteTonnes ? ` ${t1(l.capaciteTonnes)} t` : ""}</span>
                      </td>
                      {l.jours.map((j, k) => (
                        <td key={k} className="px-3 py-1.5 align-top">
                          {j.tonnage ? (
                            <>
                              <span className="code font-medium">{t1(j.tonnage)}</span>
                              <span className="block max-w-[120px] truncate text-[11.5px] text-texte-2" title={j.destinations.join(" + ")}>
                                {j.destinations.join(" + ")}
                              </span>
                            </>
                          ) : (
                            <span className="text-attenue-2">·</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right">
                        <span className="code font-semibold">{t1(l.total)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {g.lignes.length ? (
              <tfoot className="bg-surface-2">
                <tr>
                  <td colSpan={3} className="px-3 py-2 font-semibold">
                    Tonnage journalier
                  </td>
                  {g.totauxJour.map((x, i) => (
                    <td key={i} className="px-3 py-2">
                      <span className="code font-semibold">{x ? t1(x) : "—"}</span>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <span className="code font-semibold">{t1(g.total)}</span>
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </Carte>
    </>
  );
}

/* -- La facturation ------------------------------------------------------------------ */

function Facturation({ mois, donnees }: { mois: string; donnees: DonneesVolumes }) {
  const voyages = useMemo(() => facturer(donnees.voyages, donnees.tarifs, donnees.rattachements), [donnees]);
  const synthese = useMemo(() => syntheseParTransporteur(voyages), [voyages]);
  const [transporteur, setTransporteur] = useState<string>("tous");
  const [statut, setStatut] = useState<StatutFacturation | "tous">("tous");
  const tiers = synthese.filter((s) => s.transporteurNumero !== null);
  const totalMontant = tiers.reduce((s, x) => s + x.montant, 0);
  const totalTonnes = tiers.reduce((s, x) => s + x.tonnes, 0);
  const suspens = tiers.reduce((s, x) => s + x.enSuspens, 0);
  const zones = useMemo(() => [...new Set(donnees.tarifs.filter((t) => normaliserLocalite(t.origine) === "UAB").map((t) => t.destination))].sort((a, b) => a.localeCompare(b, "fr")), [donnees.tarifs]);
  const visibles = voyages.filter((v) => (transporteur === "tous" || (v.transporteurNumero ?? "parc") === transporteur) && (statut === "tous" || v.statut === statut));

  function exporter() {
    const lignes: ValeurCellule[][] = visibles.map((v) => [
      { type: "date", valeur: v.date },
      { type: "texte", valeur: v.transporteur },
      { type: "texte", valeur: v.plaqueAffichee },
      { type: "texte", valeur: v.chauffeur ?? "" },
      { type: "texte", valeur: v.destination },
      { type: "texte", valeur: v.zone ?? "" },
      { type: "nombre", valeur: v.tonnage },
      v.prixTonne === null ? { type: "vide" } : { type: "nombre", valeur: v.prixTonne },
      v.montant === null ? { type: "vide" } : { type: "nombre", valeur: v.montant },
      { type: "texte", valeur: STATUT_FACTURATION[v.statut].libelle },
      { type: "texte", valeur: v.numero },
    ]);
    const blob = classeurRapport({
      onglet: "Facturation",
      titre: "Facturation calculée des transporteurs",
      sousTitre: "Chaque voyage au prix de la grille du transporteur pour la zone de sa destination (zone du contrat, ou zone de rapprochement)",
      cartouche: [
        { libelle: "Mois", valeur: libelleMois(mois) },
        { libelle: "Transporteur", valeur: transporteur === "tous" ? "tous" : (synthese.find((s) => (s.transporteurNumero ?? "parc") === transporteur)?.transporteur ?? transporteur) },
        { libelle: "Statut", valeur: statut === "tous" ? "tous" : STATUT_FACTURATION[statut].libelle },
      ],
      colonnes: [
        { entete: "Date", format: "date", largeurPx: 100 },
        { entete: "Transporteur", format: "texte", largeurPx: 140 },
        { entete: "Immat.", format: "texte", largeurPx: 100 },
        { entete: "Chauffeur", format: "texte", largeurPx: 150 },
        { entete: "Destination", format: "texte", largeurPx: 130 },
        { entete: "Zone facturée", format: "texte", largeurPx: 120 },
        { entete: "Tonnage", format: "decimal", largeurPx: 90 },
        { entete: "Prix / t", format: "montant", largeurPx: 90 },
        { entete: "Montant", format: "montant", largeurPx: 120 },
        { entete: "Statut", format: "texte", largeurPx: 150 },
        { entete: "N°", format: "texte", largeurPx: 130 },
      ],
      lignes,
      totaux: [{ type: "texte", valeur: "Total" }, null, null, null, null, null, { type: "nombre", valeur: Math.round(visibles.reduce((s, v) => s + v.tonnage, 0) * 100) / 100 }, null, { type: "nombre", valeur: visibles.reduce((s, v) => s + (v.montant ?? 0), 0) }, null, null],
    });
    telecharger(blob, `facturation-transporteurs-${mois}.xlsx`);
  }

  return (
    <>
      <BandeauKpi
        kpis={[
          { label: "Montant calculé", valeur: montantCourt(totalMontant).replace(/\s?F$/, ""), unite: "F", precision: "à la grille, voyages calculés" },
          { label: "Tonnes des transporteurs", valeur: t1(totalTonnes), unite: "t", precision: `${tiers.reduce((s, x) => s + x.voyages, 0)} voyages` },
          { label: "Coût moyen", valeur: totalTonnes ? nombre(Math.round(totalMontant / Math.max(1, tiers.reduce((s, x) => s + x.tonnesCalculees, 0)))) : "—", unite: "F/t", precision: "sur les tonnes calculées" },
          { label: "En suspens", valeur: String(suspens), unite: "voyages", precision: "localité à rattacher ou zone sans tarif", ton: suspens ? "vigilance" : "favorable" },
        ]}
      />

      <Carte titre="Par transporteur" precision="Le parc SEDIMA en tête pour mémoire ; la mise à disposition se facture au jour, sur sa fiche" sansMarge>
        <TableauSimple
          cle={(s) => s.transporteurNumero ?? "parc"}
          lignes={synthese}
          filtrable={false}
          vide="Aucun voyage au relevé ce mois-ci."
          colonnes={[
            { cle: "transporteur", libelle: "Transporteur", rendu: (s) => (s.transporteurNumero ? <Link href={`/prestataires/${s.transporteurNumero}`} className="font-medium hover:underline">{s.transporteur}</Link> : <span className="font-medium">SEDIMA (parc)</span>) },
            { cle: "camions", libelle: "Camions", alignee: "droite", rendu: (s) => <span className="code">{s.camions}</span> },
            { cle: "voyages", libelle: "Voyages", alignee: "droite", rendu: (s) => <span className="code">{s.voyages}</span> },
            { cle: "tonnes", libelle: "Tonnes", alignee: "droite", rendu: (s) => <span className="code">{t1(s.tonnes)}</span> },
            { cle: "calculees", libelle: "Tonnes calculées", alignee: "droite", rendu: (s) => (s.transporteurNumero ? <span className="code">{t1(s.tonnesCalculees)}</span> : <span className="text-attenue-2">—</span>) },
            { cle: "mad", libelle: "Dont mise à dispo.", alignee: "droite", rendu: (s) => (s.tonnesMad ? <span className="code">{t1(s.tonnesMad)}</span> : <span className="text-attenue-2">—</span>) },
            { cle: "montant", libelle: "Montant à la grille", alignee: "droite", rendu: (s) => (s.transporteurNumero ? <span className="code font-semibold">{montant(s.montant)}</span> : <span className="text-attenue-2">—</span>) },
            { cle: "suspens", libelle: "En suspens", alignee: "droite", rendu: (s) => (s.enSuspens ? <Echeance ton="vigilance">{`${s.enSuspens} · ${t1(s.tonnesEnSuspens)} t`}</Echeance> : <span className="text-attenue-2">—</span>) },
          ]}
        />
      </Carte>

      <ARattacher voyages={voyages} zones={zones} rattachements={donnees.rattachements} />

      <Carte
        titre="Voyage par voyage"
        precision="Zone facturée : la zone du contrat, ou la zone de rapprochement de la localité ; une destination composée se facture à la plus chère de ses parties"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select value={transporteur} onChange={(e) => setTransporteur(e.target.value)} className="h-8 rounded-[10px] border border-bordure-champ bg-surface px-2 text-[12.5px]" aria-label="Transporteur">
              <option value="tous">Tous les transporteurs</option>
              {synthese.map((s) => (
                <option key={s.transporteurNumero ?? "parc"} value={s.transporteurNumero ?? "parc"}>
                  {s.transporteurNumero ? s.transporteur : "SEDIMA (parc)"}
                </option>
              ))}
            </select>
            <select value={statut} onChange={(e) => setStatut(e.target.value as StatutFacturation | "tous")} className="h-8 rounded-[10px] border border-bordure-champ bg-surface px-2 text-[12.5px]" aria-label="Statut">
              <option value="tous">Tous les statuts</option>
              {(Object.keys(STATUT_FACTURATION) as StatutFacturation[]).map((s) => (
                <option key={s} value={s}>
                  {STATUT_FACTURATION[s].libelle}
                </option>
              ))}
            </select>
            <button type="button" className="bouton-secondaire h-8" onClick={exporter}>
              <Download className="size-4 text-texte-2" strokeWidth={1.7} />
              Exporter
            </button>
          </div>
        }
        sansMarge
      >
        <TableauSimple<VoyageFacture>
          reglages="volumes.facturation"
          cle={(v) => v.numero}
          lignes={visibles}
          filtrable={visibles.length > 10}
          vide="Aucun voyage pour ces filtres."
          colonnes={[
            { cle: "date", libelle: "Date", rendu: (v) => <span className="code">{formaterDate(v.date)}</span> },
            { cle: "transporteur", libelle: "Transporteur", rendu: (v) => v.transporteur },
            {
              cle: "camion",
              libelle: "Camion",
              rendu: (v) =>
                v.camionConnu && v.transporteurNumero ? (
                  <Link href={`/transporteurs/camions/${v.plaque}?onglet=volumes`} className="code hover:underline">
                    {v.plaqueAffichee}
                  </Link>
                ) : (
                  <span className="code">{v.plaqueAffichee}</span>
                ),
            },
            { cle: "chauffeur", libelle: "Chauffeur", parDefaut: false, rendu: (v) => v.chauffeur ?? "—" },
            { cle: "destination", libelle: "Destination", rendu: (v) => v.destination },
            {
              cle: "zone",
              libelle: "Zone facturée",
              rendu: (v) => (v.zone ? <span title={v.rapprochement === "rattachee" ? "Zone de rapprochement" : v.rapprochement === "composee" ? "La plus chère des parties" : "Zone du contrat"}>{v.zone}{v.rapprochement === "rattachee" ? <span className="meta"> · rapprochée</span> : v.rapprochement === "composee" ? <span className="meta"> · composée</span> : null}</span> : <span className="text-attenue-2">—</span>),
            },
            { cle: "tonnage", libelle: "Tonnage", alignee: "droite", rendu: (v) => <span className="code">{t1(v.tonnage)} t</span> },
            { cle: "prix", libelle: "Prix / t", alignee: "droite", rendu: (v) => (v.prixTonne === null ? <span className="text-attenue-2">—</span> : <span className="code">{nombre(v.prixTonne)}</span>) },
            { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (v) => (v.montant === null ? <span className="text-attenue-2">—</span> : <span className="code font-medium">{montant(v.montant)}</span>) },
            {
              cle: "statut",
              libelle: "Statut",
              rendu: (v) => (
                <span title={STATUT_FACTURATION[v.statut].precision}>
                  <Echeance ton={v.statut === "calcule" ? "favorable" : v.statut === "a-rattacher" || v.statut === "sans-tarif" ? "vigilance" : "neutre"}>{STATUT_FACTURATION[v.statut].libelle}</Echeance>
                </span>
              ),
            },
          ]}
        />
      </Carte>
    </>
  );
}

/* -- Ce qui reste à rattacher, et les propositions à confirmer ------------------------ */

function ARattacher({ voyages, zones, rattachements }: { voyages: VoyageFacture[]; zones: string[]; rattachements: DonneesVolumes["rattachements"] }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  /* Les parties inconnues des destinations en suspens, avec ce qu'elles pèsent. */
  const inconnues = useMemo(() => {
    const connues = new Set([...zones.map(normaliserLocalite), ...rattachements.map((r) => normaliserLocalite(r.localite))]);
    const m = new Map<string, { libelle: string; voyages: number; tonnes: number }>();
    for (const v of voyages.filter((x) => x.statut === "a-rattacher")) {
      for (const p of v.destination.split("/").map((x) => x.trim()).filter(Boolean)) {
        const cle = normaliserLocalite(p);
        if (!cle || connues.has(cle)) continue;
        const l = m.get(cle) ?? { libelle: p, voyages: 0, tonnes: 0 };
        m.set(cle, { ...l, voyages: l.voyages + 1, tonnes: l.tonnes + v.tonnage });
      }
    }
    return [...m.entries()].sort((a, b) => b[1].tonnes - a[1].tonnes);
  }, [voyages, zones, rattachements]);

  /* Les propositions « à confirmer » que les voyages du mois utilisent. */
  const aConfirmer = useMemo(() => {
    const utilisees = new Set(voyages.flatMap((v) => v.destination.split("/").map((x) => normaliserLocalite(x))));
    return rattachements.filter((r) => /à confirmer/i.test(r.motif ?? "") && utilisees.has(normaliserLocalite(r.localite)));
  }, [voyages, rattachements]);

  if (inconnues.length === 0 && aConfirmer.length === 0) return null;

  function poser(localite: string, zone: string, motif: string) {
    demarrer(async () => {
      const refus = await rattacherLocalite(localite, zone, motif);
      setMessage(refus ?? `${localite} → ${zone} : enregistré.`);
      if (!refus) router.refresh();
    });
  }

  const select = (cle: string, defaut = "") => (
    <select value={choix[cle] ?? defaut} onChange={(e) => setChoix({ ...choix, [cle]: e.target.value })} className="h-7 rounded-[8px] border border-bordure-champ bg-surface px-2 text-[12.5px]" aria-label="Zone du contrat">
      <option value="">Zone…</option>
      {zones.map((z) => (
        <option key={z} value={z}>
          {z}
        </option>
      ))}
    </select>
  );

  return (
    <Carte titre="Zones de rapprochement à régler" precision="Une localité rattachée l'est pour de bon : ses voyages passés et futurs se calculent à la zone choisie" sansMarge>
      <div className="grid grid-cols-1 gap-0 xl:grid-cols-2">
        {inconnues.length ? (
          <div className="border-b border-bordure xl:border-r xl:border-b-0">
            <p className="micro-sur-titre px-4 pt-3 pb-1">Localités à rattacher ({inconnues.length})</p>
            <ul className="max-h-[320px] overflow-y-auto px-4 pb-3">
              {inconnues.map(([cle, l]) => (
                <li key={cle} className="flex items-center gap-2 border-b border-bordure py-1.5 last:border-b-0">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{l.libelle}</span>
                  <span className="meta shrink-0">
                    {l.voyages} v. · {t1(l.tonnes)} t
                  </span>
                  {select(cle)}
                  <button type="button" disabled={!choix[cle] || enCours} className="bouton-discret h-7 px-2 disabled:opacity-40" onClick={() => poser(l.libelle, choix[cle]!, "Rattachée depuis Volumes et facturation")}>
                    <Check className="size-3.5" strokeWidth={2.2} />
                    Rattacher
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {aConfirmer.length ? (
          <div>
            <p className="micro-sur-titre px-4 pt-3 pb-1">Propositions à confirmer ({aConfirmer.length})</p>
            <ul className="max-h-[320px] overflow-y-auto px-4 pb-3">
              {aConfirmer.map((r) => {
                const cle = normaliserLocalite(r.localite);
                return (
                  <li key={cle} className="flex items-center gap-2 border-b border-bordure py-1.5 last:border-b-0">
                    <span className="min-w-0 flex-1 truncate text-[13px]" title={r.motif ?? undefined}>
                      <span className="font-medium">{r.localite}</span> <span className="text-texte-2">→ {r.destination}</span>
                    </span>
                    {select(cle, r.destination)}
                    <button type="button" disabled={enCours} className="bouton-discret h-7 px-2 disabled:opacity-40" onClick={() => poser(r.localite, choix[cle] ?? r.destination, `Confirmé par l'exploitation${(choix[cle] ?? r.destination) !== r.destination ? ` (au lieu de ${r.destination})` : ""}`)}>
                      <Check className="size-3.5" strokeWidth={2.2} />
                      Confirmer
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
      {message ? <p className="meta border-t border-bordure px-4 py-2">{message}</p> : null}
    </Carte>
  );
}
