/* Rejoue la fiche véhicule comme en production : lire_parc() → ligne de la liste
 * → lire_fiche() → assemblage → rendu HTML du composant. Rien ne doit lever.
 * Le composant est un composant client : `scripts/rendu/hook.mjs` remplace `next/navigation`
 * par des crochets inertes, tout le reste est le vrai code.
 * Lancer : PGLITE_DIR=<dossier PGlite> node --import tsx --import ./scripts/rendu/hook.mjs scripts/tester-fiche-rendu.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { FournisseurEdition } from "../src/composants/transactions/ContexteEdition";
import { FicheVehicule } from "../src/composants/vehicule/FicheVehicule";
import { assemblerFiche, FAITS_VIDES, type FaitsFiche } from "../src/domaine/assembler-fiche";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { passagesReleves, planDuVehicule, programmeParDefaut } from "../src/donnees/entretien-demo";
import { ligneDepuisLaBase, lignesARecevoir, type ParcBrut } from "../src/donnees/flotte";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const projet = process.cwd();
const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
for (const m of readdirSync(join(projet, "supabase/migrations")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) { courant.push(ligne); if (/^on conflict .*;$/.test(ligne.trim())) { try { await pg.exec(courant.join("\n")); } catch {} courant = []; } }
}
const aujourdhui = new Date().toISOString().slice(0, 10);
const depuis = `${Number(aujourdhui.slice(0, 4)) - 1}${aujourdhui.slice(4)}`;
const j = (await pg.query(`select lire_parc($1) as j`, [depuis])).rows[0].j as any;
const parc: ParcBrut = {
  aujourdhui,
  attributions: j.attributions,
  attributaires: new Map(j.attributaires.map((a: any) => [a.id, a])),
  aRecevoir: j.a_recevoir,
  vehicules: j.vehicules,
  sites: new Map(j.sites.map((s: any) => [s.id, { id: s.id, code: s.code, libelle: s.libelle, region: s.region, type: s.type }])),
  chauffeurs: new Map(j.chauffeurs.map((c: any) => [c.id, c])),
  affectations: j.affectations,
  documents: j.documents,
  licences: j.licences,
  licencesVehicules: j.licences_vehicules,
  releves: j.releves,
  depenses: j.depenses,
  pleins: j.pleins,
  interventions: j.interventions,
};
const versFaits = (f: any): FaitsFiche => ({
  documents: f.documents.map((d: any) => ({ numero: d.numero, type: d.type_document_id, dateEffet: d.date_effet, echeance: d.echeance, emetteur: d.emetteur, numeroPiece: d.numero_piece, montant: d.montant, justificatif: d.justificatif })),
  licences: f.licences.map((l: any) => ({ numero: l.numero, libelle: l.libelle, numeroPiece: l.numero_piece, emetteur: l.emetteur, perimetre: l.perimetre, dateEffet: l.date_effet, echeance: l.echeance, vehicules: Number(l.vehicules) })),
  affectations: f.affectations.map((a: any) => ({ numero: a.numero, chauffeurId: a.chauffeur_id, chauffeur: a.chauffeur, role: a.role, debut: a.debut, fin: a.fin, motif: a.motif })),
  releves: f.releves.map((r: any) => ({ numero: r.numero, date: r.date, km: r.km, origine: r.origine, motifRejet: r.motif_rejet })),
  pleins: f.pleins.map((p: any) => ({ numero: p.numero, date: p.date, litres: Number(p.litres), prixLitre: p.prix_litre, montant: p.montant, km: p.km, source: p.prestataire ?? p.source, reference: p.reference })),
  depenses: f.depenses.map((d: any) => ({ numero: d.numero, date: d.date, poste: d.poste, libelle: d.libelle, montant: d.montant, beneficiaire: d.beneficiaire, reference: d.reference, origine: d.origine, justificatif: d.justificatif, km: d.km, kmMotifRejet: d.km_motif_rejet })),
  interventions: f.interventions.map((i: any) => ({ numero: i.numero, date: i.date, type: i.type, objet: i.objet, garage: i.garage, montant: i.montant, immobilisationJours: i.immobilisation_jours, km: i.km, reference: i.reference })),
  statuts: f.statuts,
});
let n = 0;
let legers = 0;
const rendues = new Set<string>();
let echecs = 0;
for (const brut of parc.vehicules) {
  let etape = "ligne";
  try {
    const ligne = ligneDepuisLaBase(brut, parc, PARAMETRES_DEFAUT);
    /* Tous les véhicules, sans exception : les légers en étaient exclus, et c'est ainsi qu'AA 019 EA n'avait pas de fiche complète. */
    const leger = Boolean(ligne.vehicule.regime && ligne.vehicule.regime !== "exploitation");
    etape = "lire_fiche";
    const f = (await pg.query(`select lire_fiche($1) as j`, [brut.immatriculation])).rows[0].j;
    etape = "assembler";
    const v = ligne.vehicule;
    const fiche = assemblerFiche(ligne, f ? versFaits(f) : FAITS_VIDES, PARAMETRES_DEFAUT, aujourdhui, { programme: programmeParDefaut(v.categorie), plan: planDuVehicule(v.id, v.categorie), passages: passagesReleves });
    etape = "pieces";
    if (leger && (fiche.documents.some((d) => d.etat === "manquant") || fiche.immobilisationAdministrative)) throw new Error("un véhicule de service ou de fonction se voit reprocher des pièces que le parc ne tient pas");
    etape = "serialiser";
    JSON.stringify(fiche);
    etape = "rendre";
    const html = renderToString(
      React.createElement(FournisseurEdition, { sujet: `vehicule:${v.immatriculation}`, href: `/flotte/${v.immatriculation}` } as any,
        React.createElement(FicheVehicule, { fiche, ongletInitial: undefined, discussionInitiale: false, cible: undefined } as any)),
    );
    if (html.length < 1000) throw new Error(`rendu trop court (${html.length})`);
    n++;
    if (leger) legers++;
    rendues.add(v.immatriculation);
  } catch (e) {
    echecs++;
    console.log(`ÉCHEC ${brut.immatriculation} à l'étape ${etape} : ${(e as Error).stack?.split("\n").slice(0, 4).join(" | ")}`);
  }
}
/* Les véhicules à recevoir ouvrent eux aussi la fiche complète, sans historique : c'est la seule fiche de l'application. */
let aRecevoir = 0;
for (const ligne of lignesARecevoir(parc)) {
  try {
    const v = ligne.vehicule;
    const fiche = assemblerFiche(ligne, FAITS_VIDES, PARAMETRES_DEFAUT, aujourdhui, { programme: programmeParDefaut(v.categorie), plan: planDuVehicule(v.id, v.categorie), passages: passagesReleves });
    if (fiche.documents.some((d) => d.etat === "manquant") || fiche.immobilisationAdministrative) throw new Error("un véhicule à recevoir se voit reprocher des pièces");
    const html = renderToString(
      React.createElement(FournisseurEdition, { sujet: `vehicule:${v.immatriculation}`, href: `/flotte/${v.id}` } as any,
        React.createElement(FicheVehicule, { fiche, ongletInitial: undefined, discussionInitiale: false, cible: undefined } as any)),
    );
    if (html.length < 1000) throw new Error(`rendu trop court (${html.length})`);
    n++;
    aRecevoir++;
  } catch (e) {
    echecs++;
    console.log(`ÉCHEC ${ligne.vehicule.immatriculationAffichee} (à recevoir) : ${(e as Error).message}`);
  }
}
console.log(`${aRecevoir} véhicules à recevoir rendus en fiche complète`);
if (!rendues.has("AA019EA")) {
  echecs++;
  console.log("ÉCHEC AA 019 EA n'a pas sa fiche complète");
}
console.log(`${n} fiches rendues, dont ${legers} de service ou de fonction${echecs ? `, ${echecs} échec(s)` : ", tout passe"}`);
process.exit(echecs ? 1 : 0);
