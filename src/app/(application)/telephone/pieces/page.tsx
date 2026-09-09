import { EcranTelephonePieces } from "@/composants/telephone/EcranTelephonePieces";
import { titrePage } from "@/domaine/marque";
import { lignesFlotte } from "@/donnees/flotte";
import { ordresServeur } from "@/donnees/ordres";
import { piecesServeur } from "@/donnees/pieces";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Pièces") };

/**
 * Les pièces sur le téléphone : sortir pour le véhicule qu'on répare, recevoir
 * une livraison. La même source que le bureau (`piecesServeur`), les
 * véhicules du parc pour le choix, les ordres en atelier pour rattacher la
 * sortie d'un geste.
 */
export default async function PageTelephonePieces({ searchParams }: { searchParams: Promise<{ geste?: string }> }) {
  const [{ geste }, parametres, source, ordres] = await Promise.all([searchParams, parametresServeur(), piecesServeur(), ordresServeur()]);
  const lignes = await lignesFlotte(parametres);
  const vehicules = lignes.map((l) => ({ id: l.vehicule.id, immatriculationAffichee: l.vehicule.immatriculationAffichee, libelle: `${l.vehicule.marque} ${l.vehicule.appellation}`.trim() }));
  return <EcranTelephonePieces source={source} vehicules={vehicules} ordres={ordres} gesteInitial={geste} />;
}
