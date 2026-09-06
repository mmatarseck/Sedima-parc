import { EcranFlotte } from "@/composants/flotte/EcranFlotte";
import { fichePourImmatriculation } from "@/donnees/fiche-demo";
import { parametresServeur } from "@/lib/parametres-serveur";
import { FLOTTE } from "@/donnees/parc-demo";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Flotte") };

/**
 * Liste de la flotte : une ligne par véhicule.
 *
 * Pas de bandeau de KPI ici — la page sert à retrouver et à comparer des
 * véhicules, pas à lire des agrégats. Les indicateurs vivent sur le tableau de
 * bord, structurés par axe SQDCM.
 */
export default async function PageFlotte() {
  const parametres = await parametresServeur();
  /* Le statut effectif vient des documents de la fiche : un document critique
     manquant ou échu immobilise le véhicule administrativement. */
  const lignes = FLOTTE.map((l) => {
    const f = fichePourImmatriculation(l.vehicule.immatriculation, parametres);
    const imm = f?.immobilisationAdministrative ?? null;
    /* Le coût sur douze mois est celui des dépenses de la fiche — la même somme
       que l'Aperçu et que Coûts & analyses, pas un chiffre à part. */
    return { ...l, coutDouzeMois: f?.indicateurs.coutDouzeMois ?? l.coutDouzeMois, statutEffectif: imm?.statut ?? l.vehicule.statut, immobilisationAdministrative: imm?.documents ?? [] };
  });
  return <EcranFlotte lignes={lignes} />;
}
