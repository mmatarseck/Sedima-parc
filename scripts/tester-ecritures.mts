/* Vérifie que les lignes formées par transactions-colonnes.ts entrent dans les
 * tables de la base : migrations rejouées dans PGlite, une création par type
 * insérée avec un rattachement réel du seed, puis une modification.
 * Lancer : npx tsx scripts/tester-ecritures.mts (PGlite pris dans le bac à sable). */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { USAGES_STANDARD, apprendreUsage, idUsage, libelleUsageCourant } from "../src/domaine/parametres";
import { categoriesPermis, cleDe, colonnesModification, ligneCreation, scinderUsage, tableDe } from "../src/lib/transactions-colonnes";

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
/* Le plan d'entretien n'a pas encore de table attachée : sa clé est le couple
   véhicule + opération, et le chemin de modification ne porte pas le véhicule. */
attendu(`un type sans table le dit (entretien : ${tableDe("entretien")})`, tableDe("entretien") === null);

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

/* -- La fiche chauffeur elle-même (15 septembre 2026) ----------------------- */
/* Comme le véhicule : elle se crée et se modifie comme une transaction, mais sa
   clé n'est pas un numéro. La fiche la nomme « CHA-babacar-ndiaye » — son
   adresse lisible — et l'écriture la traduit en identifiant de table. */

attendu(`le chauffeur a sa table (${tableDe("chauffeur")})`, tableDe("chauffeur") === "chauffeur");
attendu(
  "un chauffeur se repère par son identifiant, débarrassé du préfixe de sa fiche",
  cleDe("chauffeur", "CHA-babacar-ndiaye").colonne === "id" && cleDe("chauffeur", "CHA-babacar-ndiaye").valeur === "babacar-ndiaye",
);

/* Les catégories de permis : le formulaire laisse écrire ce qu'on veut, la base
   attend un tableau. On ne fait recommencer personne pour un séparateur. */
attendu(`« B · C · E » devient ${JSON.stringify(categoriesPermis("B · C · E"))}`, JSON.stringify(categoriesPermis("B · C · E")) === JSON.stringify(["B", "C", "E"]));
attendu("« b,c,e » aussi, et sans doublon", JSON.stringify(categoriesPermis("b,c,e,c")) === JSON.stringify(["B", "C", "E"]));
attendu("ce qui n'est pas une catégorie est écarté plutôt qu'entré de travers", JSON.stringify(categoriesPermis("B et le permis Z")) === JSON.stringify(["B", "E"]));

const siteChauffeur = (await pg.query(`select id from site order by code limit 1`)).rows[0] as { id: string };
const recrue = ligneCreation(
  "chauffeur",
  "CHA-2026-90001",
  { prenom: "Moussa", nom: "Sarr", matriculeRh: "SED-9001", contrat: "salarie", siteId: siteChauffeur.id, telephone: "77 000 00 01", permisNumero: "DK-999999", permisCategories: "B · C · E", permisEcheance: "2028-04-30", visiteMedicaleEcheance: "2027-03-15", dateEmbauche: "2026-09-01" },
  r,
);
if ("refus" in recrue) attendu(`création d'un chauffeur : ${recrue.refus}`, false);
else {
  await inserer("chauffeur", recrue.ligne);
  const n = (await pg.query(`select nom, prenom, contrat, permis_categories, permis_echeance::text as permis_echeance, aptitude, site_id from chauffeur where matricule_rh = 'SED-9001'`)).rows[0] as {
    nom: string; prenom: string; contrat: string; permis_categories: string[]; permis_echeance: string; aptitude: string; site_id: string;
  };
  attendu(`chauffeur → chauffeur (${n?.prenom} ${n?.nom}, permis ${JSON.stringify(n?.permis_categories)})`, n?.nom === "Sarr" && n.prenom === "Moussa" && JSON.stringify(n.permis_categories) === JSON.stringify(["B", "C", "E"]));
  attendu(`il naît apte et rattaché à son site (${n?.aptitude})`, n?.aptitude === "apte" && n.site_id === siteChauffeur.id && n.permis_echeance === "2028-04-30");
}

