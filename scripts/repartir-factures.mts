/* ============================================================================
 * Fabrique `supabase/correctif-factures-partagees.sql` — une facture qui couvre
 * plusieurs véhicules se répartit entre eux.
 *
 * Métier, 21 septembre 2026 : « on voit des factures qui regroupent plusieurs
 * véhicules — à splitter par véhicule pour bien répartir les charges ».
 *
 * Les chargements rattachaient un bon couvrant plusieurs véhicules à sa plaque
 * principale, comme le classeur d'extraction le fait lui-même, et le disaient
 * dans la référence (« bon couvrant plusieurs véhicules »). Le premier véhicule
 * portait donc la charge de tous : le Tata AA 565 GA payait l'entretien de cinq
 * camions.
 *
 * D'OÙ VIENT LA LISTE DES VÉHICULES.
 *   * une dépense des bons de commande : la colonne « Toutes immatriculations »
 *     du classeur d'extraction ;
 *   * une dépense du grand livre : les plaques que son libellé nomme.
 *
 * D'OÙ VIENNENT LES PARTS.
 *   1. **Le grand livre, quand il détaille le bon** : la comptabilité passe
 *      souvent une écriture par véhicule là où le bon n'a qu'un total
 *      (CMD2-26040372 : six écritures pour 2 259 000 F). Si chaque écriture du
 *      bon nomme un seul véhicule et que leur somme retrouve le montant de la
 *      dépense à 2 % près, ce sont les vraies parts.
 *   2. **À parts égales, sinon** — et la référence le dit. C'est une
 *      convention, pas une mesure : la facture ne ventile pas.
 *
 * CE QUI NE BOUGE PAS. La dépense d'origine garde son numéro et devient la
 * part du premier véhicule : sa facture attachée, la demande d'achat et le
 * mouvement de caisse qui la citent la retrouvent. Les autres parts naissent à
 * côté (`DEP-R-00002-2`, `-3`…), avec la même date, le même poste, le même
 * fournisseur et **la même facture attachée**. L'intervention jumelle suit, au
 * même suffixe, pour que l'atelier les lise ensemble. La part d'un véhicule
 * absent de la flotte reste une dépense du parc, sans véhicule, et le nomme.
 * Le total du bon est écrit dans chaque référence : rien ne se perd.
 *
 * Le script lit la base en lecture seule et reconnaît aussi ce qu'il a déjà
 * réparti : rejoué après coup, il refait le même fichier.
 *
 * Lancer : npx tsx scripts/repartir-factures.mts
 * ==========================================================================*/

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { normaliser } from "../src/domaine/immatriculation";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { lecteurDePlaques } from "./plaques-libelle.mts";

const DO = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents";
const CLASSEUR_BONS = `${DO}/6. Logistique & Distribution/62. Transport & Flotte Automobile/61. Gestion Parc/Maintenance/SEDIMA_Maintenance_Parc_Bons_de_commande.xlsx`;
const CLASSEUR_GRAND_LIVRE = `${DO}/2. Stratégie, Budget, Objectifs/21. Budget/212. Budget 2027/Fichiers de travail/RECAP 31082026.xlsx`;
const projet = process.cwd();

