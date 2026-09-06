/* ============================================================================
 * Prestataires — données de démonstration.
 *
 * Les noms sont ceux que l'application cite déjà : les garages des
 * interventions, les fournisseurs des demandes d'achat, les stations des
 * pleins, le livreur de la cuve, les centres de visite technique. Contacts,
 * téléphones et conditions sont illustratifs. Les fiches créées dans
 * l'application s'y ajoutent côté navigateur.
 * ==========================================================================*/

import type { Creation } from "@/domaine/cloture";
import { formerNumero } from "@/domaine/reference";
import type { Prestataire, TypePrestataire } from "@/domaine/prestataires";
import { graine } from "./fiche-demo";

const BRUT: { raisonSociale: string; type: TypePrestataire; ville: string; delai: number | null; actif?: boolean; note?: string }[] = [
  { raisonSociale: "La Sénégalaise de l'Automobile", type: "garage", ville: "Dakar", delai: 30, note: "Concessionnaire Renault Trucks — entretien préventif des poids lourds" },
  { raisonSociale: "Garage SEDIMA", type: "garage", ville: "Keur Massar", delai: null, note: "Atelier interne — main-d'œuvre maison, pièces sur bon de sortie" },
  { raisonSociale: "First Garage", type: "garage", ville: "Dakar", delai: 30 },
  { raisonSociale: "Garage Gormack", type: "garage", ville: "Thiès", delai: 15 },
  { raisonSociale: "TATA Pikine", type: "garage", ville: "Pikine", delai: 30, note: "Concessionnaire TATA — pièces d'origine" },
  { raisonSociale: "ANEC Pikine", type: "garage", ville: "Pikine", delai: 15 },
  { raisonSociale: "Pneus Plus Dakar", type: "pneumatiques", ville: "Dakar", delai: 30 },
  { raisonSociale: "SENEMECA", type: "pieces", ville: "Dakar", delai: 45 },
  { raisonSociale: "Espace Auto Sénégal", type: "pieces", ville: "Dakar", delai: 30 },
  { raisonSociale: "CFAO Motors", type: "pieces", ville: "Dakar", delai: 45, note: "Pièces d'origine véhicules légers" },
  { raisonSociale: "Établissements Diagne & Frères", type: "pieces", ville: "Rufisque", delai: null },
  { raisonSociale: "TotalEnergies Sénégal", type: "carburant", ville: "Dakar", delai: 30, note: "Livraison citerne de la cuve interne, deux fois par mois" },
  { raisonSociale: "Station Total", type: "station", ville: "Dakar", delai: null, note: "Pleins hors cuve, réglés par la caisse parc" },
  { raisonSociale: "Station Shell", type: "station", ville: "Thiès", delai: null },
  { raisonSociale: "AXA Assurances Sénégal", type: "assureur", ville: "Dakar", delai: null, note: "Flotte poids lourds" },
  { raisonSociale: "SUNU Assurances IARD", type: "assureur", ville: "Dakar", delai: null, note: "Véhicules légers et camionnettes" },
  { raisonSociale: "CCVA Rufisque", type: "centre-visite", ville: "Rufisque", delai: null },
  { raisonSociale: "CCVA Thiès", type: "centre-visite", ville: "Thiès", delai: null },
  { raisonSociale: "CCVA Dakar", type: "centre-visite", ville: "Dakar", delai: null },
  { raisonSociale: "Dakar Dépannage 24", type: "depanneur", ville: "Dakar", delai: null, note: "Remorquage poids lourds, 24 h/24" },
  /* Les transporteurs du parc, relevés dans le dossier de la Direction des
     Opérations (« TARIF TRANSPOTEURS.xlsx » et « FACTURES DES TRANSPORTEURS
     2026.xlsx »). Plusieurs sont **clients de SEDIMA** : leur prestation se
     compense avec ce qu'ils doivent, elle ne se règle pas par virement — d'où
     la mention dans la note. */
  { raisonSociale: "Abdou Kane", type: "transporteur", ville: "Thiès", delai: 30, note: "Client SEDIMA — transport compensé · vracs, poulets et phosphate" },
  { raisonSociale: "Abdou Dieng", type: "transporteur", ville: "Thiès", delai: 30, note: "Client SEDIMA — transport compensé · vracs et sacherie" },
  { raisonSociale: "Sokhna Diop", type: "transporteur", ville: "Touba", delai: 30, note: "Cliente SEDIMA — transport compensé" },
  { raisonSociale: "Moussa Kane", type: "transporteur", ville: "Thiès", delai: 30, note: "Client SEDIMA — transport compensé" },
  { raisonSociale: "Abdou K. Diop", type: "transporteur", ville: "Dakar", delai: 30, note: "Transporteur pur — réglé par virement" },
  { raisonSociale: "Dème Transport", type: "transporteur", ville: "Thiès", delai: 30, note: "Transfert de poulets vers l'abattoir, au voyage" },
  { raisonSociale: "Dr Wade Transport", type: "transporteur", ville: "Dakar", delai: 30 },
  { raisonSociale: "Djily Transport", type: "transporteur", ville: "Diourbel", delai: 30 },
  { raisonSociale: "Mouhamed Sy", type: "transporteur", ville: "Dakar", delai: 30, note: "Livraison d'œufs et de farine, prix au sac" },
  { raisonSociale: "Dame Ndoye", type: "transporteur", ville: "Rufisque", delai: 15, note: "Transport du personnel des abattoirs, au voyage" },
  { raisonSociale: "K2SBT", type: "transporteur", ville: "Dakar", delai: 45 },
  { raisonSociale: "Aïssata Gaye", type: "transporteur", ville: "Ziguinchor", delai: 45, note: "Liaisons Gambie et Casamance" },
  /* ADEX ne vend pas des voyages mais des véhicules à la journée : un modèle à
     part, tenu à l'écart de la grille à la tonne (voir `MiseADisposition`). */
  { raisonSociale: "ADEX Express", type: "transporteur", ville: "Dakar", delai: 30, note: "Mise à disposition de véhicules à la journée, carburant servi à la cuve SEDIMA" },
];

