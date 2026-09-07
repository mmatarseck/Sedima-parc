"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { Anneau, BarresContribution, BarresMensuelles, Courbe, libelleMoisCourt, type PartAnneau, type PointCourbe } from "./Graphiques";
import {
  AXES,
  COURBES_DEFAUT,
  cumuler,
  evaluerIndicateur,
  INDICATEUR_PAR_ID,
  INDICATEURS,
  INDICATEURS_COURBE,
  limiterPastilles,
  MAX_COURBES,
  MAX_PASTILLES,
  PASTILLES_DEFAUT,
  type Cumul,
  type DefinitionIndicateur,
  type FaitsFlotteMois,
  type FaitsVehiculeMois,
  type SituationJour,
  type ValeurIndicateur,
  type VehiculeTableau,
} from "@/domaine/tableau-bord";
import { BUSINESS_UNIT, CATEGORIE_FLOTTE } from "@/domaine/libelles";
import { trouverRole } from "@/domaine/roles";
import type { Alerte } from "@/donnees/tableau-bord-demo";
import { lireRole } from "@/lib/session-demo";
import { date as formaterDate, montantCourt, nombre } from "@/lib/format";

/* ============================================================================
 * Tableau de bord SQDCM — refondu le 7 septembre 2026 sur la maquette validée
 * par le métier.
 *
 * Une seule vue, sans défilement sur un écran de travail. Trois rangées :
 *
 *   1. **cinq pastilles au plus**, choisies par le compte, chacune complète :
 *      valeur sur la période, écart à la période précédente, cible, et la
 *      courbe des douze mois en pied ;
 *   2. **les courbes**, quatre au plus, chacune sur sa propre échelle, avec la
 *      période précédente en pointillé et la cible ;
 *   3. **ce qui appelle une action** aujourd'hui, où va l'argent, et qui le
 *      dépense.
 *
 * Les filtres — période, BU, catégorie, site — s'appliquent à toute la page.
 * Les couleurs restent celles de l'application ; **le rouge n'apparaît que
 * là où il faut agir** : une cible manquée, une échéance échue. Le cadre
 * SQDCM demeure : chaque pastille porte la lettre de son axe, et les choix se
 * font par axe.
 *
 * Rien ne s'y saisit : chaque pastille mène à l'écran où sa valeur se vérifie.
 * ==========================================================================*/

type Periode = "semaine" | "mois" | "annee";
const PERIODES: { cle: Periode; libelle: string; vs: string }[] = [
  { cle: "semaine", libelle: "Semaine", vs: "vs semaine précédente" },
  { cle: "mois", libelle: "Mois en cours", vs: "vs mois précédent" },
  { cle: "annee", libelle: "Année", vs: "vs même période l'an passé" },
];

const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function libelleMoisLong(mois: string): string {
  const [a, m] = mois.split("-");
  return `${MOIS_LONG[Number(m) - 1]} ${a}`;
}

/** Le segment de période : une seule pilule, trois positions. */
function Segments({ valeur, onChange }: { valeur: Periode; onChange: (p: Periode) => void }) {
  return (
    <div role="group" aria-label="Période" className="inline-flex rounded-full bg-surface-3 p-[3px]">
      {PERIODES.map((p) => (
        <button
          key={p.cle}
          type="button"
          aria-pressed={valeur === p.cle}
          onClick={() => onChange(p.cle)}
          className={`h-7 rounded-full px-3 text-[12.5px] whitespace-nowrap transition-colors ${valeur === p.cle ? "bg-surface font-semibold text-texte shadow-flottante" : "font-medium text-texte-2 hover:text-texte"}`}
        >
          {p.libelle}
        </button>
      ))}
    </div>
  );
}

