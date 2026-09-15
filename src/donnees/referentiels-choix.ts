/* ============================================================================
 * Les référentiels tels que les formulaires les demandent.
 *
 * Une lecture, faite dans la mise en page, dont le navigateur se sert ensuite
 * pour toutes ses listes de choix (`src/lib/referentiels-navigateur.ts`). Elle
 * ne rend que ce qu'un `<select>` affiche — plaque, nom, libellé — et rien de
 * plus : c'est une liste d'options, pas une copie du parc.
 *
 * Elle ne fait échouer aucune page. Un référentiel illisible donne une liste
 * vide et une trace au journal : mieux vaut un choix vide, qui se voit, qu'une
 * page qui ne s'ouvre pas.
 * ==========================================================================*/

import { cache } from "react";
import type { Parametres } from "@/domaine/parametres";
import { REFERENTIELS_VIDES, type ReferentielsChoix } from "@/lib/referentiels-navigateur";
import { lignesChauffeurs } from "./chauffeurs";
import { lignesFlotte } from "./flotte";
import { sites } from "./referentiels";
import { transporteursServeur } from "./transporteurs";

async function referentielsChoixBrut(parametres: Parametres): Promise<ReferentielsChoix> {
  try {
    const [flotte, chauffeurs, listeSites, tiers] = await Promise.all([
      lignesFlotte(parametres),
      lignesChauffeurs(),
      sites(),
      transporteursServeur(),
    ]);
    return {
      /* Un véhicule sorti du parc ne s'attelle ni ne se remplit : il n'a rien à
         faire dans une liste de saisie, mais reste consultable sur sa fiche. */
      vehicules: flotte
        .filter((l) => l.vehicule.statut !== "sorti")
        .map((l) => ({
          id: l.vehicule.id,
          immatriculation: l.vehicule.immatriculation,
          immatriculationAffichee: l.vehicule.immatriculationAffichee,
          marque: l.vehicule.marque,
          appellation: l.vehicule.appellation,
          categorie: l.vehicule.categorie,
          statut: l.vehicule.statut,
          businessUnit: l.vehicule.businessUnit,
          siteId: l.site?.id ?? null,
          site: l.site?.libelle ?? null,
          vin: l.vehicule.vin,
        })),
      chauffeurs: chauffeurs.map((c) => ({
        id: c.id,
        nomComplet: c.nomComplet,
        actif: c.chauffeur.actif,
        statut: c.statut,
        site: c.site?.libelle ?? null,
        matriculeRh: c.chauffeur.matriculeRh,
        telephone: c.chauffeur.telephone,
        vehicule: c.vehiculeTitulaire?.immatriculationAffichee ?? c.suppleances[0]?.immatriculationAffichee ?? null,
      })),
      sites: listeSites,
      prestataires: tiers.prestataires.map((p) => ({ numero: p.numero, raisonSociale: p.raisonSociale, ville: p.ville ?? null, type: p.type, actif: p.actif })),
      camionsTiers: tiers.camions.map((c) => ({ immatriculation: c.immatriculation, immatriculationAffichee: c.immatriculationAffichee, transporteurNumero: c.transporteurNumero, actif: c.actif })),
      chauffeursTiers: tiers.chauffeurs.map((c) => ({ id: c.id, nom: c.nom, transporteurNumero: c.transporteurNumero, actif: c.actif })),
    };
  } catch (e) {
    console.error(`Référentiels des formulaires : lecture impossible — ${e instanceof Error ? e.message : String(e)}`);
    return REFERENTIELS_VIDES;
  }
}

/** Une lecture par requête : la mise en page est seule à l'appeler, mais elle est chère. */
export const referentielsChoixServeur = cache(referentielsChoixBrut);
