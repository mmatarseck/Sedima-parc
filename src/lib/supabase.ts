/* ============================================================================
 * Les clients Supabase — trois, parce qu'ils ne courent pas le même risque.
 *
 *   * `clientNavigateur()` — dans le navigateur, avec la clé anonyme : il ne
 *     voit que ce que les politiques RLS laissent voir à l'utilisateur connecté.
 *   * `clientServeur()` — dans un composant ou une route serveur, avec la
 *     session lue des cookies : même périmètre que le navigateur, mais rendu
 *     côté serveur. C'est lui que les pages appelleront quand `src/donnees/`
 *     sera remplacé.
 *   * `clientService()` — avec la clé de service, qui **passe outre les
 *     politiques**. À n'employer que là où l'on sait pourquoi : une tâche
 *     d'administration, jamais une page. Il refuse de s'instancier côté client.
 *
 * Tant que `NEXT_PUBLIC_SUPABASE_URL` n'est pas posée, rien ici n'est appelé :
 * l'application reste sur son jeu de démonstration (`authentificationReelle()`).
 * ==========================================================================*/

import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MODULES, NIVEAUX, PROFILS, type AccesCourant, type Module, type Niveau, type Perimetre, type Profil } from "@/domaine/acces";
import type { Role } from "@/domaine/roles";

function configuration(): { url: string; cle: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) throw new Error("Supabase n'est pas configuré : poser NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return { url, cle };
}

let navigateur: SupabaseClient | null = null;

/** Le client du navigateur — un seul par page, la session est dans les cookies. */
export function clientNavigateur(): SupabaseClient {
  if (navigateur) return navigateur;
  const { url, cle } = configuration();
  navigateur = createBrowserClient(url, cle);
  return navigateur;
}

/**
 * Le client d'un composant serveur. Il lit la session dans les cookies de la
 * requête ; l'écriture des cookies n'est possible que depuis une route ou une
 * action serveur, et on la laisse échouer en silence ailleurs — c'est le
 * comportement documenté de `@supabase/ssr` avec l'App Router.
 */
export async function clientServeur(): Promise<SupabaseClient> {
  const { cookies } = await import("next/headers");
  const magasin = await cookies();
  const { url, cle } = configuration();
  return createServerClient(url, cle, {
    cookies: {
      getAll: () => magasin.getAll(),
      setAll: (liste) => {
        try {
          for (const { name, value, options } of liste) magasin.set(name, value, options);
        } catch {
          /* composant serveur : la session sera rafraîchie par le middleware */
        }
      },
    },
  });
}

/** Le client de service. Serveur seulement, et jamais dans une page. */
export function clientService(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("La clé de service ne s'emploie jamais dans le navigateur.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) throw new Error("SUPABASE_SERVICE_ROLE_KEY n'est pas posée.");
  return createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Ce que `get_me()` rend : l'identité applicative du compte connecté. */
export interface UtilisateurCourant {
  utilisateurId: string;
  role: Role;
  siteId: string | null;
  /** La fiche d'accès telle que `get_me()` la rend (0008) ; absente tant que la migration n'est pas jouée. */
  acces: AccesCourant | null;
}

/**
 * L'utilisateur connecté, résolu **par le serveur** — c'est `get_me()` qui
 * décide du rôle, jamais le navigateur. Nul si personne n'est connecté ou si
 * le compte n'a pas de profil actif.
 */
export async function utilisateurCourant(client: SupabaseClient): Promise<UtilisateurCourant | null> {
  const { data, error } = await client.rpc("get_me").maybeSingle<{ utilisateur_id: string; role: Role; site_id: string | null; profil?: string; perimetre?: unknown; niveaux?: Record<string, string>; sanctions?: boolean }>();
  if (error || !data) return null;
  const acces = data.niveaux && data.profil ? normaliserAccesCourant(data.profil, data.perimetre, data.niveaux, data.sanctions ?? false) : null;
  return { utilisateurId: data.utilisateur_id, role: data.role, siteId: data.site_id, acces };
}

function normaliserAccesCourant(profil: string, perimetre: unknown, niveaux: Record<string, string>, sanctions: boolean): AccesCourant {
  const p = (perimetre ?? {}) as Partial<Record<keyof Perimetre, unknown>>;
  const liste = (v: unknown, tout: string) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : tout);
  return {
    profil: (PROFILS.some((x) => x.profil === profil) ? profil : "lecteur") as Profil,
    perimetre: { sites: liste(p.sites, "tous") as Perimetre["sites"], businessUnits: liste(p.businessUnits, "toutes") as Perimetre["businessUnits"], regimes: liste(p.regimes, "tous") as Perimetre["regimes"] },
    niveaux: Object.fromEntries(MODULES.map((m) => [m.module, (NIVEAUX as string[]).includes(niveaux[m.module] ?? "") ? niveaux[m.module] : "aucun"])) as Record<Module, Niveau>,
    sanctions,
  };
}
