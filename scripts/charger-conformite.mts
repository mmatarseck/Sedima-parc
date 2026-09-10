/* ============================================================================
 * Fabrique `supabase/conformite.sql` — visites techniques et licences réelles.
 *
 * LE MANQUE. Après la purge, la Conformité ne tient que les attestations
 * d'assurance : l'écran des échéances est presque vide, et la pastille
 * « Échéances » ne compte que ce qui reste. Or le dossier DO tient deux fiches
 * de suivi à jour, dans « MALICK / FICHE SUIVI 2026 ».
 *
 * CE QU'ELLES DONNENT.
 *
 *   * `VISITES TECHNIQUES.xlsx` — une plaque et une **date de visite**, pour
 *     cent vingt-huit véhicules.
 *   * `FICHE SUIVI LICENCE VEHICULES.xlsx` — une plaque, une **date de
 *     délivrance** et une **date d'expiration**, pour trente-cinq véhicules.
 *
 * L'ÉCHÉANCE D'UNE VISITE, ET POURQUOI LA CALCULER N'EST PAS L'INVENTER. La
 * fiche des visites ne porte que la date de passage. Mais l'application
 * déclare elle-même la règle : `type_document` range la visite technique avec
 * `validite_mois = 12`. Poser l'échéance à douze mois du passage, ce n'est pas
 * fabriquer une donnée, c'est appliquer la règle que le référentiel énonce.
 * Chaque document le dit d'ailleurs dans son émetteur.
 *
 * Les licences, elles, n'ont besoin d'aucune règle : la fiche donne les deux
 * dates.
 *
 * POURQUOI DES `document` ET NON DES `visite_technique`. La table des visites
 * décrit un **rendez-vous** — centre agréé, heure, résultat, délai de
 * contre-visite — et exige un centre que la fiche ne nomme pas. Ce qu'on a
 * ici, c'est une pièce et sa validité : c'est un document, et c'est ce que la
 * Conformité lit pour ses échéances.
 *
 * Les licences vont dans `licence_transport`, avec un périmètre « partie » et
 * une ligne de `licence_vehicule` : au Sénégal chaque véhicule porte sa propre
 * licence, et la fiche donne bien des dates par véhicule.
 *
 * Lancer : npx tsx scripts/charger-conformite.mts
 * ==========================================================================*/

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { normaliser } from "../src/domaine/immatriculation";

const RACINE =
  "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/MALICK/FICHE SUIVI 2026";
const projet = process.cwd();

const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());
const jour = (c: Cellule): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(texte(c)) ? texte(c) : null);
const plaque = (c: Cellule): string | null => {
  const p = normaliser(texte(c));
  return /^[A-Z]{2}\d{3,4}[A-Z]{1,2}$/.test(p) ? p : null;
};
/** La même date, `mois` mois plus tard, en gardant le jour du mois. */
function plusMois(d: string, mois: number): string {
  const t = new Date(`${d}T00:00:00Z`);
  const jourDuMois = t.getUTCDate();
  t.setUTCMonth(t.getUTCMonth() + mois);
  /* Un 31 reporté sur un mois de trente jours déborde : on le ramène au dernier
     jour du mois voulu plutôt que de glisser sur le suivant. */
  if (t.getUTCDate() !== jourDuMois) t.setUTCDate(0);
  return t.toISOString().slice(0, 10);
}

const seed = readFileSync(join(projet, "supabase/seed.sql"), "utf8");
const parc = new Set<string>();
for (const b of seed.matchAll(/insert into vehicule \([^)]*\) values[\s\S]*?\non conflict do nothing;/g)) {
  for (const m of b[0].matchAll(/'([A-Z]{2}\d{3,4}[A-Z]{1,2})'/g)) parc.add(m[1]!);
}

const ecartes: Record<string, number> = {};
const ecarte = (r: string) => (ecartes[r] = (ecartes[r] ?? 0) + 1);

/* -- 1. Les visites techniques ---------------------------------------------- */

/**
 * La colonne « DATE VISITE TECHNIQUES » porte **l'échéance**, pas le passage.
 *
 * L'en-tête dit le contraire, et le premier jet l'a cru : les documents
 * sortaient alors avec une validité qui courait jusqu'en 2028, et sept
 * échéances passées seulement. Le compte l'a démenti — **94 des 127 dates sont
 * dans le futur**, jusqu'au 19 août 2027. Une visite technique ne se passe pas
 * l'an prochain ; ce que la fiche suit, c'est la date à laquelle il faudra y
 * retourner.
 *
 * On lit donc la colonne comme une échéance, et l'on remonte de douze mois
 * pour la date d'effet — la validité que `type_document` donne à une visite.
 * Une donnée qui contredit son en-tête, ce sont les dates qui gagnent.
 */
