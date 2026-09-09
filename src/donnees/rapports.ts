/* ============================================================================
 * Ce que les rapports lisent, rassemblé avec la session de l'utilisateur.
 *
 * Un rapport ne calcule rien de neuf : il met en table ce que les écrans
 * portent déjà. La source des rapports est donc la réunion de ce que chaque
 * lecteur rend — la flotte, la conformité, le carburant, la maintenance, les
 * incidents, les chauffeurs, les achats et la caisse, les prestataires, les
 * transporteurs, le relevé, le budget —, chacun déjà à la forme de son écran,
 * base ou démonstration selon la session. Une lecture par requête pour
 * chacun (mise en cache par React) ; l'assemblage vit dans le domaine
 * (`assembler-rapports.ts`).
 * ==========================================================================*/

import { cache } from "react";
import { resumesFicheDepuisLaSource, type SourceRapports } from "@/domaine/assembler-rapports";
import type { AffectationFiche } from "@/domaine/fiche";
import { BUSINESS_UNIT } from "@/domaine/libelles";
import { idChauffeur, nomComplet } from "@/domaine/chauffeur";
import type { Parametres } from "@/domaine/parametres";
import { authentificationReelle } from "@/lib/session-demo";
import { achatsServeur } from "./achats";
import { budgetServeur } from "./budget";
import { caisseServeur } from "./caisse";
import { carburantServeur } from "./carburant";
import { lignesChauffeurs } from "./chauffeurs";
import { conformiteServeur } from "./conformite";
import { coutsServeur } from "./couts";
import { fichesChauffeursServeur } from "./fiche-chauffeur";
import { lignesFlotte, parcServeur, type ParcBrut } from "./flotte";
import { incidentsServeur } from "./incidents";
import { interventionsServeur, travauxServeur } from "./maintenance";
import { ordresServeur } from "./ordres";
import { prestatairesServeur } from "./prestataires";
import { affectationsDemonstration, resumesFicheDemonstration } from "./rapports-demo";
import { relevesServeur } from "./releves";
import { transporteursServeur } from "./transporteurs";
import { visitesServeur } from "./visites";

/** Les initiales d'un nom : « Babacar Ndiaye » → « BN ». */
function initialesDe(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join("");
}

/** Les affectations de chaque véhicule, depuis le parc déjà lu : la forme de la fiche, par immatriculation. */
export function affectationsDepuisLeParc(parc: ParcBrut): Map<string, AffectationFiche[]> {
  const vehicules = new Map(parc.vehicules.map((v) => [v.id, v]));
  const resultat = new Map<string, AffectationFiche[]>();
  for (const a of parc.affectations) {
    const v = vehicules.get(a.vehicule_id);
    if (!v) continue;
    const c = parc.chauffeurs.get(a.chauffeur_id) ?? null;
    const nom = c ? nomComplet(c) : null;
    const site = v.site_id ? (parc.sites.get(v.site_id)?.libelle ?? "—") : "—";
    const liste = resultat.get(v.immatriculation) ?? [];
    liste.push({
      numero: a.numero ?? "",
      chauffeur: nom,
      chauffeurId: nom ? idChauffeur(nom) : null,
      initiales: nom ? initialesDe(nom) : "—",
      role: a.role,
      debut: a.debut,
      fin: a.fin,
      buSite: `${v.business_unit ? BUSINESS_UNIT[v.business_unit] : "—"} · ${site}`,
      kmParcourus: 0,
      motif: a.motif ?? "",
    });
    resultat.set(v.immatriculation, liste);
  }
  for (const liste of resultat.values()) liste.sort((x, y) => y.debut.localeCompare(x.debut));
  return resultat;
}

async function sourceRapportsServeurBrut(parametres: Parametres): Promise<SourceRapports> {
  const [lignes, conformite, visites, couts, carburant, interventions, ordres, travaux, incidents, chauffeurs, fichesChauffeurs, achats, caisse, prestataires, transporteurs, releves, budget] = await Promise.all([
    lignesFlotte(parametres),
    conformiteServeur(parametres),
    visitesServeur(parametres),
    coutsServeur(parametres),
    carburantServeur(parametres),
    interventionsServeur(),
    ordresServeur(),
    travauxServeur(parametres),
    incidentsServeur(),
    lignesChauffeurs(),
    fichesChauffeursServeur(),
    achatsServeur(),
    caisseServeur(parametres),
    prestatairesServeur(),
    transporteursServeur(),
    relevesServeur(),
    budgetServeur(),
  ]);
  const reel = authentificationReelle();
  const affectations = reel ? affectationsDepuisLeParc(await parcServeur()) : affectationsDemonstration(parametres);
  const sansFiches: Omit<SourceRapports, "resumesFiche"> = {
    aujourdhui: conformite.aujourdhui,
    lignes,
    affectations,
    echeances: conformite.echeances,
    visites: visites.visites,
    observations: visites.observations,
    couts,
    pleins: carburant.pleins,
    cuve: carburant.cuve,
    interventions,
    ordres,
    travaux,
    incidents,
    chauffeurs,
    fichesChauffeurs,
    achats,
    journal: caisse.mouvements,
    prestataires,
    transporteurs,
    releves,
    budget,
  };
  /* Ce que la fiche apporte : lu sur les fiches en démonstration, dérivé des lecteurs en base. */
  return { ...sansFiches, resumesFiche: reel ? resumesFicheDepuisLaSource(sansFiches) : resumesFicheDemonstration(parametres) };
}

export const sourceRapportsServeur = cache(sourceRapportsServeurBrut);
