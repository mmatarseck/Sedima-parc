/* Le module Transporteurs depuis la base, dans PGlite avec le seed :
 * lire_transporteurs() puis l'assemblage du domaine — la liste et la fiche,
 * comparées à ce que la démonstration dresse sur le même jeu ; puis les
 * écritures du transport tiers (ligne de relevé, ligne de grille, affrètement,
 * mise à disposition, prestation) et leurs refus.
 * Lancer : PGLITE_DIR=<dossier PGlite> npx tsx scripts/tester-transporteurs.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ficheTransporteurDe, listeTransporteursDe } from "../src/domaine/assembler-transporteurs";
import { ficheTransporteur, listeTransporteurs } from "../src/donnees/fiche-transporteur-demo";
import { DATE_REFERENCE } from "../src/donnees/chauffeurs-demo";
import { depuisPour, sourceDepuisJson, type TransporteursJson } from "../src/donnees/transporteurs";
import { colonnesModification, decomposerSujet, ligneCreation, produitDepuis, tableDe } from "../src/lib/transactions-colonnes";

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
  for (const ligne of texte.split("\n")) { courant.push(ligne); if (/^on conflict .*;$/.test(ligne.trim())) { try { await pg.exec(courant.join("\n")); } catch {} courant = []; } }
}
let echecs = 0;
const attendu = (libelle: string, ok: boolean) => { console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`); if (!ok) echecs++; };
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

/* ---- 1. La lecture ---- */
const aujourdhui = DATE_REFERENCE;
const t0 = performance.now();
const j = (await pg.query(`select lire_transporteurs($1) as j`, [depuisPour(aujourdhui)])).rows[0].j as TransporteursJson;
const tLecture = Math.round(performance.now() - t0);
console.log(`lire_transporteurs en ${tLecture} ms : ${j.transporteurs.length} transporteurs, ${j.camions_tiers.length} camions, ${j.chauffeurs_tiers.length} chauffeurs, ${j.lignes_tarif.length} lignes de grille, ${j.rattachements.length} rattachements, ${j.affretements.length} affrètements, ${j.mises_a_disposition.length} mises à disposition, ${j.prestations.length} prestations, ${j.releves_transport.length} lignes de relevé tiers, ${j.jours_releves.length} jours relevés`);

const t1 = performance.now();
const source = sourceDepuisJson(j, aujourdhui);
const liste = listeTransporteursDe(source);
const tAssemblage = Math.round(performance.now() - t1);
console.log(`liste assemblée en ${tAssemblage} ms : ${liste.length} lignes, ${source.semainesPeriode} semaines relevées`);

const demo = listeTransporteurs();
attendu(`autant de transporteurs qu'en démonstration (${liste.length} / ${demo.length})`, liste.length === demo.length && liste.length > 10);
attendu(`la période couvre autant de semaines (${source.semainesPeriode} / ${demo.length ? ficheTransporteur(demo[0]!.prestataire.numero)?.notation.dimensions.find((d) => d.cle === "regularite")?.constat : ""})`, source.semainesPeriode >= 50);

/* La même liste, ligne à ligne : missions, tonnes, coût, restant dû, notation. */
let ecartsCout = 0;
for (const d of demo) {
  const b = liste.find((l) => l.prestataire.numero === d.prestataire.numero);
  if (!b) { attendu(`${d.prestataire.raisonSociale} manque en base`, false); continue; }
  const memes = b.activite.missions === d.activite.missions && Math.abs(b.activite.tonnes - d.activite.tonnes) < 1 && b.camions === d.camions && b.chauffeurs === d.chauffeurs;
  const cout = Math.abs(b.activite.cout - d.activite.cout);
  if (cout > 1) ecartsCout++;
  const note = b.notation.score === d.notation.score && b.notation.niveau === d.notation.niveau;
  attendu(
    `${d.prestataire.raisonSociale} : ${b.activite.missions} missions, ${fmt(Math.round(b.activite.tonnes))} t, ${fmt(b.activite.cout)} F (démo ${fmt(d.activite.cout)}), restant dû ${fmt(b.activite.restantDu)}, note ${b.notation.niveau ?? "—"} ${b.notation.score ?? ""} (démo ${d.notation.niveau ?? "—"} ${d.notation.score ?? ""})`,
    memes && cout <= 1 && note && b.activite.restantDu === d.activite.restantDu,
  );
}
attendu(`aucun écart de coût entre la base et la démonstration (${ecartsCout})`, ecartsCout === 0);
attendu(`la liste est triée du plus coûteux au moins coûteux`, liste.every((l, i) => i === 0 || liste[i - 1]!.activite.cout >= l.activite.cout));

