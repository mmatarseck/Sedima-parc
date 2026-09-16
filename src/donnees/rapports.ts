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
import { resumesFicheDepuisLaSource, type PieceReglementaire, type SourceRapports } from "@/domaine/assembler-rapports";
import type { AffectationFiche } from "@/domaine/fiche";
import { BUSINESS_UNIT } from "@/domaine/libelles";
import { idChauffeur, nomComplet } from "@/domaine/chauffeur";
import type { Parametres } from "@/domaine/parametres";
import { clientServeur } from "@/lib/supabase";
import { achatsServeur } from "./achats";
import { budgetServeur } from "./budget";
import { caisseServeur } from "./caisse";
import { carburantServeur } from "./carburant";
import { lignesChauffeurs } from "./chauffeurs";
import { conformiteServeur } from "./conformite";
import { coutsServeur } from "./couts";
import { fichesChauffeursServeur } from "./fiche-chauffeur";
import { lignesFlotte, parcServeur, type ParcBrut } from "./flotte";
import { lignesLues } from "./lecture";
import { incidentsServeur } from "./incidents";
import { interventionsServeur, travauxServeur } from "./maintenance";
import { ordresServeur } from "./ordres";
import { parcLegerServeur } from "./parc-leger";
import { prestatairesServeur } from "./prestataires";

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

/** Le compteur à une date, sur des points croissants : le dernier avant, sinon le premier après. */
function kmVers(points: { date: string; km: number }[], date: string): number | null {
  let avant: number | null = null;
  for (const p of points) {
    if (p.date <= date) avant = p.km;
    else return avant ?? p.km;
  }
  return avant;
}

/** Les affectations de chaque véhicule, depuis le parc déjà lu : la forme de la fiche, par immatriculation. */
export function affectationsDepuisLeParc(parc: ParcBrut): Map<string, AffectationFiche[]> {
  const vehicules = new Map(parc.vehicules.map((v) => [v.id, v]));
  const resultat = new Map<string, AffectationFiche[]>();
  /* Les relevés de chaque véhicule, du plus ancien au plus récent : chaque
     période reçoit ainsi ses kilomètres, comme le fait la fiche véhicule. Sans
     eux, la colonne « Km du titulaire » du rapport des affectations affichait
     « 0 km » pour tout le parc — un chiffre inventé, pas une absence. */
  const relevesPar = new Map<string, { date: string; km: number }[]>();
  for (const r of parc.releves) {
    const liste = relevesPar.get(r.vehicule_id);
    if (liste) liste.push({ date: r.date, km: r.km });
    else relevesPar.set(r.vehicule_id, [{ date: r.date, km: r.km }]);
  }
  for (const liste of relevesPar.values()) liste.sort((x, y) => x.date.localeCompare(y.date));
  for (const a of parc.affectations) {
    const v = vehicules.get(a.vehicule_id);
    if (!v) continue;
    const c = parc.chauffeurs.get(a.chauffeur_id) ?? null;
    const nom = c ? nomComplet(c) : null;
    const site = v.site_id ? (parc.sites.get(v.site_id)?.libelle ?? "—") : "—";
    const points = relevesPar.get(a.vehicule_id) ?? [];
    const kmDebut = kmVers(points, a.debut);
    const kmFin = kmVers(points, a.fin ?? parc.aujourdhui);
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
      kmParcourus: kmDebut !== null && kmFin !== null && kmFin > kmDebut ? kmFin - kmDebut : 0,
      motif: a.motif ?? "",
    });
    resultat.set(v.immatriculation, liste);
  }
  for (const liste of resultat.values()) liste.sort((x, y) => y.debut.localeCompare(x.debut));
  return resultat;
}

/**
 * Les pièces réglementaires des véhicules, avec ou sans fichier : chaque ligne
 * `document` d'un véhicule, et la licence de transport par le lien (type
 * « licence »). Deux lectures bornées à ce que le rapport montre — pas les
 * montants, pas les émetteurs.
 */
async function piecesReglementairesServeur(): Promise<PieceReglementaire[]> {
  const client = await clientServeur();
  const [documents, licences] = await Promise.all([
    client.from("document").select("vehicule_id, type_document_id, echeance, fichier").not("vehicule_id", "is", null).limit(10000).returns<{ vehicule_id: string; type_document_id: string; echeance: string | null; fichier: string | null }[]>(),
    client.from("licence_vehicule").select("vehicule_id, licence_transport (echeance, fichier)").limit(2000).returns<{ vehicule_id: string; licence_transport: { echeance: string | null; fichier: string | null } | null }[]>(),
  ]);
  return [
    ...lignesLues("Pièces des véhicules", documents).map((d) => ({ vehiculeId: d.vehicule_id, type: d.type_document_id, echeance: d.echeance, fichier: d.fichier })),
    ...lignesLues("Licences des véhicules", licences)
      .filter((l) => l.licence_transport)
      .map((l) => ({ vehiculeId: l.vehicule_id, type: "licence", echeance: l.licence_transport!.echeance, fichier: l.licence_transport!.fichier })),
  ];
}

async function sourceRapportsServeurBrut(parametres: Parametres): Promise<SourceRapports> {
  const [lignes, conformite, visites, couts, carburant, interventions, ordres, travaux, incidents, chauffeurs, fichesChauffeurs, achats, caisse, prestataires, transporteurs, releves, budget, parcLeger] = await Promise.all([
    lignesFlotte(parametres),
    conformiteServeur(parametres),
    visitesServeur(),
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
    parcLegerServeur(parametres),
  ]);
  const affectations = affectationsDepuisLeParc(await parcServeur());
  const pieces = await piecesReglementairesServeur();
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
    parcLeger,
    pieces,
  };
  /* Ce que la fiche apporte, dérivé des lecteurs. */
  return { ...sansFiches, resumesFiche: resumesFicheDepuisLaSource(sansFiches) };
}

export const sourceRapportsServeur = cache(sourceRapportsServeurBrut);
