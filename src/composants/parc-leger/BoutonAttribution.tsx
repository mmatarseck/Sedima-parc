"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { champsCreation } from "@/composants/transactions/champs";
import { useEditionFacultative } from "@/composants/transactions/ContexteEdition";
import { peutCourant } from "@/lib/acces-courant";
import { jourCourant } from "@/domaine/temps";

/**
 * Changer ou retirer l'attributaire d'un véhicule, depuis sa fiche.
 *
 * La carte « Détenteur » se lisait sans qu'on puisse rien en faire, et deux
 * commentaires de l'application affirmaient pourtant que l'attribution « se
 * change sur la fiche du véhicule ». C'était faux : aucun écran ne le
 * permettait (corrigé le 15 septembre 2026).
 *
 * Le bouton ne s'affiche que là où une modale peut s'ouvrir et pour qui a le
 * droit de saisir — ailleurs, la carte reste en lecture, ce qui vaut mieux
 * qu'un bouton qui ne mène nulle part.
 */
export function BoutonAttribution({ vehiculeId, immatriculation, immatriculationAffichee }: { vehiculeId: string; immatriculation: string | null; immatriculationAffichee: string }) {
  const edition = useEditionFacultative();
  const [peutSaisir, setPeutSaisir] = useState(false);
  useEffect(() => setPeutSaisir(peutCourant("flotte", "saisie")), []);
  if (!edition || !peutSaisir) return null;

  return (
    <button
      type="button"
      onClick={() =>
        edition.creer({
          type: "attribution",
          titre: `Attribution · ${immatriculationAffichee}`,
          champs: champsCreation("attribution", { pour: "vehicule" }),
          valeurs: { vehiculeId, debut: jourCourant() },
          /* Rangée sur le véhicule : c'est sa fiche, et celle de l'attributaire,
             qui doivent voir le changement. */
          sujetDe: () => `vehicule:${immatriculation ?? vehiculeId}`,
        })
      }
      className="bouton-secondaire h-9"
    >
      <Pencil className="size-4 text-texte-2" strokeWidth={1.7} />
      Changer
    </button>
  );
}