/* ---- 2. La fiche ---- */
const adex = liste.find((l) => l.prestataire.raisonSociale === "ADEX Express")!;
const fiche = ficheTransporteurDe(source, adex.prestataire.numero)!;
const ficheDemo = ficheTransporteur(adex.prestataire.numero)!;
attendu(`la fiche ADEX porte ${fiche.camions.length} camions (démo ${ficheDemo.camions.length}), ${fiche.chauffeurs.length} chauffeurs, ${fiche.misesADisposition.length} mises à disposition (démo ${ficheDemo.misesADisposition.length}), ${fiche.livraisons.length} livraisons (démo ${ficheDemo.livraisons.length})`,
  fiche.camions.length === ficheDemo.camions.length && fiche.chauffeurs.length === ficheDemo.chauffeurs.length && fiche.misesADisposition.length === ficheDemo.misesADisposition.length && fiche.livraisons.length === ficheDemo.livraisons.length);
attendu(`les plaques se lisent au format du parc (${fiche.camions[0]?.immatriculationAffichee}, mise à disposition ${fiche.misesADisposition[0]?.immatriculation})`, /^[A-Z]{2} \d{3} [A-Z]{2}$/.test(fiche.camions[0]?.immatriculationAffichee ?? "") && /^[A-Z]{2} \d{3} [A-Z]{2}$/.test(fiche.misesADisposition[0]?.immatriculation ?? ""));
attendu(`le profil ADEX vient de la table (sous contrat, ${fiche.profil.modes.join("/")}, ${fiche.profil.camionsEngages} camions engagés)`, fiche.profil.sousContrat && fiche.profil.modes.includes("journee") && fiche.profil.camionsEngages === 7);
attendu(`le chauffeur habituel d'un camion est un chauffeur de la fiche`, fiche.camions.every((c) => c.chauffeurHabituelId === null || fiche.chauffeurs.some((x) => x.id === c.chauffeurHabituelId)));
const kane = liste.find((l) => l.prestataire.raisonSociale === "Abdou Kane")!;
const ficheKane = ficheTransporteurDe(source, kane.prestataire.numero)!;
const ficheKaneDemo = ficheTransporteur(kane.prestataire.numero)!;
attendu(`la fiche Abdou Kane porte ${ficheKane.grille.length} lignes de grille (démo ${ficheKaneDemo.grille.length}), ${ficheKane.affretements.length} affrètements (démo ${ficheKaneDemo.affretements.length}), attendus égaux`,
  ficheKane.grille.length === ficheKaneDemo.grille.length && ficheKane.affretements.length === ficheKaneDemo.affretements.length && ficheKane.affretements.every((a) => a.attendu === ficheKaneDemo.affretements.find((x) => x.numero === a.numero)?.attendu));
const exception = source.affretements.find((a) => a.prixExceptionnel !== null || a.complementTarif !== null);
attendu(`les exceptions tarifaires sont lues avec leur motif (${exception?.numero} : ${exception?.motifTarif})`, exception !== undefined && exception.motifTarif !== null);
const livree = ficheKane.livraisons.find((l) => l.affretementNumero !== null);
attendu(`une livraison cite son affrètement (${livree?.numero} → ${livree?.affretementNumero}) et sa destination tarifaire`, livree !== undefined && livree.destinationTarifaire !== null);
attendu(`la fiche d'un numéro inconnu est nulle`, ficheTransporteurDe(source, "PRE-2026-99999") === null);

