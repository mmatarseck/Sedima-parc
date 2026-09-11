/* ============================================================================
 * Ce que le tableau de bord dit, sur les données réelles.
 *
 * Pourquoi ce rapport. Le 10 septembre 2026, six chargements réels sont entrés
 * en une journée — carburant, maintenance, transport, kilométrages,
 * conformité — et chacun a révélé, après coup, un défaut d'affichage : « 0 L »
 * pour une source tarie, un détenteur absent de la fiche. Personne n'avait
 * encore regardé l'ensemble. Ce script le regarde.
 *
 * Il monte une base à l'**état final de la production** — migrations, seed,
 * purge, puis tous les chargements dans l'ordre —, assemble les données du
 * tableau de bord exactement comme la page le fait, et passe par le code du
 * domaine chaque pastille et chaque courbe. Il ne juge pas : il imprime ce
 * qu'un utilisateur verrait, avec en regard la couverture des données mois par
 * mois, pour qu'on sache distinguer un vrai zéro d'un mois sans relevé.
 *
 * Ce n'est pas un banc — il n'échoue pas. C'est une photographie, à relancer
 * après chaque nouveau chargement.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/rapport-tableau-reel.mts
 * ==========================================================================*/

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fusionnerParametres } from "../src/domaine/parametres";
import { PASTILLES, evaluerPastille, type SituationJournaliere } from "../src/domaine/pastilles";
import { INDICATEURS_COURBE, cumuler } from "../src/domaine/tableau-bord";
import { echeancesEntretienDeLaBase, ligneDepuisLaBase, type ParcBrut } from "../src/donnees/flotte";
import { donneesDepuisLaBase, moisDuTableau, type TableauJson } from "../src/donnees/tableau-bord";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const MOI = "00000000-0000-0000-0000-000000000001";

/* -- 1. La base, dans l'état final de la production ------------------------ */

