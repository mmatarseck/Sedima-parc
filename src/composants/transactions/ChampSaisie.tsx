"use client";

import { ChampCombo } from "@/composants/interface/ChampCombo";
import { ChampPhoto } from "@/composants/interface/ChampPhoto";
import { ChampPieces } from "@/composants/interface/ChampPieces";
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
  /*
   * Des cases à cocher — demande du métier du 15 septembre 2026, pour les
   * catégories de permis et le plan car.
   *
   * POURQUOI DES CASES ET NON UN CHAMP DE TEXTE. Les catégories de permis se
   * saisissaient en toutes lettres : « B, C » ou « B/C/E » ou « bce ». La
   * lecture les rattrapait à la relecture, mais rien ne disait à l'agent ce
   * qu'on attendait, et rien ne l'empêchait d'écrire une catégorie qui n'existe
   * pas. Les cases montrent les catégories possibles, et n'en laissent passer
   * aucune autre.
   *
   * La valeur reste **une chaîne** : les valeurs cochées, séparées par un point
   * médian. La saisie d'un formulaire ne porte que des chaînes et des booléens,
   * et la lecture qui range les catégories en base découpe déjà sur tout ce qui
   * n'est pas une lettre — elle accepte donc cette forme sans rien changer.
   */
  if (champ.type === "cases") {
    /* Sans options, une seule case : un booléen, coché ou non. */
    if (!champ.options || champ.options.length === 0) {
      return (
        <label className="flex h-9 cursor-pointer items-center gap-2.5 text-[13px] text-texte">
          <input type="checkbox" checked={Boolean(v)} onChange={(e) => onChange(e.target.checked)} className="size-4 shrink-0 accent-[var(--color-accent)]" />
          {champ.precision ?? "Oui"}
        </label>
      );
    }
    const cochees = new Set(
      String(v ?? "")
        .toUpperCase()
        .split(/[^A-Z0-9]+/)
        .filter(Boolean),
    );
    /*
     * Une valeur enregistrée qui n'est plus dans la liste garde sa case, cochée
     * et marquée. Sans cela, ouvrir puis enregistrer une fiche l'effacerait sans
     * que personne ne l'ait décidé : trente-six chauffeurs portent un « E » seul
     * hérité d'un modèle de permis à cinq lettres, et choisir à leur place entre
     * BE, C1E, CE et DE serait inventer. On la montre ; on la corrige en la
     * décochant.
     */
    const listees = new Set(champ.options.map((o) => o.valeur.toUpperCase()));
    const heritees = [...cochees].filter((x) => !listees.has(x));
    const toutes = [...champ.options.map((o) => ({ valeur: o.valeur.toUpperCase(), libelle: o.libelle, heritee: false })), ...heritees.map((x) => ({ valeur: x, libelle: x, heritee: true }))];
    const basculer = (valeur: string) => {
      const suite = new Set(cochees);
      if (suite.has(valeur)) suite.delete(valeur);
      else suite.add(valeur);
      /* L'ordre des options, et non celui des clics : deux agents qui cochent
         les mêmes cases doivent enregistrer la même valeur. */
      onChange(
        toutes
          .map((o) => o.valeur)
          .filter((x) => suite.has(x))
          .join(" · "),
      );
    };
    return (
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border px-3 py-2 ${invalide ? "border-defavorable" : "border-bordure-champ"}`}>
        {toutes.map((o) => (
          <label key={o.valeur} className="flex cursor-pointer items-center gap-2 text-[13px] text-texte" title={o.heritee ? "Valeur enregistrée avant, hors de la liste actuelle : décochez-la pour la retirer" : undefined}>
            <input type="checkbox" checked={cochees.has(o.valeur)} onChange={() => basculer(o.valeur)} className="size-4 shrink-0 accent-[var(--color-accent)]" />
            <span className={o.heritee ? "text-texte-2 italic" : undefined}>{o.libelle}</span>
          </label>
        ))}
      </div>
    );
  }
  /* Une valeur calculée, qui se lit sans se saisir : l'ensemble d'une tâche, généré. */
  if (champ.type === "lecture") {
    return <span className="code flex h-9 items-center rounded-[10px] bg-surface-2 px-3 text-[13px] text-texte-2">{String(v ?? "") || "—"}</span>;
  }
  if (champ.type === "choix") {
    /*
     * On écrit pour filtrer, même là où l'on ne peut pas créer.
     *
     * C'était une liste déroulante native : pour trouver un véhicule parmi cent
     * quatre-vingt-quatre, ou un prestataire parmi cent quatre, il fallait
     * dérouler. Demande du métier du 15 septembre 2026 — « la possibilité
     * d'écrire » dans tous les champs à liste.
     *
     * Sans `creation` : la valeur reste contrainte à la liste. Beaucoup de ces
     * listes sont des énumérations de la base — l'usage, l'énergie, le statut,
     * le poste de dépense —, et une valeur inventée y serait refusée à
     * l'écriture. Ce qui peut s'enrichir le fait par un champ « suggestion »,
     * et le dit.
     *
     * `suggestionsDe` vaut ici ce qu'il vaut pour la suggestion : une liste
     * **relue à l'ouverture**. Les listes posées dans `CHAMPS` sont construites
     * à l'import du module et ne bougent plus — ce qui a été créé depuis n'y
     * apparaît jamais.
     */
    return <ChampCombo valeur={String(v ?? "")} onChange={onChange} options={champ.suggestionsDe ? champ.suggestionsDe(saisie) : (champ.options ?? [])} invalide={invalide} placeholder="Choisir, ou écrire pour filtrer" />;
  }
  if (champ.type === "suggestion") {
    return <ChampCombo valeur={String(v ?? "")} onChange={onChange} options={champ.suggestionsDe ? champ.suggestionsDe(saisie) : (champ.options ?? [])} creation invalide={invalide} placeholder="Choisir, ou écrire pour créer" />;
  }
  if (champ.type === "photo") {
    /* Le libellé du champ dit ce qu'on attend — « Photo de la pièce », « Scan du
       document » —, et le dossier décide où le fichier part dans le seau. */
    return (
      <ChampPhoto
        valeur={typeof v === "string" && v ? v : null}
        onChange={(ref) => onChange(ref ?? "")}
        dossier={champ.dossier ?? "pieces"}
        libelle={champ.libelle}
        precision={champ.precision ?? (champ.obligatoire ? "Obligatoire : le ticket, le bon, la facture" : "Facultative")}
        compact
      />
    );
  }
  if (champ.type === "pieces") {
    /* Plusieurs pièces : la saisie les garde en JSON, la sortie de la modale en refait un tableau. */
    let refs: string[] = [];
    try {
      refs = typeof v === "string" && v.startsWith("[") ? (JSON.parse(v) as string[]) : [];
    } catch {
      refs = [];
    }
    return <ChampPieces valeur={refs} onChange={(r) => onChange(r.length ? JSON.stringify(r) : "")} dossier={champ.dossier ?? "documents"} />;
  }
  if (champ.type === "lignes") {
    return <span className="meta">Les lignes se saisissent dans le formulaire du service.</span>;
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
