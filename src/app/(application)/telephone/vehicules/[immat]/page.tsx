import Link from "next/link";
import { Suspense } from "react";
import { FicheRapide, type DerniersFaits } from "@/composants/telephone/FicheRapide";
import { afficher, normaliser } from "@/domaine/immatriculation";
import { titrePage } from "@/domaine/marque";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { ficheServeur } from "@/donnees/fiche";
import { lignesFlotte } from "@/donnees/flotte";
import { parametresServeur } from "@/lib/parametres-serveur";

type Props = { params: Promise<{ immat: string }> };

export async function generateMetadata({ params }: Props) {
  const { immat } = await params;
  return { title: titrePage(afficher(normaliser(decodeURIComponent(immat)))) };
}

/**
 * La fiche rapide d'un véhicule, par immatriculation ou par numéro de lot.
 * Les derniers faits viennent de la fiche de démonstration quand elle
 * existe ; en base, ils viendront des pleins et interventions du véhicule.
 */
export default async function PageFicheRapide({ params }: Props) {
  const [{ immat }, parametres] = await Promise.all([params, parametresServeur()]);
  const brut = decodeURIComponent(immat);
  const canonique = normaliser(brut);
  const lignes = await lignesFlotte(parametres);
  const ligne = lignes.find((l) => l.vehicule.immatriculation === canonique || l.vehicule.id === brut.toLowerCase()) ?? null;
  if (!ligne) {
    return (
      <div className="mx-auto flex max-w-[520px] flex-col gap-3 px-4 py-6">
        <p className="text-[14px] text-texte">Aucun véhicule ne porte {afficher(canonique)} dans votre périmètre.</p>
        <Link href="/telephone/vehicules" className="font-semibold text-accent-fonce">
          Retour à la liste
        </Link>
      </div>
    );
  }
  const fiche = await ficheServeur(brut, parametres);
  const dernier = <T extends { date: string }>(liste: T[] | undefined) => (liste && liste.length ? [...liste].sort((a, b) => b.date.localeCompare(a.date))[0]! : null);
  const plein = dernier(fiche?.pleins);
  const intervention = dernier(fiche?.interventions);
  const faits: DerniersFaits = {
    plein: plein ? { date: plein.date, litres: plein.litres, montant: plein.montant, source: plein.source } : null,
    intervention: intervention ? { date: intervention.date, objet: intervention.objet, garage: intervention.garage, montant: intervention.montant } : null,
  };
  return (
    <Suspense fallback={null}>
      <FicheRapide ligne={ligne} faits={faits} aujourdhui={DATE_REFERENCE} />
    </Suspense>
  );
}
