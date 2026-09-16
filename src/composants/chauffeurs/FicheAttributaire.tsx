import { LienRetour } from "@/composants/interface/LienRetour";
import Link from "next/link";
import { Building2, Fuel } from "lucide-react";
import { Carte, Definitions } from "@/composants/interface/Carte";
import { BoutonFicheAttributaire } from "./BoutonFicheAttributaire";
import { Pastille } from "@/composants/interface/Pastille";
import { BUSINESS_UNIT } from "@/domaine/libelles";
import { ETAT_LEGER, REGIME_USAGE, SITUATION_ATTRIBUTAIRE, echeancierPlanCar, type LigneAttributaire } from "@/domaine/parc-leger";
import type { ParametresParcLeger } from "@/domaine/parametres";
import { kilometrage, montant } from "@/lib/format";

/* ============================================================================
 * Fiche d'un attributaire — « les autres conducteurs ».
 *
 * Demande du métier du 14 septembre 2026 : tout attributaire d'un véhicule doit
 * avoir sa fiche. Elle est délibérément plus courte que celle d'un chauffeur du
 * parc, et ce n'est pas un manque : ce qui remplit une fiche chauffeur — le
 * permis, la visite médicale, l'aptitude, les kilomètres attribués, les
 * contraventions, le classement du mois — ne s'applique pas à quelqu'un qui
 * tient un véhicule au titre de sa fonction. En afficher les cadres vides
 * laisserait croire à des données manquantes ; la fiche ne porte donc que ce
 * que le parc sait réellement de lui.
 *
 * CE QUI SE MODIFIE ICI, ET CE QUI NE S'Y MODIFIE PAS. L'identité se corrige
 * d'ici — le nom, la fonction, le département —, comme sur une fiche chauffeur.
 * Le véhicule tenu, non : il se change par une **attribution**, qui se date et
 * garde son histoire, et cela se fait sur la fiche du véhicule ou depuis la
 * liste Flotte.
 * ==========================================================================*/

