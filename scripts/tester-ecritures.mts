/* Vérifie que les lignes formées par transactions-colonnes.ts entrent dans les
 * tables de la base : migrations rejouées dans PGlite, une création par type
 * insérée avec un rattachement réel du seed, puis une modification.
 * Lancer : npx tsx scripts/tester-ecritures.mts (PGlite pris dans le bac à sable). */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { cleDe, colonnesModification, ligneCreation, tableDe } from "../src/lib/transactions-colonnes";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");

const projet = process.cwd();
const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  insert into auth.users values ('00000000-0000-0000-0000-000000000001');
  create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;`);
for (const m of readdirSync(join(projet, "supabase/migrations")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) {
    courant.push(ligne);
    if (/^on conflict .*;$/.test(ligne.trim())) { try { await pg.exec(courant.join("\n")); } catch {} courant = []; }
  }
}

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => { console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`); if (!ok) echecs++; };
const v = (await pg.query(`select id, immatriculation from vehicule where immatriculation = 'AA032EA'`)).rows[0] as { id: string; immatriculation: string };
const c = (await pg.query(`select id from chauffeur order by nom limit 1`)).rows[0] as { id: string };
const r = { vehiculeId: v.id, chauffeurId: c.id, prestataireId: null };
const utilisateur = "00000000-0000-0000-0000-000000000001";

async function inserer(table: string, ligne: Record<string, unknown>) {
  const cles = Object.keys(ligne);
  await pg.query(`insert into ${table} (${cles.join(", ")}, cree_par) values (${cles.map((_, i) => `$${i + 1}`).join(", ")}, $${cles.length + 1})`, [...cles.map((k) => ligne[k]), utilisateur]);
}

const essais: { type: Parameters<typeof ligneCreation>[0]; numero: string; valeurs: Record<string, unknown> }[] = [
  { type: "releve", numero: "REL-2026-90001", valeurs: { date: "2026-09-08", valeur: "344 120", source: "Téléphone" } },
  { type: "plein", numero: "PLN-2026-90001", valeurs: { date: "2026-09-08", litres: 62.5, montant: 39375, source: "Station Total", km: 344120, photo: "pieces/pieces/2026/09/ticket.jpg" } },
  { type: "depense", numero: "DEP-2026-90001", valeurs: { date: "2026-09-08", poste: "pneumatiques", origine: "caisse", libelle: "Deux pneus avant", montant: 240000, photo: "pieces/pieces/2026/09/facture.jpg" } },
  { type: "document", numero: "DOC-2026-90001", valeurs: { type: "assurance", dateEffet: "2026-09-01", echeance: "2027-08-31", emetteur: "AXA", numeroPiece: "POL-1" } },
  { type: "incident", numero: "INC-2026-90001", valeurs: { dateHeure: "2026-09-08T08:00", nature: "incident", type: "panne", lieu: "Thiès", roulant: "non", statut: "declare" } },
  { type: "intervention", numero: "INT-2026-90001", valeurs: { date: "2026-09-08", type: "curatif", objet: "Plaquettes", garage: "Garage SEDIMA", montant: 85000, immobilisationJours: 1 } },
  { type: "indisponibilite", numero: "IND-2026-90001", valeurs: { motif: "conge", debut: "2026-09-10", fin: "2026-09-20" } },
  { type: "sanction", numero: "SAN-2026-90001", valeurs: { date: "2026-09-08", type: "avertissement", motif: "Retard répété" } },
  { type: "caisse", numero: "CAI-2026-90001", valeurs: { date: "2026-09-08", libelle: "Approvisionnement de la caisse parc", montant: "750 000", beneficiaire: "Trésorerie SEDIMA", piece: "BQ-1", justificatif: "oui" } },
  { type: "caisse", numero: "CAI-2026-90002", valeurs: { date: "2026-09-08", libelle: "Deux pneus avant", montant: 240000, depenseNumero: "DEP-2026-90001", justificatif: "oui" } },
  { type: "cuve", numero: "CUV-2026-90001", valeurs: { date: "2026-09-08", libelle: "Livraison citerne", litres: 5000, prixLitre: 655, fournisseur: "TotalEnergies Sénégal", piece: "BL-1" } },
  { type: "cuve", numero: "CUV-2026-90002", valeurs: { date: "2026-09-08", litres: 7420.5 } },
  { type: "visite", numero: "VTE-2026-90001", valeurs: { type: "visite", centre: "CCVA Rufisque", dateRendezVous: "2026-09-15", heure: "08:30" } },
  { type: "observation", numero: "OBS-2026-90001", valeurs: { visiteId: "VTE-2026-90001", libelle: "Feu stop droit hors service", categorie: "eclairage", gravite: "mineure", statut: "a-traiter" } },
  { type: "achat", numero: "DAC-2026-90001", valeurs: { date: "2026-09-08", objet: "Deux pneus avant", poste: "pneumatiques", montantEstime: "240 000", urgence: "urgente", origineNumero: "INT-2026-90001", demandeur: "Service parc", demandeurRole: "gestionnaire-parc" } },
  { type: "ordre", numero: "OT-2026-90001", valeurs: { type: "curatif", objet: "Remplacement des plaquettes", garage: "Garage SEDIMA", datePrevue: "2026-09-12", immobilisationPrevueJours: 1, montantEstime: 85000, demandeur: "Service parc" } },
];
for (const e of essais) {
  const table = tableDe(e.type)!;
  const prep = ligneCreation(e.type, e.numero, e.valeurs, r);
  if ("refus" in prep) { attendu(`${e.type} : ${prep.refus}`, false); continue; }
  try {
    await inserer(table, prep.ligne);
    const n = (await pg.query(`select count(*)::int as n from ${table} where numero = $1`, [e.numero])).rows[0] as { n: number };
    attendu(`${e.type} → ${table} (${e.numero})`, n.n === 1);
  } catch (x) {
    attendu(`${e.type} → ${table} : ${(x as Error).message}`, false);
  }
}
/* L'affectation : un titulaire est déjà en cours sur ce véhicule, on affecte un suppléant. */
const aff = ligneCreation("affectation", "AFF-2026-90001", { role: "suppleant", debut: "2026-09-08", motif: "Test" }, r);
if ("ligne" in aff) { try { await inserer("affectation", aff.ligne); attendu("affectation → affectation", true); } catch (x) { attendu(`affectation : ${(x as Error).message}`, false); } }

