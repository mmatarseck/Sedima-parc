import { ListeTransporteurs } from "@/composants/transporteurs/ListeTransporteurs";
import { titrePage } from "@/domaine/marque";
import { listeTransporteurs } from "@/donnees/fiche-transporteur-demo";

export const metadata = { title: titrePage("Transporteurs") };

/**
 * Transporteurs — le **référentiel**, et rien d'autre.
 *
 * Refonte du 5 septembre 2026 : les cinq vues qui vivaient ici — affrètements,
 * mises à disposition, prestations, activité, grilles — ont rejoint la fiche de
 * chaque transporteur, et les analyses d'ensemble le module Rapports. Un écran
 * de référentiel liste ; il n'analyse pas.
 */
export default function PageTransporteurs() {
  return <ListeTransporteurs lignes={listeTransporteurs()} />;
}