const sansNom = ligneCreation("chauffeur", "CHA-2026-90002", { prenom: "Moussa", contrat: "salarie" }, r);
attendu(`un chauffeur sans nom est refusé (${"refus" in sansNom ? sansNom.refus : "accepté"})`, "refus" in sansNom);

/* La modification : corriger une orthographe, prolonger un permis. */
const correction = colonnesModification("chauffeur", [
  { champ: "nom", valeur: "Sarre" },
  { champ: "permisEcheance", valeur: "2029-04-30" },
  { champ: "permisCategories", valeur: "B · C" },
]);
attendu(`la modification vise les bonnes colonnes (${Object.keys(correction).sort().join(", ")})`, correction.nom === "Sarre" && correction.permis_echeance === "2029-04-30");
await pg.query(`update chauffeur set nom = $1, permis_echeance = $2 where matricule_rh = 'SED-9001'`, [correction.nom, correction.permis_echeance]);
const apres = (await pg.query(`select nom, permis_echeance::text as permis_echeance from chauffeur where matricule_rh = 'SED-9001'`)).rows[0] as { nom: string; permis_echeance: string };
attendu(`la correction est passée (${apres?.nom}, permis ${apres?.permis_echeance})`, apres?.nom === "Sarre" && apres.permis_echeance === "2029-04-30");

/* L'aptitude n'a pas de table : ce sont trois colonnes de la fiche, comme le
   statut est une colonne du véhicule. Elle ne doit donc pas être « branchée ». */
attendu("l'aptitude n'a pas de table à elle : elle s'écrit sur la fiche", tableDe("aptitude") === null);
await pg.query(`update chauffeur set aptitude = 'apte-avec-reserve', aptitude_motif = $1, aptitude_date = '2026-09-15' where matricule_rh = 'SED-9001'`, ["Véhicules légers seulement"]);
const decisionAptitude = (await pg.query(`select aptitude, aptitude_motif, aptitude_date::text as aptitude_date from chauffeur where matricule_rh = 'SED-9001'`)).rows[0] as { aptitude: string; aptitude_motif: string; aptitude_date: string };
attendu(`une décision d'aptitude tient sur la fiche (${decisionAptitude?.aptitude}, ${decisionAptitude?.aptitude_date})`, decisionAptitude?.aptitude === "apte-avec-reserve" && decisionAptitude.aptitude_motif === "Véhicules légers seulement" && decisionAptitude.aptitude_date === "2026-09-15");
let aptitudeInventee = false;
try {
  await pg.query(`update chauffeur set aptitude = 'peut-etre' where matricule_rh = 'SED-9001'`);
} catch {
  aptitudeInventee = true;
}
attendu("une aptitude hors vocabulaire est refusée", aptitudeInventee);

/* -- La fiche prestataire (15 septembre 2026) -------------------------------- */
/* Elle non plus n'atteignait pas la base. Sa clé, elle, est bien un numéro :
   c'est lui que portent les commandes, les factures et les interventions. */

attendu(`le prestataire a sa table (${tableDe("prestataire")})`, tableDe("prestataire") === "prestataire");
attendu("il se repère par son numéro, comme la plupart", cleDe("prestataire", "PRE-2026-90001").colonne === "numero");

const garage = ligneCreation(
  "prestataire",
  "PRE-2026-90001",
  { raisonSociale: "Garage de la Corniche", type: "garage", contact: "M. Fall", telephone: "33 820 00 00", ville: "Dakar", delaiPaiementJours: 30 },
  r,
);
if ("refus" in garage) attendu(`création d'un prestataire : ${garage.refus}`, false);
else {
  await inserer("prestataire", garage.ligne);
  const n = (await pg.query(`select numero, raison_sociale, type, ville, delai_paiement_jours, actif from prestataire where numero = 'PRE-2026-90001'`)).rows[0] as {
    numero: string; raison_sociale: string; type: string; ville: string; delai_paiement_jours: number; actif: boolean;
  };
  attendu(`prestataire → prestataire (${n?.raison_sociale}, ${n?.type}, ${n?.delai_paiement_jours} j)`, n?.raison_sociale === "Garage de la Corniche" && n.type === "garage" && n.delai_paiement_jours === 30);
  attendu("une fiche naît active", n?.actif === true);
}

