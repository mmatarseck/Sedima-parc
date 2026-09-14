/* ============================================================================
 * Fabrique `supabase/pieces-parties/` — le magasin de pièces, à ses premières
 * matières : les batteries du parc et les embrayages Tata.
 *
 * Les tables `piece` et `mouvement_stock` (0029) sont vides : l'écran Pièces
 * n'a rien à montrer, et la consommation de pièces d'un véhicule ne se lit
 * nulle part. La gestion du parc en suit pourtant deux, dans le dossier DO :
 *
 *   * **SUIVI BATTERIES** (`MALICK/FICHE SUIVI 2026`) — trois feuilles :
 *     `Feuil1` « BATTERIES PL 2025 - 2026 », une ligne par montage avec la
 *     quantité, le prix unitaire, le bon, la demande et la date ; `BC17695`,
 *     la campagne de février 2025 — 20 batteries 150 AH et 10 de 100 AH
 *     reçues, puis remises véhicule par véhicule ; `NOUVELLES DEMANDES`, les
 *     besoins exprimés, qui ne sont pas des mouvements.
 *   * **FICHE SUIVI DISQUE TATA** (même dossier) — « 5 DISQUE PLATEAU BITE
 *     ACHETE A TATA SUR BC18812 », et les montages faits dessus.
 *
 * LES BONS SONT DÉJÀ AU RÉFÉRENTIEL, chargés le 11 septembre depuis les bons
 * de commande du dossier DO (`achats-01-bons-de-commande.sql`). Ils donnent ce
 * que les classeurs taisent — la date, le fournisseur, la demande d'achat :
 *
 *   BC17695 / DA20021 — 4 février 2025, ETS MALEYE, « …ET BATTERIES POUR LES
 *     PNEUS LOURDS ET LEGERS DU PARC ».
 *   BC18521 / DA20846 — 3 juillet 2025, SICAS, « BATTERIE 100AH ; 150AH ».
 *   BC18812 / DA21232 — 29 août 2025, TATA INTERNATIONAL / UNITECH, « ACHAT
 *     DISQUE, PLATEAU ET BUTEE POUR LES TATA LPT1618 EN GUISE DE RESERVE ».
 *
 * C'est ce dernier bon qui tranche la lecture de « DISQUE PLATEAU BITE » : un
 * kit d'embrayage — disque, plateau, butée —, donc `transmission` et non
 * `freinage`, et une unité en `jeu` et non en pièce.
 *
 * L'ENTRÉE DÉDUITE DU MONTAGE. Le magasin n'était pas tenu : les classeurs
 * suivent l'achat et la pose, pas le stock. Une batterie montée est pourtant
 * une batterie achetée, puis sortie. Chaque montage de `Feuil1` produit donc
 * son entrée à la même date, du même nombre, portant le prix, le bon et la
 * demande quand la ligne les donne — et son motif le dit. Sans quoi le stock
 * déduit serait négatif, ce qui serait un plus gros mensonge qu'une entrée
 * datée du jour de la pose.
 *
 * La campagne `BC17695` et l'achat Tata, eux, disent leur quantité reçue : ils
 * entrent pour ce qu'ils annoncent, et les remises les suivent. Ce qui reste
 * après les remises est le stock, et c'est un vrai stock.
 *
 * LA DATE SE PROPAGE VERS LE BAS, comme pour les pneus : le classeur est tenu
 * par bloc et dans l'ordre, et n'écrit la date que là où elle change. Une
 * ligne non datée prend la dernière date connue de son bloc, et son motif le
 * dit — plutôt qu'une date inventée hors du bloc, ou la perte du montage.
 *
 * CE QU'ON ÉCARTE : les lignes sans véhicule nommé — une sortie ne sort pas
 * dans le vide (contrainte `sortie_rattachee`) —, les plaques que le
 * référentiel ne connaît pas, et la feuille des demandes. Toutes sont nommées
 * au compte rendu.
 *
 * ET CE QU'ÉCARTER NE DOIT PAS FAUSSER. Un montage écarté ne doit pas laisser
 * au magasin une pièce qui n'y est pas. Deux cas, deux traitements :
 *
 *   * un montage de `Feuil1` sur une plaque inconnue disparaît **avec son
 *     entrée** — elles vont par paire, et la paire ne dit plus rien ;
 *   * une remise d'une campagne — BC17695, Tata — ne peut pas emporter son
 *     entrée, qui vaut pour tout le bon. Elle devient une **régularisation**
 *     d'écart négatif, qui nomme la plaque ou l'absence de plaque. C'est à
 *     cela qu'une régularisation sert : le magasin a compté autre chose que
 *     ce que le journal déduit, et on dit pourquoi.
 *
 * Lancer : npx tsx scripts/charger-batteries.mts
 * ==========================================================================*/

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { normaliser } from "../src/domaine/immatriculation";

