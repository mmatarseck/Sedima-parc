"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Columns3, GripVertical, RotateCcw, Search, X } from "lucide-react";
import type { ColonneRapport } from "@/domaine/rapports";

/** La largeur de la liste, en pixels — celle de sa classe `w-[340px]`. */
const LARGEUR_LISTE = 340;

/* ============================================================================
 * Choix et **rangement** des colonnes d'un rapport.
 *
 * Demande du métier du 4 septembre 2026 : « on doit pouvoir ranger les
 * colonnes, par glisser-déposer ou du genre ». Un rapport en compte jusqu'à
 * quarante : l'ordre n'est pas un détail, c'est la lecture. On le règle donc
 * ici, à la souris — et **au clavier**, par Alt + flèches, parce qu'un
 * glisser-déposer seul exclut ceux qui n'utilisent pas la souris et se prête
 * mal aux écrans tactiles.
 *
 * Deux listes : les colonnes affichées, dans leur ordre, que l'on déplace ; les
 * colonnes disponibles, cherchables, que l'on ajoute. L'identifiant de la ligne
 * reste en tête et ne se retire pas — sans lui, on ne sait plus de quoi parle
 * la ligne.
 * ==========================================================================*/

export function ColonnesRapport({
  colonnes,
  visibles,
  identifiant,
  onChanger,
  onRetablir,
}: {
  colonnes: ColonneRapport[];
  /** Les clés visibles, dans l'ordre d'affichage. */
  visibles: string[];
  identifiant: string;
  onChanger: (visibles: string[]) => void;
  onRetablir: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  /* De quel côté la liste s'ouvre. Alignée à droite du bouton, elle passait
     sous le rail quand la barre d'outils se repliait et rejetait le bouton à
     gauche (9 septembre 2026) ; alignée à gauche, elle sortirait de l'écran
     quand le bouton est à droite. On mesure à l'ouverture. */
  const [versLaGauche, setVersLaGauche] = useState(false);
  const [terme, setTerme] = useState("");
  const [saisi, setSaisi] = useState<string | null>(null);
  const [survole, setSurvole] = useState<string | null>(null);
  const zone = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    function dehors(e: MouseEvent) {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    }
    function echap(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  const parCle = new Map(colonnes.map((c) => [c.cle, c]));
  const affichees = visibles.map((cle) => parCle.get(cle)).filter((c): c is ColonneRapport => Boolean(c));
  const disponibles = colonnes.filter((c) => !visibles.includes(c.cle));
  const cherchees = terme.trim()
    ? disponibles.filter((c) => `${c.libelle} ${c.precision ?? ""}`.toLowerCase().includes(terme.trim().toLowerCase()))
    : disponibles;

  function ajouter(cle: string) {
    onChanger([...visibles, cle]);
  }

  function retirer(cle: string) {
    if (cle === identifiant) return;
    onChanger(visibles.filter((c) => c !== cle));
  }

  /** Déplace une colonne devant une autre — le geste du glisser-déposer comme celui du clavier. */
  function deplacer(cle: string, versIndex: number) {
    if (cle === identifiant) return;
    const sans = visibles.filter((c) => c !== cle);
    /* L'identifiant garde la tête : on ne pose rien avant lui. */
    const minimum = sans[0] === identifiant ? 1 : 0;
    const cible = Math.max(minimum, Math.min(sans.length, versIndex));
    onChanger([...sans.slice(0, cible), cle, ...sans.slice(cible)]);
  }

  function surTouche(e: React.KeyboardEvent, cle: string, index: number) {
    if (!e.altKey) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      deplacer(cle, index - 1);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      deplacer(cle, index + 1);
    }
  }

  return (
    <div ref={zone} className="relative">
      <button
        type="button"
        onClick={() => {
          const rect = zone.current?.getBoundingClientRect();
          if (rect) setVersLaGauche(rect.left + LARGEUR_LISTE > window.innerWidth - 16);
          setOuvert((o) => !o);
        }}
        aria-expanded={ouvert}
        className="flex h-8 items-center gap-2 rounded-full border border-bordure-champ bg-surface px-3 text-[12.5px] font-medium text-texte hover:border-accent"
      >
        <Columns3 className="size-3.5 text-attenue" strokeWidth={1.9} />
        Colonnes
        <span className="badge-texte text-attenue">
          {visibles.length}/{colonnes.length}
        </span>
        <ChevronDown className={`size-3.5 text-attenue transition-transform ${ouvert ? "rotate-180" : ""}`} strokeWidth={2} />
      </button>

      {ouvert ? (
        <div role="dialog" aria-label="Choisir et ranger les colonnes" className={`absolute top-full z-50 mt-1.5 flex w-[340px] flex-col overflow-hidden rounded-[12px] border border-bordure bg-surface shadow-modale ${versLaGauche ? "right-0" : "left-0"}`}>
          {/* ---- Affichées, dans l'ordre ---- */}
          <p className="micro-sur-titre border-b border-bordure px-3.5 py-2">Affichées · glisser pour ranger</p>
          <ul className="defilement-discret max-h-[240px] overflow-y-auto py-1">
            {affichees.map((c, i) => {
              const figee = c.cle === identifiant;
              return (
                <li
                  key={c.cle}
                  draggable={!figee}
                  onDragStart={() => setSaisi(c.cle)}
                  onDragEnd={() => {
                    setSaisi(null);
                    setSurvole(null);
                  }}
                  onDragOver={(e) => {
                    if (!saisi || figee) return;
                    e.preventDefault();
                    setSurvole(c.cle);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (saisi) deplacer(saisi, i);
                    setSaisi(null);
                    setSurvole(null);
                  }}
                  className={`flex items-center gap-2 px-2 py-1 ${survole === c.cle && saisi !== c.cle ? "border-t-2 border-accent" : "border-t-2 border-transparent"} ${saisi === c.cle ? "opacity-40" : ""}`}
                >
                  <span
                    role={figee ? undefined : "button"}
                    tabIndex={figee ? -1 : 0}
                    onKeyDown={(e) => surTouche(e, c.cle, i)}
                    aria-label={figee ? undefined : `Déplacer ${c.libelle} — Alt et flèches`}
                    className={`grid size-6 shrink-0 place-items-center rounded ${figee ? "text-attenue-2" : "cursor-grab text-attenue hover:bg-surface-3 hover:text-texte-2 focus-visible:bg-surface-3"}`}
                  >
                    <GripVertical className="size-3.5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-texte">
                    {c.libelle}
                    {figee ? <span className="meta ml-1.5">identifiant</span> : null}
                  </span>
                  {figee ? null : (
                    <button type="button" onClick={() => retirer(c.cle)} aria-label={`Masquer ${c.libelle}`} className="grid size-6 shrink-0 place-items-center rounded-full text-attenue hover:bg-surface-3 hover:text-texte">
                      <X className="size-3.5" strokeWidth={2} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* ---- Disponibles ---- */}
          <div className="flex items-center gap-1.5 border-t border-bordure px-3 py-2">
            <Search className="size-3.5 shrink-0 text-attenue" strokeWidth={1.9} />
            <input
              value={terme}
              onChange={(e) => setTerme(e.target.value)}
              placeholder={`Ajouter une colonne — ${disponibles.length} disponibles`}
              aria-label="Chercher une colonne à ajouter"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-texte outline-none placeholder:text-attenue"
            />
          </div>
          <ul className="defilement-discret max-h-[190px] overflow-y-auto border-t border-bordure py-1">
            {cherchees.length === 0 ? (
              <li className="meta px-3.5 py-4 text-center">{disponibles.length === 0 ? "Toutes les colonnes sont affichées." : "Aucune colonne ne porte ce mot."}</li>
            ) : (
              cherchees.map((c) => (
                <li key={c.cle}>
                  <button type="button" onClick={() => ajouter(c.cle)} className="flex w-full items-baseline gap-2 px-3.5 py-1.5 text-left hover:bg-surface-3">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-texte">{c.libelle}</span>
                    {c.precision ? <span className="meta shrink-0">{c.precision}</span> : null}
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="flex items-center justify-between gap-2 border-t border-bordure bg-surface-2 px-3 py-2">
            <p className="meta">Enregistrées pour votre compte.</p>
            <button type="button" onClick={onRetablir} className="bouton-discret h-7">
              <RotateCcw className="size-3.5" strokeWidth={1.9} />
              Rétablir
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
