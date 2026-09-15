import { clientServeur } from "@/lib/supabase";

/**
 * L'identifiant du compte connecté, côté serveur — ce qui range un calcul gardé
 * sous le bon nom.
 */
export async function compteServeur(): Promise<string> {
  const { data } = await (await clientServeur()).auth.getUser();
  return data.user?.id ?? "anonyme";
}
