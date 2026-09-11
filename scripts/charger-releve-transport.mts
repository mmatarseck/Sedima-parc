/* ============================================================================
 * Fabrique `supabase/releve-parties/` — le relevé de transport réel, depuis le
 * relevé de tonnage hebdomadaire de la Direction des Opérations.
 *
 * LE MANQUE. Le tableau de bord ne savait rien des tonnes : ni part confiée aux
 * tiers, ni coût du transport à la tonne, ni taux d'externalisation au tonnage.
 * `releve_transport` était vide depuis la purge.
 *
 * LA SOURCE. `RECAP TONNAGE HEBDOMMADAIRE.28.2.xlsx`, que le module a pris pour
 * modèle dès sa conception : une ligne par camion, un tonnage et une
 * destination par jour, SEDIMA comme un transporteur parmi les autres. Deux
 * copies existent (dossiers 61 et 62) ; elles se lisent à l'identique. La
 * lecture est dans `extraire-recap-tonnage.mts`.
 *
 * L'extraction Sage X3 des livraisons (YLIV) a été regardée et écartée : six
 * mille tonnes seulement en kilos sur six mois, le reste en palettes, sacs et
 * unités, et deux tiers des lignes sans immatriculation.
 *
 * CE QUE LA FEUILLE NE DIT PAS, ET CE QU'ON EN FAIT.
 *   * L'origine : ce sont les livraisons d'aliment au départ de l'usine. Toutes
 *     partent de « UAB », comme le relevé de démonstration le posait.
 *   * Le produit : aliment.
 *   * La destination, parfois : la table l'exige, la ligne dit alors « Non
 *     précisée » plutôt que d'en inventer une.
 *
 * LES PLAQUES.
 *   * Le bloc SEDIMA roule avec le parc : la plaque doit être un véhicule
 *     connu, sinon la ligne est écartée et nommée.
 *   * Deux coquilles sont redressées, avec leur preuve : AA 105 VE est le
 *     AA 105 VA du parc (même chauffeur, Djibril Ndoye, attitré au camion) ;
 *     AA 383 JZ est le AA 383 GZ d'A. Dieng (même chauffeur, Ibra Gueye).
 *   * Un camion de transporteur absent du référentiel tiers y est **ajouté**,
 *     rattaché au transporteur dont il porte les voyages : il revient chaque
 *     semaine, on le suit dans le temps — c'est la règle du référentiel.
 *   * Une plaque tronquée (« AA700 », qui peut être deux camions de Dr Wade)
 *     reste en immatriculation libre : on ne choisit pas à la place du relevé.
 *
 * REJOUABLE : `on conflict do nothing`. Les numéros suivent l'ordre date,
 * feuille, ligne, colonne ; une semaine ajoutée à la fin ne décale rien, une
 * correction dans une semaine passée décalerait la suite — il faut alors
 * comparer au fichier joué, pas au fichier régénéré.
 *
 * Lancer : npx tsx scripts/charger-releve-transport.mts
 * ==========================================================================*/

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SOURCES_RECAP, lireRecap, type Voyage } from "./extraire-recap-tonnage.mts";