export function FicheAttributaire({ ligne, regles, aujourdhui }: { ligne: LigneAttributaire; regles: ParametresParcLeger; aujourdhui: string }) {
  const a = ligne.attributaire;
  const situation = SITUATION_ATTRIBUTAIRE[ligne.situation];

  return (
    <div className="flex flex-col lg:h-full">
      {/* ---- En-tête ---- */}
      <div className="flex shrink-0 flex-col gap-4 border-b border-bordure px-8 pt-6 pb-5">
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
          <LienRetour href="/chauffeurs" libelle="Chauffeurs" />
        </nav>

        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-fond text-[15px] font-semibold text-accent-tres-fonce">{ligne.initiales}</span>
          <div className="min-w-0 flex-1 basis-[360px]">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="titre-page">{ligne.nom}</h1>
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface-3 px-2.5 text-[12px] font-medium text-texte-2" title={situation.precision}>
                <span className="size-2 rounded-full" style={{ backgroundColor: situation.couleur }} />
                {situation.libelle}
              </span>
              {a.actif ? null : <Pastille ton="neutre">Sortie</Pastille>}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-texte-2">
              <span>{a.fonction ?? "Fonction non renseignée"}</span>
              {a.departement ? (
                <>
                  <span className="text-attenue-2">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-attenue" strokeWidth={1.8} />
                    {a.departement}
                  </span>
                </>
              ) : null}
              {ligne.forfaitMensuel !== null ? (
                <>
                  <span className="text-attenue-2">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Fuel className="size-3.5 text-attenue" strokeWidth={1.8} />
                    {montant(ligne.forfaitMensuel)} par mois
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {/* ---- Contenu ---- */}
      <div className="flex flex-col gap-5 px-8 py-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
          <Carte titre="Identité" precision="Ce que le référentiel du parc tient de la personne" action={<BoutonFicheAttributaire attributaire={a} />}>
            <Definitions
              elements={[
                { libelle: "Nom", valeur: a.nom },
                { libelle: "Fonction", valeur: a.fonction },
                { libelle: "Département", valeur: a.departement },
                { libelle: "Business unit", valeur: a.businessUnit ? BUSINESS_UNIT[a.businessUnit] : null },
                { libelle: "Situation", valeur: situation.libelle },
                { libelle: "Au parc", valeur: a.actif ? "Attributaire en cours" : "Sorti — consultable, plus attributaire" },
              ]}
            />
          </Carte>

          <Carte
            titre="Carburant"
            precision={
              ligne.forfaitMensuel === null
                ? "Aucun forfait : le carburant de cette personne n'est pas pris en charge au forfait"
                : "Forfait mensuel sur carte, porté en charge sur la business unit de l'agent"
            }
          >
            <Definitions
              elements={[
                { libelle: "Forfait mensuel", valeur: ligne.forfaitMensuel === null ? "aucun" : montant(ligne.forfaitMensuel) },
                /* Le montant du dossier prime ; à défaut, celui des paramètres —
                   et la fiche dit lequel des deux s'applique. */
                {
                  libelle: "Origine du montant",
                  valeur: ligne.forfait === null ? null : ligne.forfait.montantMensuel === null ? `Paramètre du parc léger (${montant(regles.forfaitCarburantMensuel)})` : "Propre au dossier",
                },
                { libelle: "Carte", valeur: ligne.forfait?.carte ?? null },
                { libelle: "Business unit portant la charge", valeur: a.businessUnit ? BUSINESS_UNIT[a.businessUnit] : null },
              ]}
            />
          </Carte>
        </div>

        <Carte
          titre={ligne.vehicules.length > 1 ? `Véhicules tenus (${ligne.vehicules.length})` : "Véhicule tenu"}
          precision="L'attribution se change sur la fiche du véhicule, d'où elle est datée"
        >
          {ligne.vehicules.length === 0 ? (
            <p className="text-[13px] leading-[1.5] text-texte-2">
              Aucun véhicule en cours d&apos;attribution. La personne reste au référentiel : elle a tenu un véhicule, ou doit en recevoir un.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {ligne.vehicules.map((v) => {
                const etat = ETAT_LEGER[v.etat];
                const echeancier = v.planCar ? echeancierPlanCar(v.planCar, regles.planCarDureeMois, aujourdhui) : null;
                return (
                  <div key={v.id} className="rounded-[10px] border border-bordure p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Le véhicule « à recevoir » n'a pas encore de plaque : sa
                          fiche n'est donc pas adressable, et le lot le nomme. */}
                      {v.immatriculation ? (
                        <Link href={`/flotte/${v.immatriculation}`} className="code text-[14px] font-semibold text-texte hover:text-accent-fonce hover:underline">
                          {v.immatriculationAffichee}
                        </Link>
                      ) : (
                        <span className="code text-[14px] font-semibold text-texte-2">{v.immatriculationAffichee}</span>
                      )}
                      <span className="text-[13.5px] text-texte-2">
                        {v.marque} {v.modele}
                        {v.annee ? ` · ${v.annee}` : ""}
                      </span>
                      <Pastille ton={etat.ton}>{etat.libelle}</Pastille>
                    </div>
                    <div className="mt-3.5">
                      <Definitions
                        colonnes={3}
                        elements={[
                          { libelle: "Régime d'usage", valeur: REGIME_USAGE[v.regime].libelle },
                          { libelle: "Kilométrage", valeur: v.kilometrage === null ? null : kilometrage(v.kilometrage) },
                          { libelle: "Lot 2026", valeur: v.lot },
                          {
                            libelle: "Plan car",
                            valeur: echeancier
                              ? echeancier.cessionPrevue
                                ? `${echeancier.moisEcoules}/${echeancier.dureeMois} mois — cession prévue ${echeancier.cessionPrevue}`
                                : `${echeancier.dureeMois} mois — date de début à renseigner pour dater la cession`
                              : "non",
                          },
                          { libelle: "Dossier", valeur: v.commentaire },
                        ]}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Carte>
      </div>
    </div>
  );
}
