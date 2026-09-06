/* ============================================================================
 * Périodes — la fenêtre de temps d'un rapport.
 *
 * Demande du métier du 4 septembre 2026 : choisir la date « de façon plus fine
 * — jour, mois, année, trimestre, période prédéfinie ». Une liste de mois ne
 * suffit pas : on veut « hier », « ce trimestre », « l'an dernier », ou deux
 * dates posées à la main.
 *
 * Une période se résout toujours en **deux dates incluses** (`debut`, `fin`).
 * Les rapports qui listent des faits datés comparent la date de la ligne à cet
 * intervalle ; ceux qui agrègent par mois travaillent sur les **mois couverts**
 * par l'intervalle — un mois entamé compte, parce qu'un coût de mars reste un
 * coût de mars même si l'on n'en regarde que la première quinzaine.
 *
 * Le préréglage est conservé, pas seulement les dates qu'il donne : « ce mois-ci »
 * doit rester « ce mois-ci » demain, et un rapport enregistré avec ce réglage se
 * rouvre sur le mois courant, pas sur celui où on l'a enregistré.
 * ==========================================================================*/

export type PresetPeriode =
  | "aujourdhui"
  | "hier"
  | "7-jours"
  | "30-jours"
  | "90-jours"
  | "mois-en-cours"
  | "mois-dernier"
  | "trimestre-en-cours"
  | "trimestre-dernier"
  | "annee-en-cours"
  | "annee-derniere"
  | "12-mois"
  | "24-mois"
  | "tout"
  | "personnalisee";

export const PRESET_PERIODE: Record<PresetPeriode, string> = {
  aujourdhui: "Aujourd'hui",
  hier: "Hier",
  "7-jours": "7 derniers jours",
  "30-jours": "30 derniers jours",
  "90-jours": "90 derniers jours",
  "mois-en-cours": "Ce mois-ci",
  "mois-dernier": "Le mois dernier",
  "trimestre-en-cours": "Ce trimestre",
  "trimestre-dernier": "Le trimestre dernier",
  "annee-en-cours": "Cette année",
  "annee-derniere": "L'année dernière",
  "12-mois": "12 derniers mois",
  "24-mois": "24 derniers mois",
  tout: "Tout l'historique",
  personnalisee: "Période personnalisée",
};

/** L'ordre du sélecteur : du plus court au plus long, le personnalisé en dernier. */
export const PRESETS_ORDONNES: PresetPeriode[] = [
  "aujourdhui",
  "hier",
  "7-jours",
  "30-jours",
  "90-jours",
  "mois-en-cours",
  "mois-dernier",
  "trimestre-en-cours",
  "trimestre-dernier",
  "annee-en-cours",
  "annee-derniere",
  "12-mois",
  "24-mois",
  "tout",
  "personnalisee",
];

export interface Periode {
  preset: PresetPeriode;
  /** Posées à la main quand le préréglage est « personnalisee » ; ignorées sinon. */
  debut: string | null;
  fin: string | null;
}

export const PERIODE_PAR_DEFAUT: Periode = { preset: "12-mois", debut: null, fin: null };

/** Le plus loin où l'application remonte : avant, il n'y a pas de données. */
const ORIGINE = "2000-01-01";

function jour(iso: string): Date {
  const [a, m, j] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, j!));
}

function texte(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function decalerJours(iso: string, jours: number): string {
  const d = jour(iso);
  d.setUTCDate(d.getUTCDate() + jours);
  return texte(d);
}

function premierDuMois(iso: string, decalageMois = 0): string {
  const d = jour(iso);
  return texte(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + decalageMois, 1)));
}

function dernierDuMois(iso: string, decalageMois = 0): string {
  const d = jour(iso);
  return texte(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + decalageMois + 1, 0)));
}

function premierDuTrimestre(iso: string, decalageTrimestres = 0): string {
  const d = jour(iso);
  const trimestre = Math.floor(d.getUTCMonth() / 3) + decalageTrimestres;
  return texte(new Date(Date.UTC(d.getUTCFullYear(), trimestre * 3, 1)));
}

function dernierDuTrimestre(iso: string, decalageTrimestres = 0): string {
  const d = jour(iso);
  const trimestre = Math.floor(d.getUTCMonth() / 3) + decalageTrimestres;
  return texte(new Date(Date.UTC(d.getUTCFullYear(), trimestre * 3 + 3, 0)));
}

