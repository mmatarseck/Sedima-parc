"use client";

import { useLayoutEffect } from "react";
import type { Role } from "@/domaine/roles";
import { ecrireIdentite, ouvrirSession } from "@/lib/session-demo";

/**
 * Ne rend rien : pose dans le navigateur le rôle et l'identité que le serveur
 * a résolus, avant que les écrans ne les lisent. Rendue par la mise en page de
 * l'application, en tête de ses enfants — les effets de mise en page d'un
 * aîné courent avant les effets ordinaires de ses cadets, donc `lireRole()`
 * trouve la valeur au premier passage.
 *
 * En démonstration, la mise en page ne la rend pas : le rôle reste celui que
 * la page de garde a fait choisir.
 */
export function AmorceSession({ role, nom, courriel }: { role: Role; nom: string; courriel: string | null }) {
  useLayoutEffect(() => {
    ouvrirSession(role);
    ecrireIdentite({ nom, courriel });
  }, [role, nom, courriel]);
  return null;
}
