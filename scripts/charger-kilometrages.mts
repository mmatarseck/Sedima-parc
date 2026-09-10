/* ============================================================================
 * Fabrique `supabase/kilometrages.sql` — les compteurs lus sur les bons.
 *
 * LE MANQUE. Le parc a des litres, des francs et des interventions, mais pas
 * de compteur : sans kilométrage, ni consommation aux 100 km ni coût au
 * kilomètre, et ce sont deux des chiffres que le métier regarde en premier.
 *
 * OÙ IL SE CACHAIT. Les bons de commande le portent dans leur **texte** :
 * « ENTRETIEN AUX 16000KM DU VEHICULE AA025HD », « ENTRETIEN DU VÉHICULE
 * AA 032 EA A 175000 km ». Cent quinze bons sur six cent quatre-vingt-quatorze
 * en citent un ; cent dix ont aussi une plaque. Ce n'est pas un relevé
 * quotidien, mais c'est un point daté, exact et attesté par une facture.
 *
 * `origine_releve` prévoit déjà **« garage »** pour ce cas précis : un compteur
 * lu à l'atelier, et non saisi par un chauffeur ni remonté par une balise.
 *
 * DEUX ÉCRITURES, ENCORE. Le kilométrage entre à la fois dans
 * `releve_kilometrique` — c'est un fait daté du véhicule, que la fiche et la
 * conformité lisent — et dans la colonne `km` de l'intervention correspondante,
 * qui était restée nulle au premier chargement. Le même fait, à deux endroits
 * qui le regardent différemment : l'un pour l'histoire du compteur, l'autre
 * pour dire à quel kilométrage ce travail a été fait.
 *
 * CE QU'ON REFUSE. Un compteur qui recule est écarté, et nommé. Sur un même
 * véhicule, deux relevés en ordre décroissant veulent dire qu'un des deux est
 * faux — une coquille de saisie, ou un moteur remplacé —, et on ne sait pas
 * lequel. Charger les deux abîmerait tout calcul de distance ; charger le plus
 * grand serait un choix arbitraire. On les laisse dehors avec leur raison.
 *
 * CE QU'ON NE CHARGE PAS. Les 599 pleins qui portent un compteur : ils sont
 * déjà en base, dans `plein.km`, et l'application les lit comme des relevés —
 * la fonction de situation journalière comme la fiche cherchent le compteur
 * des deux côtés. Les recopier dans `releve_kilometrique` mettrait le même
 * fait à deux endroits, avec le risque qu'ils divergent un jour.
 *
 * Lancer : npx tsx scripts/charger-kilometrages.mts
 * ==========================================================================*/

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { normaliser } from "../src/domaine/immatriculation";

const CLASSEUR =
  "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/62. Transport & Flotte Automobile/61. Gestion Parc/Maintenance/SEDIMA_Maintenance_Parc_Bons_de_commande.xlsx";
const projet = process.cwd();
const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());

/* Le parc chargé : un relevé sur un véhicule inconnu n'a nulle part où aller. */
const seed = readFileSync(join(projet, "supabase/seed.sql"), "utf8");
const parc = new Set<string>();
for (const b of seed.matchAll(/insert into vehicule \([^)]*\) values[\s\S]*?\non conflict do nothing;/g)) {
  for (const m of b[0].matchAll(/'([A-Z]{2}\d{3,4}[A-Z]{1,2})'/g)) parc.add(m[1]!);
}

/**
 * Le compteur cité dans un texte de bon.
 *
 * Le motif accepte les espaces et les points des milliers — « 175 000 km »,
 * « 31.900 KM » — et borne le résultat : sous mille kilomètres ce n'est pas un
 * compteur mais une distance parcourue ou une référence de pièce, et au-delà
 * de deux millions c'est une coquille.
 */
const MOTIF_KM = /(\d[\d\s.]{2,8})\s*(?:KMS?|KILOM)/i;
function compteurDe(t: string): number | null {
  const m = MOTIF_KM.exec(t);
  if (!m) return null;
  const km = Number(m[1]!.replace(/[\s.]/g, ""));
  return Number.isFinite(km) && km >= 1000 && km <= 2_000_000 ? km : null;
}

const commandes = lireClasseur(CLASSEUR).find((f) => f.nom === "Commandes");
if (!commandes) throw new Error("feuille « Commandes » introuvable");
const entete = commandes.lignes[0]!.map((c) => texte(c));
const col = (n: string) => {
  const i = entete.indexOf(n);
  if (i < 0) throw new Error(`colonne « ${n} » introuvable`);
  return i;
};
const [cNumero, cDate, cImmat, cObjet, cDesignations, cDoublon, cRetenu] = [
  "N° commande", "Date émission", "Immatriculation", "Objet / Remarques D.A", "Désignations", "Doublon", "Retenu pour totaux",
].map(col);

interface Releve {
  bon: string;
  date: string;
  immatriculation: string;
  km: number;
}

const releves: Releve[] = [];
const ecartes: Record<string, number> = {};
const ecarte = (r: string) => (ecartes[r] = (ecartes[r] ?? 0) + 1);

for (const l of commandes.lignes.slice(1)) {
  const bon = texte(l[cNumero]);
  if (!bon) continue;
  const km = compteurDe([texte(l[cObjet]), texte(l[cDesignations])].join(" | "));
  if (km === null) continue;
  if (texte(l[cDoublon]) !== "" || texte(l[cRetenu]) === "Non") {
    ecarte("bon marqué doublon ou exclu des totaux");
    continue;
  }
  const immat = normaliser(texte(l[cImmat]));
  if (!/^[A-Z]{2}\d{3,4}[A-Z]{1,2}$/.test(immat)) {
    ecarte("compteur cité sans immatriculation lisible");
    continue;
  }
  if (!parc.has(immat)) {
    ecarte("véhicule hors du parc de l'application");
    continue;
  }
  const date = texte(l[cDate]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    ecarte("date d'émission absente ou illisible");
    continue;
  }
  releves.push({ bon, date, immatriculation: immat, km });
}

