import { NextResponse } from "next/server";
import { marquerLuesServeur, mesNotificationsServeur } from "@/lib/notifications-serveur";
import { authentificationReelle } from "@/lib/session-demo";

/**
 * Les notifications de la personne connectée — ce que la cloche lit quand la
 * base est branchée. En démonstration, la cloche lit le navigateur : la
 * réponse est vide, sans erreur. POST marque tout lu et rend la liste.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!authentificationReelle()) return NextResponse.json([]);
  return NextResponse.json(await mesNotificationsServeur());
}

export async function POST() {
  if (!authentificationReelle()) return NextResponse.json([]);
  return NextResponse.json(await marquerLuesServeur());
}
