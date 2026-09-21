"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText } from "lucide-react";
import { VisionneusePiece } from "@/composants/interface/VisionneusePiece";

/**
 * Montre une pièce du seau, **dans l'application** : un cadre par-dessus
 * l'écran, qui se referme d'un clic ou d'Échap. Il ouvrait la pièce dans un
 * onglet du navigateur ; le métier ne veut plus de fichier qui s'ouvre hors
 * plateforme (21 septembre 2026).
 *
 * L'adresse se signe à l'ouverture, jamais au chargement : une liste de sept
 * cents demandes d'achat ne doit pas signer sept cents adresses pour n'en
 * ouvrir aucune.
 */
export function OuvrirPiece({ fichier, libelle = "Voir", titre = "Voir la pièce" }: { fichier: string; libelle?: string; titre?: string }) {
  const [ouverte, setOuverte] = useState(false);

  useEffect(() => {
    if (!ouverte) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuverte(false);
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouverte]);

  return (
    <>
      <button
        type="button"
        title={titre}
        onClick={(e) => {
          e.stopPropagation();
          setOuverte(true);
        }}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent-fonce hover:underline"
      >
        <FileText className="size-3.5" strokeWidth={1.8} />
        {libelle}
      </button>
      {ouverte
        ? createPortal(
            /* Hors de la ligne qui l'appelle : un clic dans le cadre ne doit pas remonter jusqu'à elle. */
            <div onClick={(e) => e.stopPropagation()}>
              <button type="button" aria-label="Fermer" onClick={() => setOuverte(false)} className="fixed inset-0 z-50 cursor-default bg-encre/30" />
              <div role="dialog" aria-modal="true" aria-label={titre} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="pointer-events-auto w-full max-w-[980px]" style={{ animation: "apparition 160ms ease-out" }}>
                  <VisionneusePiece fichier={fichier} libelle={titre} onFermer={() => setOuverte(false)} hauteur="h-[78vh] min-h-[420px]" />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
