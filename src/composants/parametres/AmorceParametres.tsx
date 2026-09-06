"use client";

/* Ne rend rien. Importer parametres-demo dans la coquille suffit, en
 * démonstration, à charger les libellés des documents dans le navigateur avant
 * le premier rendu, pour que les pages nomment les documents ajoutés par le
 * métier comme le serveur.
 *
 * Base branchée, la mise en page passe ce que le serveur a lu : posé ici
 * **pendant le rendu**, avant que les écrans — rendus après, puisque cadets —
 * ne lisent `lireParametres()` dans leurs initialisations d'état. Le geste
 * est idempotent, et c'est celui que le module fait déjà à son chargement. */
import { poserParametres } from "@/lib/parametres-demo";
import type { Parametres } from "@/domaine/parametres";

export function AmorceParametres({ parametres }: { parametres?: Parametres }) {
  if (parametres && typeof window !== "undefined") poserParametres(parametres);
  return null;
}
