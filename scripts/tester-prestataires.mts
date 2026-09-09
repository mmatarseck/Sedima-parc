/* Le module Prestataires depuis la base, dans PGlite avec le seed :
 * lire_prestataires() avec les achats et le transport, puis l'assemblage du
 * domaine — les résumés de la liste, la fiche et le compte, comparés à ce
 * que la démonstration dresse sur le même jeu ; puis les écritures d'une
 * avance et d'une évaluation, et leurs refus.
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-prestataires.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { comptePrestataireDe, fichePrestataireDe, notationDe, resumesDe } from "../src/domaine/assembler-prestataires";
import { achatDepuisLigne, type LigneAchatBase } from "../src/donnees/achats";
import { DATE_REFERENCE } from "../src/donnees/chauffeurs-demo";
import { sourcePrestatairesDemo } from "../src/donnees/compte-prestataire-demo";
import { depuisPour, sourceDepuisJson, type PrestatairesJson } from "../src/donnees/prestataires";
import { depuisPour as depuisTransport, sourceDepuisJson as transportDepuisJson, type TransporteursJson } from "../src/donnees/transporteurs";
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

/* ---- 1. La lecture : la fonction, les achats, le transport ---- */
const aujourdhui = DATE_REFERENCE;
const t0 = performance.now();
const j = (await pg.query(`select lire_prestataires($1) as j`, [depuisPour(aujourdhui)])).rows[0].j as PrestatairesJson;
const tLecture = Math.round(performance.now() - t0);
console.log(`lire_prestataires en ${tLecture} ms : ${j.prestataires.length} prestataires, ${j.interventions.length} interventions, ${j.pleins.length} pleins, ${j.depenses.length} dépenses de caisse, ${j.documents.length} documents, ${j.visites.length} visites, ${j.avances.length} avances, ${j.evaluations.length} évaluations`);
const achats = ((await pg.query(`select a.numero, a.date, a.objet, a.poste, a.montant_estime, a.fournisseur, a.urgence, a.origine_numero, a.origine_libelle, a.demandeur_nom, a.demandeur_role, a.etape, a.visa_par, a.visa_le, a.valide_par, a.validee_le, a.numero_demande_x3, a.numero_bon_commande, a.montant_engage, a.date_livraison, a.date_facture, a.montant_reel, a.date_reglement, a.depense_numero, a.commentaire_decision,
  (select jsonb_build_object('immatriculation', v.immatriculation, 'business_unit', v.business_unit, 'site', null) from vehicule v where v.id = a.vehicule_id) as vehicule,
  (select jsonb_build_object('numero', p.numero, 'raison_sociale', p.raison_sociale) from prestataire p where p.id = a.prestataire_id) as prestataire from demande_achat a`)).rows as Record<string, unknown>[])
  .map((r) => ({ ...r, date: iso(r.date), date_livraison: iso(r.date_livraison), date_facture: iso(r.date_facture), date_reglement: iso(r.date_reglement), visa_le: iso(r.visa_le), validee_le: iso(r.validee_le) }) as unknown as LigneAchatBase)
  .map(achatDepuisLigne);
