/* Le module Pièces de rechange depuis la base, dans PGlite avec le seed :
 * la migration 0029, les écritures d'une pièce, de ses mouvements et d'un
 * pneu par `ligneCreation`, le stock déduit à la relecture par `stockDe`,
 * puis les refus — du domaine et de la base.
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-pieces.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { stockDe } from "../src/domaine/pieces";
import { mouvementDepuisLigne, pieceDepuisLigne, pneuDepuisLigne, type LigneMouvementBase, type LignePieceBase, type LignePneuBase } from "../src/donnees/pieces";
import { ligneCreation, tableDe } from "../src/lib/transactions-colonnes";

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
  for (const ligne of texte.split("\n")) { courant.push(ligne); if (/^on conflict .*;$/.test(ligne.trim())) { try { await pg.exec(courant.join("\n")); } catch {} courant = []; } }
}
let echecs = 0;
const attendu = (libelle: string, ok: boolean) => { console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`); if (!ok) echecs++; };
const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : d === null || d === undefined ? null : String(d));
const utilisateur = "00000000-0000-0000-0000-000000000001";
async function inserer(table: string, ligne: Record<string, unknown>) {
  const cles = Object.keys(ligne);
  await pg.query(`insert into ${table} (${cles.join(", ")}, cree_par) values (${cles.map((_, i) => `$${i + 1}`).join(", ")}, $${cles.length + 1})`, [...cles.map((k) => ligne[k]), utilisateur]);
}

/* ---- 1. La migration est là, le magasin est vide ---- */
const tables = (await pg.query(`select table_name from information_schema.tables where table_name in ('piece', 'mouvement_stock', 'pneu') order by 1`)).rows.map((r) => (r as { table_name: string }).table_name);
attendu(`0029 crée les trois tables (${tables.join(", ")})`, tables.length === 3);
const vehicule = (await pg.query(`select id, immatriculation from vehicule where categorie = 'camion' order by immatriculation limit 1`)).rows[0] as { id: string; immatriculation: string } | undefined
  ?? ((await pg.query(`select id, immatriculation from vehicule order by immatriculation limit 1`)).rows[0] as { id: string; immatriculation: string });
const fournisseur = (await pg.query(`select id, raison_sociale from prestataire where type in ('pieces', 'garage') order by raison_sociale limit 1`)).rows[0] as { id: string; raison_sociale: string };
console.log(`véhicule d'essai ${vehicule.immatriculation}, fournisseur ${fournisseur.raison_sociale}`);

/* ---- 2. Les écritures : une pièce, un pneu au référentiel, des mouvements ---- */
const sansRattachement = { vehiculeId: null, chauffeurId: null, prestataireId: null, pieceId: null };
const filtre = ligneCreation("piece", "PCE-2026-90001", { reference: "FH-TEST-01", designation: "Filtre à huile d'essai", categorie: "filtration", unite: "piece", referenceConstructeur: "X-123", compatibilites: "Renault Kerax; Renault Premium", fournisseur: fournisseur.raison_sociale, prixReference: "18 500", stockMinimum: 4, stockMaximum: 12 }, { ...sansRattachement, prestataireId: fournisseur.id });
if ("refus" in filtre) throw new Error(filtre.refus);
await inserer(tableDe("piece")!, filtre.ligne);
const pneuRef = ligneCreation("piece", "PCE-2026-90002", { reference: "PN-315-80-R22.5", designation: "Pneu 315/80 R22.5", categorie: "pneumatique", unite: "piece", stockMinimum: 2, stockMaximum: 6 }, sansRattachement);
if ("refus" in pneuRef) throw new Error(pneuRef.refus);
await inserer(tableDe("piece")!, pneuRef.ligne);
const ids = Object.fromEntries(((await pg.query(`select numero, id from piece where numero like 'PCE-2026-9%'`)).rows as { numero: string; id: string }[]).map((r) => [r.numero, r.id]));
attendu(`deux pièces écrites (${Object.keys(ids).length})`, Object.keys(ids).length === 2);
const doublon = pg.query(`insert into piece (numero, reference, designation, categorie, unite, stock_minimum) values ('PCE-2026-90003', 'fh-test-01', 'Doublon', 'filtration', 'piece', 1)`);
attendu("la base refuse deux pièces de même référence à la casse près", await doublon.then(() => false, () => true));