const VALIDITE_VISITE = 12;
interface Visite {
  immatriculation: string;
  passage: string;
  echeance: string;
}
const visites: Visite[] = [];
const feuilleVisites = lireClasseur(join(RACINE, "VISITES TECHNIQUES.xlsx"))[0];
if (feuilleVisites) {
  const entete = feuilleVisites.lignes[0]!.map((c) => texte(c).toUpperCase());
  const cImmat = entete.findIndex((e) => /CHASSIS|IMMAT/.test(e));
  const cDate = entete.findIndex((e) => /DATE VISITE/.test(e));
  for (const l of feuilleVisites.lignes.slice(1)) {
    const immat = plaque(l[cImmat] ?? null);
    const echeance = jour(l[cDate] ?? null);
    if (!immat) {
      if (texte(l[cImmat] ?? null)) ecarte("visite : immatriculation illisible");
      continue;
    }
    if (!echeance) {
      ecarte("visite : aucune date");
      continue;
    }
    if (!parc.has(immat)) {
      ecarte("visite : véhicule hors du parc");
      continue;
    }
    visites.push({ immatriculation: immat, passage: plusMois(echeance, -VALIDITE_VISITE), echeance });
  }
}
/* Un véhicule peut figurer deux fois ; on ne garde que la visite la plus
   récente, qui est celle qui vaut. */
const derniereVisite = new Map<string, Visite>();
for (const v of visites.sort((a, b) => a.echeance.localeCompare(b.echeance))) derniereVisite.set(v.immatriculation, v);
const visitesRetenues = [...derniereVisite.values()].sort((a, b) => a.echeance.localeCompare(b.echeance));

/* -- 2. Les licences de transport ------------------------------------------- */

interface Licence {
  immatriculation: string;
  effet: string;
  echeance: string;
}
const licences: Licence[] = [];
const feuilleLicences = lireClasseur(join(RACINE, "FICHE SUIVI LICENCE VEHICULES.xlsx"))[0];
if (feuilleLicences) {
  const entete = feuilleLicences.lignes[0]!.map((c) => texte(c).toUpperCase());
  const cImmat = entete.findIndex((e) => /VEHICULE|IMMAT/.test(e));
  const cEffet = entete.findIndex((e) => /DELIVRANCE/.test(e));
  const cFin = entete.findIndex((e) => /EXPIRATION/.test(e));
  for (const l of feuilleLicences.lignes.slice(1)) {
    const immat = plaque(l[cImmat] ?? null);
    const echeance = jour(l[cFin] ?? null);
    if (!immat) {
      if (texte(l[cImmat] ?? null)) ecarte("licence : immatriculation illisible");
      continue;
    }
    if (!echeance) {
      ecarte("licence : aucune date d'expiration");
      continue;
    }
    if (!parc.has(immat)) {
      ecarte("licence : véhicule hors du parc");
      continue;
    }
    /* Sans date de délivrance, on remonte de deux ans depuis l'expiration :
       c'est la validité que le référentiel donne à une licence de transport.
       La contrainte de la table exige d'ailleurs une date d'effet antérieure. */
    const effet = jour(l[cEffet] ?? null) ?? plusMois(echeance, -24);
    if (effet >= echeance) {
      ecarte("licence : la délivrance ne précède pas l'expiration");
      continue;
    }
    licences.push({ immatriculation: immat, effet, echeance });
  }
}
const derniereLicence = new Map<string, Licence>();
for (const l of licences.sort((a, b) => a.echeance.localeCompare(b.echeance))) derniereLicence.set(l.immatriculation, l);
const licencesRetenues = [...derniereLicence.values()].sort((a, b) => a.echeance.localeCompare(b.echeance));

/* -- 3. Le fichier ---------------------------------------------------------- */

const vehicule = (immat: string) => `(select id from vehicule where immatriculation = '${immat}')`;

const lignesDocuments = visitesRetenues.map(
  (v, i) =>
    `  ('DOC-VT-${String(i + 1).padStart(5, "0")}', 'visite-technique', ${vehicule(v.immatriculation)}, '${v.passage}', '${v.echeance}', 'Fiche de suivi 2026 — la fiche donne l''échéance ; le passage est calculé à ${VALIDITE_VISITE} mois en arrière', true)`,
);

