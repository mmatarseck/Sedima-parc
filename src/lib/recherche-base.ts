import { idChauffeur } from "@/domaine/chauffeur";
import { afficher } from "@/domaine/immatriculation";
import { ETAPE_ACHAT } from "@/domaine/caisse";
import { POSTE_DEPENSE, TYPE_DOCUMENT } from "@/domaine/libelles";
import type { ResultatRecherche } from "@/domaine/recherche";
import { analyserNumero } from "@/domaine/reference";
import { date as formaterDate, montant as formaterMontant } from "@/lib/format";
import type { clientServeur } from "@/lib/supabase";

/* ============================================================================
 * La recherche globale, côté base : tout code, dans toute transaction.
 *
 * Demande du métier du 17 septembre 2026 : « rechercher tout code — numéro de
 * transaction, bon de commande, etc. — et élargir la recherche à toute
 * transaction ». Jusque-là, la barre ne connaissait que l'index de la
 * démonstration et ce que le navigateur venait de créer : en base branchée,
 * un numéro réel ne se trouvait pas.
 *
 * COMMENT. Une requête par table, toutes en parallèle, avec la session de
 * l'utilisateur — la base ne rend que ce que ses droits lui laissent voir.
 * Chaque table est fouillée sur ses colonnes de code : le numéro, la
 * référence du bon, le numéro Sage X3, la référence de facture, le numéro de
 * pièce, le numéro de série. Cinq résultats par table au plus : la barre
 * propose, elle ne liste pas.
 *
 * Un numéro tapé « dep 2026 15012 » se reconnaît et se cherche sous sa forme
 * canonique ; tout autre texte se cherche tel quel, comme un bout de code.
 *
 * L'ADRESSE MÈNE À LA LIGNE : sur la fiche du véhicule ou du chauffeur qui la
 * porte, l'onglet ouvert et la ligne soulignée (`?onglet=…&ref=…`) ; sur le
 * journal de caisse ou les achats ; sur la fiche du transporteur, du
 * prestataire, de la pièce, du poste budgétaire.
 * ==========================================================================*/

type Ligne = Record<string, unknown>;
type Client = Awaited<ReturnType<typeof clientServeur>>;

const PAR_TABLE = 5;

const texte = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x : x === null || x === undefined ? null : String(x));
const nombre = (x: unknown): number | null => (typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x)) ? Number(x) : null);

/** Le véhicule embarqué, tel que PostgREST le rend — objet ou tableau selon la relation. */
function vehiculeDe(l: Ligne, cle = "vehicule"): { immatriculation: string } | null {
  const v = l[cle];
  const o = Array.isArray(v) ? v[0] : v;
  return o && typeof o === "object" && "immatriculation" in o ? (o as { immatriculation: string }) : null;
}
function chauffeurDe(l: Ligne): { prenom: string; nom: string } | null {
  const c = l.chauffeur;
  const o = Array.isArray(c) ? c[0] : c;
  return o && typeof o === "object" && "nom" in o ? (o as { prenom: string; nom: string }) : null;
}
function prestataireDe(l: Ligne): { numero: string; raison_sociale: string } | null {
  const p = l.prestataire;
  const o = Array.isArray(p) ? p[0] : p;
  return o && typeof o === "object" && "numero" in o ? (o as { numero: string; raison_sociale: string }) : null;
}

/** L'adresse d'une ligne portée par un véhicule ou un chauffeur — onglet ouvert, ligne visée. */
function adresse(l: Ligne, numero: string, ongletVehicule: string, ongletChauffeur: string | null): string | null {
  const v = vehiculeDe(l);
  if (v) return `/flotte/${v.immatriculation}?onglet=${ongletVehicule}&ref=${encodeURIComponent(numero)}`;
  const c = chauffeurDe(l);
  if (c && ongletChauffeur) return `/chauffeurs/${idChauffeur(`${c.prenom} ${c.nom}`)}?onglet=${ongletChauffeur}&ref=${encodeURIComponent(numero)}`;
  return null;
}

const ou = (l: Ligne) => {
  const v = vehiculeDe(l);
  if (v) return afficher(v.immatriculation);
  const c = chauffeurDe(l);
  return c ? `${c.prenom} ${c.nom}` : null;
};

interface Fouille {
  table: string;
  /** Les colonnes de code où le terme se cherche. */
  codes: string[];
  select: string;
  vers: (l: Ligne) => ResultatRecherche | null;
}

const precision = (...parts: (string | null | undefined)[]) => parts.filter((p): p is string => Boolean(p)).join(" · ");

