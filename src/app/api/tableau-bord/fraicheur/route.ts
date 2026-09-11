import { NextResponse } from "next/server";
import { DATE_REFERENCE } from "@/donnees/tableau-bord-demo";
import { compteServeur } from "@/lib/compte-serveur";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";

/**
 * Le calcul gardé du tableau de bord est-il dépassé ? Une seule requête légère
 * — la dernière saisie visible (0043) —, pour le dire sans recalculer. Tant que
 * la fonction n'est pas jouée, la date est nulle : l'écran ne signale alors que
 * le changement de jour et la connexion.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const compte = await compteServeur();
  /* Le garde de l'application laisse passer /api : sans compte, rien à calculer. */
  if (compte === "anonyme") return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
  if (!authentificationReelle()) return NextResponse.json({ compte, derniereSaisie: null, aujourdhui: DATE_REFERENCE });
  const lecture = await (await clientServeur()).rpc("derniere_saisie");
  if (lecture.error) console.warn(`Fraîcheur du tableau de bord : derniere_saisie() indisponible (${lecture.error.message}).`);
  return NextResponse.json({
    compte,
    derniereSaisie: lecture.error ? null : ((lecture.data as string | null) ?? null),
    aujourdhui: new Date().toISOString().slice(0, 10),
  });
}
