"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Numero } from "@/composants/interface/Numero";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { CHAMPS } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { CATEGORIES_MAINTENANCE, systemeDe } from "@/domaine/categories-maintenance";
import type { Creation } from "@/domaine/cloture";
import type { TacheService } from "@/domaine/taches";
import { lireCreations } from "@/lib/clotures-demo";

/* ============================================================================
 * Paramètres › Catalogue des tâches de service (0060).
 *
 * La base des rapports de maintenance : chaque ligne d'un service cite une
 * tâche d'ici. Classée comme Fleetio — catégorie, système, ensemble —, tirée
 * de son export (342 tâches), et complétée à l'usage : une tâche écrite dans
 * un service qui n'existe pas encore y entre d'elle-même. Les tâches « à
 * classer » sont celles que l'import n'a pas su ranger : un clic, un système.
 * ==========================================================================*/

function fabriquerTache(c: Creation): TacheService {
  const v = c.valeurs;
  const systeme = typeof v.systeme === "string" && v.systeme ? v.systeme : null;
  return {
    numero: c.numero,
    libelle: String(v.libelle ?? ""),
    description: typeof v.description === "string" ? v.description : null,
    categorie: systemeDe(systeme)?.categorie ?? null,
    systeme,
    ensemble: typeof v.ensemble === "string" && v.ensemble ? v.ensemble : null,
    typeDefaut: v.typeDefaut === "preventif" || v.typeDefaut === "curatif" ? v.typeDefaut : null,
    alias: [],
    utilisations: 0,
    source: "saisie",
    aClasser: false,
    actif: v.actif === undefined ? true : Boolean(v.actif),
    creee: true,
  };
}

const FILTRES: FiltreListe<TacheService>[] = [
  { cle: "actives", libelle: "Proposées", retient: (t) => t.actif },
  { cle: "a-classer", libelle: "À classer", retient: (t) => t.aClasser },
  ...Object.entries(CATEGORIES_MAINTENANCE).map(([c, libelle]) => ({ cle: `cat-${c}`, libelle, retient: (t: TacheService) => (t.categorie ?? systemeDe(t.systeme)?.categorie) === c })),
  { cle: "toutes", libelle: "Toutes", retient: () => true },
];

export function EcranTachesService({ taches }: { taches: TacheService[] }) {
  return (
    <FournisseurEdition sujet="catalogue" href="/parametres/taches">
      <Interieur taches={taches} />
    </FournisseurEdition>
  );
}

