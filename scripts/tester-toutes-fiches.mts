/* Les fiches de TOUT le parc, et non plus une seule.
 *
 * `tester-fiche.mts` vérifie une fiche en détail — AA 032 EA, dont on connaît
 * chaque ligne. C'est le bon banc pour prouver qu'un calcul est juste, et le
 * mauvais pour trouver ce qui casse ailleurs : le parc est passé de 19 à 167
 * véhicules le 10 septembre 2026, et les nouveaux arrivent avec des champs
 * vides que le jeu de démonstration n'avait jamais — ni VIN, ni date de
 * première mise en circulation, ni PTAC, souvent aucun relevé.
 *
 * Ce banc-ci ne vérifie donc pas des valeurs, mais des **invariants** : ce qui
 * doit être vrai de n'importe quelle fiche, quelle que soit la maigreur de ses
 * données. Il les applique aux 167. Un invariant tient ou ne tient pas ; s'il
 * casse, il nomme le véhicule.
 *
 * La règle qui compte le plus est la dernière : **une valeur inconnue se dit
 * `null`, jamais zéro**. C'est la discipline posée le 10 septembre après avoir
 * trouvé « 0 F de coût d'incidents » sur une fiche chauffeur. Un zéro affirme
 * qu'on a mesuré et trouvé rien ; un tiret avoue qu'on ne sait pas.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-toutes-fiches.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { assemblerFiche, type FaitsFiche } from "../src/domaine/assembler-fiche";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { passagesReleves, planDuVehicule, programmeParDefaut } from "../src/donnees/entretien-demo";
import { ligneDepuisLaBase, type ParcBrut } from "../src/donnees/flotte";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");

const projet = process.cwd();
const MOI = "00000000-0000-0000-0000-000000000001";
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
await pg.exec(`insert into profil (utilisateur_id, nom, role, actif) values ('${MOI}', 'Banc', 'administrateur', true) on conflict do nothing;`);
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

const AUJOURDHUI = "2026-09-02";
let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- lire_parc rend du JSON libre ; la conversion est faite juste après. */
const jp = (await pg.query(`select lire_parc($1) as j`, ["2025-09-02"])).rows[0].j as Record<string, any[]>;
const parc: ParcBrut = {
  aujourdhui: AUJOURDHUI,
  attributions: jp.attributions!,
  attributaires: new Map(jp.attributaires!.map((a) => [a.id, a])),
  aRecevoir: jp.a_recevoir!,
  vehicules: jp.vehicules!,
  sites: new Map(jp.sites!.map((s) => [s.id, { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }])),
  chauffeurs: new Map(jp.chauffeurs!.map((c) => [c.id, c])),
  affectations: jp.affectations!,
  documents: jp.documents!,
  licences: jp.licences!,
  licencesVehicules: jp.licences_vehicules!,
  releves: jp.releves!,
  depenses: jp.depenses!,
  pleins: jp.pleins!,
  interventions: jp.interventions!,
};
const lignes = parc.vehicules.map((v) => ligneDepuisLaBase(v, parc, PARAMETRES_DEFAUT));
console.log(`\n${lignes.length} véhicules à passer en revue.\n`);

/* Les manquements, rassemblés par règle : une règle qui casse sur trente
   véhicules est un défaut, pas trente. On nomme les trois premiers. */
const manquements = new Map<string, string[]>();
const exiger = (regle: string, vehicule: string, ok: boolean) => {
  if (ok) return;
  const liste = manquements.get(regle) ?? [];
  liste.push(vehicule);
  manquements.set(regle, liste);
};

const fini = (x: number | null): boolean => x === null || Number.isFinite(x);
const t0 = performance.now();
let assemblees = 0;
let sansReleve = 0;
const zeroKm: string[] = [];
let sansPlein = 0;

