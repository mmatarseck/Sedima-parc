"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { CHAMPS } from "@/composants/transactions/champs";
import { useEditionFacultative } from "@/composants/transactions/ContexteEdition";
import { peutCourant } from "@/lib/acces-courant";
import type { Attributaire } from "@/domaine/parc-leger";

/**
 * Corriger la fiche d'un attributaire — son nom, sa fonction, son département.
 *
 * Elle se lisait sans qu'on puisse rien en faire : un chauffeur du parc a son
 * « Modifier » depuis toujours, l'autre conducteur n'en avait pas (demande du
 * métier du 15 septembre 2026, « garder la possibilité de mettre à jour un
 * chauffeur et autre conducteur »).
 *
 * Le véhicule qu'il tient n'est pas ici : il se change par une attribution,
 * qui se date et garde son histoire.
 */
export function BoutonFicheAttributaire({ attributaire }: { attributaire: Attributaire }) {
  const edition = useEditionFacultative();
  const [peutSaisir, setPeutSaisir] = useState(false);
  useEffect(() => setPeutSaisir(peutCourant("chauffeurs", "saisie")), []);
  if (!edition || !peutSaisir) return null;

  return (
    <button
      type="button"
      onClick={() =>
        edition.demander({
          type: "attributaire",
          numero: `ATB-${attributaire.id}`,
          titre: `Fiche ${attributaire.nom}`,
          champs: CHAMPS.attributaire,
          valeurs: {
            nom: attributaire.nom,
            fonction: attributaire.fonction ?? "",
            departement: attributaire.departement ?? "",
            businessUnit: attributaire.businessUnit ?? "",
            actif: attributaire.actif,
          },
        })
      }
      className="bouton-secondaire h-9"
    >
      <Pencil className="size-4 text-texte-2" strokeWidth={1.7} />
      Modifier
    </button>
  );
}