/* Payer à la commande n'est pas « zéro jour » : c'est une autre règle, et la
   colonne doit rester vide plutôt que de porter un délai qui n'existe pas. */
const aLaCommande = ligneCreation("prestataire", "PRE-2026-90002", { raisonSociale: "Station Total Rufisque", type: "station" }, r);
attendu("un délai de paiement non saisi reste nul", "ligne" in aLaCommande && aLaCommande.ligne.delai_paiement_jours === null);

const sansRaisonSociale = ligneCreation("prestataire", "PRE-2026-90003", { type: "garage" }, r);
attendu(`un prestataire sans raison sociale est refusé (${"refus" in sansRaisonSociale ? sansRaisonSociale.refus : "accepté"})`, "refus" in sansRaisonSociale);

const desactivation = colonnesModification("prestataire", [{ champ: "actif", valeur: "non" }, { champ: "note", valeur: "Ne répond plus depuis juin" }]);
attendu(`on désactive une fiche plutôt que de l'effacer (${JSON.stringify(desactivation.actif)})`, desactivation.actif === false && desactivation.note === "Ne répond plus depuis juin");

/* -- L'ajustement du plan d'entretien (15 septembre 2026) ------------------- */
/* Dernier type resté sans écriture. Sa clé n'est pas un numéro mais le couple
   véhicule + opération : le numéro qu'affiche la fiche est recalculé à chaque
   rendu à partir du rang de l'opération, et ne désigne rien de stable. */

attendu("l'ajustement d'entretien n'a pas de table par numéro", tableDe("entretien") === null);
const operation = (await pg.query(`select code from operation_entretien order by code limit 1`)).rows[0] as { code: string };
attendu(`le référentiel des opérations est là (${operation?.code})`, Boolean(operation?.code));

/* Un ajustement est un dépôt, pas une mise à jour : la ligne n'existe pas tant
   que personne n'a rien écarté du gabarit. */
await pg.query(
  `insert into ajustement_entretien (vehicule_id, operation_code, km, mois, motif, cree_par) values ($1, $2, $3, $4, $5, $6)
   on conflict (vehicule_id, operation_code) do update set km = excluded.km, mois = excluded.mois, motif = excluded.motif`,
  [v.id, operation.code, 12000, 6, "Tournées courtes : vidange avancée", utilisateur],
);
const pose = (await pg.query(`select km, heures, mois, motif, retiree from ajustement_entretien where vehicule_id = $1 and operation_code = $2`, [v.id, operation.code])).rows[0] as {
  km: number; heures: number | null; mois: number; motif: string; retiree: boolean;
};
attendu(`l'ajustement tient sur le couple véhicule + opération (${pose?.km} km, ${pose?.mois} mois)`, pose?.km === 12000 && pose.mois === 6 && pose.retiree === false);

/* Rejouer l'ajustement le remplace au lieu d'en créer un second : la clé
   primaire est le couple, et un véhicule n'a qu'un écart par opération. */
await pg.query(
  `insert into ajustement_entretien (vehicule_id, operation_code, km, mois, motif, cree_par) values ($1, $2, $3, $4, $5, $6)
   on conflict (vehicule_id, operation_code) do update set km = excluded.km, mois = excluded.mois, motif = excluded.motif`,
  [v.id, operation.code, 15000, 6, "Révision de l'écart", utilisateur],
);
const combien = (await pg.query(`select count(*)::int as n from ajustement_entretien where vehicule_id = $1 and operation_code = $2`, [v.id, operation.code])).rows[0] as { n: number };
attendu(`un second ajustement remplace le premier (${combien?.n} ligne)`, combien?.n === 1);