const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  insert into auth.users values ('${MOI}');
  create function auth.uid() returns uuid language sql stable as $$ select '${MOI}'::uuid $$;`);
for (const r of ["anon", "authenticated", "service_role"]) {
  try {
    await pg.exec(`create role ${r}`);
  } catch {}
}
for (const m of readdirSync(join(projet, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
await pg.exec(`insert into profil (utilisateur_id, nom, role, actif) values ('${MOI}', 'Rapport', 'administrateur', true) on conflict do nothing;`);
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) {
    courant.push(ligne);
    if (!/^on conflict .*;$/.test(ligne.trim())) continue;
    try {
      await pg.exec(courant.join("\n"));
    } catch {}
    courant = [];
  }
}
const purge = readFileSync(join(projet, "supabase/purge-demonstration.sql"), "utf8");
await pg.exec(purge.slice(purge.indexOf("begin;"), purge.indexOf("commit;") + 7));
/* En production, le référentiel précède 0039 : on rejoue la pose des régimes fiscaux, que les migrations, jouées ici avant le seed, n'ont trouvé à appliquer nulle part. */
for (const bloc of readFileSync(join(projet, "supabase/migrations/0039_regime_fiscal.sql"), "utf8").match(/update profil_transporteur set regime_fiscal[^;]*;/g) ?? []) await pg.exec(bloc);

/** Joue un fichier en coupant sa requête de vérification finale, qui ne sert qu'à l'œil. */
async function jouer(chemin: string): Promise<void> {
  const t = readFileSync(chemin, "utf8");
  const fin = t.indexOf("-- Vérification");
  await pg.exec(fin < 0 ? t : t.slice(0, fin));
}
/* Les fichiers corrigés, sur une base neuve : c'est le même état que la
   production après ses correctifs — vérifié au litre et au franc le jour même. */
for (const dossier of ["carburant-parties", "maintenance-parties", "transport-parties", "releve-parties"]) {
  const d = join(projet, "supabase", dossier);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter((x) => x.endsWith(".sql")).sort()) await jouer(join(d, f));
}
for (const f of ["kilometrages.sql", "conformite.sql", "ca-location-aout-2026.sql"]) if (existsSync(join(projet, "supabase", f))) await jouer(join(projet, "supabase", f));

const aujourdhui = ((await pg.query(`select current_date::text as j`)).rows[0] as { j: string }).j;

/* -- 2. La couverture : quels mois portent des données ---------------------- */

const couverture = (await pg.query<{ mois: string; pleins: number; inter: number; dep: number; prs: number; km: number }>(
  `with m as (select to_char(d, 'YYYY-MM') as mois from generate_series(date_trunc('month', current_date) - interval '11 months', current_date, interval '1 month') d)
   select m.mois,
     (select count(*) from plein p where to_char(p.date, 'YYYY-MM') = m.mois)::int as pleins,
     (select count(*) from intervention i where to_char(i.date, 'YYYY-MM') = m.mois)::int as inter,
     (select count(*) from depense x where to_char(x.date, 'YYYY-MM') = m.mois)::int as dep,
     (select count(*) from prestation s where to_char(s.date, 'YYYY-MM') = m.mois)::int as prs,
     (select count(*) from releve_kilometrique r where to_char(r.date, 'YYYY-MM') = m.mois)::int as km
   from m order by m.mois`,
)).rows;

console.log(`\nÉTAT AU ${aujourdhui}\n`);
console.log("COUVERTURE — lignes en base par mois");
console.log("  mois      pleins  interv.  dépenses  prestations  relevés km");
for (const c of couverture) console.log(`  ${c.mois}  ${String(c.pleins).padStart(6)}  ${String(c.inter).padStart(7)}  ${String(c.dep).padStart(8)}  ${String(c.prs).padStart(11)}  ${String(c.km).padStart(10)}`);

/* -- 3. Les données du tableau, assemblées comme la page -------------------- */

type Brut = Record<string, unknown>;
const depuis = `${moisDuTableau(aujourdhui)[0]}-01`;
const j = ((await pg.query(`select lire_tableau($1) as j`, [depuis])).rows[0] as { j: TableauJson }).j;

const unAn = new Date(Date.parse(`${aujourdhui}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
const jp = ((await pg.query(`select lire_parc($1) as j`, [unAn])).rows[0] as { j: Record<string, Brut[]> }).j;
const tableau = <T,>(cle: string) => (jp[cle] ?? []) as unknown as T;
/* Les paramètres comme le serveur les lit : les types de document de la base,
   et ceux dont aucune pièce n'existe marqués non suivis (0037). Sans eux, le
   rapport jugerait les fiches avec les défauts, et la carte grise jamais
   saisie les rendrait toutes non conformes — ce que l'application ne fait plus. */
const suivisEnBase = new Set((await pg.query<{ type_document_id: string }>(`select type_document_id from types_document_suivis()`)).rows.map((r) => r.type_document_id));
const typesEnBase = (await pg.query<{ id: string; libelle: string; porteur: string; applicabilite: string; validite_mois: number | null; critique: boolean; standard: boolean }>(
  `select id, libelle, porteur, applicabilite, validite_mois, critique, standard from type_document`,
)).rows;
const parametres = fusionnerParametres({
  documents: { types: typesEnBase.map((t) => ({ id: t.id, libelle: t.libelle, porteur: t.porteur, applicabilite: t.applicabilite, validiteMois: t.validite_mois, critique: t.critique, standard: t.standard, ...(suivisEnBase.has(t.id) ? {} : { suivi: false }) })) },
});
console.log(`
TYPES DE DOCUMENT NON SUIVIS : ${parametres.documents.types.filter((t) => t.suivi === false).map((t) => t.id).join(", ") || "aucun"}`);

