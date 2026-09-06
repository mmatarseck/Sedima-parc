"use client";

import Link from "next/link";
import { Download, Plus, Trophy } from "lucide-react";
import { TableChauffeurs } from "@/composants/chauffeurs/TableChauffeurs";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerLigneChauffeur } from "@/composants/transactions/fabriques";
import type { LigneChauffeur } from "@/domaine/chauffeur";

/* ============================================================================
 * Chauffeurs — la liste, et l'entrée d'un nouveau conducteur.
 *
 * Comme la Flotte, pas de bandeau de KPI : on y retrouve quelqu'un, on compare
 * des échéances et des compteurs. Ce qui s'agrège est sur la fiche et sur le
 * tableau de bord.
 *
 * La création passe par la même modale que toute transaction — référence CHA,
 * trace, mois clos. Elle demande le **permis** et sa validité : un chauffeur
 * enregistré sans permis apparaîtrait comme non conforme dès sa première
 * journée, ce qui est vrai mais inutilisable.
 * ==========================================================================*/

export function EcranChauffeurs({ lignes }: { lignes: LigneChauffeur[] }) {
  return (
    <FournisseurEdition sujet="chauffeurs" href="/chauffeurs">
      <Interieur lignes={lignes} />
    </FournisseurEdition>
  );
}

function Interieur({ lignes }: { lignes: LigneChauffeur[] }) {
  const { creer, creations } = useEdition();
  const creees = creations("chauffeur", fabriquerLigneChauffeur);
  const toutes = [...creees, ...lignes];
  const actifs = toutes.filter((l) => l.chauffeur.actif).length;

  function ajouter() {
    creer({
      type: "chauffeur",
      titre: "Nouveau chauffeur",
      champs: champsCreation("chauffeur", { pour: "chauffeur" }),
      valeurs: { contrat: "salarie", aptitude: "apte", actif: "oui" },
      sujetDe: () => "chauffeurs",
    });
  }

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Chauffeurs"
        sousTitre={`${actifs} en activité sur ${toutes.length}${creees.length ? ` dont ${creees.length} créé${creees.length > 1 ? "s" : ""} ici` : ""} · données de démonstration, dérivées des fiches véhicules`}
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
              Ajouter un chauffeur
            </button>
          </>
        }
      />

      <TableChauffeurs lignes={toutes} />
    </div>
  );
}
