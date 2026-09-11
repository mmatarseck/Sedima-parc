/* ============================================================================
 * Fabrique `supabase/achats-parties/` — les demandes d'achat réelles.
 *
 * Demande du métier (11 septembre 2026) : « sur le dernier fichier Excel
 * partagé, on y trouve toutes les DA sur plusieurs mois. Préparer et charger ».
 *
 * LES SOURCES.
 *
 *   * **SEDIMA_Maintenance_Parc_Bons_de_commande.xlsx** — l'extraction des
 *     694 bons de commande du dossier DO, de novembre 2023 à septembre 2026.
 *     Chaque bon cite la DA interne qui l'a demandé (« DA17595 »,
 *     « DA200-2510034 ») : 645 DA distinctes sur les bons retenus.
 *   * **LES DEMANDES D'ACHAT PARC.xlsx** (SUIVI_PARC) — le registre tenu
 *     depuis septembre 2026 : six DA qui demandent le paiement de factures de
 *     transporteurs.
 *
 * UNE DEMANDE PAR BON. Le bon porte le montant, le fournisseur, la date et le
 * véhicule ; la DA n'en est que le numéro. Six DA ont donné deux bons : ce
 * sont deux demandes dans l'application, qui citent la même DA X3, et le
 * commentaire le dit.
 *
 * L'ÉTAPE. Un bon retenu dans les totaux est une dépense faite — c'est la règle
 * déjà appliquée aux bons de la maintenance et du transport
 * (`correctif-reglement-transport.sql`). La demande est donc **réglée**, sans
 * date de règlement : elle n'est pas connue. Sans cela, sept cents demandes de
 * 2023 à 2026 pèseraient sur le budget comme autant d'engagements en cours.
 * Les six DA du registre de septembre demandent le paiement d'une facture
 * reçue : elles sont **facturées**, et deviennent des dettes envers le
 * transporteur.
 *
 * LE RATTACHEMENT se fait en base, par le numéro du bon : l'intervention, la
 * dépense ou la prestation déjà chargées depuis le même bon deviennent
 * l'origine de la demande, et la dépense son coût. Les numéros de ces lignes
 * ne sont pas recopiés d'ici — les chargements ont été régénérés depuis leur
 * premier passage, et seule la base sait lesquels elle porte.
 *
 * Lancer : npx tsx scripts/charger-demandes-achat.mts
 * ==========================================================================*/

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { cleFournisseur, nomPropre } from "./noms-fournisseurs.mts";
import { normaliser } from "../src/domaine/immatriculation";

const DO = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/";
const CLASSEUR = DO + "62. Transport & Flotte Automobile/61. Gestion Parc/Maintenance/SEDIMA_Maintenance_Parc_Bons_de_commande.xlsx";
const REGISTRE = DO + "61. Gestion Parc/SUIVI_PARC/LES DEMANDES D'ACHAT PARC.xlsx";
const projet = process.cwd();

