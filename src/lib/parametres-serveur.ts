import { cookies } from "next/headers";
import { cache } from "react";
import { CLES_PARAMETRES, COOKIE_PARAMETRES, PREFIXE_COOKIE_PARAMETRES, appliquerLibelles, decoderValeurCookie, fusionnerParametres, type Parametres } from "@/domaine/parametres";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";

/**
 * Les paramètres tels que le serveur les lit.
 *
 * Base branchée : la table `parametre` (énergie, alertes, une ligne par clé)
 * et la table `type_document` — une seule vérité, la même que le navigateur
 * reçoit par `AmorceParametres`. Sinon, le cookie que l'écran Paramètres écrit
 * en démonstration ; sans cookie, les défauts. À appeler dans une page rendue
 * par le serveur, avant de construire les fiches : la lecture alimente aussi
 * le registre des libellés, pour que TYPE_DOCUMENT nomme les documents ajoutés.
 */
async function parametresServeurBrut(): Promise<Parametres> {
  const p = authentificationReelle() ? await depuisLaBase() : await depuisLeCookie();
  appliquerLibelles(p);
  return p;
}

interface LigneParametre {
  cle: string;
  valeur: unknown;
}

interface LigneTypeDocument {
  id: string;
  libelle: string;
  porteur: string;
  applicabilite: string;
  validite_mois: number | null;
  critique: boolean;
  standard: boolean;
}

async function depuisLaBase(): Promise<Parametres> {
  const client = await clientServeur();
  const [parametres, types] = await Promise.all([
    client.from("parametre").select("cle, valeur").returns<LigneParametre[]>(),
    client.from("type_document").select("id, libelle, porteur, applicabilite, validite_mois, critique, standard").returns<LigneTypeDocument[]>(),
  ]);
  if (parametres.error) throw new Error(`Lecture des paramètres : ${parametres.error.message}`);
  if (types.error) throw new Error(`Lecture des types de document : ${types.error.message}`);
  const parCle = new Map(parametres.data.map((l) => [l.cle, l.valeur]));
  /* Une table vide — première visite avant tout enregistrement — donne les défauts,
     comme un cookie absent : `fusionnerParametres` les complète. */
  return fusionnerParametres({
    energie: parCle.get("energie"),
    alertes: parCle.get("alertes"),
    parcLeger: parCle.get("parc-leger"),
    vehicules: parCle.get("vehicules"),
    pastilles: parCle.get("pastilles"),
    caisse: parCle.get("caisse"),
    cuve: parCle.get("cuve"),
    documents: types.data.length > 0 ? { types: types.data.map((t) => ({ id: t.id, libelle: t.libelle, porteur: t.porteur, applicabilite: t.applicabilite, validiteMois: t.validite_mois, critique: t.critique, standard: t.standard })) } : undefined,
  });
}

/* Un cookie par clé, pour ce qui diffère des défauts ; l'ancien cookie unique
   est encore lu, pour les navigateurs qui l'ont gardé. Une clé absente ou
   illisible reprend son défaut. */
async function depuisLeCookie(): Promise<Parametres> {
  try {
    const jar = await cookies();
    const partiel: Record<string, unknown> = {};
    const ancien = jar.get(COOKIE_PARAMETRES)?.value;
    const lu = ancien ? decoderValeurCookie(ancien) : null;
    if (lu && typeof lu === "object") Object.assign(partiel, lu);
    for (const cle of CLES_PARAMETRES) {
      const brut = jar.get(PREFIXE_COOKIE_PARAMETRES + cle)?.value;
      if (!brut) continue;
      const valeur = decoderValeurCookie(brut);
      if (valeur !== null) partiel[cle] = valeur;
    }
    return fusionnerParametres(partiel);
  } catch {
    return fusionnerParametres(null);
  }
}

/** Une lecture par requête : la mise en page et la page qui appellent `parametresServeur()` partagent le même résultat (revue du 8 septembre 2026). */
export const parametresServeur = cache(parametresServeurBrut);
