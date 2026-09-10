"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Banknote, CalendarClock, ChevronDown, ChevronUp, CircleCheck, CircleOff, ClipboardList, Clock, Droplet, FileWarning, Fuel, Gauge, Inbox, RotateCcw, ShieldCheck, SlidersHorizontal, TriangleAlert, UserX, Wallet, Wrench, X, type LucideIcon } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { Anneau, BarresContribution, BarresMensuelles, Courbe, libelleMoisCourt, type PartAnneau, type PointCourbe } from "./Graphiques";
import {
  AXES,
  COURBES_DEFAUT,
  cumuler,
  INDICATEUR_PAR_ID,
  INDICATEURS_COURBE,
  MAX_COURBES,
  type Cumul,
  type DefinitionIndicateur,
  type FaitsFlotteMois,
  type FaitsVehiculeMois,
  type SituationJour,
  type VehiculeTableau,
} from "@/domaine/tableau-bord";
import { BUSINESS_UNIT, CATEGORIE_FLOTTE } from "@/domaine/libelles";
import { MAX_PASTILLES, MOMENT, PASTILLE_PAR_ID, PASTILLES, PASTILLES_DEFAUT, evaluerPastille, limiterPastilles, pastillesDuProfil, type SituationJournaliere } from "@/domaine/pastilles";
import { PROFILS } from "@/domaine/acces";
import { lireAccesCourant } from "@/lib/acces-courant";
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
 *   2. **les courbes**, huit au plus sur deux rangées, chacune sur sa propre échelle, avec la
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

/** La lettre de l'axe, en puce neutre : la couleur est réservée à l'alerte. */
/**
 * L'icône de chaque pastille — une par identifiant, choisie sur ce que la
 * pastille compte, pas sur son axe.
 *
 * Elle prend en tête de carte la place de la lettre SQDCM (10 septembre 2026,
 * sur une maquette du métier) : « D » ne dit rien à qui ouvre l'écran pour la
 * première fois, une jauge ou un bidon se lisent sans glossaire. **L'axe n'est
 * pas perdu** — il tient l'infobulle de la carte, et il structure toujours le
 * panneau « Choisir les indicateurs », qui est l'endroit où l'on raisonne par
 * axe.
 */
const ICONE_PASTILLE: Record<string, LucideIcon> = {
  "p-hors-service": CircleOff,
  "p-prets": CircleCheck,
  "p-immobilises-7": Clock,
  "p-pannes-semaine": Wrench,
  "p-jours-sans-accident": ShieldCheck,
  "p-accidents-semaine": TriangleAlert,
  "p-echeances-7": CalendarClock,
  "p-immobilises-admin": FileWarning,
  "p-sans-releve": Gauge,
  "p-carburant-semaine": Fuel,
  "p-cuve": Droplet,
  "p-caisse": Wallet,
  "p-depenses-semaine": Banknote,
  "p-chauffeurs-indisponibles": UserX,
  "p-ordres-ouverts": ClipboardList,
  "p-demandes-sans-reponse": Inbox,
};

/**
 * La coupure entre les trois temps de la page (métier, 10 septembre 2026 :
 * « une séparation nette entre les pastilles, les courbes et le reste »).
 *
 * Les trois rangées se suivaient à trois unités d'écart, et rien ne disait
 * qu'on changeait de registre : l'état du moment, l'évolution sur l'exercice,
 * puis ce qui appelle un geste. Un filet nommé le dit en une ligne.
 */
