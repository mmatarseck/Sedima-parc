"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { BandeauKpi } from "@/composants/interface/BandeauKpi";
import { Carte, Definitions, TableauSimple } from "@/composants/interface/Carte";
import { Numero } from "@/composants/interface/Numero";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { useCible } from "@/composants/interface/useCible";
import { CHAMPS, champsCreation } from "@/composants/transactions/champs";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { GraphiqueBarres } from "@/composants/vehicule/GraphiqueBarres";
import { coutDe, ETAPE_ACHAT, NATURE_COUT, phaseDe, TON_ETAPE_ACHAT, type LigneAchat } from "@/domaine/caisse";
import { PERIODES, debutPeriode, type PeriodeMois } from "@/domaine/chauffeur";
import { POSTE_DEPENSE } from "@/domaine/libelles";
import { initialesPrestataire, TON_TYPE_PRESTATAIRE, TYPE_PRESTATAIRE, type FichePrestataire as Fiche } from "@/domaine/prestataires";
import { date, dateCourte, montant, montantCourt, nombre } from "@/lib/format";
import { ComptePrestataire, EvaluationPrestataire } from "./ComptePrestataire";
import { notationDe, type ComptePrestataire as Compte } from "@/domaine/assembler-prestataires";
import type { Avance, Evaluation } from "@/domaine/compte-prestataire";
import type { ChampEdition, Creation } from "@/domaine/cloture";

/** Une avance saisie depuis la fiche, à la forme du compte. */
function fabriquerAvance(prestataireNumero: string) {
  return (c: Creation): Avance | null => {
    const v = c.valeurs as Record<string, string | undefined>;
    const montant = Number(String(v.montant ?? "").replace(/\s/g, ""));
    if (!v.date || !Number.isFinite(montant) || montant <= 0) return null;
    return { numero: c.numero, prestataireNumero, date: v.date, montant, motif: v.motif ?? "", imputeeSur: v.imputeeSur || null, dateImputation: v.dateImputation || null, autorisePar: v.autorisePar || c.auteur };
  };
}

/** Une évaluation saisie depuis la fiche : trois notes de 1 à 5, la pièce évaluée. */
function fabriquerEvaluation(prestataireNumero: string, libelleDe: (numero: string) => string | null) {
  return (c: Creation): Evaluation | null => {
    const v = c.valeurs as Record<string, string | undefined>;
    const note = (x: string | undefined) => Math.min(5, Math.max(1, Math.round(Number(x ?? 0)) || 1));
    if (!v.date) return null;
    const pieceNumero = v.pieceNumero ?? "";
    return { numero: c.numero, prestataireNumero, date: v.date, pieceNumero, pieceLibelle: v.pieceLibelle || libelleDe(pieceNumero) || pieceNumero, notes: { qualite: note(v.qualite), delai: note(v.delai), prix: note(v.prix) }, commentaire: v.commentaire || null, auteur: c.auteur };
  };
}

/* ============================================================================
 * Fiche prestataire — même structure que les fiches véhicule et chauffeur :
 * en-tête fixe (retour, identité, six indicateurs, onglets, période), un seul
 * contenu qui défile. L'Aperçu porte ce qui s'agrège ; chaque autre onglet est
 * une liste d'un seul type de transaction — et toutes citent un véhicule,
 * parce que c'est là que vit la dépense.
 *
 * Demande du métier du 3 septembre 2026 : « comme pour les véhicules et les
 * chauffeurs, chaque fournisseur a une page détail pour voir ses statistiques
 * entre autres ». Rien ne s'y saisit : tout est lu.
 * ==========================================================================*/

type Onglet = "apercu" | "compte" | "evaluation" | "demandes" | "interventions" | "pleins" | "caisse" | "documents" | "visites" | "identite";

const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: "apercu", libelle: "Aperçu" },
  /* Le compte et l'évaluation viennent en tête : ce sont les deux questions
     qu'on se pose avant de rappeler un fournisseur — combien lui doit-on, et
     est-ce qu'on continue avec lui. */
  { cle: "compte", libelle: "Compte" },
  { cle: "evaluation", libelle: "Évaluation" },
  { cle: "demandes", libelle: "Demandes d'achat" },
  { cle: "interventions", libelle: "Interventions" },
  { cle: "pleins", libelle: "Pleins" },
  { cle: "caisse", libelle: "Sorties de caisse" },
  { cle: "documents", libelle: "Documents" },
  { cle: "visites", libelle: "Visites techniques" },
  { cle: "identite", libelle: "Identité" },
];

