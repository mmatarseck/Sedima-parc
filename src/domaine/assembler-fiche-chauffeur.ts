/* ============================================================================
 * L'assemblage d'une fiche chauffeur depuis ses faits.
 *
 * Ce que la base rend (migration 0015, `lire_fiche_chauffeur()`) — le
 * chauffeur, ses documents, ses affectations, ses indisponibilités, ses
 * sanctions, ses incidents, et ce que sa conduite a produit — devient ici la
 * fiche que les écrans lisent : documents et échéances, kilomètres de chaque
 * affectation, consommation par mois et par véhicule, contraventions et
 * frais de route, journal. La règle d'attribution (tout au titulaire, le
 * suppléant les jours d'indisponibilité) est déjà appliquée par la base.
 * ==========================================================================*/

import { REFERENCE_L100 } from "./assembler-fiche";
import type { AffectationChauffeur, ConsommationChauffeur, ContraventionChauffeur, FicheChauffeur, FraisDeRoute, IncidentChauffeur, LigneChauffeur, ReleveAttribue } from "./chauffeur";
import type { DocumentFiche, EtatDocument, EvenementJournal } from "./fiche";
import { BUSINESS_UNIT, MOTIF_INDISPONIBILITE, TYPE_INCIDENT, TYPE_SANCTION } from "./libelles";
import type { BusinessUnit, CategorieVehicule, DeclarationIncident, Indisponibilite, Sanction, TypeDocument, TypeIncident } from "./types";

/** Les faits d'un chauffeur, tels que la base les rend. */
export interface FaitsFicheChauffeur {
  adresse: string | null;
  contactUrgence: string | null;
  permisDelivrance: string | null;
  documents: { numero: string; type: TypeDocument; dateEffet: string | null; echeance: string | null; emetteur: string | null; numeroPiece: string | null; montant: number | null; justificatif: boolean }[];
  affectations: { numero: string; role: "titulaire" | "suppleant"; debut: string; fin: string | null; motif: string; vehicule: { id: string; immatriculation: string; immatriculationAffichee: string; marque: string; appellation: string; categorie: CategorieVehicule; businessUnit: BusinessUnit | null; site: string | null } }[];
  indisponibilites: Indisponibilite[];
  sanctions: (Sanction & { depenseNumero: string | null; incidentNumero: string | null })[];
  incidents: { numero: string; nature: "incident" | "accident"; type: string; dateHeure: string; lieu: string | null; mission: DeclarationIncident["mission"]; responsabilite: DeclarationIncident["responsabilite"]; statut: DeclarationIncident["statut"]; blesses: boolean; sinistreOuvert: boolean; immobilisationJours: number | null; kilometrage: number | null; description: string | null; vehicule: { id: string; immatriculation: string; immatriculationAffichee: string; marque: string; appellation: string; siteId: string | null } }[];
  pleins: { numero: string; vehiculeId: string; date: string; litres: number; montant: number; km: number | null }[];
  depenses: { numero: string; vehiculeId: string | null; date: string; poste: string; libelle: string; montant: number; reference: string | null; justificatif: boolean }[];
  releves: { vehiculeId: string; date: string; km: number; origine: string; valide: boolean; attribue: boolean }[];
}

function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
const fmtDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

function etatDocument(j: number | null, manquant: boolean): EtatDocument {
  if (manquant) return "manquant";
  if (j === null) return "a-jour";
  if (j < 0) return "echu";
  if (j <= 30) return "bientot";
  return "a-jour";
}

/** Les kilomètres du compteur entre deux dates, sur les relevés valides d'un véhicule triés par date. */
function kmEntre(points: { date: string; km: number }[], debut: string, fin: string): number {
  const avant = points.filter((p) => p.date < debut);
  const dedans = points.filter((p) => p.date >= debut && p.date <= fin);
  if (dedans.length === 0) return 0;
  const depart = avant.length ? avant[avant.length - 1]!.km : dedans[0]!.km;
  const arrivee = dedans[dedans.length - 1]!.km;
  return Math.max(0, arrivee - depart);
}

