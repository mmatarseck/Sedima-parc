"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
          /* Corriger le nom change l'adresse de la fiche, qui s'en dérive :
             sans ce saut, le rafraîchissement tombait sur l'ancienne et rendait
             un 404 (signalé le 15 septembre 2026). L'identifiant de la table
             vaut avant comme après ; l'adresse par le nom, elle, ne répondrait
             qu'une fois la base écrite, et l'écriture est encore en vol. */
          apresModification: (apres) => {
            const suivant = String(apres.nom ?? "").trim();
            if (suivant && suivant !== attributaire.nom.trim()) router.replace(`/attributaires/${attributaire.id}`);
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
