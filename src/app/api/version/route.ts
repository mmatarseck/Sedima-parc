/**
 * La version de l'application en ligne : le commit déployé par Vercel.
 *
 * Une page ouverte compare la version qu'elle a chargée à celle-ci ; si elles
 * diffèrent, une nouvelle version a été mise en ligne depuis, et un bandeau
 * propose d'actualiser (métier, 3 octobre 2026). Rien de confidentiel : un
 * identifiant de commit, lisible sans session — le proxy laisse passer
 * `/api/`. Jamais mis en cache, sans quoi l'ancienne réponse masquerait la
 * nouvelle version.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "local";
  return Response.json({ version }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
