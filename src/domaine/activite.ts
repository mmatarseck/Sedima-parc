/* ============================================================================
 * Le suivi de l'activité des utilisateurs (0078).
 *
 * Métier, 3 octobre 2026 : « prévoir dans les paramètres un suivi de
 * l'activité des différentes personnes pour voir qui utilise réellement
 * l'application et comment ».
 *
 * Un écran se note sans ses identifiants : « /flotte/AA032EA » et
 * « /flotte/AB078JS » sont le même écran, la fiche d'un véhicule. On garde
 * donc le chemin, ses segments variables remplacés par « […] » — de quoi dire
 * quels modules servent, sans tenir un relevé de ce que chacun regarde.
 * ==========================================================================*/

/** Les modules, tels que le rail les nomme. */
export const MODULE_ACTIVITE: Record<string, string> = {
  "": "Tableau de bord",
  flotte: "Flotte",
  disponibilite: "Disponibilité",
  affectations: "Affectations",
  maintenance: "Maintenance",
  pieces: "Pièces",
  carburant: "Carburant",
  caisse: "Caisse",
  demandes: "Demandes d'achat",
  couts: "Coûts",
  budget: "Budget",
  conformite: "Conformité",
  incidents: "Incidents",
  chauffeurs: "Chauffeurs",
  attributaires: "Parc léger",
  prestataires: "Prestataires",
  transporteurs: "Transporteurs",
  transferts: "Transferts",
  rapports: "Rapports",
  clotures: "Clôtures",
  parametres: "Paramètres",
  profil: "Mon profil",
  telephone: "Téléphone",
};

/** Un segment qui désigne une chose plutôt qu'un écran : une plaque, un numéro, un identifiant. */
function estVariable(segment: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
    /\d/.test(segment) ||
    /^[A-Z0-9-]{5,}$/.test(segment)
  );
}

/** « /flotte/AA032EA?onglet=entretien » se note « /flotte/[…] ». */
export function cheminActivite(chemin: string): string {
  const sansRequete = chemin.split(/[?#]/)[0] ?? "/";
  const segments = sansRequete.split("/").filter(Boolean).map((s) => (estVariable(s) ? "[…]" : s));
  return `/${segments.join("/")}`.slice(0, 120);
}

/** Le module d'un écran noté : « /flotte/[…] » relève de la Flotte ; le téléphone, de ce qu'on y fait. */
export function moduleActivite(chemin: string): string {
  const segments = chemin.split("/").filter(Boolean);
  if (segments[0] === "telephone") return segments[1] ? `Téléphone · ${MODULE_ACTIVITE[segments[1]] ?? segments[1]}` : "Téléphone · accueil";
  return MODULE_ACTIVITE[segments[0] ?? ""] ?? segments[0] ?? "Tableau de bord";
}

/** Les écrans d'une personne, rangés par module, du plus consulté au moins. */
export function modulesDe(ecrans: { chemin: string; vues: number }[]): { module: string; vues: number }[] {
  const m = new Map<string, number>();
  for (const e of ecrans) m.set(moduleActivite(e.chemin), (m.get(moduleActivite(e.chemin)) ?? 0) + e.vues);
  return [...m].map(([module, vues]) => ({ module, vues })).sort((a, b) => b.vues - a.vues || a.module.localeCompare(b.module, "fr"));
}

export interface LigneActivite {
  utilisateurId: string;
  nom: string;
  role: string;
  actif: boolean;
  courriel: string | null;
  derniereConnexion: string | null;
  derniereActivite: string | null;
  joursActifs: number;
  vues: number;
  vuesTelephone: number;
  saisies: number;
  modifications: number;
  ecrans: { chemin: string; vues: number }[];
}

export type NiveauUsage = "regulier" | "occasionnel" | "inactif" | "jamais";

/**
 * Ce que l'activité dit de l'usage, sur une période de `jours` jours : un
 * usage régulier, c'est au moins un jour sur trois ; occasionnel, au moins un
 * jour ; inactif, un compte qui s'est déjà connecté mais rien sur la période ;
 * jamais, un compte qui ne s'est jamais connecté.
 */
export function niveauUsage(l: Pick<LigneActivite, "joursActifs" | "derniereConnexion" | "saisies">, jours: number): NiveauUsage {
  if (l.joursActifs >= Math.max(1, Math.round(jours / 3))) return "regulier";
  if (l.joursActifs > 0 || l.saisies > 0) return "occasionnel";
  return l.derniereConnexion ? "inactif" : "jamais";
}

export const NIVEAU_USAGE: Record<NiveauUsage, { libelle: string; ton: "favorable" | "vigilance" | "defavorable" | "neutre"; rang: number }> = {
  regulier: { libelle: "Régulier", ton: "favorable", rang: 0 },
  occasionnel: { libelle: "Occasionnel", ton: "vigilance", rang: 1 },
  inactif: { libelle: "Inactif sur la période", ton: "defavorable", rang: 2 },
  jamais: { libelle: "Jamais connecté", ton: "neutre", rang: 3 },
};