/* Une modification : la dépense change de montant, la trace s'écrit. */
const colonnes = colonnesModification("depense", [{ champ: "montant", valeur: "255 000" }, { champ: "justificatif", valeur: "non" }]);
await pg.query(`update depense set montant = $1, justificatif = $2 where numero = 'DEP-2026-90001'`, [colonnes.montant, colonnes.justificatif]);
await pg.query(`insert into modification (table_cible, numero, champ, libelle_champ, avant, apres, motif, cree_par) values ('depense', 'DEP-2026-90001', 'montant', 'Montant', '240 000 F', '255 000 F', 'Facture définitive', $1)`, [utilisateur]);
const d = (await pg.query(`select montant, justificatif from depense where numero = 'DEP-2026-90001'`)).rows[0] as { montant: string; justificatif: boolean };
attendu(`modification appliquée (montant ${d.montant}, justificatif ${d.justificatif})`, Number(d.montant) === 255000 && d.justificatif === false);
const refus = ligneCreation("plein", "PLN-2026-90002", { date: "2026-09-08", montant: 1000 }, r);
attendu(`un plein sans litres est refusé (${"refus" in refus ? refus.refus : "accepté"})`, "refus" in refus);
attendu(`un ordre a sa table (${tableDe("ordre")})`, tableDe("ordre") === "ordre_travail");
const ot = (await pg.query(`select statut, garage, demandeur_nom from ordre_travail where numero = 'OT-2026-90001'`)).rows[0] as { statut: string; garage: string; demandeur_nom: string };
attendu(`l'ordre est planifié chez ${ot.garage}, demandé par ${ot.demandeur_nom}`, ot.statut === "planifie" && ot.garage === "Garage SEDIMA" && ot.demandeur_nom === "Service parc");
const cai = (await pg.query(`select sens, depense_numero, enregistre_par from mouvement_caisse where numero = 'CAI-2026-90002'`)).rows[0] as { sens: string; depense_numero: string; enregistre_par: string | null };
attendu(`la sortie de caisse cite sa dépense (${cai.sens}, ${cai.depense_numero})`, cai.sens === "sortie" && cai.depense_numero === "DEP-2026-90001");
const cuv = (await pg.query(`select sens, litres, montant, fournisseur from mouvement_cuve where numero in ('CUV-2026-90001', 'CUV-2026-90002') order by numero`)).rows as { sens: string; litres: string; montant: string | null; fournisseur: string | null }[];
attendu(`la livraison vaut ${cuv[0]?.montant} F chez ${cuv[0]?.fournisseur}, la jauge lit ${cuv[1]?.litres} l`, cuv[0]?.sens === "livraison" && Number(cuv[0]?.montant) === 3275000 && cuv[0]?.fournisseur === "TotalEnergies Sénégal" && cuv[1]?.sens === "jauge" && Number(cuv[1]?.litres) === 7420.5);
/* Une décision sur la demande : le visa du parc, avec le montant engagé du bon — une modification, colonne par colonne. */
const decision = colonnesModification("achat", [{ champ: "etape", valeur: "visee" }, { champ: "visaPar", valeur: "M. Seck" }, { champ: "visaLe", valeur: "2026-09-08" }, { champ: "montantEngage", valeur: "250 000" }]);
await pg.query(`update demande_achat set etape = $1, visa_par = $2, visa_le = $3, montant_engage = $4 where numero = 'DAC-2026-90001'`, [decision.etape, decision.visa_par, decision.visa_le, decision.montant_engage]);
const dac = (await pg.query(`select etape, visa_par, montant_engage, origine_numero, demandeur_role from demande_achat where numero = 'DAC-2026-90001'`)).rows[0] as { etape: string; visa_par: string; montant_engage: string; origine_numero: string; demandeur_role: string };
attendu(`la demande d'achat est visée par ${dac.visa_par}, ${dac.montant_engage} F engagés, origine ${dac.origine_numero}, rôle ${dac.demandeur_role}`, dac.etape === "visee" && Number(dac.montant_engage) === 250000 && dac.origine_numero === "INT-2026-90001" && dac.demandeur_role === "gestionnaire-parc");
const sansOrigine = ligneCreation("achat", "DAC-2026-90002", { date: "2026-09-08", objet: "Filtres", montantEstime: 30000 }, r);
attendu(`une demande sans transaction d'origine est refusée (${"refus" in sansOrigine ? sansOrigine.refus : "acceptée"})`, "refus" in sansOrigine);
const obs = (await pg.query(`select o.visite_numero, o.statut, t.centre, t.statut as visite from observation_visite o join visite_technique t on t.numero = o.visite_numero where o.numero = 'OBS-2026-90001'`)).rows[0] as { visite_numero: string; statut: string; centre: string; visite: string };
attendu(`l'observation cite sa visite (${obs?.visite_numero}, ${obs?.centre}, ${obs?.visite}) et attend (${obs?.statut})`, obs?.visite_numero === "VTE-2026-90001" && obs?.visite === "rendez-vous" && obs?.statut === "a-traiter");
const sansVisite = ligneCreation("observation", "OBS-2026-90002", { libelle: "Pneu usé" }, r);
attendu(`une observation sans visite est refusée (${"refus" in sansVisite ? sansVisite.refus : "acceptée"})`, "refus" in sansVisite);
attendu(`un type sans table le dit (${tableDe("prestataire")})`, tableDe("prestataire") === null);

