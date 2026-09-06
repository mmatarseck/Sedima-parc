/* ============================================================================
 * Carburant — données de démonstration.
 *
 * Une seule vérité : les pleins sont ceux des fiches véhicules, et la cuve ne
 * réinvente rien. Ses sorties **sont** les pleins pris à la cuve — même numéro
 * PLN, une transaction, un numéro — et l'écran les reconstruit depuis les pleins
 * tels qu'ils sont (modifiés compris). Seules les livraisons et les relevés de
 * jauge sont propres au journal de la cuve (numéros CUV) ; les livraisons sont
 * dimensionnées sur les sorties du mois, les relevés recalent le stock d'un
 * petit écart, comme dans la réalité d'une cuve.
 * ==========================================================================*/

import { avecStock, estCuve, type ConsommationMensuelleFlotte, type LigneCuve, type LignePlein } from "@/domaine/carburant";
import { CATEGORIE_VEHICULE } from "@/domaine/libelles";
import { prixCuve } from "@/domaine/parametres";
import { formerNumero } from "@/domaine/reference";
import type { LigneFlotte } from "@/domaine/types";
import { fichePourImmatriculation, graine } from "./fiche-demo";
import { FLOTTE } from "./parc-demo";

/** Stock de la cuve à l'ouverture du journal ; en production, le report de l'exercice. */
export const STOCK_INITIAL = 9_000;

/*
 * Le prix du litre livré en citerne se lit **à la date de la livraison**, et
 * non au prix du jour : une citerne reçue en 2024 a été payée au tarif de 2024.
 * Valoriser tout l'historique au dernier barème gonflerait ou dégonflerait
 * deux ans de dépenses d'un coup.
 */

function porteur(l: LigneFlotte) {
  return {
    vehiculeId: l.vehicule.id,
    immatriculation: l.vehicule.immatriculation,
    immatriculationAffichee: l.vehicule.immatriculationAffichee,
    vehicule: `${l.vehicule.marque} ${l.vehicule.appellation}`,
    businessUnit: l.vehicule.businessUnit,
    site: l.site?.libelle ?? null,
  };
}

/* -- Pleins -------------------------------------------------------------------- */

let CACHE_PLEINS: LignePlein[] | null = null;

export function pleinsFlotte(): LignePlein[] {
  if (CACHE_PLEINS) return CACHE_PLEINS;
  const lignes: LignePlein[] = [];
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    for (const p of f.pleins) lignes.push({ ...p, ...porteur(l), creee: false });
  }
  lignes.sort((a, b) => b.date.localeCompare(a.date));
  CACHE_PLEINS = lignes;
  return lignes;
}

/** La sortie de cuve que représente un plein pris à la cuve : même numéro, mêmes litres. */
export function sortieDePlein(p: LignePlein): LigneCuve {
  return {
    numero: p.numero,
    date: p.date,
    sens: "sortie",
    libelle: `Plein ${p.immatriculationAffichee} — ${p.source}`,
    litres: p.litres,
    prixLitre: p.prixLitre,
    montant: p.montant,
    fournisseur: null,
    piece: p.reference,
    pleinNumero: p.numero,
    vehiculeId: p.vehiculeId,
    immatriculation: p.immatriculation,
    immatriculationAffichee: p.immatriculationAffichee,
    businessUnit: p.businessUnit,
    site: p.site,
    ecart: null,
    stockApres: 0,
    enregistrePar: "Responsable carburant",
    creee: p.creee,
  };
}

/* -- Cuve : livraisons et relevés de jauge ------------------------------------------ */

let CACHE_CUVE: LigneCuve[] | null = null;

/**
 * Les mouvements propres à la cuve : une livraison au début de chaque mois,
 * dimensionnée sur les sorties du mois arrondies au millier de litres ; un
 * relevé de jauge en fin de mois, à quelques dizaines de litres du théorique.
 * Les sorties ne sont pas ici : l'écran les reconstruit depuis les pleins.
 */