const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());
const entier = (c: Cellule): number | null => {
  if (c === null || c === undefined || texte(c) === "" || texte(c) === "-") return null;
  const n = typeof c === "number" ? c : Number(texte(c).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
};
const echappe = (s: string) => s.replace(/'/g, "''");
const sql = (v: string | number | null) => (v === null || v === "" ? "null" : typeof v === "number" ? String(v) : `'${echappe(v)}'`);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Le poste de la demande, par catégorie du classeur — celui des chargements pour les catégories qu'ils ont prises. */
const POSTES: Record<string, string> = {
  Entretien: "maintenance-preventive",
  "Vidange & lubrifiants": "maintenance-preventive",
  Réparation: "maintenance-curative",
  "Carrosserie & peinture": "maintenance-curative",
  "Main d'œuvre": "maintenance-curative",
  "Remorquage & assistance": "maintenance-curative",
  "Pièces détachées": "pieces",
  Batterie: "pieces",
  "Outillage & petit matériel": "pieces",
  Pneumatiques: "pneumatiques",
  Assurance: "assurance",
  "Visite technique & mutation": "conformite",
  "Taxes & licences": "conformite",
  "Frais de mission & péage": "frais-de-route",
  Carburant: "carburant",
  "Location véhicule": "divers",
  "Transport / prestation": "divers",
  "Acquisition véhicule": "divers",
  "Branding & signalétique": "divers",
  Lavage: "divers",
};

/* -- 1. Les bons de commande ------------------------------------------------ */

const feuille = lireClasseur(CLASSEUR).find((f) => f.nom === "Commandes")!;
const entete = feuille.lignes[0]!.map(texte);
const col = (nom: string) => {
  const i = entete.indexOf(nom);
  if (i < 0) throw new Error(`colonne « ${nom} » absente`);
  return i;
};
const c = {
  bon: col("N° commande"), emission: col("Date émission"), validation: col("Date validation"), da: col("N° D.A interne"), service: col("Service demandeur"),
  fournisseur: col("Fournisseur (normalisé)"), objet: col("Objet / Remarques D.A"), immat: col("Immatriculation"), nbVehicules: col("Nb véhicules"),
  famille: col("Famille de dépense"), categorie: col("Catégorie de dépense"), designations: col("Désignations"), ht: col("Montant HT"), ttc: col("Montant TTC"),
  devise: col("Devise"), livraisonPrevue: col("Date livraison prévue"), responsable: col("Responsable"), doublon: col("Doublon"), retenu: col("Retenu pour totaux"), statut: col("Statut extraction"),
};

interface Demande {
  bon: string;
  date: string;
  validation: string | null;
  da: string | null;
  objet: string;
  categorie: string;
  famille: string;
  poste: string;
  montant: number;
  fournisseur: string;
  immatriculation: string | null;
  demandeur: string | null;
  notes: string[];
}

const demandes: Demande[] = [];
const ecartes: Record<string, number> = {};
const ecarte = (raison: string) => (ecartes[raison] = (ecartes[raison] ?? 0) + 1);

for (const l of feuille.lignes.slice(1)) {
  const bon = texte(l[c.bon]);
  if (!bon) continue;
  const statut = texte(l[c.statut]);
  if (texte(l[c.retenu]) === "Non") { ecarte("doublon d'un bon déjà retenu (« Retenu pour totaux = Non »)"); continue; }
  if (statut.startsWith("Hors gabarit")) { ecarte("document hors gabarit : pas un bon de commande SEDIMA"); continue; }
  if (texte(l[c.devise]) !== "XOF") { ecarte("bon libellé en euros"); continue; }
  const date = texte(l[c.emission]);
  if (!DATE.test(date)) { ecarte("date d'émission illisible"); continue; }
  const montant = entier(l[c.ttc]) ?? entier(l[c.ht]);
  if (montant === null || montant <= 0) { ecarte("montant absent"); continue; }
  const categorie = texte(l[c.categorie]);
  const poste = POSTES[categorie];
  if (!poste) throw new Error(`catégorie « ${categorie} » sans poste`);
  const immat = normaliser(texte(l[c.immat]));
  const objetBrut = texte(l[c.objet]) || texte(l[c.designations]) || categorie;
  const responsable = texte(l[c.responsable]);
  const notes: string[] = [];
  const nb = entier(l[c.nbVehicules]) ?? 0;
  if (nb > 1) notes.push(`Bon couvrant ${nb} véhicules, rattaché au premier comme dans l'extraction.`);
  if (statut.includes("Scan OCR")) notes.push("Montant lu par reconnaissance optique : à vérifier sur le bon.");
  if (statut.includes("Écart lignes/total")) notes.push("La somme des lignes du bon ne fait pas son total.");
  if (!texte(l[c.da])) notes.push("Le bon ne cite pas de DA.");
  const prevue = texte(l[c.livraisonPrevue]);
  if (DATE.test(prevue)) notes.push(`Livraison prévue au bon le ${prevue.split("-").reverse().join("/")}.`);
  const validation = texte(l[c.validation]);
  demandes.push({
    bon,
    date,
    validation: DATE.test(validation) ? validation : null,
    da: texte(l[c.da]) || null,
    objet: objetBrut.length > 200 ? `${objetBrut.slice(0, 199)}…` : objetBrut,
    categorie,
    famille: texte(l[c.famille]),
    poste,
    montant,
    fournisseur: nomPropre(texte(l[c.fournisseur])) || "Fournisseur non nommé",
    immatriculation: /^[A-Z]{2}\d{3,4}[A-Z]{1,2}$/.test(immat) ? immat : null,
    demandeur: responsable && responsable !== "réception" ? nomPropre(responsable) : texte(l[c.service]) ? `Service ${texte(l[c.service]).toLowerCase()}` : null,
    notes,
  });
}
demandes.sort((a, b) => a.date.localeCompare(b.date) || a.bon.localeCompare(b.bon));

const bonsParDa = new Map<string, string[]>();
for (const d of demandes) if (d.da) bonsParDa.set(d.da, [...(bonsParDa.get(d.da) ?? []), d.bon]);
for (const d of demandes) {
  const autres = (d.da ? bonsParDa.get(d.da)! : []).filter((b) => b !== d.bon);
  if (autres.length) d.notes.unshift(`La DA ${d.da} a aussi donné le bon ${autres.join(", ")}.`);
}

/* -- 2. Le registre de septembre -------------------------------------------- */

interface Facture {
  da: string;
  date: string;
  fournisseur: string;
  prestataire: string | null;
  objet: string;
  ht: number;
  document: string;
  notes: string[];
}

/** Les transporteurs du registre, par leur numéro au référentiel. « DEM » en a trois possibles : il reste en clair. */
const PRESTATAIRES: Record<string, { numero: string | null; nom: string }> = {
  "MOUHAMED SY": { numero: "PRE-2026-00029", nom: "Mouhamed Sy" },
  "DAME NDOYE": { numero: "PRE-2026-00030", nom: "Dame Ndoye" },
  DEM: { numero: null, nom: "Mouhamed Deme" },
  "DR WADE": { numero: "PRE-2026-00027", nom: "Dr Wade Transport" },
  K2SBT: { numero: "PRE-2026-00031", nom: "K2SBT" },
  "WAKEUR S. FALLOU": { numero: "PRE-2026-80007", nom: "Wakeur Serigne Fallou" },
};

const registre = lireClasseur(REGISTRE).find((f) => f.nom === "DEMANDE ACHAT")!;
const r0 = registre.lignes.findIndex((l) => l.map(texte).includes("NUMERO DA"));
const er = registre.lignes[r0]!.map(texte);
const rc = (nom: string) => er.indexOf(nom);
const factures: Facture[] = [];
for (const l of registre.lignes.slice(r0 + 1)) {
  const da = texte(l[rc("NUMERO DA")]);
  if (!da) continue;
  const brut = texte(l[rc("FOURNISSEUR")]);
  const p = PRESTATAIRES[brut];
  if (!p) throw new Error(`fournisseur du registre inconnu : ${brut}`);
  const ht = entier(l[rc("TOTAL HT")]);
  if (ht === null) throw new Error(`${da} : montant HT absent`);
  let date = texte(l[rc("DATE")]);
  const notes = [`Registre des DA du parc : HT ${texte(l[rc("TOTAL HT")])}, TVA ${texte(l[rc("TVA")]) || "—"}, TTC ${texte(l[rc("TOTAL TTC")])} (le registre retranche la colonne TVA du HT).`];
  /* Le numéro X3 porte l'année et le mois : DA200-2609134 est de septembre 2026. */
  const m = /^DA\d+-(\d{2})(\d{2})/.exec(da);
  if (m && DATE.test(date) && date.slice(2, 7) !== `${m[1]}-${m[2]}`) {
    const corrigee = `20${m[1]}-${m[2]}-${date.slice(8, 10)}`;
    notes.push(`Date écrite ${date.split("-").reverse().join("/")} au registre ; le numéro de la DA la place en ${m[2]}/20${m[1]}.`);
    date = corrigee;
  }
  if (!p.numero) notes.push("« DEM » : trois fiches possibles au référentiel (Dème Transport, Mohamed Deme, Mouhamed Deme) ; le fournisseur reste en clair.");
  factures.push({ da, date, fournisseur: p.nom, prestataire: p.numero, objet: texte(l[rc("DESCRIPTION")]), ht, document: texte(l[rc("DOCUMENT")]), notes });
}

/* -- 3. Les fichiers -------------------------------------------------------- */

const dossier = join(projet, "supabase/achats-parties");
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });

