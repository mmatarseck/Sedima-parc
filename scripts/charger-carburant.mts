/* ============================================================================
 * Fabrique `supabase/carburant-reel.sql` — le carburant réel, chargeable.
 *
 * Suite de `extraire-carburant.mts`, qui lit les classeurs du dossier DO et
 * rend deux séries. Ce script-ci les transforme en `insert` et ne garde que ce
 * qui se tient.
 *
 * CE QUI A DÉBLOQUÉ LE CHARGEMENT. Les suivis ne portent aucun prix, et
 * `plein` en exige un. Le métier a donné la clé le 10 septembre 2026 : au
 * Sénégal les prix sont **fixés par arrêté**, pas par le marché, et ils n'ont
 * bougé que deux fois en deux ans. `src/domaine/carburant-tarifs.ts` porte la
 * grille et ses dates d'effet ; un prix officiel à une date n'est pas une
 * estimation, c'est la donnée.
 *
 * Ce qu'on dit quand même : le tarif est le **plafond réglementaire**, pas le
 * montant d'une facture. Chaque ligne chargée porte donc sa référence — « Tarif
 * officiel du 06/12/2025 » — pour qu'on ne prenne jamais un montant calculé
 * pour un montant relevé.
 *
 * DEUX SÉRIES, DEUX TRAITEMENTS.
 *
 *   * Les **pleins** des suivis hebdomadaires sont des transactions : une
 *     date, un véhicule, des litres. Ils se chargent tels quels,
 *     `plein_complet` à vrai.
 *   * Les **cumuls mensuels** ne sont pas des transactions. Ils se chargent
 *     tout de même — sinon treize mois de consommation réelle resteraient
 *     dehors — mais datés au dernier jour du mois, avec `source` qui le dit et
 *     `plein_complet` à **faux** : la colonne existe précisément pour marquer
 *     ce dont on ne peut pas tirer une consommation entre deux pleins.
 *
 * CE QUI EST ÉCARTÉ, ET POURQUOI :
 *   * les plaques absentes du parc — les suivis couvrent tout le groupe, ADEX,
 *     KFC et les engins de chantier compris ;
 *   * les dates hors des périodes tarifaires connues, c'est-à-dire tout ce qui
  *     précède 2022, et l'essence de 2022 dont la date de bascule n'est pas
 *     établie : mieux vaut ne pas charger que porter un prix faux.
 *
 * Lancer : npx tsx scripts/extraire-carburant.mts <sortie>
 *          npx tsx scripts/charger-carburant.mts <sortie>.json
 * ==========================================================================*/

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prixOfficiel, referenceTarif } from "../src/domaine/carburant-tarifs";

interface Plein {
  date: string;
  immatriculation: string;
  chauffeur: string | null;
  litres: number;
  km: number | null;
  heure: string | null;
  source: string;
}
interface Cumul {
  mois: string;
  immatriculation: string;
  litres: number;
  entite: string | null;
  source: string;
}

const fichier = process.argv[2];
if (!fichier) {
  console.error("Usage : npx tsx scripts/charger-carburant.mts <extraction.json>");
  process.exit(2);
}
const projet = process.cwd();
const brut = JSON.parse(readFileSync(fichier, "utf8")) as { pleins: Plein[]; cumuls: Cumul[] };

/* Le parc chargé, lu dans le jeu de départ : c'est lui qui dit quelles plaques
   existent en base, et le seed est la seule source qui le sache hors ligne. */
const seed = readFileSync(join(projet, "supabase/seed.sql"), "utf8");
const parc = new Set<string>();
for (const b of seed.matchAll(/insert into vehicule \([^)]*\) values[\s\S]*?\non conflict do nothing;/g)) {
  for (const m of b[0].matchAll(/'([A-Z]{2}\d{3,4}[A-Z]{1,2})'/g)) parc.add(m[1]!);
}

const echappe = (s: string) => s.replace(/'/g, "''");
/** Le dernier jour d'un mois « AAAA-MM ». */
const finDeMois = (mois: string) => new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 0)).toISOString().slice(0, 10);

const lignes: string[] = [];
const ecartes = { horsParc: new Set<string>(), horsTarif: 0, horsParcLignes: 0 };
let numero = 0;
const suivant = () => `PLN-R-${String(++numero).padStart(6, "0")}`;

/* -- 1. Les pleins ---------------------------------------------------------- */

