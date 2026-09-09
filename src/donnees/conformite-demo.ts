/* ============================================================================
 * L'échéancier de la Conformité en démonstration — depuis les fiches, une
 * seule source — et les échéances des chauffeurs, les mêmes en démonstration
 * et base branchée. Sans import serveur : les rapports du navigateur
 * (l'assistant) le lisent aussi.
 * ==========================================================================*/

import type { FicheChauffeur } from "@/domaine/chauffeur";
import { niveauPour, trier, type Echeance } from "@/domaine/conformite";
import { TYPE_DOCUMENT } from "@/domaine/libelles";
import type { Parametres } from "@/domaine/parametres";
import { joursRestants } from "@/lib/format";
import { DATE_REFERENCE, fichesChauffeurs } from "./chauffeurs-demo";
import { fichePourImmatriculation } from "./fiche-demo";
import { FLOTTE, LICENCES } from "./parc-demo";

export const fmtKm = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Les échéances des chauffeurs : les mêmes en démonstration et base branchée, depuis leurs fiches. */
export function echeancesChauffeurs(fiches: FicheChauffeur[]): Echeance[] {
  const echeances: Echeance[] = [];
  for (const f of fiches) {
    const c = f.ligne;
    if (!c.chauffeur.actif) continue;
    const precision = c.vehiculeTitulaire ? `Titulaire de ${c.vehiculeTitulaire.immatriculationAffichee}${c.site ? ` · ${c.site.libelle}` : ""}` : (c.site?.libelle ?? "Sans véhicule");
    for (const d of f.documents) {
      echeances.push({
        cle: `c-${c.id}-${d.numero}`,
        numero: d.numero,
        sujet: "chauffeur",
        sujetId: c.id,
        sujetLibelle: c.nomComplet,
        sujetPrecision: precision,
        sujetHref: `/chauffeurs/${c.id}?onglet=documents&ref=${d.numero}`,
        type: d.type,
        libelle: TYPE_DOCUMENT[d.type],
        numeroPiece: d.numeroPiece,
        emetteur: d.emetteur,
        echeance: d.echeance,
        joursRestants: d.joursRestants,
        niveau: niveauPour(d.joursRestants, d.etat === "manquant", d.etat === "permanent"),
        repere: null,
        site: c.site?.libelle ?? null,
      });
    }
  }
  return echeances;
}

/**
 * L'échéancier, base branchée — pur, pour le banc d'essai. Les véhicules sont
 * ceux d'exploitation ; un document exigé qui manque apparaît, comme sur la
 * fiche ; la licence se lit une fois, par licence ; un refus de visite sans
 * contre-visite prise ouvre son délai ; un rendez-vous est une échéance.
 */

