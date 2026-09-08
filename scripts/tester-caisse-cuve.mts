/* La caisse et le carburant depuis la base, dans PGlite avec le seed : le
 * journal de caisse et son solde, les dépenses à régler, les pleins, la cuve
 * et son stock, la consommation par véhicule et par mois.
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-caisse-cuve.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { avecStock, estCuve } from "../src/domaine/carburant";
import { fusionnerParametres } from "../src/domaine/parametres";
import { achatDepuisLigne, type LigneAchatBase } from "../src/donnees/achats";
import { aReglerDepuisLaBase, depenseCaisseDepuisLigne, journalDepuisLaBase, type LigneCaisseBase, type LigneDepenseCaisseBase } from "../src/donnees/caisse";
import { consommationsDepuisLaBase, cuveDepuisLigne, pleinDepuisLigne, type LigneCuveBase, type LignePleinBase } from "../src/donnees/carburant";
import { sortieDePlein } from "../src/donnees/carburant-demo";
import type { ParcBrut } from "../src/donnees/flotte";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
for (const m of readdirSync(join(projet, "supabase/migrations")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) { courant.push(ligne); if (/^on conflict .*;$/.test(ligne.trim())) { try { await pg.exec(courant.join("\n")); } catch {} courant = []; } }
}
let echecs = 0;
const attendu = (libelle: string, ok: boolean) => { console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`); if (!ok) echecs++; };
const n = async (sql: string, params: unknown[] = []) => Number((await pg.query(sql, params)).rows[0].n);
const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

/* ---- Caisse ---- */
const parametreCaisse = (await pg.query(`select valeur from parametre where cle = 'caisse'`)).rows[0]?.valeur;
const pc = fusionnerParametres({ caisse: parametreCaisse }).caisse;
attendu(`paramètre caisse : solde de départ ${pc.soldeInitial} F, seuil ${pc.seuil} F`, pc.soldeInitial === 1_500_000 && pc.seuil === 200_000);
const mouvements = (await pg.query(`select numero, date, sens, libelle, montant, beneficiaire, piece, justificatif, depense_numero, enregistre_par from mouvement_caisse order by date desc`)).rows.map((r: any) => ({ ...r, date: iso(r.date) })) as LigneCaisseBase[];
const depenses = (await pg.query(`
  select d.numero, d.date, d.libelle, d.montant, d.poste, d.beneficiaire, d.reference, d.justificatif,
    (select jsonb_build_object('immatriculation', v.immatriculation, 'business_unit', v.business_unit, 'site', (select jsonb_build_object('libelle', s.libelle) from site s where s.id = v.site_id)) from vehicule v where v.id = d.vehicule_id) as vehicule
  from depense d where d.origine = 'caisse' order by d.date desc`)).rows.map((r: any) => ({ ...r, date: iso(r.date) })) as LigneDepenseCaisseBase[];
const lignesDepenses = depenses.map(depenseCaisseDepuisLigne);
const journal = journalDepuisLaBase(mouvements, lignesDepenses, pc.soldeInitial);
attendu(`${journal.length} mouvements lus = table (${mouvements.length})`, journal.length === mouvements.length && journal.length > 0);
const solde = journal[0]!.soldeApres;
const soldeFonction = await n(`select solde_caisse(current_date)::bigint as n`);
attendu(`le solde du journal (${solde} F) est celui de la fonction (${soldeFonction} F)`, solde === soldeFonction);
const sorties = journal.filter((m) => m.sens === "sortie");
attendu(`${sorties.length} sorties, toutes rattachées à une dépense avec son véhicule`, sorties.every((m) => m.depenseNumero && m.vehiculeId && m.poste));
const aRegler = aReglerDepuisLaBase(lignesDepenses, mouvements);
attendu(`${aRegler.length} dépenses de caisse à régler, aucune déjà citée par une sortie`, aRegler.every((d) => !sorties.some((m) => m.depenseNumero === d.numero)) && aRegler.length > 0);
attendu(`le journal est trié du plus récent au plus ancien`, journal.every((m, i) => i === 0 || m.date <= journal[i - 1]!.date));

/* ---- Carburant ---- */
const stockInitial = fusionnerParametres({ cuve: (await pg.query(`select valeur from parametre where cle = 'cuve'`)).rows[0]?.valeur }).cuve.stockInitial;
attendu(`paramètre cuve : stock de départ ${stockInitial} l`, stockInitial === 9000);
const pleinsBruts = (await pg.query(`
  select p.numero, p.vehicule_id, p.date, p.litres, p.prix_litre, p.montant, p.km, p.source, p.reference,
    (select jsonb_build_object('immatriculation', v.immatriculation, 'marque', v.marque, 'appellation', v.appellation, 'business_unit', v.business_unit, 'site', (select jsonb_build_object('libelle', s.libelle) from site s where s.id = v.site_id)) from vehicule v where v.id = p.vehicule_id) as vehicule,
    (select jsonb_build_object('raison_sociale', pr.raison_sociale) from prestataire pr where pr.id = p.prestataire_id) as prestataire
  from plein p order by p.date desc`)).rows.map((r: any) => ({ ...r, date: iso(r.date) })) as LignePleinBase[];