const CHARGEE = "Chargée le 11 septembre 2026 depuis l'extraction des bons de commande du dossier DO. Réglée : un bon retenu dans les totaux est une dépense faite ; la date de règlement n'est pas connue.";
const valeurBon = (d: Demande, i: number) =>
  `  ('DAC-R-${String(i + 1).padStart(5, "0")}', '${d.date}', ${sql(d.objet)}, '${d.poste}', ${d.montant}, ${sql(d.fournisseur)}, '${cleFournisseur(d.fournisseur)}', ${sql(d.immatriculation)}, ${sql(d.demandeur)}, ${sql(d.validation)}, ${sql(d.da)}, ${sql(d.bon)}, ${sql(`${d.categorie} · ${d.famille}`)}, ${sql([CHARGEE, ...d.notes].join(" "))})`;

const total = demandes.reduce((s, d) => s + d.montant, 0);
writeFileSync(
  join(dossier, "achats-01-bons-de-commande.sql"),
  `-- ============================================================================
-- SEDIMA Parc — les demandes d'achat réelles : les bons de commande.
--
-- **Ce n'est pas une migration.** ${demandes.length} demandes, une par bon de commande
-- retenu, du ${demandes[0]!.date} au ${demandes.at(-1)!.date}, pour ${Math.round(total / 1e6)} M F. Source :
-- SEDIMA_Maintenance_Parc_Bons_de_commande.xlsx. Voir docs/ACHATS-REELS.md.
--
-- Chaque demande est réglée, sans date de règlement. Elle cite en origine
-- l'intervention, la prestation ou la dépense chargées depuis le même bon —
-- retrouvées ici, en base, par le numéro du bon — et à défaut le bon lui-même.
--
-- À jouer après les chargements de la maintenance et du transport.
-- REJOUABLE : \`on conflict do nothing\`.
-- ============================================================================

insert into demande_achat (numero, date, objet, poste, montant_estime, prestataire_id, fournisseur, urgence, origine_numero, origine_libelle, vehicule_id, demandeur_nom, etape, validee_le, numero_demande_x3, numero_bon_commande, montant_engage, depense_numero, commentaire_decision)
select v.numero, v.date::date, v.objet, coalesce(dep.poste, v.poste::poste_depense), v.montant::bigint,
       coalesce(itv.prestataire_id, dep.prestataire_id, prs.prestataire_id, pr.id), v.fournisseur, 'normale',
       coalesce(itv.numero, prs.numero, dep.numero, v.bon),
       'Bon de commande ' || v.bon || ' — ' || v.categorie,
       coalesce(ve.id, itv.vehicule_id, dep.vehicule_id), v.demandeur, 'reglee', v.validee_le::date, v.da, v.bon, v.montant::bigint, dep.numero, v.commentaire
  from (values
${demandes.map(valeurBon).join(",\n")}
  ) as v(numero, date, objet, poste, montant, fournisseur, cle_fournisseur, immatriculation, demandeur, validee_le, da, bon, categorie, commentaire)
  left join vehicule ve on ve.immatriculation = v.immatriculation
  left join lateral (select i.numero, i.prestataire_id, i.vehicule_id from intervention i where split_part(i.reference, ' · ', 1) = v.bon order by i.numero limit 1) itv on true
  left join lateral (select d.numero, d.poste, d.prestataire_id, d.vehicule_id from depense d where split_part(d.reference, ' · ', 1) = v.bon order by d.numero limit 1) dep on true
  left join lateral (select p.numero, p.prestataire_id from prestation p where position('Bon de commande ' || v.bon || '.' in coalesce(p.commentaire, '')) > 0 order by p.numero limit 1) prs on true
  left join lateral (select x.id from prestataire x where upper(regexp_replace(x.raison_sociale, '[^A-Za-z0-9]', '', 'g')) = v.cle_fournisseur order by x.numero limit 1) pr on true
on conflict (numero) do nothing;

-- ---------------------------------------------------------------------------
-- Vérification : combien de demandes ont retrouvé leur ligne d'origine.
-- ---------------------------------------------------------------------------

select case when origine_numero like 'INT-%' then 'intervention' when origine_numero like 'PRS-%' then 'prestation' when origine_numero like 'DEP-%' then 'dépense' else 'le bon lui-même' end as origine,
       count(*) as demandes, count(depense_numero) as avec_depense, count(vehicule_id) as avec_vehicule, count(prestataire_id) as avec_prestataire, sum(montant_engage) as montant
  from demande_achat where numero like 'DAC-R-0%' group by 1 order by 2 desc;
`,
);

