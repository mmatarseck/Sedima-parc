"use client";

import { useRef, useState } from "react";
import { Bus, Camera, Car, Caravan, Loader2, Bike, Tractor, Truck, Wrench, X } from "lucide-react";
import type { CategorieVehicule } from "@/domaine/types";

/* ============================================================================
 * La photo d'un véhicule — pour le reconnaître d'un coup d'œil.
 *
 * Demande du métier du 4 septembre 2026 : « la photo du véhicule pour service
 * d'identification visuelle ». Sur un parc où trois TATA LPT1618TC se
 * ressemblent, une immatriculation ne suffit pas à savoir de quel camion on
 * parle — surtout pour un agent qui va le chercher sur un site.
 *
 * **Sans photo, un repli qui identifie quand même** : la silhouette de la
 * catégorie sur le fond de la charte. Un cadre vide serait pire que rien, car
 * il donnerait à croire que la fiche est incomplète alors que la plupart des
 * véhicules n'auront jamais de photo.
 *
 * **Le téléversement redimensionne avant d'enregistrer** : une photo de
 * téléphone pèse trois mégaoctets, et le stockage du navigateur en tient cinq
 * en tout. On ramène donc à 480 pixels de large en JPEG — largement assez pour
 * reconnaître un camion, et deux cents fois plus léger. En production, le
 * fichier ira dans un seau de stockage et la fiche n'en gardera que l'adresse ;
 * c'est pourquoi la valeur enregistrée est toujours **une adresse**, que ce soit
 * une URL ou une image en ligne.
 * ==========================================================================*/

const SILHOUETTE: Record<CategorieVehicule, typeof Truck> = {
  camion: Truck,
  tracteur: Tractor,
  "semi-remorque": Caravan,
  camionnette: Truck,
  "vehicule-leger": Car,
  bus: Bus,
  moto: Bike,
  engin: Wrench,
};

/** Largeur retenue : au-delà, on stocke du détail que personne ne regarde. */
const LARGEUR_MAX = 480;

/** Redimensionne et compresse le fichier choisi, et rend une image en ligne. */
async function versImageEnLigne(fichier: File): Promise<string> {
  const source = await createImageBitmap(fichier);
  const echelle = Math.min(1, LARGEUR_MAX / source.width);
  const largeur = Math.round(source.width * echelle);
  const hauteur = Math.round(source.height * echelle);
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const contexte = toile.getContext("2d");
  if (!contexte) throw new Error("Contexte 2D indisponible");
  contexte.drawImage(source, 0, 0, largeur, hauteur);
  source.close();
  return toile.toDataURL("image/jpeg", 0.72);
}

export function PhotoVehicule({
  photo,
  categorie,
  immatriculation,
  taille = "fiche",
  onChanger,
}: {
  photo: string | null;
  categorie: CategorieVehicule;
  immatriculation: string;
  /** « fiche » : le cadre de l'en-tête. « vignette » : dans une liste. */
  taille?: "fiche" | "vignette";
  /** Absent en lecture seule — la liste, par exemple. */
  onChanger?: (photo: string | null) => void;
}) {
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  const Silhouette = SILHOUETTE[categorie] ?? Truck;

  const dimensions = taille === "fiche" ? "h-[74px] w-[110px]" : "h-9 w-14";

  async function choisir(fichier: File | undefined) {
    if (!fichier || !onChanger) return;
    setErreur(null);
    setCharge(true);
    try {
      onChanger(await versImageEnLigne(fichier));
    } catch {
      setErreur("Image illisible");
    } finally {
      setCharge(false);
    }
  }

  return (
    <div className={`group relative shrink-0 overflow-hidden rounded-[10px] border border-bordure bg-surface-2 ${dimensions}`}>
      {photo ? (
        /* Une image de fiche, pas une illustration décorative : le texte de
           remplacement porte l'immatriculation, seule chose qui identifie. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={`Véhicule ${immatriculation}`} className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-attenue-2" title={`Aucune photo — ${immatriculation}`}>
          <Silhouette className={taille === "fiche" ? "size-7" : "size-4"} strokeWidth={1.4} />
        </span>
      )}

      {onChanger ? (
        <>
          <input ref={champ} type="file" accept="image/*" className="sr-only" onChange={(e) => choisir(e.target.files?.[0])} aria-label={`Photo de ${immatriculation}`} />
          <button
            type="button"
            onClick={() => champ.current?.click()}
            disabled={charge}
            title={photo ? "Remplacer la photo" : "Ajouter une photo"}
            className="absolute inset-0 grid place-items-center bg-encre/45 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-100"
          >
            {charge ? <Loader2 className="size-4 animate-spin" strokeWidth={2} /> : <Camera className="size-4" strokeWidth={1.8} />}
            <span className="sr-only">{photo ? "Remplacer la photo" : "Ajouter une photo"}</span>
          </button>
          {photo ? (
            <button
              type="button"
              onClick={() => onChanger(null)}
              title="Retirer la photo"
              className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-encre/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <X className="size-3" strokeWidth={2.4} />
              <span className="sr-only">Retirer la photo</span>
            </button>
          ) : null}
        </>
      ) : null}

      {erreur ? <span className="absolute inset-x-0 bottom-0 bg-defavorable px-1 py-0.5 text-center text-[10px] font-medium text-white">{erreur}</span> : null}
    </div>
  );
}