/* -- La fiche véhicule elle-même (14 septembre 2026) ------------------------- */
/* Elle se crée et se modifie comme une transaction, mais sa clé est son
   immatriculation : c'est ce que `cleDe` dit, et c'est ce qui permet de
   corriger une plaque sans détacher ce qui pend au véhicule. */

attendu(`le véhicule a sa table (${tableDe("vehicule")})`, tableDe("vehicule") === "vehicule");
attendu("un véhicule se repère par sa plaque, les autres par leur numéro", cleDe("vehicule", "VEH-AB-060-KT").colonne === "immatriculation" && cleDe("vehicule", "VEH-AB-060-KT").valeur === "AB060KT" && cleDe("depense", "DEP-2026-90001").valeur === "DEP-2026-90001");

/* Le fournisseur (0048) : le lien vers le référentiel est résolu par le serveur
   et arrive dans le rattachement, le nom en clair vient de la saisie. */
const vendeur = (await pg.query(`select id, raison_sociale from prestataire order by raison_sociale limit 1`)).rows[0] as { id: string; raison_sociale: string };
const neuf = ligneCreation("vehicule", "VEH-2026-90001", { immatriculation: "DK-9911-ZZ", marque: "Tata", appellation: "LPT 1618", categorie: "camion", categorieFlotte: "interne", usage: "vrac", energie: "gasoil", statut: "en-service", ptac: "16 000", valeurAcquisition: 28500000, engage: true, fournisseur: vendeur.raison_sociale }, { ...r, prestataireId: vendeur.id });
if ("refus" in neuf) attendu(`création d'un véhicule : ${neuf.refus}`, false);
else {
  await inserer("vehicule", neuf.ligne);
  const n = (await pg.query(`select immatriculation, marque, categorie, ptac, valeur_acquisition, engage, fournisseur, fournisseur_id from vehicule where immatriculation = 'DK9911ZZ'`)).rows[0] as { immatriculation: string; marque: string; categorie: string; ptac: number; valeur_acquisition: string; engage: boolean; fournisseur: string; fournisseur_id: string };
  attendu(`véhicule → vehicule (${n?.immatriculation}, ${n?.marque}, PTAC ${n?.ptac})`, n?.immatriculation === "DK9911ZZ" && n?.marque === "Tata" && n.ptac === 16000 && Number(n.valeur_acquisition) === 28500000 && n.engage === true);
  attendu(`il dit chez qui il a été acheté (${n?.fournisseur}), et le lien tient`, n?.fournisseur === vendeur.raison_sociale && n.fournisseur_id === vendeur.id);
}
/* Un vendeur hors référentiel se garde quand même, sans lien : c'est tout
   l'objet des deux colonnes. */