/* Le motif est obligatoire, et c'est voulu : une périodicité qui s'écarte du
   gabarit sans raison écrite est une périodicité que personne ne pourra
   défendre dans six mois. */
let sansMotif = false;
try {
  await pg.query(`insert into ajustement_entretien (vehicule_id, operation_code, km, cree_par) values ($1, $2, 9000, $3)`, [v.id, "OP-INEXISTANTE-TEST", utilisateur]);
} catch {
  sansMotif = true;
}
attendu("un ajustement sans motif ni opération connue est refusé", sansMotif);

/* -- L'usage ajouté par le métier (15 septembre 2026) ----------------------- */
/* « usage » est une énumération : un usage écrit dans le formulaire n'y entre
   pas. Il se range dans « usage_metier », et l'énumération reçoit « autre ». */

const usageLivre = ligneCreation("vehicule", "VEH-2026-90010", { immatriculation: "DK-4444-DD", marque: "Tata", appellation: "LPT 1618", categorie: "camion", usage: "Frigorifique" }, r);
attendu(
  `un usage livré se range dans l'énumération (${"ligne" in usageLivre ? usageLivre.ligne.usage : "refus"})`,
  "ligne" in usageLivre && usageLivre.ligne.usage === "frigorifique" && usageLivre.ligne.usage_metier === null,
);

const usageEcrit = ligneCreation("vehicule", "VEH-2026-90011", { immatriculation: "DK-5555-EE", marque: "Tata", appellation: "LPT 1618", categorie: "camion", usage: "Bétaillère" }, r);
attendu(
  `un usage écrit part à part (${"ligne" in usageEcrit ? `${usageEcrit.ligne.usage} + ${usageEcrit.ligne.usage_metier}` : "refus"})`,
  "ligne" in usageEcrit && usageEcrit.ligne.usage === "autre" && usageEcrit.ligne.usage_metier === "usa-betaillere",
);
/* Déterministe : l'écriture et les paramètres doivent tomber sur le même
   identifiant, sans quoi la fiche afficherait « Autre » au lieu du libellé. */
attendu("l'identifiant d'un usage ne dépend ni de la casse ni des accents", idUsage("Bétaillère") === idUsage("betaillere"));
attendu("les paramètres apprennent le même identifiant", apprendreUsage(USAGES_STANDARD, "Bétaillère").find((u) => !u.standard)?.id === "usa-betaillere");
attendu("un usage déjà connu ne s'apprend pas deux fois", apprendreUsage(USAGES_STANDARD, "Frigorifique").length === USAGES_STANDARD.length);

if ("ligne" in usageEcrit) {
  await inserer("vehicule", usageEcrit.ligne);
  const n = (await pg.query(`select usage::text as usage, usage_metier from vehicule where immatriculation = 'DK5555EE'`)).rows[0] as { usage: string; usage_metier: string };
  attendu(`la base garde les deux (${n?.usage} · ${n?.usage_metier})`, n?.usage === "autre" && n.usage_metier === "usa-betaillere");
}
let usageHorsForme = false;
try {
  await pg.query(`update vehicule set usage_metier = 'betaillere' where immatriculation = 'DK5555EE'`);
} catch {
  usageHorsForme = true;
}
attendu("un usage métier sans son préfixe est refusé", usageHorsForme);

/* La modification doit scinder comme la création. Le champ porte un libellé,
   la colonne attend une énumération : sans découpage, changer l'usage d'un
   véhicule est refusé par Postgres — y compris pour un usage ordinaire choisi
   dans la liste, puisque « Frigorifique » n'est pas « frigorifique ». */
