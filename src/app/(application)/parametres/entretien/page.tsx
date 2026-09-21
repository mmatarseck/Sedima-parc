import { EcranProgrammesEntretien } from "@/composants/parametres/EcranProgrammesEntretien";
import { precisionTache } from "@/domaine/taches";
import { titrePage } from "@/domaine/marque";
import { programmesServeur } from "@/donnees/entretien";
import { programmeParDefaut } from "@/donnees/entretien-demo";
import { parcServeur } from "@/donnees/flotte";
import { tachesPourFormulaires } from "@/donnees/taches";

export const metadata = { title: titrePage("Programmes d'entretien") };

/**
 * Les gabarits d'entretien, un par type de véhicule, lus en base et éditables
 * (0062). Le compte de véhicules concernés se fait ici, sur le parc réel :
 * c'est ce qui dit si un programme gouverne trois véhicules ou quinze, et donc
 * ce qu'une périodicité engage.
 */
export default async function PageProgrammesEntretien() {
  const [{ programmes, enBase }, parc, taches] = await Promise.all([programmesServeur(), parcServeur().catch(() => null), tachesPourFormulaires()]);
  const comptes: Record<string, number> = {};
  for (const v of parc?.vehicules ?? []) {
    const code = programmeParDefaut(v.categorie, programmes).code;
    comptes[code] = (comptes[code] ?? 0) + 1;
  }
  return <EcranProgrammesEntretien programmes={programmes} comptes={comptes} enBase={enBase} taches={taches.map((t) => ({ libelle: t.libelle, precision: precisionTache(t) }))} />;
}
