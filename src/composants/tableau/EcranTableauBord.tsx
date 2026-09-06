"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { AideSurvol } from "@/composants/interface/AideSurvol";
import { Carte } from "@/composants/interface/Carte";
import { Anneau, BarresContribution, BarresMensuelles, Courbe, type PartAnneau, type PointCourbe } from "./Graphiques";
import {
  AXES,
  basculer,
  cumuler,
  couleurScore,
  evaluerAxes,
  COURBES_DEFAUT,
  INDICATEUR_PAR_ID,
  INDICATEURS,
  INDICATEURS_COURBE,
  limiter,
  MAX_COURBES,
  MAX_PAR_AXE,
  SELECTION_DEFAUT,
  type FaitsFlotteMois,
  type FaitsVehiculeMois,
  type SituationJour,
  type ValeurIndicateur,
  type VehiculeTableau,
} from "@/domaine/tableau-bord";
import { BUSINESS_UNIT, CATEGORIE_FLOTTE } from "@/domaine/libelles";
import { trouverRole } from "@/domaine/roles";
import { lireRole } from "@/lib/session-demo";
import { date as formaterDate, montantCourt, nombre } from "@/lib/format";

/* ============================================================================
 * Tableau de bord SQDCM — l'écran d'entrée, conforme à la maquette « Parc
 * SEDIMA » de la Direction des Opérations.
 *
 * Deux blocs, dans cet ordre : la **performance SQDCM** (bandeau des cinq
 * axes, puis les pastilles des indicateurs choisis, composables par « Choisir
 * les indicateurs ») et les **courbes de douze mois**.
 *
 * Retiré le 4 septembre 2026, à la demande du métier : le bloc « ce qui demande
 * une action » — alertes du jour et répartition des dépenses par business unit.
 * Les premières se lisent sur Conformité, où on les traite ; la seconde dans
 * Rapports, où on la filtre. Le tableau de bord donne le coup d'œil sur les
 * indicateurs, il ne double pas les écrans qui font le travail.
 *
 * Rien ne s'y saisit : chaque pastille porte le lien vers l'écran où sa valeur
 * se vérifie ligne à ligne.
 * ==========================================================================*/

type Periode = "semaine" | "mois" | "annee";
const PERIODES: { cle: Periode; libelle: string }[] = [
  { cle: "semaine", libelle: "Semaine" },
  { cle: "mois", libelle: "Mois en cours" },
  { cle: "annee", libelle: "Année" },
];

const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function libelleMoisLong(mois: string): string {
  const [a, m] = mois.split("-");
  return `${MOIS_LONG[Number(m) - 1]} ${a}`;
}