const horsReferentiel = ligneCreation("vehicule", "VEH-2026-90006", { immatriculation: "DK-3333-CC", marque: "Tata", appellation: "LPT 1618", categorie: "camion", fournisseur: "Garage du coin" }, { ...r, prestataireId: null });
attendu("un fournisseur hors référentiel garde son nom, sans lien", "ligne" in horsReferentiel && horsReferentiel.ligne.fournisseur === "Garage du coin" && horsReferentiel.ligne.fournisseur_id === null);
const sansPlaque = ligneCreation("vehicule", "VEH-2026-90002", { marque: "Tata", appellation: "LPT 1618", categorie: "camion" }, r);
attendu(`un véhicule sans immatriculation est refusé (${"refus" in sansPlaque ? sansPlaque.refus : "accepté"})`, "refus" in sansPlaque);
const sansFamille = ligneCreation("vehicule", "VEH-2026-90003", { immatriculation: "DK-1111-AA", marque: "Tata", appellation: "LPT 1618", categorie: "cat-frigo" }, r);
attendu(`une catégorie métier sans famille est refusée plutôt que devinée (${"refus" in sansFamille ? sansFamille.refus : "acceptée"})`, "refus" in sansFamille);
const avecFamille = ligneCreation("vehicule", "VEH-2026-90004", { immatriculation: "DK-1111-AA", marque: "Tata", appellation: "LPT 1618", categorie: "cat-frigo", categorieFamille: "camion" }, r);
attendu("la famille jointe range la catégorie métier", "ligne" in avecFamille && avecFamille.ligne.categorie === "camion" && avecFamille.ligne.categorie_metier === "cat-frigo");

/* Deux véhicules ne partagent pas une plaque : c'est presque toujours le même
   camion saisi deux fois. */
let doublon = false;
try {
  if ("ligne" in neuf) await inserer("vehicule", neuf.ligne);
} catch {
  doublon = true;
}
attendu("une plaque déjà au parc est refusée", doublon);

