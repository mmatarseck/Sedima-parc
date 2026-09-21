"use client";

import { ChampPhoto } from "@/composants/interface/ChampPhoto";

/* ============================================================================
 * Plusieurs pièces sur une même ligne : photos prises sur place, constat,
 * procès-verbal.
 *
 * Une déclaration d'incident en porte souvent plusieurs (métier, 21 septembre
 * 2026 : « possibilité de prendre des photos, entre autres »). Chaque pièce
 * déposée garde son cadre, qu'on retire d'un geste ; un cadre vide attend
 * toujours la suivante. Sur un téléphone, le cadre propose l'appareil photo
 * comme la galerie.
 * ==========================================================================*/

export function ChampPieces({ valeur, onChange, dossier = "documents", maximum = 8 }: { valeur: string[]; onChange: (refs: string[]) => void; dossier?: string; maximum?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {valeur.map((ref, i) => (
        <ChampPhoto key={ref} valeur={ref} dossier={dossier} compact precision="Retirer pour l'enlever" onChange={(r) => onChange(r ? valeur.map((x, j) => (j === i ? r : x)) : valeur.filter((_, j) => j !== i))} />
      ))}
      {valeur.length < maximum ? (
        <ChampPhoto key={`vide-${valeur.length}`} valeur={null} dossier={dossier} compact libelle={valeur.length ? "Une autre" : "Photo ou document"} precision="Facultatif" onChange={(r) => (r ? onChange([...valeur, r]) : undefined)} />
      ) : null}
    </div>
  );
}
