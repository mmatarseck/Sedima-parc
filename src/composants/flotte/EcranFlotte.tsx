"use client";

import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { TableFlotte } from "@/composants/flotte/TableFlotte";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerLigneFlotte } from "@/composants/transactions/fabriques";
import type { LigneFlotte } from "@/domaine/types";

/* ============================================================================
 * Flotte — la liste. L'entrée d'un nouveau véhicule a sa page (`/flotte/nouveau`),
 * en six sections sur le modèle de Fleetio ; le véhicule créé apparaît ici en
 * tête de liste, sous son numéro VEH.
 * ==========================================================================*/

export function EcranFlotte({ lignes }: { lignes: LigneFlotte[] }) {
  return (
    <FournisseurEdition sujet="flotte" href="/flotte">
      <Interieur lignes={lignes} />
    </FournisseurEdition>
  );
}

function Interieur({ lignes }: { lignes: LigneFlotte[] }) {
  const { creations } = useEdition();
  const creees = creations("vehicule", fabriquerLigneFlotte);
  const toutes = [...creees, ...lignes];

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Flotte"
        sousTitre={`${toutes.length} véhicules${creees.length ? ` dont ${creees.length} créé${creees.length > 1 ? "s" : ""} ici` : ""} · données de démonstration, inventaire de référence non encore figé`}
        actions={
          <>
            {/* L'export vit dans Rapports, où les colonnes sont typées : un
                classeur y part avec ses en-têtes, ses totaux et le cartouche qui
                dit à quelles conditions il a été tiré. Réécrire ici un export
                approximatif donnerait deux vérités pour le même tableau. */}
            <Link href="/rapports/flotte-details" className="bouton-secondaire" title="Ouvre le rapport « Détail des véhicules », d'où le classeur se tire avec ses colonnes et ses filtres">
              <Download className="size-4 text-texte-2" strokeWidth={1.7} />
              Exporter
            </Link>
            <Link href="/flotte/nouveau" className="bouton-principal">
              <Plus className="size-4" strokeWidth={2.2} />
              Ajouter un véhicule
            </Link>
          </>
        }
      />

      <TableFlotte lignes={toutes} />
    </div>
  );
}