/** Deux rangées identiques : mêmes pastilles, même ordre. */
function memeRangee(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function Separateur({ libelle, precision }: { libelle: string; precision: string }) {
  return (
    <div className="mt-1.5 flex shrink-0 items-center gap-3">
      <span className="shrink-0 text-[11px] font-semibold tracking-[0.08em] text-texte-2 uppercase">{libelle}</span>
      <span className="meta hidden shrink-0 md:inline">{precision}</span>
      <i aria-hidden="true" className="h-px min-w-6 flex-1 bg-bordure" />
    </div>
  );
}

function PuceAxe({ axe, petite, ronde }: { axe: string; petite?: boolean; ronde?: boolean }) {
  const nom = AXES.find((a) => a.cle === axe)?.nom ?? axe;
  /* Ronde et plus grande en tête de pastille : c'est elle qui donne à la carte
     sa ligne de titre, et elle reste neutre — la charte réserve la couleur au
     sens, une teinte par axe ne dirait rien qu'un lecteur puisse lire. */
  return (
    <span title={nom} className={`grid shrink-0 place-items-center font-bold text-texte-2 ${ronde ? "size-8 rounded-full bg-surface-3 text-[12.5px]" : petite ? "size-4 rounded-[6px] bg-surface-3 text-[9.5px]" : "size-5 rounded-[6px] bg-surface-3 text-[11px]"}`}>
      {axe}
    </span>
  );
}

/* La courbe de pied de pastille — quatorze jours, cible en pointillé — a été
   retirée le 10 septembre 2026 à la demande du métier : elle occupait le bas
   de chaque carte pour un signal que la flèche de progression donne en un
   caractère. Les courbes gardent leur place, en dessous, sur douze mois : la
   pastille dit l'état du moment, pas la tendance. */

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
  situations,
  seuils,
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
  /** Les situations journalières des quatre dernières semaines : la matière des pastilles. */
  situations: SituationJournaliere[];
  /** Les seuils réglés dans Paramètres › Pastilles, par identifiant de pastille. */
  seuils: Record<string, number>;
}) {
  const [periode, setPeriode] = useState<Periode>("mois");
  const [bu, setBu] = useState<string>("tous");
  const [categorie, setCategorie] = useState<string>("tous");
  const [site, setSite] = useState<string>("tous");
  const [panneau, setPanneau] = useState<"pastilles" | "courbes" | null>(null);
  /* Un clic sur une courbe l'ouvre en grand, avec le détail mois par mois. */
  const [zoom, setZoom] = useState<string | null>(null);

  /* Les choix sont un réglage de compte, comme les colonnes des listes : ils
     vivent dans le navigateur sous une clé qui porte le rôle.
     **La rangée d'ouverture, elle, dépend du profil** (métier, 10 septembre
     2026) : ce qu'un responsable veut voir en arrivant n'est pas ce qui occupe
     la journée d'un chef d'atelier. Tant que la personne n'a rien choisi, elle
     voit la rangée de son profil ; dès qu'elle choisit, c'est son choix qui
     vaut, et le bouton « Revenir au défaut » le rend au profil. */
  const [profil, setProfil] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>(PASTILLES_DEFAUT);
  const [courbes, setCourbes] = useState<string[]>(COURBES_DEFAUT);
  const [monte, setMonte] = useState(false);
  const defautDuProfil = useMemo(() => pastillesDuProfil(profil), [profil]);
  useEffect(() => {
    setMonte(true);
    try {
      const role = trouverRole(lireRole()).role;
      const acces = lireAccesCourant();
      setProfil(acces.profil);
      const brut = localStorage.getItem(`sedima.parc.tableau-bord.pastilles.${role}`);
      if (brut) {
        /* Une sélection d'avant le 8 septembre 2026 ne porte que des indicateurs
           de période : elle ne donne rien, et le compte repart du défaut plutôt
           que d'une rangée vide. Une rangée vidée exprès reste vide. */
        const lue = JSON.parse(brut) as string[];
        const retenue = limiterPastilles(lue);
        setSelection(retenue.length > 0 || lue.length === 0 ? retenue : pastillesDuProfil(acces.profil));
      } else setSelection(pastillesDuProfil(acces.profil));
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
  const profilLibelle = useMemo(() => (profil ? (PROFILS.find((p) => p.profil === profil)?.libelle ?? null) : null), [profil]);
  /** Rendre la rangée à son profil : le choix personnel s'efface, le défaut revient. */
  function revenirAuDefaut() {
    setSelection(defautDuProfil);
    try {
      localStorage.removeItem(`sedima.parc.tableau-bord.pastilles.${trouverRole(lireRole()).role}`);
    } catch {
      /* sans stockage, l'état de la page suffit */
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

  /* Les pastilles disent l'état du moment (décision du 8 septembre 2026) :
     elles se calculent sur les situations journalières, bornées au périmètre
     — BU, catégorie, site — mais pas à la période, qui ne vaut que pour les
     courbes. La référence est hier en fin de journée, ou la semaine passée. */
  const situationsRetenues = useMemo(() => (filtreVehicule ? situations.map((s) => ({ ...s, vehicules: s.vehicules.filter((v) => retenus.has(v.vehiculeId)) })) : situations), [situations, retenus, filtreVehicule]);
  const pastilles = useMemo(() => (monte ? selection : PASTILLES_DEFAUT).map((id) => evaluerPastille(PASTILLE_PAR_ID.get(id)!, situationsRetenues, seuils)), [monte, selection, situationsRetenues, seuils]);

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
    /* Du plus cher au moins cher (métier, 10 septembre 2026). L'ordre de
       déclaration mettait la maintenance en tête quoi qu'elle pèse, si bien
       que la liste sautait de 165,9 M à 485,4 M puis à 11,6 M : on ne voyait
       plus où passe l'argent, qui est pourtant la question de la carte. */
    const retenues = parts.filter((x) => x.valeur > 0).sort((a, b) => b.valeur - a.valeur);
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
  const courbesAffichees = monte ? courbes : COURBES_DEFAUT;

  return (
    <div className="defilement-discret flex flex-col gap-2.5 px-8 pt-3.5 pb-3 lg:h-full lg:overflow-y-auto">
      {/* ---- En-tête et filtres, appliqués à toute la page ---- */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <TitreEcran titre="Tableau de bord" sousTitre={`Vue équipe parc · ${contexte} · au ${formaterDate(aujourdhui)} · ${cumul.vehicules} véhicule${cumul.vehicules > 1 ? "s" : ""}, ${cumul.engages} engagé${cumul.engages > 1 ? "s" : ""}`} />
        {/* Le bouton de choix reste collé à droite, même quand les filtres passent
            sur deux lignes : c'est l'action de la rangée, pas un filtre de plus.
            Le `grow` est ce qui le permet — sans lui, ce bloc n'occupe que la
            largeur de son contenu, et son `justify-end` n'a rien à repousser :
            une fois la rangée passée à la ligne, elle se recale à gauche et le
            bouton avec elle. */}
        <div className="flex grow flex-wrap items-center justify-end gap-2">
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

      {/* ---- Rangée 1 : les pastilles du moment ---- */}
      <Separateur libelle="Maintenant" precision="l'état du parc à cet instant, ou de la dernière période close" />
      {pastilles.length === 0 ? (
        <div className="carte shrink-0 px-5 py-8 text-center">
          <p className="meta">Aucune pastille retenue. Ouvrez « Choisir les indicateurs » pour composer votre rangée.</p>
        </div>
      ) : (
        <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {pastilles.map((p) => {
            const d = p.definition;
            const diff = p.valeur !== null && p.reference !== null ? p.valeur - p.reference : null;
            /* Le chevron dit le sens ; sa couleur dit si l'on va dans le bon.
               Le sens voulu vient du seuil quand il y en a un, sinon du
               `sensSouhaite` posé sur la pastille — et il reste inconnu là où
               il l'est vraiment, comme le carburant de la semaine. */
            const sensVoulu = d.seuil?.sens ?? d.sensSouhaite ?? null;
            const bonSens = diff === null || diff === 0 || !sensVoulu ? null : sensVoulu === "inf" ? diff < 0 : diff > 0;
            const Icone = ICONE_PASTILLE[d.id] ?? CircleCheck;
            /* Le dégradé dit l'état d'un coup d'œil (métier, 10 septembre
               2026), et remplace la bande rouge qui bordait les cartes en
               alerte. Trois cas seulement, tous lus dans la donnée : au-delà
               du seuil, en deçà, ou sans seuil — on ne teinte pas ce qu'on ne
               peut pas juger. Il s'éteint à 62 % de la hauteur pour que le
               texte du pied reste sur du blanc. */
            const fond = p.alerte
              ? "linear-gradient(180deg, var(--color-defavorable-fond) 0%, var(--color-surface) 62%)"
              : d.seuil && p.valeur !== null
                ? "linear-gradient(180deg, var(--color-favorable-fond) 0%, var(--color-surface) 62%)"
                : undefined;
            return (
              <Link
                key={d.id}
                href={d.href}
                /* La carte dit court ; l'infobulle dit tout — le sens de
                   l'écart, la période comparée, le seuil qui fait le rouge. */
                title={[d.libelle, AXES.find((a) => a.cle === d.axe)?.nom ?? d.axe, MOMENT[d.moment].toLowerCase(), diff !== null && diff !== 0 ? `${p.referenceTexte.split(" · ")[0]} de ${diff > 0 ? "plus" : "moins"} qu${d.reference === "hier" ? "'hier" : "e la semaine passée"}` : p.referenceTexte, p.seuilTexte, "ouvrir l'écran qui explique le chiffre"].filter(Boolean).join(" — ")}
                style={fond ? { backgroundImage: fond } : undefined}
                className={`carte relative flex min-h-[140px] flex-col gap-2 overflow-hidden px-4 pt-3 pb-3 ${p.alerte ? "border-defavorable-bordure" : ""}`}
              >
                {/* La même icône, en grand et en filigrane, débordant par le
                    bas à droite (métier, 10 septembre 2026, sur croquis). Elle
                    donne à la carte sa matière sans rien dire de plus : d'où
                    l'opacité très basse, le débord qui la coupe, et le
                    `aria-hidden` — un lecteur d'écran n'a pas à l'annoncer
                    deux fois. Les blocs qui suivent portent `relative` pour
                    passer devant : une image posée en absolu peint au-dessus
                    du texte dans le flux, sans cela. */}
                <Icone aria-hidden="true" strokeWidth={1.2} className={`pointer-events-none absolute -bottom-7 right-1 size-[112px] ${p.alerte ? "text-defavorable/[0.07]" : "text-texte/[0.045]"}`} />
                {/* La ligne de titre : le libellé tient la largeur, la puce de
                    l'axe ferme la ligne à droite — c'est elle qui donne son
                    assise à la carte. Le moment descend au pied, avec le seuil,
                    parce qu'il précise le chiffre plutôt qu'il ne le nomme. */}
                {/* Le titre ne se coupe jamais : il nomme la pastille, et un
                    nom tronqué ne nomme plus rien. Les libellés ont été
                    raccourcis à la source pour qu'il tienne — la mention du
                    moment disait déjà « maintenant », « de la semaine »,
                    « dans les 7 jours », le titre n'a pas à le répéter. */}
                <span className="relative flex items-start gap-2">
                  <span className="min-h-[32px] flex-1 text-[12.5px] leading-[1.3] font-semibold text-balance text-texte">{d.libelle}</span>
                  {/* Sans pastille derrière : le croquis du métier montre le
                      trait seul, et sur une carte déjà teintée un rond de fond
                      ne se voyait plus de toute façon. */}
                  <Icone aria-hidden="true" strokeWidth={1.6} className={`mt-0.5 size-[18px] shrink-0 ${p.alerte ? "text-defavorable" : "text-attenue"}`} />
                </span>
                {/* Le chiffre porte la carte : la mini-courbe des quatorze
                    jours a quitté le pied (demande du métier, 10 septembre
                    2026), et toute la place qu'elle prenait revient à lui. */}
                <span className="relative flex min-w-0 flex-col gap-0.5">
                  <span className={`flex min-w-0 items-baseline gap-1.5 text-[38px] leading-none font-bold tracking-[-0.035em] tabular-nums ${p.valeur === null ? "text-attenue-2" : p.alerte ? "text-defavorable" : "text-texte"}`}>
                    {p.valeur === null ? "—" : nombre(p.valeur, d.decimales ?? 0)}
                    {p.valeur !== null && d.unite ? <small className="text-[14px] font-medium tracking-normal text-texte-2">{d.unite}</small> : null}
                    {/* Le chevron de progression, contre le chiffre (métier,
                        10 septembre 2026). Vert quand cela s'améliore, rouge
                        quand cela empire — au sens *voulu* de la pastille :
                        moins de véhicules hors service est une bonne
                        nouvelle, moins de véhicules prêts n'en est pas une.
                        **Gris quand la pastille n'a pas de seuil** : sans lui,
                        rien ne dit si monter est bon ou mauvais, et une
                        couleur trancherait ce qu'on ignore. Rien du tout
                        quand le chiffre n'a pas bougé : la légende le dit. */}
                    {diff !== null && diff !== 0 ? (
                      (() => {
                        const Chevron = diff > 0 ? ChevronUp : ChevronDown;
                        return <Chevron aria-hidden="true" strokeWidth={2.6} className={`size-[22px] shrink-0 self-center ${bonSens === true ? "text-favorable" : bonSens === false ? "text-defavorable" : "text-attenue"}`} />;
                      })()
                    ) : null}
                  </span>
                  {/* Le complément descend sous le chiffre : à six pastilles de
                      front la carte fait cent cinquante pixels, et « / 47
                      engagés » posé sur la même ligne qu'un chiffre de
                      trente-huit se coupait. */}
                  {p.complement ? <span className="truncate text-[11.5px] font-medium text-texte-2">{p.complement}</span> : null}
                </span>
                <span className="relative mt-auto flex min-w-0 flex-col gap-1">
                  {/* La flèche de progression dit le sens d'un coup d'œil, et
                      c'est elle qui remplace la courbe : montée, descente, ou
                      la barre du surplace. Sa couleur suit le sens *voulu* —
                      moins de véhicules hors service est une bonne nouvelle,
                      moins de véhicules prêts n'en est pas une. */}
                  {/* La légende n'a plus de flèche : le chevron est monté
                      contre le chiffre. Deux lignes plutôt qu'une coupure —
                      « 9 031 L · sem. passée » dépasse de trois pixels sur la
                      carte la plus étroite, et « 9 031 L · sem. pa… » ne dit
                      plus de quoi on parle. */}
                  <span className="line-clamp-2 min-w-0 text-[11px] leading-[1.35] text-texte-2">{p.referenceTexte || (p.valeur === null ? "sans donnée" : "")}</span>
                  {/* Le moment tient la dernière ligne, toujours : c'est lui
                      qui dit de quand parle le chiffre, et deux mots y
                      suffisent. Le texte du seuil est descendu dans
                      l'infobulle — il est long, il ne se lisait qu'en alerte,
                      et le rouge de la carte dit déjà qu'il est franchi. */}
                  <span className="truncate text-[10.5px] font-semibold tracking-[0.06em] text-attenue uppercase">{MOMENT[d.moment]}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* ---- Rangée 2 : les courbes ---- */}
      <Separateur libelle="Dans le temps" precision="douze mois, une échelle par courbe" />
      <div className="carte flex shrink-0 flex-col px-5 pt-3.5 pb-3">
        <div className="mb-2 flex flex-wrap items-center gap-3">
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
          {/* Même bouton que « Choisir les indicateurs », à droite : un seul
              geste pour composer la page. Il porte son propre `ml-auto` en
              plus de celui de la légende : le premier ne vaut que pour la
              ligne où il se trouve, et quand la rangée passe à la ligne le
              bouton repartait à gauche, à quatre cent soixante-six pixels du
              bord. */}
          <button type="button" onClick={() => setPanneau("courbes")} aria-expanded={panneau === "courbes"} className="bouton-principal ml-auto h-7 gap-1.5 px-3 text-[12.5px]">
            <SlidersHorizontal className="size-3.5" strokeWidth={2} />
            Choisir les courbes
            <span className="rounded-full bg-white/25 px-1.5 text-[11px]">
              {courbesAffichees.length} / {MAX_COURBES}
            </span>
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
      <Separateur libelle="À traiter, et où va l'argent" precision="ce qui appelle un geste aujourd'hui, et ce que le parc coûte" />
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
              /* Les pastilles n'offrent que l'état du moment ; les indicateurs de
                 période restent aux courbes (décision du 8 septembre 2026). */
              const candidats: { id: string; axe: string; libelle: string; precision: string; aVenir: boolean }[] = pourPastilles
                ? PASTILLES.map((p) => ({ id: p.id, axe: p.axe, libelle: p.libelle, precision: MOMENT[p.moment], aVenir: false }))
                : INDICATEURS_COURBE.map((d) => ({ id: d.id, axe: d.axe, libelle: d.libelle, precision: d.code ?? d.cibleTexte, aVenir: Boolean(d.aVenir) }));
              const basculerChoix = (id: string, coche: boolean) => {
                const suivante = coche ? liste.filter((x) => x !== id) : [...liste, id];
                if (pourPastilles) enregistrer(suivante);
                else enregistrerCourbes(suivante);
              };
              return (
                <>
                  <div className="flex items-baseline gap-3 border-b border-bordure px-5 pt-4 pb-3">
                    <h2 id="panneau-titre" className="text-[16px] font-bold text-texte">
                      {pourPastilles ? "Pastilles du moment" : "Courbes affichées"}
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
                                    <span className="ml-auto shrink-0 text-[11.5px] whitespace-nowrap text-attenue">{d.precision}</span>
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
                    <span>{pourPastilles ? `Six au plus, sur une seule rangée : l'état du moment, comparé à hier ou à la semaine passée. La tendance est aux courbes.${profilLibelle ? ` La rangée d'ouverture est celle du profil « ${profilLibelle} ».` : ""}` : "Huit courbes au plus, sur deux rangées de quatre, chacune sur sa propre échelle."}</span>
                    {/* Revenir au défaut **efface le choix** au lieu d'enregistrer
                        le défaut comme un choix de plus : la rangée redevient
                        celle du profil, et elle suivra ce profil s'il change.
                        Le bouton ne s'offre que s'il change quelque chose. */}
                    {!pourPastilles || !memeRangee(selection, defautDuProfil) ? (
                      <button type="button" onClick={() => (pourPastilles ? revenirAuDefaut() : enregistrerCourbes([...COURBES_DEFAUT]))} className="bouton-secondaire ml-auto h-8 shrink-0 gap-1.5 text-[12px]">
                        <RotateCcw className="size-3.5" strokeWidth={2} />
                        Revenir au défaut
                      </button>
                    ) : null}
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
