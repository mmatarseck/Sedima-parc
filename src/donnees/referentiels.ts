/* ============================================================================
 * Les référentiels — sites et prestataires — tels qu'une page les lit.
 *
 * Premier module branché sur la base. Le principe vaut pour tous ceux qui
 * suivront : la page appelle une fonction asynchrone, qui lit Supabase quand
 * un projet est configuré et le jeu de démonstration sinon. Les écrans ne
 * changent pas ; seule la source change. Le client serveur porte la session
 * de l'utilisateur, donc les politiques RLS s'appliquent : ce qu'il ne doit
 * pas voir n'arrive pas jusqu'ici.
 *
 * Les identifiants diffèrent d'une source à l'autre : le jeu de démonstration
 * dit « s-uab », la base dit un UUID. Une page ne mélange donc pas les deux —
 * les usages d'un site se comptent sur la même source que la liste des sites.
 * ==========================================================================*/

import type { Prestataire, TypePrestataire } from "@/domaine/prestataires";
import type { Site } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { FLOTTE, SITES } from "./parc-demo";
import { listePrestataires } from "./prestataires-demo";

interface LigneSite {
  id: string;
  code: string;
  libelle: string;
  region: string;
  type: Site["type"];
}

export interface LignePrestataire {
  numero: string;
  raison_sociale: string;
  type: TypePrestataire;
  contact: string | null;
  telephone: string | null;
  courriel: string | null;
  adresse: string | null;
  ville: string | null;
  ninea: string | null;
  delai_paiement_jours: number | null;
  actif: boolean;
  note: string | null;
}

/** Une lecture qui échoue est une erreur de la page, pas une liste vide déguisée. */
function ouErreur<T>(quoi: string, resultat: { data: T | null; error: { message: string } | null }): T {
  if (resultat.error) throw new Error(`Lecture de ${quoi} : ${resultat.error.message}`);
  return resultat.data ?? ([] as T);
}

/** Les sites, dans l'ordre du référentiel. */
export async function sites(): Promise<Site[]> {
  if (!authentificationReelle()) return SITES;
  const client = await clientServeur();
  const lignes = ouErreur("sites", await client.from("site").select("id, code, libelle, region, type").order("code").returns<LigneSite[]>());
  return lignes.map((s) => ({ id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }));
}

/** Combien de véhicules chaque site porte — sur la même source que `sites()`. */
export async function vehiculesParSite(): Promise<Map<string, number>> {
  const compte = new Map<string, number>();
  if (!authentificationReelle()) {
    for (const l of FLOTTE) {
      const s = l.vehicule.siteId;
      if (s) compte.set(s, (compte.get(s) ?? 0) + 1);
    }
    return compte;
  }
  const client = await clientServeur();
  const lignes = ouErreur("véhicules par site", await client.from("vehicule").select("site_id").returns<{ site_id: string | null }[]>());
  for (const v of lignes) if (v.site_id) compte.set(v.site_id, (compte.get(v.site_id) ?? 0) + 1);
  return compte;
}

/** Les prestataires, par numéro croissant — l'ordre de leur entrée au référentiel. */
export async function prestataires(): Promise<Prestataire[]> {
  if (!authentificationReelle()) return listePrestataires();
  const client = await clientServeur();
  const lignes = ouErreur(
    "prestataires",
    await client
      .from("prestataire")
      .select("numero, raison_sociale, type, contact, telephone, courriel, adresse, ville, ninea, delai_paiement_jours, actif, note")
      .order("numero")
      .returns<LignePrestataire[]>(),
  );
  return lignes.map(prestataireDepuisLigne);
}

/** Une ligne de la table `prestataire`, mise à la forme du référentiel. */
export function prestataireDepuisLigne(p: LignePrestataire): Prestataire {
  return {
    numero: p.numero,
    raisonSociale: p.raison_sociale,
    type: p.type,
    contact: p.contact,
    telephone: p.telephone,
    courriel: p.courriel,
    adresse: p.adresse,
    ville: p.ville,
    ninea: p.ninea,
    delaiPaiementJours: p.delai_paiement_jours,
    actif: p.actif,
    note: p.note,
    /* En base, une fiche créée dans l'application est une fiche comme les autres. */
    creee: false,
  };
}
