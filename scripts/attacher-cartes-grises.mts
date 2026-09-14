/* ============================================================================
 * Attache à chaque véhicule la carte grise de son dossier.
 *
 * Les cartes grises sont dans `MALICK/CARTE GRISE VEHICULES` — 90 PDF et
 * 12 .docx, tous des scans. Elles ont été lues le 14 septembre 2026 pour en
 * tirer les caractéristiques (`charger-cartes-grises.mts`) ; ce script-ci fait
 * l'autre moitié du travail : le **document lui-même** entre dans la fiche,
 * consultable d'un clic depuis l'onglet Conformité.
 *
 * POURQUOI RECOMPOSER PLUTÔT QUE DÉPOSER L'ORIGINAL. Un véhicule a souvent
 * deux fichiers — recto et verso, ou deux photos de la même carte — et la
 * fiche n'a qu'une pièce jointe par document. On remonte donc les pages en un
 * seul PDF, dans l'ordre. Les .docx, qui ne portent que des images, se
 * traitent pareil : sans quoi douze véhicules resteraient sans pièce.
 *
 * Le réemballage allège au passage — l'enveloppe d'origine, ses polices, ses
 * miniatures s'en vont — mais il ne **recompresse pas** : un scan de 7 Mo reste
 * un scan de 7 Mo. Ceux qui dépassent le plafond du seau sont nommés au compte
 * rendu plutôt que tronqués ou déposés de force.
 *
 * CE QU'IL FAUT POUR L'EXÉCUTER. Deux variables d'environnement, jamais
 * écrites ici ni demandées ailleurs :
 *
 *   SUPABASE_URL                 l'adresse du projet
 *   SUPABASE_SERVICE_ROLE_KEY    la clé de service
 *
 * La clé de service passe outre les politiques : elle n'a rien à faire dans un
 * navigateur, et ce script est la seule raison de la sortir.
 *
 * IL NE DÉPOSE RIEN SANS QU'ON LE LUI DEMANDE. Sans `--deposer`, il dit ce
 * qu'il ferait et s'arrête — c'est la forme sous laquelle on le relit avant de
 * toucher à la base d'un parc de 184 véhicules.
 *
 * REJOUABLE : un véhicule qui porte déjà une carte grise avec sa pièce est
 * sauté. Un véhicule qui en porte une **sans** pièce se voit compléter plutôt
 * que doubler — c'est le cas des cartes grises du jeu de départ.
 *
 * Lancer :
 *   npx tsx scripts/attacher-cartes-grises.mts              (essai à blanc)
 *   npx tsx scripts/attacher-cartes-grises.mts --deposer    (dépôt réel)
 * ==========================================================================*/

import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cartesDuDossier, composer, pages, DOSSIER, PLAFOND } from "./scans-cartes-grises.mts";

const DEPOSER = process.argv.includes("--deposer");

/* -- La base ---------------------------------------------------------------- */

function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) {
    console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont attendues dans l'environnement.");
    console.error("Sans elles, le script ne peut ni lire le référentiel ni déposer un fichier.");
    process.exit(2);
  }
  return createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function numeroSuivant(pg: SupabaseClient, annee: string): Promise<number> {
  const r = await pg.from("document").select("numero").like("numero", `DOC-${annee}-%`).order("numero", { ascending: false }).limit(1).maybeSingle<{ numero: string }>();
  return r.data ? (Number(r.data.numero.slice(`DOC-${annee}-`.length)) || 0) + 1 : 1;
}

/* -- Le travail ------------------------------------------------------------- */

const cartes = cartesDuDossier();
console.log(`${cartes.length} cartes grises au dossier${DEPOSER ? "" : " — essai à blanc, rien ne sera déposé"}\n`);

const pg = client();
const annee = new Date().toISOString().slice(0, 4);
const jour = new Date().toISOString().slice(0, 10);
let suivant = DEPOSER ? await numeroSuivant(pg, annee) : 1;

const bilan = { deposees: 0, completees: 0, deja: 0, horsParc: [] as string[], vides: [] as string[], tropLourds: [] as string[], illisibles: [] as string[], refus: [] as string[] };

