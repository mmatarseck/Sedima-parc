import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte, Definitions } from "@/composants/interface/Carte";
import { BUSINESS_UNIT, CATEGORIE_VEHICULE, CLASSES_TON } from "@/domaine/libelles";
import { ETAT_LEGER, REGIME_USAGE, echeancierPlanCar, type Attributaire, type ForfaitCarburant, type VehiculeLeger } from "@/domaine/parc-leger";
import type { ParametresParcLeger } from "@/domaine/parametres";
import { montant, nombre } from "@/lib/format";

/**
 * La fiche d'un véhicule de service ou de fonction — ce que le dossier du
 * parc léger en sait : identité, attributaire, plan car, forfait carburant,
 * état et devenir. Elle s'ouvre depuis la liste Flotte, où le parc léger a
 * rejoint la flotte de transport le 7 septembre 2026. Ses transactions —
 * maintenance, documents, relevés — viendront avec la base ; la fiche le dit
 * plutôt que d'afficher des onglets vides.
 */
export function FicheVehiculeLeger({ vehicule, attributaire, forfait, regles, aujourdhui }: { vehicule: VehiculeLeger; attributaire: Attributaire | null; forfait: ForfaitCarburant | null; regles: ParametresParcLeger; aujourdhui: string }) {
  const etat = ETAT_LEGER[vehicule.etat];
  const echeancier = vehicule.planCar ? echeancierPlanCar(vehicule.planCar, regles.planCarDureeMois, aujourdhui) : null;
  const montantForfait = forfait ? (forfait.montantMensuel ?? regles.forfaitCarburantMensuel) : null;

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/flotte" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={2} />
          Flotte
        </Link>
      </nav>
      <TitreEcran
        titre={vehicule.immatriculationAffichee}
        sousTitre={`${vehicule.marque} ${vehicule.modele}${vehicule.annee ? ` · ${vehicule.annee}` : ""} · ${REGIME_USAGE[vehicule.regime].libelle}${vehicule.planCar ? " · plan car" : ""}`}
        actions={
          <span className={`badge-texte inline-block rounded-full px-2.5 py-0.5 ${CLASSES_TON[etat.ton]}`} title={etat.precision}>
            {etat.libelle}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Carte titre="Identité" precision="Ce que le dossier du parc en dit">
          <div className="px-5 pb-4">
            <Definitions
              elements={[
                { libelle: "Marque et modèle", valeur: `${vehicule.marque} ${vehicule.modele}` },
                { libelle: "Catégorie", valeur: CATEGORIE_VEHICULE[vehicule.categorie] },
                { libelle: "Année", valeur: vehicule.annee ? String(vehicule.annee) : "—" },
                { libelle: "Kilométrage", valeur: vehicule.kilometrage === null ? "—" : `${nombre(vehicule.kilometrage)} km` },
                { libelle: "Régime d'usage", valeur: `${REGIME_USAGE[vehicule.regime].libelle} — ${REGIME_USAGE[vehicule.regime].precision}` },
                { libelle: "Département", valeur: vehicule.departement ?? "—" },
                { libelle: "Business unit", valeur: vehicule.businessUnit ? BUSINESS_UNIT[vehicule.businessUnit] : "—" },
                { libelle: "Lot 2026", valeur: vehicule.lot ?? "—" },
              ]}
            />
          </div>
        </Carte>

        <Carte titre={attributaire ? "Attributaire" : "Pool"} precision={attributaire ? "La personne qui tient le véhicule" : "Le service ou le site qui en dispose"}>
          <div className="px-5 pb-4">
            <Definitions
              elements={[
                { libelle: attributaire ? "Nom" : "Pool", valeur: attributaire?.nom ?? vehicule.pool ?? "Non affecté" },
                { libelle: "Fonction", valeur: attributaire?.fonction ?? "—" },
                { libelle: "Département", valeur: attributaire?.departement ?? vehicule.departement ?? "—" },
                { libelle: "Forfait carburant", valeur: montantForfait === null ? "aucun" : `${montant(montantForfait)} par mois, sur la BU de l'agent` },
                {
                  libelle: "Plan car",
                  valeur: echeancier
                    ? echeancier.cessionPrevue
                      ? `${echeancier.moisEcoules}/${echeancier.dureeMois} mois — cession prévue ${echeancier.cessionPrevue}`
                      : `${echeancier.dureeMois} mois — date de début à renseigner pour dater la cession`
                    : "non",
                },
              ]}
            />
          </div>
        </Carte>
      </div>

      <Carte titre="État et devenir" precision={etat.precision}>
        <p className="px-5 pb-4 text-[13px] leading-[1.5] text-texte">{vehicule.commentaire ?? "Rien à signaler dans le dossier."}</p>
      </Carte>

      <Carte titre="Ce qui viendra avec la base" precision="La fiche complète, comme celle des véhicules de transport">
        <p className="meta px-5 pb-4 leading-[1.5]">
          Maintenance, documents, relevés et dépenses de ce véhicule ne sont pas encore tenus dans l&apos;application : le dossier du parc n&apos;en porte pas l&apos;historique. Ils s&apos;ajouteront ici, onglet par onglet, à mesure que les saisies commenceront.
        </p>
      </Carte>
    </div>
  );
}
