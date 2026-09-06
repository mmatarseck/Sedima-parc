import { EcranProgrammesEntretien } from "@/composants/parametres/EcranProgrammesEntretien";
import { titrePage } from "@/domaine/marque";
import { PROGRAMMES, programmeParDefaut } from "@/donnees/entretien-demo";
import { FLOTTE } from "@/donnees/parc-demo";

export const metadata = { title: titrePage("Programmes d'entretien") };

/**
 * Les gabarits d'entretien, un par type de véhicule. Le compte de véhicules
 * concernés se fait ici, côté serveur : c'est ce qui dit si un programme
 * gouverne trois véhicules ou quinze, et donc ce qu'une périodicité engage.
 */
export default function PageProgrammesEntretien() {
  const comptes: Record<string, number> = {};
  for (const l of FLOTTE) {
    const code = programmeParDefaut(l.vehicule.categorie).code;
    comptes[code] = (comptes[code] ?? 0) + 1;
  }
  return <EcranProgrammesEntretien programmes={PROGRAMMES} comptes={comptes} />;
}