const pleins = pleinsBruts.map(pleinDepuisLigne);
attendu(`${pleins.length} pleins lus = table (${await n(`select count(*)::int as n from plein`)})`, pleins.length === (await n(`select count(*)::int as n from plein`)));
const cuveBrute = (await pg.query(`select m.numero, m.date, m.sens, m.libelle, m.litres, m.prix_litre, m.montant, m.fournisseur, m.piece, m.commentaire, m.enregistre_par, (select jsonb_build_object('raison_sociale', pr.raison_sociale) from prestataire pr where pr.id = m.prestataire_id) as prestataire from mouvement_cuve m order by m.date desc`)).rows.map((r: any) => ({ ...r, date: iso(r.date) })) as LigneCuveBase[];
const cuve = cuveBrute.map(cuveDepuisLigne);
const livraisons = cuve.filter((m) => m.sens === "livraison");
attendu(`${cuve.length} mouvements de cuve : ${livraisons.length} livraisons, ${cuve.length - livraisons.length} jauges ; le fournisseur vient du prestataire`, livraisons.every((m) => m.fournisseur === "TotalEnergies Sénégal"));
const journalCuve = avecStock([...cuve, ...pleins.filter((p) => estCuve(p.source)).map(sortieDePlein)], stockInitial);
const stockEcran = journalCuve[0]!.stockApres;
const stockFonction = await n(`select stock_cuve(current_date)::float as n`);
attendu(`le stock à l'écran (${stockEcran} l) est celui de la fonction (${Math.round(stockFonction * 10) / 10} l)`, Math.abs(stockEcran - stockFonction) < 0.11);
attendu(`les relevés de jauge portent un écart calculé`, journalCuve.filter((m) => m.sens === "jauge").every((m) => m.ecart !== null));

/* ---- Demandes d'achat (0022) ---- */
const achatsBruts = (await pg.query(`
  select a.numero, a.date, a.objet, a.poste, a.montant_estime, a.fournisseur, a.urgence, a.origine_numero, a.origine_libelle, a.demandeur_nom, a.demandeur_role, a.etape, a.visa_par, a.visa_le, a.valide_par, a.validee_le, a.numero_demande_x3, a.numero_bon_commande, a.montant_engage, a.date_livraison, a.date_facture, a.montant_reel, a.date_reglement, a.depense_numero, a.commentaire_decision,
    (select jsonb_build_object('immatriculation', v.immatriculation, 'business_unit', v.business_unit, 'site', (select jsonb_build_object('libelle', s.libelle) from site s where s.id = v.site_id)) from vehicule v where v.id = a.vehicule_id) as vehicule,
    (select jsonb_build_object('numero', p.numero, 'raison_sociale', p.raison_sociale) from prestataire p where p.id = a.prestataire_id) as prestataire
  from demande_achat a order by a.date desc`)).rows.map((r: any) => ({ ...r, date: iso(r.date), visa_le: r.visa_le ? iso(r.visa_le) : null, validee_le: r.validee_le ? iso(r.validee_le) : null, date_livraison: r.date_livraison ? iso(r.date_livraison) : null, date_facture: r.date_facture ? iso(r.date_facture) : null, date_reglement: r.date_reglement ? iso(r.date_reglement) : null })) as LigneAchatBase[];
const achats = achatsBruts.map(achatDepuisLigne);
const nAchats = await n(`select count(*)::int as n from demande_achat`);
attendu(`${achats.length} demandes d'achat lues = table (${nAchats})`, achats.length === nAchats && achats.length > 10);
attendu(`chaque demande cite son origine et son fournisseur par numéro PRE`, achats.every((a) => a.origineNumero && (a.prestataireNumero?.startsWith("PRE-") || a.fournisseur)));
const reglees = achats.filter((a) => a.etape === "reglee");
attendu(`${reglees.length} réglées portent bon, facture, montant réel et règlement`, reglees.length > 0 && reglees.every((a) => a.numeroBonCommande && a.dateFacture && a.montantReel !== null && a.dateReglement));
attendu(`les liens d'origine se forment (${achats.filter((a) => a.origineHref).length} sur ${achats.length})`, achats.filter((a) => a.origineHref).length > achats.length / 2);

/* ---- Consommation ---- */
const aujourdhui = "2026-09-08";
const j = (await pg.query(`select lire_parc($1) as j`, ["2025-09-08"])).rows[0].j as any;
const parc: ParcBrut = {
  aujourdhui, attributions: j.attributions, attributaires: new Map(j.attributaires.map((a: any) => [a.id, a])), aRecevoir: j.a_recevoir, vehicules: j.vehicules,
  sites: new Map(j.sites.map((s: any) => [s.id, { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }])),
  chauffeurs: new Map(j.chauffeurs.map((c: any) => [c.id, c])), affectations: j.affectations, documents: j.documents, licences: j.licences, licencesVehicules: j.licences_vehicules,
  releves: j.releves, depenses: j.depenses, pleins: j.pleins, interventions: j.interventions,
};
const conso = consommationsDepuisLaBase(pleins, parc, aujourdhui);
const vehiculesConso = new Set(conso.map((c) => c.vehiculeId));
attendu(`${conso.length} mois de consommation sur ${vehiculesConso.size} véhicules`, conso.length > 0 && vehiculesConso.size > 10);
const avecKm = conso.filter((c) => c.kmParcourus > 0);
attendu(`${avecKm.length} mois portent des kilomètres, tous avec des litres et un coût`, avecKm.length > conso.length / 2 && conso.every((c) => c.litres > 0 && c.cout > 0));
const l100 = avecKm.map((c) => (c.litres / c.kmParcourus) * 100);
const mediane = [...l100].sort((a, b) => a - b)[Math.floor(l100.length / 2)]!;
attendu(`consommation médiane ${Math.round(mediane * 10) / 10} L/100 km, plausible pour des poids lourds`, mediane > 15 && mediane < 60);
const c0 = conso.find((c) => c.kmParcourus > 0)!;
console.log(`   exemple : ${c0.immatriculationAffichee} ${c0.mois} — ${c0.litres} l, ${c0.kmParcourus} km, ${c0.cout} F (référence ${c0.referenceL100} L/100)`);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);
