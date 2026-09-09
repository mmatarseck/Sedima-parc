/* Les notifications de la plateforme dans PGlite avec le seed (0027) : une
 * fiche de transfert et un lot de demandes préviennent les détenteurs, une
 * seule fois par personne ; le statut du courriel suit l'adresse connue ;
 * chacun ne lit et ne marque que les siennes ; le récapitulatif du courriel
 * se compose. Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-notifications.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { composerRecapitulatif } from "../src/lib/courriel";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const ADMIN = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const D1 = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const D2 = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  insert into auth.users values ('${ADMIN}'), ('${D1}'), ('${D2}');
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

/* ---- 1. L'administrateur qui notifie, et deux détenteurs ---- */
await pg.exec(`insert into profil (utilisateur_id, nom, role, actif) values ('${ADMIN}', 'Admin Test', 'administrateur', true);`);
const transfert = await un<{ id: string; numero: string; chauffeur: string | null; immatriculation: string; motif: string }>(
  `select t.id, t.numero, coalesce(t.recipiendaire_chauffeur_id, t.remettant_chauffeur_id)::text as chauffeur, v.immatriculation, t.motif
     from transfert t join vehicule v on v.id = t.vehicule_id
    where (t.signature_recipiendaire is null or t.signature_remettant is null) and t.annulee_le is null
      and coalesce(t.recipiendaire_chauffeur_id, t.remettant_chauffeur_id) is not null limit 1`,
);
attendu(`une fiche de transfert du seed attend une signature (${transfert?.numero} · ${transfert?.immatriculation})`, Boolean(transfert?.chauffeur));
const lot = await un<{ lot: string; chauffeur: string; n: number }>(`select lot, chauffeur_id::text as chauffeur, count(*)::int as n from demande where chauffeur_id is not null and annulee_le is null group by lot, chauffeur_id order by n desc limit 1`);
attendu(`un lot de demandes du seed vise un chauffeur (${lot?.lot}, ${lot?.n} demande(s))`, Boolean(lot?.chauffeur));
await pg.query(`insert into acces_utilisateur (utilisateur_id, prenom, nom, courriel, actif, profil, chauffeur_id) values ($1, 'Détenteur', 'Un', 'detenteur.un@sedima.sn', true, 'detenteur', $2)`, [D1, transfert.chauffeur]);
await pg.query(`insert into acces_utilisateur (utilisateur_id, prenom, nom, courriel, actif, profil, chauffeur_id) values ($1, 'Détenteur', 'Deux', '', true, 'detenteur', $2)`, [D2, lot.chauffeur]);

/* ---- 2. Le transfert prévient, une fois ---- */
const n1 = await un<{ n: number }>(`select notifier_transfert($1) as n`, [transfert.id]);
attendu(`notifier_transfert prévient ${n1.n} personne (attendu 1)`, n1.n === 1);
const n1bis = await un<{ n: number }>(`select notifier_transfert($1) as n`, [transfert.id]);
attendu(`une seconde fois, personne de plus (${n1bis.n})`, n1bis.n === 0);
const ligne = await un<{ destinataire_id: string; cle: string; sujet_libelle: string; extrait: string; href: string; courriel_statut: string; lue_le: string | null }>(`select destinataire_id, cle, sujet_libelle, extrait, href, courriel_statut, lue_le from notification where cle = $1`, [`transfert:${transfert.id}`]);
attendu(`la notification : « ${ligne.sujet_libelle} » — ${ligne.extrait} → ${ligne.href}, courriel ${ligne.courriel_statut}`,
  ligne.destinataire_id === D1 && ligne.sujet_libelle.includes(" ") && ligne.sujet_libelle.startsWith("Fiche de transfert · ") && ligne.href === `/transferts/${transfert.id}` && ligne.courriel_statut === "a-envoyer" && ligne.lue_le === null);

