"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { TableFlotte } from "@/composants/flotte/TableFlotte";
import { champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerLigneFlotte } from "@/composants/transactions/fabriques";
import type { LigneFlotte } from "@/domaine/types";
import { apprendreVehicule } from "@/lib/parametres-demo";

/* ============================================================================
 * Flotte — la liste, et l'entrée d'un nouveau véhicule.
 *
 * La création passe par la même modale que toute transaction (référence VEH,
 * trace, mois clos). Elle demande la **première visite technique** : pour un
 * véhicule léger neuf, l'agent saisit la date que la réglementation lui
 * accorde — pas de règle d'exemption dans l'application (décision du métier,
 * 3 septembre 2026). Le véhicule créé apparaît en tête de liste avec cette
 * échéance ; sa fiche 360° viendra avec la base.
 *
 * Marque, modèle et catégorie viennent de Paramètres › Véhicules ; une marque
 * ou un modèle saisis qui n'y sont pas encore y entrent à la création
 * (demande du métier du 7 septembre 2026).
 * ==========================================================================*/

export function EcranFlotte({ lignes }: { lignes: LigneFlotte[] }) {
  return (
    <FournisseurEdition sujet="flotte" href="/flotte">
      <Interieur lignes={lignes} />
    </FournisseurEdition>
  );
}

function Interieur({ lignes }: { lignes: LigneFlotte[] }) {
  const { creer, creations } = useEdition();
  const [avis, setAvis] = useState<string | null>(null);
  const creees = creations("vehicule", fabriquerLigneFlotte);
  const toutes = [...creees, ...lignes];

  function ajouter() {
    creer({
      type: "vehicule",
      titre: "Nouveau véhicule",
      champs: champsCreation("vehicule", { pour: "vehicule" }),
      valeurs: { categorie: "camion", categorieFlotte: "interne", usage: "fourgon", energie: "gasoil", transportSpecial: "non", engage: "oui" },
      sujetDe: () => "flotte",
      apresCreation: (c) => {
        const marque = typeof c.valeurs.marque === "string" ? c.valeurs.marque : "";
        const modele = typeof c.valeurs.appellation === "string" ? c.valeurs.appellation : null;
        void apprendreVehicule(marque, modele).then((refus) => setAvis(refus ? `Le véhicule est créé, mais le référentiel n'a pas retenu sa marque : ${refus}` : null));
      },
    });
  }

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Flotte"
        sousTitre={`${toutes.length} véhicules${creees.length ? ` dont ${creees.length} créé${creees.length > 1 ? "s" : ""} ici` : ""} · données de démonstration, inventaire de référence non encore figé`}
        actions={
          <>
            {avis ? <span className="max-w-[360px] text-[12.5px] leading-[1.4] text-defavorable">{avis}</span> : null}
            {/* L'export vit dans Rapports, où les colonnes sont typées : un
                classeur y part avec ses en-têtes, ses totaux et le cartouche qui
                dit à quelles conditions il a été tiré. Réécrire ici un export
                approximatif donnerait deux vérités pour le même tableau. */}
            <Link href="/rapports/flotte-details" className="bouton-secondaire" title="Ouvre le rapport « Détail des véhicules », d'où le classeur se tire avec ses colonnes et ses filtres">
              <Download className="size-4 text-texte-2" strokeWidth={1.7} />
              Exporter
            </Link>
            <button type="button" onClick={ajouter} className="bouton-principal">
              <Plus className="size-4" strokeWidth={2.2} />
              Ajouter un véhicule
            </button>
          </>
        }
      />

      <TableFlotte lignes={toutes} />
    </div>
  );
}