/* ---- 3. Les écritures ---- */
const utilisateur = "00000000-0000-0000-0000-000000000001";
async function inserer(table: string, ligne: Record<string, unknown>) {
  const cles = Object.keys(ligne);
  await pg.query(`insert into ${table} (${cles.join(", ")}, cree_par) values (${cles.map((_, i) => `$${i + 1}`).join(", ")}, $${cles.length + 1})`, [...cles.map((k) => ligne[k]), utilisateur]);
}
const pKane = (await pg.query(`select id from prestataire where raison_sociale = 'Abdou Kane'`)).rows[0] as { id: string };
const pAdex = (await pg.query(`select id from prestataire where raison_sociale = 'ADEX Express'`)).rows[0] as { id: string };
const camionKane = (await pg.query(`select immatriculation from camion_tiers where prestataire_id = $1 order by immatriculation limit 1`, [pKane.id])).rows[0] as { immatriculation: string };
const camionAdex = (await pg.query(`select immatriculation from camion_tiers where prestataire_id = $1 order by immatriculation limit 1`, [pAdex.id])).rows[0] as { immatriculation: string };
const affKane = (await pg.query(`select id, numero from affretement where prestataire_id = $1 order by date desc limit 1`, [pKane.id])).rows[0] as { id: string; numero: string };
const sujet = decomposerSujet(`transporteur:${kane.prestataire.numero}`);
attendu(`le sujet d'une fiche transporteur se décompose en prestataire (${sujet.genre}, ${sujet.cle})`, sujet.genre === "prestataire" && sujet.cle === kane.prestataire.numero);
attendu(`« Aliment volaille » se lit comme le produit aliment, « Son de blé » comme son-de-ble, l'inconnu comme aliment`, produitDepuis("Aliment volaille") === "aliment" && produitDepuis("Son de blé") === "son-de-ble" && produitDepuis("oeufs") === "oeufs" && produitDepuis("n'importe quoi") === "aliment");

const rKane = { vehiculeId: null, chauffeurId: null, prestataireId: pKane.id, camionTiers: camionKane.immatriculation, affretementId: affKane.id };
const essais: { type: Parameters<typeof ligneCreation>[0]; numero: string; valeurs: Record<string, unknown>; r: typeof rKane }[] = [
  { type: "transport", numero: "TRP-2026-90001", valeurs: { date: "2026-09-08", destination: "BAYAKH", produit: "Aliment volaille", tonnage: "31,5", tonnagePese: 31.2, bonLivraison: "BL-202609-901", chauffeur: "Serigne Diop", camion: "AA 490 KS", affretementNumero: affKane.numero }, r: rKane },
  { type: "tarif", numero: "TAR-2026-90001", valeurs: { transporteurNumero: kane.prestataire.numero, origine: "UAB", destination: "Malicounda", unite: "tonne", prix: "4 200", debut: "2026-09-08", source: "accord-verbal", commentaire: `Promotion de l'exception posée sur ${affKane.numero}` }, r: rKane },
  { type: "affretement", numero: "AFF-2026-90001", valeurs: { date: "2026-09-08", origine: "UAB", destination: "Thiès", tonnagePrevu: 30, motif: "pointe", montantConvenu: 105000, demandeur: "M. Seck", categorieDemandee: "camion", businessUnit: "aliment", complementTarif: 25000, motifTarif: "Attente de six heures au déchargement" }, r: rKane },
  { type: "mise-a-disposition", numero: "MAD-2026-90001", valeurs: { mois: "2026-10", famille: "aliments", joursCalendaires: 31, joursPanne: 2, prixJour: 130000, convention: "inconnue", carburantLitres: "1 240,5", carburantMontant: 812000, tonnesTransportees: 512 }, r: { ...rKane, prestataireId: pAdex.id, camionTiers: camionAdex.immatriculation, affretementId: null } },
  { type: "prestation", numero: "PRS-2026-90001", valeurs: { date: "2026-09-08", libelle: "Livraison d'œufs — Dakar", unite: "voyage", quantite: 30, prixUnitaire: 42000, convention: "brut-retenu", businessUnit: "abattoir" }, r: rKane },
];
for (const e of essais) {
  const table = tableDe(e.type)!;
  const prep = ligneCreation(e.type, e.numero, e.valeurs, e.r);
  if ("refus" in prep) { attendu(`${e.type} : ${prep.refus}`, false); continue; }
  try {
    await inserer(table, prep.ligne);
    const n = (await pg.query(`select count(*)::int as n from ${table} where numero = $1`, [e.numero])).rows[0] as { n: number };
    attendu(`${e.type} → ${table} (${e.numero})`, n.n === 1);
  } catch (x) {
    attendu(`${e.type} → ${table} : ${(x as Error).message}`, false);
  }
}
const trp = (await pg.query(`select mode, prestataire_id, camion_tiers_immatriculation, immatriculation_libre, produit, tonnage, tonnage_pese, affretement_id from releve_transport where numero = 'TRP-2026-90001'`)).rows[0] as Record<string, unknown>;
attendu(`la livraison est au mode transporteur, sur le camion ${trp?.camion_tiers_immatriculation} du référentiel, ${trp?.tonnage} t annoncées, ${trp?.tonnage_pese} t pesées, produit ${trp?.produit}, affrètement cité`,
  trp?.mode === "transporteur" && trp?.prestataire_id === pKane.id && trp?.camion_tiers_immatriculation === camionKane.immatriculation && trp?.immatriculation_libre === null && Number(trp?.tonnage) === 31.5 && trp?.produit === "aliment" && trp?.affretement_id === affKane.id);
