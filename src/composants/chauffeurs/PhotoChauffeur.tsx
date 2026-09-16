"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { televerserPhoto, urlPhoto } from "@/lib/photos";

/* ============================================================================
 * La photo d'un chauffeur — pour reconnaître la personne (0055).
 *
 * Même règle que la photo d'un véhicule : le fichier va au seau privé, la fiche
 * n'en garde que la référence, relue par une adresse signée. Sans photo, les
 * initiales sur le fond de la charte — ce que la fiche montrait déjà —, pour
 * qu'un cadre vide ne fasse pas croire à une fiche incomplète.
 *
 * Le dossier DO en tenait trente-neuf (« MALICK/PHOTO CHAUFFEURS », 16
 * septembre 2026) ; elles sont entrées par `attacher-photos-chauffeurs.mts`,
 * et celles qui manquent se prennent ici, d'un clic sur le rond.
 * ==========================================================================*/
export function PhotoChauffeur({ photo, initiales, nom, onChanger }: { photo: string | null; initiales: string; nom: string; onChanger?: (photo: string | null) => void }) {
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivant = true;
    void urlPhoto(photo).then((u) => {
      if (vivant) setUrl(u);
    });
    return () => {
      vivant = false;
    };
  }, [photo]);

  async function choisir(fichier: File | undefined) {
    if (!fichier || !onChanger) return;
    setErreur(null);
    setCharge(true);
    const r = await televerserPhoto(fichier, "chauffeurs");
    setCharge(false);
    if ("refus" in r) {
      setErreur(r.refus);
      return;
    }
    onChanger(r.ref);
  }

  return (
    <div className="group relative size-12 shrink-0 overflow-hidden rounded-full bg-accent-fond" title={erreur ?? undefined}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={nom} className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-[15px] font-semibold text-accent-tres-fonce">{initiales}</span>
      )}
      {onChanger ? (
        <>
          <input ref={champ} type="file" accept="image/*" className="sr-only" onChange={(e) => choisir(e.target.files?.[0])} aria-label={`Photo de ${nom}`} />
          <button
            type="button"
            onClick={() => champ.current?.click()}
            disabled={charge}
            title={url ? "Remplacer la photo" : "Ajouter une photo"}
            className="absolute inset-0 grid place-items-center bg-encre/45 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-100"
          >
            {charge ? <Loader2 className="size-4 animate-spin" strokeWidth={2} /> : <Camera className="size-4" strokeWidth={1.8} />}
            <span className="sr-only">{url ? `Remplacer la photo de ${nom}` : `Ajouter une photo de ${nom}`}</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
