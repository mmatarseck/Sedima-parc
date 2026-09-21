"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Carte } from "@/composants/interface/Carte";
import { urlPhoto } from "@/lib/photos";

/* ============================================================================
 * Une pièce ouverte dans l'application : le cadre de droite.
 *
 * Tiré du dossier des pièces le 21 septembre 2026, quand le métier a demandé
 * que la facture d'une dépense s'ouvre « comme pour les documents » : au clic
 * sur la ligne, la liste se rétracte et la pièce se lit à droite, sans quitter
 * l'application. Le dossier du véhicule, celui du chauffeur et les listes de
 * dépenses montrent donc leurs pièces avec le même cadre.
 *
 * L'ADRESSE SE SIGNE À L'OUVERTURE, jamais au chargement : le seau est privé,
 * et signer trente pièces pour n'en regarder aucune serait trente appels pour
 * rien.
 * ==========================================================================*/

export function estImage(chemin: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(chemin);
}

export function VisionneusePiece({
  fichier,
  libelle,
  precision,
  actions,
  onFermer,
  vide = "Aucune pièce n'est attachée.",
  hauteur = "h-[70vh] min-h-[420px]",
}: {
  /** La référence de la pièce dans le seau ; nulle tant que rien n'est choisi. */
  fichier: string | null;
  libelle: string;
  precision?: string | null;
  /** Les gestes propres à l'appelant — « Retirer », « Modifier la ligne ». */
  actions?: ReactNode;
  /** Présent quand la pièce s'ouvre à côté d'une liste qui s'est rétractée : refermer lui rend sa largeur. */
  onFermer?: () => void;
  vide?: string;
  hauteur?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [etat, setEtat] = useState<"repos" | "signature" | "refus">("repos");

  useEffect(() => {
    if (!fichier) return;
    let vivant = true;
    setEtat("signature");
    setUrl(null);
    void urlPhoto(fichier).then((adresse) => {
      if (!vivant) return;
      setUrl(adresse);
      setEtat(adresse ? "repos" : "refus");
    });
    return () => {
      vivant = false;
    };
  }, [fichier]);

  return (
    <Carte
      titre={libelle}
      precision={precision ?? undefined}
      action={
        actions || onFermer ? (
          /* Aucun lien vers un onglet : la pièce se lit ici, et nulle part
             ailleurs (métier, 21 septembre 2026). */
          <span className="flex items-center gap-2">
            {actions}
            {onFermer ? (
              <button type="button" onClick={onFermer} className="bouton-discret size-9 justify-center p-0" title="Refermer la pièce" aria-label="Refermer la pièce">
                <X className="size-4" strokeWidth={1.8} />
              </button>
            ) : null}
          </span>
        ) : null
      }
      sansMarge
    >
      <div className={`mx-5 mb-5 overflow-hidden rounded-[12px] border border-bordure bg-surface-2 ${hauteur}`}>
        {!fichier ? (
          <p className="grid h-full place-items-center px-6 text-center text-[13px] leading-[1.5] text-texte-2">{vide}</p>
        ) : etat === "signature" ? (
          <p className="grid h-full place-items-center text-[13px] text-texte-2">Ouverture de la pièce…</p>
        ) : etat === "refus" || !url ? (
          /* Pièce illisible : le seau a refusé de signer, ou la ligne cite un
             fichier qui n'y est plus. On le dit — un cadre vide laisserait
             croire à un document blanc. */
          <p className="grid h-full place-items-center px-6 text-center text-[13px] leading-[1.5] text-texte-2">
            Cette pièce n&apos;a pas pu être ouverte. Le fichier a peut-être été retiré du dossier, ou la session n&apos;a plus le droit de le lire.
          </p>
        ) : estImage(fichier) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={libelle} className="h-full w-full object-contain" />
        ) : (
          <iframe src={url} title={libelle} className="h-full w-full" />
        )}
      </div>
    </Carte>
  );
}
