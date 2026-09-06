"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, Search, Truck, UserRound } from "lucide-react";
import { listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { FLOTTE } from "@/donnees/parc-demo";
import { catalogueReferences } from "@/composants/transactions/ChampReference";
import { fabriquerLigneFlotte } from "@/composants/transactions/fabriques";
import { lireToutesCreations } from "@/lib/clotures-demo";
import { STATUT_CHAUFFEUR } from "@/domaine/chauffeur";
import { BUSINESS_UNIT, STATUT_VEHICULE } from "@/domaine/libelles";
import type { LigneFlotte } from "@/domaine/types";

/**
 * Recherche transversale à la plateforme.
 *
 * Elle interroge aujourd'hui les seules données livrées — véhicules et
 * chauffeurs affectés. Chaque module ajouté viendra s'y brancher : documents,
 * ordres de travail, mouvements de caisse, demandes d'achat, transporteurs.
 *
 * Ce qui a été **créé dans l'application** s'y trouve aussi : le véhicule
 * saisi depuis la liste Flotte et les transactions posées sur les fiches. Elles
 * ne sont pas dans l'index du serveur — il est construit une fois depuis le jeu
 * de démonstration —, mais le navigateur les connaît, et l'on ne retrouve pas
 * un numéro à moitié.
 *
 * Au branchement de la base, la recherche passera côté serveur : une seule
 * requête, filtrée par les droits de l'utilisateur, plutôt qu'un parcours du
 * jeu de données dans le navigateur.
 */

interface Resultat {
  cle: string;
  categorie: "Transactions" | "Véhicules" | "Chauffeurs";
  titre: string;
  precision: string;
  href: string;
}

const LIMITE_PAR_CATEGORIE = 5;

function normaliserNumero(texte: string): string {
  return texte.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function chercher(terme: string): Resultat[] {
  const t = terme.trim().toLowerCase();
  if (t.length < 2) return [];

  /* Les véhicules créés dans le navigateur passent devant : on vient de les
     saisir, c'est souvent eux que l'on cherche. */
  const crees: LigneFlotte[] = lireToutesCreations("vehicule").map(fabriquerLigneFlotte);
  const vehicules: Resultat[] = [...crees, ...FLOTTE].filter((l) =>
    [l.vehicule.immatriculation, l.vehicule.immatriculationAffichee, l.vehicule.vin ?? "", l.vehicule.marque, l.vehicule.appellation]
      .join(" ")
      .toLowerCase()
      .includes(t),
  )
    .slice(0, LIMITE_PAR_CATEGORIE)
    .map((l) => ({
      cle: `v-${l.vehicule.id}`,
      categorie: "Véhicules" as const,
      titre: `${l.vehicule.immatriculationAffichee} · ${l.vehicule.marque} ${l.vehicule.appellation}`,
      precision: [
        STATUT_VEHICULE[l.vehicule.statut].libelle,
        l.vehicule.businessUnit ? BUSINESS_UNIT[l.vehicule.businessUnit] : null,
        l.site?.libelle ?? null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/flotte/${l.vehicule.immatriculation}`,
    }));

  const chauffeurs: Resultat[] = listeChauffeurs()
    .filter((c) => [c.nomComplet, c.chauffeur.matriculeRh ?? "", c.chauffeur.telephone ?? ""].join(" ").toLowerCase().includes(t))
    .slice(0, LIMITE_PAR_CATEGORIE)
    .map((c) => ({
      cle: `c-${c.id}`,
      categorie: "Chauffeurs" as const,
      titre: c.nomComplet,
      precision: [
        STATUT_CHAUFFEUR[c.statut].libelle,
        c.vehiculeTitulaire ? `titulaire de ${c.vehiculeTitulaire.immatriculationAffichee}` : c.suppleances.length ? `suppléant de ${c.suppleances[0]!.immatriculationAffichee}` : null,
        c.site?.libelle ?? null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/chauffeurs/${c.id}`,
    }));

  /* Les numéros de référence : « DEP-2026-15012 », ou n'importe quel bout du
     numéro. C'est ce que l'équipe parc cite dans une demande d'achat, et ce
     qu'on retrouve d'abord. Le catalogue réunit l'index du serveur et les
     créations du navigateur — le même que celui des champs « transaction
     d'origine », pour qu'un numéro proposé là se retrouve ici. */
  const numero = normaliserNumero(terme);
  const transactions: Resultat[] =
    numero.length < 3
      ? []
      : catalogueReferences()
          .filter((e) => normaliserNumero(e.numero).includes(numero))
          .slice(0, LIMITE_PAR_CATEGORIE + 1)
          .map((e) => ({
            cle: `t-${e.numero}`,
            categorie: "Transactions" as const,
            titre: `${e.numero} · ${e.titre}`,
            precision: e.precision,
            href: e.href,
          }))
          /* Une création faite hors d'une fiche véhicule n'a pas d'adresse :
             la proposer mènerait nulle part. */
          .filter((r) => r.href !== "");

  return [...transactions, ...vehicules, ...chauffeurs];
}

export function RechercheGlobale() {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [terme, setTerme] = useState("");
  const [ouvert, setOuvert] = useState(false);

  const resultats = useMemo(() => chercher(terme), [terme]);

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

  const categories = ["Transactions", "Véhicules", "Chauffeurs"] as const;
  const assezLong = terme.trim().length >= 2;

  return (
    <div className="relative w-full max-w-[460px]">
      <label className="champ-pilule">
        <Search className="size-4 shrink-0 text-attenue" strokeWidth={1.8} />
        <input
          ref={champ}
          type="search"
          value={terme}
          onChange={(e) => {
            setTerme(e.target.value);
            setOuvert(true);
          }}
          onFocus={() => setOuvert(true)}
          placeholder="Véhicule, chauffeur, n° de transaction…"
          aria-label="Rechercher dans toute la plateforme"
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-attenue"
        />
        <kbd className="hidden shrink-0 rounded-[6px] border border-bordure bg-surface px-1.5 text-[10.5px] leading-[18px] font-medium text-attenue sm:block">
          Ctrl K
        </kbd>
      </label>

      {ouvert && assezLong ? (
        <>
          <button
            type="button"
            aria-label="Fermer la recherche"
            onClick={() => setOuvert(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute top-full left-0 z-40 mt-2 w-full rounded-[14px] border border-bordure bg-surface p-2 shadow-flottante">
            {resultats.length === 0 ? (
              <p className="corps px-3 py-5 text-center text-attenue">Aucun résultat pour « {terme.trim()} ».</p>
            ) : (
              categories.map((categorie) => {
                const lot = resultats.filter((r) => r.categorie === categorie);
                if (lot.length === 0) return null;
                return (
                  <div key={categorie} className="mb-1 last:mb-0">
                    <p className="micro-sur-titre px-3 py-2">{categorie}</p>
                    <ul className="flex flex-col">
                      {lot.map((r) => (
                        <li key={r.cle}>
                          <button
                            type="button"
                            onClick={() => ouvrir(r)}
                            className="flex w-full items-start gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-surface-3"
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-texte-2">
                              {categorie === "Véhicules" ? (
                                <Truck className="size-4" strokeWidth={1.6} />
                              ) : categorie === "Transactions" ? (
                                <Hash className="size-4" strokeWidth={1.6} />
                              ) : (
                                <UserRound className="size-4" strokeWidth={1.6} />
                              )}
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
              })
            )}
            <p className="meta border-t border-bordure px-3 pt-2.5 pb-1.5">
              Véhicules, chauffeurs et numéros de transaction. Les autres modules s'y brancheront à mesure qu'ils seront livrés.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
