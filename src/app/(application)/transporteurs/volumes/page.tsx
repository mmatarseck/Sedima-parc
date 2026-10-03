import { EcranVolumes } from "@/composants/transporteurs/EcranVolumes";
import { titrePage } from "@/domaine/marque";
import { jourCourant } from "@/domaine/temps";
import { debutSemaine, joursDeLaSemaine } from "@/domaine/volumes-transport";
import { volumesServeur } from "@/donnees/volumes-transport";

export const metadata = { title: titrePage("Volumes et facturation") };

/* Rendu à la demande : la page lit la session dans les cookies. */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ vue?: string; semaine?: string; mois?: string }> };

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const MOIS = /^\d{4}-\d{2}$/;

function finDuMois(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a!, m!, 0)).toISOString().slice(0, 10);
}

/**
 * Volumes et facturation des transporteurs (3 octobre 2026) : la semaine du
 * relevé — vendredi à jeudi, comme celle de Jacques —, ou le mois facturé.
 * La période est dans l'adresse : un lien transmis montre la même chose.
 */
export default async function PageVolumes({ searchParams }: Props) {
  const { vue, semaine, mois } = await searchParams;
  const aujourdhui = jourCourant();
  const facturation = vue === "facturation";
  const debut = debutSemaine(semaine && JOUR.test(semaine) ? semaine : aujourdhui);
  const jours = joursDeLaSemaine(debut);
  const moisVise = mois && MOIS.test(mois) ? mois : aujourdhui.slice(0, 7);
  const du = facturation ? `${moisVise}-01` : jours[0]!;
  const au = facturation ? finDuMois(moisVise) : jours[6]!;
  const donnees = await volumesServeur(du, au);
  return <EcranVolumes vue={facturation ? "facturation" : "semaine"} jours={jours} mois={moisVise} du={du} au={au} donnees={donnees} />;
}