const projet = process.cwd();
const echappe = (s: string) => s.replace(/'/g, "''");

/* -- 1. Le référentiel tel que la production le porte --------------------- */

const seed = readFileSync(join(projet, "supabase/seed.sql"), "utf8");
const alignement = readFileSync(join(projet, "supabase/aligner-referentiel.sql"), "utf8");
const parc = new Set<string>();
for (const texte of [seed, alignement]) {
  for (const b of texte.matchAll(/insert into vehicule \([^)]*\) values[\s\S]*?\non conflict[^;]*;/g)) {
    for (const m of b[0].matchAll(/'([A-Z]{2}\d{3,4}[A-Z]{1,2})'/g)) parc.add(m[1]!);
  }
}
const camionsConnus = new Set<string>();
for (const b of seed.matchAll(/insert into camion_tiers \([^)]*\) values[\s\S]*?\non conflict[^;]*;/g)) {
  for (const m of b[0].matchAll(/\n\s*\('([A-Z0-9]+)',/g)) camionsConnus.add(m[1]!);
}
if (parc.size < 100 || camionsConnus.size < 30) throw new Error(`référentiel mal lu : ${parc.size} véhicules, ${camionsConnus.size} camions tiers`);

/** Le bloc du relevé → le prestataire du référentiel. SEDIMA roule avec le parc. */
const TRANSPORTEURS: Record<string, string> = {
  "A DIENG": "PRE-2026-00022",
  "A KANE": "PRE-2026-00021",
  ADEX: "PRE-2026-00033",
  "DR WADE": "PRE-2026-00027",
  "SOKHNA DIOP": "PRE-2026-00023",
  /* Le profil du transporteur le dit : « rattaché à la ligne AUTRES du relevé ». */
  AUTRES: "PRE-2026-00025",
};
for (const numero of Object.values(TRANSPORTEURS)) if (!seed.includes(`'${numero}'`)) throw new Error(`${numero} absent du référentiel`);

/** Les coquilles redressées, chacune avec sa preuve (voir l'en-tête). */
const COQUILLES: Record<string, string> = { AA105VE: "AA105VA", AA383JZ: "AA383GZ" };
const PLAQUE = /^(?:[A-Z]{2}\d{3}[A-Z]{2}|DK\d{4}[A-Z]{1,2}|TH\d{4}[A-Z])$/;

/* -- 2. Le relevé ------------------------------------------------------------ */

const [source] = SOURCES_RECAP;
const lecture = lireRecap(source!);
const autre = lireRecap(SOURCES_RECAP[1]!);
const empreinte = (v: Voyage[]) => JSON.stringify(v.map((x) => [x.date, x.transporteur, x.immatriculation, x.tonnage, x.destination]));
if (empreinte(lecture.voyages) !== empreinte(autre.voyages)) console.warn("⚠ les deux copies du relevé divergent : seule celle du dossier 62 est chargée");

interface Ligne extends Voyage {
  mode: "parc" | "transporteur";
  prestataire: string | null;
  plaque: string | null;
  camionTiers: string | null;
  libre: string | null;
}
const ecartes: Record<string, number> = {};
const ecarte = (raison: string, v: Voyage) => {
  const cle = `${raison} (${v.transporteur} ${v.immatriculation ?? "sans plaque"})`;
  ecartes[cle] = (ecartes[cle] ?? 0) + v.tonnage;
};

const retenues: Ligne[] = [];
const nouveauxCamions = new Map<string, { prestataire: string; transporteur: string; capacite: number | null; voyages: number }>();
for (const v of [...lecture.voyages].sort((a, b) => a.date.localeCompare(b.date) || a.feuille.localeCompare(b.feuille) || a.ligne - b.ligne || a.colonne - b.colonne)) {
  const plaque = v.immatriculation ? (COQUILLES[v.immatriculation] ?? v.immatriculation) : null;
  if (v.transporteur === "SEDIMA") {
    if (!plaque || !parc.has(plaque)) {
      ecarte("camion SEDIMA absent du parc", v);
      continue;
    }
    retenues.push({ ...v, mode: "parc", prestataire: null, plaque, camionTiers: null, libre: null });
    continue;
  }
  const prestataire = TRANSPORTEURS[v.transporteur];
  if (!prestataire) {
    ecarte("transporteur inconnu du référentiel", v);
    continue;
  }
  let camionTiers: string | null = null;
  let libre: string | null = null;
  if (plaque && (camionsConnus.has(plaque) || nouveauxCamions.has(plaque))) camionTiers = plaque;
  else if (plaque && PLAQUE.test(plaque) && !parc.has(plaque)) {
    /* La capacité : celle que la feuille écrit le plus souvent pour cette
       plaque. Les semaines de juin et juillet laissent la colonne vide. */
    const comptes = new Map<number, number>();
    for (const w of lecture.voyages) {
      if (!w.immatriculation || (COQUILLES[w.immatriculation] ?? w.immatriculation) !== plaque) continue;
      const brute = /(\d+(?:[.,]\d+)?)\s*T\b/i.exec(w.capacite ?? "")?.[1];
      if (!brute) continue;
      const n = Number(brute.replace(",", "."));
      comptes.set(n, (comptes.get(n) ?? 0) + 1);
    }
    const capacite = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    nouveauxCamions.set(plaque, { prestataire, transporteur: v.transporteur, capacite, voyages: 0 });
    camionTiers = plaque;
  } else if (plaque) libre = plaque;
  if (camionTiers && nouveauxCamions.has(camionTiers)) {
    const n = nouveauxCamions.get(camionTiers)!;
    if (n.prestataire !== prestataire) throw new Error(`${camionTiers} roule pour ${n.transporteur} et ${v.transporteur} : à trancher avant de le rattacher`);
    n.voyages++;
  }
  retenues.push({ ...v, mode: "transporteur", prestataire, plaque, camionTiers, libre });
}

/* -- 3. Les fichiers --------------------------------------------------------- */

const sansDestination = retenues.filter((l) => !l.destination).length;
const tonnes = (liste: { tonnage: number }[]) => Math.round(liste.reduce((s, l) => s + l.tonnage, 0));
const lignesCamions = [...nouveauxCamions.entries()].map(
  ([plaque, n]) =>
    `  ('${plaque}', (select id from prestataire where numero = '${n.prestataire}'), 'camion', ${n.capacite ?? "null"}, true, 'Ajouté le 11 septembre 2026 depuis le relevé de tonnage hebdomadaire : ${n.voyages} voyage(s) pour ${echappe(n.transporteur)}.')`,
);
const valeurs = retenues.map((l, i) => {
  const numero = `TRP-2026-${String(90001 + i).padStart(5, "0")}`;
  const vehicule = l.mode === "parc" ? `(select id from vehicule where immatriculation = '${l.plaque}')` : "null";
  const prestataire = l.prestataire ? `(select id from prestataire where numero = '${l.prestataire}')` : "null";
  const camion = l.camionTiers ? `(select immatriculation from camion_tiers where immatriculation = '${l.camionTiers}')` : "null";
  const chauffeur = l.chauffeur ? `'${echappe(l.chauffeur)}'` : "null";
  return `  ('${numero}', '${l.date}', '${l.mode}', ${prestataire}, ${vehicule}, ${camion}, ${l.libre ? `'${l.libre}'` : "null"}, ${chauffeur}, 'UAB', '${echappe(l.destination ?? "Non précisée")}', 'aliment', ${Math.round(l.tonnage * 100) / 100})`;
});

const dossier = join(projet, "supabase/releve-parties");
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });

