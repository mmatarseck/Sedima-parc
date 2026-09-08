"use client";

import { useEffect, useState } from "react";
import { Printer, QrCode as IconeQr, X } from "lucide-react";
import { QrCode } from "@/composants/interface/QrCode";
import { urlVehicule } from "@/lib/qr";

/**
 * Le QR code d'un véhicule, à voir et à imprimer. Le bouton ouvre un panneau
 * avec le code, l'adresse qu'il porte, et le PDF de l'étiquette à coller.
 */
export function BoutonQr({ immatriculation, immatriculationAffichee, libelle, compact }: { immatriculation: string; immatriculationAffichee: string; libelle: string; compact?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [origine, setOrigine] = useState("");
  useEffect(() => setOrigine(window.location.origin), []);
  const url = urlVehicule(origine || "https://parc.sedima.sn", immatriculation);
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={compact ? "grid size-9 place-items-center rounded-full text-texte-2 hover:bg-surface-3" : "bouton-secondaire"} title="QR code du véhicule">
        <IconeQr className={compact ? "size-5" : "size-4 text-texte-2"} strokeWidth={1.7} />
        {compact ? <span className="sr-only">QR code</span> : "QR code"}
      </button>
      {ouvert ? (
        <>
          <button type="button" aria-label="Fermer" onClick={() => setOuvert(false)} className="fixed inset-0 z-50 cursor-default bg-encre/35" />
          <div role="dialog" aria-modal="true" aria-labelledby="qr-titre" className="fixed top-1/2 left-1/2 z-50 w-[min(360px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[18px] bg-surface p-5 shadow-flottante">
            <div className="flex items-center gap-2">
              <h2 id="qr-titre" className="min-w-0 flex-1 text-[16px] font-bold text-texte">
                QR code · <span className="code">{immatriculationAffichee}</span>
              </h2>
              <button type="button" onClick={() => setOuvert(false)} aria-label="Fermer" className="grid size-8 place-items-center rounded-full text-texte-2 hover:bg-surface-3">
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>
            <div className="mt-3 flex flex-col items-center gap-2 rounded-[12px] border border-bordure bg-white p-4">
              <QrCode texte={url} taille={200} libelle={`QR code de ${immatriculationAffichee}`} />
              <span className="code text-[20px] font-bold tracking-[0.04em] text-encre">{immatriculationAffichee}</span>
              <span className="text-[11px] text-attenue">{libelle}</span>
            </div>
            <p className="meta mt-3 break-all">{url}</p>
            <p className="meta mt-1">Scanné avec l&apos;appareil photo du téléphone, il ouvre la fiche rapide du véhicule pour y prendre une action.</p>
            <a href={`/flotte/etiquettes/qr.pdf?immat=${immatriculation}`} target="_blank" rel="noopener" className="bouton-principal mt-4 h-10 w-full justify-center">
              <Printer className="size-4" strokeWidth={2} />
              Étiquette à imprimer (PDF)
            </a>
          </div>
        </>
      ) : null}
    </>
  );
}
