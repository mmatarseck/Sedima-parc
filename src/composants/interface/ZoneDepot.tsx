"use client";

import { useRef, useState } from "react";
import { FilePlus2, Loader2 } from "lucide-react";

/* ============================================================================
 * La zone de dépôt : un cadre pointillé, l'icône d'un fichier, « Glisser-
 * déposer les fichiers ici — ou cliquer pour choisir ».
 *
 * Métier, 21 septembre 2026, sur une capture de Fleetio : « s'inspirer de ça à
 * chaque fois qu'on doit attacher un document ou une photo ». Tous les champs
 * de pièces passent donc par ce cadre : le fichier se dépose depuis le bureau,
 * ou se choisit au clic — sur un téléphone, le clic propose l'appareil photo
 * comme la galerie.
 * ==========================================================================*/

export function ZoneDepot({
  onFichiers,
  multiple = false,
  accept = "image/*,application/pdf",
  chargement = false,
  erreur = null,
  compact = false,
  libelle = "Glisser-déposer les fichiers ici",
}: {
  onFichiers: (fichiers: File[]) => void;
  multiple?: boolean;
  accept?: string;
  chargement?: boolean;
  erreur?: string | null;
  compact?: boolean;
  libelle?: string;
}) {
  const [survol, setSurvol] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  function recus(liste: FileList | null | undefined) {
    const fichiers = [...(liste ?? [])];
    if (fichiers.length) onFichiers(multiple ? fichiers : fichiers.slice(0, 1));
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          recus(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer items-center justify-center gap-3 rounded-[10px] border border-dashed px-4 text-left transition-colors ${compact ? "min-h-14 py-2.5" : "min-h-[88px] py-4"} ${
          survol ? "border-accent bg-accent-fond" : erreur ? "border-defavorable bg-defavorable-fond" : "border-bordure-champ bg-surface-2 hover:border-accent-bordure"
        }`}
      >
        {chargement ? (
          <Loader2 className={`${compact ? "size-6" : "size-8"} shrink-0 animate-spin text-accent-fonce`} strokeWidth={1.6} />
        ) : (
          <FilePlus2 className={`${compact ? "size-7" : "size-9"} shrink-0 text-attenue`} strokeWidth={1.4} />
        )}
        <span className="min-w-0">
          <span className={`block font-semibold text-texte-2 ${compact ? "text-[12.5px]" : "text-[13.5px]"}`}>{chargement ? "Envoi en cours…" : libelle}</span>
          <span className="meta block">
            ou <span className="text-accent-fonce">cliquer pour choisir</span>
            {multiple ? " — plusieurs à la fois" : ""}
          </span>
        </span>
        <input
          ref={champ}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            recus(e.target.files);
            if (champ.current) champ.current.value = "";
          }}
        />
      </label>
      {erreur ? <p className="mt-1 text-[12px] text-defavorable">{erreur}</p> : null}
    </div>
  );
}
