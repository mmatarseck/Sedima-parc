import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";

/**
 * L'identifiant du compte connecté, côté serveur — ce qui range un calcul gardé
 * sous le bon nom. En démonstration, un seul compte : « demonstration ».
 */
export async function compteServeur(): Promise<string> {
  if (!authentificationReelle()) return "demonstration";
  const { data } = await (await clientServeur()).auth.getUser();
  return data.user?.id ?? "anonyme";
}
