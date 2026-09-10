"use client";

/* ============================================================================
 * Les demandes, dans la barre du haut plutôt que dans le rail.
 *
 * Retirées du menu le 10 septembre 2026, à la demande du métier. Le rail liste
 * ce qu'on **consulte** — la flotte, les chauffeurs, la maintenance, les coûts
 * : des référentiels où l'on entre pour chercher quelque chose. Les demandes
 * ne sont pas cela. C'est une **corbeille** : elle se regarde souvent, en
 * passant, et ce qui compte d'elle est le nombre qui attend. Sa place est donc
 * à côté de la cloche, avec qui elle partage ce rôle.
 *
 * Le compte vient de `/api/demandes-en-attente` et ne retient que les demandes
 * échues et sans réponse — les seules qui appellent un geste. Il se relit au
 * retour sur l'onglet, comme la cloche : une réponse a pu arriver entre-temps.
 * ==========================================================================*/

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { lireAccesCourant } from "@/lib/acces-courant";

export function LienDemandes() {
  const [enAttente, setEnAttente] = useState(0);
  /* L'entrée du rail portait `module: "demandes"` et disparaissait pour qui
     n'y a aucun accès ; la corbeille hérite de la même règle. Elle part de
     `false` : un rendu serveur ne connaît pas l'accès, et une corbeille qui
     apparaît puis disparaît est pire qu'une corbeille qui arrive. */
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let vivant = true;
    setVisible(lireAccesCourant().niveaux.demandes !== "aucun");
    const rafraichir = () => {
      void fetch("/api/demandes-en-attente", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ enAttente: number }>) : null))
        .then((j) => {
          if (vivant && j) setEnAttente(j.enAttente);
        })
        .catch(() => {
          /* Sans réponse, pas de pastille — la barre reste servie. */
        });
    };
    rafraichir();
    window.addEventListener("focus", rafraichir);
    return () => {
      vivant = false;
      window.removeEventListener("focus", rafraichir);
    };
  }, []);

  if (!visible) return null;

  return (
    <Link
      href="/demandes"
      title={enAttente > 0 ? `${enAttente} demande${enAttente > 1 ? "s" : ""} sans réponse` : "Demandes"}
      className="relative grid size-9 place-items-center rounded-full text-texte-2 hover:bg-surface-3 hover:text-texte"
    >
      <Inbox className="size-[18px]" strokeWidth={1.7} />
      {enAttente > 0 ? <span className="absolute top-2 right-2 size-1.5 rounded-full bg-defavorable ring-2 ring-surface" /> : null}
      <span className="sr-only">Demandes</span>
    </Link>
  );
}
