"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Resultat } from "@/composants/coquille/recherche-index";
import { EnTeteTelephone } from "./Telephone";

/* ============================================================================
 * Téléphone › Rechercher — la recherche transversale en plein écran : une
 * plaque, un chauffeur, un numéro de transaction. L'index se charge à la
 * première frappe ; les résultats se rangent par catégorie.
 * ==========================================================================*/

export function EcranTelephoneRechercher() {
  const [terme, setTerme] = useState("");
  const [chercheur, setChercheur] = useState<((terme: string) => Resultat[]) | null>(null);
  useEffect(() => {
    if (!terme.trim() || chercheur) return;
    let vivant = true;
    void import("@/composants/coquille/recherche-index").then((m) => {
      if (vivant) setChercheur(() => m.chercher);
    });
    return () => {
      vivant = false;
    };
  }, [terme, chercheur]);

  const resultats = useMemo(() => (chercheur && terme.trim().length >= 2 ? chercheur(terme) : []), [chercheur, terme]);
  const categories = [...new Set(resultats.map((r) => r.categorie))];

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-1">
      <EnTeteTelephone titre="Rechercher" />
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-attenue" strokeWidth={2} />
        {/* Pas de focus automatique : sur un téléphone il ouvre le clavier
            dès l arrivée, qui mange la moitié de l écran avant qu on ait rien
            demandé (métier, 10 septembre 2026). Les champs qui gardent leur
            focus sont ceux des feuilles de saisie — on les ouvre justement
            pour taper. */}
        <input type="search" value={terme} onChange={(e) => setTerme(e.target.value)} placeholder="Plaque, chauffeur, n° de transaction" autoComplete="off" className="h-12 w-full rounded-[14px] border border-bordure-champ bg-surface pl-11 pr-3 text-[15px] text-texte outline-none focus:border-accent" />
      </label>
      {terme.trim().length < 2 ? <p className="meta px-2 py-8 text-center">Tapez au moins deux caractères : un véhicule, un chauffeur, un numéro comme DEP-2026-15012.</p> : null}
      {terme.trim().length >= 2 && chercheur && resultats.length === 0 ? <p className="meta px-2 py-8 text-center">Rien ne correspond à « {terme.trim()} ».</p> : null}
      {categories.map((c) => (
        <section key={c}>
          <h2 className="micro-sur-titre mb-1 px-1">{c}</h2>
          <div className="carte divide-y divide-bordure">
            {resultats
              .filter((r) => r.categorie === c)
              .map((r) => (
                <Link key={r.cle} href={r.href} className="flex flex-col px-3 py-2.5 hover:bg-surface-2">
                  <span className="text-[13.5px] font-semibold text-texte">{r.titre}</span>
                  <span className="meta">{r.precision}</span>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
