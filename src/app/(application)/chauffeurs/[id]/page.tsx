import { notFound } from "next/navigation";
import { FicheChauffeur, type ContexteFiche } from "@/composants/chauffeurs/FicheChauffeur";
import { FournisseurEdition } from "@/composants/transactions/ContexteEdition";
import { debutPeriode, type PeriodeMois } from "@/domaine/chauffeur";
import { titrePage } from "@/domaine/marque";
import { classer, kmMoyen } from "@/domaine/performance";
import { DATE_REFERENCE, fichesChauffeurs } from "@/donnees/chauffeurs-demo";
import { lignesChauffeurs } from "@/donnees/chauffeurs";
import { ficheChauffeurServeur } from "@/donnees/fiche-chauffeur";
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
  let contexte: ContexteFiche;
  if (reel) {
    /* Base branchée : la moyenne des kilomètres de l'année vient des lignes de
       la liste ; le classement attend que les fiches se lisent toutes d'un coup. */
    const lignes = await lignesChauffeurs();
    const kms = lignes.map((l) => l.kmDouzeMois).filter((k): k is number => k !== null && k > 0);
    const moyenne12 = kms.length ? kms.reduce((s, k) => s + k, 0) / kms.length : null;
    contexte = {
      kmMoyenParPeriode: { 3: moyenne12 === null ? null : moyenne12 / 4, 6: moyenne12 === null ? null : moyenne12 / 2, 12: moyenne12 },
      classement: { mois: moisRevolu, rang: null, classes: 0, total: lignes.length },
    };
  } else {
    /* Ce qui compare le chauffeur aux autres se calcule ici, une fois pour tous. */
    const fiches = fichesChauffeurs();
    const kmMoyenParPeriode = Object.fromEntries(([3, 6, 12] as PeriodeMois[]).map((p) => [p, kmMoyen(fiches, debutPeriode(p, reference), DATE_REFERENCE)])) as Record<PeriodeMois, number | null>;
    const classement = classer(fiches, moisRevolu);
    contexte = {
      kmMoyenParPeriode,
      classement: {
        mois: moisRevolu,
        rang: classement.find((l) => l.evaluation.chauffeurId === fiche.ligne.id)?.rang ?? null,
        classes: classement.filter((l) => l.rang !== null).length,
        total: classement.length,
      },
    };
  }

  return (
    <FournisseurEdition sujet={`chauffeur:${fiche.ligne.id}`} href={`/chauffeurs/${fiche.ligne.id}`}>
      <FicheChauffeur fiche={fiche} ongletInitial={onglet} aujourdhui={aujourdhui} contexte={contexte} discussionInitiale={discussion === "1"} cible={ref} />
    </FournisseurEdition>
  );
}
