"use client";

import { CHAMPS } from "@/composants/transactions/champs";
import { cleFacture } from "@/composants/transactions/FormulaireFacture";
import { ecrituresDeCloture } from "@/domaine/cloture-service";
import type { LigneOrdre } from "@/domaine/maintenance";
import { peutCloturerService } from "@/domaine/service";
import { enregistrerCreation, enregistrerModification } from "@/lib/clotures-demo";
import { lireReferentiels } from "@/lib/referentiels-navigateur";
import { lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Clore un service de maintenance, depuis la page Maintenance ou le
 * formulaire du service. Ce qui s'écrit est décidé par
 * `domaine/cloture-service` ; ici, on l'applique, et on refuse à qui n'est pas
 * le responsable du parc — la base le refuserait de même (0060).
 * ==========================================================================*/

export type ResultatCloture = { issue: "close"; intervention: string; depenses: number; sorties: number } | { issue: "refus"; motif: string };

export function cloturerService(o: LigneOrdre, jour: string): ResultatCloture {
  if (!peutCloturerService(lireRole())) return { issue: "refus", motif: "Seul le responsable du parc clôt un service de maintenance." };
  if (o.statut === "clos" || o.statut === "annule") return { issue: "refus", motif: "Ce service est déjà clos ou annulé." };
  const vehicule = lireReferentiels().vehicules.find((v) => v.immatriculation === o.immatriculation) ?? null;
  const ecritures = ecrituresDeCloture(o, jour, cleFacture(o.dateFin ?? jour), vehicule?.id ?? null);

  let intervention = "";
  let depenses = 0;
  let sorties = 0;
  for (const e of ecritures) {
    const r = enregistrerCreation({ sujet: e.sujet, type: e.type, champs: CHAMPS[e.type], valeurs: e.valeurs, motif: `Clôture du service ${o.numero}` });
    if (r.issue === "mois-clos") return { issue: "refus", motif: `Le mois de ${r.mois} est clos : seule la direction peut y clore un service.` };
    if (r.issue !== "creee") return { issue: "refus", motif: "La date de fin des travaux est illisible." };
    if (e.type === "intervention") intervention = r.creation.numero;
    else if (e.type === "depense") depenses++;
    else sorties++;
  }

  const avant = o as unknown as Record<string, unknown>;
  enregistrerModification({
    numero: o.numero,
    sujet: `vehicule:${o.immatriculation}`,
    type: "ordre",
    titre: `Service ${o.numero} · ${o.objet}`,
    href: `/maintenance?vue=ordres&ref=${o.numero}`,
    champs: CHAMPS.ordre,
    avant: { ...avant, lignes: JSON.stringify(o.lignes ?? []) },
    apres: { ...avant, lignes: JSON.stringify(o.lignes ?? []), statut: "clos", dateCloture: jour, dateFin: o.dateFin ?? jour, interventionNumero: intervention },
    motif: `Clos par l'intervention ${intervention}`,
  });
  return { issue: "close", intervention, depenses, sorties };
}
