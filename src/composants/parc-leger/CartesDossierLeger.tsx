import { Carte, Definitions } from "@/composants/interface/Carte";
import { ETAT_LEGER, echeancierPlanCar, type Attributaire, type ForfaitCarburant, type VehiculeLeger } from "@/domaine/parc-leger";
import type { ParametresParcLeger } from "@/domaine/parametres";
import { montant } from "@/lib/format";

/**
 * Ce que le dossier du parc léger sait d'un véhicule de service ou de fonction :
 * qui le tient, son forfait carburant, son plan car, et son devenir.
 *
 * Ces cartes vivaient dans la fiche réduite du parc léger, que les véhicules
 * de service et de fonction ouvraient **à la place** de la fiche complète —
 * alors que la base les porte tous, avec leurs documents, leurs interventions
 * et leurs dépenses (11 septembre 2026, AA-019-EA). La fiche complète s'ouvre
 * désormais pour eux aussi, et ces cartes y prennent la place du détenteur.
 */
export function CartesDossierLeger({ vehicule, attributaire, forfait, regles, aujourdhui }: { vehicule: VehiculeLeger; attributaire: Attributaire | null; forfait: ForfaitCarburant | null; regles: ParametresParcLeger; aujourdhui: string }) {
  const etat = ETAT_LEGER[vehicule.etat];
  const echeancier = vehicule.planCar ? echeancierPlanCar(vehicule.planCar, regles.planCarDureeMois, aujourdhui) : null;
  const montantForfait = forfait ? (forfait.montantMensuel ?? regles.forfaitCarburantMensuel) : null;
  return (
    <>
      <Carte titre={attributaire ? "Détenteur" : "Pool"} precision={attributaire ? "Le véhicule est attribué, non affecté à un chauffeur" : "Le service ou le site qui en dispose"}>
        <Definitions
          elements={[
            { libelle: attributaire ? "Nom" : "Pool", valeur: attributaire?.nom ?? vehicule.pool ?? "Non affecté" },
            { libelle: "Fonction", valeur: attributaire?.fonction ?? null },
            { libelle: "Département", valeur: attributaire?.departement ?? vehicule.departement ?? null },
            { libelle: "Forfait carburant", valeur: montantForfait === null ? "aucun" : `${montant(montantForfait)} par mois, sur la BU de l'agent` },
            {
              libelle: "Plan car",
              valeur: echeancier
                ? echeancier.cessionPrevue
                  ? `${echeancier.moisEcoules}/${echeancier.dureeMois} mois — cession prévue ${echeancier.cessionPrevue}`
                  : `${echeancier.dureeMois} mois — date de début à renseigner pour dater la cession`
                : "non",
            },
            { libelle: "Lot 2026", valeur: vehicule.lot ?? null },
          ]}
        />
      </Carte>
      <Carte titre="Dossier du parc léger" precision={etat.precision}>
        <p className="px-5 pb-4 text-[13px] leading-[1.5] text-texte">
          {etat.libelle} — {vehicule.commentaire ?? "rien à signaler dans le dossier."}
        </p>
      </Carte>
    </>
  );
}
