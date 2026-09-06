"use client";

import { useRef } from "react";
import { LARGEUR_MINIMALE } from "./preferences-liste";

/**
 * Poignée de redimensionnement, sur le bord droit d'un en-tête de colonne.
 *
 * Le glissement met à jour la largeur en direct ; le réglage n'est enregistré
 * qu'au relâchement, pour ne pas écrire dans le stockage à chaque pixel.
 * Les flèches du clavier ajustent par pas de 8 pixels : le redimensionnement
 * ne doit pas être réservé à la souris.
 */
export function PoigneeLargeur({
  largeur,
  onLargeur,
  onFin,
  libelle,
}: {
  largeur: number;
  onLargeur: (px: number) => void;
  onFin: () => void;
  libelle: string;
}) {
  const depart = useRef<{ x: number; largeur: number } | null>(null);

  function surPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    depart.current = { x: e.clientX, largeur };
    e.currentTarget.setPointerCapture(e.pointerId);
    /* `preventDefault` ne suffit pas : le glissement surligne le texte qu'il
       survole, et l'on termine avec une phrase en surbrillance derrière la
       colonne qu'on vient d'élargir. */
    document.body.style.userSelect = "none";
  }

  function surPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!depart.current) return;
    const suivante = depart.current.largeur + (e.clientX - depart.current.x);
    onLargeur(Math.max(LARGEUR_MINIMALE, Math.round(suivante)));
  }

  function surPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!depart.current) return;
    depart.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.userSelect = "";
    onFin();
  }

  function surClavier(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    onLargeur(Math.max(LARGEUR_MINIMALE, largeur + (e.key === "ArrowRight" ? 8 : -8)));
    onFin();
  }

  return (
    <button
      type="button"
      onPointerDown={surPointerDown}
      onPointerMove={surPointerMove}
      onPointerUp={surPointerUp}
      onKeyDown={surClavier}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Ajuster la largeur de la colonne ${libelle}`}
      title="Glisser pour ajuster la largeur"
      className="group absolute top-0 right-0 z-10 h-full w-2 translate-x-1/2 cursor-col-resize touch-none"
    >
      <span className="mx-auto block h-full w-px bg-transparent transition-colors group-hover:bg-accent group-focus-visible:bg-accent" />
    </button>
  );
}
