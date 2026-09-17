"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, Image as IconeImage, Plus, Trash2 } from "lucide-react";
import { Carte } from "@/composants/interface/Carte";
import type { PieceDossier } from "@/domaine/fiche";
import { date as formaterDate } from "@/lib/format";
import { urlPhoto } from "@/lib/photos";

/* ============================================================================
 * Un dossier de pièces : des familles à gauche, la pièce ouverte à droite.
 *
 * Né sur la fiche véhicule (cartes grises, assurances, procès-verbaux), il
 * sert au chauffeur depuis le 17 septembre 2026 — permis de conduire, visite
 * médicale — « comme celle des véhicules ». Le composant ne sait rien de ce
 * qu'il montre : chaque famille arrive avec ses pièces, son libellé, et le
 * geste qui dépose ; retirer est un geste rendu à qui l'appelle, parce que
 * c'est la ligne porteuse qui sait se vider.
 *
 * LES ADRESSES SE SIGNENT AU CLIC, jamais au chargement : le seau est privé,
 * et signer trente pièces pour n'en regarder aucune serait trente appels pour
 * rien.
 * ==========================================================================*/

export interface FamillePieces {
  cle: string;
  libelle: string;
  precision: string;
  pieces: PieceDossier[];
  /** Le geste qui dépose une pièce dans cette famille — absent en lecture seule. */
  deposer?: { libelle: string; onClick: () => void };
}

function estImage(chemin: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(chemin);
}

export function DossierPieces({ familles, onRetirer, vide = "Aucune pièce n'est attachée." }: { familles: FamillePieces[]; onRetirer?: (p: PieceDossier) => void; vide?: string }) {
  const toutes = familles.flatMap((f) => f.pieces);
  const [choisie, setChoisie] = useState<PieceDossier | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [etat, setEtat] = useState<"repos" | "signature" | "refus">("repos");

  /* La première pièce s'ouvre d'elle-même : un dossier qui s'ouvre vide
     demanderait un clic pour ne rien apprendre. */
  useEffect(() => {
    if (!choisie && toutes.length > 0) setChoisie(toutes[0]!);
  }, [toutes, choisie]);

  useEffect(() => {
    if (!choisie) return;
    let vivant = true;
    setEtat("signature");
    setUrl(null);
    void urlPhoto(choisie.fichier).then((adresse) => {
      if (!vivant) return;
      setUrl(adresse);
      setEtat(adresse ? "repos" : "refus");
    });
    return () => {
      vivant = false;
    };
  }, [choisie]);

  const retirable = choisie && onRetirer && choisie.type !== "licence";

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        {familles.map((famille) => (
          <Carte
            key={famille.cle}
            titre={`${famille.libelle} (${famille.pieces.length})`}
            precision={famille.precision}
            action={
              famille.deposer ? (
                <button type="button" onClick={famille.deposer.onClick} className="bouton-discret h-8 px-2 text-[12px]" title={`${famille.deposer.libelle} — la pièce se joint sur la ligne qui la porte`}>
                  <Plus className="size-3.5" strokeWidth={2} />
                  Déposer
                </button>
              ) : undefined
            }
            sansMarge
          >
            {famille.pieces.length === 0 ? (
              <p className="px-5 pb-4 text-[12.5px] text-texte-2">Aucune pièce{famille.deposer ? " — « Déposer » ouvre la ligne qui la portera." : "."}</p>
            ) : (
              <ul className="flex flex-col gap-1 px-3 pb-3">
                {famille.pieces.map((p) => {
                  const active = choisie?.numero === p.numero && choisie.fichier === p.fichier;
                  return (
                    <li key={`${p.numero}-${p.fichier}`}>
                      <button
                        type="button"
                        onClick={() => setChoisie(p)}
                        aria-current={active}
                        className={`flex w-full items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors ${active ? "bg-accent-fond text-accent-tres-fonce" : "hover:bg-surface-3"}`}
                      >
                        {estImage(p.fichier) ? <IconeImage className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.8} /> : <FileText className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.8} />}
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">{p.libelle}</span>
                          <span className="meta block truncate">{[p.date ? formaterDate(p.date) : null, p.precision].filter(Boolean).join(" · ")}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Carte>
        ))}
      </div>

      <Carte
        titre={choisie?.libelle ?? "Pièce"}
        precision={choisie ? [choisie.date ? formaterDate(choisie.date) : null, choisie.precision].filter(Boolean).join(" · ") : "Choisissez une pièce dans une famille, ou déposez-en une"}
        action={
          choisie ? (
            <span className="flex items-center gap-2">
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="bouton-secondaire h-9">
                  <ExternalLink className="size-4 text-texte-2" strokeWidth={1.7} />
                  Ouvrir dans un onglet
                </a>
              ) : null}
              {retirable ? (
                <button type="button" onClick={() => onRetirer(choisie)} className="bouton-secondaire h-9 text-defavorable" title="Retire le fichier de la ligne ; la ligne reste">
                  <Trash2 className="size-4" strokeWidth={1.7} />
                  Retirer
                </button>
              ) : null}
            </span>
          ) : null
        }
        sansMarge
      >
        <div className="mx-5 mb-5 h-[70vh] min-h-[420px] overflow-hidden rounded-[12px] border border-bordure bg-surface-2">
          {!choisie ? (
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
          ) : estImage(choisie.fichier) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={choisie.libelle} className="h-full w-full object-contain" />
          ) : (
            <iframe src={url} title={choisie.libelle} className="h-full w-full" />
          )}
        </div>
      </Carte>
    </div>
  );
}