const lignesLicences = licencesRetenues.map(
  (l, i) =>
    `  ('LIC-R-${String(i + 1).padStart(5, "0")}', 'Licence de transport ${l.immatriculation}', 'LIC-${l.immatriculation}', 'Ministère des Transports', 'partie', '${l.effet}', '${l.echeance}')`,
);
const lignesRattachement = licencesRetenues.map(
  (l, i) => `  ((select id from licence_transport where numero = 'LIC-R-${String(i + 1).padStart(5, "0")}'), ${vehicule(l.immatriculation)})`,
);

const aujourdhui = new Date().toISOString().slice(0, 10);
const echues = (d: { echeance: string }[]) => d.filter((x) => x.echeance < aujourdhui).length;

const sortie = `-- ============================================================================
-- SEDIMA Parc — la conformité réelle : visites techniques et licences.
--
-- **Ce n'est pas une migration.** Chargement tiré des deux fiches de suivi du
-- dossier DO, « MALICK / FICHE SUIVI 2026 ».
--
--   * ${visitesRetenues.length} visites techniques, dont ${echues(visitesRetenues)} déjà échues ;
--   * ${licencesRetenues.length} licences de transport, dont ${echues(licencesRetenues)} déjà échues.
--
-- CE QUE LA COLONNE « DATE VISITE TECHNIQUES » CONTIENT VRAIMENT. Son en-tête
-- annonce une date de visite ; ce sont des **échéances**. Le compte le
-- démontre : 94 des 127 dates sont dans le futur, jusqu'au 19 août 2027, et
-- une visite technique ne se passe pas l'an prochain. Ce que la fiche suit,
-- c'est la date à laquelle il faudra y retourner. Quand une donnée contredit
-- son en-tête, ce sont les dates qui gagnent.
--
-- La date d'effet est donc calculée en remontant de douze mois — la validité
-- que \`type_document\` donne à une visite. Ce n'est pas inventer une donnée,
-- c'est appliquer la règle que le référentiel énonce, et chaque document le
-- dit dans son émetteur.
--
-- Les licences n'ont besoin d'aucune règle : la fiche donne les deux dates.
-- Quand la délivrance manque, on remonte de vingt-quatre mois depuis
-- l'expiration — la validité que le référentiel donne à une licence — parce
-- que la table exige une date d'effet antérieure à l'échéance.
--
-- POURQUOI DES \`document\` ET NON DES \`visite_technique\`. Cette table décrit un
-- **rendez-vous** — centre agréé, heure, résultat, délai de contre-visite — et
-- exige un centre que la fiche ne nomme pas. Ce qu'on a ici est une pièce et sa
-- validité : c'est un document, et c'est ce que la Conformité lit.
--
-- Un véhicule qui figure deux fois ne garde que sa **dernière** pièce : c'est
-- celle qui vaut.
--
-- REJOUABLE : \`on conflict do nothing\` partout.
-- ============================================================================

begin;

-- ---- Les visites techniques ----
insert into document (numero, type_document_id, vehicule_id, date_effet, echeance, emetteur, justificatif) values
${lignesDocuments.join(",\n")}
on conflict (numero) do nothing;

-- ---- Les licences de transport ----
insert into licence_transport (numero, libelle, numero_piece, emetteur, perimetre, date_effet, echeance) values
${lignesLicences.join(",\n")}
on conflict (numero) do nothing;

insert into licence_vehicule (licence_id, vehicule_id) values
${lignesRattachement.join(",\n")}
on conflict do nothing;

commit;


-- ---------------------------------------------------------------------------
-- Vérification.
-- ---------------------------------------------------------------------------

select 'visites techniques' as quoi, count(*)::int as pieces,
       count(*) filter (where echeance < current_date)::int as echues,
       min(echeance)::text as plus_ancienne, max(echeance)::text as plus_lointaine
  from document where type_document_id = 'visite-technique'
union all
select 'licences', count(*)::int,
       count(*) filter (where echeance < current_date)::int,
       min(echeance)::text, max(echeance)::text
  from licence_transport where numero like 'LIC-R-%';
`;

writeFileSync(join(projet, "supabase/conformite.sql"), sortie, "utf8");

console.log(`${visitesRetenues.length} visites techniques, dont ${echues(visitesRetenues)} échues au ${aujourdhui}`);
console.log(`${licencesRetenues.length} licences, dont ${echues(licencesRetenues)} échues`);
for (const [r, n] of Object.entries(ecartes).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)} × ${r}`);
console.log("supabase/conformite.sql écrit");
