/* ============================================================================
 * Les événements d'un chauffeur (0066, métier du 22 septembre 2026 : « garder
 * sur un onglet la possibilité de créer des événements par chauffeur, où l'on
 * pourra renseigner les infos non automatiques — cas disciplinaires, etc. »).
 *
 * Ce que l'application ne peut pas déduire des faits du parc. Chaque nature
 * dit son effet sur l'indicateur « Discipline » du score : un événement
 * négatif compte comme une sanction, un positif en efface un, un neutre ne
 * fait que tracer.
 * ==========================================================================*/

export type NatureEvenement = "disciplinaire" | "retard-absence" | "plainte" | "felicitation" | "formation" | "autre";

export type EffetEvenement = "negatif" | "positif" | "neutre";

export const NATURE_EVENEMENT: Record<NatureEvenement, { libelle: string; effet: EffetEvenement }> = {
  disciplinaire: { libelle: "Cas disciplinaire", effet: "negatif" },
  "retard-absence": { libelle: "Retard ou absence injustifiée", effet: "negatif" },
  plainte: { libelle: "Plainte d'un client ou d'un tiers", effet: "negatif" },
  felicitation: { libelle: "Félicitation", effet: "positif" },
  formation: { libelle: "Formation suivie", effet: "positif" },
  autre: { libelle: "Autre", effet: "neutre" },
};

export const EFFET_EVENEMENT: Record<EffetEvenement, { libelle: string; ton: "defavorable" | "favorable" | "neutre" }> = {
  negatif: { libelle: "Pèse sur le score", ton: "defavorable" },
  positif: { libelle: "Compte en sa faveur", ton: "favorable" },
  neutre: { libelle: "Sans effet sur le score", ton: "neutre" },
};

export interface EvenementChauffeur {
  numero: string;
  date: string;
  nature: NatureEvenement;
  description: string;
  /** La pièce jointe — lettre, rapport, attestation —, dans le seau. */
  piece: string | null;
}

export function estNature(v: unknown): v is NatureEvenement {
  return typeof v === "string" && v in NATURE_EVENEMENT;
}