const valeurFacture = (f: Facture, i: number) =>
  `  ('DAC-R-${String(90001 + i)}', '${f.date}', ${sql(f.objet)}, ${f.ht}, ${sql(f.prestataire)}, ${sql(f.fournisseur)}, ${sql(f.da)}, ${sql(f.document)}, ${sql(["Chargée le 11 septembre 2026 depuis le registre des DA du parc (SUIVI_PARC).", ...f.notes].join(" "))})`;
writeFileSync(
  join(dossier, "achats-02-registre-septembre.sql"),
  `-- ============================================================================
-- SEDIMA Parc — les demandes d'achat réelles : le registre de septembre 2026.
--
-- **Ce n'est pas une migration.** ${factures.length} DA qui demandent le paiement d'une facture
-- de transporteur. Source : LES DEMANDES D'ACHAT PARC.xlsx (SUIVI_PARC).
--
-- La facture est reçue : la demande est **facturée**, pour son montant hors
-- taxe, et devient une dette envers le transporteur. L'origine est la DA X3
-- elle-même : aucune transaction de l'application ne porte encore ces factures.
--
-- REJOUABLE : \`on conflict do nothing\`.
-- ============================================================================

insert into demande_achat (numero, date, objet, poste, montant_estime, prestataire_id, fournisseur, urgence, origine_numero, origine_libelle, demandeur_nom, etape, numero_demande_x3, montant_engage, montant_reel, commentaire_decision)
select v.numero, v.date::date, v.objet, 'divers', v.ht::bigint, p.id, v.fournisseur, 'normale', v.da, v.document, 'Gestion parc', 'facturee', v.da, v.ht::bigint, v.ht::bigint, v.commentaire
  from (values
${factures.map(valeurFacture).join(",\n")}
  ) as v(numero, date, objet, ht, prestataire_numero, fournisseur, da, document, commentaire)
  left join prestataire p on p.numero = v.prestataire_numero
on conflict (numero) do nothing;
`,
);

