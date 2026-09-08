"use client";

import { ChampCombo } from "@/composants/interface/ChampCombo";
import { ChampPhoto } from "@/composants/interface/ChampPhoto";
import type { ChampEdition } from "@/domaine/cloture";
import { ChampReference } from "./ChampReference";

/* ============================================================================
 * Un champ de saisie, quel que soit son type — le même dans la modale de
 * transaction et dans la page de création d'un véhicule, pour qu'un champ se
 * comporte partout pareil. La « suggestion » est une liste où l'on crée ce
 * qui manque ; le « choix » une liste fermée.
 * ==========================================================================*/

export function ChampSaisie({
  champ,
  valeur,
  saisie,
  onChange,
  immatriculation = null,
  invalide = false,
}: {
  champ: ChampEdition;
  valeur: string | boolean;
  /** Toute la saisie du formulaire, pour les listes qui dépendent d'un autre champ. */
  saisie: Record<string, string | boolean>;
  onChange: (valeur: string | boolean) => void;
  /** Le véhicule du formulaire, pour borner une référence. */
  immatriculation?: string | null;
  invalide?: boolean;
}) {
  const commun = `h-9 w-full rounded-[10px] border bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent ${invalide ? "border-defavorable" : "border-bordure-champ"}`;
  const v = valeur;

  if (champ.type === "oui-non") {
    return (
      <button type="button" role="switch" aria-checked={Boolean(v)} onClick={() => onChange(!v)} className="flex h-9 items-center gap-2.5 text-[13px] text-texte">
        <span className={`relative inline-block h-5 w-9 rounded-full transition-colors ${v ? "bg-accent" : "bg-bordure-champ"}`}>
          <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${v ? "left-[18px]" : "left-0.5"}`} />
        </span>
        {v ? "Oui" : "Non"}
      </button>
    );
  }
  if (champ.type === "choix") {
    return (
      <select value={String(v ?? "")} onChange={(e) => onChange(e.target.value)} className={commun}>
        <option value="">—</option>
        {champ.options?.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    );
  }
  if (champ.type === "suggestion") {
    return <ChampCombo valeur={String(v ?? "")} onChange={onChange} options={champ.suggestionsDe ? champ.suggestionsDe(saisie) : (champ.options ?? [])} creation invalide={invalide} placeholder="Choisir, ou écrire pour créer" />;
  }
  if (champ.type === "photo") {
    return <ChampPhoto valeur={typeof v === "string" && v ? v : null} onChange={(ref) => onChange(ref ?? "")} dossier="pieces" libelle="Photo de la pièce" precision={champ.obligatoire ? "Obligatoire : le ticket, le bon, la facture" : "Facultative"} compact />;
  }
  if (champ.type === "texte-long") {
    return <textarea value={String(v ?? "")} onChange={(e) => onChange(e.target.value)} rows={3} className={`${commun} h-auto resize-none py-2 leading-relaxed`} />;
  }
  if (champ.type === "reference") {
    return <ChampReference valeur={String(v ?? "")} onChange={onChange} types={champ.references} immatriculation={immatriculation} />;
  }
  return (
    <span className="relative block">
      <input
        type={champ.type === "date" ? "date" : "text"}
        inputMode={champ.type === "nombre" ? "decimal" : undefined}
        value={String(v ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className={`${commun} ${champ.unite ? "pr-12" : ""} ${champ.type === "nombre" ? "code text-right" : ""}`}
      />
      {champ.unite ? <span className="meta pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">{champ.unite}</span> : null}
    </span>
  );
}
