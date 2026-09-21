/* La fiche véhicule, demandes du 21 septembre 2026 : renouveler un document en
 * déposant sa pièce justificative, Conformité et Dossier réunis, et déclarer un
 * incident depuis son onglet, photos et documents compris.
 * Lancer : PGLITE_DIR=<dossier PGlite> node --import tsx --import ./scripts/rendu/hook.mjs scripts/tester-conformite-incidents.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { ChampPieces } from "../src/composants/interface/ChampPieces";
import { FournisseurEdition } from "../src/composants/transactions/ContexteEdition";
import { OngletIncidents } from "../src/composants/vehicule/OngletIncidents";
import { assemblerFiche, FAITS_VIDES } from "../src/domaine/assembler-fiche";
import type { LigneIncident } from "../src/domaine/incidents";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { preuveDuRappel } from "../src/domaine/rappels";
import { passagesReleves, planDuVehicule, programmeParDefaut } from "../src/donnees/entretien-demo";
import { sourceRapportsDemo } from "../src/donnees/rapports-demo";
import { ligneCreation } from "../src/lib/transactions-colonnes";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- Renouveler, c'est déposer la pièce ------------------------------------------ */

const documents = [
  { numero: "DOC-1", type: "assurance", dateEffet: "2025-01-01", fichier: "pieces/documents/2025/01/police-2025.pdf" },
  { numero: "DOC-2", type: "assurance", dateEffet: "2026-01-01", fichier: "pieces/documents/2026/01/police-2026.pdf" },
  { numero: "DOC-3", type: "assurance", dateEffet: "2026-06-01", fichier: null },
  { numero: "DOC-4", type: "visite-technique", dateEffet: "2026-03-01", fichier: "pieces/documents/2026/03/pv.pdf" },
];
attendu("la preuve d'un rappel est le plus récent document du même type qui porte un scan", preuveDuRappel({ type: "assurance", documentNumero: null }, documents)?.numero === "DOC-2");
attendu("le document cité par le rappel passe devant, s'il porte un scan", preuveDuRappel({ type: "assurance", documentNumero: "DOC-1" }, documents)?.numero === "DOC-1");
attendu("un document cité sans scan ne prouve rien : on retombe sur le type", preuveDuRappel({ type: "assurance", documentNumero: "DOC-3" }, documents)?.numero === "DOC-2");
attendu("sans pièce du type, pas de preuve inventée", preuveDuRappel({ type: "carte-grise", documentNumero: null }, documents) === null);

