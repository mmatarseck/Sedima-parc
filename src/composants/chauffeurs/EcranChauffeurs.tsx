"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Plus, Trophy } from "lucide-react";
import { TableAttributaires } from "@/composants/chauffeurs/TableAttributaires";
import { TableChauffeurs } from "@/composants/chauffeurs/TableChauffeurs";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerLigneAttributaire, fabriquerLigneChauffeur } from "@/composants/transactions/fabriques";
import type { LigneChauffeur } from "@/domaine/chauffeur";
import type { LigneAttributaire } from "@/domaine/parc-leger";

/* ============================================================================
 * Conducteurs — les deux populations, et l'entrée d'un nouveau chauffeur.
 *
 * Comme la Flotte, pas de bandeau de KPI : on y retrouve quelqu'un, on compare
 * des échéances et des compteurs. Ce qui s'agrège est sur la fiche et sur le
 * tableau de bord.
 *
 * DEUX VOLETS, DEMANDE DU MÉTIER DU 14 SEPTEMBRE 2026. Tout attributaire d'un
 * véhicule doit avoir sa fiche, « mais on doit pouvoir les filtrer en ne
 * regardant que les chauffeurs du parc ou les autres conducteurs ». D'où un
 * sélecteur à deux volets plutôt qu'une liste mêlée : les deux populations ne
 * se comparent pas — le chauffeur du parc doit son permis, sa visite médicale
 * et son aptitude, l'attributaire tient un véhicule au titre de sa fonction et
 * ne doit rien de tout cela au parc. Les mêmes colonnes pour les deux
 * afficheraient l'un comme non conforme faute de pièces qu'on n'a pas à lui
 * réclamer.
 *
 * La création passe par la même modale que toute transaction — référence CHA,
 * trace, mois clos. Elle demande le **permis** et sa validité : un chauffeur
 * enregistré sans permis apparaîtrait comme non conforme dès sa première
 * journée, ce qui est vrai mais inutilisable.
 *
 * LE BOUTON SUIT LE VOLET, DEMANDE DU 15 SEPTEMBRE 2026 : « à l'ajout d'un
 * autre conducteur, il faut pouvoir spécifier pour ne pas le mettre dans la
 * liste des chauffeurs du parc ». Ajouter quelqu'un menait toujours chez les
 * chauffeurs, avec ses pièces obligatoires — la seule façon d'enregistrer un
 * autre conducteur était donc de le faire passer pour ce qu'il n'est pas.
 * Depuis le volet « Autres conducteurs », le même bouton ouvre la fiche courte
 * de l'attributaire : un nom, une fonction, un département. Ce que la personne
 * tient viendra d'une attribution, sur la fiche du véhicule — le parc ne décide
 * pas ici qui conduit quoi.
 * ==========================================================================*/

type Volet = "chauffeurs" | "attributaires";

export function EcranChauffeurs({ lignes, attributaires }: { lignes: LigneChauffeur[]; attributaires: LigneAttributaire[] }) {
  return (
    <FournisseurEdition sujet="chauffeurs" href="/chauffeurs">
      <Interieur lignes={lignes} attributaires={attributaires} />
    </FournisseurEdition>
  );
}

function Interieur({ lignes, attributaires }: { lignes: LigneChauffeur[]; attributaires: LigneAttributaire[] }) {
  const { creer, creations } = useEdition();
  const [volet, setVolet] = useState<Volet>("chauffeurs");
  const creees = creations("chauffeur", fabriquerLigneChauffeur);
  const toutes = [...creees, ...lignes];
  const actifs = toutes.filter((l) => l.chauffeur.actif).length;
  const creesAutres = creations("attributaire", fabriquerLigneAttributaire);
  const tousAutres = [...creesAutres, ...attributaires];
  const dotes = tousAutres.filter((a) => a.situation !== "sans-vehicule").length;

  function ajouter() {
    if (volet === "attributaires") {
      creer({
        type: "attributaire",
        titre: "Nouvel autre conducteur",
        champs: champsCreation("attributaire", { pour: "chauffeur" }),
        /* Rien à proposer : une fiche d'autre conducteur naît active, et le
           reste se lit sur la personne — on n'en préremplit aucun champ. */
        valeurs: {},
        sujetDe: () => "chauffeurs",
      });
      return;
    }
    creer({
      type: "chauffeur",
      titre: "Nouveau chauffeur",
      champs: champsCreation("chauffeur", { pour: "chauffeur" }),
      valeurs: { contrat: "salarie", aptitude: "apte", actif: "oui" },
      sujetDe: () => "chauffeurs",
    });
  }

  const sousTitre =
    volet === "chauffeurs"
      ? `${actifs} en activité sur ${toutes.length}${creees.length ? ` dont ${creees.length} créé${creees.length > 1 ? "s" : ""} ici` : ""} · conducteurs salariés du parc`
      : `${dotes} doté${dotes > 1 ? "s" : ""} sur ${tousAutres.length} · personnes qui tiennent un véhicule de service ou de fonction`;

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Chauffeurs"
        sousTitre={sousTitre}
        actions={
          <>
            <Link href="/chauffeurs/classement" className="bouton-secondaire">
              <Trophy className="size-4 text-texte-2" strokeWidth={1.7} />
              Chauffeur du mois
            </Link>
            {/* L'export vit dans Rapports, où les colonnes sont typées : le
                classeur y part avec ses en-têtes, ses totaux et le cartouche qui
                dit à quelles conditions il a été tiré. */}
            <Link href="/rapports/chauffeurs-details" className="bouton-secondaire" title="Ouvre le rapport « Détail des chauffeurs », d'où le classeur se tire avec ses colonnes et ses filtres">
              <Download className="size-4 text-texte-2" strokeWidth={1.7} />
              Exporter
            </Link>
            <button type="button" onClick={ajouter} className="bouton-principal">
              <Plus className="size-4" strokeWidth={2.2} />
              {volet === "chauffeurs" ? "Ajouter un chauffeur" : "Ajouter un autre conducteur"}
            </button>
          </>
        }
      />

      <div className="flex h-9 shrink-0 items-center gap-0.5 self-start rounded-full bg-surface-3 p-1" role="group" aria-label="Population de conducteurs">
        {(
          [
            ["chauffeurs", `Chauffeurs du parc (${toutes.length})`],
            ["attributaires", `Autres conducteurs (${tousAutres.length})`],
          ] as const
        ).map(([cle, libelle]) => (
          <button
            key={cle}
            type="button"
            aria-pressed={volet === cle}
            onClick={() => setVolet(cle)}
            className={[
              "h-7 rounded-full px-3.5 text-[12.5px] whitespace-nowrap transition-colors",
              volet === cle ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte",
            ].join(" ")}
          >
            {libelle}
          </button>
        ))}
      </div>

      {volet === "chauffeurs" ? <TableChauffeurs lignes={toutes} /> : <TableAttributaires lignes={tousAutres} />}
    </div>
  );
}
