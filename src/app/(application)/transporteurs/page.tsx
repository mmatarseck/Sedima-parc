import { ListeTransporteurs } from "@/composants/transporteurs/ListeTransporteurs";
import { listeTransporteursDe } from "@/domaine/assembler-transporteurs";
import { titrePage } from "@/domaine/marque";
import { transporteursServeur } from "@/donnees/transporteurs";

export const metadata = { title: titrePage("Transporteurs") };

/**
 * Transporteurs — le **référentiel**, et rien d'autre.
 *
 * Refonte du 5 septembre 2026 : les cinq vues qui vivaient ici — affrètements,
 * mises à disposition, prestations, activité, grilles — ont rejoint la fiche de
 * chaque transporteur, et les analyses d'ensemble le module Rapports. Un écran
 * de référentiel liste ; il n'analyse pas.
 *
 * Base branchée : une lecture (`lire_transporteurs`, 0025), un assemblage, un
 * écran. En démonstration, le même assemblage sur le jeu du navigateur.
 */
export default async function PageTransporteurs() {
  const source = await transporteursServeur();
  return <ListeTransporteurs lignes={listeTransporteursDe(source)} />;
}
