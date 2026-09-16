"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/* ============================================================================
 * Le lien « ‹ Flotte » d'une fiche : revenir d'où l'on vient, pas au début.
 *
 * Demande du métier du 16 septembre 2026 : « au retour, on doit retourner à la
 * vue précédente, avec la bonne page ». Le lien était une adresse fixe —
 * `/flotte` — : il ouvrait la liste à neuf, première page, sans le filtre ni le
 * tri qu'on venait de poser. Cent quatre-vingts véhicules, et il fallait
 * refaire le chemin à chaque fiche.
 *
 * POURQUOI L'HISTORIQUE. Revenir par l'historique du navigateur rend la page
 * telle qu'on l'a quittée : c'est lui qui sait où l'on était, et c'est le
 * geste que la flèche du navigateur fait déjà. La liste, de son côté, mémorise
 * sa page, ses filtres, son tri et son défilement le temps de l'onglet
 * (`TableListe`) — les deux ensemble rendent la vue précédente exactement.
 *
 * ET QUAND IL N'Y A PAS D'HISTORIQUE — une fiche ouverte depuis un lien, dans
 * un nouvel onglet, depuis une notification — reculer sortirait de
 * l'application, ou ne ferait rien. On va alors à l'adresse donnée : la liste,
 * qui rend ce qu'elle a mémorisé.
 * ==========================================================================*/

export function LienRetour({ href, libelle }: { href: string; libelle: string }) {
  const router = useRouter();
  return (
    <a
      href={href}
      onClick={(e) => {
        /* Un clic modifié — molette, Ctrl, Maj — demande un nouvel onglet : on
           laisse le navigateur faire, avec l'adresse. */
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        const dIci = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin);
        if (window.history.length > 1 && dIci) router.back();
        else router.push(href);
      }}
      className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce"
    >
      <ChevronLeft className="size-3.5" strokeWidth={1.8} />
      {libelle}
    </a>
  );
}