for (const ligne of lignes) {
  const v = ligne.vehicule;
  const nom = v.immatriculationAffichee || v.immatriculation;
  const brut = (await pg.query(`select lire_fiche($1) as j`, [v.immatriculation])).rows[0].j as Record<string, any[]> | null;
  if (!brut) {
    exiger("lire_fiche rend une fiche pour chaque véhicule du parc", nom, false);
    continue;
  }
  const faits: FaitsFiche = {
    documents: brut.documents!.map((d) => ({ numero: d.numero, type: d.type_document_id, dateEffet: d.date_effet, echeance: d.echeance, emetteur: d.emetteur, numeroPiece: d.numero_piece, montant: d.montant, justificatif: d.justificatif })),
    licences: brut.licences!.map((l) => ({ numero: l.numero, libelle: l.libelle, numeroPiece: l.numero_piece, emetteur: l.emetteur, perimetre: l.perimetre, dateEffet: l.date_effet, echeance: l.echeance, vehicules: Number(l.vehicules) })),
    affectations: brut.affectations!.map((a) => ({ numero: a.numero, chauffeurId: a.chauffeur_id, chauffeur: a.chauffeur, role: a.role, debut: a.debut, fin: a.fin, motif: a.motif })),
    releves: brut.releves!.map((r) => ({ numero: r.numero, date: r.date, km: r.km, origine: r.origine, motifRejet: r.motif_rejet })),
    pleins: brut.pleins!.map((p) => ({ numero: p.numero, date: p.date, litres: Number(p.litres), prixLitre: p.prix_litre, montant: p.montant, km: p.km, source: p.source, reference: p.reference })),
    depenses: brut.depenses!.map((d) => ({ ...d, kmMotifRejet: d.km_motif_rejet })),
    interventions: brut.interventions!.map((i) => ({ numero: i.numero, date: i.date, type: i.type, objet: i.objet, garage: i.garage, montant: i.montant, immobilisationJours: i.immobilisation_jours, km: i.km, reference: i.reference })),
    statuts: brut.statuts as FaitsFiche["statuts"],
  };

  const fiche = assemblerFiche(ligne, faits, PARAMETRES_DEFAUT, AUJOURDHUI, {
    programme: programmeParDefaut(v.categorie),
    plan: planDuVehicule(v.id, v.categorie),
    passages: passagesReleves,
  });
  assemblees++;
  const i = fiche.indicateurs;

  /* -- 1. Aucun nombre ne part en vrille -------------------------------------
   * `NaN` s'affiche « NaN » à l'écran et se propage à toute somme qui le
   * touche. Une division par un dénominateur nul en produit sans se plaindre,
   * et un parc où beaucoup de véhicules n'ont aucun relevé en offre l'occasion
   * à chaque ligne. */
  exiger("aucun indicateur n'est NaN ou infini", nom, [i.kilometrage, i.kmParMois, i.consommationL100, i.coutDouzeMois, i.coutParKm, i.disponibilitePct].every(fini));

  /* -- 2. Les bornes du sens commun ----------------------------------------- */
  exiger("le kilométrage n'est pas négatif", nom, i.kilometrage === null || i.kilometrage >= 0);
  exiger("le rythme mensuel n'est pas négatif", nom, i.kmParMois === null || i.kmParMois >= 0);
  exiger("le coût sur douze mois n'est pas négatif", nom, i.coutDouzeMois === null || i.coutDouzeMois >= 0);
  exiger("le coût kilométrique n'est pas négatif", nom, i.coutParKm === null || i.coutParKm >= 0);
  exiger("la disponibilité reste entre 0 et 100 %", nom, i.disponibilitePct === null || (i.disponibilitePct >= 0 && i.disponibilitePct <= 100));
  /* Un camion sénégalais chargé monte à 60 L/100 ; au-delà de 200, ce n'est
     plus une consommation, c'est un compteur remis à zéro ou un plein saisi
     sur le mauvais véhicule. La borne haute est large exprès : elle cherche
     l'absurde, pas l'inhabituel. */
  exiger("la consommation reste dans une plage plausible (0 à 200 L/100)", nom, i.consommationL100 === null || (i.consommationL100 > 0 && i.consommationL100 <= 200));

  /* -- 3. Les périodes de statut se suivent --------------------------------- */
  for (const p of fiche.periodesStatut) exiger("une période de statut ne finit pas avant de commencer", nom, p.fin === null || p.fin >= p.debut);

  /* -- 4. L'inconnu se dit « null », jamais zéro ----------------------------
   * C'est la règle du 10 septembre 2026, née d'un « 0 F de coût d'incidents »
   * qui affirmait ce qu'il ignorait. Sans plein, on ne connaît pas la
   * consommation ; sans relevé ni plein compteur, on ne connaît pas le
   * kilométrage. Le tiret est la seule réponse honnête. */
  const pleinsAvecKm = faits.pleins.filter((p) => p.km !== null);
  const relevesValides = faits.releves.filter((r) => r.motifRejet === null);
  if (!faits.pleins.length) {
    sansPlein++;
    exiger("sans aucun plein, la consommation est nulle et non zéro", nom, i.consommationL100 === null);
  }
  if (!relevesValides.length && !pleinsAvecKm.length) {
    sansReleve++;
    /* Strict : `null`, et surtout pas 0. Le premier jet acceptait les deux,
       ce qui ne prouvait rien ; la mesure a montré que les 111 fiches vides
       disent bien « — », alors la règle le demande maintenant. */
    exiger("sans relevé ni plein compteur, le kilométrage est nul et non zéro", nom, i.kilometrage === null);
    if (i.kilometrage === 0) zeroKm.push(nom);
    exiger("sans relevé ni plein compteur, le coût kilométrique est nul et non zéro", nom, i.coutParKm === null);
  }
}

console.log(`${assemblees} fiches assemblées en ${Math.round(performance.now() - t0)} ms`);
console.log(`   ${zeroKm.length} annonce(nt) « 0 km » ; les autres disent « — », qui est la seule réponse honnête.`);
console.log(`dont ${sansPlein} sans aucun plein et ${sansReleve} sans relevé ni plein compteur — ce sont elles qui éprouvent la règle du tiret.\n`);

const REGLES = [
  "lire_fiche rend une fiche pour chaque véhicule du parc",
  "aucun indicateur n'est NaN ou infini",
  "le kilométrage n'est pas négatif",
  "le rythme mensuel n'est pas négatif",
  "le coût sur douze mois n'est pas négatif",
  "le coût kilométrique n'est pas négatif",
  "la disponibilité reste entre 0 et 100 %",
  "la consommation reste dans une plage plausible (0 à 200 L/100)",
  "une période de statut ne finit pas avant de commencer",
  "sans aucun plein, la consommation est nulle et non zéro",
  "sans relevé ni plein compteur, le kilométrage est nul et non zéro",
  "sans relevé ni plein compteur, le coût kilométrique est nul et non zéro",
];
for (const regle of REGLES) {
  const fautifs = manquements.get(regle) ?? [];
  attendu(fautifs.length ? `${regle} — ${fautifs.length} véhicule(s) : ${fautifs.slice(0, 3).join(", ")}${fautifs.length > 3 ? "…" : ""}` : regle, fautifs.length === 0);
}

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} règle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);
