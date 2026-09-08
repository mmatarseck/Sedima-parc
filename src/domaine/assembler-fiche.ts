/* ============================================================================
 * L'assemblage d'une fiche véhicule depuis ses faits.
 *
 * Ce que la base rend (migration 0013, `lire_fiche()`) — le véhicule, ses
 * documents, ses affectations, ses relevés, ses pleins, ses dépenses, ses
 * interventions, la trace de ses statuts — devient ici la fiche 360° que les
 * écrans lisent, par les calculs du domaine : état et échéance de chaque
 * document, immobilisation administrative, contrôle des relevés,
 * consommation par mois, coûts par poste et par mois, plan d'entretien
 * confronté à l'historique, périodes de statut, journal.
 *
 * Le jeu de démonstration (`fiche-demo.ts`) génère ses faits et les assemble
 * dans le même mouvement ; cet assembleur ne génère rien. Il vaut pour les
 * données réelles, et pour une fiche presque vide d'un véhicule qui vient
 * d'entrer au parc.
 * ==========================================================================*/

import { exigeDocument, immobilisationAdministrative } from "./documents";
import { echeancesDuPlan, type CompteursVehicule, type DernierPassage, type PlanVehicule, type ProgrammeEntretien } from "./entretien";
import { agregerCouts, type AffectationFiche, type DepenseFiche, type DocumentFiche, type EcheanceFiche, type EtatDocument, type EvenementJournal, type FicheVehicule, type IndicateursFiche, type Intervention, type PeriodeStatutFiche, type PleinFiche, type ReleveFiche, type ConsommationMensuelle } from "./fiche";
import { BUSINESS_UNIT, POSTE_DEPENSE, STATUT_VEHICULE, TYPE_DOCUMENT, USAGE_VEHICULE } from "./libelles";
import { prixEnergie, type Parametres } from "./parametres";
import { formerNumero } from "./reference";
import { controlerReleves } from "./releves";
import type { LigneFlotte, MotifImmobilisation, PosteDepense, StatutVehicule, TypeDocument, CategorieObservation, GraviteObservation, StatutObservation, StatutVisite, TypeVisite } from "./types";

/** Référence de consommation par catégorie, en L/100 km. */
export const REFERENCE_L100: Record<string, number> = {
  camion: 28,
  tracteur: 34,
  "semi-remorque": 34,
  camionnette: 10.5,
  "vehicule-leger": 8,
  bus: 22,
  moto: 3.5,
  engin: 18,
};

/** Les faits d'un véhicule, tels que la base les rend. */
export interface FaitsFiche {
  documents: { numero: string; type: TypeDocument; dateEffet: string | null; echeance: string | null; emetteur: string | null; numeroPiece: string | null; montant: number | null; justificatif: boolean }[];
  licences: { numero: string; libelle: string; numeroPiece: string; emetteur: string; perimetre: "flotte" | "partie"; dateEffet: string; echeance: string; vehicules: number }[];
  affectations: { numero: string; chauffeurId: string | null; chauffeur: string; role: "titulaire" | "suppleant"; debut: string; fin: string | null; motif: string }[];
  releves: { numero: string; date: string; km: number; origine: string; motifRejet: string | null }[];
  pleins: { numero: string; date: string; litres: number; prixLitre: number; montant: number; km: number | null; source: string; reference: string | null }[];
  depenses: { numero: string; date: string; poste: PosteDepense; libelle: string; montant: number; beneficiaire: string | null; reference: string | null; origine: "caisse" | "bon-de-commande" | "facture"; justificatif: boolean; km: number | null; kmMotifRejet: string | null }[];
  interventions: { numero: string; date: string; type: "preventif" | "curatif"; objet: string; garage: string | null; montant: number; immobilisationJours: number; km: number | null; reference: string | null }[];
  /** La trace des statuts, du plus ancien au plus récent. */
  statuts: { le: string; avant: string | null; apres: string | null; motif: string }[];
  /** Les visites techniques (0023), de la plus récente à la plus ancienne. */
  visites: { numero: string; type: TypeVisite; centre: string; dateRendezVous: string; heure: string | null; datePassage: string | null; statut: StatutVisite; numeroPv: string | null; dateLimiteContreVisite: string | null; commentaire: string | null }[];
  /** Les observations des centres, citant leur visite par son numéro. */
  observations: { numero: string; visiteNumero: string; libelle: string; categorie: CategorieObservation; gravite: GraviteObservation; statut: StatutObservation; interventionNumero: string | null; corrigeeLe: string | null; commentaire: string | null }[];
}

