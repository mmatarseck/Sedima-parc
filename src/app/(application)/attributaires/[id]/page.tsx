import { notFound } from "next/navigation";
import { FicheAttributaire } from "@/composants/chauffeurs/FicheAttributaire";
import { titrePage } from "@/domaine/marque";
import { lignesAttributaires } from "@/domaine/parc-leger";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { parcLegerServeur } from "@/donnees/parc-leger";
import { parametresServeur } from "@/lib/parametres-serveur";
import { authentificationReelle } from "@/lib/session-demo";

type Props = { params: Promise<{ id: string }> };

/* Rendu à la demande, toujours : ces pages lisent la session dans les cookies,
   ce qu'un rendu statique interdit. */
export const dynamic = "force-dynamic";

async function ligneDe(id: string) {
  const parametres = await parametresServeur();
  const parcLeger = await parcLegerServeur(parametres);
  const lignes = lignesAttributaires(parcLeger, parametres.parcLeger.forfaitCarburantMensuel);
  return { ligne: lignes.find((l) => l.id === id) ?? null, parametres };
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const { ligne } = await ligneDe(decodeURIComponent(id));
  return { title: titrePage(ligne ? ligne.nom : "Conducteur introuvable") };
}

/**
 * Fiche d'un attributaire, adressée par son nom : /attributaires/assane-gueye.
 *
 * Une adresse à part de `/chauffeurs/…` parce que ce n'en est pas un : il tient
 * un véhicule au titre de sa fonction, sans rien devoir au parc en permis ni en
 * visite médicale. Les deux populations se retrouvent dans la même liste, en
 * deux volets (demande du métier du 14 septembre 2026).
 */
export default async function PageAttributaire({ params }: Props) {
  const { id } = await params;
  const { ligne, parametres } = await ligneDe(decodeURIComponent(id));
  if (!ligne) notFound();

  const aujourdhui = authentificationReelle() ? new Date().toISOString().slice(0, 10) : DATE_REFERENCE;
  return <FicheAttributaire ligne={ligne} regles={parametres.parcLeger} aujourdhui={aujourdhui} />;
}