const texte = (c: Cellule | undefined) => (c === null || c === undefined ? "" : String(c).trim());
const nombre = (c: Cellule | undefined) => {
  const n = typeof c === "number" ? c : Number(texte(c).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const echappe = (s: string) => s.replace(/'/g, "''");
const fr = (n: number) => Math.round(n).toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ");
const afficher = (p: string) => p.replace(/^([A-Z]{2})(\d{3,4})([A-Z]{1,2})$/, "$1 $2 $3");

/* -- 1. La base ---------------------------------------------------------------- */

for (const ligne of readFileSync(join(projet, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(ligne);
  if (m && !ligne.trimStart().startsWith("#") && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.trim().replace(/^(['"])(.*)\1$/, "$2");
}
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cleService) {
  console.error("Il manque l'adresse du projet ou la clé de service dans l'environnement ou `.env.local`.");
  process.exit(2);
}
const pg = createClient(url, cleService, { auth: { persistSession: false, autoRefreshToken: false } });

const vehicules = (await pg.from("vehicule").select("id,immatriculation").limit(5000)).data ?? [];
const plaqueDe = new Map(vehicules.map((v) => [v.id as string, v.immatriculation as string]));
const flotte = new Set(plaqueDe.values());
const plaquesDe = lecteurDePlaques(flotte);

const MARQUE_ORIGINE = /plusieurs véhicules/;
const MARQUE_REPARTIE = / · facture répartie — part 1\/\d+ de ([\d ]+) F/;
type Ligne = { numero: string; vehicule_id: string | null; montant: number; libelle?: string; objet?: string; reference: string | null };
async function lignesPartagees(table: "depense" | "intervention"): Promise<Ligne[]> {
  const colonnes = table === "depense" ? "numero,vehicule_id,montant,libelle,reference" : "numero,vehicule_id,montant,objet,reference";
  const r = await pg.from(table).select(colonnes).or("reference.ilike.%plusieurs véhicules%,reference.ilike.%facture répartie — part 1/%").limit(5000);
  if (r.error) throw new Error(`${table} illisible : ${r.error.message}`);
  return r.data as unknown as Ligne[];
}
const depenses = await lignesPartagees("depense");
const interventions = new Map((await lignesPartagees("intervention")).map((i) => [i.numero, i]));

/* -- 2. Les classeurs ---------------------------------------------------------- */

/* Le bon → toutes ses immatriculations. */
const commandes = lireClasseur(CLASSEUR_BONS).find((f) => f.nom === "Commandes")!.lignes;
const enTete = commandes[0]!.map((c) => texte(c));
const cBon = enTete.indexOf("N° commande");
const cToutes = enTete.indexOf("Toutes immatriculations");
if (cBon < 0 || cToutes < 0) throw new Error("colonnes du classeur des bons introuvables");
const plaquesDuBon = new Map<string, string[]>();
for (const l of commandes.slice(1)) {
  const bon = texte(l[cBon]);
  if (bon) plaquesDuBon.set(bon, texte(l[cToutes]).split(/[,;]/).map((p) => normaliser(p)).filter((p) => /^[A-Z]{2}\d{3,4}[A-Z]{1,2}$/.test(p)));
}

/* Le bon → ce que le grand livre en détaille, véhicule par véhicule. */
const detailDuBon = new Map<string, { plaque: string | null; horsParc: string | null; montant: number; net: boolean }[]>();
const grandLivre = lireClasseur(CLASSEUR_GRAND_LIVRE);
for (const nom of ["62421 ENT VEHIC", "60541 FRES VEHIC"]) {
  for (const l of grandLivre.find((f) => f.nom.trim() === nom)!.lignes.slice(1)) {
    const libelle = texte(l[5]);
    const bon = /\bBC\s?(\d{5,9})\b/.exec(libelle.toUpperCase())?.[1];
    const montant = Math.round(nombre(l[6]) - nombre(l[7]));
    if (!bon || montant <= 0) continue;
    const lues = plaquesDe(libelle);
    const seule = lues.plaques.length + lues.horsParc.length === 1;
    detailDuBon.set(bon, [...(detailDuBon.get(bon) ?? []), { plaque: lues.plaques[0] ?? null, horsParc: lues.horsParc[0] ?? null, montant, net: seule }]);
  }
}

/* -- 3. La répartition --------------------------------------------------------- */

interface Part {
  /** Nul pour un véhicule absent de la flotte. */
  plaque: string | null;
  horsParc: string | null;
  montant: number;
}
interface Groupe {
  numero: string;
  total: number;
  bon: string | null;
  base: string;
  methode: "grand-livre" | "parts-egales";
  parts: Part[];
  intervention: string | null;
}
const groupes: Groupe[] = [];
const laisses: string[] = [];

for (const d of depenses.sort((a, b) => a.numero.localeCompare(b.numero))) {
  const reference = d.reference ?? "";
  const dejaRepartie = MARQUE_REPARTIE.exec(reference);
  const total = dejaRepartie ? Number(dejaRepartie[1]!.replace(/\s/g, "")) : d.montant;
  /* La référence d'origine, sans la mention qu'on remplace. */
  const base = reference.replace(/ · (bon|écriture) couvrant plusieurs véhicules/, "").replace(/ · facture répartie — .*$/, "");
  const premiere = d.vehicule_id ? (plaqueDe.get(d.vehicule_id) ?? null) : null;
  const bon = /(?:CMD\d?-|BC)(\d{5,9})/.exec(reference)?.[1] ?? null;
  const bonEntier = /(CMD\d?-\d{5,9}|BC\d{5,9})/.exec(reference)?.[1] ?? null;

  /* Les véhicules du bon. */
  let plaques: string[] = [];
  if (d.numero.startsWith("DEP-GL-")) {
    const lues = plaquesDe(d.libelle ?? "");
    plaques = [...lues.plaques, ...lues.horsParc];
  } else if (bonEntier) plaques = plaquesDuBon.get(bonEntier) ?? [];
  /* Le véhicule qui porte aujourd'hui la dépense passe devant : il garde la ligne d'origine. */
  if (premiere) plaques = [premiere, ...plaques.filter((p) => p !== premiere)];
  plaques = [...new Set(plaques)];
  if (plaques.length < 2) {
    laisses.push(`${d.numero} · ${reference} — moins de deux véhicules lisibles (${plaques.join(", ") || "aucun"})`);
    continue;
  }

  /* Les parts : le détail du grand livre s'il est net, sinon à parts égales. */
  let parts: Part[] | null = null;
  let methode: Groupe["methode"] = "parts-egales";
  const detail = bon && !d.numero.startsWith("DEP-GL-") ? detailDuBon.get(bon) : undefined;
  if (detail && detail.every((x) => x.net)) {
    const somme = detail.reduce((s, x) => s + x.montant, 0);
    if (Math.abs(somme - total) <= total * 0.02) {
      const parVehicule = new Map<string, Part>();
      for (const x of detail) {
        const k = x.plaque ?? `hors:${x.horsParc}`;
        const p = parVehicule.get(k) ?? { plaque: x.plaque, horsParc: x.plaque ? null : x.horsParc, montant: 0 };
        p.montant += x.montant;
        parVehicule.set(k, p);
      }
      if (parVehicule.size >= 2) {
        parts = [...parVehicule.values()];
        /* L'écart de quelques francs entre le bon et la comptabilité va à la plus grosse part : le total du bon fait foi. */
        parts.sort((a, b) => b.montant - a.montant)[0]!.montant += total - somme;
        const i = parts.findIndex((p) => p.plaque === premiere);
        if (i > 0) parts.unshift(...parts.splice(i, 1));
        methode = "grand-livre";
      }
    }
  }
  if (!parts) {
    const part = Math.floor(total / plaques.length);
    parts = plaques.map((p, i) => ({ plaque: flotte.has(p) ? p : null, horsParc: flotte.has(p) ? null : p, montant: i === 0 ? total - part * (plaques.length - 1) : part }));
  }
  /* La ligne d'origine doit rester sur un véhicule de la flotte. */
  if (parts[0]!.plaque !== premiere) {
    laisses.push(`${d.numero} · ${reference} — le véhicule qui porte la dépense (${premiere ?? "aucun"}) n'est pas dans le détail du grand livre`);
    continue;
  }
  const jumelle = d.numero.replace(/^DEP-/, "INT-");
  groupes.push({ numero: d.numero, total, bon: bonEntier, base, methode, parts, intervention: interventions.has(jumelle) ? jumelle : null });
}

/* -- 4. Le SQL ----------------------------------------------------------------- */

const vehiculeSql = (p: string | null) => (p ? `(select id from vehicule where immatriculation = '${p}')` : "null");
const blocs: string[] = [];
for (const g of groupes) {
  const n = g.parts.length;
  const mention = (i: number) => `${g.base} · facture répartie — part ${i + 1}/${n} de ${fr(g.total)} F${g.methode === "grand-livre" ? ", selon le grand livre" : ", à parts égales"}`;
  const l: string[] = [`-- ${g.numero} · ${g.bon ?? "sans bon"} · ${fr(g.total)} F · ${n} véhicules · ${g.methode === "grand-livre" ? "parts du grand livre" : "parts égales"}`];
  l.push(`update depense set montant = ${g.parts[0]!.montant}, reference = '${echappe(mention(0))}' where numero = '${g.numero}' and montant in (${g.total}, ${g.parts[0]!.montant});`);
  g.parts.slice(1).forEach((p, k) => {
    const i = k + 1;
    const suffixeLibelle = p.plaque ? "" : ` — ${afficher(p.horsParc!)}, hors flotte`;
    l.push(
      `insert into depense (numero, vehicule_id, prestataire_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif, photo)\n` +
        `select '${g.numero}-${i + 1}', ${vehiculeSql(p.plaque)}, o.prestataire_id, o.date, o.poste, left(o.libelle || '${echappe(suffixeLibelle)}', 200), ${p.montant}, ` +
        `${p.plaque ? "o.beneficiaire" : "coalesce(o.beneficiaire, (select raison_sociale from prestataire where id = o.prestataire_id), 'Véhicule hors flotte')"}, '${echappe(mention(i))}', o.origine, o.justificatif, o.photo\n` +
        `  from depense o where o.numero = '${g.numero}' on conflict (numero) do nothing;`,
    );
  });
  if (g.intervention) {
    l.push(`update intervention set montant = ${g.parts[0]!.montant}, reference = '${echappe(mention(0))}' where numero = '${g.intervention}' and montant in (${g.total}, ${g.parts[0]!.montant});`);
    g.parts.slice(1).forEach((p, k) => {
      if (!p.plaque) return;
      const i = k + 1;
      l.push(
        `insert into intervention (numero, vehicule_id, prestataire_id, date, type, objet, montant, immobilisation_jours, km, reference)\n` +
          `select '${g.intervention}-${i + 1}', ${vehiculeSql(p.plaque)}, o.prestataire_id, o.date, o.type, o.objet, ${p.montant}, null, null, '${echappe(mention(i))}'\n` +
          `  from intervention o where o.numero = '${g.intervention}' on conflict (numero) do nothing;`,
      );
    });
  }
  blocs.push(l.join("\n"));
}

const totalReparti = groupes.reduce((s, g) => s + g.total, 0);
const nParts = groupes.reduce((s, g) => s + g.parts.length, 0);
const selonGrandLivre = groupes.filter((g) => g.methode === "grand-livre");
const horsFlotte = groupes.flatMap((g) => g.parts.filter((p) => !p.plaque).map((p) => p.horsParc!));
const verification = groupes.map((g) => `('${g.numero}', ${g.total})`).join(",\n  ");

writeFileSync(
  join(projet, "supabase/correctif-factures-partagees.sql"),
  `-- ============================================================================
-- SEDIMA Parc — une facture qui couvre plusieurs véhicules se répartit entre eux.
--
-- **Ce n'est pas une migration.** Métier, 21 septembre 2026 : « des factures
-- regroupent plusieurs véhicules — à splitter par véhicule pour bien répartir
-- les charges ». Fabriqué par \`scripts/repartir-factures.mts\`.
--
-- ${groupes.length} dépenses, ${fr(totalReparti)} F, deviennent ${nParts} parts. Le premier véhicule portait
-- seul la charge de tous ; chacun porte désormais la sienne.
--
--   * ${selonGrandLivre.length} bons sont répartis **selon le grand livre**, qui passe une écriture
--     par véhicule là où le bon n'a qu'un total : ce sont les vraies parts.
--   * ${groupes.length - selonGrandLivre.length} le sont **à parts égales** — une convention, pas une mesure : la
--     facture ne ventile pas. La référence de chaque part le dit.
--
-- La dépense d'origine garde son numéro et devient la part du premier
-- véhicule : sa facture, la demande d'achat et la caisse qui la citent la
-- retrouvent. Les autres parts (\`…-2\`, \`…-3\`) reprennent sa date, son poste,
-- son fournisseur et **sa facture attachée**. L'intervention jumelle suit, au
-- même suffixe. ${horsFlotte.length} parts vont à des véhicules absents de la flotte
-- (${[...new Set(horsFlotte)].map(afficher).join(", ")}) : elles restent des dépenses du parc,
-- sans véhicule, et nomment la plaque.
--
-- LE GARDE-FOU. Une ligne n'est touchée que si son montant est encore le total
-- lu, ou déjà sa part. REJOUABLE : un second passage ne change rien.
-- ============================================================================

begin;

${blocs.join("\n\n")}

commit;

-- ---------------------------------------------------------------------------
-- Vérification — le total de chaque facture est intact. Doit ne rien rendre.
-- ---------------------------------------------------------------------------

with attendu (numero, total) as (values
  ${verification}
)
select a.numero, a.total, sum(d.montant) as reparti
  from attendu a
  join depense d on d.numero = a.numero or d.numero like a.numero || '-_' or d.numero like a.numero || '-__'
 group by a.numero, a.total
having sum(d.montant) <> a.total;
`,
  "utf8",
);

console.log(`${groupes.length} dépenses réparties en ${nParts} parts — ${fr(totalReparti)} F`);
console.log(`  selon le grand livre : ${selonGrandLivre.length} (${selonGrandLivre.map((g) => g.bon).join(", ")})`);
console.log(`  à parts égales : ${groupes.length - selonGrandLivre.length}`);
console.log(`  avec intervention jumelle : ${groupes.filter((g) => g.intervention).length}`);
console.log(`  parts hors flotte : ${horsFlotte.length} (${[...new Set(horsFlotte)].join(", ")})`);
for (const g of groupes) console.log(`    ${g.numero.padEnd(24)} ${fr(g.total).padStart(11)} F  ${g.methode === "grand-livre" ? "GL " : "=  "} ${g.parts.map((p) => `${p.plaque ?? `(${p.horsParc})`} ${fr(p.montant)}`).join(" · ")}`);
if (laisses.length) {
  console.log(`  laissées telles quelles : ${laisses.length}`);
  for (const x of laisses) console.log(`    ${x}`);
}
console.log("supabase/correctif-factures-partagees.sql");
