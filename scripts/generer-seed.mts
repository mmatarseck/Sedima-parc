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
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

import { FLOTTE, LICENCES, SITES } from "@/donnees/parc-demo";
import { fichePourImmatriculation } from "@/donnees/fiche-demo";
import { fichesChauffeurs, listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { listePrestataires } from "@/donnees/prestataires-demo";
import { listeIncidents } from "@/donnees/incidents-demo";
import { PARAMETRES_DEFAUT } from "@/domaine/parametres";
import { demandesDemo } from "@/donnees/demandes-demo";
import { transfertsDemo } from "@/donnees/transferts-demo";
import { ordresDeTravail } from "@/donnees/maintenance-demo";
import { affretements, grillesTarifaires, misesADisposition, prestations, transporteurs } from "@/donnees/transporteurs-demo";
import { camionsTiers, chauffeursTiers, profilTransporteur, rattachements } from "@/donnees/flotte-tierce-demo";
import { relevesTransport } from "@/donnees/releve-demo";
import { enveloppes } from "@/donnees/budget-demo";
import { avances, evaluations } from "@/donnees/compte-prestataire-demo";
import { PROGRAMMES } from "@/donnees/entretien-demo";
import { attributaires, forfaitsCarburant, vehiculesLegers } from "@/donnees/parc-leger-demo";
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
  /* Un tableau s'écrit en littéral « '{…}' », pas en `array[…]` : le littéral
     prend le type de la colonne, énumération comprise (`mode_remuneration[]`,
     `categorie_vehicule[]`), là où `array['tonne']` reste un text[] refusé. */
  if (Array.isArray(v)) {
    const litteral = `{${v.map((x) => `"${String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
    return `'${litteral.replace(/'/g, "''")}'`;
  }
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
  ["id", "immatriculation", "vin", "marque", "appellation", "type_modele", "categorie", "categorie_flotte", "usage", "transport_special", "energie", "business_unit", "site_id", "statut", "engage", "premiere_mise_en_circulation", "date_immatriculation", "puissance_cv", "cylindree", "ptac", "ptra", "poids_vide", "charge_utile", "capacite_reservoir", "valeur_acquisition", "duree_amortissement_annees", "photo", "commentaire", "regime"],
  FLOTTE.map(({ vehicule: v }) => [
    vehiculeId(v.id), v.immatriculation, v.vin, v.marque, v.appellation, v.typeModele, v.categorie, v.categorieFlotte, v.usage, v.transportSpecial, v.energie ?? "gasoil", v.businessUnit, siteId(v.siteId), v.statut, v.engage,
    v.premiereMiseEnCirculation, v.dateImmatriculation, v.puissanceCv, v.cylindree, v.ptac, v.ptra, v.poidsVide, v.chargeUtile, v.capaciteReservoir, v.valeurAcquisition, v.dureeAmortissementAnnees, v.photo ?? null, v.commentaire, "exploitation",
  ]),
);

/* -- Le parc léger (0004) : véhicules de service, de fonction, plan car ------------ */

/* Les véhicules légers immatriculés entrent dans `vehicule` avec leur régime ;
   leur état du dossier se traduit en statut. Un léger déjà présent dans la
   flotte de transport (même immatriculation) n'est pas doublé. */
const immatsFlotte = new Set(FLOTTE.map((l) => l.vehicule.immatriculation));
const STATUT_LEGER: Record<string, string> = { actif: "en-service", pool: "en-backup", panne: "en-reparation", "a-reformer": "retrait-en-cours" };
const legers = vehiculesLegers().filter((v) => v.immatriculation !== null && !immatsFlotte.has(v.immatriculation));
inserer(
  "vehicule",
  ["id", "immatriculation", "marque", "appellation", "categorie", "categorie_flotte", "usage", "transport_special", "energie", "business_unit", "statut", "engage", "premiere_mise_en_circulation", "commentaire", "regime"],
  legers.map((v) => [
    vehiculeId(v.id), v.immatriculation, v.marque, v.modele, v.categorie, "interne", v.categorie === "bus" ? "autre" : "utilitaire", false, "gasoil", v.businessUnit, STATUT_LEGER[v.etat] ?? "en-service", false,
    v.annee ? `${v.annee}-01-01` : null, [v.lot, v.commentaire].filter(Boolean).join(" — ") || null, v.regime,
  ]),
);

