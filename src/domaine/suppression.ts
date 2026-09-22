import type { TypeTransaction } from "./reference";

/* ============================================================================
 * Ce qui se supprime depuis l'application (métier, 21 septembre 2026 :
 * « possibilité de supprimer une panne créée, un service créé ou autre —
 * garder la trace dans le journal »). Les référentiels — véhicules,
 * chauffeurs, prestataires, pièces, tâches, budget — ne se suppriment pas
 * d'ici : d'autres lignes les citent.
 *
 * La trace d'une suppression porte la plaque entre crochets, « [AA350JN] » :
 * c'est ainsi que le journal du véhicule la retrouve.
 * ==========================================================================*/

export const TYPES_SUPPRIMABLES: ReadonlySet<TypeTransaction> = new Set<TypeTransaction>(["signalement", "ordre", "intervention", "depense", "plein", "incident", "releve", "document", "rappel", "visite", "observation", "affectation", "attelage", "indisponibilite", "caisse", "cuve", "achat", "livraison", "evenement"]);

export function estSupprimable(type: TypeTransaction): boolean {
  return TYPES_SUPPRIMABLES.has(type);
}

/** Le résumé gardé par la trace : « Panne SIG-2026-90001 · test · [AA350JN] ». */
export function resumeSuppression(libelleType: string, numero: string, description: string, immatriculation: string | null): string {
  return [`${libelleType} ${numero}`, description.trim() || null, immatriculation ? `[${immatriculation}]` : null].filter(Boolean).join(" · ");
}

/** La plaque que porte le résumé d'une suppression, s'il en porte une. */
export function plaqueDuResume(resume: string | null): string | null {
  return /\[([A-Z0-9]+)\]/.exec(resume ?? "")?.[1] ?? null;
}
