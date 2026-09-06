import { notFound } from "next/navigation";
import { FichePrestataire } from "@/composants/prestataires/FichePrestataire";
import { FournisseurEdition } from "@/composants/transactions/ContexteEdition";
import { titrePage } from "@/domaine/marque";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { fichePrestataire } from "@/donnees/fiche-prestataire-demo";
import { listePrestataires } from "@/donnees/prestataires-demo";
import { prestataires } from "@/donnees/referentiels";

type Props = { params: Promise<{ numero: string }>; searchParams: Promise<{ onglet?: string; ref?: string }> };

export async function generateMetadata({ params }: Props) {
  const { numero } = await params;
  const fiche = fichePrestataire(decodeURIComponent(numero), await prestataires());
  return { title: titrePage(fiche ? fiche.prestataire.raisonSociale : "Prestataire introuvable") };
}

/* À la construction, sans session, seule la démonstration se connaît ; les
   autres numéros se rendent à la demande. */
export function generateStaticParams() {
  return listePrestataires().map((p) => ({ numero: p.numero }));
}

/**
 * Fiche prestataire, adressée par son numéro : /prestataires/PRE-2026-00003.
 * Un onglet peut être visé directement : ?onglet=demandes. Les créations
 * faites depuis la fiche (une demande d'achat) sont rangées sur l'écran qui
 * les porte, pas sur le prestataire.
 */
export default async function PagePrestataire({ params, searchParams }: Props) {
  const [{ numero }, { onglet, ref }, liste] = await Promise.all([params, searchParams, prestataires()]);
  const fiche = fichePrestataire(decodeURIComponent(numero), liste);
  if (!fiche) notFound();

  return (
    <FournisseurEdition sujet={`prestataire:${fiche.prestataire.numero}`} href={`/prestataires/${fiche.prestataire.numero}`}>
      <FichePrestataire fiche={fiche} ongletInitial={onglet} aujourdhui={DATE_REFERENCE} cible={ref} />
    </FournisseurEdition>
  );
}
