"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ListFilter, Search, X } from "lucide-react";
import { estFacette, texteDe, type ColonneRapport, type LigneRapport } from "@/domaine/rapports";
import { nombre } from "@/lib/format";
import type { Facettes } from "./reglages";

/* ============================================================================
 * Filtres d'un rapport — une facette par colonne, ses valeurs par les données.
 *
 * Demande du métier du 4 septembre 2026 : « mettre le max de filtres
 * possibles ». Plutôt qu'une liste de filtres écrite à la main pour chaque
 * rapport — toujours incomplète, toujours en retard sur les colonnes —, chaque
 * colonne de vocabulaire fermé **est** un filtre, et les valeurs proposées sont
 * celles réellement présentes, avec leur nombre de lignes. On ne filtre donc
 * jamais sur rien, et un rapport qui gagne une colonne gagne un filtre.
 *
 * Une facette retient plusieurs valeurs : « Camion **ou** Tracteur » est la
 * question qu'on se pose, pas « Camion » seul. Entre deux facettes, en
 * revanche, les conditions s'ajoutent — « Camion, à Keur Massar ».
 *
 * Le comptage se fait sur les lignes déjà filtrées par les **autres** facettes :
 * un choix ne se retire pas lui-même de la liste, sans quoi on ne pourrait plus
 * en cocher un second.
 * ==========================================================================*/

export function appliquerFacettes(lignes: LigneRapport[], facettes: Facettes): LigneRapport[] {
  const posees = Object.entries(facettes).filter(([, v]) => v.length > 0);
  if (posees.length === 0) return lignes;
  return lignes.filter((l) => posees.every(([cle, valeurs]) => valeurs.includes(texteDe(l[cle] ?? null) || "—")));
}

function valeursDe(lignes: LigneRapport[], cle: string): Map<string, number> {
  const compte = new Map<string, number>();
  for (const l of lignes) {
    const v = texteDe(l[cle] ?? null) || "—";
    compte.set(v, (compte.get(v) ?? 0) + 1);
  }
  return compte;
}

function Facette({
  colonne,
  valeurs,
  choisies,
  onChanger,
}: {
  colonne: ColonneRapport;
  valeurs: Map<string, number>;
  choisies: string[];
  onChanger: (valeurs: string[]) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [terme, setTerme] = useState("");
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

  const liste = [...valeurs.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
  const cherchees = terme.trim() ? liste.filter(([v]) => v.toLowerCase().includes(terme.trim().toLowerCase())) : liste;
  const actif = choisies.length > 0;

  function basculer(v: string) {
    onChanger(choisies.includes(v) ? choisies.filter((x) => x !== v) : [...choisies, v]);
  }

  return (
    <div ref={zone} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className={`flex h-8 max-w-[240px] items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors ${
          actif ? "border-accent bg-accent-fond font-semibold text-accent-fonce" : "border-bordure-champ bg-surface font-medium text-texte-2 hover:border-accent hover:text-texte"
        }`}
      >
        <span className="truncate">{colonne.libelle}</span>
        {actif ? <span className="shrink-0 truncate">· {choisies.length === 1 ? choisies[0] : `${choisies.length} choix`}</span> : null}
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${ouvert ? "rotate-180" : ""}`} strokeWidth={2} />
      </button>

      {ouvert ? (
        <div role="dialog" aria-label={`Filtrer sur ${colonne.libelle}`} className="absolute top-full left-0 z-40 mt-1.5 w-[260px] overflow-hidden rounded-[12px] border border-bordure bg-surface shadow-modale">
          {liste.length > 8 ? (
            <div className="flex items-center gap-1.5 border-b border-bordure px-3 py-2">
              <Search className="size-3.5 shrink-0 text-attenue" strokeWidth={1.9} />
              <input value={terme} onChange={(e) => setTerme(e.target.value)} placeholder="Chercher…" aria-label="Chercher une valeur" className="min-w-0 flex-1 bg-transparent text-[12.5px] text-texte outline-none placeholder:text-attenue" />
            </div>
          ) : null}
          <ul className="defilement-discret max-h-[280px] overflow-y-auto py-1">
            {cherchees.map(([v, n]) => {
              const coche = choisies.includes(v);
              return (
                <li key={v}>
                  <button type="button" onClick={() => basculer(v)} aria-pressed={coche} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-3">
                    <span className={`grid size-4 shrink-0 place-items-center rounded-[4px] border ${coche ? "border-accent bg-accent text-white" : "border-bordure-champ"}`}>
                      {coche ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-texte">{v}</span>
                    <span className="meta shrink-0">{nombre(n)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {actif ? (
            <div className="border-t border-bordure bg-surface-2 px-3 py-2">
              <button type="button" onClick={() => onChanger([])} className="bouton-discret h-7">
                <X className="size-3.5" strokeWidth={2} />
                Ne plus filtrer sur {colonne.libelle.toLowerCase()}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function FiltresRapport({
  colonnes,
  lignes,
  facettes,
  onChanger,
}: {
  colonnes: ColonneRapport[];
  /** Toutes les lignes du rapport, avant facettes. */
  lignes: LigneRapport[];
  facettes: Facettes;
  onChanger: (f: Facettes) => void;
}) {
  const [toutes, setToutes] = useState(false);
  const candidates = useMemo(() => colonnes.filter(estFacette), [colonnes]);

  /* Une facette n'est offerte que si elle discrimine : au moins deux valeurs
     distinctes. Un filtre à un seul choix ne filtre rien et encombre la barre. */
  const utiles = useMemo(
    () =>
      candidates
        .map((c) => ({ colonne: c, valeurs: valeursDe(lignes, c.cle) }))
        .filter((x) => x.valeurs.size > 1 || facettes[x.colonne.cle]?.length),
    [candidates, lignes, facettes],
  );

  const posees = Object.entries(facettes).filter(([, v]) => v.length > 0);
  /* Les facettes posées d'abord, puis les plus discriminantes — celles qui
     partagent le rapport en groupes lisibles plutôt qu'en poussière. */
  const ordonnees = [...utiles].sort((a, b) => {
    const pa = facettes[a.colonne.cle]?.length ? 0 : 1;
    const pb = facettes[b.colonne.cle]?.length ? 0 : 1;
    return pa - pb || a.valeurs.size - b.valeurs.size;
  });
  const VISIBLES = 6;
  const montrees = toutes ? ordonnees : ordonnees.slice(0, VISIBLES);

  if (utiles.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {montrees.map(({ colonne }) => (
        <Facette
          key={colonne.cle}
          colonne={colonne}
          /* Le comptage ignore la facette elle-même : cocher « Camion » ne doit
             pas faire disparaître « Tracteur » de la liste. */
          valeurs={valeursDe(appliquerFacettes(lignes, Object.fromEntries(Object.entries(facettes).filter(([k]) => k !== colonne.cle))), colonne.cle)}
          choisies={facettes[colonne.cle] ?? []}
          onChanger={(v) => onChanger({ ...facettes, [colonne.cle]: v })}
        />
      ))}

      {ordonnees.length > VISIBLES ? (
        <button type="button" onClick={() => setToutes((t) => !t)} className="bouton-discret h-8">
          <ListFilter className="size-3.5" strokeWidth={1.9} />
          {toutes ? "Moins de filtres" : `${ordonnees.length - VISIBLES} filtres de plus`}
        </button>
      ) : null}

      {posees.length > 0 ? (
        <button type="button" onClick={() => onChanger({})} className="bouton-discret h-8 text-defavorable">
          <X className="size-3.5" strokeWidth={2} />
          Tout effacer
        </button>
      ) : null}
    </div>
  );
}