const dates = retenues.map((l) => l.date).sort();
const enTete = (titre: string, corps: string) => `-- ============================================================================
-- SEDIMA Parc — le relevé de transport réel : ${titre}.
--
-- **Ce n'est pas une migration.** Chargement tiré du relevé de tonnage
-- hebdomadaire de la Direction des Opérations (RECAP TONNAGE HEBDOMMADAIRE),
-- du ${dates[0]} au ${dates.at(-1)}. Voir docs/RELEVE-TRANSPORT-REEL.md.
--
${corps}
--
-- REJOUABLE : \`on conflict do nothing\`. À jouer **dans l'ordre des fichiers**,
-- les camions d'abord.
-- ============================================================================

`;

writeFileSync(
  join(dossier, "releve-01-camions.sql"),
  enTete(
    "les camions des transporteurs",
    `-- ${lignesCamions.length} camions que le référentiel tiers ne connaissait pas. Ils reviennent\n-- chaque semaine au relevé : chacun est rattaché au transporteur dont il porte\n-- les voyages. La capacité est celle que la feuille écrit (« PLT 40T »).`,
  ) +
    `insert into camion_tiers (immatriculation, prestataire_id, categorie, capacite_tonnes, actif, commentaire) values\n${lignesCamions.join(",\n")}\non conflict do nothing;\n\n\n-- Vérification\nselect count(*) as camions_tiers from camion_tiers;\n`,
  "utf8",
);

const TAILLE = 420;
const parties = Math.ceil(valeurs.length / TAILLE);
for (let p = 0; p < parties; p++) {
  const tranche = valeurs.slice(p * TAILLE, (p + 1) * TAILLE);
  const lignes = retenues.slice(p * TAILLE, (p + 1) * TAILLE);
  writeFileSync(
    join(dossier, `releve-${String(p + 2).padStart(2, "0")}-voyages.sql`),
    enTete(
      `les voyages, partie ${p + 1} sur ${parties}`,
      `-- ${tranche.length} voyages, ${tonnes(lignes)} t, du ${lignes[0]!.date} au ${lignes.at(-1)!.date}.`,
    ) +
      `insert into releve_transport (numero, date, mode, prestataire_id, vehicule_id, camion_tiers_immatriculation, immatriculation_libre, chauffeur, origine, destination, produit, tonnage) values\n${tranche.join(",\n")}\non conflict (numero) do nothing;\n\n\n-- Vérification\nselect mode, count(*) as voyages, sum(tonnage) as tonnes, min(date) as du, max(date) as au\n  from releve_transport where numero like 'TRP-2026-9%' group by mode;\n`,
    "utf8",
  );
}

/* -- 4. Le compte rendu ------------------------------------------------------ */

const parMode = (m: string) => retenues.filter((l) => l.mode === m);
console.log(`${retenues.length} voyages retenus, ${tonnes(retenues)} t, du ${dates[0]} au ${dates.at(-1)}`);
console.log(`  parc : ${parMode("parc").length} voyages, ${tonnes(parMode("parc"))} t · transporteurs : ${parMode("transporteur").length} voyages, ${tonnes(parMode("transporteur"))} t`);
console.log(`  ${sansDestination} voyages sans destination (« Non précisée »), ${retenues.filter((l) => l.libre).length} en immatriculation libre, ${retenues.filter((l) => l.mode === "transporteur" && !l.plaque).length} sans plaque`);
console.log(`  ${nouveauxCamions.size} camions ajoutés au référentiel : ${[...nouveauxCamions.entries()].map(([k, n]) => `${k} (${n.transporteur}, ${n.capacite ?? "?"} t, ${n.voyages} v)`).join(" · ")}`);
console.log("  écartés :");
for (const [r, t] of Object.entries(ecartes)) console.log(`    ${r} : ${Math.round(t * 100) / 100} t`);
console.log(`  ${lecture.anomalies.length} anomalie(s) de lecture, ${parties + 1} fichiers dans supabase/releve-parties/`);
