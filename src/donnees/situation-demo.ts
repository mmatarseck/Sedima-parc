/* ============================================================================
 * Les situations journalières de la démonstration — ce que chaque véhicule et
 * la flotte présentaient à la fin de chaque jour des quatre dernières
 * semaines. C'est la matière des pastilles du tableau de bord (état du
 * moment, référence d'hier ou de la semaine passée). Les quatre semaines
 * restent lues : la référence en a besoin, même depuis que le pied de
 * pastille ne porte plus de courbe (10 septembre 2026).
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
import { avecStock, estCuve } from "@/domaine/carburant";
import { CAISSE_DEFAUT } from "@/domaine/parametres";
import { STOCK_INITIAL, livraisonsEtJauges, pleinsFlotte, sortieDePlein } from "./carburant-demo";
import { DATE_REFERENCE, fichesChauffeurs } from "./chauffeurs-demo";
import { demandesDemo } from "./demandes-demo";
import { fichePourImmatriculation } from "./fiche-demo";
import { listeIncidents } from "./incidents-demo";
import { ordresDeTravail } from "./maintenance-demo";
import { FLOTTE } from "./parc-demo";
import { camionsTiers } from "./flotte-tierce-demo";
import { relevesTransport } from "./releve-demo";
import { tonnageRetenu } from "@/domaine/releve-transport";
import { affretements, misesADisposition, prestations } from "./transporteurs-demo";
import { joursDus } from "@/domaine/transporteurs";

const OPERATIONNELS = new Set<StatutVehicule>(["en-service", "en-backup"]);
/* Le seuil de la démonstration est celui des paramètres par défaut : une seule valeur, partout. */
const SEUIL_CAISSE = CAISSE_DEFAUT.seuil;

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
  /* Le journal complet de la cuve, sorties comprises (les pleins à la cuve) et
     stock recalé par les jauges — le même que l'écran Carburant. Sans les
     sorties, le stock ne faisait que monter et l'autonomie restait vide. */
  const cuve = avecStock([...livraisonsEtJauges(), ...pleinsFlotte().filter((p) => estCuve(p.source)).map(sortieDePlein)], STOCK_INITIAL);
  const demandes = demandesDemo();
  /* Le dernier plein connu du parc, une fois pour toutes : il ne dépend pas du
     jour évalué. Il sert à distinguer « la flotte n'a rien consommé » de
     « rien n'a été relevé » — voir la pastille Carburant. */
  const dernierPlein = pleinsFlotte().map((x) => x.date).sort().at(-1) ?? null;
  /* Le dernier voyage relevé, pour la même raison — voir la part confiée aux tiers. */
  const dernierReleveTransport = relevesTransport().map((x) => x.date).sort().at(-1) ?? null;

  /* -- Le parc des prestataires (10 septembre 2026) -------------------------
   *
   * Les mêmes faits que la fonction `situation_journaliere` en base (0035),
   * calculés sur les fiches de la démonstration pour que les deux modes
   * disent la même chose. Les trois voies de facturation d'un prestataire —
   * affrètement, mise à disposition, prestation — sont mises bout à bout : un
   * fournisseur n'a pas à être lu en trois fois. */
  const tiersCamions = camionsTiers().filter((c) => c.actif).length;
  const mad = misesADisposition().filter((m) => m.statut !== "annule");
  const affretes = affretements().filter((a) => a.statut !== "annule");
  const transports = relevesTransport();
  const facturesTiers: { facture: string; reglement: string | null; montant: number }[] = [
    ...affretes.filter((a) => a.dateFacture).map((a) => ({ facture: a.dateFacture!, reglement: a.dateReglement, montant: a.montantFacture ?? a.montantConvenu })),
    ...mad.filter((m) => m.dateFacture).map((m) => ({ facture: m.dateFacture!, reglement: m.dateReglement, montant: m.montantFacture ?? joursDus(m) * m.prixJour })),
    ...prestations().filter((p) => p.statut !== "annule" && p.dateFacture).map((p) => ({ facture: p.dateFacture!, reglement: p.dateReglement, montant: p.montantFacture ?? Math.round(p.quantite * p.prixUnitaire) })),
  ];

  /* Ce que les tiers présentaient à la fin d'un jour. Ici les huit champs sont
     toujours renseignés : la démonstration n'a pas de droits à opposer, alors
     qu'en base ils valent `null` pour qui ne lit pas le module Transporteurs. */
  const faitsDesTiers = (jour: string) => {
    /* La mise à disposition se facture au mois : le jour lit le mois qui le
       contient, et la valeur ne bouge pas d'un jour à l'autre. On ne fabrique
       pas une granularité que la donnée n'a pas. */
    const duMois = mad.filter((m) => m.mois === jour.slice(0, 7));
    const depuis7 = plusJours(jour, -6);
    const fenetre = transports.filter((l) => l.date >= depuis7 && l.date <= jour);
    const impayees = facturesTiers.filter((f) => f.facture <= jour && (f.reglement === null || f.reglement > jour));
    return {
      tiersCamions,
      tiersMad: duMois.length,
      tiersMadPanne: duMois.reduce((s, m) => s + m.joursPanne, 0),
      tiersAffretementsOuverts: affretes.filter((a) => a.date <= jour && (a.dateLivraison === null || a.dateLivraison > jour) && ["demande", "confirme", "en-cours"].includes(a.statut)).length,
      /* Le parc d'un côté, tout le reste de l'autre : l'enlèvement client et le
         prestataire ponctuel ne sont pas du parc, ils comptent donc dans les
         tiers comme dans le total. Le tonnage pesé prime sur l'annoncé. */
      tiersTonnage7: Math.round(fenetre.filter((l) => l.mode !== "parc").reduce((s, l) => s + tonnageRetenu(l), 0) * 10) / 10,
      tonnage7: Math.round(fenetre.reduce((s, l) => s + tonnageRetenu(l), 0) * 10) / 10,
      tiersFactures: impayees.length,
      tiersFacturesMontant: impayees.reduce((s, f) => s + f.montant, 0),
    };
  };

  /* Les chauffeurs indisponibles un jour donné, par identifiant. */
  const indisponibleLe = (jour: string) => new Set(chauffeurs.filter((c) => c.indisponibilites.some((i) => i.debut <= jour && (i.fin === null || i.fin >= jour))).map((c) => c.ligne.id));
  /* Les chauffeurs déclarés inaptes : l'aptitude ne dépend pas du jour, elle
     est portée par la fiche. Un inapte n'est pas au volant, quel que soit son
     calendrier — c'est ce que la règle de disponibilité dit depuis toujours. */
  const inaptes = new Set(chauffeurs.filter((c) => c.ligne.chauffeur.aptitude === "inapte").map((c) => c.ligne.id));
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

      /* « Prêt à charger » : opérationnel, et **quelqu'un au volant** — le
         titulaire ou un suppléant —, qui ne soit ni indisponible ni inapte.
         La règle ne regardait que le titulaire et que l'indisponibilité, si
         bien que la pastille annonçait 22 là où « Disponibilité du jour » en
         comptait 21 (métier, 10 septembre 2026). Corrigée ici et en base
         (migration 0031), pour que les deux modes disent la même chose.
         Limite assumée, écrite dans la migration : le domaine écarte aussi le
         conducteur dont un document est échu, ce que l'historique journalier
         ne rejuge pas. L'écran du jour fait foi. */
      const auVolant = f.affectations.filter((a) => a.debut <= jour && (a.fin === null || a.fin >= jour) && a.chauffeurId !== null);
      const pretACharger = OPERATIONNELS.has(statut) && auVolant.some((a) => !indisponibles.has(a.chauffeurId!) && !inaptes.has(a.chauffeurId!));

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
    /* Le journal est rendu du plus récent au plus ancien : le premier mouvement du jour ou d'avant porte le stock. */
    const cuveLitres = cuve.find((m) => m.date <= jour)?.stockApres ?? STOCK_INITIAL;
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
      demandesSansReponse: demandes.filter((d) => !d.annuleeLe && d.echeance.slice(0, 10) <= jour && (!d.reponse || d.reponse.le.slice(0, 10) > jour)).length,
      dernierPlein,
      dernierReleveTransport,
      /* La démonstration tient ses registres. */
      registreIncidents: true,
      registreIndisponibilites: true,
      ...faitsDesTiers(jour),
    };
    return { jour, vehicules, flotte };
  });

  CACHE = { cle, situations };
  return situations;
}
