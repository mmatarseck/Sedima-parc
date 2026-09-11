/* ============================================================================
 * Fabrique `supabase/ca-location-aout-2026.sql` — le coût d'août 2026 des trois
 * transporteurs dont le CA provisoire porte le détail.
 *
 * LE MANQUE. Aucun bon de commande chargé ne concerne A. Dieng, Sokhna Diop ni
 * ADEX, qui portent l'essentiel des tonnes du relevé : leur coût était absent,
 * et le coût tiers à la tonne ressortait à 606 F/t. Voir
 * `docs/CA-LOCATION-AOUT-2026.md`.
 *
 * LES DÉCISIONS DU MÉTIER (11 septembre 2026).
 *   * **Le détail seulement** : A. Dieng et Sokhna Diop voyage par voyage, ADEX
 *     camion par camion. Les quatorze montants sans détail du récapitulatif
 *     attendent leur facture.
 *   * **Livré, à facturer** : un CA provisoire est un service rendu, pas une
 *     facture. Le montant entre en prix convenu ; la facture reste vide.
 *   * **Les quatre pesées en double** d'A. Dieng sont chargées telles quelles ;
 *     chacune le dit dans son commentaire.
 *   * **Le régime fiscal** est rendu clair par la migration 0039 : ces trois
 *     transporteurs facturent la TVA de 18 %. Les montants chargés sont hors
 *     taxe, et l'application les lit HT ou TTC.
 *
 * CE QUE LE MODÈLE IMPOSAIT DE TRANCHER.
 *   * Un voyage à la tonne est un **affrètement** : camion, destination (le
 *     client livré), poids net pesé en tonnage livré, montant hors taxe en prix
 *     convenu. La pesée complète — tare, brut, net — et le tarif sont dans le
 *     commentaire. Le motif n'est pas écrit sur la pièce : il reste nul, ce que
 *     0039 permet, plutôt qu'un motif inventé.
 *   * ADEX facture des **jours** × un prix du jour, et ces jours ne suivent pas
 *     le contrat modélisé (six jours sur sept, panne déduite) : une mise à
 *     disposition les recalculerait, ou il faudrait inventer des jours de panne
 *     pour retomber sur la somme. Chaque camion entre donc en **prestation au
 *     jour** — les jours facturés, le prix du jour, le camion dans le libellé.
 *     Les lignes à zéro franc ne sont pas chargées.
 *
 * REJOUABLE : `on conflict (numero) do nothing`. À jouer après 0039 et après
 * `releve-parties/releve-01-camions.sql`, qui ajoute DK 7179 E, TH 8174 K et
 * AA 313 CT au référentiel tiers.
 *
 * Lancer : npx tsx scripts/charger-ca-location.mts
 * ==========================================================================*/

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireCa, type VoyageFacture } from "./extraire-ca-location.mts";

