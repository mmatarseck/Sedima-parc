import { notFound } from "next/navigation";
import { FichePoste } from "@/composants/budget/FichePoste";
import { titrePage } from "@/domaine/marque";
import { POSTE_DEPENSE } from "@/domaine/libelles";
import { fichePoste, postesBudgetaires } from "@/donnees/budget-demo";

type Props = { params: Promise<{ poste: string }> };

export async function generateMetadata({ params }: Props) {
  const { poste } = await params;
  const fiche = fichePoste(decodeURIComponent(poste));
  return { title: titrePage(fiche ? POSTE_DEPENSE[fiche.poste] : "Poste budgétaire introuvable") };
}

export function generateStaticParams() {
  return postesBudgetaires().map((poste) => ({ poste }));
}

/**
 * La page d'un poste budgétaire : /budget/carburant.
 *
 * Demande du métier du 5 septembre 2026 : « on doit pouvoir rentrer sur un
 * poste et voir la fiche du poste de dépense avec les dépenses qui l'ont
 * impacté », et « le filtre par BU sera appliqué à l'intérieur du poste ».
 * Les postes **hors budget** s'ouvrent de la même façon — leur enveloppe vaut
 * zéro, leurs dépenses sont bien réelles.
 */
export default async function PagePosteBudgetaire({ params }: Props) {
  const { poste } = await params;
  const fiche = fichePoste(decodeURIComponent(poste));
  if (!fiche) notFound();
  return <FichePoste fiche={fiche} />;
}
