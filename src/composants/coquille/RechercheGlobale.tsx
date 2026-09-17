"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Hash, Loader2, Package, PiggyBank, Search, ShoppingCart, Truck, UserRound } from "lucide-react";
import { CATEGORIES_RECHERCHE, type CategorieRecherche } from "@/domaine/recherche";
import { chercherCodes } from "@/lib/recherche-actions";
import { authentificationReelle } from "@/lib/session-demo";
import type { Resultat } from "./recherche-index";

/**
 * Recherche transversale à la plateforme.
 *
 * Deux sources, fondues en une liste : l'index du navigateur — véhicules et
 * chauffeurs des référentiels, ce qui vient d'être créé ici, les numéros de la
 * démonstration — et, base branchée, **la base elle-même** : tout code, dans
 * toute transaction (métier, 17 septembre 2026). Un numéro de dépense, un bon
 * de commande Sage X3, une référence de facture, un numéro de pièce, une
 * enveloppe budgétaire — chacun mène à sa ligne, sur la fiche qui la porte.
 *
 * Le serveur se demande à partir de trois caractères, après un court silence
 * de frappe : une requête par table, filtrée par les droits de la session, et
 * pas une par touche.
 */
const ATTENTE_FRAPPE = 260;

const ICONES: Record<CategorieRecherche, typeof Hash> = {
  Transactions: Hash,
  "Achats & caisse": ShoppingCart,
  Transporteurs: Truck,
  Prestataires: Building2,
  "Pièces & pneus": Package,
  Budget: PiggyBank,
  Véhicules: Truck,
  Chauffeurs: UserRound,
};

export function RechercheGlobale() {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [terme, setTerme] = useState("");
  const [ouvert, setOuvert] = useState(false);

  /* L'index se charge à la première frappe : la mise en page reste légère. */
  const [chercheur, setChercheur] = useState<((terme: string) => Resultat[]) | null>(null);
  useEffect(() => {
    if (!ouvert || chercheur) return;
    let vivant = true;
    void import("./recherche-index").then((m) => {
      if (vivant) setChercheur(() => m.chercher);
    });
    return () => {
      vivant = false;
    };
  }, [ouvert, chercheur]);
  const locaux = useMemo(() => (chercheur ? chercheur(terme) : []), [chercheur, terme]);

  /* La base, après un silence de frappe ; une réponse en retard sur un terme
     déjà changé est jetée. */
  const [distants, setDistants] = useState<Resultat[]>([]);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    const t = terme.trim();
    if (!ouvert || t.length < 3 || !authentificationReelle()) {
      setDistants([]);
      setEnCours(false);
      return;
    }
    let vivant = true;
    setEnCours(true);
    const minuteur = setTimeout(() => {
      void chercherCodes(t)
        .then((r) => {
          if (vivant) setDistants(r);
        })
        .catch(() => {
          if (vivant) setDistants([]);
        })
        .finally(() => {
          if (vivant) setEnCours(false);
        });
    }, ATTENTE_FRAPPE);
    return () => {
      vivant = false;
      clearTimeout(minuteur);
    };
  }, [terme, ouvert]);

  const resultats = useMemo(() => {
    const vus = new Set<string>();
    const tous: Resultat[] = [];
    for (const r of [...distants, ...locaux]) {
      if (vus.has(r.cle)) continue;
      vus.add(r.cle);
      tous.push(r);
    }
    return tous;
  }, [distants, locaux]);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        champ.current?.focus();
        setOuvert(true);
      }
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, []);

  function ouvrir(resultat: Resultat) {
    setOuvert(false);
    setTerme("");
    router.push(resultat.href);
  }

  const assezLong = terme.trim().length >= 2;

  return (
    <div className="relative w-full max-w-[460px]">
      <label className="champ-pilule">
        {enCours ? <Loader2 className="size-4 shrink-0 animate-spin text-attenue" strokeWidth={1.8} /> : <Search className="size-4 shrink-0 text-attenue" strokeWidth={1.8} />}
        <input
          ref={champ}
          type="search"
          value={terme}
          onChange={(e) => {
            setTerme(e.target.value);
            setOuvert(true);
          }}
          onFocus={() => setOuvert(true)}
          placeholder="Véhicule, chauffeur, n° de transaction, bon de commande…"
          aria-label="Rechercher dans toute la plateforme"
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-attenue"
        />
        <kbd className="hidden shrink-0 rounded-[6px] border border-bordure bg-surface px-1.5 text-[10.5px] leading-[18px] font-medium text-attenue sm:block">
          Ctrl K
        </kbd>
      </label>

      {ouvert && assezLong ? (
        <>
          <button type="button" aria-label="Fermer la recherche" onClick={() => setOuvert(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute top-full left-0 z-40 mt-2 w-full rounded-[14px] border border-bordure bg-surface p-2 shadow-flottante">
            {resultats.length === 0 ? (
              <p className="corps px-3 py-5 text-center text-attenue">{enCours ? "Recherche dans la base…" : `Aucun résultat pour « ${terme.trim()} ».`}</p>
            ) : (
              <div className="defilement-discret max-h-[70vh] overflow-y-auto">
                {CATEGORIES_RECHERCHE.map((categorie) => {
                  const lot = resultats.filter((r) => r.categorie === categorie);
                  if (lot.length === 0) return null;
                  const Icone = ICONES[categorie];
                  return (
                    <div key={categorie} className="mb-1 last:mb-0">
                      <p className="micro-sur-titre px-3 py-2">{categorie}</p>
                      <ul className="flex flex-col">
                        {lot.map((r) => (
                          <li key={r.cle}>
                            <button type="button" onClick={() => ouvrir(r)} className="flex w-full items-start gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-surface-3">
                              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-texte-2">
                                <Icone className="size-4" strokeWidth={1.6} />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-medium text-texte">{r.titre}</span>
                                <span className="meta block truncate">{r.precision}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="meta border-t border-bordure px-3 pt-2.5 pb-1.5">
              Tout code se cherche : numéro de transaction, bon de commande ou DA Sage X3, référence de facture, numéro de pièce ou de série, plaque, châssis, matricule.
              {enCours ? " Recherche dans la base…" : ""}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
