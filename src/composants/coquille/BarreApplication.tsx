import Image from "next/image";
import Link from "next/link";
import { Assistant } from "@/composants/assistant/Assistant";
import { Cloche } from "./Cloche";
import { MenuUtilisateur } from "./MenuUtilisateur";
import { RechercheGlobale } from "./RechercheGlobale";
import { HAUTEUR_BARRE } from "./mesures";
import { NOM_APPLICATION, SOUS_TITRE_APPLICATION } from "@/domaine/marque";

/**
 * Barre d'application, en haut et sur toute la largeur.
 *
 * C'est la seule partie commune à toutes les vues : identité de l'application,
 * recherche transversale, notifications, menu du compte. Le titre de l'écran,
 * lui, vit dans le contenu, avec les données qu'il annonce.
 *
 * Traitement repris des références : barre blanche, recherche en pilule au
 * centre, cloche et avatar à droite, un seul filet sous la barre.
 */
export function BarreApplication() {
  return (
    <header
      className="sticky top-0 z-40 flex items-center gap-4 border-b border-bordure bg-surface px-5"
      style={{ height: HAUTEUR_BARRE }}
    >
      <Link href="/" className="flex shrink-0 items-center gap-3">
        <Image
          src="/sedima-picto.png"
          alt=""
          width={34}
          height={34}
          priority
          className="size-[34px] shrink-0 object-contain"
        />
        <span className="hidden leading-tight sm:block">
          <span className="block text-[13.5px] font-semibold tracking-[-0.01em] whitespace-nowrap text-texte">
            {NOM_APPLICATION}
          </span>
          <span className="meta block text-[11px]">{SOUS_TITRE_APPLICATION}</span>
        </span>
        <span className="sr-only">{NOM_APPLICATION} — accueil</span>
      </Link>

      <div className="ml-auto flex min-w-0 flex-1 justify-end lg:ml-10 lg:justify-center">
        <RechercheGlobale />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {/* L'assistant est à côté de la recherche : on cherche un numéro, on
            demande un chiffre — deux façons d'interroger le parc. */}
        <Assistant />
                <Cloche />
        <span className="mx-1 hidden h-6 w-px bg-bordure sm:block" aria-hidden="true" />
        <MenuUtilisateur />
      </div>
    </header>
  );
}
