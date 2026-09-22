/* Les livraisons réelles, rattachées aux véhicules (0044).
 *
 * Ce banc joue la migration et les parties de `supabase/livraison-parties/` sur
 * une base à l'état de la production, et vérifie :
 *
 *   * que tous les bons entrent, et que le chargement est rejouable ;
 *   * que le rattachement suit la plaque : un bon « parc » cite un véhicule, un
 *     bon porté par un camion tiers cite le transporteur à qui ce camion
 *     appartient ;
 *   * qu'aucun poids n'est un zéro qui ment : un bon sans kilos a un poids nul ;
 *   * que la fraîcheur du tableau de bord (0043) voit la table ;
 *   * que le domaine ne fabrique pas « 0 t » pour un mois sans bon pesé.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-livraisons.mts */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { dureeLivraison, livraisonsParMois, resumeLivraisons, type LivraisonFiche } from "../src/domaine/livraisons";
import { ligneCreation } from "../src/lib/transactions-colonnes";
import { construireRapportDe } from "../src/domaine/assembler-rapports";
import { sourceRapportsDemo } from "../src/donnees/rapports-demo";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const MOI = "00000000-0000-0000-0000-000000000001";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- 1. Le domaine ------------------------------------------------------------ */

const bon = (x: Partial<LivraisonFiche>): LivraisonFiche => ({ numero: "BL1", date: "2026-08-03", site: "UAB", client: "A", produits: null, poidsKg: 1000, quantites: {}, lignes: 1, transporteur: null, chauffeur: null, source: "banc", ...x });
const mois = livraisonsParMois([bon({ numero: "BL1" }), bon({ numero: "BL2", poidsKg: null, client: "B" }), bon({ numero: "BL3", date: "2026-07-01", poidsKg: null })]);
attendu("un mois pesé cumule ses kilos et compte ses bons sans poids à part", mois[0]!.mois === "2026-08" && mois[0]!.poidsKg === 1000 && mois[0]!.bonsSansPoids === 1 && mois[0]!.clients === 2);
attendu("un mois sans bon pesé n'a pas de tonnage, pas « 0 t »", mois[1]!.mois === "2026-07" && mois[1]!.poidsKg === null);
attendu("un véhicule sans bon n'a ni tonnage ni dates", resumeLivraisons([]).poidsKg === null && resumeLivraisons([]).premier === null);

