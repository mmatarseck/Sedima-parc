/* ============================================================================
 * Fiche prestataire — données de démonstration.
 *
 * Rien n'est saisi pour la fiche : tout ce qu'un prestataire a fait avec le
 * parc se relit sur les transactions qui le citent — les demandes d'achat par
 * son numéro PRE, et, tant que les autres transactions ne portent qu'un nom,
 * les interventions par leur garage, les pleins par leur source, les
 * documents par leur émetteur, les visites par leur centre, les sorties de
 * caisse par leur bénéficiaire (`prestatairePour` fait le lien). Au
 * branchement, chacune portera la clé du prestataire et cette résolution par
 * le nom disparaîtra.
 * ==========================================================================*/

import type { LigneAchat } from "@/domaine/caisse";
import { TYPE_DOCUMENT } from "@/domaine/libelles";
import type { FichePrestataire, Prestataire } from "@/domaine/prestataires";
import { demandesAchat, depensesCaisse } from "./caisse-demo";
import { fichePourImmatriculation } from "./fiche-demo";
import { FLOTTE } from "./parc-demo";
import { listePrestataires, prestatairePour } from "./prestataires-demo";

const CACHE = new Map<string, FichePrestataire | null>();

/**
 * La fiche d'un prestataire par son numéro PRE. Nulle quand le numéro n'est
 * pas dans le référentiel de démonstration — une fiche créée dans le
 * navigateur n'est pas connue du serveur, c'est une limite du jeu de données.
 */
export function fichePrestataire(numero: string): FichePrestataire | null {
  if (CACHE.has(numero)) return CACHE.get(numero)!;
  const prestataires = listePrestataires();
  const prestataire = prestataires.find((p) => p.numero === numero) ?? null;
  if (!prestataire) {
    CACHE.set(numero, null);
    return null;
  }
  const fiche = construire(prestataire, prestataires);
  CACHE.set(numero, fiche);
  return fiche;
}

function construire(prestataire: Prestataire, prestataires: Prestataire[]): FichePrestataire {
  const estLui = (nom: string | null) => prestatairePour(nom, prestataires)?.numero === prestataire.numero;
  const demandes: LigneAchat[] = demandesAchat().filter((d) => d.prestataireNumero === prestataire.numero);
  const fiche: FichePrestataire = { prestataire, demandes, interventions: [], pleins: [], depensesCaisse: [], documents: [], visites: [] };

  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    const v = l.vehicule;
    const porteur = { vehiculeId: v.id, immatriculation: v.immatriculation, immatriculationAffichee: v.immatriculationAffichee };

    for (const i of f.interventions) {
      if (!estLui(i.garage)) continue;
      fiche.interventions.push({ numero: i.numero, date: i.date, type: i.type, objet: i.objet, montant: i.montant, immobilisationJours: i.immobilisationJours, reference: i.reference, ...porteur });
    }
    for (const p of f.pleins) {
      if (!estLui(p.source)) continue;
      fiche.pleins.push({ numero: p.numero, date: p.date, litres: p.litres, prixLitre: p.prixLitre, montant: p.montant, ...porteur });
    }
    for (const d of f.documents) {
      if (!estLui(d.emetteur)) continue;
      fiche.documents.push({ numero: d.numero, type: d.type, libelle: TYPE_DOCUMENT[d.type] ?? d.type, dateEffet: d.dateEffet, echeance: d.echeance, montant: d.montant, numeroPiece: d.numeroPiece, ...porteur });
    }
    for (const x of f.visitesTechniques) {
      if (!estLui(x.centre)) continue;
      fiche.visites.push({ numero: x.numero, type: x.type, dateRendezVous: x.dateRendezVous, datePassage: x.datePassage, statut: x.statut, numeroPv: x.numeroPv, ...porteur });
    }
  }

  fiche.depensesCaisse = depensesCaisse().filter((d) => estLui(d.beneficiaire));

  const recent = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);
  fiche.interventions.sort(recent);
  fiche.pleins.sort(recent);
  fiche.depensesCaisse.sort(recent);
  fiche.documents.sort((a, b) => (b.dateEffet ?? "").localeCompare(a.dateEffet ?? ""));
  fiche.visites.sort((a, b) => b.dateRendezVous.localeCompare(a.dateRendezVous));
  return fiche;
}