const projet = process.cwd();
const echappe = (s: string) => s.replace(/'/g, "''");
const PRESTATAIRE: Record<string, string> = { "AB DIENG": "PRE-2026-00022", SOKHNA: "PRE-2026-00023", ADEX: "PRE-2026-00033" };

const ca = lireCa();

/* Les doublons, repérés comme le fait la lecture : même camion, même jour, même tare, même brut. */
const occurrences = new Map<string, number>();
for (const v of ca.voyages) {
  const k = `${v.feuille}|${v.date}|${v.plaque}|${v.tare}|${v.brut}`;
  occurrences.set(k, (occurrences.get(k) ?? 0) + 1);
}
const enDouble = (v: VoyageFacture) => (occurrences.get(`${v.feuille}|${v.date}|${v.plaque}|${v.tare}|${v.brut}`) ?? 0) > 1;

const voyages = [...ca.voyages].sort((a, b) => a.date.localeCompare(b.date) || a.feuille.localeCompare(b.feuille) || a.ligne - b.ligne);
const lignesAffretement = voyages.map((v, i) => {
  const tonnes = v.net / 1000;
  const forfait = v.montant === 40 * v.tarif && v.net !== 40_000;
  const notes = [
    `CA provisoire d'août 2026 : pesée tare ${v.tare} kg, brut ${v.brut} kg, net ${v.net} kg ; ${v.tarif} F/t hors taxe.`,
    v.produit ? `Produit : ${v.produit}.` : null,
    forfait ? "Facturé sur 40 t forfaitaires, et non sur le poids pesé." : null,
    enDouble(v) ? "Pesée identique à une autre ligne du même jour : saisie en double probable, chargée telle quelle à la demande du métier." : null,
  ].filter((x): x is string => x !== null);
  return `  ('AFF-2026-${String(90001 + i)}', '${v.date}', (select id from prestataire where numero = '${PRESTATAIRE[v.feuille]}'), 'UAB', '${echappe(v.client)}', 'aliment', 'camion', (select immatriculation from camion_tiers where immatriculation = '${v.plaque}'), ${tonnes}, ${tonnes}, null, 'livre', ${v.montant}, null, '${v.date}', 'Direction des Opérations', '${echappe(notes.join(" "))}')`;
});

const jours = ca.adex.filter((a) => a.montant > 0);
const ecartes = ca.adex.filter((a) => a.montant === 0);
const lignesPrestation = jours.map(
  (a, i) =>
    `  ('PRS-2026-${String(90001 + i)}', '2026-08-31', (select id from prestataire where numero = '${PRESTATAIRE.ADEX}'), '${echappe(`Mise à disposition ${a.plaque ?? a.libelle} — ${a.jours} jours facturés en août 2026`)}', 'aliment', 'jour', ${a.jours}, ${a.prixJour}, 'inconnue', 'livre', null, '${echappe(`CA provisoire d'août 2026 : ${a.jours} j × ${a.prixJour} F hors taxe. Les jours facturés ne suivent pas le contrat modélisé (six jours sur sept, panne déduite) : chargé au jour plutôt qu'en mise à disposition, pour ne pas inventer de jours de panne.`)}')`,
);

const somme = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const parFeuille = (nom: string) => voyages.filter((v) => v.feuille === nom);
const sortie = `-- ============================================================================
-- SEDIMA Parc — le coût d'août 2026 d'A. Dieng, Sokhna Diop et ADEX.
--
-- **Ce n'est pas une migration.** Tiré du CA provisoire d'août 2026 (dossier
-- BIRAHIME FALL), dans le périmètre que le métier a retenu le 11 septembre
-- 2026 : le détail seulement, livré et à facturer, doublons compris. Voir
-- docs/CA-LOCATION-AOUT-2026.md.
--
--   A. Dieng    ${parFeuille("AB DIENG").length} voyages · ${somme(parFeuille("AB DIENG").map((v) => v.montant))} F HT (feuille : ${ca.totaux["AB DIENG"]?.ht})
--   Sokhna Diop ${parFeuille("SOKHNA").length} voyages · ${somme(parFeuille("SOKHNA").map((v) => v.montant))} F HT (feuille : ${ca.totaux.SOKHNA?.ht})
--   ADEX        ${jours.length} camions · ${somme(jours.map((a) => a.montant))} F HT (feuille : ${ca.totaux.ADEX?.ht})
--
-- Montants **hors taxe** : les trois transporteurs facturent la TVA de 18 %
-- (migration 0039), que l'application ajoute quand on lit TTC.
--
-- Non chargés : ${ecartes.map((a) => `${a.libelle} (${a.jours} j à ${a.prixJour} F)`).join(", ")} — zéro franc.
--
-- À jouer APRÈS la migration 0039 et releve-parties/releve-01-camions.sql.
-- REJOUABLE : on conflict (numero) do nothing.
-- ============================================================================

begin;

insert into affretement (numero, date, prestataire_id, origine, destination, business_unit, categorie_demandee, immatriculation_externe, tonnage_prevu, tonnage_livre, motif, statut, montant_convenu, montant_facture, date_livraison, demandeur, commentaire) values
${lignesAffretement.join(",\n")}
on conflict (numero) do nothing;

insert into prestation (numero, date, prestataire_id, libelle, business_unit, unite, quantite, prix_unitaire, convention, statut, montant_facture, commentaire) values
${lignesPrestation.join(",\n")}
on conflict (numero) do nothing;

commit;


-- ---------------------------------------------------------------------------
-- Vérification : les montants hors taxe par transporteur, et les camions retrouvés.
-- ---------------------------------------------------------------------------

select p.raison_sociale, count(*) as voyages, sum(a.montant_convenu) as ht, count(a.immatriculation_externe) as camions_retrouves
  from affretement a join prestataire p on p.id = a.prestataire_id
 where a.numero like 'AFF-2026-9%' group by p.raison_sociale
union all
select p.raison_sociale, count(*), sum(round(x.quantite * x.prix_unitaire)), null
  from prestation x join prestataire p on p.id = x.prestataire_id
 where x.numero like 'PRS-2026-9%' group by p.raison_sociale;
`;

writeFileSync(join(projet, "supabase/ca-location-aout-2026.sql"), sortie, "utf8");
console.log(`${voyages.length} affrètements (${voyages.filter(enDouble).length} en double), ${jours.length} prestations au jour, ${ecartes.length} lignes à zéro écartées`);
console.log(`  A. Dieng ${somme(parFeuille("AB DIENG").map((v) => v.montant))} F HT · Sokhna Diop ${somme(parFeuille("SOKHNA").map((v) => v.montant))} F HT · ADEX ${somme(jours.map((a) => a.montant))} F HT`);
console.log("supabase/ca-location-aout-2026.sql écrit");