const surFiltre = { ...sansRattachement, pieceId: ids["PCE-2026-90001"]! };
const mouvements: { numero: string; valeurs: Record<string, unknown>; r: typeof surFiltre }[] = [
  { numero: "MVT-2026-90001", valeurs: { date: "2026-08-01", nature: "entree", quantite: 10, prixUnitaire: "18 200", demandeNumero: "DAC-2026-00120", fournisseur: fournisseur.raison_sociale, auteur: "Chef d'atelier" }, r: surFiltre },
  { numero: "MVT-2026-90002", valeurs: { date: "2026-08-12", nature: "sortie", quantite: 2, interventionNumero: "INT-2026-00001", motif: "Vidange", auteur: "Chef d'atelier" }, r: { ...surFiltre, vehiculeId: vehicule.id } },
  { numero: "MVT-2026-90003", valeurs: { date: "2026-08-20", nature: "sortie", quantite: 3, motif: "Vidange atelier", auteur: "Chef d'atelier" }, r: { ...surFiltre, vehiculeId: vehicule.id } },
  { numero: "MVT-2026-90004", valeurs: { date: "2026-08-21", nature: "retour", quantite: 1, motif: "Un filtre non posé", auteur: "Chef d'atelier" }, r: surFiltre },
  { numero: "MVT-2026-90005", valeurs: { date: "2026-09-01", nature: "regularisation", ecart: -2, motif: "Inventaire du 1er septembre : deux filtres manquants", auteur: "Gestionnaire de parc" }, r: surFiltre },
];
for (const m of mouvements) {
  const prep = ligneCreation("mouvement", m.numero, m.valeurs, m.r);
  if ("refus" in prep) { attendu(`mouvement ${m.numero} : ${prep.refus}`, false); continue; }
  try {
    await inserer(tableDe("mouvement")!, prep.ligne);
    attendu(`${String(m.valeurs.nature)} → mouvement_stock (${m.numero})`, true);
  } catch (x) {
    attendu(`${String(m.valeurs.nature)} → mouvement_stock : ${(x as Error).message}`, false);
  }
}
const pneu = ligneCreation("pneu", "PNE-2026-90001", { dimension: "315/80 R22.5", marque: "Michelin", numeroSerie: "DOT 2226", etat: "monte", vehiculeId: vehicule.immatriculation, position: "AVG", datePose: "2026-08-15", kmPose: "184 200" }, { ...sansRattachement, pieceId: ids["PCE-2026-90002"]!, vehiculeId: vehicule.id });
if ("refus" in pneu) throw new Error(pneu.refus);
await inserer(tableDe("pneu")!, pneu.ligne);
attendu("un pneu monté est écrit avec son véhicule et sa position", ((await pg.query(`select count(*)::int as n from pneu where numero = 'PNE-2026-90001' and vehicule_id is not null and position = 'AVG'`)).rows[0] as { n: number }).n === 1);

/* ---- 3. Les refus : du domaine d'abord, de la base ensuite ---- */
const sortieVide = ligneCreation("mouvement", "MVT-2026-90010", { date: "2026-09-02", nature: "sortie", quantite: 1 }, surFiltre);
attendu(`une sortie sans ordre, intervention ni véhicule est refusée (${"refus" in sortieVide ? sortieVide.refus : "acceptée"})`, "refus" in sortieVide);
const regulSansMotif = ligneCreation("mouvement", "MVT-2026-90011", { date: "2026-09-02", nature: "regularisation", ecart: 1 }, surFiltre);
attendu(`une régularisation sans motif est refusée (${"refus" in regulSansMotif ? regulSansMotif.refus : "acceptée"})`, "refus" in regulSansMotif);
const sansPiece = ligneCreation("mouvement", "MVT-2026-90012", { date: "2026-09-02", nature: "entree", quantite: 1 }, sansRattachement);
attendu(`un mouvement sans pièce est refusé (${"refus" in sansPiece ? sansPiece.refus : "accepté"})`, "refus" in sansPiece);
const quantiteNulle = ligneCreation("mouvement", "MVT-2026-90013", { date: "2026-09-02", nature: "entree", quantite: 0 }, surFiltre);
attendu(`une entrée de quantité nulle est refusée (${"refus" in quantiteNulle ? quantiteNulle.refus : "acceptée"})`, "refus" in quantiteNulle);
const monteSansVehicule = ligneCreation("pneu", "PNE-2026-90002", { dimension: "315/80 R22.5", etat: "monte" }, sansRattachement);
attendu(`un pneu monté sans véhicule est refusé (${"refus" in monteSansVehicule ? monteSansVehicule.refus : "accepté"})`, "refus" in monteSansVehicule);
const baseSortieVide = pg.query(`insert into mouvement_stock (numero, date, nature, piece_id, quantite) values ('MVT-2026-90020', '2026-09-02', 'sortie', $1, 1)`, [ids["PCE-2026-90001"]]);
attendu("la base refuse elle aussi une sortie sans rattachement", await baseSortieVide.then(() => false, () => true));
const baseRegulVide = pg.query(`insert into mouvement_stock (numero, date, nature, piece_id, quantite, ecart) values ('MVT-2026-90021', '2026-09-02', 'regularisation', $1, 1, 1)`, [ids["PCE-2026-90001"]]);
attendu("la base refuse une régularisation sans motif", await baseRegulVide.then(() => false, () => true));
const baseEnStockAvecVehicule = pg.query(`insert into pneu (numero, marque, dimension, etat, vehicule_id) values ('PNE-2026-90003', 'X', '315/80 R22.5', 'en-stock', $1)`, [vehicule.id]);
attendu("la base refuse un pneu « en stock » qui porterait un véhicule", await baseEnStockAvecVehicule.then(() => false, () => true));

