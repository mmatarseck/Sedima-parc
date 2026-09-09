import { notFound } from "next/navigation";
import { FichePoste } from "@/composants/budget/FichePoste";
import { FournisseurEdition } from "@/composants/transactions/ContexteEdition";
import { fichePosteDe } from "@/domaine/assembler-budget";
import { titrePage } from "@/domaine/marque";
import { POSTE_DEPENSE } from "@/domaine/libelles";
import { budgetServeur } from "@/donnees/budget";

type Props = { params: Promise<{ poste: string }> };

export async function generateMetadata({ params }: Props) {
  const { poste } = await params;
  const fiche = fichePosteDe(await budgetServeur(), decodeURIComponent(poste));
  return { title: titrePage(fiche ? POSTE_DEPENSE[fiche.poste] : "Poste budgétaire introuvable") };
}

/* Rendu à la demande, toujours : ces pages lisent la session dans les cookies,
   ce qu'un rendu statique interdit — avec generateStaticParams, Next tentait de
   rendre statiquement chaque chemin à sa première visite et tombait sur
   DYNAMIC_SERVER_USAGE en production (8 septembre 2026). */
export const dynamic = "force-dynamic";

/**
 * La page d'un poste budgétaire : /budget/carburant.
 *
 * Demande du métier du 5 septembre 2026 : « on doit pouvoir rentrer sur un
 * poste et voir la fiche du poste de dépense avec les dépenses qui l'ont
 * impacté », et « le filtre par BU sera appliqué à l'intérieur du poste ».
 * Les postes **hors budget** s'ouvrent de la même façon — leur enveloppe vaut
 * zéro, leurs dépenses sont bien réelles. C'est ici que l'enveloppe se pose
 * et se corrige, business unit par business unit.
 */
export default async function PagePosteBudgetaire({ params }: Props) {
  const { poste } = await params;
  const fiche = fichePosteDe(await budgetServeur(), decodeURIComponent(poste));
  if (!fiche) notFound();
  return (
    <FournisseurEdition sujet={`budget:${fiche.poste}`} href={`/budget/${fiche.poste}`}>
      <FichePoste fiche={fiche} />
    </FournisseurEdition>
  );
}
