/* ============================================================================
 * La notation d'un transporteur.
 *
 * Demandée au brainstorm du 5 septembre 2026 — « qu'on puisse mesurer la
 * performance de chaque transporteur » — et déjà au carnet du 4 septembre pour
 * les prestataires : « une pastille avec code couleur, plusieurs dimensions,
 * quatre à cinq niveaux, simple et clair ».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * **Le parti pris, et il est discutable : rien ne se saisit.** Les cinq
 * dimensions se calculent sur des faits déjà enregistrés — factures, relevé de
 * tonnage, grilles, contrats. Aucune n'exige qu'un agent note quelqu'un.
 *
 * Ce n'est pas de la paresse. Une notation à la main se remplit trois mois,
 * puis plus personne ne la tient, et l'on se retrouve avec des étoiles qui
 * datent d'un an. Une notation calculée est toujours à jour, elle se rejoue sur
 * n'importe quelle période, et surtout **elle se conteste** : le transporteur à
 * qui l'on dit « vous facturez 7 % au-dessus de la grille » peut vérifier.
 *
 * **Ce que cela ne mesure pas, et qu'il faut assumer** : la ponctualité, l'état
 * des camions, la tenue des chauffeurs, la souplesse un jour de pointe. Ce sont
 * des jugements, ils demanderaient une saisie, et le métier n'a pas encore dit
 * qui la ferait ni à quelle occasion. La note porte donc sur ce qui se mesure,
 * et l'écran dit lesquelles des cinq dimensions ont pu être calculées.
 * ==========================================================================*/

import type { Ton } from "./libelles";

/* -- Les niveaux ---------------------------------------------------------------- */

export type NiveauTransporteur = "excellent" | "bon" | "acceptable" | "fragile" | "insuffisant";

export const NIVEAU_TRANSPORTEUR: Record<NiveauTransporteur, { libelle: string; seuil: number; ton: Ton; couleur: string; precision: string }> = {
  excellent: { libelle: "Excellent", seuil: 85, ton: "favorable", couleur: "var(--color-accent-tres-fonce)", precision: "Tient ses prix et ses tonnages, sur un écrit opposable" },
  bon: { libelle: "Bon", seuil: 70, ton: "favorable", couleur: "var(--color-accent)", precision: "Rien à redire sur la période" },
  acceptable: { libelle: "Acceptable", seuil: 55, ton: "vigilance", couleur: "var(--color-vigilance)", precision: "Un point à surveiller, sans gravité" },
  fragile: { libelle: "Fragile", seuil: 40, ton: "vigilance", couleur: "#c2700a", precision: "Deux dimensions faibles : à revoir avant la prochaine campagne" },
  insuffisant: { libelle: "Insuffisant", seuil: 0, ton: "defavorable", couleur: "var(--color-defavorable)", precision: "L'écart au prix ou au tonnage ne s'explique pas" },
};

/** Les niveaux du meilleur au moins bon — l'ordre d'affichage d'une légende. */
export const NIVEAUX: NiveauTransporteur[] = ["excellent", "bon", "acceptable", "fragile", "insuffisant"];

export function niveauDuScore(score: number): NiveauTransporteur {
  return NIVEAUX.find((n) => score >= NIVEAU_TRANSPORTEUR[n].seuil) ?? "insuffisant";
}

/* -- Les dimensions -------------------------------------------------------------- */

export type CleDimension = "prix" | "tonnage" | "assise" | "regularite" | "cout";

export const DIMENSION: Record<CleDimension, { libelle: string; poids: number; precision: string; source: string }> = {
  prix: {
    libelle: "Tenue du prix",
    poids: 30,
    precision: "L'écart moyen entre ce qui est facturé et ce que la grille prévoit, en valeur absolue : facturer en dessous n'est pas mieux, c'est un autre problème.",
    source: "Factures et grilles tarifaires",
  },
  tonnage: {
    libelle: "Fidélité du tonnage",
    poids: 25,
    precision: "L'écart entre le tonnage annoncé et le tonnage du pont bascule. C'est le contrôle que le relevé rend possible.",
    source: "Relevé de transport et pont bascule",
  },
  assise: {
    libelle: "Assise contractuelle",
    poids: 20,
    precision: "Y a-t-il un contrat signé, et une grille opposable ? Sans écrit, un écart se discute mais ne se conteste pas.",
    source: "Profil du transporteur et sources des grilles",
  },
  regularite: {
    libelle: "Régularité",
    poids: 15,
    precision: "La part des semaines où le transporteur a chargé. Un partenaire présent une semaine sur quatre ne se planifie pas.",
    source: "Relevé de transport",
  },
  cout: {
    libelle: "Coût à la tonne",
    poids: 10,
    precision: "Le coût rapporté aux tonnes portées, comparé à la médiane des transporteurs. Le moins cher n'est pas le meilleur, mais le plus cher doit s'expliquer.",
    source: "Coûts et relevé de transport",
  },
};

