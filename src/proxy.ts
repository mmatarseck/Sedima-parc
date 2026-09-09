/* ============================================================================
 * Le proxy de session — ce qui court avant chaque page.
 *
 * Deux choses, et seulement quand un projet Supabase est configuré :
 *
 *   * **rafraîchir la session** : `@supabase/ssr` la tient dans les cookies, et
 *     c'est ici, où la réponse peut encore écrire des cookies, qu'un jeton
 *     expiré se renouvelle. Un composant serveur ne le peut pas.
 *   * **garder la porte** : sans session, les écrans de l'application renvoient
 *     à la page de garde ; avec une session, la page de garde renvoie à la
 *     flotte. C'est un contrôle optimiste — la vraie autorisation est dans les
 *     politiques RLS et dans `get_me()`, pas ici.
 *
 * Sans configuration, le proxy laisse tout passer : l'application est en
 * démonstration, et la page de garde propose ses comptes.
 * ==========================================================================*/

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PAGE_DE_GARDE = "/connexion";
const PREMIERE_PAGE = "/flotte";

export async function proxy(requete: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return NextResponse.next();

  let reponse = NextResponse.next({ request: requete });
  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll: () => requete.cookies.getAll(),
      setAll: (liste) => {
        for (const { name, value } of liste) requete.cookies.set(name, value);
        reponse = NextResponse.next({ request: requete });
        for (const { name, value, options } of liste) reponse.cookies.set(name, value, options);
      },
    },
  });

  /* `getUser()` et non `getSession()` : le premier revalide le jeton auprès du
     serveur d'authentification, le second se fie au cookie. */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chemin = requete.nextUrl.pathname;
  const surLaGarde = chemin === PAGE_DE_GARDE;
  /* Les routes d'API répondent elles-mêmes à qui n'est pas connecté (liste
     vide, ou 401) : le passage du matin de Vercel n'a pas de session, et une
     redirection vers la page de garde lui ferait croire à une page HTML. */
  const api = chemin.startsWith("/api/");

  if (!user && !surLaGarde && !api) {
    const destination = requete.nextUrl.clone();
    destination.pathname = PAGE_DE_GARDE;
    /* La page demandée est gardée : un QR code scanné sans session mène à
       la connexion, puis au véhicule — pas à la flotte. */
    destination.search = chemin !== "/" && chemin !== PREMIERE_PAGE ? `?suite=${encodeURIComponent(chemin + requete.nextUrl.search)}` : "";
    return NextResponse.redirect(destination);
  }
  if (user && surLaGarde && !requete.nextUrl.searchParams.has("motif")) {
    const destination = requete.nextUrl.clone();
    const suite = requete.nextUrl.searchParams.get("suite");
    destination.pathname = PREMIERE_PAGE;
    destination.search = "";
    if (suite && suite.startsWith("/") && !suite.startsWith("//")) return NextResponse.redirect(new URL(suite, requete.nextUrl.origin));
    return NextResponse.redirect(destination);
  }
  return reponse;
}

export const config = {
  /* Tout sauf les fichiers servis tels quels : ressources de Next, images,
     icônes — et le manifeste, que le navigateur lit sans cookies pour
     proposer l'installation : gardé, il recevrait la page de connexion. */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon$|apple-icon$|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|xml|webmanifest)$).*)"],
};