attendu(`un usage livré modifié redevient sa valeur d'énumération (${JSON.stringify(scinderUsage("Frigorifique"))})`, scinderUsage("Frigorifique").usage === "frigorifique" && scinderUsage("Frigorifique").usage_metier === null);
attendu(`un usage écrit modifié part à part (${JSON.stringify(scinderUsage("Bétaillère"))})`, scinderUsage("Bétaillère").usage === "autre" && scinderUsage("Bétaillère").usage_metier === "usa-betaillere");
attendu("un identifiant déjà scindé se reconnaît", scinderUsage("usa-betaillere").usage_metier === "usa-betaillere");
let usageEnClair = false;
try {
  await pg.query(`update vehicule set usage = 'Frigorifique' where immatriculation = 'AA032EA'`);
} catch {
  usageEnClair = true;
}
attendu("la base refuse un libellé là où elle attend son énumération", usageEnClair);

/* Le libellé ne se perd jamais. Un usage que les paramètres ne connaissent pas
   — fiche enregistrée sans que le référentiel suive, autre navigateur, base
   restaurée — se relit de son identifiant plutôt que de s'afficher « Autre »
   sur un véhicule dont la base sait parfaitement ce qu'il transporte. */
attendu(
  `un usage inconnu du référentiel garde son libellé (${libelleUsageCourant("autre", "usa-vehicule-particulier")})`,
  libelleUsageCourant("autre", "usa-vehicule-particulier") === "Vehicule particulier",
);
attendu(`un usage livré garde le sien (${libelleUsageCourant("frigorifique", null)})`, libelleUsageCourant("frigorifique", null) === "Frigorifique");

/* -- Une semi-remorque n'a pas d'énergie (0052) ----------------------------- */
/* « energie » était obligatoire avec « gasoil » par défaut : les dix
   semi-remorques du parc le portaient, et c'était faux dix fois. */

const remorque = ligneCreation("vehicule", "VEH-2026-90020", { immatriculation: "DK-7777-GG", marque: "Lecitrailer", appellation: "Plateau nu", categorie: "semi-remorque" }, r);
attendu(
  `une semi-remorque part sans énergie (${"ligne" in remorque ? String(remorque.ligne.energie) : "refus"})`,
  "ligne" in remorque && remorque.ligne.energie === null,
);
/* Même si le formulaire en portait une : on ne garde pas une réponse à une
   question qui n'a pas lieu d'être posée. */
const remorqueForcee = ligneCreation("vehicule", "VEH-2026-90021", { immatriculation: "DK-8888-HH", marque: "Trailor", appellation: "Plateau", categorie: "semi-remorque", energie: "gasoil" }, r);
attendu("une énergie saisie sur une remorque n'est pas retenue", "ligne" in remorqueForcee && remorqueForcee.ligne.energie === null);

const camion = ligneCreation("vehicule", "VEH-2026-90022", { immatriculation: "DK-9999-II", marque: "Tata", appellation: "LPT 1618", categorie: "camion" }, r);
attendu(`un camion sans précision reste au gasoil (${"ligne" in camion ? String(camion.ligne.energie) : "refus"})`, "ligne" in camion && camion.ligne.energie === "gasoil");

if ("ligne" in remorque) {
  await inserer("vehicule", remorque.ligne);
  const n = (await pg.query(`select energie::text as energie from vehicule where immatriculation = 'DK7777GG'`)).rows[0] as { energie: string | null };
  attendu("la base accepte une énergie vide", n?.energie === null);
}

/* -- Un site écrit doit être résolu avant d'entrer (15 septembre 2026) ------ */
/* Le champ Site se crée depuis sa liste : choisi, il porte un identifiant ;
   écrit, il porte un nom. La colonne, elle, attend un identifiant — et c'est
   pourquoi l'écriture doit résoudre avant d'écrire, à la création comme à la
   modification. Ce banc dit ce qui arrive si on l'oublie. */

const siteEcritEnClair = colonnesModification("vehicule", [{ champ: "siteId", valeur: "Dépôt de Kaolack" }]);
attendu(`un site écrit arrive en clair dans la colonne (${String(siteEcritEnClair.site_id)})`, siteEcritEnClair.site_id === "Dépôt de Kaolack");