const onglets = readFileSync("src/composants/vehicule/onglets.tsx", "utf8");
const conformite = onglets.slice(onglets.indexOf("export function OngletConformite"), onglets.indexOf("export function OngletMaintenance"));
attendu("« Renouveler » crée le document, pièce obligatoire, puis porte l'échéance sur le rappel", /creer\(\{\s*type: "document"/.test(conformite) && conformite.includes(`c.cle === "fichier"`) && conformite.includes("obligatoire: true") && conformite.includes("enregistrerModification({") && conformite.includes(`type: "rappel"`));
attendu("la ligne du rappel montre le trombone et ouvre sa pièce à droite", conformite.includes("<IndicateurPiece present={Boolean(preuveDuRappel(r, documentsConnus)?.fichier)} />") && conformite.includes("<VisionneusePiece"));

/* -- Conformité et Dossier réunis --------------------------------------------------- */

const ficheVehicule = readFileSync("src/composants/vehicule/FicheVehicule.tsx", "utf8");
const listeOnglets = ficheVehicule.slice(ficheVehicule.indexOf("const ONGLETS"), ficheVehicule.indexOf("function estOnglet"));
attendu("un seul onglet « Conformité & dossier », plus d'onglet « Dossier »", listeOnglets.includes(`libelle: "Conformité & dossier"`) && !listeOnglets.includes(`cle: "dossier"`));
attendu("il porte les échéances puis le dossier, sur tous les écrans", /onglet === "conformite" && \(\s*<div className="flex flex-col gap-8">\s*<OngletConformite[\s\S]*?<OngletDossier fiche=\{fiche\} \/>/.test(ficheVehicule) && !ficheVehicule.includes(`<div className="hidden lg:block">\n            <OngletDossier`));
attendu("une ancienne adresse « onglet=dossier » ouvre la Conformité", ficheVehicule.includes(`if (valeur === "dossier") return "conformite";`));
attendu("le menu « Ajouter » ouvre la saisie de facture pour une intervention ou une dépense", /if \(cible === "intervention" \|\| cible === "depense"\) \{\s*saisirFacture\(/.test(ficheVehicule));
attendu("plus aucune date figée au 2 septembre dans la fiche", !ficheVehicule.includes(`"2026-09-02"`) && !readFileSync("src/composants/vehicule/ajout.ts", "utf8").includes(`"2026-09-02"`));

/* -- Déclarer un incident, photos comprises ------------------------------------------ */

const photos = ["pieces/documents/2026/09/avant.jpg", "pieces/documents/2026/09/constat.pdf"];
const avec = ligneCreation("incident", "INC-2026-90001", { dateHeure: "2026-09-21T10:30", nature: "accident", type: "collision", description: "Choc arrière", pieces: photos }, { vehiculeId: "v-1", chauffeurId: null, prestataireId: null });
const sans = ligneCreation("incident", "INC-2026-90002", { dateHeure: "2026-09-21T10:30", nature: "incident", type: "panne-mecanique", pieces: [] }, { vehiculeId: "v-1", chauffeurId: null, prestataireId: null });
attendu("la déclaration s'écrit avec ses photos et documents", "ligne" in avec && JSON.stringify(avec.ligne.pieces) === JSON.stringify(photos));
attendu("sans pièce, la colonne n'est pas écrite — la déclaration passe même avant 0058", "ligne" in sans && !("pieces" in sans.ligne));

const cadres = (html: string) => (html.match(/type="file"/g) ?? []).length;
const deux = renderToString(React.createElement(ChampPieces, { valeur: photos, onChange: () => {} }));
attendu(`deux pièces déposées, et un cadre qui attend la suivante (${cadres(deux)} cadres)`, cadres(deux) === 3 && deux.includes("Une autre"));
const pleine = renderToString(React.createElement(ChampPieces, { valeur: photos, onChange: () => {}, maximum: 2 }));
attendu("au maximum, plus de cadre vide", cadres(pleine) === 2);

const formulaire = readFileSync("src/composants/incidents/FormulaireDeclaration.tsx", "utf8");
attendu("le formulaire de déclaration propose les photos et documents, et les enregistre", formulaire.includes("<ChampPieces valeur={s.pieces}") && formulaire.includes("pieces: s.pieces,") && !formulaire.includes("au branchement de la base"));

const ligne = sourceRapportsDemo().lignes[0]!;
const incident: LigneIncident = {
  numero: "INC-2026-00001", vehiculeId: ligne.vehicule.id, immatriculation: ligne.vehicule.immatriculation, immatriculationAffichee: ligne.vehicule.immatriculationAffichee, vehicule: "Banc", businessUnit: null, site: null,
  nature: "accident", type: "collision", dateHeure: "2026-09-20T08:00", lieu: "Rufisque", chauffeurId: null, chauffeur: null, mission: null, roulant: "oui", statut: "declare", responsabilite: null, blesses: false, sinistreOuvert: false,
  cout: null, immobilisationJours: null, description: "", kilometrage: null, declarant: "Banc", pieces: photos, creee: false,
};
const fiche = assemblerFiche(ligne, { ...FAITS_VIDES, incidents: [incident] }, PARAMETRES_DEFAUT, "2026-09-21", { programme: programmeParDefaut(ligne.vehicule.categorie), plan: planDuVehicule(ligne.vehicule.id, ligne.vehicule.categorie), passages: passagesReleves });
const onglet = renderToString(React.createElement(FournisseurEdition, { sujet: `vehicule:${ligne.vehicule.immatriculation}`, href: "/flotte" }, React.createElement(OngletIncidents, { fiche, onDeclarer: () => {} })));
attendu("l'onglet Incidents a son bouton « Déclarer », comme les autres onglets", onglet.includes("Déclarer un incident ou sinistre"));
attendu("une déclaration qui porte des pièces montre le trombone et leur nombre", onglet.includes("pièce jointe") && />2<\/span>/.test(onglet));

/* -- La colonne existe, et la base accepte la déclaration ----------------------------- */

const bac = process.env.PGLITE_DIR ?? "";
if (bac) {
  const require = createRequire(join(bac, "package.json"));
  const { PGlite } = require("@electric-sql/pglite");
  const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
  const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
  const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
  await pg.exec(`create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
  for (const r of ["anon", "authenticated", "service_role"]) {
    try {
      await pg.exec(`create role ${r}`);
    } catch {}
  }
  for (const m of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(join("supabase/migrations", m), "utf8"));
  await pg.exec(`insert into vehicule (id, immatriculation, marque, appellation, categorie) values ('00000000-0000-0000-0000-0000000000aa', 'AB123CD', 'Banc', 'Banc', 'camion');`);
  const l = (avec as { ligne: Record<string, unknown> }).ligne;
  await pg.query(`insert into incident (numero, vehicule_id, date_heure, nature, type, description, statut, pieces) values ($1, '00000000-0000-0000-0000-0000000000aa', $2, $3, $4, $5, 'declare', $6)`, [l.numero, l.date_heure, l.nature, l.type, l.description, l.pieces]);
  const lu = (await pg.query(`select pieces from incident where numero = $1`, [l.numero])).rows[0] as { pieces: string[] };
  attendu("0058 : la base garde les pièces de la déclaration, dans l'ordre", JSON.stringify(lu.pieces) === JSON.stringify(photos));
  const defaut = (await pg.query(`insert into incident (numero, vehicule_id, date_heure, nature, type, statut) values ('INC-X', '00000000-0000-0000-0000-0000000000aa', now(), 'incident', 'autre', 'declare') returning pieces`)).rows[0] as { pieces: string[] };
  attendu("une déclaration sans pièce a une liste vide, pas nulle", Array.isArray(defaut.pieces) && defaut.pieces.length === 0);
} else console.log("—   PGLITE_DIR absent : la migration 0058 n'est pas éprouvée");

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);