const M = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/MALICK/FICHE SUIVI 2026";
const BATTERIES = join(M, "SUIVI BATTERIES.xlsx");
const TATA = join(M, "FICHE SUIVI DISQUE TATA.xlsx");
const projet = process.cwd();

const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());
const entier = (c: Cellule): number | null => {
  const n = typeof c === "number" ? c : Number(texte(c).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const PLAQUE = /^[A-Z]{2}\d{3,4}[A-Z]{1,2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Une date du classeur : « 2025-07-05 » telle quelle, « LE 9/02/2025 » recomposée. */
function dateDe(c: Cellule): string | null {
  const t = texte(c);
  if (ISO.test(t)) return t;
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

/* -- Les trois pièces -------------------------------------------------------- */

interface Fiche {
  numero: string;
  reference: string;
  designation: string;
  categorie: string;
  unite: string;
  compatibilites: string[];
  fournisseur: string;
  /** La raison sociale normalisée, pour retrouver le prestataire au référentiel. */
  prestataire: string | null;
  prixReference: number | null;
  commentaire: string;
}

const BAT150 = "PCE-R-001";
const BAT100 = "PCE-R-002";
const EMBRAYAGE = "PCE-R-003";

const fiches: Fiche[] = [
  {
    numero: BAT150,
    reference: "BAT-150AH",
    designation: "Batterie 150 AH",
    categorie: "electricite",
    unite: "piece",
    compatibilites: ["Poids lourds"],
    fournisseur: "SICAS",
    prestataire: "SICAS",
    prixReference: 162148,
    commentaire: "Batterie de poids lourd, la plus courante du parc. Prix de référence : le prix unitaire du classeur de suivi (162 148 F). Achetée chez SICAS et chez ETS MALEYE.",
  },
  {
    numero: BAT100,
    reference: "BAT-100AH",
    designation: "Batterie 100 AH",
    categorie: "electricite",
    unite: "piece",
    compatibilites: ["Véhicules légers", "Poids lourds"],
    fournisseur: "SICAS",
    prestataire: "SICAS",
    prixReference: 100061,
    commentaire: "Prix de référence : le prix unitaire du classeur de suivi (100 061 F). Achetée chez SICAS et chez ETS MALEYE.",
  },
  {
    numero: EMBRAYAGE,
    reference: "EMB-TATA-1618",
    designation: "Kit d'embrayage Tata LPT 1618 — disque, plateau, butée",
    categorie: "transmission",
    unite: "jeu",
    compatibilites: ["Tata LPT 1618"],
    fournisseur: "TATA INTERNATIONAL / UNITECH",
    prestataire: "TATAINTERNATIONALUNITECH",
    prixReference: 307862,
    commentaire: "Le classeur écrit « DISQUE PLATEAU BITE » ; le bon BC18812 dit « DISQUE, PLATEAU ET BUTEE POUR LES TATA LPT1618 EN GUISE DE RESERVE ». Prix de référence : 1 539 310 F pour cinq jeux, soit 307 862 F le jeu.",
  },
];

/* -- Les mouvements ---------------------------------------------------------- */

interface Mouvement {
  date: string;
  nature: "entree" | "sortie" | "regularisation";
  piece: string;
  quantite: number;
  /** L'écart signé d'une régularisation ; nul partout ailleurs. */
  ecart: number | null;
  prixUnitaire: number | null;
  demande: string | null;
  /** La plaque canonique servie, sur une sortie. */
  plaque: string | null;
  /** L'écriture du classeur, pour le compte rendu. */
  ecrite: string;
  fournisseur: string | null;
  motif: string;
}

const mouvements: Mouvement[] = [];
const ecartes: Record<string, number> = {};
const ecarte = (raison: string, n = 1) => (ecartes[raison] = (ecartes[raison] ?? 0) + n);
const datesPropagees: string[] = [];
const horsParc = new Map<string, number>();

/* Le référentiel des véhicules : une sortie ne se rattache qu'à un véhicule
   qu'il connaît. Lu avant les classeurs, pour trancher ligne par ligne. */
const parc = new Set<string>();
for (const f of ["supabase/seed.sql", "supabase/aligner-referentiel.sql", "supabase/vehicules-manquants.sql"]) {
  const t = readFileSync(join(projet, f), "utf8");
  for (const b of t.matchAll(/insert into vehicule \([^)]*\) values[\s\S]*?\non conflict[^;]*;/g)) {
    for (const m of b[0].matchAll(/'([A-Z]{2}\d{3,4}[A-Z]{1,2})'/g)) parc.add(m[1]!);
  }
}

/** Une remise qu'on ne peut pas rattacher : l'entrée du bon reste, l'écart le dit. */
function regulariser(piece: string, date: string, quantite: number, ecrite: string, raison: string): void {
  mouvements.push({ date, nature: "regularisation", piece, quantite, ecart: -quantite, prixUnitaire: null, demande: null, plaque: null, ecrite, fournisseur: null, motif: raison });
}

/** La pièce d'une désignation « 150 AH », « 100AH ». */
function pieceDe(designation: string): string | null {
  const d = designation.toUpperCase().replace(/\s/g, "");
  if (d.includes("150AH")) return BAT150;
  if (d.includes("100AH")) return BAT100;
  return null;
}

const classeur = lireClasseur(BATTERIES);
const feuille = (nom: string) => classeur.find((f) => f.nom === nom)?.lignes ?? [];

/* -- 1. Feuil1 : les montages 2025-2026 -------------------------------------- */
/* IMMAT | DESIGNATION | QTITE | PU | PTT-HT | N* BC | N* DA | FOURNISSEURS | DATE MONTAGE.
   Achat et pose le même jour : le classeur ne connaît pas d'entrepôt. */

let dateCourante: string | null = null;
for (const ligne of feuille("Feuil1").slice(2)) {
  const ecrite = texte(ligne[0]);
  const plaque = normaliser(ecrite);
  const piece = pieceDe(texte(ligne[1]));
  const quantite = entier(ligne[2]);
  if (!PLAQUE.test(plaque) || !piece || !quantite) {
    if (ecrite || texte(ligne[1])) ecarte("montage sans plaque, désignation ou quantité lisible");
    continue;
  }
  const datePropre = dateDe(ligne[8]);
  if (datePropre) dateCourante = datePropre;
  if (!dateCourante) {
    ecarte("montage avant toute date du classeur");
    continue;
  }
  /* Une paire entrée-sortie déduite du même montage : la plaque inconnue les
     emporte toutes les deux, sans quoi le magasin garderait une batterie posée. */
  if (!parc.has(plaque)) {
    horsParc.set(ecrite, (horsParc.get(ecrite) ?? 0) + quantite);
    continue;
  }
  if (!datePropre) datesPropagees.push(`${ecrite} — ${quantite} × ${texte(ligne[1])}, datée du ${dateCourante}`);
  const prix = entier(ligne[3]);
  const bon = entier(ligne[5]);
  const demande = entier(ligne[6]);
  const fournisseur = texte(ligne[7]) || null;
  const cite = [bon ? `BC${bon}` : null, demande ? `DA${demande}` : null].filter(Boolean).join(" / ");
  const provenance = cite ? `Achetée au bon ${cite}${fournisseur ? ` (${fournisseur})` : ""}.` : "Le classeur ne nomme pas le bon de cet achat.";
  const propagee = datePropre ? "" : " Date de montage non relevée au classeur : celle de la ligne datée qui précède.";
  mouvements.push(
    { date: dateCourante, nature: "entree", piece, quantite, ecart: null, prixUnitaire: prix, demande: cite || null, plaque: null, ecrite, fournisseur, motif: `Entrée déduite du montage : le classeur suit l'achat et la pose, pas le magasin. ${provenance}${propagee}` },
    { date: dateCourante, nature: "sortie", piece, quantite, ecart: null, prixUnitaire: null, demande: cite || null, plaque, ecrite, fournisseur: null, motif: `Montée sur le véhicule, d'après SUIVI BATTERIES (feuille « BATTERIES PL 2025 - 2026 »).${propagee}` },
  );
}

/* -- 2. BC17695 : la campagne de février 2025 -------------------------------- */
/* Un bloc par format : son titre dit le nombre reçu, ses lignes les remises.
   DESIGNATION | PU | PTT - HT | IMMAT | DATE DE RECEPTION | NBRE BATTERIES. */

const RECU = /^(\d+)\s+BATTERIES?\s+(\d+)\s*AH/i;
const remises: { piece: string; date: string; quantite: number; plaque: string; ecrite: string; propagee: boolean }[] = [];
let bloc: string | null = null;
let dateBloc: string | null = null;
const recus: { piece: string; quantite: number }[] = [];

for (const ligne of feuille("BC17695")) {
  const titre = RECU.exec(texte(ligne[0]));
  if (titre) {
    bloc = pieceDe(`${titre[2]}AH`);
    dateBloc = null;
    if (bloc) recus.push({ piece: bloc, quantite: Number(titre[1]) });
    continue;
  }
  const ecrite = texte(ligne[3]);
  if (!ecrite || ecrite === "IMMAT") continue;
  const piece = pieceDe(texte(ligne[0])) ?? bloc;
  const quantite = entier(ligne[5]);
  const plaque = normaliser(ecrite);
  if (!piece || !quantite || !PLAQUE.test(plaque)) {
    ecarte("remise de la campagne BC17695 sans plaque, format ou quantité lisible");
    continue;
  }
  const datePropre = dateDe(ligne[4]);
  if (datePropre) dateBloc = datePropre;
  if (!dateBloc) {
    ecarte("remise BC17695 avant toute date du bloc");
    continue;
  }
  if (!datePropre) datesPropagees.push(`${ecrite} — ${quantite} batterie(s) de la campagne BC17695, datée du ${dateBloc}`);
  remises.push({ piece, date: dateBloc, quantite, plaque, ecrite, propagee: !datePropre });
}

/* L'entrée précède les remises : la date du bon (4 février 2025), pas celle de
   la première remise. Le bon donne aussi le fournisseur et la demande. */
for (const r of recus) {
  mouvements.push({
    date: "2025-02-04",
    nature: "entree",
    piece: r.piece,
    quantite: r.quantite,
    ecart: null,
    prixUnitaire: null,
    demande: "BC17695 / DA20021",
    plaque: null,
    ecrite: "",
    fournisseur: "ETS MALEYE",
    motif: "Réception de la campagne BC17695, telle que le classeur l'annonce. Le bon (4 février 2025, ETS MALEYE) couvre aussi des pneus : son montant ne se rapporte pas aux seules batteries.",
  });
}
for (const r of remises) {
  const propagee = r.propagee ? " Date de remise non relevée au classeur : celle de la ligne datée qui précède." : "";
  if (!parc.has(r.plaque)) {
    horsParc.set(r.ecrite, (horsParc.get(r.ecrite) ?? 0) + r.quantite);
    regulariser(r.piece, r.date, r.quantite, r.ecrite, `Remise de la campagne BC17695 à ${r.ecrite}, plaque hors référentiel : la sortie ne peut être rattachée à aucun véhicule, et l'entrée du bon vaut pour la campagne entière. L'écart la retire du magasin sans l'imputer.${propagee}`);
    continue;
  }
  mouvements.push({
    date: r.date,
    nature: "sortie",
    piece: r.piece,
    quantite: r.quantite,
    ecart: null,
    prixUnitaire: null,
    demande: "BC17695 / DA20021",
    plaque: r.plaque,
    ecrite: r.ecrite,
    fournisseur: null,
    motif: `Remise de la campagne BC17695, d'après SUIVI BATTERIES (feuille « BC17695 »).${propagee}`,
  });
}

/* -- 3. Les embrayages Tata -------------------------------------------------- */
/* « 5 DISQUE PLATEAU BITE ACHETE A TATA SUR BC18812 », puis les montages.
   Aucune date de montage n'est relevée : celle du bon vaut pour tout le bloc. */

const DATE_TATA = "2025-08-29";
const lignesTata = lireClasseur(TATA)[0]?.lignes ?? [];
const acheteesTata = Number(/^(\d+)\s+DISQUE/i.exec(texte(lignesTata[0]?.[0]))?.[1] ?? 0);
if (acheteesTata > 0) {
  mouvements.push({
    date: DATE_TATA,
    nature: "entree",
    piece: EMBRAYAGE,
    quantite: acheteesTata,
    ecart: null,
    prixUnitaire: 307862,
    demande: "BC18812 / DA21232",
    plaque: null,
    ecrite: "",
    fournisseur: "TATA INTERNATIONAL / UNITECH",
    motif: "Achat du bon BC18812 (29 août 2025, TATA INTERNATIONAL / UNITECH), « en guise de réserve » : cinq jeux à 307 862 F.",
  });
}
for (const ligne of lignesTata.slice(2)) {
  const ecrite = texte(ligne[1]);
  const quantite = entier(ligne[2]);
  if (!quantite || !texte(ligne[0])) continue;
  const plaque = normaliser(ecrite);
  if (!PLAQUE.test(plaque)) {
    ecarte("montage Tata sans véhicule nommé", quantite);
    regulariser(EMBRAYAGE, DATE_TATA, quantite, "", "Jeu monté d'après FICHE SUIVI DISQUE TATA, sur un véhicule que le classeur ne nomme pas : la sortie ne peut être rattachée, et l'entrée du bon vaut pour les cinq jeux. L'écart le retire du magasin sans l'imputer. Date non relevée : celle du bon d'achat.");
    continue;
  }
  if (!parc.has(plaque)) {
    horsParc.set(ecrite, (horsParc.get(ecrite) ?? 0) + quantite);
    regulariser(EMBRAYAGE, DATE_TATA, quantite, ecrite, `Jeu monté sur ${ecrite}, plaque hors référentiel : la sortie ne peut être rattachée, et l'entrée du bon vaut pour les cinq jeux. L'écart le retire du magasin sans l'imputer.`);
    continue;
  }
  const atelier = texte(ligne[4]);
  mouvements.push({
    date: DATE_TATA,
    nature: "sortie",
    piece: EMBRAYAGE,
    quantite,
    ecart: null,
    prixUnitaire: null,
    demande: "BC18812 / DA21232",
    plaque,
    ecrite,
    fournisseur: null,
    motif: `Monté sur le véhicule, d'après FICHE SUIVI DISQUE TATA${atelier ? ` (« ${atelier.trim()} »)` : ""}. Date de montage non relevée au classeur : celle du bon d'achat.`,
  });
  datesPropagees.push(`${ecrite} — ${quantite} jeu(x) d'embrayage Tata, daté du ${DATE_TATA} (date du bon)`);
}

/* -- 4. Les demandes non servies : lues, pas chargées ------------------------ */

const demandes: string[] = [];
for (const ligne of feuille("NOUVELLES DEMANDES").slice(2)) {
  const ecrite = texte(ligne[0]);
  if (!ecrite) continue;
  demandes.push(`${ecrite} — ${texte(ligne[2])} × ${texte(ligne[1])}${texte(ligne[4]) ? ` (achat ${texte(ligne[4])})` : ""}`);
}

/* -- 5. L'ordre du journal --------------------------------------------------- */
/* Par date, l'entrée avant la sortie du même jour, la régularisation en dernier :
   un stock déduit ligne à ligne ne doit jamais passer par un négatif. */

const rang = { entree: 0, sortie: 1, regularisation: 2 } as const;
mouvements.sort((a, b) => a.date.localeCompare(b.date) || rang[a.nature] - rang[b.nature] || a.piece.localeCompare(b.piece));
const numerotes = mouvements.map((m, i) => ({ ...m, numero: `MVT-R-${String(i + 1).padStart(5, "0")}` }));

/* -- 6. Les fichiers --------------------------------------------------------- */

const dossier = join(projet, "supabase/pieces-parties");
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });
const sql = (v: string | null) => (v === null || v === "" ? "null" : `'${v.replace(/'/g, "''")}'`);
const num = (v: number | null) => (v === null ? "null" : String(v));
const tableau = (v: string[]) => `array[${v.map((x) => sql(x)).join(", ")}]::text[]`;
const prestataire = (n: string | null) => (n === null ? "null" : `(select id from prestataire where upper(regexp_replace(raison_sociale, '[^A-Za-z0-9]', '', 'g')) = ${sql(n)} limit 1)`);

writeFileSync(
  join(dossier, "pieces-01-referentiel.sql"),
  `-- ============================================================================
-- SEDIMA Parc — les premières pièces du magasin.
--
-- **Ce n'est pas une migration.** ${fiches.length} pièces : les deux formats de batterie
-- que le parc achète, et le kit d'embrayage des Tata LPT 1618.
-- Sources : SUIVI BATTERIES et FICHE SUIVI DISQUE TATA (dossier DO), et les
-- bons BC17695, BC18521 et BC18812 du référentiel des achats.
-- Voir docs/PIECES-REELLES.md.
--
-- Aucun seuil de réapprovisionnement n'est posé : les classeurs n'en donnent
-- pas, et un minimum inventé déclencherait de fausses demandes d'achat.
--
-- À jouer après maintenance-parties/maintenance-01-prestataires.sql : c'est lui
-- qui porte SICAS, ETS MALEYE et TATA INTERNATIONAL / UNITECH, que chaque
-- fiche rattache par sa raison sociale.
--
-- REJOUABLE : \`on conflict do nothing\`.
-- ============================================================================

insert into piece (numero, reference, designation, categorie, unite, compatibilites, prestataire_id, fournisseur, prix_reference, commentaire)
values
${fiches
  .map(
    (f) =>
      `  (${sql(f.numero)}, ${sql(f.reference)}, ${sql(f.designation)}, ${sql(f.categorie)}, ${sql(f.unite)}, ${tableau(f.compatibilites)}, ${prestataire(f.prestataire)}, ${sql(f.fournisseur)}, ${num(f.prixReference)}, ${sql(f.commentaire)})`,
  )
  .join(",\n")}
on conflict (numero) do nothing;

-- ---------------------------------------------------------------------------
-- Vérification : les pièces entrées.
-- ---------------------------------------------------------------------------

select numero, reference, designation, categorie, unite, fournisseur, prix_reference from piece where numero like 'PCE-R-%' order by numero;
`,
);

const premiere = numerotes[0]!.date;
const derniere = numerotes.at(-1)!.date;
const variation = (m: Mouvement) => (m.nature === "entree" ? m.quantite : m.nature === "sortie" ? -m.quantite : (m.ecart ?? 0));
const stocks = fiches.map((f) => ({ f, stock: numerotes.filter((m) => m.piece === f.numero).reduce((t, m) => t + variation(m), 0) }));

writeFileSync(
  join(dossier, "pieces-02-mouvements.sql"),
  `-- ============================================================================
-- SEDIMA Parc — le journal du magasin : batteries et embrayages Tata.
--
-- **Ce n'est pas une migration.** ${numerotes.length} mouvements, du ${premiere} au ${derniere} :
-- ${numerotes.filter((m) => m.nature === "entree").length} entrées, ${numerotes.filter((m) => m.nature === "sortie").length} sorties toutes rattachées à leur véhicule,
-- et ${numerotes.filter((m) => m.nature === "regularisation").length} régularisations.
-- Sources : SUIVI BATTERIES et FICHE SUIVI DISQUE TATA (dossier DO).
-- Voir docs/PIECES-REELLES.md.
--
-- Le magasin n'était pas tenu : les classeurs suivent l'achat et la pose. Une
-- batterie montée est donc entrée puis sortie le même jour, et le motif de
-- l'entrée le dit. Seules la campagne BC17695 (20 batteries 150 AH et 10 de
-- 100 AH reçues) et l'achat Tata BC18812 (5 jeux « en guise de réserve »)
-- annoncent une quantité reçue : ce qu'elles n'ont pas distribué est le stock.
--
-- Les régularisations retirent du magasin les pièces d'une campagne remises à
-- un véhicule que le référentiel ne connaît pas, ou que le classeur ne nomme
-- pas : leur entrée vaut pour tout le bon et ne peut pas s'annuler, mais la
-- pièce n'est plus au magasin. Chacune nomme son cas.
--
-- Stock déduit au terme du journal : ${stocks.map((s) => `${s.f.reference} ${s.stock}`).join(", ")}.
--
-- À jouer après pieces-01-referentiel.sql, et après vehicules-manquants.sql.
--
-- REJOUABLE : \`on conflict do nothing\`.
-- ============================================================================

insert into mouvement_stock (numero, date, nature, piece_id, quantite, ecart, prix_unitaire, demande_numero, vehicule_id, fournisseur, motif, auteur_nom)
select v.numero, v.date::date, v.nature, p.id, v.quantite, v.ecart, v.prix_unitaire, v.demande_numero, ve.id, v.fournisseur, v.motif, 'Chargement des classeurs de suivi'
  from (values
${numerotes
  .map((m) => `    (${sql(m.numero)}, ${sql(m.date)}, ${sql(m.nature)}, ${sql(m.piece)}, ${m.quantite}, ${num(m.ecart)}, ${num(m.prixUnitaire)}, ${sql(m.demande)}, ${sql(m.plaque)}, ${sql(m.fournisseur)}, ${sql(m.motif)})`)
  .join(",\n")}
  ) as v(numero, date, nature, piece_numero, quantite, ecart, prix_unitaire, demande_numero, immatriculation, fournisseur, motif)
  join piece p on p.numero = v.piece_numero
  left join vehicule ve on ve.immatriculation = v.immatriculation
on conflict (numero) do nothing;

-- ---------------------------------------------------------------------------
-- Vérification : le stock déduit, pièce par pièce.
-- ---------------------------------------------------------------------------

select p.reference, p.designation,
       sum(case m.nature when 'entree' then m.quantite when 'sortie' then -m.quantite else coalesce(m.ecart, 0) end) as stock,
       count(*) filter (where m.nature = 'entree') as entrees,
       count(*) filter (where m.nature = 'sortie') as sorties,
       count(*) filter (where m.nature = 'regularisation') as regularisations,
       count(distinct m.vehicule_id) as vehicules,
       min(m.date) as premier, max(m.date) as dernier
  from piece p join mouvement_stock m on m.piece_id = p.id
 where m.numero like 'MVT-R-%' group by 1, 2 order by 1;
`,
);

/* -- 7. Le compte rendu ------------------------------------------------------ */

console.log(`${numerotes.length} mouvements retenus : ${numerotes.filter((m) => m.nature === "entree").length} entrées, ${numerotes.filter((m) => m.nature === "sortie").length} sorties, ${numerotes.filter((m) => m.nature === "regularisation").length} régularisations, du ${premiere} au ${derniere}`);
console.log(`${new Set(numerotes.filter((m) => m.plaque).map((m) => m.plaque)).size} véhicules servis\n`);
console.log("stock déduit :");
for (const { f, stock } of stocks) {
  const siens = numerotes.filter((m) => m.piece === f.numero);
  const somme = (n: Mouvement["nature"]) => siens.filter((m) => m.nature === n).reduce((t, m) => t + m.quantite, 0);
  console.log(`  ${f.reference.padEnd(14)} ${String(stock).padStart(4)}  (${somme("entree")} entrées, ${somme("sortie")} sorties, ${somme("regularisation")} régularisées, sur ${siens.length} lignes)`);
}
console.log("\nécartés :", Object.keys(ecartes).length ? ecartes : "aucun");
console.log(`\nplaques hors référentiel : ${[...horsParc].map(([p, n]) => `${p} (${n})`).join(", ") || "aucune"}`);
console.log(`\n${datesPropagees.length} ligne(s) datée(s) par propagation :`);
for (const d of datesPropagees) console.log(`  ${d}`);
console.log(`\n${demandes.length} demande(s) non chargée(s) (feuille « NOUVELLES DEMANDES ») :`);
for (const d of demandes) console.log(`  ${d}`);