function Interieur({ taches }: { taches: TacheService[] }) {
  const { creer, demander, surcharger, version } = useEdition();
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);
  const creees = useMemo(() => (monte ? lireCreations("catalogue").filter((c) => c.type === "tache").map(fabriquerTache) : []), [monte, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const toutes = useMemo(() => [...creees, ...taches.filter((t) => !creees.some((c) => c.numero === t.numero))].map((t) => surcharger(t)), [creees, taches, surcharger]);
  const aClasser = toutes.filter((t) => t.aClasser).length;

  function nouvelle() {
    creer({ type: "tache", titre: "Nouvelle tâche de service", champs: CHAMPS.tache, valeurs: { actif: true } });
  }
  function modifier(t: TacheService) {
    demander({ type: "tache", numero: t.numero, titre: `Tâche · ${t.libelle}`, champs: CHAMPS.tache, valeurs: t as unknown as Record<string, unknown> });
  }

  const colonnes = useMemo<ColonneListe<TacheService>[]>(
    () => [
      { cle: "libelle", libelle: "Tâche", parDefaut: true, largeur: 320, rendu: (t) => <span className="block truncate font-medium" title={t.description ?? t.libelle}>{t.libelle}</span> },
      { cle: "categorie", libelle: "Catégorie", parDefaut: true, largeur: 180, texte: (t) => CATEGORIES_MAINTENANCE[t.categorie ?? systemeDe(t.systeme)?.categorie ?? ""] ?? "", rendu: (t) => CATEGORIES_MAINTENANCE[t.categorie ?? systemeDe(t.systeme)?.categorie ?? ""] ?? <span className="text-attenue">—</span> },
      { cle: "systeme", libelle: "Système", parDefaut: true, largeur: 200, texte: (t) => systemeDe(t.systeme)?.libelle ?? "", rendu: (t) => (t.aClasser ? <Echeance ton="vigilance">À classer</Echeance> : (systemeDe(t.systeme)?.libelle ?? <span className="text-attenue">—</span>)) },
      { cle: "ensemble", libelle: "Ensemble", parDefaut: false, largeur: 100, rendu: (t) => <span className="code">{t.ensemble ?? "—"}</span> },
      { cle: "type", libelle: "Nature", parDefaut: true, largeur: 110, texte: (t) => (t.typeDefaut === "preventif" ? "Préventif" : t.typeDefaut === "curatif" ? "Curatif" : ""), rendu: (t) => (t.typeDefaut ? <Pastille ton={t.typeDefaut === "preventif" ? "favorable" : "vigilance"}>{t.typeDefaut === "preventif" ? "Préventif" : "Curatif"}</Pastille> : <span className="text-attenue">—</span>) },
      { cle: "utilisations", libelle: "Utilisations Fleetio", parDefaut: true, largeur: 150, alignee: "droite", tri: (t) => t.utilisations, rendu: (t) => <span className="code">{t.utilisations || "—"}</span> },
      { cle: "alias", libelle: "Aussi appelée", parDefaut: false, largeur: 240, rendu: (t) => <span className="block truncate text-texte-2">{t.alias.join(" · ") || "—"}</span> },
      { cle: "source", libelle: "Origine", parDefaut: false, largeur: 110, texte: (t) => (t.source === "fleetio" ? "Fleetio" : "Saisie"), rendu: (t) => (t.source === "fleetio" ? "Fleetio" : "Saisie") },
      { cle: "actif", libelle: "Proposée", parDefaut: false, largeur: 100, texte: (t) => (t.actif ? "oui" : "non"), rendu: (t) => (t.actif ? "Oui" : <span className="text-attenue">Non</span>) },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <Link href="/parametres" className="meta inline-flex items-center gap-1 hover:text-texte">
        <ChevronLeft className="size-3.5" strokeWidth={1.8} />
        Paramètres
      </Link>
      <TitreEcran
        titre="Catalogue des tâches de service"
        sousTitre={`${toutes.length} tâches, classées comme Fleetio — catégorie, système, ensemble${aClasser ? ` · ${aClasser} à classer` : ""}`}
        actions={
          <button type="button" onClick={nouvelle} className="bouton-principal">
            <Plus className="size-4" strokeWidth={2.2} />
            Nouvelle tâche
          </button>
        }
      />
      <TableListe<TacheService>
        ecran="taches-service"
        lignes={toutes}
        cle={(t) => t.numero}
        href={() => "/parametres/taches"}
        filet={(t) => (t.aClasser ? { couleur: "var(--color-vigilance)", libelle: "À classer", precision: "L'import n'a pas reconnu son système" } : { couleur: "var(--color-accent)", libelle: systemeDe(t.systeme)?.libelle ?? "Classée", precision: CATEGORIES_MAINTENANCE[t.categorie ?? systemeDe(t.systeme)?.categorie ?? ""] ?? "" })}
        identifiant={{ cle: "numero", libelle: "Réf.", largeur: 140, rendu: (t) => <Numero valeur={t.numero} /> }}
        colonnes={colonnes}
        filtres={FILTRES}
        champsRecherche={(t) => [t.numero, t.libelle, t.description ?? "", ...t.alias, systemeDe(t.systeme)?.libelle ?? "", t.ensemble ?? ""]}
        placeholderRecherche="Tâche, système, autre nom…"
        libelleRecherche="Rechercher une tâche"
        libelleUnite="tâches"
        vide="Aucune tâche — la migration 0060 et le fichier taches-service.sql sont-ils joués ?"
        surLigne={modifier}
      />
    </div>
  );
}
