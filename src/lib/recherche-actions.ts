"use server";

import type { ResultatRecherche } from "@/domaine/recherche";
import { chercherCodesAvec } from "@/lib/recherche-base";
import { clientServeur } from "@/lib/supabase";

/** La recherche globale, avec la session de l'utilisateur : la base ne rend que ce que ses droits lui laissent voir. */
export async function chercherCodes(terme: string): Promise<ResultatRecherche[]> {
  if (terme.trim().length < 3) return [];
  let client: Awaited<ReturnType<typeof clientServeur>>;
  try {
    client = await clientServeur();
  } catch {
    return [];
  }
  return chercherCodesAvec(client, terme);
}