/* -- 2. La base ---------------------------------------------------------------- */

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
  let courant: string[] = [];
  for (const ligne of readFileSync(join(projet, "supabase/seed-parties", p), "utf8").split("\n")) {
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
const jouer = async (chemin: string) => {
  const t = readFileSync(chemin, "utf8");
  const fin = t.indexOf("-- Vérification");
  await pg.exec(fin < 0 ? t : t.slice(0, fin));
};
if (existsSync(join(projet, "supabase/releve-parties/releve-01-camions.sql"))) await jouer(join(projet, "supabase/releve-parties/releve-01-camions.sql"));

const un = async <T>(sql: string): Promise<T> => (await pg.query(sql)).rows[0] as T;
const dossier = join(projet, "supabase/livraison-parties");
const parties = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();
const annonces = parties.reduce((s, f) => s + Number(/-- (\d+) bons,/.exec(readFileSync(join(dossier, f), "utf8"))?.[1] ?? 0), 0);
const avant = await un<{ d: string | null }>(`select derniere_saisie()::text as d`);
for (const f of parties) await jouer(join(dossier, f));

const total = await un<{ n: number }>(`select count(*)::int as n from livraison`);
attendu(`${parties.length} parties jouées : ${total.n} bons entrés, ${annonces} annoncés`, total.n === annonces && annonces > 10_000);
await jouer(join(dossier, parties[0]!));
attendu("rejouable : la première partie rejouée n'ajoute rien", (await un<{ n: number }>(`select count(*)::int as n from livraison`)).n === total.n);

const modes = (await pg.query<{ mode: string; n: number; vehicules: number; t: number }>(`select mode, count(*)::int as n, count(distinct vehicule_id)::int as vehicules, round(coalesce(sum(poids_kg), 0) / 1000)::int as t from livraison group by mode order by 2 desc`)).rows;
console.log("    " + modes.map((m) => `${m.mode} ${m.n} bons (${m.t} t${m.mode === "parc" ? `, ${m.vehicules} véhicules` : ""})`).join(" · "));
const parc = modes.find((m) => m.mode === "parc");
attendu(`les bons « parc » citent un véhicule du parc : ${parc?.n ?? 0} bons sur ${parc?.vehicules ?? 0} véhicules`, (parc?.n ?? 0) > 3000 && (parc?.vehicules ?? 0) >= 40);
const tiersFaux = await un<{ n: number }>(`select count(*)::int as n from livraison l join camion_tiers c on c.immatriculation = l.camion_tiers_immatriculation where l.prestataire_id is distinct from c.prestataire_id`);
const tiers = await un<{ n: number }>(`select count(*)::int as n from livraison where camion_tiers_immatriculation is not null`);
attendu(`les ${tiers.n} bons portés par un camion tiers citent son transporteur (${tiersFaux.n} en écart)`, tiers.n > 5000 && tiersFaux.n === 0);
const parcCite = await un<{ n: number }>(`select count(*)::int as n from livraison where vehicule_id is not null and (camion_tiers_immatriculation is not null or prestataire_id is not null)`);
attendu("un bon du parc ne cite ni camion tiers ni transporteur", parcCite.n === 0);
const zeros = await un<{ n: number; nuls: number }>(`select count(*) filter (where poids_kg = 0)::int as n, count(*) filter (where poids_kg is null)::int as nuls from livraison`);
attendu(`aucun poids à zéro ; ${zeros.nuls} bons sans kilos gardent un poids nul`, zeros.n === 0 && zeros.nuls > 0);
const lourds = await un<{ n: number }>(`select count(*)::int as n from livraison where poids_kg > 60000`);
attendu(`aucun bon au-delà de 60 t (${lourds.n})`, lourds.n === 0);
const corrigees = await un<{ n: number }>(`select count(*)::int as n from livraison where immatriculation_source is not null and immatriculation is not null`);
attendu(`${corrigees.n} plaques corrigées gardent l'écriture du bon`, corrigees.n > 0);

const aa633 = (await pg.query<{ mois: string; bons: number; t: number }>(`select to_char(date, 'YYYY-MM') as mois, count(*)::int as bons, round(sum(poids_kg) / 1000)::int as t from livraison where vehicule_id = (select id from vehicule where immatriculation = 'AA633JL') group by 1 order by 1 desc limit 3`)).rows;
attendu(`AA 633 JL, le tracteur le plus chargé : ${aa633.map((m) => `${m.mois} ${m.bons} bons ${m.t} t`).join(", ")}`, aa633.length > 0 && aa633[0]!.mois === "2026-08" && aa633[0]!.t > 500);

const apres = await un<{ d: string | null }>(`select derniere_saisie()::text as d`);
attendu(`la fraîcheur du tableau de bord voit les livraisons (${avant.d} → ${apres.d})`, apres.d !== null && (avant.d === null || Date.parse(apres.d) >= Date.parse(avant.d)));
const politiques = await un<{ n: number }>(`select count(*)::int as n from pg_policies where tablename = 'livraison'`);
attendu(`la table est sous RLS, avec ${politiques.n} politiques — lecture, saisie, correction, retrait (0064)`, politiques.n === 4);

/* 0064 : une livraison saisie dans l'application, ses heures et ses observations. */
const saisie = ligneCreation("livraison", "LIV-2026-90001", { date: "2026-09-22", site: "UAB", client: "Dépôt Touba", poidsKg: "10 000", heureDebut: "7h30", heureFin: "11:15", observations: "Client absent à l'arrivée" }, { vehiculeId: "00000000-0000-0000-0000-0000000000aa" } as never);
attendu("une livraison saisie s'écrit : véhicule, client, poids, heures lues « 7h30 » comme « 07:30 », observations", "ligne" in saisie && saisie.ligne.heure_debut === "7:30" && saisie.ligne.heure_fin === "11:15" && saisie.ligne.source === "saisie" && saisie.ligne.observations === "Client absent à l'arrivée");
attendu("sans client, une livraison ne s'écrit pas", "refus" in ligneCreation("livraison", "LIV-2026-90002", { date: "2026-09-22", site: "UAB" }, { vehiculeId: "x" } as never));
attendu("la durée d'une livraison se lit de ses heures, et seulement de ses deux heures", dureeLivraison({ heureDebut: "07:30", heureFin: "11:15" }) === 225 && dureeLivraison({ heureDebut: "07:30", heureFin: null }) === null);
if ("ligne" in saisie) {
  await pg.exec(`insert into livraison (numero, date, site, client, poids_kg, mode, vehicule_id, source, heure_debut, heure_fin, observations) select 'LIV-2026-90001', '2026-09-22', 'UAB', 'Dépôt Touba', 10000, 'parc', id, 'saisie', '07:30', '11:15', 'Client absent' from vehicule where immatriculation = 'AA633JL'`);
  const lue = await un<{ h: string; o: string }>(`select heure_debut::text as h, observations as o from livraison where numero = 'LIV-2026-90001'`);
  attendu(`0064 : la base garde les heures et les observations (${lue.h})`, lue.h.startsWith("07:30") && lue.o === "Client absent");
}
const rapport = construireRapportDe({ ...sourceRapportsDemo(), livraisons: [{ numero: "A", date: "2026-08-02", vehiculeId: "AA633JL", client: "X", poidsKg: 5000, heureDebut: "08:00", heureFin: "09:00", saisie: true }, { numero: "B", date: "2026-08-03", vehiculeId: "AA633JL", client: "Y", poidsKg: null, heureDebut: null, heureFin: null, saisie: false }] }, "flotte-livraisons", { periode: "tout", perimetre: "tout" } as never);
attendu(`le rapport « Livraisons » résume par véhicule et par mois (${rapport.length} ligne, ${String(rapport[0]?.tonnage)} t, ${String(rapport[0]?.dureeMoyenne)} min)`, rapport.length === 1 && rapport[0]!.bons === 2 && rapport[0]!.tonnage === 5 && rapport[0]!.bonsSansPoids === 1 && rapport[0]!.dureeMoyenne === 60);

console.log(echecs === 0 ? "\ntout passe" : `\n${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);
