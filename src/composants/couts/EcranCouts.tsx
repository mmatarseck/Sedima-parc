"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { BandeauKpi } from "@/composants/interface/BandeauKpi";
import { Carte } from "@/composants/interface/Carte";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { GraphiqueBarres } from "@/composants/vehicule/GraphiqueBarres";
import {
  bilanVehicule,
  lignesParPoste,
  moisDePeriode,
  PERIMETRE,
  PERIODES_COUTS,
  qualifier,
  signe,
  totauxParMois,
  VERDICT_COUT,
  type BilanVehicule,
  type NombreMois,
  type Perimetre,
} from "@/domaine/couts";
import type { DonneesVehicule } from "@/domaine/couts";
import { BUSINESS_UNIT, CATEGORIE_VEHICULE, GROUPE_CHARGE, POSTE_DEPENSE, type GroupeCharge } from "@/domaine/libelles";
import type { BusinessUnit } from "@/domaine/types";
import { montant, montantCourt, nombre } from "@/lib/format";

/* ============================================================================
 * Coûts & analyses — Pilotage. Rien ne s'y saisit : tout est lu sur les
 * dépenses, les kilomètres et les litres des fiches véhicules.
 *
 * Quatre vues par bouton à segments, période, périmètre et business unit
 * communs :
 *  - **Synthèse** — combien, où va l'argent, ce qui dérive ;
 *  - **Véhicules** — une ligne par véhicule, le coût au kilomètre situé dans sa
 *    catégorie : c'est l'arbitrage réparer / réformer ;
 *  - **Postes** — le tableau poste × mois que le métier tient à la main dans
 *    « Suivi dépenses parc » ;
 *  - **Carburant** — le rapport mensuel des consommations, véhicule × mois,
 *    contre la référence de la catégorie (la fiche ne montre que les pleins).
 *
 * Le bandeau de KPI est réservé au tableau de bord SQDCM ; ici les six tuiles
 * ouvrent la Synthèse, qui est une lecture d'agrégats et non une liste.
 * ==========================================================================*/

export type VueCouts = "synthese" | "vehicules" | "postes" | "carburant";

const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function libelleMois(mois: string): string {
  const [a, m] = mois.split("-");
  return `${MOIS_COURT[Number(m) - 1]} ${a!.slice(2)}`;
}

