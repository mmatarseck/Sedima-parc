import { FournisseurEdition } from "@/composants/transactions/ContexteEdition";
import { FicheVehicule } from "@/composants/vehicule/FicheVehicule";
import { FicheVehiculeCreee } from "@/composants/vehicule/FicheVehiculeCreee";
import { afficher, normaliser } from "@/domaine/immatriculation";
import { titrePage } from "@/domaine/marque";
import { FicheVehiculeLeger } from "@/composants/parc-leger/FicheVehiculeLeger";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { ficheServeur } from "@/donnees/fiche";
import { transfertsServeur } from "@/donnees/transferts";
import { fichePourImmatriculation } from "@/donnees/fiche-demo";
import { parcLegerServeur } from "@/donnees/parc-leger";
import { parametresServeur } from "@/lib/parametres-serveur";
import { personnesServeur } from "@/lib/personnes-serveur";
import { authentificationReelle } from "@/lib/session-demo";

type Props = { params: Promise<{ immat: string }>; searchParams: Promise<{ onglet?: string; discussion?: string; ref?: string }> };

export async function generateMetadata({ params }: Props) {
  const { immat } = await params;
  /* Un titre ne doit jamais faire tomber la page : une erreur ici échappe à
     l'écran d'erreur de l'application, Next ne montre alors que sa page. */
  try {
    const fiche = authentificationReelle() ? null : fichePourImmatriculation(immat);
    /* Sans fiche au serveur, le véhicule peut fort bien exister dans le
       navigateur : on titre l'immatriculation demandée plutôt que de déclarer
       introuvable ce que la page va peut-être trouver. Un véhicule léger, ou un
       véhicule à recevoir sous son numéro de lot, se titre par le dossier. */
    const brut = decodeURIComponent(immat);
    const leger = fiche ? null : (await parcLegerServeur(await parametresServeur())).vehicules.find((v) => v.immatriculation === normaliser(brut) || v.id === brut.toLowerCase());
    return { title: titrePage(fiche ? fiche.ligne.vehicule.immatriculationAffichee : (leger?.immatriculationAffichee ?? afficher(normaliser(brut)))) };
  } catch (e) {
    console.error(`Titre de la fiche ${immat} : ${e instanceof Error ? e.message : String(e)}`);
    return { title: titrePage("Véhicule") };
  }
}

/* Rendu à la demande, toujours : ces pages lisent la session dans les cookies,
   ce qu'un rendu statique interdit — avec generateStaticParams, Next tentait de
   rendre statiquement chaque chemin à sa première visite et tombait sur
   DYNAMIC_SERVER_USAGE en production (8 septembre 2026). */
export const dynamic = "force-dynamic";

/**
 * Fiche véhicule 360°, adressée par immatriculation canonique : /flotte/AA032EA.
 * Toute écriture est acceptée dans l'adresse — « AA-032-EA » retrouve le même
 * véhicule — parce que c'est ainsi que les gens la tapent. Un onglet peut être
 * visé directement : /flotte/AA032EA?onglet=carburant.
 */
export default async function PageVehicule({ params, searchParams }: Props) {
  const [{ immat }, { onglet, discussion, ref }, parametres, transferts, utilisateurs] = await Promise.all([params, searchParams, parametresServeur(), transfertsServeur(), personnesServeur()]);
  const fiche = await ficheServeur(decodeURIComponent(immat), parametres);
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
    const parcLeger = await parcLegerServeur(parametres);
    const leger = parcLeger.vehicules.find((v) => v.immatriculation === canonique || v.id === brut);
    if (leger) {
      return (
        <FicheVehiculeLeger
          vehicule={leger}
          attributaire={parcLeger.attributaires.find((a) => a.id === leger.attributaireId) ?? null}
          forfait={parcLeger.forfaits.find((f) => f.attributaireId === leger.attributaireId) ?? null}
          regles={parametres.parcLeger}
          aujourdhui={authentificationReelle() ? new Date().toISOString().slice(0, 10) : DATE_REFERENCE}
        />
      );
    }
    return (
      <FournisseurEdition sujet={`vehicule:${canonique}`} href={`/flotte/${canonique}`}>
        <FicheVehiculeCreee immatriculation={canonique} ongletInitial={onglet} discussionInitiale={discussion === "1"} cible={ref} />
      </FournisseurEdition>
    );
  }
  /* Les fiches de transfert de ce véhicule : la remise d'un véhicule se lit
     sur sa fiche, à côté des affectations qu'elle ouvre et qu'elle ferme. */
  const v = fiche.ligne.vehicule;
  const siennes = transferts.filter((t) => t.vehicule.id === v.id || normaliser(t.vehicule.immatriculation) === v.immatriculation);
  return (
    <FournisseurEdition sujet={`vehicule:${v.immatriculation}`} href={`/flotte/${v.immatriculation}`}>
      <FicheVehicule fiche={fiche} transferts={siennes} utilisateurs={utilisateurs} ongletInitial={onglet} discussionInitiale={discussion === "1"} cible={ref} />
    </FournisseurEdition>
  );
}