for (const c of cartes) {
  const v = await pg.from("vehicule").select("id, immatriculation, date_immatriculation").eq("immatriculation", c.plaque).maybeSingle<{ id: string; immatriculation: string; date_immatriculation: string | null }>();
  if (!v.data) {
    bilan.horsParc.push(c.ecrite);
    continue;
  }
  /* Déjà attachée ? On ne double pas ; on complète une ligne restée sans pièce. */
  const existant = await pg.from("document").select("numero, fichier").eq("vehicule_id", v.data.id).eq("type_document_id", "carte-grise").order("fichier", { nullsFirst: false }).limit(1).maybeSingle<{ numero: string; fichier: string | null }>();
  if (existant.data?.fichier) {
    bilan.deja++;
    continue;
  }

  const images = (await Promise.all(c.fichiers.map((f) => pages(join(DOSSIER, f))))).flat();
  if (images.length === 0) {
    bilan.vides.push(`${c.ecrite} (${c.fichiers.join(", ")})`);
    continue;
  }
  const { pdf, posees, ecartees } = await composer(images, `Carte grise ${c.ecrite}`);
  if (ecartees > 0) bilan.illisibles.push(`${c.ecrite} : ${ecartees} page(s) illisible(s) sur ${images.length}`);
  if (posees === 0) {
    bilan.vides.push(`${c.ecrite} (${c.fichiers.join(", ")})`);
    continue;
  }
  const chemin = `documents/${annee}/${jour.slice(5, 7)}/${jour}-${c.plaque}-carte-grise.pdf`;
  const poids = `${Math.round(pdf.byteLength / 1024)} Ko`;
  /* Réemballer ne compresse pas : un scan trop lourd le reste. Plutôt que de
     le tronquer ou de relever le plafond du seau pour un seul fichier, on le
     nomme — il se dépose à la main après avoir été allégé. */
  if (pdf.byteLength > PLAFOND) {
    bilan.tropLourds.push(`${c.ecrite} : ${poids}, au-delà des 5 Mo du seau (${c.fichiers.join(", ")})`);
    continue;
  }

  if (!DEPOSER) {
    console.log(`  ${c.ecrite.padEnd(12)} ${String(posees)} page(s), ${poids.padStart(7)} → ${existant.data ? `complète ${existant.data.numero}` : "nouveau document"}`);
    existant.data ? bilan.completees++ : bilan.deposees++;
    continue;
  }

  const depot = await pg.storage.from("pieces").upload(chemin, pdf, { contentType: "application/pdf", upsert: true });
  if (depot.error) {
    bilan.refus.push(`${c.ecrite} : dépôt refusé — ${depot.error.message}`);
    continue;
  }
  const fichier = `pieces/${chemin}`;

  if (existant.data) {
    const maj = await pg.from("document").update({ fichier, justificatif: true, modifie_le: new Date().toISOString() }).eq("numero", existant.data.numero);
    if (maj.error) bilan.refus.push(`${c.ecrite} : ${existant.data.numero} non complété — ${maj.error.message}`);
    else {
      bilan.completees++;
      console.log(`  ${c.ecrite.padEnd(12)} ${poids.padStart(7)} → ${existant.data.numero} complété`);
    }
    continue;
  }

  const numero = `DOC-${annee}-${String(suivant++).padStart(5, "0")}`;
  const insertion = await pg.from("document").insert({
    numero,
    type_document_id: "carte-grise",
    vehicule_id: v.data.id,
    /* La carte grise prend effet à l'immatriculation du véhicule ; elle n'a pas
       d'échéance — c'est un document permanent. */
    date_effet: v.data.date_immatriculation,
    emetteur: "Guichet unique des véhicules",
    fichier,
    justificatif: true,
  });
  if (insertion.error) bilan.refus.push(`${c.ecrite} : document non créé — ${insertion.error.message}`);
  else {
    bilan.deposees++;
    console.log(`  ${c.ecrite.padEnd(12)} ${poids.padStart(7)} → ${numero}`);
  }
}

console.log(`\n${bilan.deposees} document(s) ${DEPOSER ? "créé(s)" : "à créer"}, ${bilan.completees} ${DEPOSER ? "complété(s)" : "à compléter"}, ${bilan.deja} déjà attachée(s)`);
if (bilan.horsParc.length) console.log(`\n${bilan.horsParc.length} plaque(s) hors référentiel : ${bilan.horsParc.join(", ")}`);
if (bilan.vides.length) console.log(`\n${bilan.vides.length} fichier(s) sans page lisible :\n  ${bilan.vides.join("\n  ")}`);
/* Un véhicule écarté pour le poids de son scan doit être nommé : sans ça il
   sort du compte rendu sans un mot et personne ne va le chercher. */
if (bilan.tropLourds.length) console.log(`\n${bilan.tropLourds.length} scan(s) trop lourd(s), à alléger puis déposer à la main :\n  ${bilan.tropLourds.join("\n  ")}`);
if (bilan.illisibles.length) console.log(`\n${bilan.illisibles.length} document(s) partiellement lisible(s) — le reste est bien posé :\n  ${bilan.illisibles.join("\n  ")}`);
if (bilan.refus.length) console.log(`\n${bilan.refus.length} refus :\n  ${bilan.refus.join("\n  ")}`);
if (!DEPOSER) console.log("\nRien n'a été déposé. Relancer avec --deposer pour écrire.");