let siteNonResolu = false;
try {
  await pg.query(`update vehicule set site_id = 'Dépôt de Kaolack' where immatriculation = 'AA032EA'`);
} catch {
  siteNonResolu = true;
}
attendu("la base refuse un nom de site là où elle attend un identifiant", siteNonResolu);

const siteChoisi = colonnesModification("vehicule", [{ champ: "siteId", valeur: siteChauffeur.id }]);
attendu("un site choisi passe tel quel", siteChoisi.site_id === siteChauffeur.id);

/* -- La fiche d'un attributaire se corrige (15 septembre 2026) -------------- */
/* Un chauffeur du parc avait son « Modifier » depuis toujours ; l'autre
   conducteur n'en avait pas, et son nom, sa fonction ou son département ne se
   corrigeaient nulle part. */

attendu(`l'attributaire a sa table (${tableDe("attributaire")})`, tableDe("attributaire") === "attributaire");
attendu(
  "il se repère par l'identifiant de sa table, débarrassé du préfixe de sa fiche",
  cleDe("attributaire", "ATB-76d65b36-d8bb-4cb9-a310-7befd1c2da81").colonne === "id" &&
    cleDe("attributaire", "ATB-76d65b36-d8bb-4cb9-a310-7befd1c2da81").valeur === "76d65b36-d8bb-4cb9-a310-7befd1c2da81",
);

const personne = (await pg.query(`select id, nom, fonction from attributaire order by nom limit 1`)).rows[0] as { id: string; nom: string; fonction: string | null };
if (!personne) attendu("un attributaire sert de cobaye", false);
else {
  const correction = colonnesModification("attributaire", [
    { champ: "fonction", valeur: "Responsable Logistique" },
    { champ: "businessUnit", valeur: "siege" },
    { champ: "actif", valeur: "non" },
  ]);
  attendu(
    `la modification vise les bonnes colonnes (${Object.keys(correction).sort().join(", ")})`,
    correction.fonction === "Responsable Logistique" && correction.business_unit === "siege" && correction.actif === false,
  );
  await pg.query(`update attributaire set fonction = $1, business_unit = $2, actif = $3 where id = $4`, [correction.fonction, correction.business_unit, correction.actif, personne.id]);
  const apres = (await pg.query(`select fonction, business_unit::text as bu, actif from attributaire where id = $1`, [personne.id])).rows[0] as { fonction: string; bu: string; actif: boolean };
  attendu(`la correction est passée (${apres?.fonction}, ${apres?.bu}, actif ${apres?.actif})`, apres?.fonction === "Responsable Logistique" && apres.bu === "siege" && apres.actif === false);
}

/* -- Un autre conducteur s'ajoute sans entrer chez les chauffeurs ----------- */
/* Demande du 15 septembre 2026 : « à l'ajout d'un autre conducteur, il faut
   pouvoir spécifier pour ne pas le mettre dans la liste des chauffeurs du
   parc ». Le banc tient les deux moitiés : la ligne entre chez les
   attributaires, et le nombre de chauffeurs ne bouge pas. */

