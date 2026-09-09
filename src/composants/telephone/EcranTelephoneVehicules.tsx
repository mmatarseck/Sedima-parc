"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { lireAccesCourant } from "@/lib/acces-courant";
import type { AccesCourant } from "@/domaine/acces";
import type { LigneFlotte } from "@/domaine/types";
import { dansPerimetre } from "./perimetre";
import { EnTeteTelephone, PastilleStatutTelephone } from "./Telephone";

/* ============================================================================
 * Téléphone › Véhicules — retrouver un véhicule en deux secondes : plaque,
 * marque, chauffeur, site. La liste est celle du périmètre. Un geste passé
 * dans l'adresse (relevé, plein, panne) suit jusqu'à la fiche, qui l'ouvre.
 * ==========================================================================*/

const GESTES: Record<string, string> = { releve: "Relevé de compteur", plein: "Plein", panne: "Signaler une panne", statut: "Changer le statut", document: "Document renouvelé" };

function sansAccents(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function EcranTelephoneVehicules({ lignes }: { lignes: LigneFlotte[] }) {
  const params = useSearchParams();
  const geste = params.get("geste");
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [recherche, setRecherche] = useState("");
  useEffect(() => setAcces(lireAccesCourant()), []);

  const miennes = useMemo(() => (acces ? lignes.filter((l) => dansPerimetre(l, acces)) : lignes), [lignes, acces]);
  const filtrees = useMemo(() => {
    const t = sansAccents(recherche.trim()).replace(/[\s-]/g, "");
    if (!t) return miennes;
    return miennes.filter((l) => {
      const v = l.vehicule;
      const texte = sansAccents(`${v.immatriculation} ${v.marque} ${v.appellation} ${l.chauffeurTitulaire?.nom ?? ""} ${l.attributaire?.nom ?? ""} ${l.site?.libelle ?? ""}`).replace(/[\s-]/g, "");
      return texte.includes(t);
    });
  }, [miennes, recherche]);

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-1">
      <EnTeteTelephone titre={geste && GESTES[geste] ? GESTES[geste] : "Véhicules"} retour="/telephone" />
      {geste && GESTES[geste] ? <p className="meta -mt-2 px-4">Choisissez le véhicule ; {geste === "statut" ? "le panneau de statut" : "la saisie"} s&apos;ouvre sur sa fiche.</p> : null}
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-attenue" strokeWidth={2} />
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Plaque, marque, chauffeur, site"
          autoComplete="off"
          className="h-11 w-full rounded-[12px] border border-bordure-champ bg-surface pl-10 pr-3 text-[15px] text-texte outline-none focus:border-accent"
        />
      </label>
      <p className="meta px-1">
        {filtrees.length} véhicule{filtrees.length > 1 ? "s" : ""}
        {recherche ? ` pour « ${recherche} »` : ""}
      </p>
      <ul className="flex flex-col gap-2">
        {filtrees.slice(0, 60).map((l) => {
          const v = l.vehicule;
          return (
            <li key={v.id}>
              <Link href={`/telephone/vehicules/${v.id}${geste ? `?geste=${geste}` : ""}`} className="carte flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="code block text-[15px] font-bold text-texte">{v.immatriculationAffichee}</span>
                  <span className="block truncate text-[12.5px] text-texte-2">
                    {v.marque} {v.appellation}
                    {l.chauffeurTitulaire ? ` · ${l.chauffeurTitulaire.nom}` : l.attributaire ? ` · ${l.attributaire.nom}` : ""}
                  </span>
                  <span className="block truncate text-[11.5px] text-attenue">{l.site?.libelle ?? "Site non renseigné"}</span>
                </span>
                <PastilleStatutTelephone statut={l.statutEffectif ?? v.statut} />
              </Link>
            </li>
          );
        })}
      </ul>
      {filtrees.length > 60 ? <p className="meta px-1">Affinez la recherche pour voir les autres.</p> : null}
    </div>
  );
}
