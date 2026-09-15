"use client";

/* Ne rend rien. Pose dans le navigateur les référentiels que le serveur a lus,
 * pour que les listes de choix des formulaires proposent le parc réel — et non,
 * comme avant le 15 septembre 2026, les véhicules et les chauffeurs du jeu de
 * démonstration, que l'écriture refusait ensuite faute de les retrouver.
 *
 * Posé **pendant le rendu**, avant que les écrans — rendus après, puisque
 * cadets — n'ouvrent une modale. Même geste que `AmorceParametres`, et
 * idempotent comme lui. */
import { poserReferentiels, type ReferentielsChoix } from "@/lib/referentiels-navigateur";

export function AmorceReferentiels({ referentiels }: { referentiels?: ReferentielsChoix }) {
  if (referentiels && typeof window !== "undefined") poserReferentiels(referentiels);
  return null;
}
