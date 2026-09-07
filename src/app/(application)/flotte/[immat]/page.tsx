import { FournisseurEdition } from "@/composants/transactions/ContexteEdition";
import { FicheVehicule } from "@/composants/vehicule/FicheVehicule";
import { FicheVehiculeCreee } from "@/composants/vehicule/FicheVehiculeCreee";
import { afficher, normaliser } from "@/domaine/immatriculation";
import { titrePage } from "@/domaine/marque";
import { FicheVehiculeLeger } from "@/composants/parc-leger/FicheVehiculeLeger";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { fichePourImmatriculation } from "@/donnees/fiche-demo";
import { attributairePour, forfaitsCarburant, vehiculesLegers } from "@/donnees/parc-leger-demo";
import { parametresServeur } from "@/lib/parametres-serveur";
import { FLOTTE } from "@/donnees/parc-demo";

type Props = { params: Promise<{ immat: string }>; searchParams: Promise<{ onglet?: string; discussion?: string; ref?: string }> };

export async function generateMetadata({ params }: Props) {
  const { immat } = await params;
  const fiche = fichePourImmatriculation(immat);
  /* Sans fiche au serveur, le véhicule peut fort bien exister dans le
     navigateur : on titre l'immatriculation demandée plutôt que de déclarer
     introuvable ce que la page va peut-être trouver. Un véhicule léger, ou un
     véhicule à recevoir sous son numéro de lot, se titre par le dossier. */
  const brut = decodeURIComponent(immat);
  const leger = fiche ? null : vehiculesLegers().find((v) => v.immatriculation === normaliser(brut) || v.id === brut.toLowerCase());
  return { title: titrePage(fiche ? fiche.ligne.vehicule.immatriculationAffichee : (leger?.immatriculationAffichee ?? afficher(normaliser(brut)))) };
}

export function generateStaticParams() {
  return FLOTTE.map((l) => ({ immat: l.vehicule.immatriculation }));
}

/**
 * Fiche véhicule 360°, adressée par immatriculation canonique : /flotte/AA032EA.
 * Toute écriture est acceptée dans l'adresse — « AA-032-EA » retrouve le même
 * véhicule — parce que c'est ainsi que les gens la tapent. Un onglet peut être
 * visé directement : /flotte/AA032EA?onglet=carburant.
 */
export default async function PageVehicule({ params, searchParams }: Props) {
  const [{ immat }, { onglet, discussion, ref }, parametres] = await Promise.all([params, searchParams, parametresServeur()]);
  const fiche = fichePourImmatriculation(decodeURIComponent(immat), parametres);
  /* Un véhicule saisi depuis la liste Flotte n'existe que dans le navigateur :
     le serveur ne peut pas le connaître, mais sa fiche doit s'ouvrir comme
     celle des autres. On confie donc la recherche au client, qui rendra la
     fiche vierge du véhicule créé — ou l'introuvable, s'il n'en est rien. */
  if (!fiche) {
    const canonique = normaliser(decodeURIComponent(immat));
    /* Un véhicule de service ou de fonction : sa fiche est celle du dossier
       du parc léger (fusion du 7 septembre 2026). */
    /* Par immatriculation, ou par numéro de lot pour un véhicule à recevoir. */
    const brut = decodeURIComponent(immat).toLowerCase();
    const leger = vehiculesLegers().find((v) => v.immatriculation === canonique || v.id === brut);
    if (leger) {
      return (
        <FicheVehiculeLeger
          vehicule={leger}
          attributaire={attributairePour(leger.attributaireId)}
          forfait={forfaitsCarburant().find((f) => f.attributaireId === leger.attributaireId) ?? null}
          regles={parametres.parcLeger}
          aujourdhui={DATE_REFERENCE}
        />
      );
    }
    return (
      <FournisseurEdition sujet={`vehicule:${canonique}`} href={`/flotte/${canonique}`}>
        <FicheVehiculeCreee immatriculation={canonique} ongletInitial={onglet} discussionInitiale={discussion === "1"} cible={ref} />
      </FournisseurEdition>
    );
  }
  return (
    <FournisseurEdition sujet={`vehicule:${fiche.ligne.vehicule.immatriculation}`} href={`/flotte/${fiche.ligne.vehicule.immatriculation}`}>
      <FicheVehicule fiche={fiche} ongletInitial={onglet} discussionInitiale={discussion === "1"} cible={ref} />
    </FournisseurEdition>
  );
}