/* Changer la plaque : la ligne garde son identifiant, donc tout ce qui pend au
   véhicule le suit — c'est la raison d'être de la correction en place. */
const avant = (await pg.query(`select id from vehicule where immatriculation = 'DK9911ZZ'`)).rows[0] as { id: string };
const renommage = colonnesModification("vehicule", [{ champ: "immatriculation", valeur: "dk 9911 aa" }, { champ: "ptac", valeur: "17 500" }, { champ: "transportSpecial", valeur: "oui" }]);
attendu(`la plaque se range sous sa forme canonique (${renommage.immatriculation})`, renommage.immatriculation === "DK9911AA" && renommage.ptac === 17500 && renommage.transport_special === true);
await pg.query(`update vehicule set immatriculation = $1, ptac = $2, transport_special = $3 where immatriculation = 'DK9911ZZ'`, [renommage.immatriculation, renommage.ptac, renommage.transport_special]);
const apresRenommage = (await pg.query(`select id, immatriculation from vehicule where id = $1`, [avant.id])).rows[0] as { id: string; immatriculation: string };
attendu(`la plaque change sans changer d'identifiant (${apresRenommage?.immatriculation})`, apresRenommage?.immatriculation === "DK9911AA" && apresRenommage.id === avant.id);

/* Ce qui se calcule ne s'écrit pas : cinq champs étaient proposés à la saisie
   alors que la fiche les déduit du site, de l'usage, de la business unit, de la
   catégorie de flotte et des relevés. */
const calcules = colonnesModification("vehicule", [{ champ: "region", valeur: "Thiès" }, { champ: "entite", valeur: "KFC" }, { champ: "utilisation", valeur: "Vrac" }, { champ: "regimePropriete", valeur: "Location" }, { champ: "gpsActif", valeur: "oui" }]);
attendu(`aucun champ calculé ne prétend s'écrire (${Object.keys(calcules).length} colonne(s))`, Object.keys(calcules).length === 0);

/* Le fournisseur se corrige : le module pur pose le nom, le lien se résout en
   base — d'où son absence ici, et sa présence dans `ecrireModification`. */
const changeVendeur = colonnesModification("vehicule", [{ champ: "fournisseur", valeur: "SENEGALAISE AUTOMOBILE" }]);
attendu("une modification du fournisseur pose son nom, pas son lien", changeVendeur.fournisseur === "SENEGALAISE AUTOMOBILE" && !("fournisseur_id" in changeVendeur));

/* Sortir un véhicule du parc : le statut terminal exige sa date (0047). */
let sansDate = false;
try {
  await pg.query(`update vehicule set statut = 'sorti' where id = $1`, [avant.id]);
} catch {
  sansDate = true;
}
attendu("un véhicule sorti sans date de sortie est refusé", sansDate);
await pg.query(`update vehicule set statut = 'sorti', date_sortie = '2026-09-14', motif_sortie = 'cede' where id = $1`, [avant.id]);
const sorti = (await pg.query(`select statut, date_sortie::text, motif_sortie from vehicule where id = $1`, [avant.id])).rows[0] as { statut: string; date_sortie: string; motif_sortie: string };
attendu(`il sort daté et motivé (${sorti?.statut}, ${sorti?.date_sortie}, ${sorti?.motif_sortie})`, sorti?.statut === "sorti" && sorti.date_sortie === "2026-09-14" && sorti.motif_sortie === "cede");
const sortiSansDate = ligneCreation("vehicule", "VEH-2026-90005", { immatriculation: "DK-2222-BB", marque: "Tata", appellation: "LPT 1618", categorie: "camion", statut: "sorti" }, r);
attendu(`une création « sortie » sans date est refusée (${"refus" in sortiSansDate ? sortiSansDate.refus : "acceptée"})`, "refus" in sortiSansDate);
let motifInvente = false;
try {
  await pg.query(`update vehicule set motif_sortie = 'perdu-de-vue' where id = $1`, [avant.id]);
} catch {
  motifInvente = true;
}
attendu("un motif de sortie hors vocabulaire est refusé", motifInvente);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);
