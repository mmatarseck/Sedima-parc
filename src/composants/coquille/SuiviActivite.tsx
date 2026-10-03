"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cheminActivite } from "@/domaine/activite";
import { clientNavigateur } from "@/lib/supabase";

/* ============================================================================
 * Le suivi de l'activité (0078) : chaque écran ouvert se note une fois, pour
 * le compte connecté, sans ses identifiants (« /flotte/[…] »). Un compteur
 * agrégé par jour et par écran, que Paramètres › Activité des utilisateurs lit.
 *
 * Une visite qui ne se note pas — base sans 0078, réseau coupé — ne gêne
 * personne : l'appel n'attend rien et n'affiche rien. Le même écran rouvert
 * dans les cinq secondes (un double rendu, un retour arrière) ne compte qu'une
 * fois.
 * ==========================================================================*/

export function SuiviActivite() {
  const chemin = usePathname();
  const dernier = useRef<{ chemin: string; quand: number } | null>(null);

  useEffect(() => {
    if (!chemin) return;
    const ecran = cheminActivite(chemin);
    const maintenant = Date.now();
    if (dernier.current && dernier.current.chemin === ecran && maintenant - dernier.current.quand < 5_000) return;
    dernier.current = { chemin: ecran, quand: maintenant };
    /* Le téléphone : ses écrans, ou un petit écran sur les autres. */
    const appareil = ecran.startsWith("/telephone") || (typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches) ? "telephone" : "bureau";
    try {
      void clientNavigateur()
        .rpc("noter_visite", { chemin: ecran, appareil })
        .then(() => undefined, () => undefined);
    } catch {
      /* Supabase non configuré : rien à noter. */
    }
  }, [chemin]);

  return null;
}
