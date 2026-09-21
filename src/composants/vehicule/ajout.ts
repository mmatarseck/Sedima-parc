"use client";

import { useCallback } from "react";
import { champsCreation } from "@/composants/transactions/champs";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerLigneOrdre, fabriquerSignalement } from "@/composants/transactions/fabriques";
import type { LigneOrdre } from "@/domaine/maintenance";
import type { LigneSignalement } from "@/domaine/signalements";
import type { FicheVehicule } from "@/domaine/fiche";
import { prixEnergie } from "@/domaine/parametres";
import { jourCourant } from "@/domaine/temps";
import { TYPE_TRANSACTION, type TypeTransaction } from "@/domaine/reference";
import { date } from "@/lib/format";
import { lireParametres } from "@/lib/parametres-demo";
import type { CibleAjout } from "./MenuAjout";

/* ============================================================================
 * Ouvrir le formulaire de création d'une transaction sur un véhicule.
 *
 * Le menu « Ajouter » de l'en-tête et les boutons en tête de chaque liste
 * ouvrent **le même formulaire** : ils demandent la même chose, ils doivent
 * faire la même chose. Le geste vit donc ici, et non deux fois — sinon l'un des
 * deux finit par diverger, et le métier découvre qu'ajouter un plein depuis
 * l'onglet Carburant ne donne pas exactement le même formulaire que depuis le
 * menu.
 * ==========================================================================*/

export const TITRE_CREATION: Partial<Record<CibleAjout, string>> = {
  plein: "Nouveau plein",
  depense: "Nouvelle dépense",
  intervention: "Nouvelle intervention",
  affectation: "Affectation",
  attelage: "Nouvel attelage",
  visite: "Rendez-vous de visite technique",
  observation: "Observation de visite technique",
  incident: "Déclarer un incident ou un accident",
  document: "Nouveau document",
  releve: "Nouveau relevé kilométrique",
  statut: "Changement de statut",
  rappel: "Nouveau rappel",
};

/**
 * Le geste d'ajout, prêt à être branché sur un bouton. Rend faux pour une cible
 * qui n'a pas de formulaire — l'incident, dont la déclaration se fait en quatre
 * étapes, et les cibles du lot 2 encore inertes ; l'appelant décide alors quoi
 * faire.
 */
export function useAjoutVehicule(fiche: FicheVehicule): (cible: CibleAjout) => boolean {
  const { creer, saisirFacture, ouvrirService, creations } = useEdition();
  const v = fiche.ligne.vehicule;

  return useCallback(
    (cible: CibleAjout) => {
      /* Une intervention et une dépense se saisissent comme la facture qui les
         porte : l'en-tête, les lignes, la pièce jointe (21 septembre 2026). */
      if (cible === "intervention" || cible === "depense") {
        saisirFacture({
          mode: cible === "intervention" ? "atelier" : "autres",
          vehicule: { immatriculation: v.immatriculation, immatriculationAffichee: v.immatriculationAffichee, libelle: `${v.marque} ${v.appellation}` },
        });
        return true;
      }
      if (cible === "signalement") {
        creer({ type: "signalement", titre: `Signaler une panne · ${v.immatriculationAffichee}`, champs: champsCreation("signalement", { pour: "vehicule" }), valeurs: { date: jourCourant(), priorite: "normale" } });
        return true;
      }
      if (cible === "ordre-de-travail") {
        ouvrirService({
          vehicule: { immatriculation: v.immatriculation, immatriculationAffichee: v.immatriculationAffichee, libelle: `${v.marque} ${v.appellation}` },
          signalements: [...creations("signalement", fabriquerSignalement), ...(fiche.signalements ?? [])].filter((s, i, x): s is LigneSignalement => s !== null && x.findIndex((y) => y?.numero === s.numero) === i),
          services: [...creations("ordre", fabriquerLigneOrdre), ...(fiche.services ?? [])].filter((o): o is LigneOrdre => o !== null),
        });
        return true;
      }
      const type = cible as TypeTransaction;
      const titre = TITRE_CREATION[cible];
      if (!titre || !(type in TYPE_TRANSACTION)) return false;
      creer({
        type,
        titre: `${titre} · ${v.immatriculationAffichee}`,
        champs: champsCreation(type, {
          pour: "vehicule",
          categorie: v.categorie,
          visites: fiche.visitesTechniques.map((x) => ({
            valeur: x.id,
            libelle: `${x.type === "contre-visite" ? "Contre-visite" : "Visite"} du ${date(x.datePassage ?? x.dateRendezVous)} · ${x.centre}`,
          })),
        }),
        valeurs: {
          date: jourCourant(),
          debut: jourCourant(),
          dateEffet: jourCourant(),
          dateHeure: jourCourant(),
          dateRendezVous: jourCourant(),
          origine: "caisse",
          /* Le prix du litre vient du barème **en vigueur ce jour**, selon
             l'énergie du véhicule : on saisit un plein d'aujourd'hui. Pour un
             plein antérieur, la date saisie prime — le prix se corrige à la
             main, l'application ne devine pas à quel barème il se rattache. */
          prixLitre: type === "plein" ? prixEnergie(v.energie, jourCourant(), lireParametres()) : undefined,
          statut: type === "visite" ? "rendez-vous" : type === "observation" ? "a-traiter" : "declare",
          roulant: "oui",
          type: type === "visite" ? "visite" : undefined,
          centre: "CCVA Rufisque",
        },
      });
      return true;
    },
    [creer, saisirFacture, ouvrirService, creations, fiche.signalements, fiche.services, fiche.visitesTechniques, v.appellation, v.categorie, v.energie, v.immatriculation, v.immatriculationAffichee, v.marque],
  );
}
