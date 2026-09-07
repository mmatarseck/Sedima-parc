/* ============================================================================
 * Les situations journalières de la démonstration — ce que chaque véhicule et
 * la flotte présentaient à la fin de chaque jour des quatre dernières
 * semaines. C'est la matière des pastilles du tableau de bord (état du
 * moment, référence d'hier ou de la semaine passée, quatorze jours en pied).
 *
 * Tout se déduit des fiches : périodes de statut, documents, affectations,
 * relevés, pleins, dépenses ; des incidents ; des indisponibilités des
 * chauffeurs ; des ordres de travail ; du journal de caisse ; des mouvements
 * de cuve. Au branchement de la base, une fonction `situation_journaliere`
 * rendra les mêmes lignes d'un coup, dans la lignée de `lire_parc()`.
 * ==========================================================================*/

import { immobilisationAdministrative } from "@/domaine/documents";
import type { EtatDocument } from "@/domaine/fiche";
import { estOuvert } from "@/domaine/maintenance";
import type { FaitsFlotteJour, FaitsVehiculeJour, SituationJournaliere } from "@/domaine/pastilles";
import type { StatutVehicule } from "@/domaine/types";
import { SOLDE_INITIAL, journalCaisse } from "./caisse-demo";
import { STOCK_INITIAL, livraisonsEtJauges } from "./carburant-demo";
import { DATE_REFERENCE, fichesChauffeurs } from "./chauffeurs-demo";
import { fichePourImmatriculation } from "./fiche-demo";
import { listeIncidents } from "./incidents-demo";
import { ordresDeTravail } from "./maintenance-demo";
import { FLOTTE } from "./parc-demo";

const OPERATIONNELS = new Set<StatutVehicule>(["en-service", "en-backup"]);
const SEUIL_CAISSE = 300_000;

