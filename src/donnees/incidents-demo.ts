/* ============================================================================
 * Incidents & sinistres — données de démonstration.
 *
 * Une seule vérité : les déclarations du jeu de données vivent sur les fiches
 * chauffeurs (attribuées au conducteur de la période). Le module et l'onglet
 * de la fiche véhicule les relisent d'ici, complétées par le véhicule porteur.
 * Les déclarations créées dans l'application s'y ajoutent côté navigateur.
 * ==========================================================================*/

import type { LigneIncident } from "@/domaine/incidents";
import { fichesChauffeurs } from "./chauffeurs-demo";
import { FLOTTE } from "./parc-demo";

let CACHE: LigneIncident[] | null = null;

export function listeIncidents(): LigneIncident[] {
  if (CACHE) return CACHE;
  const vus = new Set<string>();
  const lignes: LigneIncident[] = [];
  for (const f of fichesChauffeurs()) {
    for (const i of f.incidents) {
      const d = i.declaration;
      if (vus.has(d.numero)) continue;
      vus.add(d.numero);
      const l = FLOTTE.find((x) => x.vehicule.id === d.vehiculeId);
      lignes.push({
        numero: d.numero,
        vehiculeId: d.vehiculeId,
        immatriculation: l?.vehicule.immatriculation ?? d.vehiculeId,
        immatriculationAffichee: i.immatriculationAffichee,
        vehicule: i.vehicule,
        businessUnit: l?.vehicule.businessUnit ?? null,
        site: l?.site?.libelle ?? null,
        nature: d.nature,
        type: d.type,
        dateHeure: d.dateHeure,
        lieu: d.lieu,
        chauffeurId: f.ligne.id,
        chauffeur: f.ligne.nomComplet,
        mission: d.mission,
        roulant: d.roulant,
        statut: d.statut,
        responsabilite: d.responsabilite,
        blesses: d.blesses,
        sinistreOuvert: d.sinistreOuvert,
        cout: i.cout,
        immobilisationJours: i.immobilisationJours,
        description: d.description,
        kilometrage: d.kilometrage,
        declarant: "Service parc",
        creee: false,
      });
    }
  }
  lignes.sort((a, b) => b.dateHeure.localeCompare(a.dateHeure));
  CACHE = lignes;
  return lignes;
}

export function incidentsDuVehicule(vehiculeId: string): LigneIncident[] {
  return listeIncidents().filter((l) => l.vehiculeId === vehiculeId);
}