export const FAITS_VIDES: FaitsFiche = { documents: [], licences: [], affectations: [], releves: [], pleins: [], depenses: [], interventions: [], statuts: [], visites: [], observations: [] };

/** Ce que le plan d'entretien demande à l'appelant : le gabarit de la catégorie et le plan du véhicule. */
export interface PlanFourni {
  programme: ProgrammeEntretien;
  plan: PlanVehicule;
  passages: (programme: ProgrammeEntretien, interventions: { numero: string; date: string; objet: string; km: number | null }[], heuresParJour: number, compteurHeures: number | null, aujourdhui: string) => Map<string, DernierPassage>;
}

const OPERATIONNELS = new Set<StatutVehicule>(["en-service", "en-backup"]);

function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

function plusJours(jour: string, n: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function moisRelatif(aujourdhui: string, delta: number): string {
  const [a, m] = aujourdhui.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1 + delta, 1)).toISOString().slice(0, 7);
}

function etatDocument(joursRestants: number | null, manquant: boolean, permanent: boolean): EtatDocument {
  if (manquant) return "manquant";
  if (permanent) return "permanent";
  if (joursRestants === null) return "a-jour";
  if (joursRestants < 0) return "echu";
  if (joursRestants <= 30) return "bientot";
  return "a-jour";
}

function initiales(nom: string | null): string {
  if (!nom) return "—";
  const mots = nom.trim().split(/\s+/);
  return `${mots[0]?.[0] ?? ""}${mots[mots.length - 1]?.[0] ?? ""}`.toUpperCase() || "—";
}

const fmt = (n: number, decimales = 0) => n.toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
const fmtDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

/** Le compteur valide le plus proche d'une date, relevés triés du plus récent au plus ancien. */
function kmVers(releves: ReleveFiche[], date: string): number | null {
  const valides = releves.filter((r) => r.valide);
  const avant = valides.find((r) => r.date <= date);
  if (avant) return avant.valeur;
  const apres = [...valides].reverse().find((r) => r.date >= date);
  return apres ? apres.valeur : null;
}