export const DIMENSIONS: CleDimension[] = ["prix", "tonnage", "assise", "regularite", "cout"];

/** En deçà, on ne publie pas de note : trop peu de matière pour juger. */
export const SEUIL_DIMENSIONS_NOTABLES = 3;

export interface ScoreDimension {
  cle: CleDimension;
  /** De 0 à 100 ; nul quand la dimension n'a pas pu être mesurée. */
  score: number | null;
  /** Ce qui a été mesuré, en clair : « +2,1 % d'écart moyen sur 18 missions ». */
  constat: string;
}

export interface NotationTransporteur {
  /** Nul quand aucune dimension n'a pu être mesurée : on ne note pas au hasard. */
  score: number | null;
  niveau: NiveauTransporteur | null;
  dimensions: ScoreDimension[];
  /** Les dimensions effectivement mesurées, sur cinq. */
  mesurees: number;
}

/* -- Le calcul ------------------------------------------------------------------- */

/** Ce qu'il faut savoir d'un transporteur pour le noter. */
export interface FaitsNotation {
  /** Écart moyen à la grille, en pourcentage signé ; nul si aucune mission tarifée. */
  ecartPrixMoyenPct: number | null;
  missionsTarifees: number;
  /** Écart moyen de pesée, en pourcentage signé ; nul si rien n'a été pesé. */
  ecartPeseeMoyenPct: number | null;
  chargementsPeses: number;
  sousContrat: boolean;
  /** Part des lignes de grille reposant sur un contrat signé, de 0 à 1 ; nulle sans grille. */
  partGrilleOpposable: number | null;
  /** Semaines où le transporteur a chargé, et semaines de la période. */
  semainesActives: number;
  semainesPeriode: number;
  coutParTonne: number | null;
  /** La médiane des transporteurs, pour situer sans juger sur un absolu. */
  medianeCoutParTonne: number | null;
}

/**
 * Une note de 0 à 100 par dimension, puis une moyenne **pondérée sur les seules
 * dimensions mesurées**. C'est le point délicat : un transporteur dont on n'a
 * pas pesé les chargements ne doit être ni avantagé ni pénalisé — sa note se
 * calcule sur les quatre autres, et l'écran dit qu'elle en vaut quatre.
 */
export function noter(f: FaitsNotation): NotationTransporteur {
  const dimensions: ScoreDimension[] = [
    { cle: "prix", ...noterPrix(f) },
    { cle: "tonnage", ...noterTonnage(f) },
    { cle: "assise", ...noterAssise(f) },
    { cle: "regularite", ...noterRegularite(f) },
    { cle: "cout", ...noterCout(f) },
  ];

  const mesurees = dimensions.filter((d) => d.score !== null);
  /*
   * **Trois dimensions au moins, sinon aucune note.** Un transporteur dont on
   * ne sait que l'absence de contrat obtenait « Insuffisant 0 » — ce qui le
   * déclarait mauvais alors qu'on ne l'avait pas mesuré. Une note qui ne repose
   * que sur ce qui manque juge le dossier, pas le transporteur.
   */
  if (mesurees.length < SEUIL_DIMENSIONS_NOTABLES) return { score: null, niveau: null, dimensions, mesurees: mesurees.length };

  const poidsTotal = mesurees.reduce((s, d) => s + DIMENSION[d.cle].poids, 0);
  const score = Math.round(mesurees.reduce((s, d) => s + d.score! * DIMENSION[d.cle].poids, 0) / poidsTotal);
  return { score, niveau: niveauDuScore(score), dimensions, mesurees: mesurees.length };
}