/* Une pilule de bouton à segments — la forme retenue partout dans l'application. */
function Segments<T extends string | number>({ valeur, options, onChange, etiquette }: { valeur: T; options: { cle: T; libelle: string; titre?: string }[]; onChange: (v: T) => void; etiquette: string }) {
  return (
    <div className="sans-barre flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-surface-3 p-1" role="group" aria-label={etiquette}>
      {options.map((o) => (
        <button
          key={o.cle}
          type="button"
          title={o.titre}
          aria-pressed={valeur === o.cle}
          onClick={() => onChange(o.cle)}
          className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${valeur === o.cle ? "bg-surface font-semibold text-texte" : "font-medium text-texte-2 hover:text-texte"}`}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

function Tiret() {
  return <span className="text-attenue">—</span>;
}

const GROUPES: GroupeCharge[] = ["carburant", "maintenance", "autres"];
const COULEUR_GROUPE: Record<GroupeCharge, string> = { carburant: "bg-accent", maintenance: "bg-vigilance", autres: "bg-attenue-2" };

export function EcranCouts({ donnees, aujourdhui, vueInitiale = "synthese" }: { donnees: DonneesVehicule[]; aujourdhui: string; vueInitiale?: VueCouts }) {
  const [vue, setVue] = useState<VueCouts>(vueInitiale);
  const [periode, setPeriode] = useState<NombreMois>(12);
  const [perimetre, setPerimetre] = useState<Perimetre>("exploitation");
  const [bu, setBu] = useState<BusinessUnit | "toutes">("toutes");

  const mois = useMemo(() => moisDePeriode(aujourdhui, periode), [aujourdhui, periode]);

  /* Le verdict d'un véhicule se prend contre toute sa catégorie, quelle que soit
     la business unit affichée : filtrer d'abord fausserait la médiane. */
  const bilansTous = useMemo(() => qualifier(donnees.map((d) => bilanVehicule(d, mois, perimetre))), [donnees, mois, perimetre]);
  const bilans = useMemo(() => bilansTous.filter((b) => bu === "toutes" || b.donnees.businessUnit === bu), [bilansTous, bu]);
  const filtrees = useMemo(() => bilans.map((b) => b.donnees), [bilans]);
  const bus = useMemo(() => (Object.keys(BUSINESS_UNIT) as BusinessUnit[]).filter((b) => donnees.some((d) => d.businessUnit === b)), [donnees]);

  const totaux = useMemo(() => totauxParMois(filtrees, mois, perimetre), [filtrees, mois, perimetre]);
  const postes = useMemo(() => lignesParPoste(filtrees, mois, perimetre), [filtrees, mois, perimetre]);

  const total = bilans.reduce((s, b) => s + b.total, 0);
  const km = bilans.reduce((s, b) => s + b.km, 0);
  const litres = bilans.reduce((s, b) => s + b.litres, 0);
  const parGroupe: Record<GroupeCharge, number> = { carburant: 0, maintenance: 0, autres: 0 };
  for (const b of bilans) for (const g of GROUPES) parGroupe[g] += b.parGroupe[g];
  const coutParKm = km > 0 ? Math.round(total / km) : null;
  const l100 = km > 0 && litres > 0 ? Math.round((litres / km) * 1000) / 10 : null;
  /* Référence pondérée par les kilomètres de chaque véhicule : une flotte de
     camions n'a pas la référence d'une flotte de camionnettes. */
  const refPonderee = km > 0 ? Math.round((bilans.reduce((s, b) => s + b.donnees.referenceL100 * b.km, 0) / km) * 10) / 10 : null;
  const ecartL100 = l100 !== null && refPonderee ? Math.round(((l100 - refPonderee) / refPonderee) * 100) : null;
  const aArbitrer = bilans.filter((b) => b.verdict === "defavorable").length;
  const aSurveiller = bilans.filter((b) => b.verdict === "vigilance").length;
  const enDerive = bilans.filter((b) => b.ecartL100Pct !== null && b.ecartL100Pct > 15).length;
  const moyenneMois = totaux.length ? total / totaux.length : 0;

  /* ---- Colonnes de la vue Véhicules ---- */
  const colonnes = useMemo<ColonneListe<BilanVehicule>[]>(
    () => [
      { cle: "libelle", libelle: "Véhicule", parDefaut: true, largeur: 200, rendu: (b) => <span className="block truncate">{b.donnees.libelle}</span> },
      { cle: "categorie", libelle: "Catégorie", parDefaut: true, largeur: 130, texte: (b) => CATEGORIE_VEHICULE[b.donnees.categorie], rendu: (b) => CATEGORIE_VEHICULE[b.donnees.categorie] },
      { cle: "bu", libelle: "BU", parDefaut: false, largeur: 130, texte: (b) => (b.donnees.businessUnit ? BUSINESS_UNIT[b.donnees.businessUnit] : ""), rendu: (b) => (b.donnees.businessUnit ? BUSINESS_UNIT[b.donnees.businessUnit] : <Tiret />) },
      { cle: "site", libelle: "Site", parDefaut: false, largeur: 150, rendu: (b) => b.donnees.site ?? <Tiret /> },
      { cle: "km", libelle: "Km", parDefaut: true, largeur: 100, alignee: "droite", tri: (b) => b.km, rendu: (b) => (b.km > 0 ? <span className="code">{nombre(b.km)}</span> : <Tiret />) },
      { cle: "total", libelle: "Total", parDefaut: true, largeur: 120, alignee: "droite", tri: (b) => b.total, rendu: (b) => <span className="code font-semibold">{montant(b.total)}</span> },
      { cle: "carburant", libelle: "Carburant", parDefaut: true, largeur: 115, alignee: "droite", tri: (b) => b.parGroupe.carburant, rendu: (b) => <span className="code">{montantCourt(b.parGroupe.carburant)}</span> },
      { cle: "maintenance", libelle: "Maintenance", parDefaut: true, largeur: 115, alignee: "droite", tri: (b) => b.parGroupe.maintenance, rendu: (b) => <span className="code">{montantCourt(b.parGroupe.maintenance)}</span> },
      { cle: "autres", libelle: "Autres", parDefaut: false, largeur: 110, alignee: "droite", tri: (b) => b.parGroupe.autres, rendu: (b) => <span className="code">{montantCourt(b.parGroupe.autres)}</span> },
      { cle: "coutKm", libelle: "Coût / km", parDefaut: true, largeur: 105, alignee: "droite", tri: (b) => b.coutParKm, rendu: (b) => (b.coutParKm === null ? <Tiret /> : <span className="code font-medium">{nombre(b.coutParKm)} F</span>) },
      {
        cle: "ecartCategorie",
        libelle: "Écart catégorie",
        parDefaut: true,
        largeur: 125,
        alignee: "droite",
        tri: (b) => b.ecartCategoriePct,
        rendu: (b) => (b.ecartCategoriePct === null ? <Tiret /> : <span className={`code ${b.ecartCategoriePct > 15 ? "font-medium text-defavorable" : b.ecartCategoriePct < -15 ? "text-favorable" : "text-texte-2"}`}>{signe(b.ecartCategoriePct)}</span>),
      },
      { cle: "l100", libelle: "L/100 km", parDefaut: true, largeur: 105, alignee: "droite", tri: (b) => b.litresAux100, rendu: (b) => (b.litresAux100 === null ? <Tiret /> : <span className="code">{nombre(b.litresAux100, 1)}</span>) },
      { cle: "ref", libelle: "Réf. L/100", parDefaut: false, largeur: 95, alignee: "droite", rendu: (b) => <span className="code text-attenue">{nombre(b.donnees.referenceL100, 1)}</span> },
      {
        cle: "ecartL100",
        libelle: "Écart conso",
        parDefaut: true,
        largeur: 105,
        alignee: "droite",
        tri: (b) => b.ecartL100Pct,
        rendu: (b) => (b.ecartL100Pct === null ? <Tiret /> : <span className={`code ${b.ecartL100Pct > 15 ? "font-medium text-defavorable" : b.ecartL100Pct > 8 ? "text-vigilance" : "text-texte-2"}`}>{signe(b.ecartL100Pct)}</span>),
      },
      { cle: "curatifs", libelle: "Pannes", parDefaut: true, largeur: 85, alignee: "droite", tri: (b) => b.curatifs, rendu: (b) => (b.curatifs > 0 ? <span className={`code ${b.curatifs >= 3 ? "font-medium text-vigilance" : ""}`}>{b.curatifs}</span> : <Tiret />) },
      { cle: "immobilisation", libelle: "Immobilisé", parDefaut: false, largeur: 100, alignee: "droite", tri: (b) => b.immobilisationJours, rendu: (b) => (b.immobilisationJours > 0 ? <span className="code">{b.immobilisationJours} j</span> : <Tiret />) },
      { cle: "tendance", libelle: "Tendance", parDefaut: true, largeur: 100, alignee: "droite", tri: (b) => b.tendancePct, rendu: (b) => (b.tendancePct === null ? <Tiret /> : <span className={`code ${b.tendancePct > 25 ? "text-defavorable" : b.tendancePct < -25 ? "text-favorable" : "text-texte-2"}`}>{signe(b.tendancePct)}</span>) },
      { cle: "age", libelle: "Âge", parDefaut: false, largeur: 80, alignee: "droite", tri: (b) => b.donnees.ageAnnees, rendu: (b) => (b.donnees.ageAnnees === null ? <Tiret /> : <span className="code">{nombre(b.donnees.ageAnnees, 1)} ans</span>) },
      { cle: "verdict", libelle: "Lecture", parDefaut: true, largeur: 130, texte: (b) => VERDICT_COUT[b.verdict].libelle, rendu: (b) => <Echeance ton={VERDICT_COUT[b.verdict].ton}>{VERDICT_COUT[b.verdict].libelle}</Echeance> },
    ],
    [],
  );

  const filtres = useMemo<FiltreListe<BilanVehicule>[]>(
    () => [
      { cle: "tous", libelle: "Tous", retient: () => true },
      { cle: "arbitrer", libelle: "À arbitrer", retient: (b) => b.verdict === "defavorable" },
      { cle: "surveiller", libelle: "À surveiller", retient: (b) => b.verdict === "vigilance" || b.verdict === "defavorable" },
      { cle: "economes", libelle: "Économes", retient: (b) => b.verdict === "favorable" },
      { cle: "derive", libelle: "Conso en dérive", retient: (b) => b.ecartL100Pct !== null && b.ecartL100Pct > 8 },
      { cle: "lourds", libelle: "Lourds", retient: (b) => ["camion", "tracteur", "semi-remorque"].includes(b.donnees.categorie) },
      { cle: "legers", libelle: "Légers", retient: (b) => ["camionnette", "vehicule-leger"].includes(b.donnees.categorie) },
    ],
    [],
  );

  /* ---- Pour la Synthèse : par BU, par catégorie, les véhicules à arbitrer ---- */
  const parBu = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bilans) m.set(b.donnees.businessUnit ? BUSINESS_UNIT[b.donnees.businessUnit] : "Sans BU", (m.get(b.donnees.businessUnit ? BUSINESS_UNIT[b.donnees.businessUnit] : "Sans BU") ?? 0) + b.total);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [bilans]);
  const parCategorie = useMemo(() => {
    const m = new Map<string, { n: number; total: number; km: number; min: number | null; max: number | null }>();
    for (const b of bilans) {
      const cle = CATEGORIE_VEHICULE[b.donnees.categorie];
      const x = m.get(cle) ?? { n: 0, total: 0, km: 0, min: null, max: null };
      x.n += 1;
      x.total += b.total;
      x.km += b.km;
      if (b.coutParKm !== null) {
        x.min = x.min === null ? b.coutParKm : Math.min(x.min, b.coutParKm);
        x.max = x.max === null ? b.coutParKm : Math.max(x.max, b.coutParKm);
      }
      m.set(cle, x);
    }
    return [...m].sort((a, b) => b[1].total - a[1].total);
  }, [bilans]);
  const aArbitrerListe = useMemo(() => bilans.filter((b) => b.verdict === "defavorable" || b.verdict === "vigilance").sort((a, b) => (b.ecartCategoriePct ?? 0) - (a.ecartCategoriePct ?? 0)).slice(0, 6), [bilans]);

  const sousTitre = `${bilans.length} véhicule${bilans.length > 1 ? "s" : ""} · ${periode} mois · ${montant(total)} · ${coutParKm === null ? "coût au km inconnu" : `${nombre(coutParKm)} F/km`} · périmètre ${PERIMETRE[perimetre].libelle.toLowerCase()}`;

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran
        titre="Coûts & analyses"
        sousTitre={sousTitre}
        actions={
          <>
            <Segments
              valeur={vue}
              options={[
                { cle: "synthese" as VueCouts, libelle: "Synthèse" },
                { cle: "vehicules" as VueCouts, libelle: "Véhicules" },
                { cle: "postes" as VueCouts, libelle: "Postes" },
                { cle: "carburant" as VueCouts, libelle: "Carburant" },
              ]}
              onChange={setVue}
              etiquette="Vue"
            />
            <Segments valeur={periode} options={PERIODES_COUTS.map((p) => ({ cle: p.valeur, libelle: p.libelle }))} onChange={setPeriode} etiquette="Période" />
            <Segments
              valeur={perimetre}
              options={(Object.keys(PERIMETRE) as Perimetre[]).map((p) => ({ cle: p, libelle: PERIMETRE[p].libelle, titre: PERIMETRE[p].precision }))}
              onChange={setPerimetre}
              etiquette="Périmètre des coûts"
            />
            <Segments
              valeur={bu}
              options={[{ cle: "toutes" as BusinessUnit | "toutes", libelle: "Toutes BU" }, ...bus.map((b) => ({ cle: b as BusinessUnit | "toutes", libelle: BUSINESS_UNIT[b] }))]}
              onChange={setBu}
              etiquette="Business unit"
            />
          </>
        }
      />

      {vue === "synthese" ? (
        <>
          {/* `shrink-0` est obligatoire : dans un conteneur flex-column
              défilant, le bandeau s'écrase dès que le contenu dépasse. */}
          <div className="shrink-0">
            <BandeauKpi
                kpis={[
                { label: "Coût total", valeur: montantCourt(total).replace(/\s?F$/, ""), unite: "F", precision: `${montantCourt(moyenneMois)} par mois en moyenne` },
                { label: "Coût au kilomètre", valeur: coutParKm === null ? "—" : nombre(coutParKm), unite: "F/km", precision: km > 0 ? `${nombre(km)} km parcourus` : "aucun kilomètre relevé" },
                { label: "Carburant", valeur: total > 0 ? `${Math.round((parGroupe.carburant / total) * 100)}` : "—", unite: "%", precision: montantCourt(parGroupe.carburant) },
                { label: "Maintenance", valeur: total > 0 ? `${Math.round((parGroupe.maintenance / total) * 100)}` : "—", unite: "%", precision: `${montantCourt(parGroupe.maintenance)} · pièces et pneus compris`, ton: total > 0 && parGroupe.maintenance / total > 0.4 ? "vigilance" : "neutre" },
                { label: "Consommation", valeur: l100 === null ? "—" : nombre(l100, 1), unite: "L/100", precision: refPonderee !== null ? `référence ${nombre(refPonderee, 1)} · ${signe(ecartL100)} · ${enDerive} en dérive` : "aucun litre", ton: ecartL100 !== null && ecartL100 > 8 ? "vigilance" : "neutre" },
                { label: "À arbitrer", valeur: `${aArbitrer}`, precision: `${aSurveiller} à surveiller · coût au km contre la catégorie`, ton: aArbitrer > 0 ? "defavorable" : aSurveiller > 0 ? "vigilance" : "favorable" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Carte titre="Évolution mensuelle" precision={`Toutes charges du périmètre, ${PERIMETRE[perimetre].libelle.toLowerCase()} — la ligne est la moyenne de la période`}>
                <GraphiqueBarres points={totaux.map((t) => ({ libelle: libelleMois(t.mois), valeur: t.total, precision: `${montant(t.total)} · ${nombre(t.km)} km` }))} reference={moyenneMois} seuilPct={25} unite="F" hauteur={190} />
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                  {GROUPES.map((g) => (
                    <span key={g} className="inline-flex items-center gap-1.5 text-[12.5px] text-texte-2">
                      <span className={`size-2.5 rounded-full ${COULEUR_GROUPE[g]}`} />
                      {GROUPE_CHARGE[g]} · <span className="code text-texte">{montantCourt(parGroupe[g])}</span>
                    </span>
                  ))}
                </div>
              </Carte>
            </div>

            <Carte titre="Où va l'argent" precision="Trois familles de charges, et le premier poste de chacune">
              <ul className="flex flex-col gap-3">
                {GROUPES.map((g) => {
                  const part = total > 0 ? parGroupe[g] / total : 0;
                  const premier = postes.filter((p) => p.groupe === g)[0];
                  return (
                    <li key={g} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="text-texte">{GROUPE_CHARGE[g]}</span>
                        <span className="code font-medium text-texte">
                          {montant(parGroupe[g])} <span className="text-attenue">· {Math.round(part * 100)} %</span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div className={`h-full rounded-full ${COULEUR_GROUPE[g]}`} style={{ width: `${Math.max(1, Math.round(part * 100))}%` }} />
                      </div>
                      {premier ? (
                        <span className="meta">
                          d&apos;abord {POSTE_DEPENSE[premier.poste].toLowerCase()} · {montantCourt(premier.total)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Carte>

            <Carte titre="Véhicules à arbitrer" precision="Coût au kilomètre au-delà de la médiane de leur catégorie — réparer ou réformer ?">
              {aArbitrerListe.length === 0 ? (
                <p className="meta">Aucun véhicule ne dépasse sa catégorie sur la période.</p>
              ) : (
                <ul className="divide-y divide-bordure">
                  {aArbitrerListe.map((b) => (
                    <li key={b.donnees.vehiculeId} className="flex flex-wrap items-center gap-3 py-2 text-[13px]">
                      <Link href={`/flotte/${b.donnees.immatriculation}`} className="code font-medium text-accent-fonce hover:underline">
                        {b.donnees.immatriculationAffichee}
                      </Link>
                      <span className="min-w-0 flex-1 truncate text-texte-2">
                        {b.donnees.libelle} · {CATEGORIE_VEHICULE[b.donnees.categorie]}
                      </span>
                      <span className="code">{b.coutParKm === null ? "—" : `${nombre(b.coutParKm)} F/km`}</span>
                      <span className={`code font-medium ${b.verdict === "defavorable" ? "text-defavorable" : "text-vigilance"}`}>{signe(b.ecartCategoriePct)}</span>
                      {b.curatifs >= 3 ? <Pastille ton="vigilance">{b.curatifs} pannes</Pastille> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Carte>

            <Carte titre="Par catégorie" precision="Coût total et fourchette du coût au kilomètre">
              <ul className="divide-y divide-bordure">
                {parCategorie.map(([cat, x]) => (
                  <li key={cat} className="flex flex-wrap items-baseline gap-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 text-texte">
                      {cat} <span className="text-attenue">· {x.n}</span>
                    </span>
                    <span className="code font-medium text-texte">{montantCourt(x.total)}</span>
                    <span className="code w-[150px] text-right text-texte-2">{x.min === null ? "—" : x.min === x.max ? `${nombre(x.min)} F/km` : `${nombre(x.min)} – ${nombre(x.max)} F/km`}</span>
                  </li>
                ))}
              </ul>
            </Carte>

            <Carte titre="Par business unit" precision="Ce que chaque activité coûte en véhicules">
              <ul className="flex flex-col gap-2.5">
                {parBu.map(([libelle, v]) => (
                  <li key={libelle} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="truncate text-texte">{libelle}</span>
                      <span className="code shrink-0 font-medium text-texte">
                        {montantCourt(v)} <span className="text-attenue">· {total > 0 ? Math.round((v / total) * 100) : 0} %</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${total > 0 ? Math.max(1, Math.round((v / total) * 100)) : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Carte>
          </div>
        </>
      ) : null}

      {vue === "vehicules" ? (
        <TableListe<BilanVehicule>
          ecran="couts-vehicules"
          lignes={bilans}
          cle={(b) => b.donnees.vehiculeId}
          href={(b) => `/flotte/${b.donnees.immatriculation}`}
          filet={(b) => ({ couleur: VERDICT_COUT[b.verdict].couleur, libelle: VERDICT_COUT[b.verdict].libelle, precision: VERDICT_COUT[b.verdict].precision })}
          identifiant={{ cle: "immat", libelle: "Immat.", largeur: 120, rendu: (b) => <span className="code font-semibold text-accent-fonce">{b.donnees.immatriculationAffichee}</span> }}
          colonnes={colonnes}
          filtres={filtres}
          champsRecherche={(b) => [b.donnees.immatriculationAffichee, b.donnees.libelle, CATEGORIE_VEHICULE[b.donnees.categorie], b.donnees.businessUnit ? BUSINESS_UNIT[b.donnees.businessUnit] : "", b.donnees.site ?? "", VERDICT_COUT[b.verdict].libelle]}
          placeholderRecherche="Immatriculation, modèle, catégorie, BU…"
          libelleRecherche="Rechercher un véhicule"
          libelleUnite="véhicules"
          vide="Aucun véhicule ne correspond."
        />
      ) : null}

      {vue === "postes" ? (
        <Carte titre="Dépenses par poste et par mois" precision={`Périmètre ${PERIMETRE[perimetre].libelle.toLowerCase()} — ${PERIMETRE[perimetre].precision.toLowerCase()}`} sansMarge>
          <div className="sans-barre overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[900px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left">
                  <th className="en-tete-colonne sticky left-0 bg-surface py-2 pr-3">Poste</th>
                  {mois.map((m) => (
                    <th key={m} className="en-tete-colonne py-2 px-2 text-right whitespace-nowrap">
                      {libelleMois(m)}
                    </th>
                  ))}
                  <th className="en-tete-colonne py-2 px-2 text-right">Total</th>
                  <th className="en-tete-colonne py-2 pl-2 text-right">Part</th>
                </tr>
              </thead>
              <tbody>
                {GROUPES.map((g) => {
                  const lignes = postes.filter((p) => p.groupe === g);
                  if (lignes.length === 0) return null;
                  return [
                    <tr key={`${g}-titre`} className="border-t border-bordure bg-surface-2">
                      <td className="sticky left-0 bg-surface-2 py-2 pr-3 font-semibold text-texte">{GROUPE_CHARGE[g]}</td>
                      {mois.map((m) => (
                        <td key={m} className="code py-2 px-2 text-right font-medium text-texte">
                          {montantCourt(lignes.reduce((s, l) => s + (l.parMois[m] ?? 0), 0))}
                        </td>
                      ))}
                      <td className="code py-2 px-2 text-right font-semibold text-texte">{montant(parGroupe[g])}</td>
                      <td className="code py-2 pl-2 text-right text-texte-2">{total > 0 ? `${Math.round((parGroupe[g] / total) * 100)} %` : "—"}</td>
                    </tr>,
                    ...lignes.map((l) => (
                      <tr key={l.poste} className="border-t border-bordure">
                        <td className="sticky left-0 bg-surface py-2 pr-3 pl-4 text-texte-2">{POSTE_DEPENSE[l.poste]}</td>
                        {mois.map((m) => (
                          <td key={m} className={`code py-2 px-2 text-right ${l.parMois[m] ? "text-texte" : "text-attenue-2"}`}>
                            {l.parMois[m] ? montantCourt(l.parMois[m]!) : "·"}
                          </td>
                        ))}
                        <td className="code py-2 px-2 text-right text-texte">{montant(l.total)}</td>
                        <td className="code py-2 pl-2 text-right text-texte-2">{total > 0 ? `${Math.round((l.total / total) * 100)} %` : "—"}</td>
                      </tr>
                    )),
                  ];
                })}
                <tr className="border-t-2 border-bordure-champ">
                  <td className="sticky left-0 bg-surface py-2.5 pr-3 font-semibold text-texte">Total</td>
                  {totaux.map((t) => (
                    <td key={t.mois} className="code py-2.5 px-2 text-right font-semibold text-texte">
                      {montantCourt(t.total)}
                    </td>
                  ))}
                  <td className="code py-2.5 px-2 text-right font-semibold text-texte">{montant(total)}</td>
                  <td className="code py-2.5 pl-2 text-right text-texte-2">100 %</td>
                </tr>
                <tr>
                  <td className="sticky left-0 bg-surface py-2 pr-3 text-texte-2">Kilomètres</td>
                  {totaux.map((t) => (
                    <td key={t.mois} className="code py-2 px-2 text-right text-texte-2">
                      {t.km > 0 ? nombre(t.km) : "·"}
                    </td>
                  ))}
                  <td className="code py-2 px-2 text-right text-texte-2">{nombre(km)}</td>
                  <td className="code py-2 pl-2 text-right text-texte-2">{coutParKm === null ? "—" : `${nombre(coutParKm)} F/km`}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Carte>
      ) : null}

      {vue === "carburant" ? (
        <Carte titre="Consommation mensuelle" precision="Litres aux 100 km, véhicule par mois, contre la référence de sa catégorie — au-delà de 8 % en vigilance, de 15 % en dérive" sansMarge>
          <div className="sans-barre overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[900px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left">
                  <th className="en-tete-colonne sticky left-0 bg-surface py-2 pr-3">Véhicule</th>
                  <th className="en-tete-colonne py-2 px-2 text-right">Réf.</th>
                  {mois.map((m) => (
                    <th key={m} className="en-tete-colonne py-2 px-2 text-right whitespace-nowrap">
                      {libelleMois(m)}
                    </th>
                  ))}
                  <th className="en-tete-colonne py-2 px-2 text-right">Litres</th>
                  <th className="en-tete-colonne py-2 px-2 text-right">Km</th>
                  <th className="en-tete-colonne py-2 px-2 text-right">L/100</th>
                  <th className="en-tete-colonne py-2 pl-2 text-right">Écart</th>
                </tr>
              </thead>
              <tbody>
                {bilans
                  .filter((b) => b.litres > 0)
                  .sort((a, b) => (b.ecartL100Pct ?? -999) - (a.ecartL100Pct ?? -999))
                  .map((b) => (
                    <tr key={b.donnees.vehiculeId} className="border-t border-bordure">
                      <td className="sticky left-0 bg-surface py-2 pr-3">
                        <Link href={`/flotte/${b.donnees.immatriculation}?onglet=carburant`} className="code font-medium text-accent-fonce hover:underline">
                          {b.donnees.immatriculationAffichee}
                        </Link>
                        <span className="ml-2 text-attenue">{CATEGORIE_VEHICULE[b.donnees.categorie]}</span>
                      </td>
                      <td className="code py-2 px-2 text-right text-attenue">{nombre(b.donnees.referenceL100, 1)}</td>
                      {mois.map((m) => {
                        const x = b.donnees.mois.find((y) => y.mois === m);
                        const v = x && x.km > 0 && x.litres > 0 ? Math.round((x.litres / x.km) * 1000) / 10 : null;
                        const ecart = v === null ? null : (v - b.donnees.referenceL100) / b.donnees.referenceL100;
                        return (
                          <td key={m} className={`code py-2 px-2 text-right ${v === null ? "text-attenue-2" : ecart! > 0.15 ? "font-medium text-defavorable" : ecart! > 0.08 ? "text-vigilance" : ecart! < -0.05 ? "text-favorable" : "text-texte"}`} title={x && v !== null ? `${nombre(x.litres)} L · ${nombre(x.km)} km` : undefined}>
                            {v === null ? "·" : nombre(v, 1)}
                          </td>
                        );
                      })}
                      <td className="code py-2 px-2 text-right text-texte">{nombre(b.litres)}</td>
                      <td className="code py-2 px-2 text-right text-texte">{nombre(b.km)}</td>
                      <td className="code py-2 px-2 text-right font-medium text-texte">{b.litresAux100 === null ? "—" : nombre(b.litresAux100, 1)}</td>
                      <td className={`code py-2 pl-2 text-right ${b.ecartL100Pct !== null && b.ecartL100Pct > 15 ? "font-medium text-defavorable" : b.ecartL100Pct !== null && b.ecartL100Pct > 8 ? "text-vigilance" : "text-texte-2"}`}>{signe(b.ecartL100Pct)}</td>
                    </tr>
                  ))}
                <tr className="border-t-2 border-bordure-champ">
                  <td className="sticky left-0 bg-surface py-2.5 pr-3 font-semibold text-texte">Flotte</td>
                  <td className="code py-2.5 px-2 text-right text-attenue">{refPonderee === null ? "—" : nombre(refPonderee, 1)}</td>
                  {totaux.map((t) => (
                    <td key={t.mois} className="code py-2.5 px-2 text-right font-medium text-texte">
                      {t.km > 0 && t.litres > 0 ? nombre(Math.round((t.litres / t.km) * 1000) / 10, 1) : "·"}
                    </td>
                  ))}
                  <td className="code py-2.5 px-2 text-right font-semibold text-texte">{nombre(litres)}</td>
                  <td className="code py-2.5 px-2 text-right font-semibold text-texte">{nombre(km)}</td>
                  <td className="code py-2.5 px-2 text-right font-semibold text-texte">{l100 === null ? "—" : nombre(l100, 1)}</td>
                  <td className={`code py-2.5 pl-2 text-right font-semibold ${ecartL100 !== null && ecartL100 > 8 ? "text-vigilance" : "text-texte"}`}>{signe(ecartL100)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Carte>
      ) : null}
    </div>
  );
}
