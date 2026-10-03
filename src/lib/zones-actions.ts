"use server";

/* ============================================================================
 * Rattacher une localité du relevé à une zone du contrat (3 octobre 2026).
 *
 * C'est le geste qui fait passer un voyage de « localité à rattacher » à
 * « calculé » : Jacques le fait depuis la page Volumes et facturation, sur ce
 * qui reste en suspens, ou confirme une proposition. La base décide qui peut
 * écrire (`peut_ecrire_transport`, 0002) ; la trace dit qui l'a fait.
 * ==========================================================================*/

import { revalidatePath } from "next/cache";
import { normaliserLocalite } from "@/domaine/flotte-tierce";
import { clientServeur, utilisateurCourant } from "@/lib/supabase";

/** Nul quand c'est écrit ; sinon la raison, à montrer telle quelle. */
export async function rattacherLocalite(localite: string, zone: string, motif: string): Promise<string | null> {
  const cle = normaliserLocalite(localite);
  if (!cle || !zone.trim()) return "Localité ou zone manquante.";
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return "Session absente : reconnectez-vous.";
  const avant = await client.from("rattachement_localite").select("destination, motif").eq("localite_normalisee", cle).maybeSingle<{ destination: string; motif: string | null }>();
  const ecriture = await client
    .from("rattachement_localite")
    .upsert({ localite_normalisee: cle, localite: localite.trim(), destination: zone.trim(), origine: "usage", motif: motif.trim() || null }, { onConflict: "localite_normalisee" });
  if (ecriture.error) return `Rattachement refusé : ${ecriture.error.message}`;
  await client.from("modification").insert({
    table_cible: "rattachement_localite",
    numero: cle,
    champ: "destination",
    libelle_champ: "Zone de rapprochement",
    avant: avant.data ? `${avant.data.destination}${avant.data.motif ? ` — ${avant.data.motif}` : ""}` : null,
    apres: zone.trim(),
    motif: motif.trim() || "Rattachement depuis Volumes et facturation",
    statut: "appliquee",
    cree_par: moi.utilisateurId,
  });
  revalidatePath("/transporteurs/volumes");
  return null;
}