function estOnglet(x: string | undefined): x is Onglet {
  return ONGLETS.some((o) => o.cle === x);
}

const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function libelleMois(mois: string): string {
  const [a, m] = mois.split("-");
  return `${MOIS_COURT[Number(m) - 1]} ${a!.slice(2)}`;
}

function Vehicule({ immatriculation, affichee }: { immatriculation: string; affichee: string }) {
  return (
    <Link href={`/flotte/${immatriculation}`} className="code font-medium text-accent-fonce hover:underline">
      {affichee}
    </Link>
  );
}

export function FichePrestataire({ fiche, compte: compteServeur, ongletInitial, aujourdhui, cible }: { fiche: Fiche; compte: Compte; ongletInitial?: string; aujourdhui: string; cible?: string }) {
  const [onglet, setOnglet] = useState<Onglet>(estOnglet(ongletInitial) ? ongletInitial : "apercu");
  useCible(cible, onglet);
  const [periode, setPeriode] = useState<PeriodeMois>(12);
  const { surcharger, demander, creer, creations } = useEdition();

  const p = surcharger(fiche.prestataire);
  const debut = debutPeriode(periode, new Date(`${aujourdhui}T00:00:00Z`));

  /*
   * Le compte et la note viennent du serveur, calculés sur **toute** la
   * relation, jamais sur la période choisie : une dette de l'an dernier reste
   * une dette, et une note fondée sur trois mois ne vaudrait rien. Les avances
   * et les évaluations saisies depuis la fiche s'y ajoutent, et la note se
   * recalcule avec elles.
   */
  const dettes = compteServeur.dettes;
  const libellePiece = (numero: string): string | null => {
    const i = fiche.interventions.find((x) => x.numero === numero);
    if (i) return `${i.objet} — ${i.immatriculationAffichee}`;
    const d = fiche.demandes.find((x) => x.numero === numero);
    return d ? d.objet : null;
  };
  const avancesFiche = [...creations("avance", fabriquerAvance(fiche.prestataire.numero)), ...compteServeur.avances.map(surcharger)];
  const evaluationsFiche = [...creations("evaluation", fabriquerEvaluation(fiche.prestataire.numero, libellePiece)), ...compteServeur.evaluations.map(surcharger)];
  const notation = useMemo(() => notationDe(compteServeur, evaluationsFiche), [compteServeur, evaluationsFiche]);

  /* La pièce qu'on évalue : une intervention ou une demande d'achat de ce
     prestataire, la plus récente d'abord. Sans pièce connue, le champ reste libre. */
  const pieces = [...fiche.interventions.map((i) => ({ valeur: i.numero, libelle: `${i.numero} · ${i.objet} — ${i.immatriculationAffichee}` })), ...fiche.demandes.map((d) => ({ valeur: d.numero, libelle: `${d.numero} · ${d.objet}` }))];
  function nouvelleAvance() {
    creer({ type: "avance", titre: `Avance à ${p.raisonSociale}`, champs: CHAMPS.avance, valeurs: { date: aujourdhui, prestataireNumero: p.numero } });
  }
  function evaluerService() {
    const piece: ChampEdition = pieces.length > 0 ? { cle: "pieceNumero", libelle: "Service évalué", type: "choix", options: pieces, obligatoire: true } : { cle: "pieceNumero", libelle: "Service évalué (numéro de la pièce)", type: "texte", obligatoire: true };
    creer({ type: "evaluation", titre: `Évaluer un service de ${p.raisonSociale}`, champs: [piece, ...CHAMPS.evaluation], valeurs: { date: aujourdhui, prestataireNumero: p.numero, pieceNumero: pieces[0]?.valeur ?? "", qualite: 4, delai: 4, prix: 4 } });
  }

  /* ---- Ce que la période retient ---- */
  const sel = useMemo(() => {
    const dans = <T extends { date: string }>(l: T[]) => l.filter((x) => x.date >= debut);
    const demandes = dans(fiche.demandes).map((d) => surcharger(d));
    return {
      demandes,
      achats: demandes.filter((d) => phaseDe(d.etape) !== "validation" && d.etape !== "refusee"),
      interventions: dans(fiche.interventions),
      pleins: dans(fiche.pleins),
      caisse: dans(fiche.depensesCaisse),
      documents: fiche.documents.filter((d) => (d.dateEffet ?? "") >= debut),
      visites: fiche.visites.filter((v) => v.dateRendezVous >= debut),
    };
  }, [fiche, debut, surcharger]);

  const montantAchats = sel.achats.reduce((s, d) => s + coutDe(d).montant, 0);
  const nonRegle = sel.achats.filter((d) => d.etape !== "reglee");
  const montantNonRegle = nonRegle.reduce((s, d) => s + coutDe(d).montant, 0);
  const montantInterventions = sel.interventions.reduce((s, i) => s + i.montant, 0);
  const montantCaisse = sel.caisse.reduce((s, d) => s + d.montant, 0);
  const litres = sel.pleins.reduce((s, x) => s + x.litres, 0);
  const montantPleins = sel.pleins.reduce((s, x) => s + x.montant, 0);
  const delais = sel.achats.filter((d) => d.dateFacture && d.dateReglement).map((d) => Math.round((Date.parse(d.dateReglement!) - Date.parse(d.dateFacture!)) / 86_400_000));
  const delaiMoyen = delais.length ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : null;
  const vehicules = new Set([...sel.achats.map((d) => d.vehiculeId), ...sel.interventions.map((i) => i.vehiculeId), ...sel.pleins.map((x) => x.vehiculeId), ...sel.caisse.map((d) => d.vehiculeId)].filter(Boolean)).size;
  /* Tout ce que le parc a payé à ce prestataire sur la période, toutes voies
     confondues : bons de commande (les demandes), caisse, et ce qui n'est pas
     encore passé par une demande (interventions et pleins cités par leur nom). */
  const totalPeriode = montantAchats + montantCaisse + sel.interventions.filter((i) => !sel.achats.some((d) => d.depenseNumero === i.numero || d.origineNumero === i.numero)).reduce((s, i) => s + i.montant, 0) + montantPleins;

  /* ---- Par mois et par poste, pour l'Aperçu ---- */
  const parMois = useMemo(() => {
    const m = new Map<string, number>();
    const ajouter = (d: string, v: number) => m.set(d.slice(0, 7), (m.get(d.slice(0, 7)) ?? 0) + v);
    for (const d of sel.achats) ajouter(d.date, coutDe(d).montant);
    for (const d of sel.caisse) ajouter(d.date, d.montant);
    for (const x of sel.pleins) ajouter(x.date, x.montant);
    for (const i of sel.interventions) if (!sel.achats.some((d) => d.depenseNumero === i.numero || d.origineNumero === i.numero)) ajouter(i.date, i.montant);
    const points: { libelle: string; valeur: number; precision?: string }[] = [];
    const ref = new Date(`${aujourdhui}T00:00:00Z`);
    for (let k = periode - 1; k >= 0; k--) {
      const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - k, 1));
      const cle = d.toISOString().slice(0, 7);
      points.push({ libelle: libelleMois(cle), valeur: m.get(cle) ?? 0, precision: montant(m.get(cle) ?? 0) });
    }
    return points;
  }, [sel, periode, aujourdhui]);

  const parPoste = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of sel.achats) m.set(POSTE_DEPENSE[d.poste], (m.get(POSTE_DEPENSE[d.poste]) ?? 0) + coutDe(d).montant);
    for (const d of sel.caisse) m.set(POSTE_DEPENSE[d.poste], (m.get(POSTE_DEPENSE[d.poste]) ?? 0) + d.montant);
    for (const x of sel.pleins) m.set("Carburant", (m.get("Carburant") ?? 0) + x.montant);
    for (const i of sel.interventions) if (!sel.achats.some((d) => d.depenseNumero === i.numero || d.origineNumero === i.numero)) m.set(i.type === "preventif" ? "Maintenance préventive" : "Maintenance curative", (m.get(i.type === "preventif" ? "Maintenance préventive" : "Maintenance curative") ?? 0) + i.montant);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [sel]);
  const totalPostes = parPoste.reduce((s, [, v]) => s + v, 0);

  function modifier() {
    demander({ type: "prestataire", numero: p.numero, titre: `Prestataire ${p.numero} · ${p.raisonSociale}`, valeurs: p as unknown as Record<string, unknown>, champs: CHAMPS.prestataire });
  }
  function nouvelleDemande() {
    creer({
      type: "achat",
      titre: `Nouvelle demande d'achat · ${p.raisonSociale}`,
      champs: champsCreation("achat", { pour: "caisse" }),
      valeurs: { date: aujourdhui, urgence: "normale", prestataireNumero: p.numero },
      /* La demande vit sur l'écran Caisse & achats, pas sur le prestataire. */
      sujetDe: () => "caisse",
    });
  }

  /* Les onglets sans matière restent visibles mais grisés : la fiche dit ce
     qu'elle ne sait pas, plutôt que de cacher une section. */
  const compte: Record<Onglet, number | null> = {
    apercu: null,
    /* Le compte porte le nombre de pièces dues : c'est le chiffre qu'on cherche
       du regard avant même d'ouvrir l'onglet. */
    compte: dettes.length,
    evaluation: evaluationsFiche.length,
    demandes: fiche.demandes.length,
    interventions: fiche.interventions.length,
    pleins: fiche.pleins.length,
    caisse: fiche.depensesCaisse.length,
    documents: fiche.documents.length,
    visites: fiche.visites.length,
    identite: null,
  };

  return (
    <div className="flex flex-col lg:h-full">
      {/* ---- En-tête fixe ---- */}
      <div className="flex shrink-0 flex-col gap-4 border-b border-bordure px-8 pt-6 pb-0">
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
          <Link href="/prestataires" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
            <ChevronLeft className="size-3.5" strokeWidth={1.8} />
            Prestataires
          </Link>
        </nav>

        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-fond text-[15px] font-semibold text-accent-tres-fonce">{initialesPrestataire(p.raisonSociale)}</span>
          <div className="min-w-0 flex-1 basis-[360px]">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="titre-page">{p.raisonSociale}</h1>
              <Pastille ton={TON_TYPE_PRESTATAIRE[p.type]}>{TYPE_PRESTATAIRE[p.type]}</Pastille>
              <Echeance ton={p.actif ? "favorable" : "neutre"}>{p.actif ? "Actif" : "Inactif"}</Echeance>
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-texte-2">
              <Numero valeur={p.numero} />
              {p.ville ? (
                <>
                  <span className="text-attenue-2">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-attenue" strokeWidth={1.8} />
                    {p.ville}
                  </span>
                </>
              ) : null}
              {p.contact ? (
                <>
                  <span className="text-attenue-2">·</span>
                  <span>{p.contact}</span>
                </>
              ) : null}
              {p.telephone ? (
                <>
                  <span className="text-attenue-2">·</span>
                  <span className="code inline-flex items-center gap-1.5">
                    <Phone className="size-3.5 text-attenue" strokeWidth={1.8} />
                    {p.telephone}
                  </span>
                </>
              ) : null}
              {p.courriel ? (
                <>
                  <span className="text-attenue-2">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-3.5 text-attenue" strokeWidth={1.8} />
                    {p.courriel}
                  </span>
                </>
              ) : null}
              <span className="text-attenue-2">·</span>
              <span>{p.delaiPaiementJours === null ? "Paiement à la commande" : `Paiement à ${p.delaiPaiementJours} j`}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={modifier} className="bouton-secondaire">
              <Pencil className="size-4 text-texte-2" strokeWidth={1.7} />
              Modifier
            </button>
            {p.actif ? (
              <button type="button" onClick={nouvelleDemande} className="bouton-principal">
                <Plus className="size-4" strokeWidth={2.2} />
                Demande d&apos;achat
              </button>
            ) : null}
          </div>
        </div>

        <BandeauKpi
          kpis={[
            { label: "Total payé", valeur: montantCourt(totalPeriode).replace(/\s?F$/, ""), unite: "F", precision: `toutes voies · ${periode} mois · ${vehicules} véhicule${vehicules > 1 ? "s" : ""}` },
            { label: "Achats sur bon", valeur: `${sel.achats.length}`, unite: "DA", precision: montantAchats > 0 ? `${montantCourt(montantAchats)} · ${sel.demandes.length - sel.achats.length} en validation ou refusée${sel.demandes.length - sel.achats.length > 1 ? "s" : ""}` : "aucune demande commandée" },
            { label: "Non réglé", valeur: montantNonRegle > 0 ? montantCourt(montantNonRegle).replace(/\s?F$/, "") : "0", unite: "F", precision: nonRegle.length > 0 ? `${nonRegle.length} demande${nonRegle.length > 1 ? "s" : ""} dans Sage X3` : "tout est réglé", ton: montantNonRegle > 0 ? "vigilance" : "neutre" },
            { label: "Délai de règlement", valeur: delaiMoyen === null ? "—" : `${delaiMoyen}`, unite: "j", precision: p.delaiPaiementJours === null ? "convenu : à la commande" : `convenu : ${p.delaiPaiementJours} j`, ton: delaiMoyen !== null && p.delaiPaiementJours !== null && delaiMoyen > p.delaiPaiementJours + 7 ? "vigilance" : "neutre" },
            { label: "Interventions", valeur: `${sel.interventions.length}`, precision: montantInterventions > 0 ? montantCourt(montantInterventions) : "aucune sur la période" },
            { label: "Caisse", valeur: `${sel.caisse.length}`, precision: montantCaisse > 0 ? montantCourt(montantCaisse) : litres > 0 ? `${nombre(litres)} L de carburant` : "aucune sortie de caisse" },
          ]}
        />

        <div className="-mb-px flex flex-wrap items-end gap-1">
          <div className="flex flex-wrap items-end gap-1" role="tablist" aria-label="Sections de la fiche">
            {ONGLETS.map((o) => {
              const actif = o.cle === onglet;
              const vide = compte[o.cle] === 0;
              return (
                <button
                  key={o.cle}
                  type="button"
                  role="tab"
                  aria-selected={actif}
                  onClick={() => setOnglet(o.cle)}
                  className={`relative shrink-0 border-b-2 px-2.5 pt-1 pb-3 text-[13px] whitespace-nowrap transition-colors ${
                    actif ? "border-accent font-semibold text-texte" : vide ? "border-transparent font-medium text-attenue-2 hover:text-texte-2" : "border-transparent font-medium text-texte-2 hover:text-texte"
                  }`}
                >
                  {o.libelle}
                  {compte[o.cle] ? <span className="ml-1.5 text-[11px] text-attenue">{compte[o.cle]}</span> : null}
                </button>
              );
            })}
          </div>

          <div className="mb-2 ml-auto flex h-8 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Période de lecture">
            {PERIODES.map((x) => (
              <button
                key={x.valeur}
                type="button"
                aria-pressed={periode === x.valeur}
                onClick={() => setPeriode(x.valeur)}
                className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${periode === x.valeur ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}
              >
                {x.libelle}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Contenu de l'onglet : la seule zone qui défile ---- */}
      <div role="tabpanel" className="defilement-discret min-h-0 flex-1 px-8 py-6 lg:overflow-y-auto">
        {onglet === "compte" ? <ComptePrestataire dettes={dettes} avances={avancesFiche} aujourdhui={aujourdhui} onNouvelleAvance={p.actif ? nouvelleAvance : undefined} /> : null}
        {onglet === "evaluation" ? <EvaluationPrestataire evaluations={evaluationsFiche} notation={notation} onEvaluer={evaluerService} /> : null}

      {onglet === "apercu" ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Carte titre="Dépenses par mois" precision="Demandes commandées au coût connu, sorties de caisse, pleins et interventions payés à ce prestataire">
                {totalPostes > 0 ? <GraphiqueBarres points={parMois} unite="F" hauteur={170} /> : <p className="meta">Rien sur la période.</p>}
              </Carte>
            </div>
            <Carte titre="Par poste" precision="Sur la période">
              {parPoste.length === 0 ? (
                <p className="meta">Rien sur la période.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {parPoste.map(([poste, v]) => (
                    <li key={poste} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="truncate text-texte">{poste}</span>
                        <span className="code shrink-0 font-medium text-texte">{montant(v)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, Math.round((v / totalPostes) * 100))}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
            <Carte titre="Demandes d'achat en cours" precision="Ce que l'on attend encore de ce prestataire ou de Sage X3">
              {sel.demandes.filter((d) => phaseDe(d.etape) !== "close").length === 0 ? (
                <p className="meta">Aucune demande en cours.</p>
              ) : (
                <ul className="divide-y divide-bordure">
                  {sel.demandes
                    .filter((d) => phaseDe(d.etape) !== "close")
                    .slice(0, 8)
                    .map((d) => (
                      <li key={d.numero} className="flex flex-wrap items-center gap-3 py-2 text-[13px]">
                        <Numero valeur={d.numero} />
                        <span className="min-w-0 flex-1 truncate text-texte">{d.objet}</span>
                        {d.immatriculation ? <Vehicule immatriculation={d.immatriculation} affichee={d.immatriculationAffichee ?? d.immatriculation} /> : null}
                        <span className="code font-medium">{montant(coutDe(d).montant)}</span>
                        <Echeance ton={TON_ETAPE_ACHAT[d.etape]}>{ETAPE_ACHAT[d.etape]}</Echeance>
                      </li>
                    ))}
                </ul>
              )}
            </Carte>
            <Carte titre="Situation" className="xl:col-span-2">
              <Definitions
                colonnes={3}
                elements={[
                  { libelle: "Type", valeur: TYPE_PRESTATAIRE[p.type] },
                  { libelle: "Statut", valeur: p.actif ? "Actif — proposé au choix dans les formulaires" : "Inactif — plus proposé, historique lisible" },
                  { libelle: "Délai de paiement convenu", valeur: p.delaiPaiementJours === null ? "À la commande" : `${p.delaiPaiementJours} jours` },
                  { libelle: "Dernière demande d'achat", valeur: fiche.demandes[0] ? `${date(fiche.demandes[0].date)} · ${ETAPE_ACHAT[surcharger(fiche.demandes[0]).etape]}` : "Aucune" },
                  { libelle: "Dernière intervention", valeur: fiche.interventions[0] ? `${date(fiche.interventions[0].date)} · ${fiche.interventions[0].immatriculationAffichee}` : "Aucune" },
                  { libelle: "Véhicules concernés", valeur: vehicules > 0 ? `${vehicules} sur la période` : "Aucun" },
                ]}
              />
              {p.note ? <p className="meta mt-4">{p.note}</p> : null}
            </Carte>
          </div>
        ) : null}

        {onglet === "demandes" ? (
          <Carte titre="Demandes d'achat" precision="Toutes les demandes qui citent ce prestataire, à chaque étape du circuit — le détail de l'achat est dans Sage X3" sansMarge>
            <TableauSimple<LigneAchat>
              reglages="fiche-prestataire.demandes"
              lignes={sel.demandes}
              cle={(d) => d.numero}
              numero={(d) => d.numero}
              cible={cible}
              vide="Aucune demande d'achat sur la période."
              colonnes={[
                { cle: "numero", libelle: "Réf.", rendu: (d) => <Numero valeur={d.numero} /> },
                { cle: "date", libelle: "Date", rendu: (d) => <span className="code">{dateCourte(d.date)}</span> },
                { cle: "objet", libelle: "Objet", rendu: (d) => <span className="block max-w-[320px] truncate">{d.objet}</span> },
                { cle: "vehicule", libelle: "Véhicule", rendu: (d) => (d.immatriculation ? <Vehicule immatriculation={d.immatriculation} affichee={d.immatriculationAffichee ?? d.immatriculation} /> : <span className="text-attenue">—</span>) },
                { cle: "poste", libelle: "Poste", rendu: (d) => POSTE_DEPENSE[d.poste], parDefaut: false },
                { cle: "cout", libelle: "Coût", alignee: "droite", rendu: (d) => <span className="code font-medium">{montant(coutDe(d).montant)}</span> },
                { cle: "nature", libelle: "Nature", rendu: (d) => <span className="text-attenue">{NATURE_COUT[coutDe(d).nature]}</span> },
                { cle: "etape", libelle: "Étape", rendu: (d) => <Echeance ton={TON_ETAPE_ACHAT[d.etape]}>{ETAPE_ACHAT[d.etape]}</Echeance> },
                { cle: "bc", libelle: "Bon Sage X3", rendu: (d) => (d.numeroBonCommande ? <span className="code text-[12px]">{d.numeroBonCommande}</span> : <span className="text-attenue">—</span>) },
                { cle: "reglee", libelle: "Réglée le", rendu: (d) => (d.dateReglement ? <span className="code">{dateCourte(d.dateReglement)}</span> : <span className="text-attenue">—</span>), parDefaut: false },
              ]}
            />
          </Carte>
        ) : null}

        {onglet === "interventions" ? (
          <Carte titre="Interventions" precision="Les interventions réalisées par ce garage, lues sur les fiches véhicules" sansMarge>
            <TableauSimple
              reglages="fiche-prestataire.interventions"
              lignes={sel.interventions}
              cle={(i) => `${i.vehiculeId}-${i.numero}`}
              numero={(i) => i.numero}
              cible={cible}
              vide="Aucune intervention sur la période."
              colonnes={[
                { cle: "numero", libelle: "Réf.", rendu: (i) => <Numero valeur={i.numero} /> },
                { cle: "date", libelle: "Date", rendu: (i) => <span className="code">{dateCourte(i.date)}</span> },
                { cle: "vehicule", libelle: "Véhicule", rendu: (i) => <Vehicule immatriculation={i.immatriculation} affichee={i.immatriculationAffichee} /> },
                { cle: "type", libelle: "Nature", rendu: (i) => <Pastille ton={i.type === "preventif" ? "favorable" : "vigilance"}>{i.type === "preventif" ? "Préventive" : "Curative"}</Pastille> },
                { cle: "objet", libelle: "Objet", rendu: (i) => <span className="block max-w-[320px] truncate">{i.objet}</span> },
                { cle: "immobilisation", libelle: "Immobilisation", alignee: "droite", rendu: (i) => <span className="code">{i.immobilisationJours} j</span> },
                { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (i) => <span className="code font-medium">{montant(i.montant)}</span> },
                { cle: "piece", libelle: "Pièce", rendu: (i) => <span className="code text-[12px]">{i.reference}</span>, parDefaut: false },
              ]}
            />
          </Carte>
        ) : null}

        {onglet === "pleins" ? (
          <Carte titre="Pleins" precision="Les pleins pris chez ce prestataire, lus sur les fiches véhicules" sansMarge>
            <TableauSimple
              reglages="fiche-prestataire.pleins"
              lignes={sel.pleins}
              cle={(x) => `${x.vehiculeId}-${x.numero}`}
              numero={(x) => x.numero}
              cible={cible}
              vide="Aucun plein sur la période."
              colonnes={[
                { cle: "numero", libelle: "Réf.", rendu: (x) => <Numero valeur={x.numero} /> },
                { cle: "date", libelle: "Date", rendu: (x) => <span className="code">{dateCourte(x.date)}</span> },
                { cle: "vehicule", libelle: "Véhicule", rendu: (x) => <Vehicule immatriculation={x.immatriculation} affichee={x.immatriculationAffichee} /> },
                { cle: "litres", libelle: "Litres", alignee: "droite", rendu: (x) => <span className="code">{nombre(x.litres, 1)} L</span> },
                { cle: "prix", libelle: "Prix du litre", alignee: "droite", rendu: (x) => <span className="code">{montant(x.prixLitre)}</span> },
                { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (x) => <span className="code font-medium">{montant(x.montant)}</span> },
              ]}
            />
          </Carte>
        ) : null}

        {onglet === "caisse" ? (
          <Carte titre="Sorties de caisse" precision="Les dépenses réglées en espèces à ce prestataire, lues sur les fiches véhicules" sansMarge>
            <TableauSimple
              reglages="fiche-prestataire.caisse"
              lignes={sel.caisse}
              cle={(d) => d.numero}
              numero={(d) => d.numero}
              cible={cible}
              vide="Aucune sortie de caisse sur la période."
              colonnes={[
                { cle: "numero", libelle: "Réf.", rendu: (d) => <Numero valeur={d.numero} /> },
                { cle: "date", libelle: "Date", rendu: (d) => <span className="code">{dateCourte(d.date)}</span> },
                { cle: "vehicule", libelle: "Véhicule", rendu: (d) => <Vehicule immatriculation={d.immatriculation} affichee={d.immatriculationAffichee} /> },
                { cle: "libelle", libelle: "Libellé", rendu: (d) => <span className="block max-w-[320px] truncate">{d.libelle}</span> },
                { cle: "poste", libelle: "Poste", rendu: (d) => POSTE_DEPENSE[d.poste] },
                { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (d) => <span className="code font-medium">{montant(d.montant)}</span> },
                { cle: "justificatif", libelle: "Justificatif", rendu: (d) => (d.justificatif ? <Echeance ton="favorable">Fourni</Echeance> : <Echeance ton="vigilance">Manquant</Echeance>) },
              ]}
            />
          </Carte>
        ) : null}

        {onglet === "documents" ? (
          <Carte titre="Documents émis" precision="Assurances et autres pièces émises par ce prestataire, lues sur les fiches véhicules" sansMarge>
            <TableauSimple
              reglages="fiche-prestataire.documents"
              lignes={sel.documents}
              cle={(d) => `${d.vehiculeId}-${d.numero}`}
              numero={(d) => d.numero}
              cible={cible}
              vide="Aucun document sur la période."
              colonnes={[
                { cle: "numero", libelle: "Réf.", rendu: (d) => <Numero valeur={d.numero} /> },
                { cle: "type", libelle: "Document", rendu: (d) => d.libelle },
                { cle: "vehicule", libelle: "Véhicule", rendu: (d) => <Vehicule immatriculation={d.immatriculation} affichee={d.immatriculationAffichee} /> },
                { cle: "piece", libelle: "N° de pièce", rendu: (d) => (d.numeroPiece ? <span className="code text-[12px]">{d.numeroPiece}</span> : <span className="text-attenue">—</span>) },
                { cle: "effet", libelle: "Effet", rendu: (d) => (d.dateEffet ? <span className="code">{dateCourte(d.dateEffet)}</span> : <span className="text-attenue">—</span>) },
                { cle: "echeance", libelle: "Échéance", rendu: (d) => (d.echeance ? <span className="code">{dateCourte(d.echeance)}</span> : <span className="text-attenue">permanent</span>) },
                { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (d) => (d.montant ? <span className="code font-medium">{montant(d.montant)}</span> : <span className="text-attenue">—</span>) },
              ]}
            />
          </Carte>
        ) : null}

        {onglet === "visites" ? (
          <Carte titre="Visites techniques" precision="Les passages au centre agréé, lus sur les fiches véhicules" sansMarge>
            <TableauSimple
              reglages="fiche-prestataire.visites"
              lignes={sel.visites}
              cle={(v) => `${v.vehiculeId}-${v.numero}`}
              numero={(v) => v.numero}
              cible={cible}
              vide="Aucune visite sur la période."
              colonnes={[
                { cle: "numero", libelle: "Réf.", rendu: (v) => <Numero valeur={v.numero} /> },
                { cle: "rdv", libelle: "Rendez-vous", rendu: (v) => <span className="code">{dateCourte(v.dateRendezVous)}</span> },
                { cle: "vehicule", libelle: "Véhicule", rendu: (v) => <Vehicule immatriculation={v.immatriculation} affichee={v.immatriculationAffichee} /> },
                { cle: "type", libelle: "Type", rendu: (v) => (v.type === "contre-visite" ? "Contre-visite" : "Visite") },
                { cle: "passage", libelle: "Passage", rendu: (v) => (v.datePassage ? <span className="code">{dateCourte(v.datePassage)}</span> : <span className="text-attenue">à venir</span>) },
                { cle: "statut", libelle: "Résultat", rendu: (v) => <Echeance ton={v.statut === "acceptee" ? "favorable" : v.statut === "refusee" ? "defavorable" : "neutre"}>{v.statut === "acceptee" ? "Acceptée" : v.statut === "refusee" ? "Refusée" : v.statut === "annulee" ? "Annulée" : "Prévue"}</Echeance> },
                { cle: "pv", libelle: "N° de PV", rendu: (v) => (v.numeroPv ? <span className="code text-[12px]">{v.numeroPv}</span> : <span className="text-attenue">—</span>) },
              ]}
            />
          </Carte>
        ) : null}

        {onglet === "identite" ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Carte titre="Raison sociale et contact">
              <Definitions
                elements={[
                  { libelle: "Raison sociale", valeur: p.raisonSociale },
                  { libelle: "Type", valeur: TYPE_PRESTATAIRE[p.type] },
                  { libelle: "Contact", valeur: p.contact },
                  { libelle: "Téléphone", valeur: p.telephone ? <span className="code">{p.telephone}</span> : null },
                  { libelle: "Courriel", valeur: p.courriel },
                  { libelle: "Adresse", valeur: p.adresse },
                  { libelle: "Ville", valeur: p.ville },
                ]}
              />
            </Carte>
            <Carte titre="Conditions et référence">
              <Definitions
                elements={[
                  { libelle: "Numéro", valeur: <Numero valeur={p.numero} /> },
                  { libelle: "NINEA", valeur: p.ninea ? <span className="code">{p.ninea}</span> : null },
                  { libelle: "Délai de paiement", valeur: p.delaiPaiementJours === null ? "À la commande" : `${p.delaiPaiementJours} jours` },
                  { libelle: "Statut", valeur: p.actif ? "Actif" : "Inactif" },
                  { libelle: "Note", valeur: p.note },
                ]}
              />
            </Carte>
          </div>
        ) : null}
      </div>
    </div>
  );
}