const jt = (await pg.query(`select lire_transporteurs($1) as j`, [depuisTransport(aujourdhui)])).rows[0].j as TransporteursJson;
const transport = transportDepuisJson(jt, aujourdhui);
const t1 = performance.now();
const source = sourceDepuisJson(j, achats, transport, aujourdhui);
const resumes = resumesDe(source);
const tAssemblage = Math.round(performance.now() - t1);
console.log(`source assemblée en ${tAssemblage} ms : ${source.interventions.length} interventions rapportées, ${source.pleins.length} pleins, ${source.depensesCaisse.length} dépenses, ${source.documents.length} documents, ${source.visites.length} visites`);
/* ---- 2. La liste, ligne à ligne contre la démonstration ---- */
const demo = sourcePrestatairesDemo();
const resumesDemo = resumesDe(demo);
attendu(`autant de prestataires qu'en démonstration (${source.prestataires.length} / ${demo.prestataires.length})`, source.prestataires.length === demo.prestataires.length);
let ecarts = 0;
for (const p of demo.prestataires) {
  const b = resumes[p.numero];
  const d = resumesDemo[p.numero];
  if (!b || !d) { attendu(`${p.raisonSociale} manque`, false); continue; }
  const memes = b.interventionsTotal === d.interventionsTotal && b.du === d.du && b.avances === d.avances && b.evaluations === d.evaluations && b.note.score === d.note.score && b.documents === d.documents && b.visites === d.visites && b.pleins === d.pleins && b.demandes === d.demandes && b.anciennete === d.anciennete;
  const montant = Math.abs(b.montant - d.montant) <= 1;
  if (!memes || !montant) ecarts++;
  attendu(
    `${p.raisonSociale} : ${b.interventionsTotal} prestations (démo ${d.interventionsTotal}), ${fmt(b.montant)} F 12 mois (démo ${fmt(d.montant)}), dû ${fmt(b.du)} (démo ${fmt(d.du)}), avances ${fmt(b.avances)}, ${b.evaluations} évaluations, note ${b.note.niveau ?? "—"} ${b.note.score ?? ""} (démo ${d.note.niveau ?? "—"} ${d.note.score ?? ""}), ${b.documents} documents, ${b.visites} visites`,
    memes && montant,
  );
}
attendu(`aucun écart entre la base et la démonstration (${ecarts})`, ecarts === 0);

/* ---- 3. La fiche et le compte ---- */
const adex = demo.prestataires.find((p) => p.raisonSociale === "ADEX Express")!;
const compte = comptePrestataireDe(source, adex.numero)!;
const compteDemo = comptePrestataireDe(demo, adex.numero)!;
attendu(`le compte ADEX : ${compte.dettes.length} pièces dues pour ${fmt(compte.dettes.reduce((t, x) => t + x.montant, 0))} F (démo ${compteDemo.dettes.length}), ${compte.avances.length} avance ouverte de ${fmt(compte.avances[0]?.montant ?? 0)} F, ${compte.transport.missions} missions`,
  compte.dettes.length === compteDemo.dettes.length && compte.avances.length === 1 && compte.avances[0]?.imputeeSur === null && compte.transport.missions === compteDemo.transport.missions);
const sa = demo.prestataires.find((p) => p.raisonSociale === "La Sénégalaise de l'Automobile")!;
const fiche = fichePrestataireDe(source, sa.numero)!;
const ficheDemo = fichePrestataireDe(demo, sa.numero)!;
const compteSa = comptePrestataireDe(source, sa.numero)!;
attendu(`la fiche de la Sénégalaise porte ${fiche.interventions.length} interventions (démo ${ficheDemo.interventions.length}), ${fiche.demandes.length} demandes (démo ${ficheDemo.demandes.length}), ${fiche.documents.length} documents, ${compteSa.evaluations.length} évaluations, note ${notationDe(compteSa).niveau} ${notationDe(compteSa).score}`,
  fiche.interventions.length === ficheDemo.interventions.length && fiche.demandes.length === ficheDemo.demandes.length && compteSa.evaluations.length === 3 && notationDe(compteSa).score === notationDe(comptePrestataireDe(demo, sa.numero)!).score);
attendu(`les évaluations citent leur pièce (${compteSa.evaluations[0]?.pieceNumero} · ${compteSa.evaluations[0]?.pieceLibelle})`, compteSa.evaluations.every((e) => e.pieceNumero && e.pieceLibelle));
attendu(`la fiche d'un numéro inconnu est nulle`, fichePrestataireDe(source, "PRE-2026-99999") === null && comptePrestataireDe(source, "PRE-2026-99999") === null);
const ccva = demo.prestataires.find((p) => p.raisonSociale === "CCVA Rufisque")!;
const ficheCcva = fichePrestataireDe(source, ccva.numero)!;
attendu(`un centre agréé retrouve ses visites par son nom (${ficheCcva.visites.length} visites, démo ${fichePrestataireDe(demo, ccva.numero)!.visites.length})`, ficheCcva.visites.length === fichePrestataireDe(demo, ccva.numero)!.visites.length && ficheCcva.visites.length > 0);