export interface PeriodeResolue {
  debut: string;
  fin: string;
  /** « Ce trimestre · 01/07/2026 → 30/09/2026 » se compose à l'affichage ; ici, le nom seul. */
  libelle: string;
  preset: PresetPeriode;
}

/**
 * Les deux dates d'une période, à la date du jour donnée. Une période
 * personnalisée sans dates retombe sur les douze derniers mois plutôt que de
 * ne rien renvoyer : un rapport vide par accident de saisie se lit comme un
 * rapport sans données, et fait croire à une erreur.
 */
export function resoudrePeriode(p: Periode, aujourdhui: string): PeriodeResolue {
  const nommer = (debut: string, fin: string, preset: PresetPeriode = p.preset): PeriodeResolue => ({ debut, fin, libelle: PRESET_PERIODE[preset], preset });
  switch (p.preset) {
    case "aujourdhui":
      return nommer(aujourdhui, aujourdhui);
    case "hier":
      return nommer(decalerJours(aujourdhui, -1), decalerJours(aujourdhui, -1));
    case "7-jours":
      return nommer(decalerJours(aujourdhui, -6), aujourdhui);
    case "30-jours":
      return nommer(decalerJours(aujourdhui, -29), aujourdhui);
    case "90-jours":
      return nommer(decalerJours(aujourdhui, -89), aujourdhui);
    case "mois-en-cours":
      return nommer(premierDuMois(aujourdhui), aujourdhui);
    case "mois-dernier":
      return nommer(premierDuMois(aujourdhui, -1), dernierDuMois(aujourdhui, -1));
    case "trimestre-en-cours":
      return nommer(premierDuTrimestre(aujourdhui), aujourdhui);
    case "trimestre-dernier":
      return nommer(premierDuTrimestre(aujourdhui, -1), dernierDuTrimestre(aujourdhui, -1));
    case "annee-en-cours":
      return nommer(`${aujourdhui.slice(0, 4)}-01-01`, aujourdhui);
    case "annee-derniere": {
      const an = Number(aujourdhui.slice(0, 4)) - 1;
      return nommer(`${an}-01-01`, `${an}-12-31`);
    }
    case "24-mois":
      return nommer(premierDuMois(aujourdhui, -23), aujourdhui);
    case "tout":
      return nommer(ORIGINE, aujourdhui);
    case "personnalisee": {
      if (!p.debut || !p.fin) return nommer(premierDuMois(aujourdhui, -11), aujourdhui, "12-mois");
      const [debut, fin] = p.debut <= p.fin ? [p.debut, p.fin] : [p.fin, p.debut];
      return { debut, fin, libelle: PRESET_PERIODE.personnalisee, preset: "personnalisee" };
    }
    case "12-mois":
    default:
      return nommer(premierDuMois(aujourdhui, -11), aujourdhui, "12-mois");
  }
}

/** Les mois « AAAA-MM » que la période touche, même d'un seul jour, du plus ancien au plus récent. */
export function moisCouverts(debut: string, fin: string): string[] {
  const liste: string[] = [];
  let courant = jour(premierDuMois(debut));
  const borne = jour(premierDuMois(fin));
  /* Garde-fou : « Tout l'historique » remonte à 2000, on ne parcourt pas
     mille mois pour rien. Vingt-cinq ans suffisent largement au parc. */
  for (let i = 0; courant <= borne && i < 400; i++) {
    liste.push(texte(courant).slice(0, 7));
    courant = new Date(Date.UTC(courant.getUTCFullYear(), courant.getUTCMonth() + 1, 1));
  }
  return liste;
}

/** Vrai si la date — « 2026-03-14 » ou un horodatage — tombe dans la période. */
export function dansLaPeriode(date: string | null | undefined, debut: string, fin: string): boolean {
  if (!date) return false;
  const j = date.slice(0, 10);
  return j >= debut && j <= fin;
}

/** La période lue dans l'adresse. */
export function periodeDeLAdresse(lire: (cle: string) => string | null): Periode {
  const preset = lire("periode");
  const connu = (PRESETS_ORDONNES as string[]).includes(preset ?? "") ? (preset as PresetPeriode) : PERIODE_PAR_DEFAUT.preset;
  return { preset: connu, debut: lire("du"), fin: lire("au") };
}
