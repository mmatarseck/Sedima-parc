"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

/* ============================================================================
 * Champ combiné — une liste déroulante où l'on peut aussi créer.
 *
 * Demande du métier du 7 septembre 2026, sur le modèle de Fleetio : pour la
 * marque ou le modèle, « pouvoir choisir d'une liste déroulante ou, s'il
 * n'existe pas, pouvoir créer un nouveau sur la même vue ». On tape, la liste
 * se filtre ; ce qui n'existe pas se crée d'un clic sur « + Créer « … » »,
 * sans quitter le formulaire. Sans `creation`, le champ ne retient que ce qui
 * est dans la liste — un site, un fournisseur — et rend le texte tapé au
 * dernier choix valide.
 * ==========================================================================*/

export interface OptionCombo {
  valeur: string;
  libelle: string;
  precision?: string;
}

function sansAccents(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function ChampCombo({
  valeur,
  onChange,
  options,
  creation = false,
  placeholder,
  disabled,
  invalide,
  vide = "Aucune proposition",
  id,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  options: OptionCombo[];
  /** Vrai : ce qui n'est pas dans la liste se crée, et la valeur est le texte tapé. */
  creation?: boolean;
  placeholder?: string;
  disabled?: boolean;
  invalide?: boolean;
  /** Ce que dit la liste quand rien ne correspond et que rien ne se crée. */
  vide?: string;
  id?: string;
}) {
  const choisie = useMemo(() => options.find((o) => o.valeur === valeur) ?? null, [options, valeur]);
  const [texte, setTexte] = useState(choisie?.libelle ?? valeur);
  const [ouvert, setOuvert] = useState(false);
  const [surligne, setSurligne] = useState(0);
  const conteneur = useRef<HTMLDivElement>(null);

  /* La valeur peut changer de l'extérieur (remise à zéro, valeur proposée) :
     le texte suit, sauf pendant qu'on tape. */
  useEffect(() => {
    if (!ouvert) setTexte(choisie?.libelle ?? valeur);
  }, [choisie, valeur, ouvert]);

  const propositions = useMemo(() => {
    const terme = sansAccents(texte);
    /* Liste entière tant que le texte est celui du choix courant : on veut voir les autres. */
    if (!terme || (choisie && terme === sansAccents(choisie.libelle))) return options;
    return options.filter((o) => sansAccents(`${o.libelle} ${o.precision ?? ""}`).includes(terme));
  }, [options, texte, choisie]);

  const texteNet = texte.replace(/\s+/g, " ").trim();
  const existe = options.some((o) => sansAccents(o.libelle) === sansAccents(texteNet));
  const peutCreer = creation && texteNet.length > 0 && !existe;
  const lignes = peutCreer ? propositions.length + 1 : propositions.length;

  useEffect(() => setSurligne(0), [propositions.length, peutCreer]);

  function fermer() {
    setOuvert(false);
    /* Sans création, un texte qui ne correspond à rien revient au dernier choix. */
    if (!creation) setTexte(choisie?.libelle ?? "");
    else if (texteNet !== valeur) onChange(texteNet);
  }

  function choisir(o: OptionCombo) {
    onChange(o.valeur);
    setTexte(o.libelle);
    setOuvert(false);
  }

  function creer() {
    onChange(texteNet);
    setTexte(texteNet);
    setOuvert(false);
  }

  function vider() {
    onChange("");
    setTexte("");
    setOuvert(false);
  }

  const commun = `h-9 w-full rounded-[10px] border bg-surface pr-16 pl-3 text-[13px] text-texte outline-none focus:border-accent disabled:bg-surface-2 disabled:text-texte-2 ${invalide ? "border-defavorable" : "border-bordure-champ"}`;

  return (
    <div ref={conteneur} className="relative">
      <input
        id={id}
        type="text"
        value={texte}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={ouvert}
        onChange={(e) => {
          setTexte(e.target.value);
          setOuvert(true);
        }}
        onFocus={() => setOuvert(true)}
        onBlur={() => setTimeout(() => setOuvert(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            fermer();
            return;
          }
          if (!ouvert) {
            if (e.key === "ArrowDown") setOuvert(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSurligne((s) => Math.min(lignes - 1, s + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSurligne((s) => Math.max(0, s - 1));
          } else if (e.key === "Enter" || e.key === "Tab") {
            if (surligne < propositions.length) {
              const p = propositions[surligne];
              if (p) {
                if (e.key === "Enter") e.preventDefault();
                choisir(p);
              }
            } else if (peutCreer) {
              if (e.key === "Enter") e.preventDefault();
              creer();
            } else if (e.key === "Enter") {
              e.preventDefault();
              fermer();
            }
          }
        }}
        className={commun}
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1 text-attenue">
        {valeur && !disabled ? (
          <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={vider} aria-label="Effacer" className="pointer-events-auto grid size-5 place-items-center rounded-full hover:bg-surface-3 hover:text-texte">
            <X className="size-3.5" strokeWidth={2} />
          </button>
        ) : null}
        <ChevronsUpDown className="size-3.5" strokeWidth={1.8} />
      </span>

      {ouvert && !disabled ? (
        <ul role="listbox" className="absolute top-full right-0 left-0 z-20 mt-1 max-h-[240px] overflow-y-auto rounded-[12px] border border-bordure bg-surface py-1 shadow-modale">
          {propositions.map((o, i) => (
            <li key={o.valeur} role="option" aria-selected={o.valeur === valeur}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choisir(o);
                }}
                onMouseEnter={() => setSurligne(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-texte ${i === surligne ? "bg-surface-2" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {o.libelle}
                  {o.precision ? <span className="meta ml-2">{o.precision}</span> : null}
                </span>
                {o.valeur === valeur ? <Check className="size-4 shrink-0 text-accent-fonce" strokeWidth={2.2} /> : null}
              </button>
            </li>
          ))}
          {peutCreer ? (
            <li role="option" aria-selected={false} className={propositions.length ? "border-t border-bordure" : ""}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  creer();
                }}
                onMouseEnter={() => setSurligne(propositions.length)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-accent-fonce ${surligne === propositions.length ? "bg-accent-fond" : ""}`}
              >
                <Plus className="size-4 shrink-0" strokeWidth={2.2} />
                Créer « {texteNet} »
              </button>
            </li>
          ) : null}
          {propositions.length === 0 && !peutCreer ? <li className="meta px-3 py-2">{vide}</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
