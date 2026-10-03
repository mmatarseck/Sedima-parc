import { EcranActivite } from "@/composants/parametres/EcranActivite";
import { titrePage } from "@/domaine/marque";
import { jourCourant } from "@/domaine/temps";
import { activiteServeur } from "@/donnees/activite";
import { authentificationReelle } from "@/lib/session-demo";
import { sessionCourante } from "@/lib/session-serveur";

export const metadata = { title: titrePage("Activité des utilisateurs") };

/* Rendu à la demande : la page lit la base avec la session des cookies. */
export const dynamic = "force-dynamic";

const PERIODES = [7, 30, 90] as const;

/**
 * Qui utilise réellement l'application, et comment (métier, 3 octobre 2026) :
 * connexion, jours d'activité, écrans consultés, saisies et modifications, sur
 * 7, 30 ou 90 jours. Réservé, comme le diagnostic, à l'administrateur et à la
 * direction.
 */
export default async function PageActivite({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  const { jours: brut } = await searchParams;
  const jours = PERIODES.find((p) => String(p) === brut) ?? 30;
  const session = await sessionCourante();
  if (!authentificationReelle() || session.etat !== "connecte") {
    return <EcranActivite jours={jours} lignes={[]} motif="En démonstration, l'application ne lit aucune base : le suivi de l'activité ne dit quelque chose qu'en production, avec un compte." />;
  }
  if (session.session.role !== "administrateur" && session.session.role !== "direction") {
    return <EcranActivite jours={jours} lignes={[]} motif="Le suivi de l'activité est réservé à l'administrateur et à la direction." />;
  }
  const aujourdhui = jourCourant();
  const d = new Date(`${aujourdhui}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (jours - 1));
  const { lignes, motif } = await activiteServeur(d.toISOString().slice(0, 10));
  return <EcranActivite jours={jours} lignes={lignes} motif={motif} />;
}