const PRENOMS = ["Moussa", "Awa", "Cheikh", "Fatou", "Ibrahima", "Aminata", "Ousmane", "Ndèye", "Mamadou", "Rokhaya"];
const NOMS = ["Ndiaye", "Diop", "Sarr", "Faye", "Gueye", "Ba", "Sy", "Mbaye", "Thiam", "Kane"];

let CACHE: Prestataire[] | null = null;

export function listePrestataires(): Prestataire[] {
  if (CACHE) return CACHE;
  CACHE = BRUT.map((b, i) => {
    const alea = graine(`prestataire-${b.raisonSociale}`);
    const domaine = b.raisonSociale
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 14);
    return {
      numero: formerNumero("prestataire", "2026-01-01", i + 1),
      raisonSociale: b.raisonSociale,
      type: b.type,
      contact: `${PRENOMS[Math.floor(alea() * PRENOMS.length)]} ${NOMS[Math.floor(alea() * NOMS.length)]}`,
      telephone: `+221 ${77 + Math.floor(alea() * 2)} ${String(100 + Math.floor(alea() * 899))} ${String(10 + Math.floor(alea() * 89))} ${String(10 + Math.floor(alea() * 89))}`,
      courriel: `contact@${domaine}.sn`,
      adresse: null,
      ville: b.ville,
      ninea: `${String(100000 + Math.floor(alea() * 899999))}2A2`,
      delaiPaiementJours: b.delai,
      actif: b.actif ?? true,
      note: b.note ?? null,
      creee: false,
    };
  });
  return CACHE;
}

/** Une fiche créée dans l'application, remise à la forme du référentiel. */
export function fabriquerPrestataire(c: Creation): Prestataire {
  const v = c.valeurs;
  const s = (x: unknown): string | null => (x === null || x === undefined || x === "" ? null : String(x));
  const n = (x: unknown): number | null => (x === null || x === undefined || x === "" ? null : Number(x));
  return {
    numero: c.numero,
    raisonSociale: s(v.raisonSociale) ?? "",
    type: (s(v.type) as TypePrestataire) ?? "autre",
    contact: s(v.contact),
    telephone: s(v.telephone),
    courriel: s(v.courriel),
    adresse: s(v.adresse),
    ville: s(v.ville),
    ninea: s(v.ninea),
    delaiPaiementJours: n(v.delaiPaiementJours),
    actif: v.actif === undefined ? true : Boolean(v.actif),
    note: s(v.note),
    creee: true,
  };
}

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Le prestataire derrière un nom cité par une fiche : « Sénégalaise de
 * l'Automobile » et « La Sénégalaise de l'Automobile » sont le même. Nul quand
 * personne ne correspond — la transaction garde alors le nom seul, et la fiche
 * du prestataire reste à créer.
 */
export function prestatairePour(nom: string | null, prestataires: Prestataire[] = listePrestataires()): Prestataire | null {
  if (!nom) return null;
  const n = normaliser(nom);
  if (!n) return null;
  return prestataires.find((p) => normaliser(p.raisonSociale) === n) ?? prestataires.find((p) => normaliser(p.raisonSociale).includes(n) || n.includes(normaliser(p.raisonSociale))) ?? null;
}

/**
 * Les prestataires actifs de certains types, fiches créées comprises, en options
 * de formulaire — le garage d'un ordre de travail se choisit ici. Dans le
 * navigateur seulement pour les créations ; le serveur ne voit que le jeu de
 * démonstration.
 */
export function optionsPrestataires(types: TypePrestataire[], lireCreations?: (sujet: string) => Creation[]): { valeur: string; libelle: string }[] {
  const creees = lireCreations ? lireCreations("prestataires").filter((c) => c.type === "prestataire").map(fabriquerPrestataire) : [];
  return [...creees, ...listePrestataires()]
    .filter((p) => p.actif && types.includes(p.type))
    .map((p) => ({ valeur: p.raisonSociale, libelle: `${p.raisonSociale}${p.ville ? ` · ${p.ville}` : ""}` }));
}

/**
 * Les prestataires actifs en options dont la valeur est le numéro PRE — ce que
 * portent les commandes et les factures, pour que les statistiques par
 * prestataire tiennent sur une clé et non sur un nom. Tous les types, sauf
 * ceux demandés.
 */
export function optionsPrestatairesParNumero(lireCreations?: (sujet: string) => Creation[], types?: TypePrestataire[]): { valeur: string; libelle: string }[] {
  const creees = lireCreations ? lireCreations("prestataires").filter((c) => c.type === "prestataire").map(fabriquerPrestataire) : [];
  return [...creees, ...listePrestataires()]
    .filter((p) => p.actif && (!types || types.includes(p.type)))
    .sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr"))
    .map((p) => ({ valeur: p.numero, libelle: `${p.raisonSociale}${p.ville ? ` · ${p.ville}` : ""}` }));
}