const parc: ParcBrut = {
  aujourdhui,
  attributions: tableau("attributions"),
  attributaires: new Map(tableau<Brut[]>("attributaires").map((a) => [String(a.id), a])) as never,
  aRecevoir: tableau("a_recevoir"),
  vehicules: tableau("vehicules"),
  sites: new Map(tableau<Brut[]>("sites").map((s) => [String(s.id), { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }])) as never,
  chauffeurs: new Map(tableau<Brut[]>("chauffeurs").map((c) => [String(c.id), c])) as never,
  affectations: tableau("affectations"),
  documents: tableau("documents"),
  licences: tableau("licences"),
  licencesVehicules: tableau("licences_vehicules"),
  releves: tableau("releves"),
  depenses: tableau("depenses"),
  pleins: tableau("pleins"),
  interventions: tableau("interventions"),
};
const lignes = parc.vehicules.map((v) => ligneDepuisLaBase(v, parc, parametres));

const nombre = (v: unknown): number => (typeof v === "number" ? v : Number(v));
const nombreOuNul = (v: unknown): number | null => (v === null || v === undefined ? null : nombre(v));
const depuis28 = new Date(Date.parse(`${aujourdhui}T00:00:00Z`) - 27 * 86_400_000).toISOString().slice(0, 10);
const brutes = ((await pg.query(`select situation_journaliere($1, $2) as j`, [depuis28, aujourdhui])).rows[0] as { j: { jour: string; vehicules: Brut[]; flotte: Brut }[] }).j;
const situations: SituationJournaliere[] = brutes.map((s) => ({
  jour: s.jour,
  vehicules: s.vehicules.map((v) => ({
    vehiculeId: String(v.vehicule_id),
    jour: s.jour,
    engage: Boolean(v.engage),
    statut: v.statut as never,
    immobiliseAdmin: Boolean(v.immobilise_admin),
    immobiliseDepuisJours: nombreOuNul(v.immobilise_depuis_jours),
    echeances7: nombre(v.echeances7),
    echues: nombre(v.echues),
    sansReleve7: Boolean(v.sans_releve7),
    litres: nombre(v.litres),
    carburant: nombre(v.carburant),
    depenses: nombre(v.depenses),
    pannes: nombre(v.pannes),
    accidents: nombre(v.accidents),
    pretACharger: Boolean(v.pret_a_charger),
  })),
  flotte: {
    jour: s.jour,
    chauffeurs: nombre(s.flotte.chauffeurs),
    chauffeursIndisponibles: nombre(s.flotte.chauffeurs_indisponibles),
    ordresOuverts: nombreOuNul(s.flotte.ordres_ouverts),
    ordresAnciens: nombreOuNul(s.flotte.ordres_anciens),
    soldeCaisse: nombreOuNul(s.flotte.solde_caisse),
    seuilCaisse: nombreOuNul(s.flotte.seuil_caisse),
    cuveLitres: nombreOuNul(s.flotte.cuve_litres),
    cuveJours: nombreOuNul(s.flotte.cuve_jours),
    joursSansAccident: nombreOuNul(s.flotte.jours_sans_accident),
    demandesSansReponse: nombreOuNul(s.flotte.demandes_sans_reponse),
    dernierPlein: (s.flotte.dernier_plein as string | null) ?? null,
    dernierReleveTransport: (s.flotte.dernier_releve_transport as string | null) ?? null,
    tiersCamions: nombreOuNul(s.flotte.tiers_camions),
    tiersMad: nombreOuNul(s.flotte.tiers_mad),
    tiersMadPanne: nombreOuNul(s.flotte.tiers_mad_panne),
    tiersAffretementsOuverts: nombreOuNul(s.flotte.tiers_affretements_ouverts),
    tiersTonnage7: nombreOuNul(s.flotte.tiers_tonnage7),
    tonnage7: nombreOuNul(s.flotte.tonnage7),
    tiersFactures: nombreOuNul(s.flotte.tiers_factures),
    tiersFacturesMontant: nombreOuNul(s.flotte.tiers_factures_montant),
  },
}));

