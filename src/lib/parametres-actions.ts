"use server";

/* ============================================================================
 * L'enregistrement des paramètres, côté serveur.
 *
 * Une fonction serveur : le navigateur l'appelle, elle écrit dans la base
 * avec la session de l'utilisateur, et les politiques RLS décident — seuls
 * l'administrateur et la direction écrivent `parametre` et `type_document`.
 * Le contrôle est refait ici avant d'écrire, parce qu'une fonction serveur se
 * joint par une simple requête POST, pas seulement depuis l'écran.
 *
 * Deux sortes d'écritures : les barèmes d'énergie, les règles d'alerte, le
 * parc léger et le référentiel des véhicules dans `parametre` (une ligne par
 * clé, en JSON), les types de document dans leur table. Un type retiré de la liste est supprimé — sauf s'il porte encore des
 * documents, et la base le dit.
 * ==========================================================================*/

import { revalidatePath } from "next/cache";
import { fusionnerParametres, type Parametres } from "@/domaine/parametres";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur, utilisateurCourant } from "@/lib/supabase";

/** Nul quand tout est écrit ; sinon la raison, à montrer telle quelle. */
export async function enregistrerParametres(brut: Parametres): Promise<string | null> {
  if (!authentificationReelle()) return null;
  /* Relus par la même fonction que le stockage : ce qui est écrit est d'aplomb. */
  const p = fusionnerParametres(brut);
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return "Session absente : reconnectez-vous avant d'enregistrer.";
  if (moi.role !== "administrateur" && moi.role !== "direction") return "Les paramètres se règlent par l'administrateur ou la direction.";

  const maintenant = new Date().toISOString();
  const lignes = [
    { cle: "energie", valeur: p.energie, modifie_le: maintenant, modifie_par: moi.utilisateurId },
    { cle: "alertes", valeur: p.alertes, modifie_le: maintenant, modifie_par: moi.utilisateurId },
    { cle: "parc-leger", valeur: p.parcLeger, modifie_le: maintenant, modifie_par: moi.utilisateurId },
    { cle: "vehicules", valeur: p.vehicules, modifie_le: maintenant, modifie_par: moi.utilisateurId },
  ];
  const ecriture = await client.from("parametre").upsert(lignes, { onConflict: "cle" });
  if (ecriture.error) return `Enregistrement refusé : ${ecriture.error.message}`;

  const types = p.documents.types.map((t) => ({
    id: t.id,
    libelle: t.libelle,
    porteur: t.porteur,
    applicabilite: t.applicabilite,
    validite_mois: t.validiteMois,
    critique: t.critique,
    standard: t.standard,
  }));
  const typesEcrits = await client.from("type_document").upsert(types, { onConflict: "id" });
  if (typesEcrits.error) return `Types de document refusés : ${typesEcrits.error.message}`;

  const existants = await client.from("type_document").select("id").returns<{ id: string }[]>();
  if (existants.error) return `Relecture des types : ${existants.error.message}`;
  const conserves = new Set(types.map((t) => t.id));
  const aRetirer = existants.data.map((t) => t.id).filter((id) => !conserves.has(id));
  if (aRetirer.length > 0) {
    const retrait = await client.from("type_document").delete().in("id", aRetirer);
    if (retrait.error) {
      return retrait.error.code === "23503"
        ? `Un type retiré porte encore des documents (${aRetirer.join(", ")}) : il ne peut pas disparaître tant qu'ils existent.`
        : `Retrait refusé : ${retrait.error.message}`;
    }
  }

  /* Les pages rendues par le serveur relisent les paramètres au prochain rendu. */
  revalidatePath("/", "layout");
  return null;
}