/* ---- 4. Les écritures ---- */
const utilisateur = "00000000-0000-0000-0000-000000000001";
async function inserer(table: string, ligne: Record<string, unknown>) {
  const cles = Object.keys(ligne);
  await pg.query(`insert into ${table} (${cles.join(", ")}, cree_par) values (${cles.map((_, i) => `$${i + 1}`).join(", ")}, $${cles.length + 1})`, [...cles.map((k) => ligne[k]), utilisateur]);
}
const pSa = (await pg.query(`select id from prestataire where raison_sociale = $1`, [sa.raisonSociale])).rows[0] as { id: string };
const r = { vehiculeId: null, chauffeurId: null, prestataireId: pSa.id };
const piece = fiche.interventions[0]!;
const essais: { type: Parameters<typeof ligneCreation>[0]; numero: string; valeurs: Record<string, unknown> }[] = [
  { type: "avance", numero: "AVA-2026-90001", valeurs: { date: "2026-09-09", montant: "750 000", motif: "Acompte sur commande de pièces", autorisePar: "Direction des Opérations" } },
  { type: "evaluation", numero: "EVA-2026-90001", valeurs: { date: "2026-09-09", pieceNumero: piece.numero, pieceLibelle: `${piece.objet} — ${piece.immatriculationAffichee}`, qualite: "4", delai: 5, prix: 3, commentaire: "Bien, un peu cher.", auteur: "M. Seck" } },
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
const sansMotif = ligneCreation("avance", "AVA-2026-90002", { date: "2026-09-09", montant: 1000, autorisePar: "X" }, r);
attendu(`une avance sans motif est refusée (${"refus" in sansMotif ? sansMotif.refus : "acceptée"})`, "refus" in sansMotif);
const horsBareme = ligneCreation("evaluation", "EVA-2026-90002", { date: "2026-09-09", pieceNumero: piece.numero, qualite: 6, delai: 4, prix: 4, auteur: "X" }, r);
attendu(`une note hors barème est refusée (${"refus" in horsBareme ? horsBareme.refus : "acceptée"})`, "refus" in horsBareme);
const sansPrestataire = ligneCreation("evaluation", "EVA-2026-90003", { date: "2026-09-09", pieceNumero: piece.numero, qualite: 4, delai: 4, prix: 4, auteur: "X" }, { ...r, prestataireId: null });
attendu(`une évaluation sans prestataire est refusée (${"refus" in sansPrestataire ? sansPrestataire.refus : "acceptée"})`, "refus" in sansPrestataire);
/* L'avance s'impute sur une facture : une modification colonne par colonne. */
const imputation = colonnesModification("avance", [{ champ: "imputeeSur", valeur: "DAC-2026-00012" }, { champ: "dateImputation", valeur: "2026-09-20" }]);
await pg.query(`update avance_prestataire set imputee_sur = $1, date_imputation = $2 where numero = 'AVA-2026-90001'`, [imputation.imputee_sur, imputation.date_imputation]);

/* ---- 5. La relecture porte les écritures ---- */
const j2 = (await pg.query(`select lire_prestataires($1) as j`, [depuisPour(aujourdhui)])).rows[0].j as PrestatairesJson;
const source2 = sourceDepuisJson(j2, achats, transport, aujourdhui);
const compte2 = comptePrestataireDe(source2, sa.numero)!;
const avance = compte2.avances.find((a) => a.numero === "AVA-2026-90001");
const evaluation = compte2.evaluations.find((e) => e.numero === "EVA-2026-90001");
attendu(`le compte relu porte l'avance imputée sur ${avance?.imputeeSur} et l'évaluation (${evaluation?.notes.qualite}/${evaluation?.notes.delai}/${evaluation?.notes.prix} sur ${evaluation?.pieceLibelle})`,
  avance?.imputeeSur === "DAC-2026-00012" && avance.montant === 750000 && evaluation?.notes.qualite === 4 && evaluation.notes.delai === 5 && evaluation.pieceLibelle.includes(piece.objet));
attendu(`la note tient compte de la nouvelle évaluation (${notationDe(compte2).score} contre ${notationDe(compteSa).score}, ${compte2.evaluations.length} évaluations)`, compte2.evaluations.length === compteSa.evaluations.length + 1 && notationDe(compte2).score !== null);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);
