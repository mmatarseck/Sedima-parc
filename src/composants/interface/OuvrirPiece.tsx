"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { urlPhoto } from "@/lib/photos";

/**
 * Ouvre une pièce du seau dans un onglet. L'adresse se signe au clic, jamais
 * au chargement : une liste de sept cents demandes d'achat ne doit pas signer
 * sept cents adresses pour n'en ouvrir aucune.
 */
export function OuvrirPiece({ fichier, libelle = "Ouvrir", titre = "Ouvrir la pièce" }: { fichier: string; libelle?: string; titre?: string }) {
  const [ouverture, setOuverture] = useState(false);
  return (
    <button
      type="button"
      disabled={ouverture}
      title={titre}
      onClick={async (e) => {
        e.stopPropagation();
        setOuverture(true);
        const url = await urlPhoto(fichier);
        setOuverture(false);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      }}
      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent-fonce hover:underline disabled:text-attenue"
    >
      <FileText className="size-3.5" strokeWidth={1.8} />
      {libelle}
    </button>
  );
}
