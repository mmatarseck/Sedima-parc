/* Le Budget depuis la base, dans PGlite avec le seed : les enveloppes de la
 * table, les dépenses de l'exercice, les demandes d'achat, puis l'assemblage
 * du domaine — la liste des postes et la fiche d'un poste, comparées à ce que
 * la démonstration dresse sur le même jeu (hors forfaits du parc léger, qui
 * n'existent qu'en démonstration) ; puis les écritures d'une enveloppe.
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-budget.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { donneesBudgetDe, fichePosteDe } from "../src/domaine/assembler-budget";
import { achatDepuisLigne, type LigneAchatBase } from "../src/donnees/achats";
import { sourceDepuisLignes, type LigneDepenseBudget, type LigneEnveloppe } from "../src/donnees/budget";
import { sourceBudgetDemo } from "../src/donnees/budget-demo";
import { DATE_REFERENCE } from "../src/donnees/chauffeurs-demo";
import { colonnesModification, ligneCreation, tableDe } from "../src/lib/transactions-colonnes";

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
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : d === null || d === undefined ? null : String(d));

/* ---- 1. La lecture ---- */
const aujourdhui = DATE_REFERENCE;
const exercice = aujourdhui.slice(0, 4);
const t0 = performance.now();
const enveloppes = ((await pg.query(`select numero, exercice, poste, business_unit, montant, profil, base, commentaire from enveloppe where exercice = $1 order by numero`, [exercice])).rows as LigneEnveloppe[]);
const depenses = ((await pg.query(`select d.numero, d.date, d.poste, d.libelle, d.montant, d.beneficiaire, d.origine, d.justificatif,
  (select jsonb_build_object('immatriculation', v.immatriculation, 'marque', v.marque, 'appellation', v.appellation, 'business_unit', v.business_unit) from vehicule v where v.id = d.vehicule_id) as vehicule
  from depense d where d.date >= $1 and d.date <= $2 order by d.date desc`, [`${exercice}-01-01`, aujourdhui])).rows as Record<string, unknown>[]).map((r) => ({ ...r, date: iso(r.date) }) as unknown as LigneDepenseBudget);
const achats = ((await pg.query(`select a.numero, a.date, a.objet, a.poste, a.montant_estime, a.fournisseur, a.urgence, a.origine_numero, a.origine_libelle, a.demandeur_nom, a.demandeur_role, a.etape, a.visa_par, a.visa_le, a.valide_par, a.validee_le, a.numero_demande_x3, a.numero_bon_commande, a.montant_engage, a.date_livraison, a.date_facture, a.montant_reel, a.date_reglement, a.depense_numero, a.commentaire_decision,
  (select jsonb_build_object('immatriculation', v.immatriculation, 'business_unit', v.business_unit, 'site', null) from vehicule v where v.id = a.vehicule_id) as vehicule,
  (select jsonb_build_object('numero', p.numero, 'raison_sociale', p.raison_sociale) from prestataire p where p.id = a.prestataire_id) as prestataire from demande_achat a`)).rows as Record<string, unknown>[])
  .map((r) => ({ ...r, date: iso(r.date), date_livraison: iso(r.date_livraison), date_facture: iso(r.date_facture), date_reglement: iso(r.date_reglement), visa_le: iso(r.visa_le), validee_le: iso(r.validee_le) }) as unknown as LigneAchatBase)
  .map(achatDepuisLigne);
const tLecture = Math.round(performance.now() - t0);
const source = sourceDepuisLignes(enveloppes, depenses, achats, aujourdhui);
const t1 = performance.now();
const budget = donneesBudgetDe(source);
const tAssemblage = Math.round(performance.now() - t1);
console.log(`lecture en ${tLecture} ms : ${enveloppes.length} enveloppes, ${depenses.length} dépenses de l'exercice (${source.depenses.length} avec véhicule), ${achats.length} demandes ; assemblage en ${tAssemblage} ms : ${budget.postes.length} postes`);

/* ---- 2. La liste, poste par poste contre la démonstration (hors forfaits) ---- */
const demoComplete = sourceBudgetDemo();
const demo = { ...demoComplete, depenses: demoComplete.depenses.filter((d) => !d.numero.startsWith("FOR-")) };
const budgetDemo = donneesBudgetDe(demo);
attendu(`autant d'enveloppes que la démonstration en dérive (${source.enveloppes.length} / ${demo.enveloppes.length})`, source.enveloppes.length === demo.enveloppes.length);
attendu(`autant de postes (${budget.postes.length} / ${budgetDemo.postes.length})`, budget.postes.length === budgetDemo.postes.length);
let ecarts = 0;
for (const d of budgetDemo.postes) {
  const b = budget.postes.find((p) => p.poste === d.poste);
  if (!b) { attendu(`${d.poste} manque`, false); ecarts++; continue; }
  const memes = b.cumul.enveloppe.montant === d.cumul.enveloppe.montant && b.cumul.consomme === d.cumul.consomme && b.cumul.engage === d.cumul.engage && b.cumul.etat === d.cumul.etat && b.parBu.length === d.parBu.length;
  if (!memes) ecarts++;
  attendu(`${d.poste} : budget ${fmt(b.cumul.enveloppe.montant)} (démo ${fmt(d.cumul.enveloppe.montant)}), consommé ${fmt(b.cumul.consomme)} (démo ${fmt(d.cumul.consomme)}), engagé ${fmt(b.cumul.engage)} (démo ${fmt(d.cumul.engage)}), ${b.cumul.etat} (démo ${d.cumul.etat}), ${b.parBu.length} BU`, memes);
}
attendu(`aucun écart entre la base et la démonstration (${ecarts})`, ecarts === 0);
attendu(`la synthèse : budget ${fmt(budget.synthese.budget)} F, consommé ${fmt(budget.synthese.consomme)}, engagé ${fmt(budget.synthese.engage)}, hors budget ${fmt(budget.synthese.horsBudget)} (démo ${fmt(budgetDemo.synthese.horsBudget)})`,
  budget.synthese.budget === budgetDemo.synthese.budget && budget.synthese.consomme === budgetDemo.synthese.consomme && budget.synthese.horsBudget === budgetDemo.synthese.horsBudget);

