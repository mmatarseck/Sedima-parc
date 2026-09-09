/* Les discussions dans PGlite avec le seed (0028) : un message publié sur une
 * fiche est signé de la session, garde ses citations, prévient les comptes
 * cités (sauf l'auteur, sauf les chauffeurs, qui ne sont pas des comptes),
 * se relit dans l'ordre ; un compte sans rôle ne publie pas.
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-discussions.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { mentionsDe, segmenter, type Personne } from "../src/domaine/discussion";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const ADMIN = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const ALY = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const SANS = "dddddddd-dddd-4ddd-dddd-dddddddddddd";
const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  insert into auth.users values ('${ADMIN}'), ('${ALY}'), ('${SANS}');
  create function auth.uid() returns uuid language sql stable as $$ select '${ADMIN}'::uuid $$;`);
for (const m of readdirSync(join(projet, "supabase/migrations")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) { courant.push(ligne); if (/^on conflict .*;$/.test(ligne.trim())) { try { await pg.exec(courant.join("\n")); } catch {} courant = []; } }
}
let echecs = 0;
const attendu = (libelle: string, ok: boolean) => { console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`); if (!ok) echecs++; };
const un = async <T,>(sql: string, params: unknown[] = []): Promise<T> => (await pg.query(sql, params)).rows[0] as T;

/* ---- 1. Deux comptes : le gestionnaire qui écrit, le responsable maintenance qu'il cite ---- */
await pg.exec(`insert into profil (utilisateur_id, nom, role, actif) values ('${ADMIN}', 'M. Seck', 'administrateur', true), ('${ALY}', 'Aly Bo', 'responsable-maintenance', true);
  insert into acces_utilisateur (utilisateur_id, prenom, nom, courriel, actif, profil) values ('${ADMIN}', 'Mamadou', 'Seck', 'm.seck@sedima.sn', true, 'administrateur'), ('${ALY}', 'Aly', 'Bo', 'aly.bo@sedima.sn', true, 'maintenance');`);
const personnes: Personne[] = [
  { id: ADMIN, nom: "Mamadou Seck", initiales: "MS", precision: "Administrateur" },
  { id: ALY, nom: "Aly Bo", initiales: "AB", precision: "Maintenance" },
  { id: "chauffeur:babacar-ndiaye", nom: "Babacar Ndiaye", initiales: "BN", precision: "Chauffeur" },
];
const texte = "@Aly Bo le chauffeur @Babacar Ndiaye signale un bruit au freinage. Peux-tu passer le véhicule au contrôle ?";
const mentions = mentionsDe(texte, personnes);
attendu(`le domaine relève ${mentions.length} citations (${mentions.join(", ")})`, mentions.length === 2 && mentions.includes(ALY) && mentions.includes("chauffeur:babacar-ndiaye"));
const comptes = mentions.filter((m) => /^[0-9a-f-]{36}$/.test(m));
const libres = mentions.filter((m) => !/^[0-9a-f-]{36}$/.test(m));

/* ---- 2. Publier ---- */
const m = await un<{ id: string; sujet: string; auteur_id: string; auteur_nom: string; texte: string; mentions: string[]; mentions_libres: string[] }>(
  /* `select (f()).*` appellerait la fonction une fois par colonne : on passe par from. */
  `select * from publier_message($1, $2, $3, $4, $5::uuid[], $6::text[])`,
  ["vehicule:AA032EA", "AA 032 EA", "/flotte/AA032EA?discussion=1", texte, comptes, libres],
);
attendu(`le message est signé de la session (« ${m.auteur_nom} ») sur ${m.sujet}, ${m.mentions.length} compte cité, ${m.mentions_libres.length} chauffeur cité`, m.auteur_id === ADMIN && m.auteur_nom === "Mamadou Seck" && m.mentions.length === 1 && m.mentions[0] === ALY && m.mentions_libres[0] === "chauffeur:babacar-ndiaye");
const n = await un<{ destinataire_id: string; cle: string; sujet_libelle: string; extrait: string; href: string; courriel_statut: string; auteur: string }>(`select destinataire_id, cle, sujet_libelle, extrait, href, courriel_statut, auteur from notification where cle = $1`, [`message:${m.id}`]);
attendu(`Aly Bo est prévenu : « ${n?.sujet_libelle} » — ${n?.extrait?.slice(0, 40)}… → ${n?.href}, courriel ${n?.courriel_statut}, par ${n?.auteur}`, n?.destinataire_id === ALY && n.href === "/flotte/AA032EA?discussion=1" && n.courriel_statut === "a-envoyer" && n.auteur === "Mamadou Seck" && n.extrait.length <= 120);
const total = await un<{ n: number }>(`select count(*)::int as n from notification where cle = $1`, [`message:${m.id}`]);
attendu(`une seule notification : ni l'auteur ni le chauffeur cité (${total.n})`, total.n === 1);

/* ---- 3. Le fil se relit dans l'ordre, et les segments se rendent ---- */
await pg.query(`select publier_message($1, $2, $3, $4, $5::uuid[], $6::text[])`, ["vehicule:AA032EA", "AA 032 EA", "/flotte/AA032EA?discussion=1", "Vu, je le prends demain matin.", [], []]);
const fil = (await pg.query(`select auteur_nom, texte from message where sujet = $1 order by date`, ["vehicule:AA032EA"])).rows as { auteur_nom: string; texte: string }[];
attendu(`le fil de AA 032 EA porte ${fil.length} messages, le premier cite, le second répond`, fil.length === 2 && fil[0]!.texte === texte && fil[1]!.texte.startsWith("Vu"));
const segments = segmenter(fil[0]!.texte, personnes);
attendu(`le texte se segmente en ${segments.length} morceaux, ${segments.filter((s) => s.type === "mention").length} citations mises en évidence`, segments.filter((s) => s.type === "mention").length === 2);

/* ---- 4. Un sujet hors fiche et un compte sans rôle sont refusés ---- */
let refus: string | null = null;
try { await pg.query(`select publier_message($1, $2, $3, $4, $5::uuid[], $6::text[])`, ["nimportequoi", "x", "/", "texte", [], []]); } catch (x) { refus = (x as Error).message; }
attendu(`un sujet qui n'est pas une fiche est refusé (${refus?.slice(0, 50) ?? "accepté"})`, refus !== null);
await pg.exec(`create or replace function auth.uid() returns uuid language sql stable as $$ select '${SANS}'::uuid $$;`);
refus = null;
try { await pg.query(`select publier_message($1, $2, $3, $4, $5::uuid[], $6::text[])`, ["vehicule:AA032EA", "AA 032 EA", "/flotte/AA032EA", "texte", [], []]); } catch (x) { refus = (x as Error).message; }
attendu(`un compte sans rôle ne publie pas (${refus?.slice(0, 50) ?? "accepté"})`, refus !== null);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);
