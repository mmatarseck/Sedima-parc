/* ============================================================================
 * Génère `supabase/seed.sql` à partir du jeu de démonstration.
 *
 * Pourquoi un générateur plutôt qu'un seed écrit à la main : le jeu de
 * démonstration est **dérivé** — les dépenses viennent des fiches, les dettes
 * des affrètements, les enveloppes du réalisé. Un seed tapé à part finirait
 * par dire autre chose que l'application. Ici, c'est la même source.
 *
 *   npx tsx scripts/generer-seed.mts
 *
 * Les identifiants sont **stables** : un UUID dérivé du numéro métier, pour que
 * deux exécutions produisent le même fichier et que les clés étrangères se
 * tiennent sans table de correspondance. Le seed est écrit en `insert … on
 * conflict do nothing` : on peut le rejouer.
 *
 * Ce qu'il ne porte pas, et qui viendra avec la reprise réelle : les comptes
 * (`profil` cite `auth.users`, qui n'existe qu'une fois les gens invités) et
 * les fichiers des justificatifs.
 * ==========================================================================*/

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { FLOTTE, SITES } from "@/donnees/parc-demo";
import { fichePourImmatriculation } from "@/donnees/fiche-demo";
import { fichesChauffeurs, listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { listePrestataires } from "@/donnees/prestataires-demo";
import { listeIncidents } from "@/donnees/incidents-demo";
import { PARAMETRES_DEFAUT } from "@/domaine/parametres";
import { affretements, grillesTarifaires, misesADisposition, prestations, transporteurs } from "@/donnees/transporteurs-demo";
import { camionsTiers, chauffeursTiers, profilTransporteur, rattachements } from "@/donnees/flotte-tierce-demo";
import { relevesTransport } from "@/donnees/releve-demo";
import { enveloppes } from "@/donnees/budget-demo";
import { avances, evaluations } from "@/donnees/compte-prestataire-demo";
import { PROGRAMMES } from "@/donnees/entretien-demo";
import { normaliserLocalite } from "@/domaine/flotte-tierce";
import { normaliser as normaliserPlaque } from "@/domaine/immatriculation";

/* -- Outils --------------------------------------------------------------------- */

/** Un UUID stable, dérivé d'une étiquette : « vehicule:AA985MR » donne toujours le même. */
function uuid(etiquette: string): string {
  const h = createHash("sha1").update(`sedima-parc:${etiquette}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const q = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return `array[${v.map((x) => q(x)).join(", ")}]${v.length === 0 ? "::text[]" : ""}`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

/** « 2026-08-12 », « 2026-08-12T16:05 » ou « 2026-08-12T16:05:00 » → un timestamptz valide. */
function horodatage(brut: string): string {
  if (brut.length <= 10) return `${brut}T08:00:00+00`;
  const [jour, heure = "08:00"] = brut.split("T");
  const [h = "08", m = "00", sec = "00"] = heure.split(":");
  return `${jour}T${h}:${m}:${sec}+00`;
}

const lignes: string[] = [];
let total = 0;

function inserer(table: string, colonnes: string[], valeurs: unknown[][], conflit = "do nothing") {
  if (valeurs.length === 0) return;
  lignes.push(`\n-- ${table} (${valeurs.length})`);
  /* Par paquets : une instruction de dix mille lignes passe mal dans l'éditeur SQL de Supabase. */
  for (let i = 0; i < valeurs.length; i += 200) {
    const paquet = valeurs.slice(i, i + 200);
    lignes.push(`insert into ${table} (${colonnes.join(", ")}) values\n${paquet.map((v) => `  (${v.map(q).join(", ")})`).join(",\n")}\non conflict ${conflit};`);
  }
  total += valeurs.length;
}

/* -- Référentiels --------------------------------------------------------------- */

const siteId = (id: string | null) => (id ? uuid(`site:${id}`) : null);
inserer(
  "site",
  ["id", "code", "libelle", "region", "type"],
  SITES.map((s) => [siteId(s.id), s.code, s.libelle, s.region, s.type]),
);

const prestataires = listePrestataires();
const prestataireId = (numero: string | null) => (numero ? uuid(`prestataire:${numero}`) : null);
const prestataireParNom = new Map(prestataires.map((p) => [p.raisonSociale, p.numero]));
inserer(
  "prestataire",
  ["id", "numero", "raison_sociale", "type", "contact", "telephone", "courriel", "adresse", "ville", "ninea", "delai_paiement_jours", "actif", "note"],
  prestataires.map((p) => [prestataireId(p.numero), p.numero, p.raisonSociale, p.type, p.contact, p.telephone, p.courriel, p.adresse, p.ville, p.ninea, p.delaiPaiementJours, p.actif, p.note]),
);

inserer(
  "type_document",
  ["id", "libelle", "porteur", "applicabilite", "validite_mois", "critique", "standard"],
  PARAMETRES_DEFAUT.documents.types.map((t) => [t.id, t.libelle, t.porteur, t.applicabilite, t.validiteMois, t.critique, t.standard]),
);

/* -- La flotte et les chauffeurs ------------------------------------------------- */

const vehiculeId = (id: string | null) => (id ? uuid(`vehicule:${id}`) : null);
inserer(
  "vehicule",
  ["id", "immatriculation", "vin", "marque", "appellation", "type_modele", "categorie", "categorie_flotte", "usage", "transport_special", "energie", "business_unit", "site_id", "statut", "engage", "premiere_mise_en_circulation", "date_immatriculation", "puissance_cv", "cylindree", "ptac", "ptra", "poids_vide", "charge_utile", "capacite_reservoir", "valeur_acquisition", "duree_amortissement_annees", "photo", "commentaire"],
  FLOTTE.map(({ vehicule: v }) => [
    vehiculeId(v.id), v.immatriculation, v.vin, v.marque, v.appellation, v.typeModele, v.categorie, v.categorieFlotte, v.usage, v.transportSpecial, v.energie ?? "gasoil", v.businessUnit, siteId(v.siteId), v.statut, v.engage,
    v.premiereMiseEnCirculation, v.dateImmatriculation, v.puissanceCv, v.cylindree, v.ptac, v.ptra, v.poidsVide, v.chargeUtile, v.capaciteReservoir, v.valeurAcquisition, v.dureeAmortissementAnnees, v.photo ?? null, v.commentaire,
  ]),
);

const chauffeurs = listeChauffeurs();
const chauffeurId = (id: string | null) => (id ? uuid(`chauffeur:${id}`) : null);
inserer(
  "chauffeur",
  ["id", "matricule_rh", "nom", "prenom", "contrat", "site_id", "telephone", "permis_numero", "permis_categories", "permis_echeance", "visite_medicale_echeance", "aptitude", "aptitude_motif", "aptitude_date", "date_naissance", "date_embauche", "date_sortie"],
  chauffeurs.map(({ chauffeur: c }) => [chauffeurId(c.id), c.matriculeRh, c.nom, c.prenom, c.contrat, siteId(c.siteId), c.telephone, c.permisNumero, c.permisCategories, c.permisEcheance, c.visiteMedicaleEcheance, c.aptitude, c.aptitudeMotif, c.aptitudeDate, c.dateNaissance, c.dateEmbauche, c.dateSortie]),
);

/* -- Les transactions des fiches véhicules ---------------------------------------- */

const affectationsV: unknown[][] = [];
const documentsV: unknown[][] = [];
const depensesV: unknown[][] = [];
const pleinsV: unknown[][] = [];
const relevesV: unknown[][] = [];
const interventionsV: unknown[][] = [];

for (const l of FLOTTE) {
  const f = fichePourImmatriculation(l.vehicule.immatriculation);
  if (!f) continue;
  const vid = vehiculeId(l.vehicule.id);

  for (const a of f.affectations) {
    if (!a.chauffeurId || !a.role) continue;
    affectationsV.push([uuid(`affectation:${a.numero}`), a.numero, vid, chauffeurId(a.chauffeurId), a.role, a.debut, a.fin, a.motif]);
  }
  for (const d of f.documents) {
    documentsV.push([uuid(`document:${d.numero}`), d.numero, d.type, vid, null, d.dateEffet, d.echeance, d.emetteur, d.numeroPiece, d.montant, d.justificatif]);
  }
  for (const d of f.depenses) {
    depensesV.push([uuid(`depense:${d.numero}`), d.numero, vid, null, prestataireId(d.beneficiaire ? (prestataireParNom.get(d.beneficiaire) ?? null) : null), d.date, d.poste, d.libelle, d.montant, d.beneficiaire, d.reference, d.origine, d.justificatif, d.km, d.kmMotifRejet]);
  }
  for (const p of f.pleins) {
    pleinsV.push([uuid(`plein:${p.numero}`), p.numero, vid, null, null, p.date, p.litres, p.prixLitre, p.montant, p.km, true, p.source, p.reference]);
  }
  for (const r of f.releves) {
    if (r.origine === "depense") continue; // porté par la dépense elle-même
    relevesV.push([uuid(`releve:${r.numero}`), r.numero, vid, r.date, r.valeur, r.origine, r.valide ? null : r.motifRejet]);
  }
  for (const i of f.interventions) {
    interventionsV.push([uuid(`intervention:${i.numero}`), i.numero, vid, prestataireId(prestataireParNom.get(i.garage) ?? null), i.date, i.type, i.objet, i.montant, i.immobilisationJours, i.km, i.reference]);
  }
}

/* Les pièces des chauffeurs : permis et visite médicale, sur la fiche chauffeur. */
for (const c of chauffeurs) {
  const cid = chauffeurId(c.id);
  if (!c.permis.manquant) documentsV.push([uuid(`document:permis:${c.id}`), `DOC-PERMIS-${c.id}`, "permis", null, cid, null, c.permis.echeance, null, c.chauffeur.permisNumero, null, true]);
  if (!c.visiteMedicale.manquant) documentsV.push([uuid(`document:visite:${c.id}`), `DOC-VISITE-${c.id}`, "visite-medicale", null, cid, null, c.visiteMedicale.echeance, null, null, null, true]);
}

inserer("affectation", ["id", "numero", "vehicule_id", "chauffeur_id", "role", "debut", "fin", "motif"], affectationsV);
inserer("document", ["id", "numero", "type_document_id", "vehicule_id", "chauffeur_id", "date_effet", "echeance", "emetteur", "numero_piece", "montant", "justificatif"], documentsV);
inserer("depense", ["id", "numero", "vehicule_id", "chauffeur_id", "prestataire_id", "date", "poste", "libelle", "montant", "beneficiaire", "reference", "origine", "justificatif", "km", "km_motif_rejet"], depensesV);
inserer("plein", ["id", "numero", "vehicule_id", "chauffeur_id", "prestataire_id", "date", "litres", "prix_litre", "montant", "km", "plein_complet", "source", "reference"], pleinsV);
inserer("releve_kilometrique", ["id", "numero", "vehicule_id", "date", "km", "origine", "motif_rejet"], relevesV);
inserer("intervention", ["id", "numero", "vehicule_id", "prestataire_id", "date", "type", "objet", "montant", "immobilisation_jours", "km", "reference"], interventionsV);

/* -- Incidents, sanctions, indisponibilités --------------------------------------- */

inserer(
  "incident",
  ["id", "numero", "vehicule_id", "chauffeur_id", "date_heure", "nature", "type", "lieu", "mission", "responsabilite", "statut", "blesses", "sinistre_ouvert", "immobilisation_jours", "kilometrage", "declarant", "description"],
  listeIncidents().map((i) => [uuid(`incident:${i.numero}`), i.numero, vehiculeId(i.vehiculeId), chauffeurId(i.chauffeurId), horodatage(i.dateHeure), i.nature, i.type, i.lieu, i.mission, i.responsabilite, i.statut, i.blesses, i.sinistreOuvert, i.immobilisationJours, i.kilometrage, i.declarant, i.description]),
);

const sanctionsV: unknown[][] = [];
const indisposV: unknown[][] = [];
for (const f of fichesChauffeurs()) {
  const cid = chauffeurId(f.ligne.id);
  for (const s of f.sanctions) sanctionsV.push([uuid(`sanction:${s.numero}`), s.numero, cid, s.date, s.type, s.motif, s.jours, s.incidentId ? uuid(`incident:${s.incidentId}`) : null]);
  for (const i of f.indisponibilites) indisposV.push([uuid(`indisponibilite:${i.numero}`), i.numero, cid, i.motif, i.debut, i.fin, i.commentaire]);
}
inserer("sanction", ["id", "numero", "chauffeur_id", "date", "type", "motif", "jours", "incident_id"], sanctionsV);
inserer("indisponibilite", ["id", "numero", "chauffeur_id", "motif", "debut", "fin", "commentaire"], indisposV);

/* -- Paramètres ------------------------------------------------------------------- */

inserer(
  "parametre",
  ["cle", "valeur"],
  [
    ["energie", JSON.stringify(PARAMETRES_DEFAUT.energie)],
    ["alertes", JSON.stringify(PARAMETRES_DEFAUT.alertes)],
  ],
  "(cle) do update set valeur = excluded.valeur",
);

/* -- Transporteurs (0002) --------------------------------------------------------- */

const listeT = transporteurs();
inserer(
  "profil_transporteur",
  ["prestataire_id", "forme", "sous_contrat", "reference_contrat", "debut_contrat", "fin_contrat", "modes", "camions_engages", "commentaire"],
  listeT.map((t) => {
    const p = profilTransporteur(t.raisonSociale, t.numero);
    return [prestataireId(t.numero), p.forme, p.sousContrat, p.referenceContrat, p.debutContrat, p.finContrat, p.modes, p.camionsEngages, p.commentaire];
  }),
);

const chauffeurTiersId = (id: string | null) => (id ? uuid(`chauffeur-tiers:${id}`) : null);
inserer(
  "chauffeur_tiers",
  ["id", "prestataire_id", "nom", "telephone", "actif"],
  chauffeursTiers().map((c) => [chauffeurTiersId(c.id), prestataireId(c.transporteurNumero), c.nom, c.telephone, c.actif]),
);

inserer(
  "camion_tiers",
  ["immatriculation", "prestataire_id", "categorie", "capacite_tonnes", "chauffeur_habituel_id", "actif", "commentaire"],
  camionsTiers().map((c) => [c.immatriculation, prestataireId(c.transporteurNumero), c.categorie, c.capaciteTonnes, chauffeurTiersId(c.chauffeurHabituelId), c.actif, c.commentaire]),
);

inserer(
  "ligne_tarif",
  ["id", "numero", "prestataire_id", "origine", "destination", "categorie", "unite", "prix", "minimum", "debut", "fin", "source", "commentaire"],
  grillesTarifaires().map((g) => [uuid(`tarif:${g.numero}`), g.numero, prestataireId(g.transporteurNumero), g.origine, g.destination, g.categorie, g.unite, g.prix, g.minimum, g.debut, g.fin, g.source, g.commentaire]),
);

inserer(
  "rattachement_localite",
  ["localite_normalisee", "localite", "destination", "origine", "motif"],
  rattachements().map((r) => [normaliserLocalite(r.localite), r.localite, r.destination, r.origine, r.motif]),
);

/* Les factures et le relevé écrivent « AA-076-BP » ; le référentiel tient
   « AA076BP ». Même camion : on normalise avant de lier, sans quoi mille six
   cents chargements perdraient leur camion à l'entrée en base. */
const camionsConnus = new Set(camionsTiers().map((c) => c.immatriculation));
const plaque = (brut: string | null): string | null => {
  if (!brut) return null;
  const n = normaliserPlaque(brut);
  return camionsConnus.has(n) ? n : null;
};
inserer(
  "affretement",
  ["id", "numero", "date", "prestataire_id", "origine", "destination", "business_unit", "categorie_demandee", "immatriculation_externe", "chauffeur_externe", "tonnage_prevu", "tonnage_livre", "distance_km", "motif", "vehicule_remplace_id", "statut", "montant_convenu", "montant_facture", "prix_exceptionnel", "complement_tarif", "motif_tarif", "date_livraison", "date_facture", "date_reglement", "reference_facture", "numero_demande_x3", "numero_bon_commande", "demandeur", "commentaire"],
  affretements().map((a) => [
    uuid(`affretement:${a.numero}`), a.numero, a.date, prestataireId(a.transporteurNumero), a.origine, a.destination, a.businessUnit, a.categorieDemandee,
    plaque(a.immatriculationExterne),
    a.chauffeurExterne, a.tonnagePrevu, a.tonnageLivre, a.distanceKm, a.motif, vehiculeId(a.vehiculeRemplaceId), a.statut, a.montantConvenu, a.montantFacture,
    a.prixExceptionnel, a.complementTarif, a.motifTarif, a.dateLivraison, a.dateFacture, a.dateReglement, a.referenceFacture, a.numeroDemandeX3, a.numeroBonCommande, a.demandeur, a.commentaire,
  ]),
);

inserer(
  "mise_a_disposition",
  ["id", "numero", "mois", "prestataire_id", "immatriculation", "famille", "jours_calendaires", "jours_panne", "jours_roules", "prix_jour", "convention", "carburant_litres", "carburant_montant", "km_parcourus", "tonnes_transportees", "statut", "montant_facture", "date_facture", "date_reglement", "reference_facture", "numero_demande_x3", "commentaire"],
  misesADisposition()
    .filter((m) => plaque(m.immatriculation) !== null)
    .map((m) => [uuid(`mad:${m.numero}`), m.numero, m.mois, prestataireId(m.transporteurNumero), plaque(m.immatriculation), m.famille, m.joursCalendaires, m.joursPanne, m.joursRoules, m.prixJour, m.convention, m.carburantLitres, m.carburantMontant, m.kmParcourus, m.tonnesTransportees, m.statut, m.montantFacture, m.dateFacture, m.dateReglement, m.referenceFacture, m.numeroDemandeX3, m.commentaire]),
);

inserer(
  "prestation",
  ["id", "numero", "date", "prestataire_id", "libelle", "business_unit", "unite", "quantite", "prix_unitaire", "convention", "statut", "montant_facture", "date_facture", "date_reglement", "reference_facture", "numero_demande_x3", "commentaire"],
  prestations().map((p) => [uuid(`prestation:${p.numero}`), p.numero, p.date, prestataireId(p.transporteurNumero), p.libelle, p.businessUnit, p.unite, p.quantite, p.prixUnitaire, p.convention, p.statut, p.montantFacture, p.dateFacture, p.dateReglement, p.referenceFacture, p.numeroDemandeX3, p.commentaire]),
);

const affretementsConnus = new Set(affretements().map((a) => a.numero));
inserer(
  "releve_transport",
  ["id", "numero", "date", "mode", "prestataire_id", "vehicule_id", "camion_tiers_immatriculation", "immatriculation_libre", "chauffeur", "origine", "destination", "produit", "tonnage", "tonnage_pese", "bon_livraison", "affretement_id"],
  relevesTransport().map((l) => [
    uuid(`transport:${l.numero}`), l.numero, l.date, l.mode, prestataireId(l.transporteurNumero), vehiculeId(l.vehiculeId),
    plaque(l.camionTiersImmatriculation),
    l.immatriculationLibre ?? (l.camionTiersImmatriculation && !plaque(l.camionTiersImmatriculation) ? l.camionTiersImmatriculation : null),
    l.chauffeur, l.origine, l.destination, l.produit, l.tonnage, l.tonnagePese, l.bonLivraison,
    l.affretementNumero && affretementsConnus.has(l.affretementNumero) ? uuid(`affretement:${l.affretementNumero}`) : null,
  ]),
);

/* -- Entretien, compte fournisseur, budget ---------------------------------------- */

inserer(
  "programme_entretien",
  ["code", "libelle", "precision", "categories", "base"],
  PROGRAMMES.map((p) => [p.code, p.libelle, p.precision, p.categories, p.base]),
);
inserer(
  "operation_entretien",
  ["code", "programme_code", "libelle", "groupe", "periodicite_km", "periodicite_heures", "periodicite_mois", "mots_cles", "duree_heures", "cout_estime", "critique", "ordre"],
  PROGRAMMES.flatMap((p) => p.operations.map((o, i) => [`${p.code}:${o.code}`, p.code, o.libelle, o.groupe, o.periodicite.km, o.periodicite.heures, o.periodicite.mois, o.motsCles, o.dureeHeures, o.coutEstime, o.critique, i])),
);

inserer(
  "avance_prestataire",
  ["id", "numero", "prestataire_id", "date", "montant", "motif", "imputee_sur", "date_imputation", "autorise_par"],
  avances().map((a) => [uuid(`avance:${a.numero}`), a.numero, prestataireId(a.prestataireNumero), a.date, a.montant, a.motif, a.imputeeSur, a.dateImputation, a.autorisePar]),
);
inserer(
  "evaluation_prestataire",
  ["id", "numero", "prestataire_id", "date", "piece_numero", "piece_libelle", "qualite", "delai", "prix", "commentaire", "auteur"],
  evaluations().map((e) => [uuid(`evaluation:${e.numero}`), e.numero, prestataireId(e.prestataireNumero), e.date, e.pieceNumero, e.pieceLibelle, e.notes.qualite, e.notes.delai, e.notes.prix, e.commentaire, e.auteur]),
);

inserer(
  "enveloppe",
  ["id", "numero", "exercice", "poste", "business_unit", "montant", "profil", "base", "commentaire"],
  enveloppes().map((e) => [uuid(`enveloppe:${e.numero}`), e.numero, e.exercice, e.poste, e.businessUnit, e.montant, e.profil ? `{${e.profil.join(",")}}` : null, e.base, e.commentaire]),
);

/* -- Écriture --------------------------------------------------------------------- */

const entete = `-- ============================================================================
-- SEDIMA Parc — jeu de démonstration, versé dans la base.
--
-- GÉNÉRÉ par scripts/generer-seed.mts : ne pas modifier à la main, relancer.
-- ${total} lignes. Rejouable : chaque insertion est \`on conflict do nothing\`.
--
-- Prérequis : les migrations 0001 et 0002. Les comptes (profil) ne sont pas
-- dans ce fichier — ils citent auth.users, qui n'existe qu'une fois les
-- personnes invitées.
-- ============================================================================
`;

mkdirSync("supabase", { recursive: true });
writeFileSync("supabase/seed.sql", `${entete}${lignes.join("\n")}\n`);
console.log(`supabase/seed.sql — ${total} lignes sur ${lignes.filter((l) => l.startsWith("\n-- ")).length} tables`);