export function assemblerFiche(l: LigneFlotte, faits: FaitsFiche, parametres: Parametres, aujourdhui: string, planFourni: PlanFourni): FicheVehicule {
  const v = l.vehicule;
  const refL100 = REFERENCE_L100[v.categorie] ?? 20;

  /* ---- Documents : ceux qui existent, la licence qui couvre, ceux qui manquent ---- */
  const documents: DocumentFiche[] = faits.documents.map((d) => {
    const permanent = !d.echeance && !(parametres.documents.types.find((t) => t.id === d.type)?.validiteMois);
    const j = d.echeance ? joursEntre(aujourdhui, d.echeance) : null;
    return { numero: d.numero, type: d.type, numeroPiece: d.numeroPiece, emetteur: d.emetteur, dateEffet: d.dateEffet, echeance: d.echeance, montant: d.montant, justificatif: d.justificatif, etat: etatDocument(j, false, permanent), joursRestants: j };
  });
  const licence = [...faits.licences].sort((a, b) => a.echeance.localeCompare(b.echeance))[0] ?? null;
  if (licence && exigeDocument("licence-transport", v, parametres)) {
    const j = joursEntre(aujourdhui, licence.echeance);
    documents.push({ numero: licence.numero, type: "licence-transport", portee: licence.perimetre === "flotte" ? "Toute la flotte" : `${licence.vehicules} véhicules — ${licence.libelle.toLowerCase()}`, numeroPiece: licence.numeroPiece, emetteur: licence.emetteur, dateEffet: licence.dateEffet, echeance: licence.echeance, montant: null, justificatif: true, etat: etatDocument(j, false, false), joursRestants: j });
  }
  let sequence = 99_000;
  for (const def of parametres.documents.types) {
    if (def.porteur === "chauffeur" || !exigeDocument(def.id, v, parametres)) continue;
    if (documents.some((d) => d.type === def.id)) continue;
    documents.push({ numero: formerNumero("document", aujourdhui, ++sequence), type: def.id, numeroPiece: null, emetteur: null, dateEffet: null, echeance: null, montant: null, justificatif: false, etat: "manquant", joursRestants: null });
  }
  /* Le dernier document de chaque type fait foi pour l'immobilisation : un document renouvelé n'est pas échu parce que l'ancien l'est. */
  const derniersParType = new Map<TypeDocument, DocumentFiche>();
  for (const d of [...documents].sort((a, b) => (a.echeance ?? "").localeCompare(b.echeance ?? ""))) derniersParType.set(d.type, d);
  const immobilisation = immobilisationAdministrative(v, [...derniersParType.values()], parametres);

  /* ---- Interventions ---- */
  const interventions: Intervention[] = faits.interventions.map((i) => ({ numero: i.numero, date: i.date, type: i.type, objet: i.objet, garage: i.garage ?? "—", km: i.km, immobilisationJours: i.immobilisationJours, montant: i.montant, reference: i.reference ?? "" })).sort((a, b) => b.date.localeCompare(a.date));

  /* ---- Pleins et dépenses ---- */
  const pleins: PleinFiche[] = faits.pleins.map((p) => ({ id: p.numero, numero: p.numero, date: p.date, source: p.source, litres: p.litres, prixLitre: p.prixLitre, montant: p.montant, reference: p.reference ?? "", km: p.km, kmMotifRejet: null })).sort((a, b) => b.date.localeCompare(a.date));
  const depenses: DepenseFiche[] = faits.depenses.map((d) => ({ id: d.numero, numero: d.numero, date: d.date, poste: d.poste, libelle: d.libelle, montant: d.montant, beneficiaire: d.beneficiaire, reference: d.reference, origine: d.origine, justificatif: d.justificatif, km: d.km, kmMotifRejet: d.kmMotifRejet }));
  /* Un plein est une dépense de carburant ; s'il n'a pas sa ligne de dépense, la fiche la déduit — la caisse et la cuve sont une seule vérité. */
  const numerosDepenses = new Set(depenses.map((d) => d.numero));
  for (const p of pleins) {
    if (numerosDepenses.has(p.numero)) continue;
    depenses.push({ id: p.numero, numero: p.numero, date: p.date, poste: "carburant", libelle: `Gasoil ${p.source} — ${fmt(p.litres, 1)} L`, montant: p.montant, beneficiaire: p.source, reference: p.reference, origine: "caisse", justificatif: true, km: p.km, kmMotifRejet: null });
  }
  depenses.sort((a, b) => b.date.localeCompare(a.date));

  /* ---- Relevés : ceux de la base, contrôlés ; le compteur courant est le plus récent valide ---- */
  const bruts = faits.releves.map((r) => {
    const origine = (["saisie", "plein", "garage", "telematique", "depense"].includes(r.origine) ? r.origine : "saisie") as ReleveFiche["origine"];
    const source = origine === "plein" ? "Plein" : origine === "garage" ? "Garage" : origine === "telematique" ? "Balise — relevé automatique" : origine === "depense" ? "Dépense" : "Saisie";
    return { numero: r.numero, date: r.date, valeur: r.km, origine, source, depenseId: null as string | null };
  });
  const releves: ReleveFiche[] = controlerReleves(bruts, v.categorie).sort((a, b) => b.date.localeCompare(a.date) || b.valeur - a.valeur);
  const dernierValide = releves.find((r) => r.valide) ?? null;
  const kmActuel = dernierValide?.valeur ?? l.kilometrage ?? null;

  /* ---- Rythme : les kilomètres des douze derniers mois, d'après les relevés valides ---- */
  const ilYAUnAn = plusJours(aujourdhui, -365);
  const kmIlYAUnAn = kmVers(releves, ilYAUnAn);
  const plusAncien = [...releves].reverse().find((r) => r.valide) ?? null;
  let kmParMois: number | null = null;
  if (kmActuel !== null && kmIlYAUnAn !== null && kmActuel > kmIlYAUnAn && plusAncien) {
    const jours = Math.max(30, Math.min(365, joursEntre(plusAncien.date, aujourdhui)));
    kmParMois = Math.round(((kmActuel - kmIlYAUnAn) / jours) * 30.44);
  }
  const kmDouzeMois = kmParMois !== null ? kmParMois * 12 : 0;

  /* ---- Carburant par mois : les pleins, contre les kilomètres parcourus dans le mois ---- */
  const carburant: ConsommationMensuelle[] = [];
  for (let delta = -12; delta <= -1; delta++) {
    const mois = moisRelatif(aujourdhui, delta);
    const duMois = pleins.filter((p) => p.date.startsWith(mois));
    if (duMois.length === 0) continue;
    const litres = Math.round(duMois.reduce((s, p) => s + p.litres, 0) * 10) / 10;
    const cout = duMois.reduce((s, p) => s + p.montant, 0);
    const debut = kmVers(releves, `${mois}-01`);
    const fin = kmVers(releves, moisRelatif(aujourdhui, delta + 1) + "-01");
    const km = debut !== null && fin !== null && fin > debut ? fin - debut : kmParMois !== null ? kmParMois : 0;
    const l100 = km > 0 ? Math.round((litres / km) * 1000) / 10 : 0;
    const sources = new Map<string, number>();
    for (const p of duMois) sources.set(p.source, (sources.get(p.source) ?? 0) + p.litres);
    const source = [...sources.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    carburant.push({ mois, source, litres, kmParcourus: km, litresAux100: l100, ecartPct: l100 > 0 ? Math.round(((l100 - refL100) / refL100) * 1000) / 10 : 0, cout: cout || Math.round(litres * prixEnergie(v.energie, `${mois}-15`, parametres)) });
  }
  const kmTotal = carburant.filter((c) => c.litresAux100 > 0).reduce((s, c) => s + c.kmParcourus, 0);
  const consommationL100 = kmTotal > 0 ? Math.round((carburant.filter((c) => c.litresAux100 > 0).reduce((s, c) => s + c.litres, 0) / kmTotal) * 1000) / 10 : null;

  /* ---- Coûts sur douze mois ---- */
  const moisDouze: string[] = [];
  for (let delta = -12; delta <= -1; delta++) moisDouze.push(moisRelatif(aujourdhui, delta));
  const depuisUnAn = depenses.filter((d) => d.date >= `${moisDouze[0]}-01` && d.date < `${moisRelatif(aujourdhui, 0)}-01`);
  const { coutsParPoste, chargesParGroupe, coutsMensuels, total } = agregerCouts(depuisUnAn, moisDouze);

  /* ---- Périodes de statut : la trace, les curatifs, la mise en service ---- */
  const periodesStatut: PeriodeStatutFiche[] = [];
  const trace = faits.statuts.filter((s) => s.apres);
  for (let i = 0; i < trace.length; i++) {
    const s = trace[i]!;
    const debut = s.le.slice(0, 10);
    const fin = trace[i + 1] ? trace[i + 1]!.le.slice(0, 10) : null;
    const statut = s.apres as StatutVehicule;
    const motif = (/panne/i.test(s.motif) ? "panne" : /preventi/i.test(s.motif) ? "maintenance-preventive" : /correcti|repar/i.test(s.motif) ? "maintenance-corrective" : /sinistre|accident/i.test(s.motif) ? "sinistre" : /administrati/i.test(s.motif) ? "administratif" : null) as MotifImmobilisation | null;
    periodesStatut.push({ statut, motif: OPERATIONNELS.has(statut) ? null : motif, debut, fin, jours: joursEntre(debut, fin ?? aujourdhui) });
  }
  if (periodesStatut.length === 0 && !OPERATIONNELS.has(v.statut)) {
    const debut = aujourdhui;
    periodesStatut.push({ statut: v.statut, motif: v.statut === "en-reparation" ? "panne" : null, debut, fin: null, jours: joursEntre(debut, aujourdhui) });
  }
  for (const i of interventions.filter((x) => x.type === "curatif" && x.immobilisationJours > 0)) {
    periodesStatut.push({ statut: "en-reparation", motif: "panne", debut: i.date, fin: plusJours(i.date, i.immobilisationJours), jours: i.immobilisationJours });
  }
  if (v.premiereMiseEnCirculation) periodesStatut.push({ statut: "en-service", motif: null, debut: v.premiereMiseEnCirculation, fin: null, jours: 0 });
  periodesStatut.sort((a, b) => b.debut.localeCompare(a.debut));

  /* La disponibilité sur douze mois : les jours hors des périodes immobilisées. */
  let joursImmobilises = 0;
  for (const p of periodesStatut) {
    if (OPERATIONNELS.has(p.statut)) continue;
    const debut = p.debut < ilYAUnAn ? ilYAUnAn : p.debut;
    const fin = p.fin && p.fin < aujourdhui ? p.fin : aujourdhui;
    if (fin > debut) joursImmobilises += joursEntre(debut, fin);
  }
  const disponibilitePct = Math.max(0, Math.min(100, Math.round((1 - joursImmobilises / 365) * 100)));

  /* ---- Plan d'entretien, confronté à l'historique ---- */
  const { programme, plan, passages } = planFourni;
  const compteurs: CompteursVehicule = { km: kmActuel, heures: null, kmParJour: Math.max(1, Math.round((kmParMois ?? 0) / 30)), heuresParJour: 0.5, miseEnService: v.premiereMiseEnCirculation };
  const echeancesEntretien = echeancesDuPlan(programme, plan, passages(programme, interventions, 0, null, aujourdhui), compteurs, aujourdhui);
  const rangOperation = new Map(programme.operations.map((o, i) => [o.code, i + 1]));
  for (const e of echeancesEntretien) e.numero = formerNumero("entretien", aujourdhui, 90_000 + (rangOperation.get(e.code) ?? 0));
  const premiere = echeancesEntretien.find((e) => e.kmRestants !== null || e.joursRestants !== null) ?? null;
  const prochaineIntervention = premiere === null ? null : { libelle: premiere.libelle, kmRestants: premiere.kmRestants ?? 0, joursEstimes: Math.max(0, premiere.joursRestants ?? Math.round((premiere.kmRestants ?? 0) / Math.max(1, compteurs.kmParJour))), aKm: premiere.dueA.km ?? kmActuel ?? 0 };

  /* ---- Affectations, avec les kilomètres de chaque période ---- */
  const bu = v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : "—";
  const buSite = `${bu} · ${l.site?.libelle ?? "—"}`;
  const affectations: AffectationFiche[] = faits.affectations
    .map((a) => {
      const kmDebut = kmVers(releves, a.debut);
      const kmFin = kmVers(releves, a.fin ?? aujourdhui);
      return { numero: a.numero, chauffeur: a.chauffeur, chauffeurId: a.chauffeurId, initiales: initiales(a.chauffeur), role: a.role, debut: a.debut, fin: a.fin, buSite, kmParcourus: kmDebut !== null && kmFin !== null && kmFin > kmDebut ? kmFin - kmDebut : 0, motif: a.motif };
    })
    .sort((a, b) => (a.fin === null && b.fin !== null ? -1 : b.fin === null && a.fin !== null ? 1 : b.debut.localeCompare(a.debut)));

  /* ---- Indicateurs ---- */
  const indicateurs: IndicateursFiche = {
    kilometrage: kmActuel,
    kmParMois,
    consommationL100,
    coutDouzeMois: total,
    coutParKm: kmDouzeMois > 0 ? Math.round(total / kmDouzeMois) : null,
    disponibilitePct,
  };

  /* ---- Échéances de l'aperçu ---- */
  const echeances: EcheanceFiche[] = [];
  for (const d of [...derniersParType.values()]) {
    if (d.etat === "permanent") continue;
    if (d.etat === "manquant") {
      echeances.push({ libelle: TYPE_DOCUMENT[d.type], repere: "—", precision: "Document manquant, à fournir", ton: "defavorable" });
      continue;
    }
    const j = d.joursRestants ?? 0;
    echeances.push({ libelle: TYPE_DOCUMENT[d.type], repere: d.echeance ?? "—", precision: j < 0 ? `Échue depuis ${Math.abs(j)} jours · ${d.emetteur ?? ""}` : j === 0 ? "Échéance aujourd'hui" : `Échéance dans ${j} jours · ${d.emetteur ?? ""}`, ton: j < 0 ? "defavorable" : j <= 30 ? "vigilance" : "favorable" });
  }
  if (prochaineIntervention) {
    echeances.push({ libelle: prochaineIntervention.libelle, repere: `≈ ${fmt(prochaineIntervention.aKm)} km`, precision: `Dans ${fmt(prochaineIntervention.kmRestants)} km, soit environ ${prochaineIntervention.joursEstimes} jours`, ton: prochaineIntervention.kmRestants < 1000 ? "vigilance" : "favorable" });
  }
  const ordre = { defavorable: 0, vigilance: 1, favorable: 2, neutre: 3 };
  echeances.sort((a, b) => ordre[a.ton] - ordre[b.ton]);

  /* ---- Journal ---- */
  const journal: EvenementJournal[] = [];
  for (const r of releves.filter((x) => x.valide && x.origine !== "telematique").slice(0, 2)) journal.push({ date: r.date, auteur: "Service parc", initiales: "SP", categorie: "releve", texte: `Relevé kilométrique ${fmt(r.valeur)} km — ${r.source}.` });
  for (const i of interventions.slice(0, 3)) journal.push({ date: i.date, auteur: "Atelier", initiales: "AT", categorie: "intervention", texte: `${i.type === "preventif" ? "Entretien préventif" : "Intervention curative"} — ${i.objet} chez ${i.garage} (${fmt(i.montant)} F${i.reference ? `, ${i.reference}` : ""}).` });
  for (const s of [...trace].reverse().slice(0, 4)) journal.push({ date: s.le.slice(0, 10), auteur: "Service parc", initiales: "SP", categorie: "statut", texte: `Statut passé à « ${STATUT_VEHICULE[(s.apres ?? "en-service") as StatutVehicule]?.libelle ?? s.apres} » — ${s.motif}.` });
  for (const a of affectations.slice(0, 3)) journal.push({ date: a.debut, auteur: "Service parc", initiales: "SP", categorie: "affectation", texte: `${a.chauffeur} affecté comme ${a.role === "titulaire" ? "titulaire" : "suppléant"} — ${a.motif.toLowerCase()}.` });
  for (const d of documents.filter((x) => x.dateEffet && x.etat !== "permanent" && x.etat !== "manquant").slice(0, 3)) journal.push({ date: d.dateEffet!, auteur: "Service parc", initiales: "SP", categorie: "document", texte: `${TYPE_DOCUMENT[d.type]} ${d.numeroPiece ?? ""} enregistrée${d.emetteur ? ` (${d.emetteur})` : ""}, échéance ${fmtDate(d.echeance)}.`.replace(/\s+/g, " ") });
  for (const d of depenses.filter((x) => x.poste !== "carburant").slice(0, 2)) journal.push({ date: d.date, auteur: "Service parc", initiales: "SP", categorie: "depense", texte: `${POSTE_DEPENSE[d.poste]} — ${d.libelle} (${fmt(d.montant)} F).` });
  journal.sort((a, b) => b.date.localeCompare(a.date));

  /* ---- Identité ---- */
  const mec = v.premiereMiseEnCirculation;
  const duree = v.dureeAmortissementAnnees;
  const ageAnnees = mec ? (Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${mec}T00:00:00Z`)) / (365.25 * 86_400_000) : null;
  const vnc = v.valeurAcquisition !== null && duree && ageAnnees !== null ? Math.max(0, Math.round(v.valeurAcquisition * (1 - Math.min(1, ageAnnees / duree)))) : v.valeurAcquisition;
  const finAmortissement = mec && duree ? `${Number(mec.slice(0, 4)) + duree}${mec.slice(4)}` : null;

  return {
    ligne: l,
    identite: {
      typeModele: v.typeModele,
      premiereMiseEnCirculation: mec,
      dateImmatriculation: v.dateImmatriculation,
      region: l.site?.region ?? "Dakar",
      puissanceCv: v.puissanceCv,
      cylindree: v.cylindree,
      ptac: v.ptac,
      ptra: v.ptra,
      poidsVide: v.poidsVide,
      chargeUtile: v.chargeUtile,
      energie: v.energie,
      capaciteReservoir: v.capaciteReservoir,
      utilisation: USAGE_VEHICULE[v.usage] ?? "—",
      regimePropriete: v.categorieFlotte === "interne" ? "Propriété SEDIMA" : v.categorieFlotte === "adex" ? "Mise à disposition ADEX" : "Location",
      entite: v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : "SEDIMA SA",
      valeurAcquisition: v.valeurAcquisition,
      dureeAmortissementAnnees: duree,
      valeurNetteComptable: vnc,
      finAmortissement,
      gpsActif: releves.some((r) => r.origine === "telematique"),
    },
    indicateurs,
    echeances,
    documents: documents.sort((a, b) => (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999")),
    affectations,
    attelages: [],
    /* Les visites et observations valent par leur numéro, comme les autres transactions ; un lecteur d'avant 0023 n'en rend pas. */
    visitesTechniques: (faits.visites ?? []).map((x) => ({ id: x.numero, numero: x.numero, vehiculeId: v.id, type: x.type, centre: x.centre, dateRendezVous: x.dateRendezVous, heure: x.heure, datePassage: x.datePassage, statut: x.statut, numeroPv: x.numeroPv, dateLimiteContreVisite: x.dateLimiteContreVisite, commentaire: x.commentaire })).sort((a, b) => b.dateRendezVous.localeCompare(a.dateRendezVous)),
    observationsVisite: (faits.observations ?? []).map((o) => ({ id: o.numero, numero: o.numero, visiteId: o.visiteNumero, vehiculeId: v.id, libelle: o.libelle, categorie: o.categorie, gravite: o.gravite, statut: o.statut, interventionNumero: o.interventionNumero, corrigeeLe: o.corrigeeLe, commentaire: o.commentaire })),
    immobilisationAdministrative: immobilisation,
    planEntretien: { programmeCode: programme.code, programmeLibelle: programme.libelle, programmePrecision: programme.precision, base: programme.base, aujourdhui, compteurs, echeances: echeancesEntretien },
    prochaineIntervention,
    interventions,
    carburant,
    referenceL100: refL100,
    depenses,
    pleins,
    releves,
    coutsParPoste,
    chargesParGroupe,
    coutsMensuels,
    journal: journal.slice(0, 18),
    periodesStatut,
  };
}