/** Cent points sans écart, zéro à dix pour cent d'écart — au-delà, plancher. */
function noterPrix(f: FaitsNotation): Omit<ScoreDimension, "cle"> {
  if (f.ecartPrixMoyenPct === null || f.missionsTarifees === 0) {
    return { score: null, constat: "Aucune mission rapprochée d'une grille" };
  }
  const ecart = Math.abs(f.ecartPrixMoyenPct);
  const score = Math.max(0, Math.round(100 - ecart * 10));
  const sens = f.ecartPrixMoyenPct > 0 ? "au-dessus" : f.ecartPrixMoyenPct < 0 ? "en dessous" : "à";
  return {
    score,
    constat: `${ecart === 0 ? "Au tarif" : `${nb(ecart)} % ${sens} de la grille`} · ${f.missionsTarifees} mission${f.missionsTarifees > 1 ? "s" : ""} rapprochée${f.missionsTarifees > 1 ? "s" : ""}`,
  };
}

/** Le pesage tolère peu : un pour cent d'écart coûte vingt points. */
function noterTonnage(f: FaitsNotation): Omit<ScoreDimension, "cle"> {
  if (f.ecartPeseeMoyenPct === null || f.chargementsPeses === 0) {
    return { score: null, constat: "Aucun chargement pesé au pont bascule" };
  }
  const ecart = Math.abs(f.ecartPeseeMoyenPct);
  return {
    score: Math.max(0, Math.round(100 - ecart * 20)),
    constat: `${nb(ecart)} % d'écart moyen à la pesée · ${f.chargementsPeses} chargement${f.chargementsPeses > 1 ? "s" : ""} pesé${f.chargementsPeses > 1 ? "s" : ""}`,
  };
}

/**
 * Le contrat vaut soixante points, la grille opposable quarante. Un
 * transporteur sans écrit ne peut donc pas dépasser « acceptable » sur cette
 * dimension — et c'est voulu : c'est la question 42 rendue visible sur chaque
 * fiche plutôt que rangée dans une note de bas de page.
 */
function noterAssise(f: FaitsNotation): Omit<ScoreDimension, "cle"> {
  const contrat = f.sousContrat ? 60 : 0;
  const grille = f.partGrilleOpposable === null ? 0 : Math.round(f.partGrilleOpposable * 40);
  const score = contrat + grille;
  const morceaux = [f.sousContrat ? "contrat signé" : "aucun contrat écrit"];
  if (f.partGrilleOpposable === null) morceaux.push("aucune grille");
  else morceaux.push(`${Math.round(f.partGrilleOpposable * 100)} % de la grille opposable`);
  return { score, constat: morceaux.join(" · ") };
}

function noterRegularite(f: FaitsNotation): Omit<ScoreDimension, "cle"> {
  if (f.semainesPeriode === 0) return { score: null, constat: "Période vide" };
  /* Absent du relevé n'est pas « irrégulier » : c'est « pas mesuré ». Un
     transporteur d'œufs payé au sac n'y figure pas, et lui donner zéro
     reviendrait à le juger sur un critère qui ne le concerne pas. */
  if (f.semainesActives === 0) return { score: null, constat: "Aucun chargement au relevé de transport" };
  const part = f.semainesActives / f.semainesPeriode;
  return {
    score: Math.round(Math.min(1, part * 1.25) * 100),
    constat: `${f.semainesActives} semaine${f.semainesActives > 1 ? "s" : ""} active${f.semainesActives > 1 ? "s" : ""} sur ${f.semainesPeriode}`,
  };
}

/**
 * Le coût se juge **par rapport aux autres**, jamais dans l'absolu : un tarif
 * dépend de la destination, et comparer Ziguinchor à Dakar ne dit rien. À la
 * médiane, cinquante points ; deux fois moins cher, cent ; deux fois plus, zéro.
 */
function noterCout(f: FaitsNotation): Omit<ScoreDimension, "cle"> {
  if (f.coutParTonne === null || f.medianeCoutParTonne === null || f.medianeCoutParTonne <= 0) {
    return { score: null, constat: "Aucune tonne portée, ou pas de médiane à comparer" };
  }
  const rapport = f.coutParTonne / f.medianeCoutParTonne;
  const score = Math.max(0, Math.min(100, Math.round(100 - (rapport - 0.5) * 100)));
  const ecart = Math.round((rapport - 1) * 100);
  return {
    score,
    constat: `${nb(f.coutParTonne, 0)} F la tonne · ${ecart === 0 ? "à la médiane" : `${ecart > 0 ? "+" : ""}${ecart} % vs médiane`}`,
  };
}

function nb(n: number, decimales = 1): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n);
}

/** La médiane d'une série — le repère du coût à la tonne. */
export function mediane(valeurs: number[]): number | null {
  const triees = valeurs.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (triees.length === 0) return null;
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 0 ? Math.round((triees[milieu - 1]! + triees[milieu]!) / 2) : triees[milieu]!;
}
