/* ============================================================================
 * Banc du point du matin — les attelages comptés comme une seule unité.
 *
 * Métier, 3 octobre 2026 : « les groupes tracteur-remorque doivent être
 * présentés comme un seul véhicule (une seule capacité utile) ». Pur : aucune
 * base, des lignes de disponibilité écrites à la main.
 *
 * Avec PGLITE_DIR, la règle de 0076 en base : un attelage ouvert clôt le
 * précédent à sa date de début.
 *
 *   PGLITE_DIR=/tmp/pglite node --import tsx scripts/tester-point-du-matin.mts
 * ==========================================================================*/

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { LigneDisponibilite } from "../src/domaine/disponibilite";
import { avecAttelages, pointDuMatin, texteCourriel } from "../src/domaine/point-du-matin";

let echecs = 0;
function attendu(libelle: string, ok: boolean) {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
}

function ligne(immatriculation: string, modif: Partial<LigneDisponibilite>): LigneDisponibilite {
  return {
    vehiculeId: immatriculation,
    immatriculation,
    immatriculationAffichee: `${immatriculation.slice(0, 2)}-${immatriculation.slice(2, 5)}-${immatriculation.slice(5)}`,
    marque: "RENAULT",
    appellation: "",
    categorie: "camion",
    categorieFlotte: "lourd" as never,
    businessUnit: "aliment",
    regime: "exploitation",
    attributaire: null,
    usage: "plateau",
    transportSpecial: false,
    site: null,
    statutSaisi: "en-service",
    statutEffectif: "en-service",
    immobilisation: null,
    engage: true,
    chargeUtile: 10_000,
    conducteur: null,
    attelage: null,
    etat: "sans-conducteur",
    motif: null,
    ...modif,
  };
}

const chauffeur = { id: "c1", nom: "Gora Diop", role: "titulaire" as const, empechement: null, telephone: null };

/* Un plateau attelé, prêt : 31 t au tracteur, 31 t à la semi — 31 t, pas 62. */
const tracteur = ligne("AA737ZW", { categorie: "tracteur", chargeUtile: 31_000, conducteur: chauffeur, etat: "pret", attelage: { immatriculation: "AA713VE", role: "tracteur" } });
const semi = ligne("AA713VE", { categorie: "semi-remorque", chargeUtile: 31_000, attelage: { immatriculation: "AA737ZW", role: "remorque" } });
/* Un vrac dont le tracteur est en réparation : la semi ne roule pas seule. */
const tracteurArrete = ligne("AA927CA", { categorie: "tracteur", usage: "vrac", chargeUtile: 31_000, statutSaisi: "en-reparation", statutEffectif: "en-reparation", etat: "immobilise", attelage: { immatriculation: "AA053AP", role: "tracteur" } });
/* La base porte aussi l'attelage inversé (ATT-2025-90001) : la semi s'y dit tracteur. */
const semiVrac = ligne("AA053AP", { categorie: "semi-remorque", usage: "vrac", chargeUtile: 29_060, attelage: { immatriculation: "AA927CA", role: "tracteur" } });
/* Un vrac dont la semi est en panne : l'unité est immobilisée. */
const tracteurPret = ligne("AB932EF", { categorie: "tracteur", usage: "vrac", chargeUtile: 16_150, conducteur: chauffeur, etat: "pret", attelage: { immatriculation: "AB551HS", role: "tracteur" } });
const semiEnPanne = ligne("AB551HS", { categorie: "semi-remorque", usage: "vrac", chargeUtile: 24_320, statutSaisi: "en-panne" as never, statutEffectif: "en-reparation", etat: "immobilise", attelage: { immatriculation: "AB932EF", role: "remorque" } });
/* Un porteur seul, prêt. */
const porteur = ligne("AA100AA", { chargeUtile: 10_000, conducteur: chauffeur, etat: "pret" });

const parc = [semi, tracteur, semiVrac, tracteurArrete, tracteurPret, semiEnPanne, porteur];
const reduits = avecAttelages(parc);
attendu(`sept plaques, quatre unités (${reduits.length})`, reduits.length === 4);
attendu("l'unité porte la plaque du tracteur, jamais celle de la semi", reduits.map((l) => l.immatriculation).sort().join() === ["AA100AA", "AA737ZW", "AA927CA", "AB932EF"].sort().join());

const point = pointDuMatin(parc, [], "2026-10-03");
const sedima = point.bus.flatMap((b) => b.groupes).filter((g) => !g.tiers);
const prets = sedima.flatMap((g) => g.disponibles);
const plateau = prets.find((v) => v.immatriculation === "AA737ZW");
attendu(`le plateau attelé : une ligne, deux plaques, 31 t (${plateau?.immatriculationAffichee}, ${plateau?.capaciteTonnes} t)`, plateau?.immatriculationAffichee === "AA-737-ZW + AA-713-VE" && plateau.capaciteTonnes === 31 && plateau.remorque?.immatriculation === "AA713VE");
attendu(`prêts : le plateau et le porteur, 41 t en tout (${prets.length}, ${point.capacites.tonnes} t)`, prets.length === 2 && point.capacites.tonnes === 41 && point.totalVehicules === 2);
attendu(`le total se partage entre parc et transporteurs (${point.parcPrets} + ${point.tiersPrets})`, point.parcPrets === 2 && point.tiersPrets === 0 && point.totalVehicules === point.parcPrets + point.tiersPrets);
attendu("la semi n'apparaît pas « sans chauffeur »", sedima.every((g) => g.sansChauffeur.length === 0));
const vrac = point.immobilises.find((i) => i.immatriculation === "AA927CA");
attendu(`tracteur en réparation : l'unité immobilisée une fois, attelage inversé compris (${vrac?.immatriculationAffichee} — ${vrac?.motif})`, vrac?.immatriculationAffichee === "AA-927-CA + AA-053-AP" && point.immobilises.filter((i) => i.immatriculationAffichee.includes("AA-053-AP")).length === 1);
const panne = point.immobilises.find((i) => i.immatriculation === "AB932EF");
attendu(`semi en panne : l'unité immobilisée, le motif nomme la semi (${panne?.motif})`, panne?.motif.startsWith("semi AB-551-HS") === true && !prets.some((v) => v.immatriculation === "AB932EF"));
attendu("le courriel cite l'unité sous ses deux plaques", texteCourriel(point, "samedi 3 octobre 2026").includes("AA-737-ZW + AA-713-VE 31 t"));