const libre = ligneCreation("transport", "TRP-2026-90002", { date: "2026-09-08", destination: "POUT", tonnage: 12, camion: "DK 4512 AB" }, { ...rKane, camionTiers: null, affretementId: null });
attendu(`une plaque hors référentiel reste libre (${"ligne" in libre ? String(libre.ligne.immatriculation_libre) : libre.refus})`, "ligne" in libre && libre.ligne.immatriculation_libre === "DK 4512 AB" && libre.ligne.camion_tiers_immatriculation === null);
const tar = (await pg.query(`select prestataire_id, unite, prix, source, categorie from ligne_tarif where numero = 'TAR-2026-90001'`)).rows[0] as Record<string, unknown>;
attendu(`la ligne de grille est posée à ${tar?.prix} F/t, ${tar?.source}, toutes catégories`, tar?.prestataire_id === pKane.id && tar?.unite === "tonne" && Number(tar?.prix) === 4200 && tar?.categorie === null);
const aff = (await pg.query(`select statut, demandeur, complement_tarif, motif_tarif, immatriculation_externe, montant_convenu from affretement where numero = 'AFF-2026-90001'`)).rows[0] as Record<string, unknown>;
attendu(`l'affrètement est demandé par ${aff?.demandeur}, avec son complément de ${aff?.complement_tarif} F motivé, sur le camion ${aff?.immatriculation_externe}`, aff?.statut === "demande" && Number(aff?.complement_tarif) === 25000 && aff?.motif_tarif !== null && aff?.immatriculation_externe === camionKane.immatriculation && Number(aff?.montant_convenu) === 105000);
const mad = (await pg.query(`select immatriculation, jours_calendaires, jours_panne, carburant_litres, statut from mise_a_disposition where numero = 'MAD-2026-90001'`)).rows[0] as Record<string, unknown>;
attendu(`la mise à disposition porte le camion ${mad?.immatriculation}, ${mad?.jours_calendaires} jours dont ${mad?.jours_panne} de panne, ${mad?.carburant_litres} l servis`, mad?.immatriculation === camionAdex.immatriculation && Number(mad?.jours_calendaires) === 31 && Number(mad?.carburant_litres) === 1240.5 && mad?.statut === "confirme");
const prs = (await pg.query(`select quantite, prix_unitaire, convention, statut from prestation where numero = 'PRS-2026-90001'`)).rows[0] as Record<string, unknown>;
attendu(`la prestation vaut ${prs?.quantite} × ${prs?.prix_unitaire} F, ${prs?.convention}`, Number(prs?.quantite) === 30 && Number(prs?.prix_unitaire) === 42000 && prs?.convention === "brut-retenu");