/* ---- 4. La relecture : les mêmes lectures que le serveur, le stock déduit ---- */
const lPieces = ((await pg.query(`select p.numero, p.reference, p.designation, p.categorie, p.unite, p.reference_constructeur, p.compatibilites, p.fournisseur, p.prix_reference, p.stock_minimum, p.stock_maximum, p.actif, p.commentaire,
  (select jsonb_build_object('numero', x.numero, 'raison_sociale', x.raison_sociale) from prestataire x where x.id = p.prestataire_id) as prestataire from piece p order by p.reference`)).rows as LignePieceBase[]).map(pieceDepuisLigne);
const lMouvements = ((await pg.query(`select m.numero, m.date, m.nature, m.quantite, m.ecart, m.prix_unitaire, m.demande_numero, m.ordre_numero, m.intervention_numero, m.fournisseur, m.motif, m.auteur_nom,
  (select jsonb_build_object('numero', p.numero) from piece p where p.id = m.piece_id) as piece,
  (select jsonb_build_object('immatriculation', v.immatriculation) from vehicule v where v.id = m.vehicule_id) as vehicule from mouvement_stock m order by m.date desc`)).rows as Record<string, unknown>[])
  .map((r) => ({ ...r, date: iso(r.date) }) as unknown as LigneMouvementBase)
  .map(mouvementDepuisLigne);
const lPneus = ((await pg.query(`select n.numero, n.marque, n.dimension, n.numero_serie, n.etat, n.position, n.date_pose, n.km_pose, n.date_depose, n.km_depose, n.rechapages, n.commentaire,
  (select jsonb_build_object('numero', p.numero) from piece p where p.id = n.piece_id) as piece,
  (select jsonb_build_object('immatriculation', v.immatriculation) from vehicule v where v.id = n.vehicule_id) as vehicule from pneu n`)).rows as Record<string, unknown>[])
  .map((r) => ({ ...r, date_pose: iso(r.date_pose), date_depose: iso(r.date_depose) }) as unknown as LignePneuBase)
  .map(pneuDepuisLigne);
const stock = stockDe(lPieces, lMouvements, "2026-09-09");
const s = stock.find((x) => x.piece.numero === "PCE-2026-90001")!;
/* 10 entrés − 2 − 3 sortis + 1 retourné − 2 d'écart = 4 ; le minimum est 4 : à jour, rien à commander. */
attendu(`le stock déduit du filtre est de ${s.quantite} (attendu 4), état ${s.etat}`, s.quantite === 4 && s.etat === "a-jour" && s.aCommander === 0);
attendu(`le dernier prix est celui de l'entrée (${s.dernierPrix}), la valeur indicative ${s.valeurIndicative}`, s.dernierPrix === 18200 && s.valeurIndicative === 4 * 18200);
attendu(`les sorties sur douze mois font ${s.sortiesDouzeMois} (attendu 5)`, s.sortiesDouzeMois === 5);
attendu(`la pièce relit son fournisseur du référentiel (${s.piece.fournisseur}, ${s.piece.fournisseurNumero})`, s.piece.fournisseur === fournisseur.raison_sociale && s.piece.fournisseurNumero !== null);
attendu(`les compatibilités relues (${s.piece.compatibilites.join(" / ")})`, s.piece.compatibilites.length === 2);
const sPneu = stock.find((x) => x.piece.numero === "PCE-2026-90002")!;
attendu(`la référence de pneu sans mouvement est épuisée (${sPneu.quantite}, ${sPneu.etat}, ${sPneu.aCommander} à commander)`, sPneu.quantite === 0 && sPneu.etat === "epuisee" && sPneu.aCommander === 6);
const sortie = lMouvements.find((m) => m.numero === "MVT-2026-90002")!;
attendu(`la sortie relue cite l'intervention et le véhicule (${sortie.interventionNumero}, ${sortie.immatriculationAffichee})`, sortie.interventionNumero === "INT-2026-00001" && sortie.vehiculeId === vehicule.immatriculation && sortie.immatriculationAffichee !== null);
const regul = lMouvements.find((m) => m.numero === "MVT-2026-90005")!;
attendu(`la régularisation relue porte l'écart signé (${regul.ecart}) et une quantité positive (${regul.quantite})`, regul.ecart === -2 && regul.quantite === 2);
const p = lPneus.find((x) => x.numero === "PNE-2026-90001")!;
attendu(`le pneu relu est monté sur ${p.immatriculationAffichee} en ${p.position}, posé à ${p.kmPose} km, dimension ${p.pieceNumero}`, p.etat === "monte" && p.position === "AVG" && p.kmPose === 184200 && p.pieceNumero === "PCE-2026-90002");

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);