let litresPleins = 0;
for (const p of brut.pleins.sort((a, b) => a.date.localeCompare(b.date))) {
  if (!parc.has(p.immatriculation)) {
    ecartes.horsParc.add(p.immatriculation);
    ecartes.horsParcLignes++;
    continue;
  }
  const prix = prixOfficiel(p.date);
  if (prix === null) {
    ecartes.horsTarif++;
    continue;
  }
  /* Le montant est calculé **par la base**, pas ici. `34.30 * 755` vaut
     25 896,499999999996 en virgule flottante et 25 896,50 en numérique exact :
     JavaScript arrondissait à 25 896 là où Postgres attend 25 897, et le banc
     l'a vu. Plutôt que de recopier l'arithmétique décimale de Postgres, on lui
     laisse la multiplication — c'est elle qui fait foi sur un `numeric`. */
  litresPleins += p.litres;
  lignes.push(
    `  ('${suivant()}', (select id from vehicule where immatriculation = '${p.immatriculation}'), '${p.date}', ${p.litres}, ${prix}, round(${p.litres} * ${prix}), ${p.km ?? "null"}, true, 'Pompe — suivi hebdomadaire', '${echappe(referenceTarif(p.date) ?? "")}')`,
  );
}
const nombrePleins = lignes.length;

/* -- 2. Les cumuls mensuels ------------------------------------------------- */

let litresCumuls = 0;
for (const c of brut.cumuls.sort((a, b) => a.mois.localeCompare(b.mois))) {
  if (!parc.has(c.immatriculation)) {
    ecartes.horsParc.add(c.immatriculation);
    ecartes.horsParcLignes++;
    continue;
  }
  const jour = finDeMois(c.mois);
  const prix = prixOfficiel(jour);
  if (prix === null) {
    ecartes.horsTarif++;
    continue;
  }
  litresCumuls += c.litres;
  lignes.push(
    `  ('${suivant()}', (select id from vehicule where immatriculation = '${c.immatriculation}'), '${jour}', ${c.litres}, ${prix}, round(${c.litres} * ${prix}), null, false, 'Cumul mensuel — suivi carburant', '${echappe(referenceTarif(jour) ?? "")}')`,
  );
}
const nombreCumuls = lignes.length - nombrePleins;

/* -- 3. Le fichier ---------------------------------------------------------- */

const entete = `-- ============================================================================
-- SEDIMA Parc — le carburant réel, de 2022 à 2026.
--
-- **Ce n'est pas une migration.** C'est un chargement de données, à jouer une
-- fois, après le seed, l'alignement, la purge et la plaque.
--
-- D'OÙ VIENNENT CES LIGNES. Du dossier DO, « 61. Gestion Parc / MALICK /
-- CARBURANT », lu par \`scripts/lire-xlsx.mts\` sans passer par Excel. Deux
-- séries s'y trouvent, et elles ne se valent pas :
--
--   * les **suivis hebdomadaires** portent un plein par ligne, daté au jour —
--     ${nombrePleins} lignes retenues, ${Math.round(litresPleins).toLocaleString("fr-FR")} litres ;
--   * les **fichiers détaillés** portent un cumul mensuel par véhicule —
--     ${nombreCumuls} lignes retenues, ${Math.round(litresCumuls).toLocaleString("fr-FR")} litres.
--
-- Les cumuls sont chargés avec \`plein_complet = false\` et une source qui le
-- dit. La colonne existe pour marquer ce dont on ne peut pas tirer une
-- consommation entre deux pleins ; un cumul de mois en est l'exemple même.
--
-- LE PRIX. Les suivis ne portent aucun prix : le carburant se tire sur puce,
-- la quantité est relevée, la facturation vit ailleurs. Au Sénégal les prix
-- sont fixés par arrêté et bougent rarement : le gasoil valait 655 F jusqu'au
-- 6 janvier 2023, 755 F jusqu'au 5 décembre 2025, 680 F jusqu'au 14 août 2026,
-- 755 F depuis.
-- Chaque ligne porte donc le **tarif officiel de sa date**, et sa référence le
-- dit : c'est un plafond réglementaire, pas le montant d'une facture.
--
-- CE QUI N'EST PAS LÀ. ${ecartes.horsParcLignes} lignes portent une plaque absente du parc
-- (${ecartes.horsParc.size} plaques : ADEX, KFC, engins de chantier — les suivis couvrent tout le
-- groupe). ${ecartes.horsTarif} lignes sont antérieures à 2025, hors des périodes tarifaires
-- établies : on ne les charge pas plutôt que de leur inventer un prix.
--
-- REJOUABLE. \`on conflict (numero) do nothing\` : un second passage n'ajoute
-- rien. Pour tout reprendre, effacer d'abord les lignes dont le numéro
-- commence par « PLN-R- ».
-- ============================================================================

insert into plein (numero, vehicule_id, date, litres, prix_litre, montant, km, plein_complet, source, reference) values
`;

