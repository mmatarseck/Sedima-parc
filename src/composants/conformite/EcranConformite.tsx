"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BellRing, RefreshCw, Truck, UserRound } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Numero } from "@/composants/interface/Numero";
import { Echeance as Pilule, Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { NIVEAU, PREAVIS, compter, estAlerte, type Echeance, type NiveauEcheance } from "@/domaine/conformite";
import { TYPE_DOCUMENT } from "@/domaine/libelles";
import type { TypeDocument } from "@/domaine/types";
import { date } from "@/lib/format";

/* ============================================================================
 * Conformité — l'échéancier unique.
 *
 * Une liste, la même que la Flotte et les Chauffeurs : filet de niveau, sujet
 * figé, colonnes au choix, filtres en bascule qui portent les comptes — c'est
 * le centre d'alertes, sans bandeau de KPI. Chaque ligne se renouvelle d'ici :
 * le formulaire du document s'ouvre pré-rempli, rangé sur la bonne fiche.
 * ==========================================================================*/

type Portee = "tous" | "vehicules" | "chauffeurs";

function libelleJours(e: Echeance): string {
  if (e.niveau === "manquant") return "manquant";
  if (e.niveau === "permanent") return "permanent";
  const j = e.joursRestants ?? 0;
  if (j < 0) return `échue de ${Math.abs(j)} j`;
  if (j === 0) return "aujourd'hui";
  return `dans ${j} j`;
}

function Interieur({ echeances, aujourdhui }: { echeances: Echeance[]; aujourdhui: string }) {
  const { creer } = useEdition();
  const [portee, setPortee] = useState<Portee>("tous");

  /* Le type de document, en plus de la portée : « toutes les assurances », « toutes les visites ». */
  const [typeDoc, setTypeDoc] = useState<string>("tous");
  const typesPresents = useMemo(() => {
    const vus = new Map<string, string>();
    for (const e of echeances) if (!vus.has(e.type)) vus.set(e.type, LIBELLE_TYPE[e.type] ?? TYPE_DOCUMENT[e.type]);
    return [...vus.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  }, [echeances]);
  const visibles = useMemo(
    () => echeances.filter((e) => (portee === "tous" ? true : portee === "vehicules" ? e.sujet === "vehicule" : e.sujet === "chauffeur") && (typeDoc === "tous" || e.type === typeDoc)),
    [echeances, portee, typeDoc],
  );
  const comptes = useMemo(() => compter(visibles), [visibles]);
  const alertes = comptes.manquant + comptes.echu + comptes.j7 + comptes.j30 + comptes.j60;

  /* Les filtres portent leurs comptes : c'est le centre d'alertes. Recréés
     quand les comptes changent, stables sinon. */
  const filtres = useMemo<FiltreListe<Echeance>[]>(
    () => [
      { cle: "alertes", libelle: `À traiter · ${alertes}`, retient: (e) => estAlerte(e.niveau) },
      { cle: "echu", libelle: `Échus · ${comptes.echu + comptes.manquant}`, retient: (e) => e.niveau === "echu" || e.niveau === "manquant" },
      { cle: "j7", libelle: `J-7 · ${comptes.j7}`, retient: (e) => e.niveau === "j7" },
      { cle: "j30", libelle: `J-30 · ${comptes.j30}`, retient: (e) => e.niveau === "j30" },
      { cle: "j60", libelle: `J-60 · ${comptes.j60}`, retient: (e) => e.niveau === "j60" },
      { cle: "tous", libelle: "Tous", retient: () => true },
    ],
    [alertes, comptes],
  );

  function renouveler(e: Echeance) {
    if (e.type === "entretien" || e.type === "rendez-vous" || e.sujetId === "flotte") return;
    if (e.type === "contre-visite") {
      creer({
        type: "visite",
        titre: `Rendez-vous de contre-visite · ${e.sujetLibelle}`,
        champs: champsCreation("visite", { pour: "vehicule" }),
        valeurs: { type: "contre-visite", centre: e.emetteur ?? "CCVA Rufisque", dateRendezVous: aujourdhui, statut: "rendez-vous" },
        sujetDe: () => `${e.sujet}:${e.sujetId}`,
      });
      return;
    }
    const pour = e.sujet;
    creer({
      type: "document",
      titre: `Renouveler · ${TYPE_DOCUMENT[e.type as TypeDocument]} · ${e.sujetLibelle}`,
      champs: champsCreation("document", { pour }),
      valeurs: { type: e.type, emetteur: e.emetteur, dateEffet: aujourdhui, echeance: null, numeroPiece: null, montant: null },
      sujetDe: () => `${e.sujet}:${e.sujetId}`,
    });
  }

  const colonnes = useMemo<ColonneListe<Echeance>[]>(
    () => [
      {
        cle: "document",
        libelle: "Échéance",
        parDefaut: true,
        largeur: 190,
        rendu: (e) => (
          <span className="flex items-center gap-2">
            <span className="block truncate font-medium">{e.libelle}</span>
            {e.sujet === "chauffeur" ? <UserRound className="size-3.5 shrink-0 text-attenue" strokeWidth={1.8} /> : e.type === "entretien" ? <RefreshCw className="size-3.5 shrink-0 text-attenue" strokeWidth={1.8} /> : <Truck className="size-3.5 shrink-0 text-attenue" strokeWidth={1.8} />}
          </span>
        ),
      },
      {
        cle: "jours",
        libelle: "Reste",
        parDefaut: true,
        largeur: 130,
        rendu: (e) => <Pilule ton={NIVEAU[e.niveau].ton}>{libelleJours(e)}</Pilule>,
      },
      { cle: "echeance", libelle: "Date", parDefaut: true, largeur: 112, rendu: (e) => <span className="code">{e.echeance ? date(e.echeance) : (e.repere ?? "—")}</span> },
      /* L'action tout de suite après la date : c'est le geste attendu, il ne doit
         pas demander un défilement vers la droite. */
      {
        cle: "action",
        libelle: "Action",
        parDefaut: true,
        largeur: 140,
        rendu: (e) =>
          e.sujetId === "flotte" ? (
            <span className="meta" title="Les licences de flotte se renouvellent dans Paramètres › Référentiels, à venir">
              Référentiel
            </span>
          ) : e.type === "entretien" || e.type === "rendez-vous" ? (
            <Link href={e.sujetHref} onClick={(ev) => ev.stopPropagation()} className="bouton-discret h-7 px-2 text-[12px]">
              {e.type === "rendez-vous" ? "Voir" : "Planifier"}
            </Link>
          ) : e.type === "contre-visite" ? (
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                renouveler(e);
              }}
              className="bouton-discret h-7 px-2 text-[12px]"
            >
              <RefreshCw className="size-3.5" strokeWidth={1.8} />
              Prendre rendez-vous
            </button>
          ) : (
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                renouveler(e);
              }}
              className="bouton-discret h-7 px-2 text-[12px]"
            >
              <RefreshCw className="size-3.5" strokeWidth={1.8} />
              Renouveler
            </button>
          ),
      },
      { cle: "niveau", libelle: "Niveau", parDefaut: false, largeur: 120, rendu: (e) => <Pastille ton={NIVEAU[e.niveau].ton}>{NIVEAU[e.niveau].libelle}</Pastille> },
      { cle: "precision", libelle: "Véhicule / chauffeur", parDefaut: true, largeur: 240, rendu: (e) => <span className="block truncate text-texte-2">{e.sujetPrecision}</span> },
      { cle: "piece", libelle: "N° de pièce", parDefaut: true, largeur: 150, rendu: (e) => <span className="code block truncate text-texte-2">{e.numeroPiece ?? "—"}</span> },
      { cle: "emetteur", libelle: "Émetteur", parDefaut: true, largeur: 200, rendu: (e) => <span className="block truncate">{e.emetteur ?? <span className="text-attenue-2">—</span>}</span> },
      { cle: "site", libelle: "Site", parDefaut: false, largeur: 150, rendu: (e) => <span className="block truncate">{e.site ?? "—"}</span> },
      { cle: "numero", libelle: "Réf.", parDefaut: false, largeur: 150, rendu: (e) => (e.numero ? <Numero valeur={e.numero} /> : <span className="text-attenue-2">—</span>) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aujourdhui],
  );

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Conformité"
        sousTitre={`${alertes} échéance${alertes > 1 ? "s" : ""} à traiter sur ${visibles.length} · préavis J-${PREAVIS.j60}, J-${PREAVIS.j30}, J-${PREAVIS.j7} · au ${date(aujourdhui)}`}
        actions={
          <>
            <label className="champ-pilule h-9 gap-1.5 pr-2.5 text-[12.5px]">
              <span className="text-attenue">Document</span>
              <select value={typeDoc} onChange={(e) => setTypeDoc(e.target.value)} className="bg-transparent font-medium text-texte outline-none" aria-label="Filtrer par type de document">
                <option value="tous">Tous</option>
                {typesPresents.map(([cle, libelle]) => (
                  <option key={cle} value={cle}>
                    {libelle}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex h-9 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Portée">
              {(
                [
                  { cle: "tous", libelle: "Tous" },
                  { cle: "vehicules", libelle: "Véhicules" },
                  { cle: "chauffeurs", libelle: "Chauffeurs" },
                ] as { cle: Portee; libelle: string }[]
              ).map((p) => (
                <button
                  key={p.cle}
                  type="button"
                  aria-pressed={portee === p.cle}
                  onClick={() => setPortee(p.cle)}
                  className={`h-7 rounded-full px-3 text-[12.5px] whitespace-nowrap transition-colors ${portee === p.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}
                >
                  {p.libelle}
                </button>
              ))}
            </div>
            <span className="bouton-secondaire cursor-default" title="Les alertes J-60, J-30, J-7 et échues sont visibles ici ; leur envoi par courriel viendra avec le branchement">
              <BellRing className="size-4 text-texte-2" strokeWidth={1.7} />
              {alertes} alerte{alertes > 1 ? "s" : ""}
            </span>
          </>
        }
      />

      <TableListe<Echeance>
        ecran="conformite"
        lignes={visibles}
        cle={(e) => e.cle}
        href={(e) => e.sujetHref}
        filet={(e) => ({ couleur: NIVEAU[e.niveau].couleur, libelle: NIVEAU[e.niveau].libelle, precision: NIVEAU[e.niveau].precision })}
        identifiant={{ cle: "sujet", libelle: "Véhicule / chauffeur", largeur: 170, rendu: (e) => <span className={e.sujet === "vehicule" ? "code" : ""}>{e.sujetLibelle}</span> }}
        colonnes={colonnes}
        filtres={filtres}
        champsRecherche={(e) => [e.sujetLibelle, e.sujetPrecision, e.libelle, e.numeroPiece ?? "", e.emetteur ?? "", e.site ?? ""]}
        placeholderRecherche="Immatriculation, chauffeur, document, émetteur…"
        libelleRecherche="Rechercher une échéance"
        libelleUnite="échéances"
        vide="Aucune échéance ne correspond."
      />
    </div>
  );
}

/** Les échéances qui ne sont pas des documents : leur nom dans le filtre. */
const LIBELLE_TYPE: Record<string, string> = { entretien: "Entretien", "contre-visite": "Contre-visite", "rendez-vous": "Rendez-vous de visite" };

export function EcranConformite(props: { echeances: Echeance[]; aujourdhui: string }) {
  return (
    <FournisseurEdition sujet="conformite" href="/conformite">
      <Interieur {...props} />
    </FournisseurEdition>
  );
}

export type { NiveauEcheance };
