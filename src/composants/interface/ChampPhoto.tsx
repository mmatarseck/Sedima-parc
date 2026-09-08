"use client";

import { useEffect, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { televerserPhoto, urlPhoto } from "@/lib/photos";

/**
 * Le champ « photo » : prendre ou choisir une image, qui part aussitôt vers
 * le stockage ; la valeur est la référence à garder sur la ligne. La vignette
 * montre ce qui est joint ; la croix retire. Le même champ sert à la modale
 * de transaction, à la réponse d'une demande et aux réserves d'un transfert.
 */
export function ChampPhoto({ valeur, onChange, dossier, libelle = "Prendre la photo", precision = "Obligatoire", compact = false }: { valeur: string | null; onChange: (ref: string | null) => void; dossier: string; libelle?: string; precision?: string; compact?: boolean }) {
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  useEffect(() => {
    let vivant = true;
    void urlPhoto(valeur).then((u) => {
      if (vivant) setApercu(u);
    });
    return () => {
      vivant = false;
    };
  }, [valeur]);

  async function choisir(fichier: File | undefined) {
    if (!fichier) return;
    setChargement(true);
    setErreur(null);
    const r = await televerserPhoto(fichier, dossier);
    setChargement(false);
    if ("refus" in r) {
      setErreur(r.refus);
      return;
    }
    onChange(r.ref);
  }

  return (
    <div className={compact ? "" : "flex flex-col gap-1.5"}>
      <label className={`flex cursor-pointer items-center gap-3 rounded-[12px] border px-3 ${compact ? "h-9 py-0" : "py-3"} ${valeur ? "border-accent-bordure bg-accent-fond" : erreur ? "border-defavorable bg-defavorable-fond" : "border-dashed border-bordure-champ bg-surface-2"}`}>
        {apercu ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={apercu} alt="" className={`${compact ? "size-7" : "size-12"} shrink-0 rounded-[8px] object-cover`} />
        ) : chargement ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-accent-fonce" strokeWidth={1.8} />
        ) : (
          <Camera className={`size-5 shrink-0 ${valeur ? "text-accent-tres-fonce" : erreur ? "text-defavorable" : "text-attenue"}`} strokeWidth={1.8} />
        )}
        <span className="min-w-0 flex-1">
          <span className={`block ${compact ? "text-[12.5px]" : "text-[13px]"} font-semibold text-texte`}>{chargement ? "Envoi de la photo…" : valeur ? "Photo jointe" : libelle}</span>
          {!compact ? <span className="meta block truncate">{erreur ?? (valeur ? "Touchez pour la remplacer" : precision)}</span> : null}
        </span>
        {valeur ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onChange(null);
            }}
            aria-label="Retirer la photo"
            className="grid size-7 shrink-0 place-items-center rounded-full text-texte-2 hover:bg-surface-3"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        ) : null}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void choisir(e.target.files?.[0])} />
      </label>
      {compact && erreur ? <p className="mt-1 text-[12px] text-defavorable">{erreur}</p> : null}
    </div>
  );
}
