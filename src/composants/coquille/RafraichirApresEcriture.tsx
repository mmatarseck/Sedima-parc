"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EVENEMENT_BASE_ECRITE } from "@/lib/clotures-demo";
import { relireReferentiels } from "@/lib/referentiels-actions";
import { poserReferentiels } from "@/lib/referentiels-navigateur";

/* ============================================================================
 * Redemander la page quand la base a pris une écriture.
 *
 * LE DÉFAUT QUE CELA CORRIGE. Les listes déroulantes des formulaires se
 * construisent sur les référentiels que la mise en page pose en mémoire à
 * chaque rendu du serveur (`AmorceReferentiels`). L'écriture appelle bien
 * `revalidatePath()`, mais c'est un geste **de serveur** : il vide le cache,
 * il ne demande pas au navigateur de revenir. Sans ce composant, la page
 * gardait donc les référentiels du dernier rendu, et tout ce qui venait d'être
 * créé restait introuvable dans le formulaire suivant.
 *
 * Le métier l'a signalé trois fois le 15 septembre 2026, sans qu'on voie que
 * c'était trois fois le même défaut : « j'ai rajouté le site une fois, mais je
 * ne le retrouve pas en mettant à jour un autre véhicule », « j'ai rajouté un
 * usage, je ne l'ai pas retrouvé sur une autre voiture », « les nouveaux
 * chauffeurs ne figurent pas sur la liste pour affectation à un véhicule ».
 *
 * POURQUOI UN DÉLAI. Une saisie peut écrire plusieurs lignes coup sur coup —
 * une affectation qui clôt la précédente, une création qui pose sa trace.
 * Redemander la page à chaque écriture la redemanderait trois fois pour un seul
 * geste. On attend donc un court instant que la rafale retombe.
 *
 * CE COMPOSANT N'AFFICHE RIEN : il écoute, et il rafraîchit.
 * ==========================================================================*/

/** Assez court pour que la liste suivante soit à jour, assez long pour absorber une rafale. */
const REPOS = 400;

export function RafraichirApresEcriture() {
  const router = useRouter();

  useEffect(() => {
    let minuteur: ReturnType<typeof setTimeout> | null = null;
    const surEcriture = () => {
      if (minuteur) clearTimeout(minuteur);
      minuteur = setTimeout(() => {
        minuteur = null;
        router.refresh();
        /* Et les référentiels eux-mêmes, relus et posés sans attendre ce que
           le rafraîchissement rejoue : la liste qui s'ouvre ensuite porte ce
           qui vient d'être écrit (16 septembre 2026, chauffeur créé absent de
           la liste d'affectation). */
        void relireReferentiels().then((r) => {
          if (r) poserReferentiels(r);
        });
      }, REPOS);
    };
    window.addEventListener(EVENEMENT_BASE_ECRITE, surEcriture);
    return () => {
      if (minuteur) clearTimeout(minuteur);
      window.removeEventListener(EVENEMENT_BASE_ECRITE, surEcriture);
    };
  }, [router]);

  return null;
}
