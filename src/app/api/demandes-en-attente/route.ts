import { NextResponse } from "next/server";
import { statutDemande } from "@/domaine/demandes";
import { demandesServeur } from "@/donnees/demandes";

/**
 * Le nombre de demandes qui attendent une réponse — ce que la corbeille de la
 * barre du haut affiche en pastille depuis que les demandes ont quitté le rail
 * (10 septembre 2026).
 *
 * Une seule route, un seul nombre : la barre n'a pas besoin de la liste, et la
 * servir entière à chaque page coûterait cher pour un point rouge. Le compte
 * ne retient que les demandes **échues et sans réponse** : une demande émise
 * ce matin pour ce soir n'appelle encore rien.
 *
 * Le lecteur sert la démonstration comme la base — `demandesServeur` s'en
 * charge —, donc la barre affiche la même chose dans les deux modes.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const maintenant = new Date().toISOString();
    const liste = await demandesServeur();
    const enAttente = liste.filter((d) => statutDemande(d, maintenant) === "en-retard").length;
    return NextResponse.json({ enAttente });
  } catch {
    /* La corbeille ne doit jamais faire tomber une page : sans compte, pas de pastille. */
    return NextResponse.json({ enAttente: 0 });
  }
}
