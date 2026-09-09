import { notFound } from "next/navigation";
import { FicheTransporteur } from "@/composants/transporteurs/FicheTransporteur";
import { FournisseurEdition } from "@/composants/transactions/ContexteEdition";
import { ficheTransporteurDe } from "@/domaine/assembler-transporteurs";
import { titrePage } from "@/domaine/marque";
import { transporteursServeur } from "@/donnees/transporteurs";

type Props = { params: Promise<{ numero: string }>; searchParams: Promise<{ onglet?: string }> };

export async function generateMetadata({ params }: Props) {
  const { numero } = await params;
  const fiche = ficheTransporteurDe(await transporteursServeur(), decodeURIComponent(numero));
  return { title: titrePage(fiche ? fiche.prestataire.raisonSociale : "Transporteur introuvable") };
}

/* Rendu à la demande, toujours : ces pages lisent la session dans les cookies,
   ce qu'un rendu statique interdit — avec generateStaticParams, Next tentait de
   rendre statiquement chaque chemin à sa première visite et tombait sur
   DYNAMIC_SERVER_USAGE en production (8 septembre 2026). */
export const dynamic = "force-dynamic";

/**
 * Fiche transporteur, adressée par le numéro du prestataire :
 * /transporteurs/PRE-2026-00012.
 *
 * Elle ne double pas la fiche prestataire — qui reste la vue fournisseur,
 * achats et règlements — mais donne l'angle transport : la flotte tierce, les
 * missions, la grille. Les deux se citent l'une l'autre.
 *
 * Base branchée : la même lecture que la liste (mise en cache pour la requête),
 * la fiche assemblée dessus.
 */
export default async function PageTransporteur({ params, searchParams }: Props) {
  const [{ numero }, { onglet }, source] = await Promise.all([params, searchParams, transporteursServeur()]);
  const fiche = ficheTransporteurDe(source, decodeURIComponent(numero));
  if (!fiche) notFound();
  /* La fiche crée et modifie des livraisons : elle a besoin du contexte
     d'édition, comme la fiche véhicule et la fiche chauffeur. */
  return (
    <FournisseurEdition sujet={`transporteur:${fiche.prestataire.numero}`} href={`/transporteurs/${fiche.prestataire.numero}`}>
      <FicheTransporteur fiche={fiche} ongletInitial={onglet} />
    </FournisseurEdition>
  );
}
