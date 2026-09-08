"use client";

import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";
import { photoAffichable, urlPhoto } from "@/lib/photos";

/**
 * Une photo jointe, à voir : la vignette, et l'image entière au toucher. Une
 * référence qui n'est qu'un nom d'avant le stockage se montre comme telle.
 */
export function PhotoJointe({ reference, taille = 40, libelle = "Photo" }: { reference: string | null | undefined; taille?: number; libelle?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState(false);
  useEffect(() => {
    let vivant = true;
    void urlPhoto(reference).then((u) => {
      if (vivant) setUrl(u);
    });
    return () => {
      vivant = false;
    };
  }, [reference]);

  if (!reference) return <span className="text-attenue-2">—</span>;
  if (!photoAffichable(reference) || !url) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-texte-2" title={reference}>
        <Camera className="size-3.5" strokeWidth={1.8} />
        {photoAffichable(reference) ? "photo" : "jointe"}
      </span>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOuverte(true)} className="inline-block overflow-hidden rounded-[8px] border border-bordure align-middle" title={`${libelle} — agrandir`} style={{ width: taille, height: taille }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={libelle} className="size-full object-cover" />
      </button>
      {ouverte ? (
        <>
          <button type="button" aria-label="Fermer" onClick={() => setOuverte(false)} className="fixed inset-0 z-50 cursor-default bg-encre/80" />
          <div role="dialog" aria-modal="true" aria-label={libelle} className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={libelle} className="pointer-events-auto max-h-[90vh] max-w-[95vw] rounded-[12px] object-contain shadow-flottante" />
            <button type="button" onClick={() => setOuverte(false)} aria-label="Fermer" className="pointer-events-auto absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-surface text-texte shadow-flottante">
              <X className="size-5" strokeWidth={2} />
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
