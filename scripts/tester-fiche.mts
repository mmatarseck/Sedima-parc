/* Vérifie lire_fiche() (0013) dans PGlite avec le seed, puis l'assembleur du
 * domaine sur ce qu'elle rend : une fiche complète pour AA 032 EA.
 * Lancer : PGLITE_DIR=<dossier avec @electric-sql/pglite> npx tsx scripts/tester-fiche.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { assemblerFiche, type FaitsFiche } from "../src/domaine/assembler-fiche";
import { PARAMETRES_DEFAUT } from "../src/domaine/parametres";
import { passagesReleves, planDuVehicule, programmeParDefaut } from "../src/donnees/entretien-demo";
import { FLOTTE } from "../src/donnees/parc-demo";

const bac = process.env.PGLITE_DIR ?? "";
const require = createRequire(join(bac, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");

const projet = process.cwd();
const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
  insert into auth.users values ('00000000-0000-0000-0000-000000000001');
  create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;`);
for (const m of readdirSync(join(projet, "supabase/migrations")).sort()) await pg.exec(readFileSync(join(projet, "supabase/migrations", m), "utf8"));
for (const p of readdirSync(join(projet, "supabase/seed-parties")).filter((f) => f.endsWith(".sql")).sort()) {
  const texte = readFileSync(join(projet, "supabase/seed-parties", p), "utf8");
  let courant: string[] = [];
  for (const ligne of texte.split("\n")) {
    courant.push(ligne);
    if (/^on conflict .*;$/.test(ligne.trim())) { try { await pg.exec(courant.join("\n")); } catch {} courant = []; }
  }
}
/* Une trace de statut, comme l'application l'écrit. */
await pg.query(`insert into modification (table_cible, numero, champ, libelle_champ, avant, apres, motif, cree_le, cree_par) values ('vehicule', 'AA032EA', 'statut', 'Statut', 'en-service', 'en-reparation', 'Panne — embrayage', '2026-08-20T09:00:00Z', '00000000-0000-0000-0000-000000000001'), ('vehicule', 'AA032EA', 'statut', 'Statut', 'en-reparation', 'en-service', 'Retour d''atelier', '2026-08-23T16:00:00Z', '00000000-0000-0000-0000-000000000001')`);

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => { console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`); if (!ok) echecs++; };

const t0 = performance.now();
const j = (await pg.query(`select lire_fiche($1) as j`, ["aa-032-ea"])).rows[0] as { j: Record<string, unknown[]> & { vehicule: { immatriculation: string } } };
console.log(`lire_fiche en ${Math.round(performance.now() - t0)} ms`);
attendu(`la fiche est trouvée sous n'importe quelle écriture (${j.j.vehicule.immatriculation})`, j.j.vehicule.immatriculation === "AA032EA");
for (const cle of ["documents", "affectations", "releves", "pleins", "depenses", "interventions", "statuts"] as const) attendu(`${cle} : ${(j.j[cle] as unknown[]).length}`, (j.j[cle] as unknown[]).length > 0);
attendu(`inconnu → null`, (await pg.query(`select lire_fiche('ZZ999ZZ') as j`)).rows[0].j === null);

const x = j.j as unknown as { documents: { numero: string; type_document_id: string; date_effet: string | null; echeance: string | null; emetteur: string | null; numero_piece: string | null; montant: number | null; justificatif: boolean }[]; licences: FaitsFiche["licences"] extends (infer L)[] ? { numero: string; libelle: string; numero_piece: string; emetteur: string; perimetre: "flotte" | "partie"; date_effet: string; echeance: string; vehicules: number }[] : never; affectations: { numero: string; chauffeur_id: string | null; chauffeur: string; role: "titulaire" | "suppleant"; debut: string; fin: string | null; motif: string }[]; releves: { numero: string; date: string; km: number; origine: string; motif_rejet: string | null }[]; pleins: { numero: string; date: string; litres: string; prix_litre: number; montant: number; km: number | null; source: string; reference: string | null }[]; depenses: FaitsFiche["depenses"] extends (infer D)[] ? (Omit<D, "kmMotifRejet"> & { km_motif_rejet: string | null })[] : never; interventions: { numero: string; date: string; type: "preventif" | "curatif"; objet: string; garage: string | null; montant: number; immobilisation_jours: number; km: number | null; reference: string | null }[]; statuts: FaitsFiche["statuts"] };
const faits: FaitsFiche = {
  documents: x.documents.map((d) => ({ numero: d.numero, type: d.type_document_id as FaitsFiche["documents"][number]["type"], dateEffet: d.date_effet, echeance: d.echeance, emetteur: d.emetteur, numeroPiece: d.numero_piece, montant: d.montant, justificatif: d.justificatif })),
  licences: x.licences.map((l) => ({ numero: l.numero, libelle: l.libelle, numeroPiece: l.numero_piece, emetteur: l.emetteur, perimetre: l.perimetre, dateEffet: l.date_effet, echeance: l.echeance, vehicules: Number(l.vehicules) })),
  affectations: x.affectations.map((a) => ({ numero: a.numero, chauffeurId: a.chauffeur_id, chauffeur: a.chauffeur, role: a.role, debut: a.debut, fin: a.fin, motif: a.motif })),
  releves: x.releves.map((r) => ({ numero: r.numero, date: r.date, km: r.km, origine: r.origine, motifRejet: r.motif_rejet })),
  pleins: x.pleins.map((p) => ({ numero: p.numero, date: p.date, litres: Number(p.litres), prixLitre: p.prix_litre, montant: p.montant, km: p.km, source: p.source, reference: p.reference })),
  depenses: x.depenses.map((d) => ({ ...d, kmMotifRejet: d.km_motif_rejet })),
  interventions: x.interventions.map((i) => ({ numero: i.numero, date: i.date, type: i.type, objet: i.objet, garage: i.garage, montant: i.montant, immobilisationJours: i.immobilisation_jours, km: i.km, reference: i.reference })),
  statuts: x.statuts,
};
const ligne = FLOTTE.find((l) => l.vehicule.immatriculation === "AA032EA")!;
const v = ligne.vehicule;
const fiche = assemblerFiche(ligne, faits, PARAMETRES_DEFAUT, "2026-09-02", { programme: programmeParDefaut(v.categorie), plan: planDuVehicule(v.id, v.categorie), passages: passagesReleves });
attendu(`compteur ${fiche.indicateurs.kilometrage} km, ${fiche.indicateurs.kmParMois} km/mois, ${fiche.indicateurs.consommationL100} L/100, ${fiche.indicateurs.coutDouzeMois} F sur 12 mois, ${fiche.indicateurs.coutParKm} F/km, dispo ${fiche.indicateurs.disponibilitePct} %`, fiche.indicateurs.kilometrage !== null && (fiche.indicateurs.coutDouzeMois ?? 0) > 0 && fiche.indicateurs.disponibilitePct !== null);
attendu(`${fiche.documents.length} documents, états : ${[...new Set(fiche.documents.map((d) => d.etat))].join(", ")}`, fiche.documents.length >= 3);
attendu(`immobilisation administrative : ${fiche.immobilisationAdministrative ? fiche.immobilisationAdministrative.documents.map((d) => `${d.type} ${d.etat}`).join(", ") : "aucune"}`, true);
attendu(`${fiche.carburant.length} mois de carburant, ${fiche.pleins.length} pleins, ${fiche.depenses.length} dépenses (${fiche.coutsParPoste.length} postes)`, fiche.carburant.length > 0 && fiche.coutsParPoste.length > 0);
attendu(`${fiche.releves.length} relevés, ${fiche.releves.filter((r) => !r.valide).length} rejetés par le contrôle`, fiche.releves.length > 0);
attendu(`plan d'entretien : ${fiche.planEntretien.echeances.length} opérations, prochaine « ${fiche.prochaineIntervention?.libelle ?? "—"} »`, fiche.planEntretien.echeances.length > 0);
attendu(`périodes de statut : ${fiche.periodesStatut.map((p) => `${p.statut} ${p.debut}→${p.fin ?? "…"}`).slice(0, 3).join(" ; ")}`, fiche.periodesStatut.some((p) => p.statut === "en-reparation" && p.debut === "2026-08-20" && p.fin === "2026-08-23"));
attendu(`${fiche.affectations.length} affectations, titulaire ${fiche.affectations.find((a) => a.role === "titulaire")?.chauffeur ?? "—"}`, fiche.affectations.length > 0);
attendu(`journal : ${fiche.journal.length} lignes, échéances : ${fiche.echeances.length}`, fiche.journal.length > 0 && fiche.echeances.length > 0);

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);
