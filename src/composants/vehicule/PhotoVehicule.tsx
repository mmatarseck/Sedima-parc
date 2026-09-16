"use client";

import { useEffect, useRef, useState } from "react";
import { Bus, Camera, Car, Caravan, Loader2, Bike, Maximize2, Tractor, Truck, Wrench, X } from "lucide-react";
import type { CategorieVehicule } from "@/domaine/types";
import { televerserPhoto, urlPhoto } from "@/lib/photos";

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
 * **La photo va au stockage, la fiche n'en garde que la référence** (corrigé
 * le 9 septembre 2026, nuit). Elle portait jusque-là l'image entière dans sa
 * valeur, en JPEG de 480 px transcrit en toutes lettres : une quarantaine de
 * milliers de caractères écrits dans la colonne du véhicule, relus par chaque
 * liste, et recopiés avant *et* après dans le journal des modifications à
 * chaque changement. Le fichier part donc dans le seau privé comme toute
 * pièce justificative (`televerserPhoto`, dossier « vehicules »), et la fiche
 * garde une référence de soixante caractères, relue par une adresse signée.
 *
 * Une valeur d'avant reste lisible : une image portée dans la valeur, comme
 * une adresse saisie à la main dans le champ « Photo (adresse) », s'affiche
 * telle quelle.
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

export function PhotoVehicule({
  photo,
  categorie,
  immatriculation,
  taille = "fiche",
  onChanger,
}: {
  /** La référence gardée sur la fiche, pas l'image : elle se relit par `urlPhoto`. */
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
  const [url, setUrl] = useState<string | null>(null);
  const [agrandie, setAgrandie] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  const Silhouette = SILHOUETTE[categorie] ?? Truck;

  const dimensions = taille === "fiche" ? "h-[74px] w-[110px]" : "h-9 w-14";

  /* La référence devient une adresse à afficher. Dans une liste, les demandes
     du même instant sont signées en un seul aller-retour (`urlPhoto`). */
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
    const r = await televerserPhoto(fichier, "vehicules");
    setCharge(false);
    if ("refus" in r) {
      setErreur(r.refus);
      return;
    }
    onChanger(r.ref);
  }

  return (
    <>
    <div className={`group relative shrink-0 overflow-hidden rounded-[10px] border border-bordure bg-surface-2 ${dimensions}`}>
      {url ? (
        /* Une image de fiche, pas une illustration décorative : le texte de
           remplacement porte l'immatriculation, seule chose qui identifie. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Véhicule ${immatriculation}`} className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-attenue-2" title={`Aucune photo — ${immatriculation}`}>
          <Silhouette className={taille === "fiche" ? "size-7" : "size-4"} strokeWidth={1.4} />
        </span>
      )}

      {onChanger ? (
        <>
          <input ref={champ} type="file" accept="image/*" className="sr-only" onChange={(e) => choisir(e.target.files?.[0])} aria-label={`Photo de ${immatriculation}`} />
          {/* Une photo qui existe s'ouvre d'abord en grand : c'est ce qu'on
              vient y chercher — reconnaître le camion. La remplacer vient
              ensuite, dans l'agrandissement. Un cadre vide, lui, n'a rien à
              montrer : il ouvre directement le sélecteur de fichier. */}
          <button
            type="button"
            onClick={() => (url ? setAgrandie(true) : champ.current?.click())}
            disabled={charge}
            title={url ? "Voir la photo en grand" : "Ajouter une photo"}
            className="absolute inset-0 grid place-items-center bg-encre/45 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-100"
          >
            {charge ? <Loader2 className="size-4 animate-spin" strokeWidth={2} /> : url ? <Maximize2 className="size-4" strokeWidth={1.8} /> : <Camera className="size-4" strokeWidth={1.8} />}
            <span className="sr-only">{url ? `Voir la photo de ${immatriculation} en grand` : "Ajouter une photo"}</span>
          </button>
        </>
      ) : null}

      {erreur ? (
        <span title={erreur} className="absolute inset-x-0 bottom-0 block truncate bg-defavorable px-1 py-0.5 text-center text-[10px] font-medium text-white">
          {erreur}
        </span>
      ) : null}

    </div>
    {/* Hors du cadre, qui est en `overflow-hidden` et ne mesure que 110 px. */}
    {agrandie && url && onChanger ? (
      <Agrandissement
        url={url}
        sujet={immatriculation}
        alt={`Véhicule ${immatriculation}`}
        charge={charge}
        onRemplacer={() => champ.current?.click()}
        onRetirer={() => {
          setAgrandie(false);
          onChanger(null);
        }}
        onFermer={() => setAgrandie(false)}
      />
    ) : null}
    </>
  );
}

/**
 * La photo en grand, sur le voile sombre habituel des modales. Les deux actions
 * y sont écrites en toutes lettres plutôt qu'en icônes au survol : on n'y arrive
 * que délibérément, et retirer une photo ne doit pas se faire d'un frôlement.
 */
export function Agrandissement({
  url,
  sujet,
  alt,
  charge,
  onRemplacer,
  onRetirer,
  onFermer,
}: {
  url: string;
  /** Ce que le titre nomme : une immatriculation, le nom d'une personne. */
  sujet: string;
  alt: string;
  charge: boolean;
  onRemplacer: () => void;
  onRetirer: () => void;
  onFermer: () => void;
}) {
  useEffect(() => {
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("keydown", surEchap);
    return () => document.removeEventListener("keydown", surEchap);
  }, [onFermer]);

  return (
    <>
      <button type="button" aria-label="Fermer" onClick={onFermer} className="fixed inset-0 z-50 cursor-default bg-encre/70" />
      <div role="dialog" aria-modal="true" aria-label={`Photo de ${sujet}`} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="pointer-events-auto flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[16px] border border-bordure bg-surface shadow-modale" style={{ animation: "apparition 160ms ease-out" }}>
          <div className="flex items-center gap-3 border-b border-bordure px-5 py-3">
            <h2 className="titre-bloc min-w-0 flex-1 truncate">
              Photo · <span className="code">{sujet}</span>
            </h2>
            <button type="button" onClick={onFermer} aria-label="Fermer" className="grid size-7 shrink-0 place-items-center rounded-[8px] text-attenue hover:bg-surface-3 hover:text-texte">
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
          <div className="min-h-0 flex-1 bg-surface-2 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={alt} className="mx-auto max-h-[62vh] w-auto rounded-[10px] object-contain" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 border-t border-bordure px-5 py-3">
            <p className="meta min-w-0 flex-1">Remplacer ou retirer la photo se trace comme toute modification de la fiche.</p>
            <button type="button" onClick={onRetirer} className="bouton-discret text-defavorable">
              Retirer la photo
            </button>
            <button type="button" onClick={onRemplacer} disabled={charge} className="bouton-secondaire">
              {charge ? <Loader2 className="size-4 animate-spin" strokeWidth={2} /> : <Camera className="size-4 text-texte-2" strokeWidth={1.7} />}
              Remplacer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