/* ---- 3. La fiche d'un poste ---- */
const fiche = fichePosteDe(source, "carburant", budget)!;
const ficheDemo = fichePosteDe(demo, "carburant", budgetDemo)!;
attendu(`la fiche carburant : ${fiche.depenses.length} dépenses (démo ${ficheDemo.depenses.length}), ${fiche.engagements.length} engagements (démo ${ficheDemo.engagements.length}), ${fiche.parMois.length} mois, cumul ${fmt(fiche.parMois[fiche.parMois.length - 1]?.consomme ?? 0)} (démo ${fmt(ficheDemo.parMois[ficheDemo.parMois.length - 1]?.consomme ?? 0)})`,
  fiche.depenses.length === ficheDemo.depenses.length && fiche.engagements.length === ficheDemo.engagements.length && fiche.parMois.length === ficheDemo.parMois.length && fiche.parMois[fiche.parMois.length - 1]?.consomme === ficheDemo.parMois[ficheDemo.parMois.length - 1]?.consomme);
attendu(`chaque dépense de la fiche cite son véhicule et sa business unit`, fiche.depenses.every((d) => d.immatriculation && d.immatriculationAffichee.includes(" ")));
const pieces = fichePosteDe(source, "pieces", budget);
attendu(`la fiche pièces porte ${pieces?.engagements.length ?? 0} engagements pour ${fmt(pieces?.suivi.cumul.engage ?? 0)} F`, (pieces?.engagements.length ?? 0) > 0 && (pieces?.engagements.reduce((t, g) => t + g.montant, 0) ?? 0) === (pieces?.suivi.cumul.engage ?? -1));
attendu(`un poste inconnu est nul`, fichePosteDe(source, "inconnu", budget) === null);

/* ---- 4. Les écritures ---- */
const utilisateur = "00000000-0000-0000-0000-000000000001";
const r = { vehiculeId: null, chauffeurId: null, prestataireId: null };
const table = tableDe("budget")!;
const creation = ligneCreation("budget", "BUD-2026-90001", { date: "2026-01-01", exercice: "2026", poste: "divers", businessUnit: "", montant: "1 200 000", base: "posée en cours d'exercice 2026" }, r);
if ("refus" in creation) attendu(`enveloppe : ${creation.refus}`, false);
else {
  const cles = Object.keys(creation.ligne);
  await pg.query(`insert into ${table} (${cles.join(", ")}, cree_par) values (${cles.map((_, i) => `$${i + 1}`).join(", ")}, $${cles.length + 1})`, [...cles.map((k) => creation.ligne[k]), utilisateur]);
  const n = (await pg.query(`select montant, business_unit from enveloppe where numero = 'BUD-2026-90001'`)).rows[0] as { montant: string | number; business_unit: string | null };
  attendu(`budget → ${table} (BUD-2026-90001, ${fmt(Number(n.montant))} F, tout le parc)`, Number(n.montant) === 1200000 && n.business_unit === null);
}
const sansBase = ligneCreation("budget", "BUD-2026-90002", { exercice: "2026", poste: "divers", montant: 100 }, r);
attendu(`une enveloppe sans base est refusée (${"refus" in sansBase ? sansBase.refus : "acceptée"})`, "refus" in sansBase);
const sansExercice = ligneCreation("budget", "BUD-2026-90003", { poste: "divers", montant: 100, base: "x" }, r);
attendu(`une enveloppe sans exercice est refusée (${"refus" in sansExercice ? sansExercice.refus : "acceptée"})`, "refus" in sansExercice);
const modification = colonnesModification("budget", [{ champ: "montant", valeur: "1 500 000" }, { champ: "base", valeur: "revue au comité de septembre" }]);
await pg.query(`update enveloppe set montant = $1, base = $2 where numero = 'BUD-2026-90001'`, [modification.montant, modification.base]);

/* ---- 5. La relecture porte les écritures ---- */
const enveloppes2 = ((await pg.query(`select numero, exercice, poste, business_unit, montant, profil, base, commentaire from enveloppe where exercice = $1 order by numero`, [exercice])).rows as LigneEnveloppe[]);
const source2 = sourceDepuisLignes(enveloppes2, depenses, achats, aujourdhui);
const budget2 = donneesBudgetDe(source2);
const divers = budget2.postes.find((p) => p.poste === "divers");
const posee = divers?.parBu.find((s) => s.enveloppe.numero === "BUD-2026-90001");
attendu(`le budget relu porte l'enveloppe posée puis corrigée (${fmt(posee?.enveloppe.montant ?? 0)} F, « ${posee?.enveloppe.base} », état ${posee?.etat})`, posee?.enveloppe.montant === 1500000 && posee.enveloppe.base === "revue au comité de septembre" && posee.etat !== "sans-budget");
attendu(`la synthèse a grandi d'autant (${fmt(budget2.synthese.budget - budget.synthese.budget)} F)`, budget2.synthese.budget - budget.synthese.budget === 1500000);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);
