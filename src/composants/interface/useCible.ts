"use client";

import { useEffect } from "react";

/**
 * Amène à l'écran la ligne d'une transaction ciblée par son numéro — celle que
 * la recherche a trouvée — et la souligne un instant. La ligne se reconnaît à
 * son attribut `data-numero` ; l'onglet en dépendance relance l'effet quand le
 * contenu change.
 */
export function useCible(numero: string | undefined, onglet: string): void {
  useEffect(() => {
    if (!numero) return;
    const t = setTimeout(() => {
      const ligne = document.querySelector<HTMLElement>(`[data-numero="${CSS.escape(numero)}"]`);
      if (!ligne) return;
      ligne.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
    return () => clearTimeout(t);
  }, [numero, onglet]);
}
