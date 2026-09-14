"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { champsCreation } from "@/composants/transactions/champs";
import { useEditionFacultative } from "@/composants/transactions/ContexteEdition";
import { idAttributaire } from "@/domaine/parc-leger";
import { peutCourant } from "@/lib/acces-courant";
import type { LigneFlotte } from "@/domaine/types";

/* ============================================================================
 * Qui conduit ce véhicule, dans une liste — et comment le changer sans la
 * quitter.
 *
 * Demande du métier du 14 septembre 2026, en trois points :
 *
 *   * **la fonction de la personne disparaît.** « Responsable Labo — transfert
 *     de vaccins et prélèvements » sur une ligne de douze pixels de haut ne se
 *     lisait pas, poussait le nom vers le haut et faisait respirer la liste
 *     moins bien. La fiche du véhicule la porte ; la liste veut un nom ;
 *   * **le nom mène à la personne.** Un chauffeur a sa fiche : on y va d'un
 *     clic, sans passer par le véhicule ;
 *   * **le crayon affecte.** Repérer un véhicule sans conducteur et l'affecter
 *     sont le même geste, au même endroit — c'est en parcourant la liste qu'on
 *     s'en aperçoit.
 *
 * L'attributaire d'un véhicule de service ou de fonction a désormais sa fiche
 * lui aussi (14 septembre 2026) : son nom y mène de la même façon. Ce qui les
 * sépare tient à l'affectation — celle d'un chauffeur se date et se change
 * d'ici, l'attribution d'un véhicule de fonction se change sur le véhicule.
 * ==========================================================================*/

export function ChauffeurDeLaLigne({ ligne }: { ligne: LigneFlotte }) {
  const edition = useEditionFacultative();
  const [peutSaisir, setPeutSaisir] = useState(false);
  useEffect(() => setPeutSaisir(peutCourant("flotte", "saisie")), []);

  const v = ligne.vehicule;
  /* Un véhicule de service ou de fonction : la personne qui le tient, ou le pool. */
  const attributaire = ligne.attributaire;
  const titulaire = ligne.chauffeurTitulaire;

  const crayon =
    edition && peutSaisir ? (
      <button
        type="button"
        title={titulaire ? `Changer l'affectation de ${v.immatriculationAffichee}` : `Affecter un chauffeur à ${v.immatriculationAffichee}`}
        onClick={(e) => {
          /* La ligne entière mène à la fiche : sans cela, affecter l'ouvrirait aussi. */
          e.preventDefault();
          e.stopPropagation();
          edition.creer({
            type: "affectation",
            titre: `Nouvelle affectation · ${v.immatriculationAffichee}`,
            champs: champsCreation("affectation", { pour: "planning" }),
            valeurs: { vehiculeId: v.id, role: "titulaire", debut: new Date().toISOString().slice(0, 10) },
            /* Rangée sur le véhicule de la ligne, pas sur la liste : c'est sa
               fiche et celle du chauffeur qui doivent la voir. */
            sujetDe: () => `vehicule:${v.immatriculation}`,
          });
        }}
        className="grid size-5 shrink-0 place-items-center rounded-[6px] text-attenue opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-surface-3 hover:text-accent-fonce"
      >
        <Pencil className="size-3" strokeWidth={1.9} />
        <span className="sr-only">{titulaire ? "Changer l'affectation" : "Affecter un chauffeur"}</span>
      </button>
    ) : null;

  if (attributaire) {
    /* Un pool n'est pas quelqu'un : « Pool DACI · DSI · CG » ne mène nulle part.
       Une personne nommée, si — sa fiche existe depuis le 14 septembre 2026. */
    return (
      <span className="flex min-w-0 items-center gap-1">
        {attributaire.pool ? (
          <span className="min-w-0 truncate text-texte-2">{attributaire.nom}</span>
        ) : (
          <Link
            href={`/attributaires/${idAttributaire(attributaire.nom)}`}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 truncate font-medium text-texte hover:text-accent-fonce hover:underline"
          >
            {attributaire.nom}
          </Link>
        )}
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      {titulaire ? (
        <Link href={`/chauffeurs/${titulaire.id}`} onClick={(e) => e.stopPropagation()} className="min-w-0 truncate font-medium text-texte hover:text-accent-fonce hover:underline">
          {titulaire.nom}
        </Link>
      ) : (
        <span className="min-w-0 truncate text-attenue-2">Non affecté</span>
      )}
      {ligne.nombreSuppleants > 0 ? <span className="meta shrink-0">+{ligne.nombreSuppleants}</span> : null}
      {crayon}
    </span>
  );
}
