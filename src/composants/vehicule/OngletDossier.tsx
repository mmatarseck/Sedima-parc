"use client";

import { useMemo } from "react";
import { DossierPieces, type FamillePieces } from "@/composants/interface/DossierPieces";
import { CHAMPS } from "@/composants/transactions/champs";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { FAMILLE_PIECE, type FicheVehicule, type PieceDossier } from "@/domaine/fiche";
import { useAjoutVehicule } from "./ajout";

/* ============================================================================
 * Le dossier d'un véhicule : ses pièces, en deux familles, ouvertes sur place.
 *
 * DEUX FAMILLES, TOUJOURS LÀ. Le réglementaire — carte grise, assurance,
 * salubrité, licence — et les procès-verbaux de visite. Les cartes sont là
 * pour chaque véhicule, vides ou non (métier, 16 septembre 2026 : « tous les
 * véhicules n'ont pas les sous-dossiers ») : un dossier vide dit ce qui
 * manque, et c'est depuis chaque famille qu'on dépose ce qui lui revient.
 *
 * LES FACTURES N'Y SONT PLUS. Elles y ont vécu quelques heures, en troisième
 * famille ; le métier les a voulues « sur chaque ligne de dépense équivalente »
 * et a retiré la rubrique le soir même. C'est plus juste : une facture se
 * cherche à côté du montant qu'elle justifie, pas dans un classeur à part.
 *
 * DÉPOSER, C'EST CRÉER LA LIGNE QUI PORTE LA PIÈCE. Une pièce n'existe pas
 * seule : un scan d'assurance est un document, un PV est une visite. Le bouton
 * ouvre donc le formulaire de la ligne, avec son champ de fichier.
 *
 * RETIRER, C'EST VIDER LE CHAMP SUR LA LIGNE, pas effacer la ligne : la
 * visite reste ; seul le fichier s'en va. Le formulaire s'ouvre sur ce seul
 * champ, et sa trace dit qui l'a retiré. Une licence ne se retire pas d'ici :
 * elle a son référentiel.
 *
 * L'affichage lui-même — familles, visionneuse, adresses signées au clic — est
 * `DossierPieces`, partagé avec la fiche chauffeur depuis le 17 septembre 2026.
 * ==========================================================================*/

const ORDRE: PieceDossier["famille"][] = ["reglementaire", "visite"];

/** La ligne qu'on crée pour déposer dans une famille. */
const DEPOT: Record<PieceDossier["famille"], { cible: "document" | "visite"; libelle: string }> = {
  reglementaire: { cible: "document", libelle: "Déposer un document" },
  visite: { cible: "visite", libelle: "Déposer un procès-verbal" },
};

export function OngletDossier({ fiche }: { fiche: FicheVehicule }) {
  const ajouter = useAjoutVehicule(fiche);
  const { demander } = useEdition();
  const familles = useMemo<FamillePieces[]>(
    () =>
      ORDRE.map((famille) => ({
        cle: famille,
        libelle: FAMILLE_PIECE[famille].libelle,
        precision: FAMILLE_PIECE[famille].precision,
        pieces: fiche.pieces.filter((p) => p.famille === famille),
        deposer: { libelle: DEPOT[famille].libelle, onClick: () => ajouter(DEPOT[famille].cible) },
      })),
    [fiche.pieces, ajouter],
  );

  function retirer(p: PieceDossier) {
    if (p.type === "licence") return;
    const champ = CHAMPS[p.type].find((c) => c.cle === p.champFichier);
    if (!champ) return;
    demander({ type: p.type, numero: p.numero, titre: `Retirer la pièce · ${p.libelle}`, champs: [champ], valeurs: { [p.champFichier]: p.fichier } });
  }

  return <DossierPieces familles={familles} onRetirer={retirer} vide="Aucune pièce n'est attachée à ce véhicule." />;
}