export function echeancesDemonstration(parametres: Parametres): Echeance[] {
  const echeances: Echeance[] = [];
  const reference = new Date(`${DATE_REFERENCE}T00:00:00Z`);
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation, parametres);
    if (!f) continue;
    const v = l.vehicule;
    const precision = `${v.marque} ${v.appellation}${l.site ? ` · ${l.site.libelle}` : ""}`;
    const commun = { sujet: "vehicule" as const, sujetId: v.id, sujetLibelle: v.immatriculationAffichee, sujetPrecision: precision, site: l.site?.libelle ?? null, repere: null };
    for (const d of f.documents) {
      /* Une licence portée par la flotte est une seule échéance : elle est ajoutée plus bas, une fois. */
      if (d.type === "licence-transport" && d.etat !== "manquant") continue;
      echeances.push({ ...commun, cle: `v-${v.id}-${d.numero}`, numero: d.numero, sujetHref: `/flotte/${v.immatriculation}?onglet=conformite&ref=${d.numero}`, type: d.type, libelle: TYPE_DOCUMENT[d.type], numeroPiece: d.numeroPiece, emetteur: d.emetteur, echeance: d.echeance, joursRestants: d.joursRestants, niveau: niveauPour(d.joursRestants, d.etat === "manquant", d.etat === "permanent") });
    }
    for (const d of f.immobilisationAdministrative?.documents ?? []) {
      if (d.etat !== "manquant" || f.documents.some((x) => x.type === d.type)) continue;
      echeances.push({ ...commun, cle: `v-${v.id}-manquant-${d.type}`, numero: null, sujetHref: `/flotte/${v.immatriculation}?onglet=conformite`, type: d.type, libelle: TYPE_DOCUMENT[d.type], numeroPiece: null, emetteur: null, echeance: null, joursRestants: null, niveau: niveauPour(null, true) });
    }
    const refus = f.visitesTechniques.find((x) => x.statut === "refusee");
    const contreVisitePrise = f.visitesTechniques.some((x) => x.type === "contre-visite" && x.statut === "rendez-vous");
    if (refus?.dateLimiteContreVisite && !contreVisitePrise) {
      const j = joursRestants(refus.dateLimiteContreVisite, reference);
      const ouvertes = f.observationsVisite.filter((o) => o.statut !== "corrigee").length;
      echeances.push({ ...commun, cle: `v-${v.id}-contre-visite`, numero: refus.numero, sujetHref: `/flotte/${v.immatriculation}?onglet=conformite&ref=${refus.numero}`, type: "contre-visite", libelle: `Contre-visite à programmer · ${ouvertes} observation${ouvertes > 1 ? "s" : ""} à corriger`, numeroPiece: refus.numeroPv, emetteur: refus.centre, echeance: refus.dateLimiteContreVisite, joursRestants: j, niveau: niveauPour(j, false) });
    }
    for (const rdv of f.visitesTechniques.filter((x) => x.statut === "rendez-vous")) {
      const j = joursRestants(rdv.dateRendezVous, reference);
      echeances.push({ ...commun, cle: `v-${v.id}-${rdv.numero}`, numero: rdv.numero, sujetHref: `/flotte/${v.immatriculation}?onglet=conformite&ref=${rdv.numero}`, type: "rendez-vous", libelle: `Rendez-vous ${rdv.type === "contre-visite" ? "contre-visite" : "visite technique"}${rdv.heure ? ` à ${rdv.heure}` : ""}`, numeroPiece: null, emetteur: rdv.centre, echeance: rdv.dateRendezVous, joursRestants: j, niveau: niveauPour(j, false) });
    }
    if (f.prochaineIntervention) {
      const p = f.prochaineIntervention;
      echeances.push({ ...commun, cle: `v-${v.id}-entretien`, numero: null, sujetHref: `/flotte/${v.immatriculation}?onglet=entretien`, type: "entretien", libelle: p.libelle, numeroPiece: null, emetteur: null, echeance: null, joursRestants: p.joursEstimes, niveau: niveauPour(p.joursEstimes, false), repere: `dans ${fmtKm(p.kmRestants)} km` });
    }
  }
  for (const lic of LICENCES) {
    const j = joursRestants(lic.echeance, reference);
    const immats = lic.vehiculeIds.map((id) => FLOTTE.find((l) => l.vehicule.id === id)?.vehicule.immatriculationAffichee ?? id);
    echeances.push({ cle: `lic-${lic.id}`, numero: lic.numero, sujet: "vehicule", sujetId: "flotte", sujetLibelle: lic.perimetre === "flotte" ? "Toute la flotte" : `${lic.vehiculeIds.length} véhicules`, sujetPrecision: lic.perimetre === "flotte" ? lic.libelle : `${lic.libelle} — ${immats.join(", ")}`, sujetHref: "/flotte", type: "licence-transport", libelle: TYPE_DOCUMENT["licence-transport"], numeroPiece: lic.numeroPiece, emetteur: lic.emetteur, echeance: lic.echeance, joursRestants: j, niveau: niveauPour(j, false), repere: null, site: null });
  }
  return trier([...echeances, ...echeancesChauffeurs(fichesChauffeurs())]);
}

/* -- Ce que la page appelle -------------------------------------------------- */