const attributaireId = (id: string | null) => (id ? uuid(`attributaire:${id}`) : null);
inserer(
  "attributaire",
  ["id", "nom", "fonction", "departement", "business_unit"],
  attributaires().map((a) => [attributaireId(a.id), a.nom, a.fonction, a.departement, a.businessUnit]),
);
inserer(
  "attribution_legere",
  ["id", "vehicule_id", "attributaire_id", "pool", "debut", "plan_car", "plan_car_duree_mois", "plan_car_debut", "plan_car_statut", "commentaire"],
  legers
    .filter((v) => v.attributaireId || v.pool)
    .map((v) => [uuid(`attribution:${v.id}`), vehiculeId(v.id), attributaireId(v.attributaireId), v.attributaireId ? null : v.pool, null, v.planCar !== null, v.planCar?.dureeMois ?? null, v.planCar?.debut ?? null, v.planCar?.statut ?? "en-cours", v.commentaire]),
);
inserer(
  "forfait_carburant",
  ["attributaire_id", "montant_mensuel", "carte"],
  forfaitsCarburant().map((f) => [attributaireId(f.attributaireId), f.montantMensuel, f.carte]),
);
inserer(
  "vehicule_a_recevoir",
  ["id", "lot", "marque", "modele", "categorie", "regime", "attributaire_id", "pool", "business_unit", "commentaire"],
  vehiculesLegers()
    .filter((v) => v.immatriculation === null)
    .map((v) => [uuid(`a-recevoir:${v.id}`), v.lot, v.marque, v.modele, v.categorie, v.regime, attributaireId(v.attributaireId), v.attributaireId ? null : v.pool, v.businessUnit, v.commentaire]),
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
    /* La licence de transport est portée par la flotte, pas par le véhicule :
       la fiche l'affiche, la base la tient dans licence_transport (0003). */
    if (d.type === "licence-transport") continue;
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
const licenceId = (l: { numero: string }) => uuid(`licence:${l.numero}`);
inserer(
  "licence_transport",
  ["id", "numero", "libelle", "numero_piece", "emetteur", "perimetre", "date_effet", "echeance"],
  LICENCES.map((l) => [licenceId(l), l.numero, l.libelle, l.numeroPiece, l.emetteur, l.perimetre, l.dateEffet, l.echeance]),
);
inserer(
  "licence_vehicule",
  ["licence_id", "vehicule_id"],
  LICENCES.filter((l) => l.perimetre === "partie").flatMap((l) => l.vehiculeIds.map((v) => [licenceId(l), vehiculeId(v)])),
);
inserer("depense", ["id", "numero", "vehicule_id", "chauffeur_id", "prestataire_id", "date", "poste", "libelle", "montant", "beneficiaire", "reference", "origine", "justificatif", "km", "km_motif_rejet"], depensesV);
inserer("plein", ["id", "numero", "vehicule_id", "chauffeur_id", "prestataire_id", "date", "litres", "prix_litre", "montant", "km", "plein_complet", "source", "reference"], pleinsV);
inserer("releve_kilometrique", ["id", "numero", "vehicule_id", "date", "km", "origine", "motif_rejet"], relevesV);
inserer("intervention", ["id", "numero", "vehicule_id", "prestataire_id", "date", "type", "objet", "montant", "immobilisation_jours", "km", "reference"], interventionsV);

/* -- Incidents, sanctions, indisponibilités --------------------------------------- */

inserer(
  "incident",
  ["id", "numero", "vehicule_id", "chauffeur_id", "date_heure", "nature", "type", "lieu", "mission", "responsabilite", "statut", "blesses", "sinistre_ouvert", "immobilisation_jours", "kilometrage", "declarant", "description"],
  listeIncidents().map((i) => [uuid(`incident:${i.numero}`), i.numero, vehiculeId(i.vehiculeId), chauffeurId(i.chauffeurId), horodatage(i.dateHeure), i.nature, i.type, i.lieu, i.mission, i.responsabilite, i.statut, i.blesses, i.sinistreOuvert, i.immobilisationJours, i.kilometrage, i.declarant, [i.description, i.roulant === "non" ? "Véhicule non roulant." : i.roulant === "reserve" ? "Véhicule roulant avec réserve." : null].filter(Boolean).join(" ") || null]),
);

/* Une sanction cite l'incident par son identifiant interne (« acc-amadou-balde-… »),
   pas par son numéro : on retrouve le numéro sur les incidents des fiches, et
   une sanction dont l'incident est introuvable garde sa ligne, sans le lien. */
const numeroIncident = new Map<string, string>();
for (const f of fichesChauffeurs()) for (const i of f.incidents) numeroIncident.set(i.declaration.id, i.declaration.numero);
const incidentsConnus = new Set(listeIncidents().map((i) => i.numero));
const lienIncident = (id: string | null) => {
  const n = id ? numeroIncident.get(id) : undefined;
  return n && incidentsConnus.has(n) ? uuid(`incident:${n}`) : null;
};

const sanctionsV: unknown[][] = [];
const indisposV: unknown[][] = [];
for (const f of fichesChauffeurs()) {
  const cid = chauffeurId(f.ligne.id);
  for (const s of f.sanctions) sanctionsV.push([uuid(`sanction:${s.numero}`), s.numero, cid, s.date, s.type, s.motif, s.jours, lienIncident(s.incidentId)]);
  for (const i of f.indisponibilites) indisposV.push([uuid(`indisponibilite:${i.numero}`), i.numero, cid, i.motif, i.debut, i.fin, i.commentaire]);
}
inserer("sanction", ["id", "numero", "chauffeur_id", "date", "type", "motif", "jours", "incident_id"], sanctionsV);
inserer("indisponibilite", ["id", "numero", "chauffeur_id", "motif", "debut", "fin", "commentaire"], indisposV);

/* -- Demandes poussées aux détenteurs (0011) -------------------------------------- */

inserer(
  "demande",
  ["id", "numero", "lot", "type", "vehicule_id", "chauffeur_id", "attributaire_id", "destinataire_nom", "message", "emise_le", "emise_par_nom", "echeance", "repondue_le", "reponse_valeur", "reponse_texte", "reponse_photo", "reponse_commentaire"],
  demandesDemo().map((d) => [uuid(`demande:${d.numero}`), d.numero, d.lot, d.type, vehiculeId(d.vehicule.id), d.detenteur.genre === "chauffeur" ? chauffeurId(d.detenteur.id) : null, d.detenteur.genre === "attributaire" ? attributaireId(d.detenteur.id) : null, d.detenteur.nom, d.message, d.emiseLe, d.emisePar, d.echeance, d.reponse?.le ?? null, d.reponse?.valeur ?? null, d.reponse?.texte ?? null, d.reponse?.photo ?? null, d.reponse?.commentaire ?? null]),
);

/* -- Fiches de transfert (0012) --------------------------------------------------- */

inserer(
  "transfert",
  ["id", "numero", "vehicule_id", "remettant_genre", "remettant_chauffeur_id", "remettant_attributaire_id", "remettant_nom", "recipiendaire_genre", "recipiendaire_chauffeur_id", "recipiendaire_attributaire_id", "recipiendaire_nom", "date", "motif", "km", "carburant", "documents_a_bord", "equipements", "reserves", "commentaire", "signature_remettant", "signature_recipiendaire", "appliquee_le", "cree_par_nom"],
  transfertsDemo().map((t) => [uuid(`transfert:${t.numero}`), t.numero, vehiculeId(t.vehicule.id), t.remettant.genre, t.remettant.genre === "chauffeur" ? chauffeurId(t.remettant.id) : null, t.remettant.genre === "attributaire" ? attributaireId(t.remettant.id) : null, t.remettant.nom, t.recipiendaire.genre, t.recipiendaire.genre === "chauffeur" ? chauffeurId(t.recipiendaire.id) : null, t.recipiendaire.genre === "attributaire" ? attributaireId(t.recipiendaire.id) : null, t.recipiendaire.nom, t.date, t.motif, t.km, t.carburant, t.documentsABord, JSON.stringify(t.equipements), JSON.stringify(t.reserves), t.commentaire, t.signatureRemettant ? JSON.stringify(t.signatureRemettant) : null, t.signatureRecipiendaire ? JSON.stringify(t.signatureRecipiendaire) : null, t.appliquee ? t.date : null, t.creePar]),
);

/* -- Ordres de travail (0016) ---------------------------------------------------- */

inserer(
  "ordre_travail",
  ["id", "numero", "vehicule_id", "type", "objet", "origine_numero", "origine_libelle", "prestataire_id", "garage", "date_prevue", "immobilisation_prevue_jours", "montant_estime", "statut", "date_debut", "date_cloture", "intervention_numero", "commentaire", "demandeur_nom", "cree_le"],
  ordresDeTravail().map((o) => [uuid(`ordre:${o.numero}`), o.numero, vehiculeId(o.vehiculeId), o.type, o.objet, o.origineNumero, o.origineLibelle, prestataireId(prestataireParNom.get(o.garage) ?? null), o.garage, o.datePrevue, o.immobilisationPrevueJours, o.montantEstime, o.statut, o.dateDebut, o.dateCloture, o.interventionNumero, o.commentaire, o.demandeur, `${o.dateDebut ?? o.datePrevue}T08:00:00+00`]),
);

/* -- Paramètres ------------------------------------------------------------------- */

inserer(
  "parametre",
  ["cle", "valeur"],
  [
    ["energie", JSON.stringify(PARAMETRES_DEFAUT.energie)],
    ["alertes", JSON.stringify(PARAMETRES_DEFAUT.alertes)],
    ["vehicules", JSON.stringify(PARAMETRES_DEFAUT.vehicules)],
    ["pastilles", JSON.stringify(PARAMETRES_DEFAUT.pastilles)],
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
-- Prérequis : les migrations 0001 à 0005. Les comptes (profil) ne sont pas
-- dans ce fichier — ils citent auth.users, qui n'existe qu'une fois les
-- personnes invitées.
-- ============================================================================
`;

mkdirSync("supabase", { recursive: true });
writeFileSync("supabase/seed.sql", `${entete}${lignes.join("\n")}\n`);
console.log(`supabase/seed.sql — ${total} lignes sur ${lignes.filter((l) => l.startsWith("\n-- ")).length} tables`);

/* Le fichier entier dépasse ce que l'éditeur SQL de Supabase accepte d'un
   coup : il est aussi découpé en parties ordonnées, aux frontières
   d'instruction, que l'on colle l'une après l'autre. Le dossier est ignoré
   par git — il se régénère. */
const TAILLE_PARTIE = 300_000;
const parties: string[][] = [[]];
let taille = 0;
for (let i = 0; i < lignes.length; i++) {
  const bloc = lignes[i].startsWith("\n-- ") ? `${lignes[i]}\n${lignes[++i]}` : lignes[i];
  const octets = Buffer.byteLength(bloc, "utf8");
  if (taille > 0 && taille + octets > TAILLE_PARTIE) { parties.push([]); taille = 0; }
  parties[parties.length - 1].push(bloc);
  taille += octets;
}
rmSync("supabase/seed-parties", { recursive: true, force: true });
mkdirSync("supabase/seed-parties", { recursive: true });
parties.forEach((blocs, i) => {
  const numero = String(i + 1).padStart(2, "0");
  const tete = `-- Partie ${i + 1}/${parties.length} du seed — à jouer dans l'ordre, sans en sauter.\n${i === 0 ? entete : ""}`;
  writeFileSync(`supabase/seed-parties/seed-${numero}.sql`, `${tete}${blocs.join("\n")}\n`);
});
console.log(`supabase/seed-parties/ — ${parties.length} parties`);