/** Une pilule de filtre, telle que la maquette la dessine. */
function Filtre({ actif, children, onClick, titre }: { actif?: boolean; children: React.ReactNode; onClick: () => void; titre?: string }) {
  return (
    <button
      type="button"
      title={titre}
      aria-pressed={actif}
      onClick={onClick}
      className={`h-7 rounded-full border px-3 text-[12.5px] whitespace-nowrap transition-colors ${
        actif ? "border-accent bg-accent font-medium text-white" : "border-bordure-champ bg-surface text-texte-2 hover:border-accent hover:text-accent-fonce"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Un menu déroulant de filtre — « BU : toutes », « Site : tous ».
 *
 * Le `select` recouvre **toute** la pilule, transparent : sans cela, seule une
 * bande de vingt pixels ouvrait la liste, et le filtre passait pour cassé alors
 * qu'il fonctionnait. Un chevron dit qu'il y a quelque chose à ouvrir.
 */
function FiltreChoix<T extends string>({ etiquette, valeur, options, onChange }: { etiquette: string; valeur: T | "tous"; options: { cle: T; libelle: string }[]; onChange: (v: T | "tous") => void }) {
  const actif = valeur !== "tous";
  const courant = options.find((o) => o.cle === valeur);
  return (
    <label
      className={`relative inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-3 text-[12.5px] transition-colors ${
        actif ? "border-accent bg-accent-fond text-accent-tres-fonce" : "border-bordure-champ bg-surface text-texte-2 hover:border-accent hover:text-accent-fonce"
      }`}
    >
      <span className="whitespace-nowrap">
        {etiquette} : {actif ? courant?.libelle : "tous"}
      </span>
      <ChevronDown className="size-3 shrink-0 opacity-60" strokeWidth={2.2} />
      <select
        value={valeur}
        onChange={(e) => onChange(e.target.value as T | "tous")}
        aria-label={etiquette}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="tous">Tous</option>
        {options.map((o) => (
          <option key={o.cle} value={o.cle}>
            {o.libelle}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * La cible telle qu'on la lit sur la période retenue. Une cible mensuelle est
 * réécrite quand la période n'est pas le mois : cinq pannes tolérées par mois,
 * ce n'est pas cinq par an.
 */
/** Ce que la pastille écrit sous sa valeur, selon ce qui lui manque. */
function mentionIndicateur(v: ValeurIndicateur): string {
  if (v.etat === "non-alimente") return v.definition.aVenir ?? "source à brancher";
  if (v.etat === "sans-donnee") return "aucune donnée sur la période";
  return cibleLisible(v);
}

function cibleLisible(v: ValeurIndicateur): string {
  const d = v.definition;
  if (!d.parMois || v.cible === null || d.cible === undefined) return d.cibleTexte;
  if (Math.abs(v.cible - d.cible.valeur) < 0.05) return d.cibleTexte;
  const unite = d.unite ? " " + d.unite : "";
  return "Cible " + (d.cible.sens === "inf" ? "≤" : "≥") + " " + nombre(v.cible, v.cible < 10 ? 1 : 0) + unite + " sur la période";
}

/** La valeur d'un indicateur, dans son unité et à ses décimales. */
function valeurAffichee(v: ValeurIndicateur): string {
  if (v.valeur === null) return "—";
  const d = v.definition;
  if (d.unite === "F") return montantCourt(v.valeur).replace(/\s?F$/, "");
  return nombre(v.valeur, d.decimales ?? 0);
}

function AideLecture() {
  return <AideSurvol libelle="Comment lire ce tableau"><b className="text-texte">Comment lire ce tableau.</b> Le bandeau du haut donne le score de chaque axe SQDCM — la part de ses indicateurs affichés qui tiennent leur cible ; un axe grisé est
        un axe dont aucun indicateur n&apos;est affiché, ou dont aucun n&apos;est encore mesurable. Les pastilles portant un code — <span className="code text-[11px]">D_TDPA</span>,{" "}
        <span className="code text-[11px]">C_CDM_SEDI</span>… — sont les six indicateurs du référentiel DO, affichés par défaut parce qu&apos;ils tiennent sur une seule ligne. Les autres, marquées{" "}
        <i>proposé</i>, s&apos;ajoutent depuis « Choisir les indicateurs ». Celles qui disent « source à brancher » attendent leur donnée — télématique, tonnages SediLiv, pont bascule, RH — et ne
        comptent pas dans le score.
      </AideSurvol>;
}

export function EcranTableauBord({
  mois,
  vehicules,
  faits,
  flotte,
  semaine,
  flotteSemaine,
  jour,
  aujourdhui,
}: {
  mois: string[];
  vehicules: VehiculeTableau[];
  faits: FaitsVehiculeMois[];
  flotte: FaitsFlotteMois[];
  semaine: FaitsVehiculeMois[];
  flotteSemaine: FaitsFlotteMois[];
  jour: SituationJour;
  aujourdhui: string;
}) {
  const [periode, setPeriode] = useState<Periode>("mois");
  const [bu, setBu] = useState<string>("tous");
  const [categorie, setCategorie] = useState<string>("tous");
  const [site, setSite] = useState<string>("tous");
  const [picker, setPicker] = useState(false);

  /* La sélection d'indicateurs est un réglage de compte, comme les colonnes des
     listes : elle vit dans le navigateur sous une clé qui porte le rôle. */
  const [selection, setSelection] = useState<string[]>(SELECTION_DEFAUT);
  const [monte, setMonte] = useState(false);
  useEffect(() => {
    setMonte(true);
    try {
      const brut = localStorage.getItem(`sedima.parc.tableau-bord.${trouverRole(lireRole()).role}`);
      /* Une sélection enregistrée avant la règle des trois par axe se relit bornée. */
      if (brut) setSelection(limiter(JSON.parse(brut) as string[]));
      const brutCourbes = localStorage.getItem(`sedima.parc.tableau-bord-courbes.${trouverRole(lireRole()).role}`);
      if (brutCourbes) setCourbes(JSON.parse(brutCourbes) as string[]);
    } catch {
      /* sans stockage, la sélection par défaut suffit */
    }
  }, []);
  function enregistrer(suivante: string[]) {
    setSelection(suivante);
    try {
      localStorage.setItem(`sedima.parc.tableau-bord.${trouverRole(lireRole()).role}`, JSON.stringify(suivante));
    } catch {
      /* sans stockage, rien ne persiste */
    }
  }

  /* Les courbes se choisissent comme les pastilles, et se retiennent de même. */
  const [courbes, setCourbes] = useState<string[]>(COURBES_DEFAUT);
  const [choixCourbes, setChoixCourbes] = useState(false);
  function enregistrerCourbes(suivantes: string[]) {
    setCourbes(suivantes);
    try {
      localStorage.setItem(`sedima.parc.tableau-bord-courbes.${trouverRole(lireRole()).role}`, JSON.stringify(suivantes));
    } catch {
      /* sans stockage, rien ne persiste */
    }
  }

  /* ---- La fenêtre : période et périmètre ---- */
  const moisCourant = mois[mois.length - 1]!;
  const moisRetenus = useMemo(() => {
    if (periode === "annee") return mois.slice(-12);
    return [moisCourant];
  }, [periode, mois, moisCourant]);

  const depuisSemaine = useMemo(() => {
    const d = new Date(`${aujourdhui}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 6);
    return d.toISOString().slice(0, 10);
  }, [aujourdhui]);

  const retenus = useMemo(() => new Set(vehicules.filter((v) => (bu === "tous" || v.businessUnit === bu) && (categorie === "tous" || v.categorieFlotte === categorie) && (site === "tous" || v.site === site)).map((v) => v.id)), [vehicules, bu, categorie, site]);

  /* La semaine a ses propres faits : sept jours glissants ne se découpent pas
     dans des mois. */
  const faitsRetenus = useMemo(
    () => (periode === "semaine" ? semaine.filter((f) => retenus.has(f.vehiculeId)) : faits.filter((f) => retenus.has(f.vehiculeId) && moisRetenus.includes(f.mois))),
    [periode, semaine, faits, retenus, moisRetenus],
  );
  const flotteRetenue = useMemo(() => (periode === "semaine" ? flotteSemaine : flotte.filter((f) => moisRetenus.includes(f.mois))), [periode, flotteSemaine, flotte, moisRetenus]);

  /* La durée nominale de la période : c'est elle qui met les cibles mensuelles
     à l'échelle, pas les jours déjà écoulés. */
  const joursNominaux = useMemo(() => {
    if (periode === "semaine") return 7;
    if (periode === "annee") return 365;
    /* Le mois en cours vaut exactement un mois : une cible mensuelle doit se
       relire telle qu elle est écrite, sans arrondi à 4,9. */
    return 30.44;
  }, [periode, moisCourant]);

  const cumul = useMemo(() => cumuler(faitsRetenus, flotteRetenue, jour, joursNominaux), [faitsRetenus, flotteRetenue, jour, joursNominaux]);
  const axes = useMemo(() => evaluerAxes(cumul, monte ? selection : SELECTION_DEFAUT), [cumul, selection, monte]);

  /* Douze mois glissants, chacun cumulé pour lui-même : c'est la seule façon
     d'obtenir une valeur mensuelle d'un indicateur qui, sinon, se lit sur toute
     la période. Le périmètre (BU, catégorie, site) s'applique aussi à la courbe. */
  /*
   * Les séries, sur **deux périodes**. Le serveur en sert vingt-quatre mois
   * exactement pour cela : une pente ne se juge pas seule, et « −8 % » ne veut
   * rien dire tant qu'on ignore ce que faisait la même période un an plus tôt.
   */
  const series = useMemo(() => {
    const douze = mois.slice(-12);
    const douzeAvant = mois.slice(-24, -12);
    const valeurDuMois = (d: (typeof INDICATEURS_COURBE)[number] | undefined, m: string): number | null => {
      if (!d?.calcul) return null;
      const c = cumuler(
        faits.filter((f) => retenus.has(f.vehiculeId) && f.mois === m),
        flotte.filter((f) => f.mois === m),
        jour,
        30.44,
      );
      return d.calcul(c);
    };
    return new Map<string, PointCourbe[]>(
      (monte ? courbes : COURBES_DEFAUT).map((id) => {
        const d = INDICATEUR_PAR_ID.get(id);
        const points = douze.map((m, i) => {
          const avant = douzeAvant[i] ?? null;
          return { mois: m, valeur: valeurDuMois(d, m), precedent: avant ? valeurDuMois(d, avant) : null, moisPrecedent: avant };
        });
        return [id, points];
      }),
    );
  }, [mois, courbes, monte, faits, flotte, retenus, jour]);

  /*
   * De quoi est fait le coût du transport sur douze mois. Les charges du parc
   * suivent les filtres — elles sont portées par des véhicules ; le transport
   * tiers n'en dépend pas, faute d'être porté par un véhicule du parc. On le
   * retire donc dès qu'un filtre est posé, plutôt que de rapporter une part
   * filtrée à un total qui ne l'est pas.
   */
  const filtreVehicule = bu !== "tous" || categorie !== "tous" || site !== "tous";
  const repartition = useMemo(() => {
    const douze = new Set(mois.slice(-12));
    const duParc = faits.filter((f) => retenus.has(f.vehiculeId) && douze.has(f.mois));
    const maintenance = duParc.reduce((somme, f) => somme + f.coutMaintenance, 0);
    const autres = Math.max(0, duParc.reduce((somme, f) => somme + f.cout, 0) - maintenance);
    const tiers = flotte.filter((f) => douze.has(f.mois));
    const parts: PartAnneau[] = [
      { cle: "maintenance", libelle: "Maintenance du parc", valeur: maintenance, teinte: "var(--color-accent-tres-fonce)", precision: "Préventif et curatif, pièces comprises", href: "/maintenance" },
      { cle: "autres", libelle: "Autres charges du parc", valeur: autres, teinte: "var(--color-accent)", precision: "Carburant, assurances, péages, pneumatiques" },
    ];
    if (!filtreVehicule) {
      parts.push(
        { cle: "affretements", libelle: "Affrètements", valeur: tiers.reduce((s, f) => s + f.coutAffretements, 0), teinte: "var(--color-vigilance)", precision: "Missions au voyage confiées à des tiers", href: "/transporteurs?vue=affretements" },
        { cle: "mad", libelle: "Mises à disposition", valeur: tiers.reduce((s, f) => s + f.coutMisesADisposition, 0), teinte: "var(--color-defavorable)", precision: "ADEX, à la journée — carburant compris", href: "/transporteurs?vue=mad" },
        { cle: "prestations", libelle: "Prestations hors grille", valeur: tiers.reduce((s, f) => s + f.coutPrestations, 0), teinte: "var(--color-encre)", precision: "Œufs, farine, transport du personnel", href: "/transporteurs?vue=prestations" },
      );
    }
    const retenues = parts.filter((x) => x.valeur > 0);
    return { parts: retenues, total: retenues.reduce((s, x) => s + x.valeur, 0) };
  }, [mois, faits, flotte, retenus, filtreVehicule]);

  /* Qui fait le coût du parc : un total ne se corrige pas, des véhicules si. */
  const contributions = useMemo(() => {
    const douze = new Set(mois.slice(-12));
    const parVehicule = new Map<string, number>();
    for (const f of faits) {
      if (!retenus.has(f.vehiculeId) || !douze.has(f.mois)) continue;
      parVehicule.set(f.vehiculeId, (parVehicule.get(f.vehiculeId) ?? 0) + f.cout);
    }
    const total = [...parVehicule.values()].reduce((s, v) => s + v, 0);
    const classees = [...parVehicule.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, valeur]) => {
        const v = vehicules.find((x) => x.id === id);
        return {
          cle: id,
          libelle: v?.immatriculationAffichee ?? id,
          precision: v ? `${v.libelle}${v.site ? ` · ${v.site}` : ""}` : undefined,
          valeur,
          href: v ? `/flotte/${v.immatriculationAffichee.replace(/\s+/g, "-")}` : undefined,
        };
      });
    return { lignes: classees, total, univers: parVehicule.size };
  }, [mois, faits, retenus, vehicules]);

  const affiches = axes.reduce((s, a) => s + a.indicateurs.length, 0);
  const nonAlimentes = axes.reduce((s, a) => s + a.nonAlimentes, 0);

  const sites = useMemo(() => [...new Set(vehicules.map((v) => v.site).filter((s): s is string => s !== null))].sort(), [vehicules]);
  const bus = useMemo(() => [...new Set(vehicules.map((v) => v.businessUnit).filter((b): b is NonNullable<typeof b> => b !== null))], [vehicules]);
  const categories = useMemo(() => [...new Set(vehicules.map((v) => v.categorieFlotte))], [vehicules]);


  const libellePeriode = periode === "semaine" ? "7 derniers jours" : periode === "mois" ? libelleMoisLong(moisCourant) : "12 derniers mois";

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran titre="Tableau de bord" sousTitre={`Vue équipe parc · ${libellePeriode} · au ${formaterDate(aujourdhui)}`} />

      {/* ---- Filtres ---- */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {PERIODES.map((p) => (
          <Filtre key={p.cle} actif={periode === p.cle} onClick={() => setPeriode(p.cle)} titre={p.cle === "semaine" ? `Depuis le ${formaterDate(depuisSemaine)}` : undefined}>
            {p.libelle}
          </Filtre>
        ))}
        <span className="mx-1 h-5 w-px bg-bordure" aria-hidden="true" />
        <FiltreChoix etiquette="BU" valeur={bu} options={bus.map((b) => ({ cle: b as string, libelle: BUSINESS_UNIT[b] }))} onChange={setBu} />
        <FiltreChoix etiquette="Catégorie de flotte" valeur={categorie} options={categories.map((c) => ({ cle: c as string, libelle: CATEGORIE_FLOTTE[c] }))} onChange={setCategorie} />
        <FiltreChoix etiquette="Site" valeur={site} options={sites.map((s) => ({ cle: s, libelle: s }))} onChange={setSite} />
        <span className="meta ml-auto">
          {cumul.vehicules} véhicule{cumul.vehicules > 1 ? "s" : ""} · {cumul.engages} engagé{cumul.engages > 1 ? "s" : ""}
        </span>
      </div>

      {/* ---- Performance SQDCM ---- */}
      <div className="flex shrink-0 flex-wrap items-baseline gap-3">
        <h2 className="titre-bloc">Performance SQDCM</h2>
        <AideLecture />
        <span className="meta">
          {affiches} affiché{affiches > 1 ? "s" : ""} sur {INDICATEURS.length} disponibles · {MAX_PAR_AXE} par axe au plus
          {nonAlimentes > 0 ? ` · ${nonAlimentes} en attente de source` : ""}
        </span>
        <button type="button" onClick={() => setPicker((o) => !o)} aria-expanded={picker} className={`bouton-secondaire ml-auto ${picker ? "border-accent text-accent-fonce" : ""}`}>
          <SlidersHorizontal className="size-4" strokeWidth={1.8} />
          Choisir les indicateurs
        </button>
      </div>

      {picker ? (
        <div className="carte shrink-0 px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="titre-bloc">Indicateurs disponibles</h3>
            <span className="meta">Cochez ceux qui doivent apparaître sur le tableau de bord. Votre sélection est mémorisée.</span>
            <span className="ml-auto flex gap-2.5">
              <button type="button" onClick={() => enregistrer([...SELECTION_DEFAUT])} className="bouton-secondaire">
                Sélection par défaut
              </button>
              <button type="button" onClick={() => setPicker(false)} className="bouton-principal">
                Terminé
              </button>
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-5">
            {AXES.map((axe) => {
              const retenus = selection.filter((id) => INDICATEUR_PAR_ID.get(id)?.axe === axe.cle).length;
              const plein = retenus >= MAX_PAR_AXE;
              return (
              <div key={axe.cle}>
                <h4 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-texte">
                  <span className="grid size-[18px] place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: axe.teinte }}>
                    {axe.cle}
                  </span>
                  {axe.nom}
                  <span className={`code ml-auto text-[10.5px] ${plein ? "text-accent-fonce" : "text-attenue"}`}>
                    {retenus}/{MAX_PAR_AXE}
                  </span>
                </h4>
                <ul className="flex flex-col gap-1">
                  {INDICATEURS.filter((d) => d.axe === axe.cle).map((d) => {
                    const coche = selection.includes(d.id);
                    /* L'axe est plein : le reste devient inactif. Cocher
                       remplaçait silencieusement le premier retenu, et l'on
                       perdait un indicateur sans avoir demandé à le perdre. */
                    const bloque = plein && !coche;
                    return (
                      <li key={d.id}>
                        <label
                          title={bloque ? `${axe.nom} en montre déjà ${MAX_PAR_AXE} : décochez-en un pour libérer une place.` : undefined}
                          className={`flex items-start gap-2 rounded-[8px] px-1.5 py-1 text-[12.5px] leading-snug ${
                            bloque ? "cursor-not-allowed text-attenue-2" : "cursor-pointer text-texte-2 hover:bg-surface-2"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={coche}
                            disabled={bloque}
                            onChange={() => enregistrer(basculer(selection, d.id))}
                            className="mt-0.5 size-3.5 shrink-0 accent-accent disabled:cursor-not-allowed"
                          />
                          <span className="min-w-0">
                            {d.libelle}
                            {d.code ? <span className={`code ml-1.5 text-[10px] font-semibold ${bloque ? "text-attenue-2" : "text-accent-fonce"}`}>{d.code}</span> : null}
                            {d.aVenir ? <span className="meta block">source à brancher</span> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ---- Le bandeau des cinq axes ---- */}
{/* Une grille de colonnes égales plutôt qu'une rangée souple : les cinq noms
          d'axe n'ont pas la même longueur, et sans cela le score et la jauge de
          chacun tombent à un endroit différent. */}
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {axes.map((a) => (
          <div key={a.axe.cle} className={`carte flex items-center gap-2.5 px-3.5 py-2 ${a.score === null ? "opacity-45" : ""}`} title={`${a.axe.nom} — ${a.axe.sous}`}>
            <span className="grid size-[19px] shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: a.axe.teinte }}>
              {a.axe.cle}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-texte">{a.axe.nom}</span>
            <span className="code shrink-0 text-[11.5px] text-texte-2">{a.score === null ? "—" : `${a.score}/100`}</span>
            <span className="block h-1 w-11 shrink-0 overflow-hidden rounded-full bg-surface-3">
              <span className="block h-full rounded-full" style={{ width: `${a.score ?? 0}%`, background: couleurScore(a.score) }} />
            </span>
          </div>
        ))}
      </div>

      {/* ---- Les indicateurs, en colonne sous leur axe ---- */}
      {affiches === 0 ? (
        <div className="carte shrink-0 px-5 py-8 text-center">
          <p className="meta">Aucun indicateur sélectionné. Ouvrez « Choisir les indicateurs » pour composer votre tableau de bord.</p>
        </div>
      ) : (
        /* Les mêmes colonnes que le bandeau, aux mêmes ruptures : les indicateurs
           d'un axe tombent sous la puce de cet axe, et non à la suite les uns des
           autres. C'est ce qui rend la lecture possible d'un coup d'œil. */
        <div className="carte shrink-0 grid grid-cols-2 divide-x divide-bordure overflow-hidden sm:grid-cols-3 xl:grid-cols-5">
          {axes.map((a) => (
            /* Les pastilles gardent toutes la même taille : une colonne courte ne
               les étire pas pour rattraper la plus longue. */
            /* La couleur de l'axe se porte **une fois**, en filet de tête de
               colonne : la répéter sur chaque indicateur redisait ce que la
               colonne dit déjà, et mangeait la place du chiffre. */
            <div key={a.axe.cle} className="flex min-w-0 flex-col content-start divide-y divide-bordure border-t-2" style={{ borderTopColor: a.axe.teinte }}>
              {a.indicateurs.length === 0 ? (
                <span className="meta px-4 py-3">Aucun indicateur affiché</span>
              ) : (
                a.indicateurs.map((v) => {
                  const couleur = v.etat === "ko" ? "var(--color-defavorable)" : v.etat === "ok" ? "var(--color-favorable)" : "var(--color-attenue-2)";
                  return (
                    <Link key={v.definition.id} href={v.definition.href} className="flex h-[104px] flex-col gap-0.5 px-3.5 py-2.5 transition-colors hover:bg-surface-2">
                      <span className="flex min-h-[13px] items-center gap-1.5">
                        {v.definition.code ? (
                          <span className="code rounded-[3px] bg-accent-fond px-1 py-px text-[9px] font-semibold tracking-wide text-accent-tres-fonce">{v.definition.code}</span>
                        ) : (
                          <span className="code text-[9px] tracking-wide text-attenue-2">proposé</span>
                        )}
                        <span className="ml-auto size-[6px] shrink-0 rounded-full" style={{ background: couleur }} />
                      </span>
                      <span className="text-[20px] leading-none font-bold tracking-[-0.03em] tabular-nums" style={{ color: v.etat === "ko" ? "var(--color-defavorable)" : undefined }}>
                        {valeurAffichee(v)}
                        {v.definition.unite ? <small className="ml-0.5 text-[10.5px] font-semibold text-attenue">{v.definition.unite}</small> : null}
                      </span>
                      {/* Deux lignes réservées au libellé, et la cible poussée en bas :
                          sans quoi « Contraventions » et « Écarts de pesée hors tolérance »
                          ne posent ni leur libellé ni leur cible à la même hauteur. */}
                      <span className="line-clamp-2 min-h-[2.6em] text-[12px] leading-snug font-medium text-texte">{v.definition.libelle}</span>
                      {/* « Source à brancher » n'est vrai que d'un indicateur sans
                          source. Quand la source existe mais que la période ne
                          porte rien, on le dit autrement — sinon on accuse un
                          module livré de ne pas l'être. */}
                      <span className="meta mt-auto line-clamp-1 text-[10.5px] leading-snug" title={mentionIndicateur(v)}>
                        {mentionIndicateur(v)}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---- Les courbes, sous les pastilles ---- */}
      <div className="flex shrink-0 flex-wrap items-baseline gap-3">
        <h2 className="titre-bloc">Évolution sur douze mois</h2>
        <span className="meta">
          {(monte ? courbes : COURBES_DEFAUT).length} courbe{(monte ? courbes : COURBES_DEFAUT).length > 1 ? "s" : ""} sur {INDICATEURS_COURBE.length} dimensions suivables · {MAX_COURBES} au plus
        </span>
        <button type="button" onClick={() => setChoixCourbes((o) => !o)} aria-expanded={choixCourbes} className={`bouton-secondaire ml-auto ${choixCourbes ? "border-accent text-accent-fonce" : ""}`}>
          <SlidersHorizontal className="size-4" strokeWidth={1.8} />
          Choisir les courbes
        </button>
      </div>

      {choixCourbes ? (
        <div className="carte shrink-0 px-5 py-4">
          <p className="meta mb-3">
            Chaque dimension garde son échelle : une consommation et un coût au kilomètre ne se superposent pas. Les indicateurs qui lisent la situation du jour — solde de caisse, véhicules prêts — ne
            font pas de courbe.
          </p>
          {/*
            Rangé par axe SQDCM, comme le choix des indicateurs : dix-sept
            dimensions en vrac obligeaient à lire chaque libellé pour retrouver
            de quoi on parlait. Les cinq colonnes rendent visible, en outre, ce
            qu'on ne suit pas — un axe sans aucune courbe se voit d'un regard.
          */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-5">
            {AXES.map((axe) => {
              const dimensions = INDICATEURS_COURBE.filter((d) => d.axe === axe.cle);
              if (dimensions.length === 0) return null;
              const suivies = dimensions.filter((d) => courbes.includes(d.id)).length;
              return (
                <div key={axe.cle}>
                  <h4 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-texte">
                    <span className="grid size-[18px] place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: axe.teinte }}>
                      {axe.cle}
                    </span>
                    {axe.nom}
                    <span className={`code ml-auto text-[10.5px] ${suivies > 0 ? "text-accent-fonce" : "text-attenue"}`}>
                      {suivies}/{dimensions.length}
                    </span>
                  </h4>
                  <ul className="flex flex-col gap-1">
                    {dimensions.map((d) => {
                      const choisi = courbes.includes(d.id);
                      const plein = courbes.length >= MAX_COURBES && !choisi;
                      return (
                        <li key={d.id}>
                          <label
                            title={plein ? `${MAX_COURBES} courbes au plus : décochez-en une pour libérer une place.` : d.libelle}
                            className={`flex items-start gap-2 rounded-[8px] px-1.5 py-1 text-[12.5px] leading-snug ${
                              plein ? "cursor-not-allowed text-attenue-2" : "cursor-pointer text-texte-2 hover:bg-surface-2"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={choisi}
                              disabled={plein}
                              onChange={() => enregistrerCourbes(choisi ? courbes.filter((x) => x !== d.id) : [...courbes, d.id])}
                              className="mt-0.5 size-3.5 shrink-0 accent-accent disabled:cursor-not-allowed"
                            />
                            <span className="min-w-0">
                              {d.libelle}
                              {d.code ? <span className={`code ml-1.5 text-[10px] font-semibold ${plein ? "text-attenue-2" : "text-accent-fonce"}`}>{d.code}</span> : null}
                              {d.forme === "barres" ? <span className="meta block">en barres — un flux, pas un état</span> : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {(monte ? courbes : COURBES_DEFAUT).length === 0 ? (
        <div className="carte shrink-0 px-5 py-8 text-center">
          <p className="meta">Aucune courbe choisie. Ouvrez « Choisir les courbes » pour suivre une dimension dans le temps.</p>
        </div>
      ) : (
        <div className="grid shrink-0 grid-cols-1 gap-5 xl:grid-cols-2">
          {(monte ? courbes : COURBES_DEFAUT).map((id) => {
            const d = INDICATEUR_PAR_ID.get(id);
            const points = series.get(id) ?? [];
            if (!d) return null;
            const axe = AXES.find((a) => a.cle === d.axe)!;
            const connus = points.filter((x) => x.valeur !== null).map((x) => x.valeur!);
            const dernier = connus.at(-1) ?? null;
            /*
             * L'écart se mesure **à la période précédente**, non d'un bout à
             * l'autre de la courbe : comparer septembre à l'octobre d'il y a un
             * an mélangeait la tendance et la saison. Ici, les douze derniers
             * mois contre les douze d'avant, sur les mois où les deux existent.
             */
            const apparies = points.filter((x) => x.valeur !== null && x.precedent !== null);
            const sommeCourante = apparies.reduce((s, x) => s + x.valeur!, 0);
            const sommeAvant = apparies.reduce((s, x) => s + x.precedent!, 0);
            const variation = apparies.length > 0 && sommeAvant !== 0 ? Math.round(((sommeCourante - sommeAvant) / Math.abs(sommeAvant)) * 100) : null;
            const mieux = variation === null || !d.cible ? null : d.cible.sens === "inf" ? variation < 0 : variation > 0;
            return (
              <Carte
                key={id}
                titre={d.libelle}
                precision={`${axe.nom}${d.code ? ` · ${d.code}` : ""} · douze derniers mois`}
                action={
                  <span className="flex items-baseline gap-2">
                    <span className="code text-[17px] font-bold tabular-nums" style={{ color: axe.teinte }}>
                      {dernier === null ? "—" : nombre(dernier, Math.abs(dernier) >= 1000 ? 0 : (d.decimales ?? 0))}
                      {d.unite ? <small className="ml-0.5 text-[10.5px] font-semibold text-attenue">{d.unite}</small> : null}
                    </span>
                    {variation !== null && variation !== 0 ? (
                      <span
                        title="Écart entre les douze derniers mois et les douze précédents"
                        className={`code text-[11.5px] font-medium ${mieux === true ? "text-favorable" : mieux === false ? "text-defavorable" : "text-texte-2"}`}
                      >
                        {variation > 0 ? "+" : ""}
                        {variation} %
                      </span>
                    ) : null}
                  </span>
                }
              >
                {/* Un flux se pose en barres, un état se relie en courbe :
                    la forme est déclarée avec l'indicateur, pas devinée ici. */}
                {d.forme === "barres" ? (
                  <BarresMensuelles points={points} cible={d.cible?.valeur ?? null} sens={d.cible?.sens ?? null} teinte={axe.teinte} unite={d.unite} decimales={d.decimales ?? 0} />
                ) : (
                  <Courbe points={points} cible={d.cible?.valeur ?? null} sens={d.cible?.sens ?? null} teinte={axe.teinte} unite={d.unite} decimales={d.decimales ?? 0} />
                )}
              </Carte>
            );
          })}
        </div>
      )}

      {/*
        Deux figures qui ne répondent pas à la même question que les courbes.
        La courbe dit si ça monte ; l'anneau dit **où va l'argent**, et les
        barres disent **qui le dépense**. Sans elles, un coût de parc reste un
        total sur lequel on ne sait pas agir.
      */}
      <div className="grid shrink-0 grid-cols-1 gap-5 xl:grid-cols-2">
        <Carte
          titre="Où passe l'argent du transport"
          precision={
            filtreVehicule
              ? "Douze mois · charges du parc filtré — le transport tiers n'est pas porté par un véhicule, il sort de la répartition"
              : "Douze mois · charges du parc et transport confié à des tiers, tout compris"
          }
        >
          <Anneau parts={repartition.parts} total={repartition.total} libelleTotal="sur douze mois" formater={(v) => montantCourt(v)} />
        </Carte>

        <Carte titre="Les véhicules qui pèsent le plus" precision="Coût complet sur douze mois — un total ne se corrige pas, des véhicules si">
          <BarresContribution
            lignes={contributions.lignes}
            total={contributions.total}
            formater={(v) => montantCourt(v)}
            teinte="var(--color-accent)"
            universLibelle="véhicules"
            universTotal={contributions.univers}
          />
        </Carte>
      </div>
    </div>
  );
}
