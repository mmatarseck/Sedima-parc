"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CarFront } from "lucide-react";
import { FicheVehicule } from "./FicheVehicule";
import { fabriquerLigneFlotte } from "@/composants/transactions/fabriques";
import { normaliser } from "@/domaine/immatriculation";
import type { FicheVehicule as Fiche } from "@/domaine/fiche";
import { ficheVierge } from "@/donnees/fiche-demo";
import { lireToutesCreations } from "@/lib/clotures-demo";
import { lireParametres } from "@/lib/parametres-demo";

/* ============================================================================
 * La fiche d'un véhicule créé dans l'application.
 *
 * Le serveur ne connaît que le jeu de démonstration : un véhicule saisi depuis
 * la liste Flotte vit dans le navigateur, et lui seul peut le retrouver. La
 * page laisse donc ce composant chercher la création, en fabriquer la ligne de
 * flotte et la fiche vierge qui va avec. En production, le véhicule sera en
 * base et la fiche se rendra sur le serveur comme les autres : ce détour
 * disparaîtra avec le jeu de démonstration.
 *
 * Le temps de la lecture — un aller-retour de montage —, on ne montre rien
 * plutôt qu'un « introuvable » qui se démentirait aussitôt.
 * ==========================================================================*/

export function FicheVehiculeCreee({ immatriculation, ongletInitial, discussionInitiale, cible }: { immatriculation: string; ongletInitial?: string; discussionInitiale?: boolean; cible?: string }) {
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [cherche, setCherche] = useState(false);

  useEffect(() => {
    const canonique = normaliser(immatriculation);
    const creation = lireToutesCreations("vehicule").find((c) => normaliser(String(c.valeurs.immatriculation ?? "")) === canonique);
    if (creation) setFiche(ficheVierge(fabriquerLigneFlotte(creation), lireParametres()));
    setCherche(true);
  }, [immatriculation]);

  if (fiche) return <FicheVehicule fiche={fiche} ongletInitial={ongletInitial} discussionInitiale={discussionInitiale} cible={cible} />;
  if (!cherche) return null;

  return (
    <div className="grid flex-1 place-items-center px-6 py-20">
      <div className="flex max-w-[420px] flex-col items-center text-center">
        <span className="grid size-12 place-items-center rounded-full bg-surface-3 text-attenue">
          <CarFront className="size-6" strokeWidth={1.6} />
        </span>
        <h1 className="titre-bloc mt-4">Véhicule introuvable</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-texte-2">
          Aucun véhicule immatriculé <span className="code text-texte">{immatriculation}</span> dans le parc, ni parmi les véhicules saisis dans cette application.
        </p>
        <Link href="/flotte" className="bouton-secondaire mt-5">
          <ArrowLeft className="size-4" strokeWidth={1.8} />
          Revenir à la flotte
        </Link>
      </div>
    </div>
  );
}