const d = donneesDepuisLaBase(j, lignes, situations, [], parametres, aujourdhui);

/* -- 3 bis. Le plan d'entretien des véhicules engagés ---------------------- */

/* Ce que « Respect du plan préventif » peut vraiment dire. Une opération sans
   passage relevé est « sans référence » : on ne sait pas si elle est en retard. */
const plan = { enRetard: 0, connu: 0, partiel: 0, inconnu: 0, sansCompteur: 0, operations: 0, sansReference: 0 };
parc.vehicules.forEach((brut, i) => {
  const l = lignes[i]!;
  if (!l.vehicule.engage || (l.vehicule.regime ?? "exploitation") !== "exploitation") return;
  if (l.kilometrage === null) plan.sansCompteur++;
  const compteur = l.kilometrage !== null && l.dateKilometrage ? { km: l.kilometrage, date: l.dateKilometrage } : null;
  const ech = echeancesEntretienDeLaBase(l.vehicule, String(brut.id), compteur, parc);
  plan.operations += ech.length;
  const sans = ech.filter((e) => e.etat === "sans-reference").length;
  plan.sansReference += sans;
  if (ech.some((e) => e.etat === "en-retard")) plan.enRetard++;
  else if (sans === 0) plan.connu++;
  else if (sans < ech.length) plan.partiel++;
  else plan.inconnu++;
});
console.log(`
PLAN D'ENTRETIEN — véhicules engagés d'exploitation`);
console.log(`  ${plan.enRetard} en retard · ${plan.connu} à jour, toutes opérations connues · ${plan.partiel} sans retard connu mais avec des opérations sans passage · ${plan.inconnu} sans aucun passage relevé`);
console.log(`  ${plan.sansReference} opérations sans passage sur ${plan.operations} · ${plan.sansCompteur} véhicules sans compteur`);

/* -- 4. Les pastilles ------------------------------------------------------- */

const affiche = (v: number | null) => (v === null ? "—" : Number.isNaN(v) ? "NaN !" : v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }));

console.log(`\nPASTILLES — ce qu'un administrateur verrait (${PASTILLES.length})`);
for (const p of PASTILLES) {
  const e = evaluerPastille(p, situations);
  const rouge = e.alerte ? "  ROUGE" : "";
  console.log(`  ${p.libelle.padEnd(32)} ${affiche(e.valeur).padStart(10)} ${p.unite ?? ""}`.padEnd(52) + `  ${(e.complement ?? "").padEnd(30)} ${e.referenceTexte}${rouge}`);
}

/* -- 5. Les courbes, mois par mois ------------------------------------------ */

const exercice = aujourdhui.slice(0, 4);
const moisExercice = d.mois.filter((m) => m.startsWith(exercice) && m <= aujourdhui.slice(0, 7));
console.log(`\nCOURBES — valeur mensuelle sur ${exercice} (${INDICATEURS_COURBE.length} indicateurs)`);
console.log(`  ${"".padEnd(40)} ${moisExercice.map((m) => m.slice(5)).map((m) => m.padStart(8)).join("")}`);
for (const ind of INDICATEURS_COURBE) {
  if (!ind.calcul) continue;
  const valeurs = moisExercice.map((m) => {
    const c = cumuler(
      d.faits.filter((f) => f.mois === m),
      d.flotte.filter((f) => f.mois === m),
      d.jour,
      30.44,
    );
    return ind.calcul!(c);
  });
  const signal = valeurs.every((v) => v === null) ? "   ← aucune valeur de l'année" : valeurs.some((v) => v !== null && !Number.isFinite(v)) ? "   ← NaN ou infini" : "";
  console.log(`  ${`${ind.axe} ${ind.libelle}`.slice(0, 40).padEnd(40)} ${valeurs.map((v) => affiche(v).padStart(8)).join("")}${signal}`);
}
console.log("");