function plusJours(jour: string, n: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

let CACHE: { cle: string; situations: SituationJournaliere[] } | null = null;

/** Les situations des `profondeur` derniers jours, du plus ancien à `aujourdhui`. */
export function situationsJournalieres(aujourdhui: string = DATE_REFERENCE, profondeur = 28): SituationJournaliere[] {
  const cle = `${aujourdhui}|${profondeur}`;
  if (CACHE && CACHE.cle === cle) return CACHE.situations;

  const jours = Array.from({ length: profondeur }, (_, k) => plusJours(aujourdhui, k - profondeur + 1));
  const incidents = listeIncidents();
  const chauffeurs = fichesChauffeurs();
  const ordres = ordresDeTravail();
  const caisse = journalCaisse();
  const cuve = livraisonsEtJauges();

  /* Les chauffeurs indisponibles un jour donné, par identifiant. */
  const indisponibleLe = (jour: string) => new Set(chauffeurs.filter((c) => c.indisponibilites.some((i) => i.debut <= jour && (i.fin === null || i.fin >= jour))).map((c) => c.ligne.id));
  const dernierAccidentAvant = (jour: string) => incidents.filter((i) => i.nature === "accident" && i.dateHeure.slice(0, 10) <= jour).map((i) => i.dateHeure.slice(0, 10)).sort().at(-1) ?? null;

  const fiches = FLOTTE.map((l) => ({ l, f: fichePourImmatriculation(l.vehicule.immatriculation) })).filter((x): x is { l: (typeof FLOTTE)[number]; f: NonNullable<ReturnType<typeof fichePourImmatriculation>> } => x.f !== null);

  const situations: SituationJournaliere[] = jours.map((jour) => {
    const indisponibles = indisponibleLe(jour);
    const vehicules: FaitsVehiculeJour[] = fiches.map(({ l, f }) => {
      const v = l.vehicule;
      /* Le statut à la fin du jour : la période qui le couvre, sinon celui de la fiche. */
      const periode = f.periodesStatut.find((p) => p.debut <= jour && (p.fin === null || p.fin >= jour)) ?? null;
      const statut = periode?.statut ?? (jour >= aujourdhui ? v.statut : "en-service");
      let immobiliseDepuisJours = 0;
      if (periode && !OPERATIONNELS.has(periode.statut)) immobiliseDepuisJours = joursEntre(periode.debut, jour) + 1;

      const etatA = (d: { dateEffet: string | null; echeance: string | null }): EtatDocument => (!d.echeance ? "permanent" : d.dateEffet && d.dateEffet > jour ? "a-jour" : d.echeance < jour ? "echu" : "a-jour");
      const documents = f.documents.map((d) => ({ type: d.type, etat: etatA(d) }));
      const immobiliseAdmin = immobilisationAdministrative({ categorie: v.categorie, transportSpecial: v.transportSpecial, statut }, documents) !== null;
      const dans7 = plusJours(jour, 7);
      const echeances7 = f.documents.filter((d) => d.echeance && d.echeance > jour && d.echeance <= dans7).length;
      const echues = f.documents.filter((d) => d.echeance && d.echeance < jour).length;

      const depuis7 = plusJours(jour, -6);
      const sansReleve7 = !f.releves.some((r) => r.date >= depuis7 && r.date <= jour) && !f.pleins.some((p) => p.km !== null && p.date >= depuis7 && p.date <= jour);

      const pleinsDuJour = f.pleins.filter((p) => p.date === jour);
      const depensesDuJour = f.depenses.filter((d) => d.date === jour && d.poste !== "amortissement" && d.poste !== "salaire");
      const incidentsDuJour = incidents.filter((i) => i.vehiculeId === v.id && i.dateHeure.slice(0, 10) === jour);

      const titulaire = f.affectations.find((a) => a.role === "titulaire" && a.debut <= jour && (a.fin === null || a.fin >= jour)) ?? null;
      const pretACharger = OPERATIONNELS.has(statut) && titulaire !== null && titulaire.chauffeurId !== null && !indisponibles.has(titulaire.chauffeurId);

      return {
        vehiculeId: v.id,
        jour,
        engage: v.engage,
        statut,
        immobiliseAdmin,
        immobiliseDepuisJours,
        echeances7,
        echues,
        sansReleve7,
        litres: pleinsDuJour.reduce((s, p) => s + p.litres, 0),
        carburant: pleinsDuJour.reduce((s, p) => s + p.montant, 0),
        depenses: depensesDuJour.reduce((s, d) => s + d.montant, 0),
        pannes: incidentsDuJour.filter((i) => i.nature === "incident").length,
        accidents: incidentsDuJour.filter((i) => i.nature === "accident").length,
        pretACharger,
      };
    });

    const ouverts = ordres.filter((o) => o.datePrevue <= jour && (o.dateCloture === null || o.dateCloture > jour) && (estOuvert(o.statut) || (o.dateCloture !== null && o.dateCloture > jour)));
    const soldeCaisse = caisse.filter((m) => m.date <= jour).reduce((s, m) => s + (m.sens === "entree" ? m.montant : -m.montant), SOLDE_INITIAL);
    const cuveLitres = cuve.filter((m) => m.date <= jour).reduce((s, m) => s + (m.sens === "livraison" ? m.litres : m.sens === "sortie" ? -m.litres : 0), STOCK_INITIAL);
    const sorties7 = cuve.filter((m) => m.sens === "sortie" && m.date > plusJours(jour, -7) && m.date <= jour).reduce((s, m) => s + m.litres, 0);
    const dernierAccident = dernierAccidentAvant(jour);
    const flotte: FaitsFlotteJour = {
      jour,
      chauffeurs: chauffeurs.length,
      chauffeursIndisponibles: indisponibles.size,
      ordresOuverts: ouverts.length,
      ordresAnciens: ouverts.filter((o) => joursEntre(o.datePrevue, jour) > 15).length,
      soldeCaisse,
      seuilCaisse: SEUIL_CAISSE,
      cuveLitres: Math.max(0, cuveLitres),
      cuveJours: sorties7 > 0 ? Math.round((Math.max(0, cuveLitres) / (sorties7 / 7)) * 10) / 10 : null,
      joursSansAccident: dernierAccident ? joursEntre(dernierAccident, jour) : null,
    };
    return { jour, vehicules, flotte };
  });

  CACHE = { cle, situations };
  return situations;
}