export function livraisonsEtJauges(): LigneCuve[] {
  if (CACHE_CUVE) return CACHE_CUVE;
  const sorties = pleinsFlotte().filter((p) => estCuve(p.source)).map(sortieDePlein);
  /* La cuve ne contient pas un mois de consommation : la citerne passe deux fois
     par mois, le 2 et le 16, et livre ce que la quinzaine va consommer, arrondi
     au demi-millier. */
  const parQuinzaine = new Map<string, number>();
  for (const s of sorties) {
    const cle = `${s.date.slice(0, 7)}-${Number(s.date.slice(8, 10)) <= 15 ? "02" : "16"}`;
    parQuinzaine.set(cle, (parQuinzaine.get(cle) ?? 0) + s.litres);
  }
  const parMois = new Set(sorties.map((s) => s.date.slice(0, 7)));

  const bruts: Omit<LigneCuve, "numero">[] = [];
  const vide = { pleinNumero: null, vehiculeId: null, immatriculation: null, immatriculationAffichee: null, businessUnit: null, site: null, ecart: null, stockApres: 0, creee: false };
  for (const [jour, total] of parQuinzaine) {
    const alea = graine(`cuve-${jour}`);
    const litres = Math.ceil(total / 500) * 500;
    bruts.push({
      ...vide,
      date: jour,
      sens: "livraison",
      libelle: `Livraison citerne — ${jour.slice(8, 10) === "02" ? "1re" : "2e"} quinzaine ${jour.slice(0, 7)}`,
      litres,
      prixLitre: prixCuve(jour),
      montant: litres * prixCuve(jour),
      fournisseur: "TotalEnergies Sénégal",
      piece: `BL-${jour.slice(0, 7).replace("-", "")}-${100 + Math.round(alea() * 800)}`,
      enregistrePar: "Responsable carburant",
    });
  }

  /* Le relevé de jauge : on ne le connaît qu'après avoir déroulé le stock. */
  const provisoire = avecStock([...bruts.map((b, i) => ({ ...b, numero: `tmp-${i}` })), ...sorties], STOCK_INITIAL);
  for (const mois of [...parMois].sort()) {
    const alea = graine(`jauge-${mois}`);
    const dernierJour = new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 0)).toISOString().slice(0, 10);
    /* Le journal est rendu du plus récent au plus ancien : le premier mouvement
       daté au plus tard du dernier jour du mois est le dernier de ce mois. */
    const dernier = provisoire.find((m) => m.date <= dernierJour);
    if (!dernier) continue;
    const theorique = dernier.stockApres;
    const releve = Math.round((theorique * (0.988 + alea() * 0.017)) / 10) * 10;
    bruts.push({
      ...vide,
      date: dernierJour,
      sens: "jauge",
      libelle: `Relevé de jauge — fin ${mois}`,
      litres: releve,
      prixLitre: null,
      montant: null,
      fournisseur: null,
      piece: null,
      enregistrePar: "Responsable carburant",
    });
  }

  bruts.sort((a, b) => a.date.localeCompare(b.date));
  const sequences = new Map<string, number>();
  const lignes: LigneCuve[] = bruts.map((b) => {
    const annee = b.date.slice(0, 4);
    const suivant = (sequences.get(annee) ?? 0) + 1;
    sequences.set(annee, suivant);
    return { ...b, numero: formerNumero("cuve", b.date, suivant) };
  });
  CACHE_CUVE = lignes;
  return lignes;
}

/* -- Consommation par véhicule et par mois --------------------------------------- */

let CACHE_CONSO: ConsommationMensuelleFlotte[] | null = null;

export function consommationsMensuelles(): ConsommationMensuelleFlotte[] {
  if (CACHE_CONSO) return CACHE_CONSO;
  const lignes: ConsommationMensuelleFlotte[] = [];
  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    for (const c of f.carburant) {
      lignes.push({ ...porteur(l), categorie: CATEGORIE_VEHICULE[l.vehicule.categorie], referenceL100: f.referenceL100, mois: c.mois, litres: c.litres, kmParcourus: c.kmParcourus, cout: c.cout });
    }
  }
  CACHE_CONSO = lignes;
  return lignes;
}