/* Les refus : ce que la base refuserait, dit avant elle. */
const sansTonnage = ligneCreation("transport", "TRP-2026-90003", { date: "2026-09-08", destination: "POUT" }, rKane);
attendu(`une livraison sans tonnage est refusée (${"refus" in sansTonnage ? sansTonnage.refus : "acceptée"})`, "refus" in sansTonnage);
const sansTransporteur = ligneCreation("transport", "TRP-2026-90004", { date: "2026-09-08", destination: "POUT", tonnage: 10, mode: "transporteur" }, { ...rKane, prestataireId: null });
attendu(`une livraison au mode transporteur sans transporteur est refusée (${"refus" in sansTransporteur ? sansTransporteur.refus : "acceptée"})`, "refus" in sansTransporteur);
const sansMotif = ligneCreation("affretement", "AFF-2026-90002", { date: "2026-09-08", origine: "UAB", destination: "Thiès", tonnagePrevu: 30, motif: "pointe", demandeur: "M. Seck", prixExceptionnel: 4200 }, rKane);
attendu(`une exception tarifaire sans motif est refusée (${"refus" in sansMotif ? sansMotif.refus : "acceptée"})`, "refus" in sansMotif);
const sansCamion = ligneCreation("mise-a-disposition", "MAD-2026-90002", { mois: "2026-10", famille: "aliments", joursCalendaires: 31, prixJour: 130000 }, { ...rKane, camionTiers: null });
attendu(`une mise à disposition sans camion du référentiel est refusée (${"refus" in sansCamion ? sansCamion.refus : "acceptée"})`, "refus" in sansCamion);
const sansPrix = ligneCreation("tarif", "TAR-2026-90002", { origine: "UAB", destination: "Thiès" }, rKane);
attendu(`une ligne de grille sans prix est refusée (${"refus" in sansPrix ? sansPrix.refus : "acceptée"})`, "refus" in sansPrix);

/* Une modification : le pont bascule corrige le tonnage pesé, le produit se lit par son libellé. */
const colonnes = colonnesModification("transport", [{ champ: "tonnagePese", valeur: "30,9" }, { champ: "produit", valeur: "Son de blé" }]);
await pg.query(`update releve_transport set tonnage_pese = $1, produit = $2 where numero = 'TRP-2026-90001'`, [colonnes.tonnage_pese, colonnes.produit]);
const corrige = (await pg.query(`select tonnage_pese, produit from releve_transport where numero = 'TRP-2026-90001'`)).rows[0] as { tonnage_pese: string; produit: string };
attendu(`la livraison corrigée pèse ${corrige.tonnage_pese} t de ${corrige.produit}`, Number(corrige.tonnage_pese) === 30.9 && corrige.produit === "son-de-ble");
const facture = colonnesModification("affretement", [{ champ: "statut", valeur: "facture" }, { champ: "montantFacture", valeur: "137 000" }, { champ: "dateFacture", valeur: "2026-09-20" }, { champ: "tonnageLivre", valeur: "29,5" }]);
await pg.query(`update affretement set statut = $1, montant_facture = $2, date_facture = $3, tonnage_livre = $4 where numero = 'AFF-2026-90001'`, [facture.statut, facture.montant_facture, facture.date_facture, facture.tonnage_livre]);
const affFacture = (await pg.query(`select statut, montant_facture, tonnage_livre from affretement where numero = 'AFF-2026-90001'`)).rows[0] as { statut: string; montant_facture: string; tonnage_livre: string };
attendu(`l'affrètement passe à ${affFacture.statut}, ${affFacture.montant_facture} F facturés pour ${affFacture.tonnage_livre} t`, affFacture.statut === "facture" && Number(affFacture.montant_facture) === 137000 && Number(affFacture.tonnage_livre) === 29.5);

/* ---- 4. La relecture porte les écritures ---- */
const j2 = (await pg.query(`select lire_transporteurs($1) as j`, [depuisPour(aujourdhui)])).rows[0].j as TransporteursJson;
const source2 = sourceDepuisJson(j2, aujourdhui);
const ficheKane2 = ficheTransporteurDe(source2, kane.prestataire.numero)!;
attendu(`la fiche relue porte la livraison, la ligne de grille et l'affrètement écrits (${ficheKane2.livraisons.length} livraisons, ${ficheKane2.grille.length} lignes, ${ficheKane2.affretements.length} affrètements)`,
  ficheKane2.livraisons.some((l) => l.numero === "TRP-2026-90001" && l.affretementNumero === affKane.numero) && ficheKane2.grille.some((g) => g.numero === "TAR-2026-90001") && ficheKane2.affretements.some((a) => a.numero === "AFF-2026-90001" && a.statut === "facture"));
const promue = ficheKane2.grille.find((g) => g.numero === "TAR-2026-90001");
attendu(`l'exception promue cite sa mission (${promue?.commentaire})`, (promue?.commentaire ?? "").includes(affKane.numero));

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);