const FOUILLES: Fouille[] = [
  {
    table: "depense",
    codes: ["numero", "reference"],
    select: "numero, date, poste, libelle, montant, reference, vehicule (immatriculation), chauffeur (prenom, nom)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const href = adresse(l, numero, "autres", "frais");
      return href ? { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · Dépense · ${texte(l.libelle) ?? POSTE_DEPENSE[l.poste as keyof typeof POSTE_DEPENSE] ?? ""}`, precision: precision(formaterDate(texte(l.date)), ou(l), nombre(l.montant) !== null ? formaterMontant(nombre(l.montant)!) : null, texte(l.reference) ? `réf. ${texte(l.reference)}` : null), href } : null;
    },
  },
  {
    table: "plein",
    codes: ["numero", "reference"],
    select: "numero, date, montant, reference, vehicule (immatriculation)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const href = adresse(l, numero, "carburant", null);
      return href ? { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · Plein`, precision: precision(formaterDate(texte(l.date)), ou(l), nombre(l.montant) !== null ? formaterMontant(nombre(l.montant)!) : null), href } : null;
    },
  },
  {
    table: "intervention",
    codes: ["numero", "reference"],
    select: "numero, date, objet, montant, reference, vehicule (immatriculation)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const href = adresse(l, numero, "maintenance", null);
      return href ? { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · Intervention · ${texte(l.objet) ?? ""}`, precision: precision(formaterDate(texte(l.date)), ou(l), nombre(l.montant) !== null ? formaterMontant(nombre(l.montant)!) : null), href } : null;
    },
  },
  {
    table: "document",
    codes: ["numero", "numero_piece"],
    select: "numero, type_document_id, numero_piece, echeance, vehicule (immatriculation), chauffeur (prenom, nom)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const href = adresse(l, numero, "conformite", "documents");
      const type = texte(l.type_document_id) ?? "";
      return href ? { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · ${TYPE_DOCUMENT[type as keyof typeof TYPE_DOCUMENT] ?? type}`, precision: precision(ou(l), texte(l.numero_piece) ? `n° ${texte(l.numero_piece)}` : null, texte(l.echeance) ? `échéance ${formaterDate(texte(l.echeance))}` : null), href } : null;
    },
  },
  {
    table: "releve_kilometrique",
    codes: ["numero"],
    select: "numero, date, km, vehicule (immatriculation)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const href = adresse(l, numero, "kilometrage", null);
      return href ? { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · Relevé kilométrique`, precision: precision(formaterDate(texte(l.date)), ou(l), nombre(l.km) !== null ? `${nombre(l.km)} km` : null), href } : null;
    },
  },
  {
    table: "incident",
    codes: ["numero"],
    select: "numero, date_heure, type, vehicule (immatriculation), chauffeur (prenom, nom)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const href = adresse(l, numero, "incidents", "incidents");
      return href ? { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · Incident · ${texte(l.type) ?? ""}`, precision: precision(formaterDate(texte(l.date_heure)?.slice(0, 10) ?? null), ou(l)), href } : null;
    },
  },
  {
    table: "affectation",
    codes: ["numero"],
    select: "numero, debut, fin, role, vehicule (immatriculation), chauffeur (prenom, nom)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const href = adresse(l, numero, "affectations", "affectations");
      return href ? { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · Affectation`, precision: precision(ou(l), texte(l.debut) ? `depuis le ${formaterDate(texte(l.debut))}` : null), href } : null;
    },
  },
  {
    table: "visite_technique",
    codes: ["numero", "numero_pv"],
    select: "numero, centre, numero_pv, date_rendez_vous, vehicule (immatriculation)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const href = adresse(l, numero, "conformite", null);
      return href ? { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · Visite technique`, precision: precision(formaterDate(texte(l.date_rendez_vous)), ou(l), texte(l.centre), texte(l.numero_pv) ? `PV ${texte(l.numero_pv)}` : null), href } : null;
    },
  },
  {
    table: "rappel",
    codes: ["numero"],
    select: "numero, type_document_id, echeance, vehicule (immatriculation), chauffeur (prenom, nom)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const href = adresse(l, numero, "plan", "documents");
      const type = texte(l.type_document_id) ?? "";
      return href ? { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · Rappel · ${TYPE_DOCUMENT[type as keyof typeof TYPE_DOCUMENT] ?? type}`, precision: precision(ou(l), texte(l.echeance) ? `échéance ${formaterDate(texte(l.echeance))}` : null), href } : null;
    },
  },
  {
    table: "ordre_travail",
    codes: ["numero"],
    select: "numero, objet, statut, vehicule (immatriculation)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      return { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · Ordre de travail · ${texte(l.objet) ?? ""}`, precision: precision(ou(l), texte(l.statut)), href: `/maintenance?ref=${encodeURIComponent(numero)}` };
    },
  },
  {
    table: "indisponibilite",
    codes: ["numero"],
    select: "numero, motif, debut, chauffeur (prenom, nom)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const href = adresse(l, numero, "journal", "journal");
      return href ? { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · Indisponibilité · ${texte(l.motif) ?? ""}`, precision: precision(formaterDate(texte(l.debut)), ou(l)), href } : null;
    },
  },
  {
    table: "sanction",
    codes: ["numero"],
    select: "numero, type, date, chauffeur (prenom, nom)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const href = adresse(l, numero, "incidents", "incidents");
      return href ? { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · Sanction · ${texte(l.type) ?? ""}`, precision: precision(formaterDate(texte(l.date)), ou(l)), href } : null;
    },
  },
  {
    table: "demande_achat",
    codes: ["numero", "numero_bon_commande", "numero_demande_x3"],
    select: "numero, date, objet, fournisseur, etape, numero_bon_commande, numero_demande_x3, montant_engage, vehicule (immatriculation)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const etape = texte(l.etape) ?? "";
      return { cle: `a-${numero}`, categorie: "Achats & caisse", titre: `${numero} · Demande d'achat · ${texte(l.objet) ?? ""}`, precision: precision(formaterDate(texte(l.date)), texte(l.fournisseur), texte(l.numero_bon_commande) ? `BC ${texte(l.numero_bon_commande)}` : null, texte(l.numero_demande_x3) ? `DA X3 ${texte(l.numero_demande_x3)}` : null, ETAPE_ACHAT[etape as keyof typeof ETAPE_ACHAT] ?? etape, ou(l)), href: `/caisse?vue=achats&ref=${encodeURIComponent(numero)}` };
    },
  },
  {
    table: "mouvement_caisse",
    codes: ["numero"],
    select: "numero, date, libelle, montant",
    vers: (l) => {
      const numero = texte(l.numero)!;
      return { cle: `a-${numero}`, categorie: "Achats & caisse", titre: `${numero} · Caisse · ${texte(l.libelle) ?? ""}`, precision: precision(formaterDate(texte(l.date)), nombre(l.montant) !== null ? formaterMontant(nombre(l.montant)!) : null), href: `/caisse?vue=journal&ref=${encodeURIComponent(numero)}` };
    },
  },
  {
    table: "affretement",
    codes: ["numero", "numero_bon_commande", "numero_demande_x3", "reference_facture"],
    select: "numero, date, statut, reference_facture, numero_bon_commande, prestataire (numero, raison_sociale)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const p = prestataireDe(l);
      return { cle: `tr-${numero}`, categorie: "Transporteurs", titre: `${numero} · Affrètement${p ? ` · ${p.raison_sociale}` : ""}`, precision: precision(formaterDate(texte(l.date)), texte(l.statut), texte(l.reference_facture) ? `facture ${texte(l.reference_facture)}` : null, texte(l.numero_bon_commande) ? `BC ${texte(l.numero_bon_commande)}` : null), href: p ? `/transporteurs/${p.numero}` : "/transporteurs" };
    },
  },
  {
    table: "mise_a_disposition",
    codes: ["numero", "numero_demande_x3", "reference_facture"],
    select: "numero, mois, statut, reference_facture, prestataire (numero, raison_sociale)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const p = prestataireDe(l);
      return { cle: `tr-${numero}`, categorie: "Transporteurs", titre: `${numero} · Mise à disposition${p ? ` · ${p.raison_sociale}` : ""}`, precision: precision(texte(l.mois), texte(l.statut), texte(l.reference_facture) ? `facture ${texte(l.reference_facture)}` : null), href: p ? `/transporteurs/${p.numero}` : "/transporteurs" };
    },
  },
  {
    table: "prestation",
    codes: ["numero", "numero_demande_x3", "reference_facture"],
    select: "numero, date, libelle, statut, reference_facture, prestataire (numero, raison_sociale)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const p = prestataireDe(l);
      return { cle: `tr-${numero}`, categorie: "Transporteurs", titre: `${numero} · Prestation · ${texte(l.libelle) ?? ""}`, precision: precision(formaterDate(texte(l.date)), p?.raison_sociale, texte(l.statut), texte(l.reference_facture) ? `facture ${texte(l.reference_facture)}` : null), href: p ? `/transporteurs/${p.numero}` : "/transporteurs" };
    },
  },
  {
    table: "prestataire",
    codes: ["numero", "raison_sociale"],
    select: "numero, raison_sociale, type, ville",
    vers: (l) => {
      const numero = texte(l.numero)!;
      return { cle: `p-${numero}`, categorie: "Prestataires", titre: `${numero} · ${texte(l.raison_sociale) ?? ""}`, precision: precision(texte(l.type), texte(l.ville)), href: `/prestataires/${numero}` };
    },
  },
  {
    table: "piece",
    codes: ["numero", "reference", "reference_constructeur", "designation"],
    select: "numero, designation, reference, reference_constructeur, fournisseur",
    vers: (l) => {
      const numero = texte(l.numero)!;
      return { cle: `pc-${numero}`, categorie: "Pièces & pneus", titre: `${numero} · ${texte(l.designation) ?? ""}`, precision: precision(texte(l.reference) ? `réf. ${texte(l.reference)}` : null, texte(l.reference_constructeur) ? `constructeur ${texte(l.reference_constructeur)}` : null, texte(l.fournisseur)), href: `/pieces/${numero}` };
    },
  },
  {
    table: "pneu",
    codes: ["numero", "numero_serie"],
    select: "numero, numero_serie, piece (numero, designation), vehicule (immatriculation)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const p = l.piece as { numero: string; designation: string } | null;
      return { cle: `pc-${numero}`, categorie: "Pièces & pneus", titre: `${numero} · Pneu${p ? ` · ${p.designation}` : ""}`, precision: precision(texte(l.numero_serie) ? `série ${texte(l.numero_serie)}` : null, ou(l)), href: p ? `/pieces/${p.numero}` : "/pieces" };
    },
  },
  {
    table: "mouvement_stock",
    codes: ["numero"],
    select: "numero, date, piece (numero, designation), vehicule (immatriculation)",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const p = l.piece as { numero: string; designation: string } | null;
      return { cle: `pc-${numero}`, categorie: "Pièces & pneus", titre: `${numero} · Mouvement de stock${p ? ` · ${p.designation}` : ""}`, precision: precision(formaterDate(texte(l.date)), ou(l)), href: p ? `/pieces/${p.numero}` : "/pieces" };
    },
  },
  {
    table: "enveloppe",
    codes: ["numero"],
    select: "numero, exercice, poste, montant",
    vers: (l) => {
      const numero = texte(l.numero)!;
      const poste = texte(l.poste) ?? "";
      return { cle: `b-${numero}`, categorie: "Budget", titre: `${numero} · Enveloppe · ${POSTE_DEPENSE[poste as keyof typeof POSTE_DEPENSE] ?? poste}`, precision: precision(texte(l.exercice), nombre(l.montant) !== null ? formaterMontant(nombre(l.montant)!) : null), href: `/budget/${poste}` };
    },
  },
  {
    table: "licence_transport",
    codes: ["numero", "numero_piece"],
    select: "numero, libelle, numero_piece, echeance",
    vers: (l) => {
      const numero = texte(l.numero)!;
      return { cle: `t-${numero}`, categorie: "Transactions", titre: `${numero} · Licence de transport · ${texte(l.libelle) ?? ""}`, precision: precision(texte(l.numero_piece) ? `n° ${texte(l.numero_piece)}` : null, texte(l.echeance) ? `échéance ${formaterDate(texte(l.echeance))}` : null), href: "/conformite" };
    },
  },
];

