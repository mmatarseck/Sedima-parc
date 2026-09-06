import { redirect } from "next/navigation";
import { Coquille } from "@/composants/coquille/Coquille";
import { AmorceSession } from "@/composants/coquille/AmorceSession";
import { AmorceParametres } from "@/composants/parametres/AmorceParametres";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Toutes les pages de l'application portent le rail de navigation. La page de
 * garde, elle, vit hors de ce groupe : elle occupe l'écran entier.
 *
 * Quand l'authentification est réelle, c'est ici que la session se lit : sans
 * compte, retour à la page de garde ; avec un compte sans profil, retour à la
 * page de garde qui explique ; avec un profil, le rôle résolu par `get_me()`
 * est posé dans le navigateur par `AmorceSession`.
 */
export default async function LayoutApplication({ children }: { children: React.ReactNode }) {
  const session = await sessionCourante();
  if (session.etat === "anonyme") redirect("/connexion");
  if (session.etat === "sans-profil") redirect("/connexion?motif=sans-profil");

  return (
    <Coquille>
      {session.etat === "connecte" ? <AmorceSession role={session.session.role} nom={session.session.nom} courriel={session.session.courriel} /> : null}
      <AmorceParametres />
      {children}
    </Coquille>
  );
}
