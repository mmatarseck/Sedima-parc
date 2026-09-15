"use client";

import { useEffect, useState } from "react";
import { Pencil, TriangleAlert } from "lucide-react";
import { PastilleStatut } from "@/composants/interface/Pastille";
import { useEditionFacultative } from "@/composants/transactions/ContexteEdition";
import { CHAMPS } from "@/composants/transactions/champs";
import { peutCourant } from "@/lib/acces-courant";
import { TYPE_DOCUMENT } from "@/domaine/libelles";
import type { StatutVehicule, TypeDocument } from "@/domaine/types";

/* ============================================================================
 * Le statut d'un véhicule, changé là où il se lit.
 *
 * Demande du métier du 14 septembre 2026 : « changer le statut en cliquant sur
 * le statut partout où il est affiché, hors rapport, en disposant le crayon à
 * côté ». Le statut d'un camion change au téléphone, dans la cour, devant le
 * camion — pas au retour au bureau sur sa fiche : le faire depuis la liste, le
 * planning ou la disponibilité évite le détour qui fait qu'on ne le fait pas.
 *
 * **Un seul chemin d'écriture.** Le crayon ouvre le formulaire de changement de
 * statut, celui-là même que la fiche ouvre : il pose la période, son motif et
 * sa trace, et `poserStatut` écrit la ligne du véhicule. Un raccourci qui
 * aurait posé le statut sans période aurait fait deux vérités pour un champ.
 *
 * **Hors rapport**, comme demandé : un rapport est un tirage daté, pas un
 * écran de travail — on n'y corrige pas la donnée, on la lit telle qu'elle
 * était. Le composant n'y est donc pas employé.
 *
 * **Un document échu avertit, il n'interdit plus.** Jusqu'au 15 septembre 2026,
 * une immobilisation administrative verrouillait le statut : un cadenas
 * remplaçait le crayon, et le statut ne se libérait qu'au renouvellement du
 * document. Le métier l'a fait retirer, et la raison se tient — un camion dont
 * l'assurance est échue roule peut-être encore, ou attend au garage, ou part en
 * mutation. L'application décidait à la place de ceux qui voient le camion, et
 * leur interdisait ensuite de rectifier.
 *
 * Le document échu reste dit, en rouge, au survol comme au lecteur d'écran. Il
 * informe au lieu de décider : un avertissement qu'on peut passer outre vaut
 * mieux qu'une règle qu'on contourne en saisissant n'importe quoi ailleurs.
 *
 * Sans le niveau « saisie » sur la flotte, le crayon ne s'affiche toujours pas.
 * ==========================================================================*/

export function StatutModifiable({
  statut,
  immatriculation,
  immatriculationAffichee,
  compacte,
  /** Les documents qui immobilisent : le statut est alors tenu par eux. */
  immobilisation,
  /** Le jour proposé comme début de la période ; celui de l'écran. */
  aujourdhui = new Date().toISOString().slice(0, 10),
}: {
  statut: StatutVehicule;
  immatriculation: string;
  immatriculationAffichee: string;
  compacte?: boolean;
  immobilisation?: { type: TypeDocument }[] | null;
  aujourdhui?: string;
}) {
  const edition = useEditionFacultative();
  /* Le droit se lit au montage : le serveur ne rend pas la même page à tous,
     et un bouton rendu puis retiré ferait sauter la ligne. */
  const [peutSaisir, setPeutSaisir] = useState(false);
  useEffect(() => setPeutSaisir(peutCourant("flotte", "saisie")), []);

  const aDocumentEchu = Boolean(immobilisation?.length);
  const modifiable = Boolean(edition) && peutSaisir;

  return (
    <span className="inline-flex items-center gap-1">
      <PastilleStatut statut={statut} compacte={compacte} />
      {aDocumentEchu ? (
        <span
          title={`Document à renouveler — ${immobilisation!.map((d) => TYPE_DOCUMENT[d.type].toLowerCase()).join(", ")}. Le véhicule ne devrait pas rouler tant qu'il n'est pas en règle.`}
          className="grid size-6 shrink-0 place-items-center text-defavorable"
        >
          <TriangleAlert className="size-3.5" strokeWidth={1.9} />
          <span className="sr-only">Document critique échu ou manquant</span>
        </span>
      ) : null}
      {modifiable ? (
        <button
          type="button"
          title={`Changer le statut de ${immatriculationAffichee}`}
          onClick={(e) => {
            /* La pastille vit souvent dans une ligne cliquable qui mène à la
               fiche : sans cela, changer le statut ouvrirait aussi la fiche. */
            e.preventDefault();
            e.stopPropagation();
            edition!.creer({
              type: "statut",
              titre: `Changement de statut · ${immatriculationAffichee}`,
              champs: CHAMPS.statut,
              valeurs: { statut, debut: aujourdhui, dateSortie: aujourdhui, vehiculeId: immatriculation },
              sujetDe: () => `vehicule:${immatriculation}`,
            });
          }}
          className="grid size-6 shrink-0 place-items-center rounded-[6px] text-attenue transition-colors hover:bg-surface-3 hover:text-accent-fonce focus-visible:bg-surface-3 focus-visible:text-accent-fonce"
        >
          <Pencil className="size-3.5" strokeWidth={1.8} />
          <span className="sr-only">Changer le statut de {immatriculationAffichee}</span>
        </button>
      ) : null}
    </span>
  );
}
