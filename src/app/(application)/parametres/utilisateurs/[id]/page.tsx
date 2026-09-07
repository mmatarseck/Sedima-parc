import { notFound } from "next/navigation";
import { EcranAccesUtilisateur } from "@/composants/parametres/EcranAccesUtilisateur";
import { nomComplet } from "@/domaine/acces";
import { titrePage } from "@/domaine/marque";
import { accesServeur } from "@/lib/acces-serveur";
import { authentificationReelle } from "@/lib/session-demo";
import { optionsAcces } from "../options-acces";

/**
 * La fiche d'accès d'une personne. En démonstration, une fiche créée dans le
 * navigateur n'est pas connue du serveur : la page rend alors une fiche vide
 * portant l'identifiant, et l'écran la complète depuis son stockage.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fiche = (await accesServeur()).find((a) => a.id === id);
  return { title: titrePage(fiche ? nomComplet(fiche) : "Fiche d'accès") };
}

export default async function PageAccesUtilisateur({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fiche = (await accesServeur()).find((a) => a.id === id) ?? null;
  if (!fiche && authentificationReelle()) notFound();
  const initial = fiche ?? { id, prenom: "", nom: "", courriel: "", telephone: null, fonction: null, matricule: null, actif: true, profil: "agent-terrain" as const, perimetre: { sites: "tous" as const, businessUnits: "toutes" as const, regimes: "tous" as const }, modules: {}, sanctions: null, ecartsApprouves: false, approuvePar: null, chauffeurId: null, attributaireId: null, creeLe: new Date().toISOString(), modifieLe: null };
  return <EcranAccesUtilisateur initial={initial} options={await optionsAcces()} />;
}
