"use client";

import { useEffect, useState } from "react";
import { FileText, Image as IconeImage, Plus, Trash2 } from "lucide-react";
import { Carte } from "@/composants/interface/Carte";
import { VisionneusePiece, estImage } from "@/composants/interface/VisionneusePiece";
import type { PieceDossier } from "@/domaine/fiche";
import { date as formaterDate } from "@/lib/format";

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
 * Le cadre de droite est `VisionneusePiece`, que les listes de dépenses
 * partagent : une pièce s'ouvre de la même façon partout, et son adresse ne se
 * signe qu'à l'ouverture.
 * ==========================================================================*/

export interface FamillePieces {
  cle: string;
  libelle: string;
  precision: string;
  pieces: PieceDossier[];
  /** Le geste qui dépose une pièce dans cette famille — absent en lecture seule. */
  deposer?: { libelle: string; onClick: () => void };
}

export function DossierPieces({ familles, onRetirer, vide = "Aucune pièce n'est attachée." }: { familles: FamillePieces[]; onRetirer?: (p: PieceDossier) => void; vide?: string }) {
  const toutes = familles.flatMap((f) => f.pieces);
  const [choisie, setChoisie] = useState<PieceDossier | null>(null);

  /* La première pièce s'ouvre d'elle-même : un dossier qui s'ouvre vide
     demanderait un clic pour ne rien apprendre. */
  useEffect(() => {
    if (!choisie && toutes.length > 0) setChoisie(toutes[0]!);
  }, [toutes, choisie]);

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

      <VisionneusePiece
        fichier={choisie?.fichier ?? null}
        libelle={choisie?.libelle ?? "Pièce"}
        precision={choisie ? [choisie.date ? formaterDate(choisie.date) : null, choisie.precision].filter(Boolean).join(" · ") : "Choisissez une pièce dans une famille, ou déposez-en une"}
        vide={vide}
        actions={
          retirable ? (
            <button type="button" onClick={() => onRetirer(choisie)} className="bouton-secondaire h-9 text-defavorable" title="Retire le fichier de la ligne ; la ligne reste">
              <Trash2 className="size-4" strokeWidth={1.7} />
              Retirer
            </button>
          ) : null
        }
      />
    </div>
  );
}