export function assemblerFicheChauffeur(ligne: LigneChauffeur, faits: FaitsFicheChauffeur, aujourdhui: string): FicheChauffeur {
  const c = ligne.chauffeur;

  /* ---- Documents : ceux de la table, sinon les échéances portées par la fiche ---- */
  const documents: DocumentFiche[] = faits.documents.map((d) => {
    const j = d.echeance ? joursEntre(aujourdhui, d.echeance) : null;
    return { numero: d.numero, type: d.type, numeroPiece: d.numeroPiece, emetteur: d.emetteur, dateEffet: d.dateEffet, echeance: d.echeance, montant: d.montant, justificatif: d.justificatif, etat: etatDocument(j, false), joursRestants: j };
  });
  if (!documents.some((d) => d.type === "permis")) {
    const j = c.permisEcheance ? joursEntre(aujourdhui, c.permisEcheance) : null;
    documents.push({ numero: `DOC-PERMIS-${c.id}`, type: "permis", numeroPiece: c.permisNumero, emetteur: c.permisNumero ? "Direction des Transports terrestres" : null, dateEffet: faits.permisDelivrance, echeance: c.permisEcheance, montant: null, justificatif: Boolean(c.permisNumero), etat: etatDocument(j, !c.permisNumero), joursRestants: j });
  }
  if (!documents.some((d) => d.type === "visite-medicale")) {
    const j = c.visiteMedicaleEcheance ? joursEntre(aujourdhui, c.visiteMedicaleEcheance) : null;
    documents.push({ numero: `DOC-VM-${c.id}`, type: "visite-medicale", numeroPiece: null, emetteur: null, dateEffet: null, echeance: c.visiteMedicaleEcheance, montant: null, justificatif: false, etat: etatDocument(j, !c.visiteMedicaleEcheance), joursRestants: j });
  }

  /* ---- Les relevés valides, par véhicule, pour les kilomètres ---- */
  const pointsParVehicule = new Map<string, { date: string; km: number }[]>();
  for (const r of faits.releves) {
    if (!r.valide) continue;
    const l = pointsParVehicule.get(r.vehiculeId) ?? [];
    l.push({ date: r.date, km: r.km });
    pointsParVehicule.set(r.vehiculeId, l);
  }
  for (const l of pointsParVehicule.values()) l.sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);

  /* ---- Affectations ---- */
  const affectations: AffectationChauffeur[] = faits.affectations.map((a) => ({
    id: a.numero,
    numero: a.numero,
    vehiculeId: a.vehicule.immatriculation,
    immatriculation: a.vehicule.immatriculation,
    immatriculationAffichee: a.vehicule.immatriculationAffichee,
    vehicule: `${a.vehicule.marque} ${a.vehicule.appellation}`,
    role: a.role,
    debut: a.debut,
    fin: a.fin,
    buSite: `${a.vehicule.businessUnit ? BUSINESS_UNIT[a.vehicule.businessUnit] : "—"} · ${a.vehicule.site ?? "—"}`,
    kmParcourus: kmEntre(pointsParVehicule.get(a.vehicule.id) ?? [], a.debut, a.fin && a.fin < aujourdhui ? a.fin : aujourdhui),
    motif: a.motif,
  }));
  const vehiculeDe = (id: string) => faits.affectations.find((a) => a.vehicule.id === id)?.vehicule ?? null;

  /* ---- Consommation par mois et par véhicule, sur les pleins attribués ---- */
  const parMoisVehicule = new Map<string, { mois: string; vehiculeId: string; litres: number; cout: number }>();
  for (const p of faits.pleins) {
    const mois = p.date.slice(0, 7);
    const cle = `${mois}|${p.vehiculeId}`;
    const e = parMoisVehicule.get(cle) ?? { mois, vehiculeId: p.vehiculeId, litres: 0, cout: 0 };
    e.litres += p.litres;
    e.cout += p.montant;
    parMoisVehicule.set(cle, e);
  }
  const consommation: ConsommationChauffeur[] = [...parMoisVehicule.values()].map((e) => {
    const v = vehiculeDe(e.vehiculeId);
    const [a, m] = e.mois.split("-").map(Number);
    const finMois = new Date(Date.UTC(a!, m!, 0)).toISOString().slice(0, 10);
    const km = kmEntre(pointsParVehicule.get(e.vehiculeId) ?? [], `${e.mois}-01`, finMois);
    const litres = Math.round(e.litres * 10) / 10;
    const l100 = km > 0 ? Math.round((litres / km) * 1000) / 10 : 0;
    const ref = REFERENCE_L100[v?.categorie ?? ""] ?? 20;
    return { mois: e.mois, vehiculeId: v?.immatriculation ?? e.vehiculeId, immatriculationAffichee: v?.immatriculationAffichee ?? e.vehiculeId, litres, kmParcourus: km, litresAux100: l100, referenceL100: ref, ecartPct: l100 > 0 ? Math.round(((l100 - ref) / ref) * 1000) / 10 : 0, cout: e.cout };
  });
  consommation.sort((x, y) => y.mois.localeCompare(x.mois) || x.immatriculationAffichee.localeCompare(y.immatriculationAffichee));

  /* ---- Contraventions, frais de route ---- */
  const sanctions: Sanction[] = faits.sanctions.map((s) => ({ id: s.id, numero: s.numero, chauffeurId: c.id, date: s.date, type: s.type, motif: s.motif, jours: s.jours, incidentId: s.incidentNumero, depenseId: s.depenseNumero }));
  const contraventions: ContraventionChauffeur[] = faits.depenses
    .filter((d) => d.poste === "contravention")
    .map((d) => {
      const v = d.vehiculeId ? vehiculeDe(d.vehiculeId) : null;
      return { id: d.numero, numero: d.numero, date: d.date, vehiculeId: v?.immatriculation ?? "", immatriculationAffichee: v?.immatriculationAffichee ?? "—", libelle: d.libelle, montant: d.montant, reference: d.reference, retenue: sanctions.some((s) => s.type === "retenue" && s.depenseId === d.numero) };
    });
  const fraisDeRoute: FraisDeRoute[] = faits.depenses
    .filter((d) => d.poste === "frais-de-route")
    .map((d) => {
      const v = d.vehiculeId ? vehiculeDe(d.vehiculeId) : null;
      return { id: d.numero, numero: d.numero, date: d.date, vehiculeId: v?.immatriculation ?? "", immatriculationAffichee: v?.immatriculationAffichee ?? "—", libelle: d.libelle, montant: d.montant, reference: d.reference, justificatif: d.justificatif };
    });

  /* ---- Incidents ---- */
  const incidents: IncidentChauffeur[] = faits.incidents.map((i) => ({
    declaration: {
      id: i.numero,
      numero: i.numero,
      vehiculeId: i.vehicule.immatriculation,
      nature: i.nature,
      type: i.type as TypeIncident,
      dateHeure: i.dateHeure.slice(0, 16),
      lieu: i.lieu ?? "—",
      siteId: i.vehicule.siteId,
      chauffeurId: c.id,
      mission: i.mission,
      description: i.description ?? "",
      kilometrage: i.kilometrage,
      roulant: /non roulant/i.test(i.description ?? "") ? "non" : /réserve/i.test(i.description ?? "") ? "reserve" : "oui",
      statut: i.statut,
      responsabilite: i.responsabilite,
      blesses: i.blesses,
      sinistreOuvert: i.sinistreOuvert,
      declarantId: "",
    },
    immatriculationAffichee: i.vehicule.immatriculationAffichee,
    vehicule: `${i.vehicule.marque} ${i.vehicule.appellation}`,
    /* Rien ne rattache une dépense à une déclaration en base : le coût est
       inconnu, pas nul. Voir `IncidentChauffeur.cout`. */
    cout: null,
    immobilisationJours: i.immobilisationJours ?? 0,
  }));

  const releves: ReleveAttribue[] = faits.releves
    .filter((r) => r.attribue && r.origine !== "telematique")
    .map((r) => ({ date: r.date, vehiculeId: vehiculeDe(r.vehiculeId)?.immatriculation ?? r.vehiculeId, valide: r.valide }))
    .sort((a, b) => b.date.localeCompare(a.date));

  /* ---- Journal ---- */
  const journal: EvenementJournal[] = [];
  for (const a of affectations) {
    journal.push({ date: a.debut, auteur: "Service parc", initiales: "SP", categorie: "affectation", texte: `Affecté comme ${a.role === "titulaire" ? "titulaire" : "suppléant"} sur ${a.immatriculationAffichee} (${a.vehicule}) — ${a.motif.toLowerCase()}.` });
    if (a.fin) journal.push({ date: a.fin, auteur: "Service parc", initiales: "SP", categorie: "affectation", texte: `Fin d'affectation sur ${a.immatriculationAffichee} — ${fmt(a.kmParcourus)} km parcourus sur la période.` });
  }
  for (const d of documents) if (d.dateEffet) journal.push({ date: d.dateEffet, auteur: "Service parc", initiales: "SP", categorie: "document", texte: `${d.type === "permis" ? "Permis de conduire" : d.type === "visite-medicale" ? "Visite médicale" : d.type} ${d.numeroPiece ?? ""} enregistré${d.type === "visite-medicale" ? "e" : ""}${d.emetteur ? ` (${d.emetteur})` : ""}, échéance ${fmtDate(d.echeance)}.`.replace(/\s+/g, " ") });
  for (const i of incidents) journal.push({ date: i.declaration.dateHeure.slice(0, 10), auteur: "Service parc", initiales: "SP", categorie: "note", texte: `${i.declaration.nature === "accident" ? "Accident" : "Incident"} déclaré sur ${i.immatriculationAffichee} — ${(TYPE_INCIDENT[i.declaration.type] ?? i.declaration.type).toLowerCase()}, ${i.declaration.lieu}.` });
  for (const s of sanctions) journal.push({ date: s.date, auteur: "Direction des Opérations", initiales: "DO", categorie: "note", texte: `${TYPE_SANCTION[s.type]}${s.jours ? ` de ${s.jours} jours` : ""} — ${s.motif}.`, confidentiel: true });
  for (const x of contraventions) journal.push({ date: x.date, auteur: "Service parc", initiales: "SP", categorie: "depense", texte: `Contravention sur ${x.immatriculationAffichee} — ${x.libelle} (${fmt(x.montant)} F)${x.retenue ? ", retenue sur salaire" : ""}.` });
  for (const i of faits.indisponibilites) journal.push({ date: i.debut, auteur: "Service parc", initiales: "SP", categorie: "statut", texte: `${MOTIF_INDISPONIBILITE[i.motif]} du ${fmtDate(i.debut)}${i.fin ? ` au ${fmtDate(i.fin)}` : ""}${i.commentaire ? ` — ${i.commentaire}` : ""}.` });
  if (c.dateSortie) journal.push({ date: c.dateSortie, auteur: "Direction des Opérations", initiales: "DO", categorie: "statut", texte: "Sortie des effectifs." });
  if (c.dateEmbauche) journal.push({ date: c.dateEmbauche, auteur: "Service RH", initiales: "RH", categorie: "note", texte: `Entrée dans l'entreprise — contrat ${c.contrat === "salarie" ? "salarié" : c.contrat}${c.matriculeRh ? `, matricule ${c.matriculeRh}` : ""}.` });
  journal.sort((a, b) => b.date.localeCompare(a.date));

  const age = c.dateNaissance ? Math.floor(joursEntre(c.dateNaissance, aujourdhui) / 365.25) : null;
  const anciennete = c.dateEmbauche ? Math.round((joursEntre(c.dateEmbauche, c.dateSortie ?? aujourdhui) / 365.25) * 10) / 10 : null;

  return {
    ligne,
    identite: { dateNaissance: c.dateNaissance, age, dateEmbauche: c.dateEmbauche, ancienneteAnnees: anciennete, dateSortie: c.dateSortie, adresse: faits.adresse, contactUrgence: faits.contactUrgence, permisNumero: c.permisNumero, permisDelivrance: faits.permisDelivrance, permisCategories: c.permisCategories },
    documents,
    affectations,
    consommation,
    contraventions,
    incidents,
    sanctions,
    indisponibilites: faits.indisponibilites,
    fraisDeRoute,
    releves,
    journal: journal.slice(0, 24),
  };
}
