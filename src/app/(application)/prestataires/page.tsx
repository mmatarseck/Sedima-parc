import { EcranPrestataires } from "@/composants/prestataires/EcranPrestataires";
import { resumesDe } from "@/domaine/assembler-prestataires";
import { statistiquesParPrestataire } from "@/domaine/caisse";
import { titrePage } from "@/domaine/marque";
import { prestatairesServeur } from "@/donnees/prestataires";

export const metadata = { title: titrePage("Prestataires") };

/**
 * Suivi › Prestataires : le référentiel des garages, fournisseurs, stations,
 * assureurs, centres agréés et transporteurs — et, pour chacun, ce qu'il a
 * fait avec le parc : activité sur douze mois, compte (dette déduite, avances),
 * notation. Une lecture, un assemblage, un écran ; en démonstration, le même
 * assemblage sur le jeu du navigateur.
 */
export default async function PagePrestataires({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [{ ref }, source] = await Promise.all([searchParams, prestatairesServeur()]);
  const depuis = new Date(Date.parse(source.aujourdhui) - 365 * 86_400_000).toISOString().slice(0, 10);
  return <EcranPrestataires prestataires={source.prestataires} stats={Object.fromEntries(statistiquesParPrestataire(source.demandes, depuis))} resumes={resumesDe(source)} cible={ref} />;
}
