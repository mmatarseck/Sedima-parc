import { notFound } from "next/navigation";
import { FicheTransporteur } from "@/composants/transporteurs/FicheTransporteur";
import { FournisseurEdition } from "@/composants/transactions/ContexteEdition";
import { titrePage } from "@/domaine/marque";
import { ficheTransporteur } from "@/donnees/fiche-transporteur-demo";
import { listePrestataires } from "@/donnees/prestataires-demo";

type Props = { params: Promise<{ numero: string }>; searchParams: Promise<{ onglet?: string }> };

export async function generateMetadata({ params }: Props) {
  const { numero } = await params;
  const fiche = ficheTransporteur(decodeURIComponent(numero));
  return { title: titrePage(fiche ? fiche.prestataire.raisonSociale : "Transporteur introuvable") };
}

export function generateStaticParams() {
  return listePrestataires()
    .filter((p) => p.type === "transporteur")
    .map((p) => ({ numero: p.numero }));
}

/**
 * Fiche transporteur, adressée par le numéro du prestataire :
 * /transporteurs/PRE-2026-00012.
 *
 * Elle ne double pas la fiche prestataire — qui reste la vue fournisseur,
 * achats et règlements — mais donne l'angle transport : la flotte tierce, les
 * missions, la grille. Les deux se citent l'une l'autre.
 */
export default async function PageTransporteur({ params, searchParams }: Props) {
  const [{ numero }, { onglet }] = await Promise.all([params, searchParams]);
  const fiche = ficheTransporteur(decodeURIComponent(numero));
  if (!fiche) notFound();
  /* La fiche crée et modifie des livraisons : elle a besoin du contexte
     d'édition, comme la fiche véhicule et la fiche chauffeur. */
  return (
    <FournisseurEdition sujet={`transporteur:${fiche.prestataire.numero}`} href={`/transporteurs/${fiche.prestataire.numero}`}>
      <FicheTransporteur fiche={fiche} ongletInitial={onglet} />
    </FournisseurEdition>
  );
}