/** Un menu déroulant de filtre — le `select` recouvre toute la pilule. */
function FiltreChoix<T extends string>({ etiquette, valeur, options, onChange }: { etiquette: string; valeur: T | "tous"; options: { cle: T; libelle: string }[]; onChange: (v: T | "tous") => void }) {
  const actif = valeur !== "tous";
  const courant = options.find((o) => o.cle === valeur);
  return (
    <label
      className={`relative inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-3 text-[12.5px] transition-colors ${
        actif ? "border-accent bg-accent-fond text-accent-tres-fonce" : "border-bordure bg-surface text-texte-2 hover:border-accent hover:text-accent-fonce"
      }`}
    >
      <span className="whitespace-nowrap">
        {etiquette} <b className="font-semibold">{actif ? courant?.libelle : etiquette === "BU" ? "toutes" : etiquette === "Site" ? "tous" : "toutes"}</b>
      </span>
      <ChevronDown className="size-3 shrink-0 opacity-60" strokeWidth={2.2} />
      <select value={valeur} onChange={(e) => onChange(e.target.value as T | "tous")} aria-label={etiquette} className="absolute inset-0 cursor-pointer opacity-0">
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

/** La cible telle qu'on la lit sur la période retenue. */
function cibleLisible(v: ValeurIndicateur): string {
  const d = v.definition;
  if (v.etat === "non-alimente") return d.aVenir ?? "source à brancher";
  if (v.etat === "sans-donnee") return "aucune donnée sur la période";
  if (!d.parMois || v.cible === null || d.cible === undefined) return d.cibleTexte;
  if (Math.abs(v.cible - d.cible.valeur) < 0.05) return d.cibleTexte;
  const unite = d.unite ? " " + d.unite : "";
  return "Cible " + (d.cible.sens === "inf" ? "≤" : "≥") + " " + nombre(v.cible, v.cible < 10 ? 1 : 0) + unite + " sur la période";
}

/** La valeur d'un indicateur, dans son unité et à ses décimales. */
function valeurAffichee(d: DefinitionIndicateur, valeur: number | null): string {
  if (valeur === null) return "—";
  if (d.unite === "F") return montantCourt(valeur).replace(/\s?F$/, "");
  return nombre(valeur, d.decimales ?? 0);
}

/** La lettre de l'axe, en puce neutre : la couleur est réservée à l'alerte. */
function PuceAxe({ axe, petite }: { axe: string; petite?: boolean }) {
  const nom = AXES.find((a) => a.cle === axe)?.nom ?? axe;
  return (
    <span title={nom} className={`grid shrink-0 place-items-center rounded-[6px] bg-surface-3 font-bold text-texte-2 ${petite ? "size-4 text-[9.5px]" : "size-5 text-[11px]"}`}>
      {axe}
    </span>
  );
}

/**
 * La courbe de pied de pastille : douze mois, la cible en pointillé, le
 * dernier point marqué. Rouge seulement quand la dernière valeur manque la
 * cible ; gris sinon.
 */
function Etincelle({ valeurs, cible, horsCible }: { valeurs: (number | null)[]; cible: number | null; horsCible: boolean }) {
  const connus = valeurs.filter((v): v is number => v !== null);
  if (connus.length < 2) return <div className="h-10" />;
  const bornes = [...connus, ...(cible !== null ? [cible] : [])];
  const min = Math.min(...bornes);
  const max = Math.max(...bornes);
  const W = 200;
  const H = 40;
  const x = (i: number) => 4 + (i * (W - 8)) / (valeurs.length - 1);
  const y = (v: number) => H - 4 - ((v - min) / (max - min || 1)) * (H - 8);
  let trace = "";
  let dernierIndex = 0;
  valeurs.forEach((v, i) => {
    if (v === null) return;
    trace += `${trace ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    dernierIndex = i;
  });
  const teinte = horsCible ? "var(--color-defavorable)" : "var(--color-attenue)";
  const fond = horsCible ? "var(--color-defavorable-fond)" : "var(--color-surface-3)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-10 w-full overflow-visible" aria-hidden="true">
      {cible !== null ? <line x1="4" x2={W - 4} y1={y(cible).toFixed(1)} y2={y(cible).toFixed(1)} stroke="var(--color-attenue-2)" strokeDasharray="3 3" /> : null}
      <path d={`${trace}L${x(dernierIndex).toFixed(1)},${H - 4} L4,${H - 4} Z`} fill={fond} />
      <path d={trace} fill="none" stroke={teinte} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(dernierIndex).toFixed(1)} cy={y(valeurs[dernierIndex]!).toFixed(1)} r="3.2" fill={teinte} stroke="var(--color-surface)" strokeWidth="1.5" />
    </svg>
  );
}

export function EcranTableauBord({
  mois,
  vehicules,
  faits,
  flotte,
  semaine,
  flotteSemaine,
  jour,
  alertes,
  aujourdhui,
}: {
  mois: string[];
  vehicules: VehiculeTableau[];
  faits: FaitsVehiculeMois[];
  flotte: FaitsFlotteMois[];
  semaine: FaitsVehiculeMois[];
  flotteSemaine: FaitsFlotteMois[];
  jour: SituationJour;
  alertes: Alerte[];
  aujourdhui: string;
}) {
  const [periode, setPeriode] = useState<Periode>("mois");
  const [bu, setBu] = useState<string>("tous");
  const [categorie, setCategorie] = useState<string>("tous");
  const [site, setSite] = useState<string>("tous");
  const [panneau, setPanneau] = useState<"pastilles" | "courbes" | null>(null);
  /* Un clic sur une courbe l'ouvre en grand, avec le détail mois par mois. */
  const [zoom, setZoom] = useState<string | null>(null);

  /* Les choix sont un réglage de compte, comme les colonnes des listes : ils
     vivent dans le navigateur sous une clé qui porte le rôle. */
  const [selection, setSelection] = useState<string[]>(PASTILLES_DEFAUT);
  const [courbes, setCourbes] = useState<string[]>(COURBES_DEFAUT);
  const [monte, setMonte] = useState(false);
  useEffect(() => {
    setMonte(true);
    try {
      const role = trouverRole(lireRole()).role;
      const brut = localStorage.getItem(`sedima.parc.tableau-bord.pastilles.${role}`);
      if (brut) setSelection(limiterPastilles(JSON.parse(brut) as string[]));
      const brutCourbes = localStorage.getItem(`sedima.parc.tableau-bord-courbes.${role}`);
      if (brutCourbes) setCourbes((JSON.parse(brutCourbes) as string[]).slice(0, MAX_COURBES));
    } catch {
      /* sans stockage, les défauts suffisent */
    }
  }, []);
  function enregistrer(suivante: string[]) {
    setSelection(suivante);
    try {
      localStorage.setItem(`sedima.parc.tableau-bord.pastilles.${trouverRole(lireRole()).role}`, JSON.stringify(suivante));
    } catch {
      /* sans stockage, rien ne persiste */
    }
  }
  function enregistrerCourbes(suivantes: string[]) {
    setCourbes(suivantes);
    try {
      localStorage.setItem(`sedima.parc.tableau-bord-courbes.${trouverRole(lireRole()).role}`, JSON.stringify(suivantes));
    } catch {
      /* sans stockage, rien ne persiste */
    }
  }
  useEffect(() => {
    if (!panneau && !zoom) return;
    const surEchap = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPanneau(null);
      setZoom(null);
    };
    document.addEventListener("keydown", surEchap);
    return () => document.removeEventListener("keydown", surEchap);
  }, [panneau, zoom]);

  /* ---- La fenêtre : période et périmètre, appliqués à toute la page ---- */
  const moisCourant = mois[mois.length - 1]!;
  /* L'année se lit **en année civile**, de janvier à décembre (demande du
     métier, 7 septembre 2026) — pas en douze mois glissants. L'exercice
     courant va de janvier au mois en cours ; l'année précédente lui sert de
     comparaison, mois pour mois. Les mois à venir restent vides sur les
     courbes : ils font partie de l'année, ils ne sont pas encore écrits. */
  const exercice = moisCourant.slice(0, 4);
  const moisServis = useMemo(() => new Set(mois), [mois]);
  const moisCalendrier = useMemo(() => Array.from({ length: 12 }, (_, i) => `${exercice}-${String(i + 1).padStart(2, "0")}`), [exercice]);
  const moisPrecedents = useMemo(() => moisCalendrier.map((m) => `${Number(exercice) - 1}${m.slice(4)}`), [moisCalendrier, exercice]);
  const moisExercice = useMemo(() => moisCalendrier.filter((m) => m <= moisCourant), [moisCalendrier, moisCourant]);
  const retenus = useMemo(
    () => new Set(vehicules.filter((v) => (bu === "tous" || v.businessUnit === bu) && (categorie === "tous" || v.categorieFlotte === categorie) && (site === "tous" || v.site === site)).map((v) => v.id)),
    [vehicules, bu, categorie, site],
  );
  const filtreVehicule = bu !== "tous" || categorie !== "tous" || site !== "tous";

  /* La durée nominale de la période met les cibles mensuelles à l'échelle. */
  const joursNominaux = periode === "semaine" ? 7 : periode === "annee" ? 365 : 30.44;

  const cumulDe = useMemo(
    () =>
      (fenetre: string[]): Cumul =>
        cumuler(
          faits.filter((f) => retenus.has(f.vehiculeId) && fenetre.includes(f.mois)),
          flotte.filter((f) => fenetre.includes(f.mois)),
          jour,
          fenetre.length > 1 ? 365 : 30.44,
        ),
    [faits, flotte, retenus, jour],
  );

  /* La période courante, et la précédente pour l'écart. La semaine a ses
     propres faits — sept jours glissants ne se découpent pas dans des mois —
     et pas de semaine d'avant : son écart reste muet. */
  const cumul = useMemo(() => {
    if (periode === "semaine") return cumuler(semaine.filter((f) => retenus.has(f.vehiculeId)), flotteSemaine, jour, joursNominaux);
    return cumulDe(periode === "annee" ? moisExercice : [moisCourant]);
  }, [periode, semaine, flotteSemaine, retenus, jour, joursNominaux, cumulDe, moisExercice, moisCourant]);
  const cumulPrecedent = useMemo(() => {
    if (periode === "semaine") return null;
    /* L'année se compare à la même période de l'année précédente — janvier
       au mois en cours —, pas à douze mois pleins. */
    const fenetre = periode === "annee" ? moisPrecedents.slice(0, moisExercice.length).filter((m) => moisServis.has(m)) : mois.slice(-2, -1);
    return fenetre.length ? cumulDe(fenetre) : null;
  }, [periode, cumulDe, mois, moisPrecedents, moisExercice, moisServis]);

  /* Chaque mois cumulé pour lui-même : la seule façon d'obtenir une valeur
     mensuelle d'un indicateur qui, sinon, se lit sur toute la période. */
  const valeurDuMois = useMemo(() => {
    const cache = new Map<string, Cumul>();
    return (d: DefinitionIndicateur, m: string): number | null => {
      if (!d.calcul || d.aVenir) return null;
      let c = cache.get(m);
      if (!c) {
        c = cumulDe([m]);
        cache.set(m, c);
      }
      return d.calcul(c);
    };
  }, [cumulDe]);

  const pastilles = useMemo(
    () =>
      (monte ? selection : PASTILLES_DEFAUT).map((id) => {
        const d = INDICATEUR_PAR_ID.get(id)!;
        const v = evaluerIndicateur(d, cumul);
        const precedent = cumulPrecedent ? evaluerIndicateur(d, cumulPrecedent).valeur : null;
        const douze = moisCalendrier.map((m) => (moisServis.has(m) ? valeurDuMois(d, m) : null));
        return { d, v, precedent, douze };
      }),
    [monte, selection, cumul, cumulPrecedent, moisCalendrier, moisServis, valeurDuMois],
  );

  const series = useMemo(
    () =>
      new Map<string, PointCourbe[]>(
        (monte ? courbes : COURBES_DEFAUT).map((id) => {
          const d = INDICATEUR_PAR_ID.get(id)!;
          return [
            id,
            moisCalendrier.map((m, i) => ({
              mois: m,
              valeur: moisServis.has(m) ? valeurDuMois(d, m) : null,
              precedent: moisServis.has(moisPrecedents[i]!) ? valeurDuMois(d, moisPrecedents[i]!) : null,
              moisPrecedent: moisPrecedents[i] ?? null,
            })),
          ];
        }),
      ),
    [moisCalendrier, moisPrecedents, moisServis, courbes, monte, valeurDuMois],
  );

  /**
   * Ce qu'une courbe dit d'elle-même : dernière valeur, hors cible ou non,
   * et l'écart des douze derniers mois aux douze précédents — mesuré sur les
   * mois où les deux existent, pour ne pas mêler tendance et saison.
   */
  function detailCourbe(id: string) {
    const d = INDICATEUR_PAR_ID.get(id);
    if (!d) return null;
    const points = series.get(id) ?? [];
    const connus = points.filter((x) => x.valeur !== null).map((x) => x.valeur!);
    const dernier = connus.at(-1) ?? null;
    const mal = dernier !== null && d.cible ? (d.cible.sens === "inf" ? dernier > d.cible.valeur : dernier < d.cible.valeur) : false;
    const apparies = points.filter((x) => x.valeur !== null && x.precedent !== null);
    const sommeCourante = apparies.reduce((s, x) => s + x.valeur!, 0);
    const sommeAvant = apparies.reduce((s, x) => s + x.precedent!, 0);
    const variation = apparies.length > 0 && sommeAvant !== 0 ? Math.round(((sommeCourante - sommeAvant) / Math.abs(sommeAvant)) * 100) : null;
    const mieux = variation === null || !d.cible ? null : d.cible.sens === "inf" ? variation < 0 : variation > 0;
    const teinte = mal ? "var(--color-defavorable)" : "var(--color-accent-tres-fonce)";
    return { d, points, dernier, mal, variation, mieux, teinte };
  }

  /* Les alertes suivent le périmètre : une échéance d'un véhicule filtré ne se montre pas. */
  const alertesRetenues = useMemo(() => {
    const parImmat = new Map(vehicules.map((v) => [v.immatriculation, v]));
    return alertes.filter((a) => {
      const v = parImmat.get(a.immatriculation);
      return !v || retenus.has(v.id);
    });
  }, [alertes, vehicules, retenus]);
  const critiques = alertesRetenues.filter((a) => a.niveau === "critique").length;

  /* Où va l'argent : les charges du parc suivent les filtres ; le transport
     tiers n'est pas porté par un véhicule, il sort dès qu'un filtre est posé. */
  const repartition = useMemo(() => {
    const douze = new Set(moisExercice);
    const duParc = faits.filter((f) => retenus.has(f.vehiculeId) && douze.has(f.mois));
    const maintenance = duParc.reduce((somme, f) => somme + f.coutMaintenance, 0);
    const autres = Math.max(0, duParc.reduce((somme, f) => somme + f.cout, 0) - maintenance);
    const tiers = flotte.filter((f) => douze.has(f.mois));
    /* Une ligne par part, sans sous-titre : la vue tient sur un écran, et le
       détail se lit sur l'écran que chaque part ouvre. */
    const parts: PartAnneau[] = [
      { cle: "maintenance", libelle: "Maintenance", valeur: maintenance, teinte: "var(--color-accent-tres-fonce)", href: "/maintenance" },
      { cle: "autres", libelle: "Carburant et autres", valeur: autres, teinte: "var(--color-accent)" },
    ];
    if (!filtreVehicule) {
      parts.push(
        { cle: "affretements", libelle: "Affrètements", valeur: tiers.reduce((s, f) => s + f.coutAffretements, 0), teinte: "var(--color-texte-2)", href: "/transporteurs?vue=affretements" },
        { cle: "mad", libelle: "Mises à disposition", valeur: tiers.reduce((s, f) => s + f.coutMisesADisposition, 0), teinte: "var(--color-attenue)", href: "/transporteurs?vue=mad" },
        { cle: "prestations", libelle: "Prestations", valeur: tiers.reduce((s, f) => s + f.coutPrestations, 0), teinte: "var(--color-attenue-2)", href: "/transporteurs?vue=prestations" },
      );
    }
    const retenues = parts.filter((x) => x.valeur > 0);
    return { parts: retenues, total: retenues.reduce((s, x) => s + x.valeur, 0) };
  }, [moisExercice, faits, flotte, retenus, filtreVehicule]);

  /* Qui fait le coût du parc : un total ne se corrige pas, des véhicules si. */
  const contributions = useMemo(() => {
    const douze = new Set(moisExercice);
    const parVehicule = new Map<string, number>();
    for (const f of faits) {
      if (!retenus.has(f.vehiculeId) || !douze.has(f.mois)) continue;
      parVehicule.set(f.vehiculeId, (parVehicule.get(f.vehiculeId) ?? 0) + f.cout);
    }
    const total = [...parVehicule.values()].reduce((s, v) => s + v, 0);
    const classees = [...parVehicule.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, valeur]) => {
        const v = vehicules.find((x) => x.id === id);
        return { cle: id, libelle: v ? `${v.immatriculationAffichee} · ${v.libelle}` : id, valeur, href: v ? `/flotte/${v.immatriculation}` : undefined };
      });
    return { lignes: classees, total, univers: parVehicule.size };
  }, [moisExercice, faits, retenus, vehicules]);

  const sites = useMemo(() => [...new Set(vehicules.map((v) => v.site).filter((s): s is string => s !== null))].sort(), [vehicules]);
  const bus = useMemo(() => [...new Set(vehicules.map((v) => v.businessUnit).filter((b): b is NonNullable<typeof b> => b !== null))], [vehicules]);
  const categories = useMemo(() => [...new Set(vehicules.map((v) => v.categorieFlotte))], [vehicules]);

  const libellePeriode = periode === "semaine" ? "7 derniers jours" : periode === "mois" ? libelleMoisLong(moisCourant) : `année ${exercice}, depuis janvier`;
  const contexte = [
    libellePeriode,
    bu === "tous" ? "toutes les BU" : BUSINESS_UNIT[bu as keyof typeof BUSINESS_UNIT],
    categorie === "tous" ? null : CATEGORIE_FLOTTE[categorie as keyof typeof CATEGORIE_FLOTTE],
    site === "tous" ? "tous les sites" : site,
  ]
    .filter(Boolean)
    .join(" · ");
  const vsPeriode = PERIODES.find((p) => p.cle === periode)!.vs;
  const courbesAffichees = monte ? courbes : COURBES_DEFAUT;

  return (
    <div className="defilement-discret flex flex-col gap-2.5 px-8 pt-3.5 pb-3 lg:h-full lg:overflow-y-auto">
      {/* ---- En-tête et filtres, appliqués à toute la page ---- */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <TitreEcran titre="Tableau de bord" sousTitre={`Vue équipe parc · ${contexte} · au ${formaterDate(aujourdhui)} · ${cumul.vehicules} véhicule${cumul.vehicules > 1 ? "s" : ""}, ${cumul.engages} engagé${cumul.engages > 1 ? "s" : ""}`} />
        {/* Le bouton de choix reste collé à droite, même quand les filtres passent
            sur deux lignes : c'est l'action de la rangée, pas un filtre de plus. */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Segments valeur={periode} onChange={setPeriode} />
          <FiltreChoix etiquette="BU" valeur={bu} options={bus.map((b) => ({ cle: b as string, libelle: BUSINESS_UNIT[b] }))} onChange={setBu} />
          <FiltreChoix etiquette="Catégorie" valeur={categorie} options={categories.map((c) => ({ cle: c as string, libelle: CATEGORIE_FLOTTE[c] }))} onChange={setCategorie} />
          <FiltreChoix etiquette="Site" valeur={site} options={sites.map((s) => ({ cle: s, libelle: s }))} onChange={setSite} />
          <button type="button" onClick={() => setPanneau("pastilles")} aria-expanded={panneau === "pastilles"} className="bouton-principal ml-auto h-7 gap-1.5 px-3 text-[12.5px]">
            <SlidersHorizontal className="size-3.5" strokeWidth={2} />
            Choisir les indicateurs
            <span className="rounded-full bg-white/25 px-1.5 text-[11px]">
              {(monte ? selection : PASTILLES_DEFAUT).length} / {MAX_PASTILLES}
            </span>
          </button>
        </div>
      </div>

      {/* ---- Rangée 1 : les pastilles ---- */}
      {pastilles.length === 0 ? (
        <div className="carte shrink-0 px-5 py-8 text-center">
          <p className="meta">Aucun indicateur retenu. Ouvrez « Choisir les indicateurs » pour composer votre rangée.</p>
        </div>
      ) : (
        <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {pastilles.map(({ d, v, precedent, douze }) => {
            const mal = v.etat === "ko";
            const diff = v.valeur !== null && precedent !== null ? v.valeur - precedent : null;
            const pire = diff === null || !d.cible ? null : d.cible.sens === "inf" ? diff > 0 : diff < 0;
            const ecart =
              diff === null
                ? null
                : d.unite === "%"
                  ? `${nombre(Math.abs(diff), 1)} pt`
                  : precedent
                    ? `${nombre((Math.abs(diff) / Math.abs(precedent)) * 100, 1)} %`
                    : nombre(Math.abs(diff), d.decimales ?? 0);
            return (
              <Link
                key={d.id}
                href={d.href}
                title={`${d.libelle} — ouvrir l'écran où la valeur se vérifie`}
                className={`carte relative grid min-h-[148px] grid-rows-[auto_auto_auto_1fr] gap-1 overflow-hidden px-4 pt-3 pb-2 transition-colors hover:bg-surface-2 ${mal ? "border-defavorable-bordure" : ""}`}
              >
                {mal ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-defavorable" /> : null}
                <span className="flex min-h-[32px] items-start gap-2">
                  <PuceAxe axe={d.axe} />
                  <span className="line-clamp-2 text-[12.5px] leading-[1.3] font-semibold text-texte">{d.libelle}</span>
                  {d.code ? <span className="code ml-auto shrink-0 pt-0.5 text-[10px] tracking-wide text-attenue">{d.code}</span> : null}
                </span>
                <span className={`flex items-baseline gap-1 text-[27px] leading-none font-bold tracking-[-0.03em] tabular-nums ${v.valeur === null ? "text-attenue-2" : "text-texte"}`}>
                  {valeurAffichee(d, v.valeur)}
                  {v.valeur !== null && d.unite ? <small className="text-[13px] font-medium tracking-normal text-texte-2">{d.unite}</small> : null}
                </span>
                <span className="flex min-w-0 items-center gap-2 text-[11.5px] text-texte-2">
                  {diff !== null && ecart ? (
                    <>
                      <span className={`inline-flex shrink-0 items-center gap-0.5 font-semibold ${diff === 0 ? "" : pire ? (mal ? "text-defavorable" : "") : "text-favorable"}`}>
                        {diff === 0 ? "=" : diff > 0 ? "▲" : "▼"} {ecart}
                      </span>
                      <span className="shrink-0">{vsPeriode}</span>
                    </>
                  ) : v.valeur === null ? (
                    <span className="shrink-0">{v.etat === "non-alimente" ? "à alimenter" : "sans donnée"}</span>
                  ) : null}
                  <span className="ml-auto truncate" title={cibleLisible(v)}>
                    {cibleLisible(v)}
                  </span>
                </span>
                <span className="-mx-1 -mb-1 self-end">
                  <Etincelle valeurs={douze} cible={d.parMois ? (d.cible?.valeur ?? null) : (v.cible ?? d.cible?.valeur ?? null)} horsCible={mal} />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* ---- Rangée 2 : les courbes ---- */}
      <div className="carte flex shrink-0 flex-col px-5 pt-3.5 pb-3">
        <div className="mb-2 flex flex-wrap items-baseline gap-3">
          <h2 className="titre-bloc">Évolution sur {exercice}</h2>
          <span className="meta">janvier à décembre, une échelle par courbe · {filtreVehicule ? "périmètre filtré" : "tout le parc"}</span>
          <span className="ml-auto flex items-center gap-3.5 text-[11.5px] text-texte-2">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block w-4 border-t-2 border-accent-tres-fonce" />
              {exercice}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block w-4 border-t-2 border-dashed border-attenue-2" />
              {Number(exercice) - 1}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block w-4 border-t-2 border-dotted border-attenue" />
              cible
            </span>
          </span>
          <button type="button" onClick={() => setPanneau("courbes")} aria-expanded={panneau === "courbes"} className="text-[12px] font-semibold text-accent-fonce hover:underline">
            Choisir les courbes · {courbesAffichees.length} / {MAX_COURBES}
          </button>
        </div>
        {courbesAffichees.length === 0 ? (
          <p className="meta py-6 text-center">Aucune courbe choisie. Ouvrez « Choisir les courbes » pour suivre une dimension dans le temps.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {courbesAffichees.map((id) => {
              const detail = detailCourbe(id);
              if (!detail) return null;
              const { d, points, dernier, mal, variation, mieux, teinte } = detail;
              return (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  title="Agrandir la courbe"
                  onClick={() => setZoom(id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setZoom(id);
                    }
                  }}
                  className="min-w-0 cursor-pointer rounded-[12px] border border-bordure bg-surface-2 px-3 pt-2.5 pb-1.5 transition-colors hover:border-accent-bordure hover:bg-surface"
                >
                  <div className="flex items-baseline gap-2">
                    <PuceAxe axe={d.axe} petite />
                    <span className="min-w-0 truncate text-[12px] font-semibold text-texte" title={d.libelle}>
                      {d.libelle}
                    </span>
                    <span className="ml-auto shrink-0 text-[12.5px] font-bold tabular-nums" style={{ color: mal ? "var(--color-defavorable)" : undefined }}>
                      {dernier === null ? "—" : nombre(dernier, Math.abs(dernier) >= 1000 ? 0 : (d.decimales ?? 0))}
                      {d.unite ? <small className="ml-0.5 text-[10px] font-semibold text-attenue">{d.unite}</small> : null}
                    </span>
                    {variation !== null && variation !== 0 ? (
                      <span title={`${exercice} contre ${Number(exercice) - 1}, sur les mêmes mois`} className={`code shrink-0 text-[11px] font-medium ${mieux === true ? "text-favorable" : mieux === false && mal ? "text-defavorable" : "text-texte-2"}`}>
                        {variation > 0 ? "+" : ""}
                        {variation} % sur un an
                      </span>
                    ) : null}
                  </div>
                  {d.forme === "barres" ? (
                    <BarresMensuelles points={points} cible={d.cible?.valeur ?? null} sens={d.cible?.sens ?? null} teinte={teinte} unite={d.unite} decimales={d.decimales ?? 0} sansLegende />
                  ) : (
                    <Courbe points={points} cible={d.cible?.valeur ?? null} sens={d.cible?.sens ?? null} teinte={teinte} unite={d.unite} decimales={d.decimales ?? 0} sansLegende />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Rangée 3 : agir, où va l'argent, qui le dépense ---- */}
      <div className="grid shrink-0 grid-cols-1 gap-3 xl:grid-cols-3">
        <Carte
          titre="À traiter aujourd'hui"
          precision="Documents échus, immobilisations, échéances proches"
          action={
            <Link href="/conformite" className="text-[12px] font-semibold text-accent-fonce hover:underline">
              Conformité →
            </Link>
          }
        >
          <div className="flex flex-col gap-0.5 px-2 pb-2">
            {alertesRetenues.length === 0 ? (
              <p className="meta px-3 py-4">Rien à traiter sur ce périmètre.</p>
            ) : (
              alertesRetenues.slice(0, 5).map((a) => (
                <Link key={`${a.immatriculation}-${a.libelle}`} href={a.href} title={`${a.immatriculationAffichee} · ${a.libelle} · ${a.echeance}`} className="grid grid-cols-[8px_74px_1fr_auto] items-center gap-2 rounded-[10px] px-3 py-1.5 hover:bg-surface-2">
                  <span className="size-2 rounded-full" style={{ background: a.niveau === "critique" ? "var(--color-defavorable)" : "var(--color-attenue-2)" }} />
                  <span className="code text-[11px] font-semibold text-accent-tres-fonce">{a.immatriculationAffichee}</span>
                  {/* La description a la place ; l'échéance et l'immatriculation se font petites. */}
                  <span className="truncate text-[12.5px] text-texte">{a.libelle}</span>
                  <span className={`text-[10.5px] whitespace-nowrap ${a.niveau === "critique" ? "font-semibold text-defavorable" : "text-texte-2"}`}>{a.echeance}</span>
                </Link>
              ))
            )}
            <div className="mt-1.5 flex gap-3 border-t border-bordure px-3 pt-2 text-[12px] text-texte-2">
              <span>
                <b className={critiques > 0 ? "text-defavorable" : "text-texte"}>{critiques}</b> à traiter
              </span>
              <span>
                <b className="text-texte">{alertesRetenues.length - critiques}</b> à surveiller
              </span>
              {alertesRetenues.length > 5 ? <span className="ml-auto">{alertesRetenues.length - 5} de plus sur Conformité</span> : null}
            </div>
          </div>
        </Carte>

        <Carte titre="Où passe l'argent du transport" precision={filtreVehicule ? `Depuis janvier ${exercice} · charges du parc filtré, transport tiers exclu` : `Depuis janvier ${exercice} · charges du parc et transport confié à des tiers`}>
          <Anneau parts={repartition.parts} total={repartition.total} libelleTotal={`depuis janvier ${exercice}`} formater={(v) => montantCourt(v)} />
        </Carte>

        <Carte titre="Les véhicules qui pèsent le plus" precision={`Coût complet depuis janvier ${exercice} — un total ne se corrige pas, des véhicules si`}>
          <BarresContribution lignes={contributions.lignes} total={contributions.total} formater={(v) => montantCourt(v)} teinte="var(--color-texte-2)" universLibelle="véhicules" universTotal={contributions.univers} />
        </Carte>
      </div>

      {/* ---- La courbe agrandie : le graphique en grand, et le détail mois par mois ---- */}
      {zoom
        ? (() => {
            const detail = detailCourbe(zoom);
            if (!detail) return null;
            const { d, points, dernier, mal, variation, mieux, teinte } = detail;
            const axe = AXES.find((a) => a.cle === d.axe);
            const decimales = d.decimales ?? 0;
            return (
              <>
                <button type="button" aria-label="Fermer la courbe agrandie" onClick={() => setZoom(null)} className="fixed inset-0 z-30 cursor-default bg-encre/40" />
                <div role="dialog" aria-modal="true" aria-labelledby="zoom-titre" className="fixed top-1/2 left-1/2 z-40 flex max-h-[92vh] w-[min(1040px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[18px] bg-surface shadow-flottante">
                  <div className="flex items-start gap-3 border-b border-bordure px-6 pt-5 pb-4">
                    <PuceAxe axe={d.axe} />
                    <div className="min-w-0">
                      <h2 id="zoom-titre" className="text-[17px] leading-tight font-bold text-texte">
                        {d.libelle}
                      </h2>
                      <p className="meta mt-0.5">
                        {axe?.nom}
                        {d.code ? ` · ${d.code}` : ""} · janvier à décembre {exercice}, contre {Number(exercice) - 1} · {filtreVehicule ? "périmètre filtré" : "tout le parc"} · {d.cibleTexte}
                      </p>
                    </div>
                    <span className="ml-auto flex shrink-0 items-baseline gap-3">
                      <span className="text-[26px] font-bold tracking-[-0.03em] tabular-nums" style={{ color: mal ? "var(--color-defavorable)" : undefined }}>
                        {dernier === null ? "—" : nombre(dernier, Math.abs(dernier) >= 1000 ? 0 : decimales)}
                        {d.unite ? <small className="ml-1 text-[12px] font-semibold text-attenue">{d.unite}</small> : null}
                      </span>
                      {variation !== null && variation !== 0 ? (
                        <span className={`code text-[12.5px] font-medium ${mieux === true ? "text-favorable" : mieux === false && mal ? "text-defavorable" : "text-texte-2"}`}>
                          {variation > 0 ? "+" : ""}
                          {variation} % sur un an
                        </span>
                      ) : null}
                    </span>
                    <button type="button" onClick={() => setZoom(null)} className="grid size-8 shrink-0 place-items-center rounded-full text-attenue hover:bg-surface-3 hover:text-texte">
                      <X className="size-4" strokeWidth={2} />
                      <span className="sr-only">Fermer</span>
                    </button>
                  </div>
                  <div className="defilement-discret grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto px-6 py-5 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
                    <div className="min-w-0">
                      {d.forme === "barres" ? (
                        <BarresMensuelles points={points} cible={d.cible?.valeur ?? null} sens={d.cible?.sens ?? null} teinte={teinte} unite={d.unite} decimales={decimales} />
                      ) : (
                        <Courbe points={points} cible={d.cible?.valeur ?? null} sens={d.cible?.sens ?? null} teinte={teinte} unite={d.unite} decimales={decimales} />
                      )}
                    </div>
                    <div className="min-w-0 overflow-x-auto">
                      <table className="w-full text-[12.5px] tabular-nums">
                        <thead>
                          <tr className="text-left text-[10.5px] tracking-[0.06em] text-attenue uppercase">
                            <th className="pb-1.5 font-semibold">Mois</th>
                            <th className="pb-1.5 text-right font-semibold">Valeur</th>
                            <th className="pb-1.5 text-right font-semibold">An passé</th>
                            <th className="pb-1.5 text-right font-semibold">Écart</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...points].reverse().map((p) => {
                            const horsCible = p.valeur !== null && d.cible ? (d.cible.sens === "inf" ? p.valeur > d.cible.valeur : p.valeur < d.cible.valeur) : false;
                            const ecart = p.valeur !== null && p.precedent !== null && p.precedent !== 0 ? Math.round(((p.valeur - p.precedent) / Math.abs(p.precedent)) * 100) : null;
                            return (
                              <tr key={p.mois} className="border-t border-bordure">
                                <td className="py-1 text-texte-2">{libelleMoisCourt(p.mois)}</td>
                                <td className={`py-1 text-right font-semibold ${horsCible ? "text-defavorable" : "text-texte"}`}>{p.valeur === null ? "—" : nombre(p.valeur, decimales)}</td>
                                <td className="py-1 text-right text-texte-2">{p.precedent === null ? "—" : nombre(p.precedent, decimales)}</td>
                                <td className="py-1 text-right text-texte-2">{ecart === null ? "—" : `${ecart > 0 ? "+" : ""}${ecart} %`}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            );
          })()
        : null}

      {/* ---- Le panneau de choix : pastilles ou courbes, par axe, borné ---- */}
      {panneau ? (
        <>
          <button type="button" aria-label="Fermer le panneau" onClick={() => setPanneau(null)} className="fixed inset-0 z-30 cursor-default bg-encre/35" />
          <aside role="dialog" aria-modal="true" aria-labelledby="panneau-titre" className="fixed inset-y-0 right-0 z-40 flex w-[min(440px,100vw)] flex-col bg-surface shadow-flottante">
            {(() => {
              const pourPastilles = panneau === "pastilles";
              const liste = pourPastilles ? selection : courbes;
              const max = pourPastilles ? MAX_PASTILLES : MAX_COURBES;
              const plein = liste.length >= max;
              const candidats = pourPastilles ? INDICATEURS : INDICATEURS_COURBE;
              const basculerChoix = (id: string, coche: boolean) => {
                const suivante = coche ? liste.filter((x) => x !== id) : [...liste, id];
                if (pourPastilles) enregistrer(suivante);
                else enregistrerCourbes(suivante);
              };
              return (
                <>
                  <div className="flex items-baseline gap-3 border-b border-bordure px-5 pt-4 pb-3">
                    <h2 id="panneau-titre" className="text-[16px] font-bold text-texte">
                      {pourPastilles ? "Indicateurs affichés" : "Courbes affichées"}
                    </h2>
                    <span className={`text-[12.5px] font-semibold ${plein ? "text-defavorable" : "text-texte-2"}`}>
                      {liste.length} sur {max}
                    </span>
                    <button type="button" onClick={() => setPanneau(null)} className="ml-auto grid size-8 place-items-center rounded-full text-attenue hover:bg-surface-3 hover:text-texte">
                      <X className="size-4" strokeWidth={2} />
                      <span className="sr-only">Fermer</span>
                    </button>
                  </div>
                  <div className="defilement-discret flex-1 overflow-y-auto px-3 pb-5">
                    {AXES.map((axe) => {
                      const dimensions = candidats.filter((d) => d.axe === axe.cle);
                      if (dimensions.length === 0) return null;
                      return (
                        <div key={axe.cle} className="mt-3">
                          <h3 className="mb-1 ml-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.06em] text-attenue uppercase">
                            <PuceAxe axe={axe.cle} petite />
                            {axe.nom}
                          </h3>
                          <ul className="flex flex-col">
                            {dimensions.map((d) => {
                              const coche = liste.includes(d.id);
                              const bloque = !coche && plein;
                              return (
                                <li key={d.id}>
                                  <label
                                    title={bloque ? `${max} au plus : décochez-en ${pourPastilles ? "un" : "une"} pour libérer une place.` : d.libelle}
                                    className={`flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-[12.5px] ${bloque ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-surface-2"}`}
                                  >
                                    <input type="checkbox" checked={coche} disabled={bloque} onChange={() => basculerChoix(d.id, coche)} className="size-4 shrink-0 accent-accent disabled:cursor-not-allowed" />
                                    <span className={`min-w-0 font-medium ${d.aVenir ? "text-texte-2" : "text-texte"}`}>
                                      {d.libelle}
                                      {d.aVenir ? <span className="ml-1.5 text-[11.5px] font-normal text-attenue">· à alimenter</span> : null}
                                    </span>
                                    <span className="ml-auto shrink-0 text-[11.5px] whitespace-nowrap text-attenue">{d.code ?? d.cibleTexte}</span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 border-t border-bordure px-5 py-3 text-[12px] text-texte-2">
                    <span>{pourPastilles ? "Cinq au plus, sur une seule rangée. Décochez-en un pour en choisir un autre." : "Quatre courbes au plus, chacune sur sa propre échelle."}</span>
                    <button type="button" onClick={() => (pourPastilles ? enregistrer([...PASTILLES_DEFAUT]) : enregistrerCourbes([...COURBES_DEFAUT]))} className="bouton-secondaire ml-auto h-8 shrink-0 text-[12px]">
                      Par défaut
                    </button>
                    <button type="button" onClick={() => setPanneau(null)} className="bouton-principal h-8 shrink-0 text-[12px]">
                      Terminer
                    </button>
                  </div>
                </>
              );
            })()}
          </aside>
        </>
      ) : null}
    </div>
  );
}