export async function fouiller(client: Client, f: Fouille, motif: string): Promise<ResultatRecherche[]> {
  const lecture = await client
    .from(f.table)
    .select(f.select)
    .or(f.codes.map((c) => `${c}.ilike.${motif}`).join(","))
    .limit(PAR_TABLE);
  /* Une table absente, une colonne inconnue, un droit refusé : rien pour cette
     table, et les autres répondent quand même. */
  if (lecture.error || !lecture.data) return [];
  return (lecture.data as unknown as Ligne[]).map(f.vers).filter((r): r is ResultatRecherche => r !== null);
}


/** Tout code, dans toute transaction, avec le client qu'on lui donne — la session à l'écran, la clé de service au banc. */
export async function chercherCodesAvec(client: Client, terme: string): Promise<ResultatRecherche[]> {

  const t = terme.trim();
  if (t.length < 3) return [];
  /* « dep 2026 15012 » se cherche sous sa forme canonique ; le reste tel quel.
     Les jokers de PostgREST sont retirés : on cherche un code, pas un motif. */
  const canon = analyserNumero(t)?.numero ?? t;
  const motif = `%${canon.replace(/[%_,()]/g, "").replace(/\s+/g, "%")}%`;
  const lots = await Promise.all(FOUILLES.map((f) => fouiller(client, f, motif)));
  const vus = new Set<string>();
  const resultats: ResultatRecherche[] = [];
  for (const r of lots.flat()) {
    if (vus.has(r.cle)) continue;
    vus.add(r.cle);
    resultats.push(r);
  }
  return resultats;
}