/* -- 4. Le compte rendu ----------------------------------------------------- */

const somme = (f: (d: Demande) => boolean) => demandes.filter(f).reduce((s, d) => s + d.montant, 0);
console.log(`${demandes.length} demandes (bons), du ${demandes[0]!.date} au ${demandes.at(-1)!.date}, ${Math.round(total / 1e6)} M F TTC`);
console.log(`DA distinctes : ${bonsParDa.size} ; DA sur plusieurs bons : ${[...bonsParDa.values()].filter((b) => b.length > 1).length} ; bons sans DA : ${demandes.filter((d) => !d.da).length}`);
console.log(`avec véhicule lisible : ${demandes.filter((d) => d.immatriculation).length}`);
for (const f of [...new Set(demandes.map((d) => d.famille))]) console.log(`  ${f.padEnd(28)} ${String(demandes.filter((d) => d.famille === f).length).padStart(4)} bons ${String(Math.round(somme((d) => d.famille === f) / 1e6)).padStart(5)} M F`);
for (const a of [...new Set(demandes.map((d) => d.date.slice(0, 4)))]) console.log(`  ${a} ${String(demandes.filter((d) => d.date.startsWith(a)).length).padStart(4)} bons ${String(Math.round(somme((d) => d.date.startsWith(a)) / 1e6)).padStart(5)} M F`);
console.log("écartés :", ecartes);
console.log(`registre de septembre : ${factures.length} DA, ${factures.reduce((s, f) => s + f.ht, 0)} F HT`);
for (const f of factures) console.log(`  ${f.da} ${f.date} ${f.fournisseur.padEnd(24)} ${String(f.ht).padStart(9)}  ${f.notes.slice(1).join(" ")}`);
