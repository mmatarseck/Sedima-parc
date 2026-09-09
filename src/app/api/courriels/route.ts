import { NextResponse } from "next/server";
import { envoyerCourrielsEnAttente } from "@/lib/notifications-serveur";
import { authentificationReelle } from "@/lib/session-demo";

/**
 * Le passage du matin : envoie les courriels de notification qui attendent,
 * groupés par destinataire. Vercel l'appelle chaque jour (`vercel.json`,
 * `crons`) avec `Authorization: Bearer <CRON_SECRET>` ; un administrateur
 * peut l'appeler de même à la main. Sans secret posé, la route refuse : on
 * ne laisse pas n'importe qui déclencher des envois.
 */
export const dynamic = "force-dynamic";

export async function GET(requete: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || requete.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  if (!authentificationReelle()) return NextResponse.json({ pret: false, raison: "Démonstration : aucun courriel ne part.", destinataires: 0, envoyees: 0, echecs: 0, enAttente: 0 });
  return NextResponse.json(await envoyerCourrielsEnAttente());
}