const pied = `
on conflict (numero) do nothing;


-- ---------------------------------------------------------------------------
-- Vérification, après coup.
-- ---------------------------------------------------------------------------

select source,
       count(*)                                    as lignes,
       min(date)                                   as du,
       max(date)                                   as au,
       round(sum(litres))                          as litres,
       count(distinct vehicule_id)                 as vehicules
from plein
where numero like 'PLN-R-%'
group by source
order by source;
`;

/* -- 4. Le découpage en parties ---------------------------------------------
 *
 * Le SQL Editor de Supabase refuse une requête trop grosse — « Query is too
 * large to be run via the SQL Editor » sur les 1,1 Mo d'un seul fichier
 * (10 septembre 2026). Le jeu de départ avait rencontré la même borne et y
 * répond de la même façon : des parties d'environ 250 ko, taille éprouvée par
 * les douze parties du seed.
 *
 * Chaque partie est un `insert` complet et autonome : elle se joue seule, dans
 * l'ordre ou non, et se rejoue sans rien ajouter. C'est ce qui compte quand on
 * colle six fichiers à la main dans un navigateur — une partie qui échoue ne
 * doit pas empêcher les autres, et une partie jouée deux fois ne doit pas
 * doubler les litres.
 * ------------------------------------------------------------------------- */

const TAILLE_PARTIE = 250 * 1024;
const dossier = join(projet, "supabase/carburant-parties");
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });

/* On découpe sur la taille cumulée des lignes, jamais au milieu d'une ligne. */
const paquets: string[][] = [[]];
let poids = 0;
for (const l of lignes) {
  if (poids > TAILLE_PARTIE && paquets[paquets.length - 1]!.length > 0) {
    paquets.push([]);
    poids = 0;
  }
  paquets[paquets.length - 1]!.push(l);
  poids += Buffer.byteLength(l, "utf8") + 2;
}

const rappel = (n: number, sur: number) => `-- ============================================================================
-- SEDIMA Parc — carburant réel, partie ${n} sur ${sur}.
--
-- **Ce n'est pas une migration**, et le fichier a été coupé parce que le SQL
-- Editor refuse une requête de plus d'un mégaoctet. Chaque partie est un
-- \`insert\` complet : elle se joue seule, et \`on conflict (numero) do nothing\`
-- fait qu'un second passage n'ajoute rien.
--
-- À jouer après le seed, l'alignement, la purge et la plaque. L'ordre des
-- parties entre elles n'a pas d'importance.
--
-- Le détail de ce que ces lignes sont, d'où elles viennent et comment leur
-- prix est établi : \`docs/CARBURANT-REEL.md\`, et l'en-tête de la partie 1.
-- ============================================================================

`;

paquets.forEach((paquet, i) => {
  const numero = String(i + 1).padStart(2, "0");
  const tete = i === 0 ? entete : rappel(i + 1, paquets.length) + `insert into plein (numero, vehicule_id, date, litres, prix_litre, montant, km, plein_complet, source, reference) values\n`;
  const queue = i === paquets.length - 1 ? pied : "\non conflict (numero) do nothing;\n";
  writeFileSync(join(dossier, `carburant-${numero}.sql`), tete + paquet.join(",\n") + queue, "utf8");
});

console.log(`${nombrePleins} pleins et ${nombreCumuls} cumuls retenus, ${lignes.length} lignes en tout`);
console.log(`  ${Math.round(litresPleins + litresCumuls).toLocaleString("fr-FR")} litres`);
console.log(`  écartés : ${ecartes.horsParcLignes} lignes hors parc (${ecartes.horsParc.size} plaques), ${ecartes.horsTarif} lignes hors période tarifaire`);
console.log(`supabase/carburant-parties/ — ${paquets.length} parties de ${paquets.map((p) => p.length).join(", ")} lignes`);
