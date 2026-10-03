"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { estTelephone } from "@/domaine/appareil";

/* ============================================================================
 * « Prendre une photo » — l'appareil photo du téléphone, en un geste.
 *
 * Métier, 2 octobre 2026 : « dans l'app mobile, donner la possibilité de
 * prendre une photo pour les pièces justificatives, pour les différents
 * formulaires (carburant, incident, accident, autres dépenses…) ».
 *
 * La zone de dépôt ouvre le choix du fichier ; sur certains téléphones, il
 * faut alors chercher l'appareil photo dans un menu. Ce bouton l'ouvre
 * directement (`capture="environment"`, l'objectif arrière), et la zone reste
 * à côté pour un fichier déjà sur l'appareil — c'est pour cela que `capture`
 * avait quitté la zone le 15 septembre 2026. Au bureau, il ne s'affiche pas :
 * un ordinateur n'a pas d'appareil à ouvrir.
 * ==========================================================================*/

export function BoutonAppareilPhoto({ onPhoto, chargement = false, compact = false }: { onPhoto: (fichier: File) => void; chargement?: boolean; compact?: boolean }) {
  const [telephone, setTelephone] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => setTelephone(estTelephone(navigator.userAgent)), []);
  if (!telephone) return null;

  return (
    <label className={`bouton-principal w-full cursor-pointer justify-center ${compact ? "h-9 text-[12.5px]" : "h-11 text-[13.5px]"} ${chargement ? "pointer-events-none opacity-60" : ""}`}>
      <Camera className="size-4" strokeWidth={2} />
      {chargement ? "Envoi en cours…" : "Prendre une photo"}
      <input
        ref={champ}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const fichier = e.target.files?.[0];
          if (fichier) onPhoto(fichier);
          if (champ.current) champ.current.value = "";
        }}
      />
    </label>
  );
}