/* ---- 3. Le lot de demandes prévient, sans adresse : sans courriel ---- */
/* Deux comptes détenteurs peuvent porter le même chauffeur : chacun est prévenu, une fois. */
const comptesDuLot = await un<{ n: number }>(`select count(distinct a.utilisateur_id)::int as n from acces_utilisateur a join demande d on d.chauffeur_id = a.chauffeur_id where d.lot = $1 and d.annulee_le is null and a.actif and a.profil = 'detenteur'`, [lot.lot]);
const n2 = await un<{ n: number }>(`select notifier_demandes($1) as n`, [lot.lot]);
attendu(`notifier_demandes prévient ${n2.n} personne(s) pour le lot — ${comptesDuLot.n} compte(s) détenteur visés par le lot, quel que soit le nombre de demandes`, n2.n === comptesDuLot.n);
const ligne2 = await un<{ destinataire_id: string; sujet_libelle: string; href: string; courriel_statut: string }>(`select destinataire_id, sujet_libelle, href, courriel_statut from notification where cle = $1 and destinataire_id = $2`, [`demandes:${lot.lot}`, D2]);
attendu(`la notification du lot : « ${ligne2.sujet_libelle} » → ${ligne2.href}, courriel ${ligne2.courriel_statut}`, ligne2.destinataire_id === D2 && ligne2.href === "/telephone/demandes" && ligne2.courriel_statut === "sans-courriel");
const n2bis = await un<{ n: number }>(`select notifier_demandes($1) as n`, [lot.lot]);
attendu(`le lot une seconde fois : personne de plus (${n2bis.n})`, n2bis.n === 0);

/* ---- 4. Un détenteur ne peut pas notifier ---- */
await pg.exec(`create or replace function auth.uid() returns uuid language sql stable as $$ select '${D1}'::uuid $$;`);
let refus: string | null = null;
try { await pg.query(`select notifier_transfert($1)`, [transfert.id]); } catch (x) { refus = (x as Error).message; }
attendu(`un détenteur qui appelle notifier_transfert est refusé (${refus?.slice(0, 60) ?? "accepté"})`, refus !== null);

/* ---- 5. Chacun ne lit et ne marque que les siennes ---- */
await pg.exec(`create role appli nologin; grant usage on schema public, auth to appli; grant select, update on all tables in schema public to appli; grant execute on all functions in schema public to appli; grant execute on function auth.uid() to appli;`);
const attenduesD1 = await un<{ n: number }>(`select count(*)::int as n from notification where destinataire_id = $1`, [D1]);
await pg.exec(`set role appli`);
const miennes = await un<{ n: number }>(`select count(*)::int as n from notification`);
attendu(`le détenteur Un voit ${miennes.n} notification(s) — les siennes seulement (${attenduesD1.n})`, miennes.n === attenduesD1.n && miennes.n > 0);
await pg.query(`update notification set lue_le = now() where lue_le is null`);
const lues = await un<{ lues: number; total: number }>(`select count(*) filter (where lue_le is not null)::int as lues, count(*)::int as total from notification`);
attendu(`il marque les siennes lues (${lues.lues}/${lues.total})`, lues.lues === lues.total && lues.total === attenduesD1.n);
await pg.exec(`reset role`);
const autre = await un<{ n: number }>(`select count(*)::int as n from notification where destinataire_id = $1 and lue_le is null`, [D2]);
attendu(`celle du détenteur Deux n'a pas bougé (${autre.n} non lue)`, autre.n === 1);

/* ---- 6. Le récapitulatif du courriel ---- */
const r = composerRecapitulatif("Moustapha", [
  { sujet: "Fiche de transfert · AA 032 EA", extrait: "Retour d'atelier — à signer sur votre téléphone.", href: "/transferts/abc", date: "2026-09-09T10:00:00Z" },
  { sujet: "Relevé de compteur", extrait: "Merci de relever avant midi.", href: "/telephone/demandes", date: "2026-09-09T10:05:00Z" },
]);
attendu(`le récapitulatif : « ${r.sujet} », ${r.texte.split("\n").length} lignes, liens absolus`, r.sujet.includes("2 notifications") && r.texte.includes("Bonjour Moustapha") && r.texte.includes("https://") && r.html.includes("/transferts/abc"));
const seul = composerRecapitulatif("", [{ sujet: "Fiche de transfert · AA 032 EA", extrait: "", href: "/transferts/abc", date: "2026-09-09T10:00:00Z" }]);
attendu(`une seule notification : le sujet la nomme (« ${seul.sujet} »)`, seul.sujet === "SEDIMA Parc — Fiche de transfert · AA 032 EA" && seul.texte.startsWith("Bonjour,"));

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);