const chauffeursAvant = Number((await pg.query(`select count(*)::int as n from chauffeur`)).rows[0].n);
const nouveau = ligneCreation("attributaire", "ATB-90001", { nom: "Aminata Fall", fonction: "Directrice Commerciale", departement: "Commerce", businessUnit: "siege" }, r);
attendu("un autre conducteur se forme en ligne de table", !("refus" in nouveau));
if (!("refus" in nouveau)) {
  attendu(
    `sa ligne ne porte que ce que la personne est (${Object.keys(nouveau.ligne).sort().join(", ")})`,
    nouveau.ligne.nom === "Aminata Fall" && nouveau.ligne.business_unit === "siege" && nouveau.ligne.actif === true && !("numero" in nouveau.ligne) && !("permis_numero" in nouveau.ligne),
  );
  await inserer("attributaire", nouveau.ligne);
  const pose = (await pg.query(`select id, fonction from attributaire where nom = 'Aminata Fall'`)).rows[0] as { id: string; fonction: string } | undefined;
  attendu(`la fiche est chez les attributaires (${pose?.fonction ?? "absente"})`, pose?.fonction === "Directrice Commerciale");
  attendu("et nulle part chez les chauffeurs du parc", Number((await pg.query(`select count(*)::int as n from chauffeur`)).rows[0].n) === chauffeursAvant);

  /* Le nom est unique : réattribuer un véhicule à la même personne doit
     retrouver sa fiche, pas en poser une seconde. */
  let doublon = false;
  try {
    await inserer("attributaire", { ...nouveau.ligne });
    doublon = true;
  } catch {}
  attendu("une seconde fiche au même nom est refusée par la base", !doublon);
}

attendu("un autre conducteur sans nom est refusé", "refus" in ligneCreation("attributaire", "ATB-90002", { fonction: "Directeur" }, r));

/* -- Remplacer un chauffeur clôt le précédent (15 septembre 2026) ----------- */
/* L'affectation s'ajoutait sans fermer celle qui courait : le véhicule avait
   deux titulaires en cours et les écrans montraient le premier venu — donc
   souvent l'ancien. Rien en base ne l'interdit : c'est à l'écriture de tenir
   la règle, et au banc de dire qu'elle tient. */

const porteur = (await pg.query(`select a.id, a.vehicule_id, a.chauffeur_id, a.debut::text as debut
  from affectation a where a.fin is null and a.role = 'titulaire' order by a.debut limit 1`)).rows[0] as
  { id: string; vehicule_id: string; chauffeur_id: string; debut: string } | undefined;
attendu("un véhicule avec un titulaire en cours sert de cobaye", Boolean(porteur));

if (porteur) {
  const remplacant = (await pg.query(`select id from chauffeur where id <> $1 order by nom limit 1`, [porteur.chauffeur_id])).rows[0] as { id: string };
  const debut = "2026-09-15";
  const veille = "2026-09-14";

  /* Ce que l'écriture fait : clore, puis ouvrir. */
  await pg.query(`update affectation set fin = $1 where id = $2`, [veille, porteur.id]);
  await pg.query(`insert into affectation (numero, vehicule_id, chauffeur_id, role, debut, motif, cree_par) values ($1, $2, $3, 'titulaire', $4, $5, $6)`,
    ["AFF-2026-95001", porteur.vehicule_id, remplacant.id, debut, "Remplacement", utilisateur]);

  const enCours = (await pg.query(`select chauffeur_id, debut::text as debut from affectation where vehicule_id = $1 and role = 'titulaire' and fin is null`, [porteur.vehicule_id])).rows as { chauffeur_id: string; debut: string }[];
  attendu(`un seul titulaire en cours après remplacement (${enCours.length})`, enCours.length === 1 && enCours[0]!.chauffeur_id === remplacant.id);

  const ancienne = (await pg.query(`select fin::text as fin from affectation where id = $1`, [porteur.id])).rows[0] as { fin: string };
  attendu(`l'affectation précédente garde son histoire, close la veille (${ancienne?.fin})`, ancienne?.fin === veille);

  const toutes = (await pg.query(`select count(*)::int as n from affectation where vehicule_id = $1 and role = 'titulaire'`, [porteur.vehicule_id])).rows[0] as { n: number };
  attendu(`les deux périodes coexistent (${toutes?.n} lignes)`, toutes!.n >= 2);
}

/* Le chauffeur ne se change pas en modifiant une affectation : la colonne n'est
   pas modifiable, et une saisie qui ne change rien ne doit pas dire le
   contraire. */
attendu("le chauffeur n'est pas une colonne modifiable d'une affectation", Object.keys(colonnesModification("affectation", [{ champ: "chauffeurId", valeur: "x" }])).length === 0);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);
