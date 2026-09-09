/* ============================================================================
 * Les rapports sur le jeu de démonstration.
 *
 * L'assemblage vit dans le domaine (`assembler-rapports.ts`) et lit une
 * source ; ce module lui donne celle du navigateur — les mêmes formes que la
 * base, chacune depuis son module de démonstration — et garde
 * `construireRapport(id, contexte, parametres)` pour l'assistant, qui tourne
 * dans le navigateur, et pour le banc de photographie. **Aucun import
 * serveur ici** : ce module entre dans le paquet du navigateur.
 * ==========================================================================*/

import { construireRapportDe, CONTEXTE_PAR_DEFAUT, type ContexteRapport, type ResumeFiche, type SourceRapports } from "@/domaine/assembler-rapports";
import type { AffectationFiche } from "@/domaine/fiche";
import { PARAMETRES_DEFAUT, type Parametres } from "@/domaine/parametres";
import type { LigneRapport } from "@/domaine/rapports";
import { sourceBudgetDemo } from "./budget-demo";
import { demandesAchat, journalCaisse } from "./caisse-demo";
import { livraisonsEtJauges, pleinsFlotte } from "./carburant-demo";
import { DATE_REFERENCE, fichesChauffeurs, listeChauffeurs } from "./chauffeurs-demo";
import { sourcePrestatairesDemo } from "./compte-prestataire-demo";
import { echeancesDemonstration } from "./conformite-demo";
import { donneesCouts } from "./couts-demo";
import { fichePourImmatriculation } from "./fiche-demo";
import { sourceDemonstration as sourceTransporteursDemo } from "./fiche-transporteur-demo";
import { lignesFlotteDemonstration } from "./flotte-demo";
import { listeIncidents } from "./incidents-demo";
import { interventionsFlotte, ordresDeTravail, travauxAFaire } from "./maintenance-demo";
import { FLOTTE } from "./parc-demo";
import { sourceParcLegerDemo } from "./parc-leger-demo";
import { relevesTransport } from "./releve-demo";
import { visitesDemonstration } from "./visites-demo";

export { CONTEXTE_PAR_DEFAUT, type ContexteRapport } from "@/domaine/assembler-rapports";

/** Les affectations de chaque véhicule, relues sur les fiches de démonstration. */
export function affectationsDemonstration(parametres: Parametres): Map<string, AffectationFiche[]> {
  const resultat = new Map<string, AffectationFiche[]>();
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation, parametres);
    if (f) resultat.set(l.vehicule.id, f.affectations);
  }
  return resultat;
}

/** Ce que la fiche de chaque véhicule apporte aux rapports, relu sur les fiches de démonstration. */
export function resumesFicheDemonstration(parametres: Parametres): Map<string, ResumeFiche> {
  const resultat = new Map<string, ResumeFiche>();
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation, parametres);
    if (!f) continue;
    const echeance = f.echeances[0] ?? null;
    resultat.set(l.vehicule.id, {
      identite: f.identite,
      indicateurs: { coutDouzeMois: f.indicateurs.coutDouzeMois, coutParKm: f.indicateurs.coutParKm, consommationL100: f.indicateurs.consommationL100, disponibilitePct: f.indicateurs.disponibilitePct },
      immobilisation: f.immobilisationAdministrative,
      prochaineEcheance: echeance ? `${echeance.libelle} · ${echeance.repere}` : null,
      documentsATraiter: f.documents.filter((d) => d.etat === "manquant" || d.etat === "echu" || d.etat === "bientot").length,
    });
  }
  return resultat;
}

const CACHE = new Map<string, SourceRapports>();

/** La source des rapports sur le jeu de démonstration, une fois par jeu de paramètres. */
export function sourceRapportsDemo(parametres: Parametres = PARAMETRES_DEFAUT): SourceRapports {
  const cle = JSON.stringify(parametres);
  let source = CACHE.get(cle);
  if (!source) {
    const visites = visitesDemonstration(parametres);
    source = {
      aujourdhui: DATE_REFERENCE,
      lignes: lignesFlotteDemonstration(parametres),
      resumesFiche: resumesFicheDemonstration(parametres),
      affectations: affectationsDemonstration(parametres),
      echeances: echeancesDemonstration(parametres),
      visites: visites.visites,
      observations: visites.observations,
      couts: donneesCouts(),
      pleins: pleinsFlotte(),
      cuve: livraisonsEtJauges(),
      interventions: interventionsFlotte(),
      ordres: ordresDeTravail(),
      travaux: travauxAFaire(),
      incidents: listeIncidents(),
      chauffeurs: listeChauffeurs(),
      fichesChauffeurs: fichesChauffeurs(),
      achats: demandesAchat(),
      journal: journalCaisse(),
      prestataires: sourcePrestatairesDemo(),
      transporteurs: sourceTransporteursDemo(),
      releves: relevesTransport(),
      budget: sourceBudgetDemo(),
      parcLeger: sourceParcLegerDemo(),
    };
    CACHE.set(cle, source);
  }
  return source;
}

/** Les lignes d'un rapport de démonstration — pour l'assistant et le banc, sans session. */
export function construireRapport(id: string, c: ContexteRapport = CONTEXTE_PAR_DEFAUT, parametres: Parametres = PARAMETRES_DEFAUT): LigneRapport[] {
  return construireRapportDe(sourceRapportsDemo(parametres), id, c, parametres);
}
