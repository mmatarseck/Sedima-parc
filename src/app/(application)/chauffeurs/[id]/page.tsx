import { notFound } from "next/navigation";
import { FicheChauffeur, type ContexteFiche } from "@/composants/chauffeurs/FicheChauffeur";
import { FournisseurEdition } from "@/composants/transactions/ContexteEdition";
import { debutPeriode, type PeriodeMois } from "@/domaine/chauffeur";
import { titrePage } from "@/domaine/marque";
import { classer, kmMoyen } from "@/domaine/performance";
import { DATE_REFERENCE, fichePourChauffeur, fichesChauffeurs, listeChauffeurs } from "@/donnees/chauffeurs-demo";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string; discussion?: string; ref?: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const fiche = fichePourChauffeur(id);
  return { title: titrePage(fiche ? fiche.ligne.nomComplet : "Chauffeur introuvable") };
}

export function generateStaticParams() {
  return listeChauffeurs().map((l) => ({ id: l.id }));
}

/**
 * Fiche chauffeur, adressée par son identifiant lisible : /chauffeurs/babacar-ndiaye.
 * Un onglet peut être visé directement : /chauffeurs/babacar-ndiaye?onglet=contraventions.
 */
export default async function PageChauffeur({ params, searchParams }: Props) {
  const [{ id }, { onglet, discussion, ref }] = await Promise.all([params, searchParams]);
  const fiche = fichePourChauffeur(decodeURIComponent(id));
  if (!fiche) notFound();

  /* Ce qui compare le chauffeur aux autres se calcule ici, une fois pour tous. */
  const fiches = fichesChauffeurs();
  const reference = new Date(`${DATE_REFERENCE}T00:00:00Z`);
  const kmMoyenParPeriode = Object.fromEntries(([3, 6, 12] as PeriodeMois[]).map((p) => [p, kmMoyen(fiches, debutPeriode(p, reference), DATE_REFERENCE)])) as Record<PeriodeMois, number | null>;
  const moisRevolu = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const classement = classer(fiches, moisRevolu);
  const contexte: ContexteFiche = {
    kmMoyenParPeriode,
    classement: {
      mois: moisRevolu,
      rang: classement.find((l) => l.evaluation.chauffeurId === fiche.ligne.id)?.rang ?? null,
      classes: classement.filter((l) => l.rang !== null).length,
      total: classement.length,
    },
  };

  return (
    <FournisseurEdition sujet={`chauffeur:${fiche.ligne.id}`} href={`/chauffeurs/${fiche.ligne.id}`}>
      <FicheChauffeur fiche={fiche} ongletInitial={onglet} aujourdhui={DATE_REFERENCE} contexte={contexte} discussionInitiale={discussion === "1"} cible={ref} />
    </FournisseurEdition>
  );
}
