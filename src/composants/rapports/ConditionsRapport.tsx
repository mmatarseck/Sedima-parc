"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import type { ColonneRapport } from "@/domaine/rapports";
import { OPERATEURS, conditionValide, conditionsDe, libelleCondition, poserCondition, retirerCondition, type Condition, type Operateur } from "./conditions";
import type { Facettes } from "./reglages";

/* ============================================================================
 * Les conditions chiffrées, dans la barre des filtres.
 *
 * Chaque condition posée est une pastille — « Kilométrage supérieur à
 * 150 000 km » — qu'un clic rouvre pour la corriger et que la croix retire.
 * « Condition » en ajoute une : la colonne, l'opérateur, la ou les bornes.
 * ==========================================================================*/

function Editeur({
  colonnes,
  depart,
  onValider,
  onFermer,
}: {
  colonnes: ColonneRapport[];
  depart: Condition;
  onValider: (c: Condition) => void;
  onFermer: () => void;
}) {
  const [c, setC] = useState<Condition>(depart);
  const zone = useRef<HTMLDivElement>(null);
  const colonne = colonnes.find((x) => x.cle === c.cle) ?? colonnes[0]!;
  const date = colonne.type === "date";
  const valide = conditionValide(c, colonne.type);

  useEffect(() => {
    function dehors(e: MouseEvent) {
      if (zone.current && !zone.current.contains(e.target as Node)) onFermer();
    }
    function echap(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [onFermer]);

  const champ = "h-8 w-full rounded-[8px] border border-bordure-champ bg-surface px-2.5 text-[12.5px] text-texte outline-none focus:border-accent";

  /* Changer de colonne entre chiffres et dates vide les bornes : « 150000 » n'est pas une date. */
  function choisirColonne(cle: string) {
    const nouvelle = colonnes.find((x) => x.cle === cle);
    const memeGenre = nouvelle && (nouvelle.type === "date") === date;
    setC({ ...c, cle, a: memeGenre ? c.a : "", b: memeGenre ? c.b : "" });
  }

  return (
    <div ref={zone} role="dialog" aria-label="Condition sur une colonne" className="absolute top-full left-0 z-40 mt-1.5 w-[300px] rounded-[12px] border border-bordure bg-surface p-3 shadow-modale">
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valide) onValider(c);
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="label-champ">Colonne</span>
          <select value={colonne.cle} onChange={(e) => choisirColonne(e.target.value)} className={champ}>
            {colonnes.map((x) => (
              <option key={x.cle} value={x.cle}>
                {x.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-champ">Condition</span>
          <select value={c.operateur} onChange={(e) => setC({ ...c, operateur: e.target.value as Operateur })} className={champ}>
            {(Object.keys(OPERATEURS) as Operateur[]).map((op) => (
              <option key={op} value={op}>
                {OPERATEURS[op][date ? "date" : "nombre"]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type={date ? "date" : "text"}
            inputMode={date ? undefined : "decimal"}
            value={c.a}
            onChange={(e) => setC({ ...c, a: e.target.value })}
            placeholder={date ? undefined : "150 000"}
            aria-label="Valeur"
            className={champ}
          />
          {c.operateur === "entre" ? (
            <>
              <span className="meta shrink-0">et</span>
              <input type={date ? "date" : "text"} inputMode={date ? undefined : "decimal"} value={c.b} onChange={(e) => setC({ ...c, b: e.target.value })} aria-label="Seconde valeur" className={champ} />
            </>
          ) : null}
        </div>
        {colonne.precision ? <p className="meta">{colonne.precision}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFermer} className="bouton-discret h-7">
            Annuler
          </button>
          <button type="submit" disabled={!valide} className="bouton-principal h-7 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-attenue-2">
            Appliquer
          </button>
        </div>
      </form>
    </div>
  );
}

export function ConditionsRapport({ colonnes, facettes, onChanger }: { colonnes: ColonneRapport[]; facettes: Facettes; onChanger: (f: Facettes) => void }) {
  /* La clé de la condition rouverte, « nouvelle » pour l'ajout, null fermé. */
  const [ouverte, setOuverte] = useState<string | null>(null);
  if (colonnes.length === 0) return null;

  const posees = conditionsDe(facettes).filter((c) => colonnes.some((x) => x.cle === c.cle));
  /* On propose d'abord une colonne pas encore bornée : une seule condition par colonne. */
  const libre = colonnes.find((x) => !posees.some((c) => c.cle === x.cle)) ?? colonnes[0]!;

  function valider(ancienne: string | null, c: Condition) {
    const base = ancienne && ancienne !== c.cle ? retirerCondition(facettes, ancienne) : facettes;
    onChanger(poserCondition(base, c));
    setOuverte(null);
  }

  return (
    <>
      {posees.map((c) => {
        const colonne = colonnes.find((x) => x.cle === c.cle)!;
        return (
          <div key={c.cle} className="relative">
            <span className="flex h-8 max-w-[320px] items-center rounded-full border border-accent bg-accent-fond text-[12.5px] font-semibold text-accent-fonce">
              <button type="button" onClick={() => setOuverte(c.cle)} className="flex min-w-0 items-center gap-1.5 pl-3" title="Modifier la condition">
                <SlidersHorizontal className="size-3.5 shrink-0" strokeWidth={2} />
                <span className="truncate">{libelleCondition(c, colonne)}</span>
              </button>
              <button type="button" onClick={() => onChanger(retirerCondition(facettes, c.cle))} aria-label={`Retirer la condition sur ${colonne.libelle.toLowerCase()}`} className="grid h-full shrink-0 place-items-center pr-2.5 pl-1.5">
                <X className="size-3.5" strokeWidth={2.2} />
              </button>
            </span>
            {ouverte === c.cle ? <Editeur colonnes={colonnes} depart={c} onValider={(n) => valider(c.cle, n)} onFermer={() => setOuverte(null)} /> : null}
          </div>
        );
      })}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOuverte((o) => (o === "nouvelle" ? null : "nouvelle"))}
          aria-expanded={ouverte === "nouvelle"}
          className="flex h-8 items-center gap-1.5 rounded-full border border-dashed border-bordure-champ bg-surface px-3 text-[12.5px] font-medium text-texte-2 transition-colors hover:border-accent hover:text-texte"
        >
          <Plus className="size-3.5" strokeWidth={2} />
          Condition
        </button>
        {ouverte === "nouvelle" ? <Editeur colonnes={colonnes} depart={{ cle: libre.cle, operateur: "sup", a: "", b: "" }} onValider={(n) => valider(null, n)} onFermer={() => setOuverte(null)} /> : null}
      </div>
    </>
  );
}