const bac = process.env.PGLITE_DIR ?? "";
if (bac) {
  const require = createRequire(join(bac, "package.json"));
  const { PGlite } = require("@electric-sql/pglite");
  const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
  const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
  const MOI = "00000000-0000-0000-0000-000000000001";
  const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
  await pg.exec(`create schema auth; create table auth.users (id uuid primary key); insert into auth.users values ('${MOI}');
    create function auth.uid() returns uuid language sql stable as $$ select '${MOI}'::uuid $$;`);
  for (const role of ["anon", "authenticated", "service_role"]) {
    try {
      await pg.exec(`create role ${role}`);
    } catch {}
  }
  /* Jusqu'à 0075 : l'état d'avant la règle, où un couple inversé passait. */
  const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
  for (const m of migrations.filter((f) => f < "0076")) await pg.exec(readFileSync(join("supabase/migrations", m), "utf8"));
  await pg.exec(`
    insert into vehicule (immatriculation, marque, appellation, categorie) values
      ('AA927CA', 'RENAULT', 'Tracteur', 'tracteur'), ('AA053AP', 'IVECO', 'Citerne vrac', 'semi-remorque'),
      ('AA737ZW', 'RENAULT', 'Tracteur', 'tracteur'), ('AA713VE', 'RENAULT', 'Plateau', 'semi-remorque'), ('AA214XK', 'TRAILOR', 'Plateau', 'semi-remorque');
    insert into attelage (numero, tracteur_id, remorque_id, debut, permanent) values
      ('ATT-2025-90001', (select id from vehicule where immatriculation = 'AA053AP'), (select id from vehicule where immatriculation = 'AA927CA'), '2025-01-01', true),
      ('ATT-2026-00001', (select id from vehicule where immatriculation = 'AA927CA'), (select id from vehicule where immatriculation = 'AA053AP'), '2026-09-14', true),
      ('ATT-2026-00003', (select id from vehicule where immatriculation = 'AA737ZW'), (select id from vehicule where immatriculation = 'AA713VE'), '2026-09-14', true);`);
  const etat = async () => Object.fromEntries(((await pg.query(`select numero, fin::text as fin, motif from attelage order by numero`)).rows as { numero: string; fin: string | null; motif: string | null }[]).map((r) => [r.numero, r]));
  for (const m of migrations.filter((f) => f >= "0076")) await pg.exec(readFileSync(join("supabase/migrations", m), "utf8"));
  await pg.exec(readFileSync("supabase/migrations/0076_attelage_remplace_le_precedent.sql", "utf8"));
  const apres = await etat();
  attendu(`0076 : le couple inversé de 2025 est clos le 14/09/2026 par le plus récent, rejouable (${apres["ATT-2025-90001"]?.fin} — ${apres["ATT-2025-90001"]?.motif})`, apres["ATT-2025-90001"]?.fin === "2026-09-14" && apres["ATT-2025-90001"]!.motif!.endsWith("Clos à l'ouverture de ATT-2026-00001") && apres["ATT-2026-00001"]?.fin === null && apres["ATT-2026-00003"]?.fin === null);
  /* Le tracteur AA 737 ZW prend une autre semi : l'attelage d'avant se clôt à la même date. */
  await pg.exec(`insert into attelage (numero, tracteur_id, remorque_id, debut) values ('ATT-2026-00010', (select id from vehicule where immatriculation = 'AA737ZW'), (select id from vehicule where immatriculation = 'AA214XK'), '2026-10-03')`);
  const ensuite = await etat();
  attendu(`un nouvel attelage clôt le précédent à sa date d'ouverture (${ensuite["ATT-2026-00003"]?.fin})`, ensuite["ATT-2026-00003"]?.fin === "2026-10-03" && ensuite["ATT-2026-00010"]?.fin === null);
  /* Un historique saisi avec sa fin ne clôt rien. */
  await pg.exec(`insert into attelage (numero, tracteur_id, remorque_id, debut, fin) values ('ATT-2024-00001', (select id from vehicule where immatriculation = 'AA737ZW'), (select id from vehicule where immatriculation = 'AA713VE'), '2024-01-01', '2024-06-30')`);
  attendu("un attelage saisi avec sa fin (historique) ne clôt rien", (await etat())["ATT-2026-00010"]?.fin === null);
}

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
if (echecs) process.exit(1);
