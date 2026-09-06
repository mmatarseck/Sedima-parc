"use client";

import { useState } from "react";
import { Check, ChevronDown, Columns3 } from "lucide-react";

/* ============================================================================
 * Choix des colonnes affichées — le bouton « Colonnes » et son panneau.
 *
 * Le même geste sur les listes de référentiel et sur les tableaux des fiches :
 * une case par colonne, un lien pour rétablir. Le composant ne décide de rien —
 * qui est visible, où c'est enregistré — il montre et remonte le clic.
 * ==========================================================================*/

export function ChoixColonnes({
  colonnes,
  visibles,
  onBasculer,
  onRetablir,
  libelleRetablir = "Rétablir les colonnes",
  note = "Les colonnes sont enregistrées pour votre compte.",
  compact,
}: {
  colonnes: { cle: string; libelle: string }[];
  visibles: string[];
  onBasculer: (cle: string) => void;
  onRetablir: () => void;
  libelleRetablir?: string;
  note?: string;
  /** Hauteur de 32 px, pour la barre d'outils d'une carte de fiche. */
  compact?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className={`bouton-secondaire ${compact ? "h-8 px-3 text-[12.5px]" : "h-9"}`}>
        <Columns3 className="size-4 text-texte-2" strokeWidth={1.7} />
        Colonnes
        <ChevronDown className="size-3.5 text-attenue" strokeWidth={1.8} />
      </button>

      {ouvert ? (
        <>
          <button type="button" aria-label="Fermer le choix des colonnes" onClick={() => setOuvert(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute top-full right-0 z-40 mt-2 w-[264px] rounded-[14px] border border-bordure bg-surface p-2 shadow-flottante">
            <p className="micro-sur-titre px-3 py-2">Colonnes affichées</p>
            <ul className="defilement-discret flex max-h-[320px] flex-col overflow-y-auto">
              {colonnes.map((c) => {
                const coche = visibles.includes(c.cle);
                return (
                  <li key={c.cle}>
                    <button type="button" onClick={() => onBasculer(c.cle)} className="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[13px] text-texte-2 hover:bg-surface-3 hover:text-texte">
                      <span className={`grid size-4 shrink-0 place-items-center rounded-[5px] border ${coche ? "border-accent bg-accent text-white" : "border-bordure-champ bg-surface"}`}>
                        {coche ? <Check className="size-3" strokeWidth={2.5} /> : null}
                      </span>
                      {c.libelle}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-1 border-t border-bordure pt-1.5">
              <button type="button" onClick={onRetablir} className="w-full rounded-[8px] px-3 py-1.5 text-left text-[12.5px] text-attenue hover:bg-surface-3 hover:text-texte">
                {libelleRetablir}
              </button>
            </div>
            <p className="meta mt-1 px-3 pb-1.5 text-[11.5px]">{note}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
