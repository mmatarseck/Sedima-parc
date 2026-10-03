import { EcranProgrammesEntretien } from "@/composants/parametres/EcranProgrammesEntretien";
import { precisionTache } from "@/domaine/taches";
import { titrePage } from "@/domaine/marque";
import { programmesServeur } from "@/donnees/entretien";
import { parcServeur } from "@/donnees/flotte";
import { tachesPourFormulaires } from "@/donnees/taches";

export const metadata = { title: titrePage("Programmes d'entretien") };

/**
 * Les gabarits d'entretien, par modèle ou par catégorie, lus en base et
 * éditables (0062, 0075). Le parc réel passe à l'écran : c'est lui qui dit si
 * un programme gouverne trois véhicules ou quinze, donc ce qu'une périodicité
 * engage, et quels modèles le parc compte vraiment.
 */
export default async function PageProgrammesEntretien() {
  const [{ programmes, enBase }, parc, taches] = await Promise.all([programmesServeur(), parcServeur().catch(() => null), tachesPourFormulaires()]);
  const vehicules = (parc?.vehicules ?? []).map((v) => ({ categorie: v.categorie, marque: v.marque, appellation: v.appellation }));
  return <EcranProgrammesEntretien programmes={programmes} vehicules={vehicules} enBase={enBase} taches={taches.map((t) => ({ libelle: t.libelle, precision: precisionTache(t) }))} />;
}