/* -- Le contrôle de cohérence : un compteur ne recule pas ------------------- */

releves.sort((a, b) => a.immatriculation.localeCompare(b.immatriculation) || a.date.localeCompare(b.date));
const retenus: Releve[] = [];
const incoherents: { immatriculation: string; avant: string; apres: string }[] = [];
let precedent: Releve | null = null;
for (const r of releves) {
  if (precedent && precedent.immatriculation === r.immatriculation && r.km < precedent.km) {
    /* On écarte les **deux** : on ne sait pas lequel est faux, et garder l'un
       des deux serait choisir sans raison. */
    incoherents.push({ immatriculation: r.immatriculation, avant: `${precedent.date} ${precedent.km.toLocaleString("fr-FR")} km`, apres: `${r.date} ${r.km.toLocaleString("fr-FR")} km` });
    if (retenus.at(-1) === precedent) retenus.pop();
    precedent = null;
    continue;
  }
  retenus.push(r);
  precedent = r;
}

/* -- Le fichier ------------------------------------------------------------- */

retenus.sort((a, b) => a.date.localeCompare(b.date) || a.immatriculation.localeCompare(b.immatriculation));
const lignesReleve = retenus.map(
  (r, i) =>
    `  ('KM-R-${String(i + 1).padStart(5, "0")}', (select id from vehicule where immatriculation = '${r.immatriculation}'), '${r.date}', ${r.km}, 'garage')`,
);
const misesAJour = retenus.map((r) => `update intervention set km = ${r.km} where reference like '${r.bon}%' and km is null;`);

const veh = new Set(retenus.map((r) => r.immatriculation));
const sortie = `-- ============================================================================
-- SEDIMA Parc — les compteurs lus sur les bons de commande.
--
-- **Ce n'est pas une migration.** Chargement de ${retenus.length} relevés kilométriques,
-- sur ${veh.size} véhicules, du ${retenus[0]?.date} au ${retenus.at(-1)?.date}.
--
-- D'OÙ ILS VIENNENT. Du **texte** des bons de commande : « ENTRETIEN AUX
-- 16000KM DU VEHICULE AA025HD », « ENTRETIEN DU VÉHICULE AA 032 EA A
-- 175000 km ». Ce n'est pas un relevé quotidien, mais c'est un point daté,
-- exact, et attesté par une facture. L'origine \`garage\` existe pour ce cas :
-- un compteur lu à l'atelier, ni saisi par un chauffeur ni remonté par une
-- balise.
--
-- POURQUOI DEUX ÉCRITURES. Le kilométrage entre dans \`releve_kilometrique\` —
-- c'est un fait daté du véhicule — et dans la colonne \`km\` de l'intervention
-- correspondante, restée nulle au premier chargement. Le même fait à deux
-- endroits qui le regardent différemment : l'histoire du compteur d'un côté,
-- le kilométrage auquel ce travail a été fait de l'autre.
--
-- CE QUI EST ÉCARTÉ. ${incoherents.length} paire(s) de relevés où le compteur recule. Sur un
-- même véhicule, deux relevés en ordre décroissant veulent dire qu'un des deux
-- est faux — coquille de saisie, ou moteur remplacé — et on ne sait pas lequel.
-- Charger les deux abîmerait tout calcul de distance ; charger le plus grand
-- serait arbitraire. Ils restent dehors, nommés ci-dessous.
${incoherents.map((x) => `--   ${x.immatriculation} : ${x.avant} puis ${x.apres}`).join("\n") || "--   (aucune)"}
--
-- CE QUI N'EST PAS LÀ. Les 599 pleins qui portent un compteur sont déjà en
-- base, dans \`plein.km\`, et l'application les lit comme des relevés — la
-- situation journalière comme la fiche cherchent le compteur des deux côtés.
-- Les recopier ici mettrait le même fait à deux endroits.
--
-- REJOUABLE : \`on conflict (numero) do nothing\`, et les mises à jour ne
-- touchent que les interventions dont le kilométrage est encore nul.
-- ============================================================================

begin;

insert into releve_kilometrique (numero, vehicule_id, date, km, origine) values
${lignesReleve.join(",\n")}
on conflict (numero) do nothing;

-- ---- Le kilométrage porté sur l'intervention qui l'a relevé ----
${misesAJour.join("\n")}

commit;


-- ---------------------------------------------------------------------------
-- Vérification.
-- ---------------------------------------------------------------------------

select count(*) as releves,
       count(distinct vehicule_id) as vehicules,
       min(date) as du, max(date) as au,
       min(km) as km_min, max(km) as km_max
from releve_kilometrique where origine = 'garage';
`;

writeFileSync(join(projet, "supabase/kilometrages.sql"), sortie, "utf8");

console.log(`${retenus.length} relevés retenus, ${veh.size} véhicules, du ${retenus[0]?.date} au ${retenus.at(-1)?.date}`);
console.log(`  ${incoherents.length} paire(s) écartée(s) pour compteur qui recule`);
for (const x of incoherents.slice(0, 6)) console.log(`    ${x.immatriculation} : ${x.avant} puis ${x.apres}`);
for (const [r, n] of Object.entries(ecartes).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)} × ${r}`);
console.log("supabase/kilometrages.sql écrit");
