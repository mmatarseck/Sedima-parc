import { notFound } from "next/navigation";
import { FicheChauffeur, type ContexteFiche } from "@/composants/chauffeurs/FicheChauffeur";
import { FournisseurEdition } from "@/composants/transactions/ContexteEdition";
import { debutPeriode, type PeriodeMois } from "@/domaine/chauffeur";
import { titrePage } from "@/domaine/marque";
import { classer, kmMoyen } from "@/domaine/performance";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { ficheChauffeurServeur, fichesChauffeursServeur } from "@/donnees/fiche-chauffeur";
import { authentificationReelle } from "@/lib/session-demo";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string; discussion?: string; ref?: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const fiche = await ficheChauffeurServeur(decodeURIComponent(id));
  return { title: titrePage(fiche ? fiche.ligne.nomComplet : "Chauffeur introuvable") };
}

/* Rendu à la demande, toujours : ces pages lisent la session dans les cookies,
   ce qu'un rendu statique interdit — avec generateStaticParams, Next tentait de
   rendre statiquement chaque chemin à sa première visite et tombait sur
   DYNAMIC_SERVER_USAGE en production (8 septembre 2026). */
export const dynamic = "force-dynamic";

/**
 * Fiche chauffeur, adressée par son identifiant lisible : /chauffeurs/babacar-ndiaye.
 * Un onglet peut être visé directement : /chauffeurs/babacar-ndiaye?onglet=contraventions.
 */
export default async function PageChauffeur({ params, searchParams }: Props) {
  const [{ id }, { onglet, discussion, ref }] = await Promise.all([params, searchParams]);
  const fiche = await ficheChauffeurServeur(decodeURIComponent(id));
  if (!fiche) notFound();

  const reel = authentificationReelle();
  const aujourdhui = reel ? new Date().toISOString().slice(0, 10) : DATE_REFERENCE;
  const reference = new Date(`${aujourdhui}T00:00:00Z`);
  const moisRevolu = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  /* Ce qui compare le chauffeur aux autres se calcule ici, une fois pour tous :
     toutes les fiches du périmètre — celles de la base par lire_fiches_chauffeurs()
     (0020), celles de la démonstration sinon. */
  const fiches = await fichesChauffeursServeur();
  const kmMoyenParPeriode = Object.fromEntries(([3, 6, 12] as PeriodeMois[]).map((p) => [p, kmMoyen(fiches, debutPeriode(p, reference), aujourdhui)])) as Record<PeriodeMois, number | null>;
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
      <FicheChauffeur fiche={fiche} ongletInitial={onglet} aujourdhui={aujourdhui} contexte={contexte} discussionInitiale={discussion === "1"} cible={ref} />
    </FournisseurEdition>
  );
}
