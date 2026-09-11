/* ============================================================================
 * Fabrique `supabase/vehicules-manquants.sql` — les véhicules du parc que
 * l'application ne connaissait pas.
 *
 * Demande du métier (11 septembre 2026) : « créer les véhicules manquants ».
 * La fiche complète du parc (`MALICK/FICHE COMPLET VEHICULES PARC LIVRAISONS
 * ET PERSONNELS.xlsx`, 10 septembre) nomme 21 plaques absentes du référentiel.
 * Chacune a été regardée, avec les cartes grises du dossier, le plan
 * d'affectation des véhicules légers (« Cascade vf », 9 septembre) et le
 * rapprochement du parc :
 *
 *   * **17 véhicules sont créés.** Leur catégorie, leur business unit, leur
 *     régime et leur statut sont décidés ci-dessous, un par un, avec leur
 *     raison. Leurs caractéristiques techniques viennent ensuite de
 *     `caracteristiques-vehicules.sql`, comme pour tous les autres.
 *   * **Une plaque est corrigée** : AB 930 BB est AB 930 BV — la carte grise,
 *     l'assurance, l'attestation 2026 et la fiche le disent.
 *   * **Trois ne sont pas des véhicules manquants** mais des coquilles de la
 *     fiche : AA 783 SN est AA 783 BN (carte grise et licence), AA 078 JS est
 *     AB 078 JS (carte grise, même détenteur), DK 6875 DF est DK 6875 BF.
 *   * **Une reste à trancher** : AB 077 FP, un autocar Force Motors à Notto,
 *     que la carte grise écrit AB 077 BP et le référentiel AA 077 FP (Tata).
 *     Rien n'est créé tant que la plaque n'est pas sûre.
 *
 * Les cinq L200 DC immatriculés le 1er septembre sont les véhicules neufs de
 * la cascade : ils reçoivent leur attributaire, ou le pool du recrutement en
 * cours, et trois lots « à recevoir » se ferment sur eux (Lot 2 - 06, 11, 13).
 *
 * Lancer : npx tsx scripts/charger-vehicules-manquants.mts
 * ==========================================================================*/

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { normaliser } from "../src/domaine/immatriculation";

const FICHE = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/MALICK/FICHE COMPLET VEHICULES PARC LIVRAISONS ET PERSONNELS.xlsx";
const projet = process.cwd();
const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());

interface Decision {
  marque: string;
  appellation: string;
  categorie: "camion" | "tracteur" | "semi-remorque" | "camionnette" | "vehicule-leger" | "moto";
  usage: string;
  energie: "gasoil" | "essence";
  bu: string;
  regime: "exploitation" | "service" | "fonction";
  statut: "en-service" | "hors-service" | "en-mutation";
  engage: boolean;
  pourquoi: string;
  attribution?: { attributaire?: string; nom?: string; pool?: string; debut?: string };
  lot?: string;
}

/** Les attributaires du référentiel, par leur identifiant (seed-01). */
const YACINE_SIBY = "156e212e-fe7d-415f-a297-f1af17ab658e";
const MAIMOUNA_GAYE = "185a2bb4-768f-4cbc-a6a4-d7386f4ecb60";
const AMACODOU_NDIAYE = "e4366ce4-aac0-43c9-a863-acdeee59cc2b";
const BABACAR_TERAL_SHOP = "8feee996-b25a-4383-abd4-e36142c669a8";

const L200_NEUF = { marque: "Mitsubishi", appellation: "L200 DC", categorie: "camionnette", usage: "utilitaire", energie: "gasoil", statut: "en-service", engage: false } as const;
const SINOTRUK = { marque: "SINOTRUK", appellation: "ZZ1168", categorie: "camion", usage: "autre", energie: "gasoil", bu: "aliment", regime: "exploitation", statut: "en-mutation", engage: true } as const;

const DECISIONS: Record<string, Decision> = {
  AB060KT: { ...L200_NEUF, bu: "siege", regime: "service", pourquoi: "Lot 2 neuf, Yacine Siby, Responsable Dépôts (Cascade vf)", attribution: { attributaire: YACINE_SIBY, nom: "Yacine Siby", debut: "2026-09-01" } },
  AB062KT: { ...L200_NEUF, bu: "commercial", regime: "fonction", pourquoi: "Lot 2 neuf, Maimouna Gaye, Responsable Pôle Farine & Bétail ; remplace DK 5679 BL, à réformer (Cascade vf)", attribution: { attributaire: MAIMOUNA_GAYE, nom: "Maimouna Gaye", debut: "2026-09-01" } },
  AB112KT: { ...L200_NEUF, bu: "commercial", regime: "service", pourquoi: "Lot 2 - 06 neuf, Amacodou Ndiaye ; libère AA 119 AH pour le futur Responsable Logistique (Cascade vf)", attribution: { attributaire: AMACODOU_NDIAYE, nom: "Amacodou Ndiaye", debut: "2026-09-01" }, lot: "Lot 2 - 06" },
  AB010KT: { ...L200_NEUF, bu: "commercial", regime: "service", pourquoi: "Lot 2 - 11 neuf, commercial Sud 2 en recrutement au 1er octobre 2026 (Cascade vf)", attribution: { pool: "Commercial — recrutement Sud 2" }, lot: "Lot 2 - 11" },
  AB066KT: { ...L200_NEUF, bu: "commercial", regime: "service", pourquoi: "Lot 2 - 13 neuf, commercial Zone Nord 2 en recrutement au 1er octobre 2026. Le plan d'affectation écrit AB 056 KT, la fiche du parc AB 066 KT : plaque à confirmer sur la carte grise", attribution: { pool: "Commercial — recrutement Zone Nord 2" }, lot: "Lot 2 - 13" },
  AB178KR: { ...SINOTRUK, pourquoi: "Camion neuf immatriculé le 21/08/2026, livraison aliment, en mutation (fiche du parc)" },
  AB180KR: { ...SINOTRUK, pourquoi: "Camion neuf immatriculé le 21/08/2026, livraison aliment, en mutation (fiche du parc)" },
  AB181KR: { ...SINOTRUK, pourquoi: "Camion neuf immatriculé le 21/08/2026, livraison aliment, en mutation (fiche du parc)" },
  AB938KQ: { ...SINOTRUK, pourquoi: "Camion neuf immatriculé le 21/08/2026, livraison aliment, en mutation (fiche du parc)" },
  AA542BQ: { marque: "RENAULT", appellation: "Premium", categorie: "tracteur", usage: "tracteur", energie: "gasoil", bu: "fermes", regime: "exploitation", statut: "hors-service", engage: true, pourquoi: "Tracteur Renault Premium 2020 de la ferme de Djilakh, béton et sable, assuré 2026 ; panne moteur (fiche du parc, rapprochement)" },
  AA507BQ: { marque: "SCHMITZ", appellation: "Semi-remorque benne", categorie: "semi-remorque", usage: "benne", energie: "gasoil", bu: "fermes", regime: "exploitation", statut: "en-service", engage: true, pourquoi: "Semi-remorque benne Schmitz attelée à AA 542 BQ, ferme de Djilakh, assurée 2026 (carte grise, rapprochement)" },
  AB361JL: { marque: "HOWO", appellation: "ZZ3317N", categorie: "camion", usage: "benne", energie: "gasoil", bu: "fermes", regime: "exploitation", statut: "en-service", engage: true, pourquoi: "Camion Howo immatriculé le 05/06/2026, affecté aux fermes (carte grise, fiche du parc)" },
  AB364HK: { marque: "PEUGEOT", appellation: "5008", categorie: "vehicule-leger", usage: "utilitaire", energie: "gasoil", bu: "siege", regime: "service", statut: "en-service", engage: false, pourquoi: "Peugeot 5008 immatriculée le 07/04/2026, siège, non affectée (carte grise, fiche du parc)" },
  DK4923BB: { marque: "RENAULT", appellation: "Duster", categorie: "vehicule-leger", usage: "utilitaire", energie: "gasoil", bu: "siege", regime: "service", statut: "hors-service", engage: false, pourquoi: "Renault Duster 2016, siège ; panne moteur, organes et carrosserie (fiche du parc)" },
  DK0099BD: { marque: "HYUNDAI", appellation: "ix35", categorie: "vehicule-leger", usage: "utilitaire", energie: "gasoil", bu: "siege", regime: "service", statut: "hors-service", engage: false, pourquoi: "Hyundai ix35 2017, siège ; panne moteur, organes et carrosserie (fiche du parc)" },
  AA866YH: { marque: "TOYOTA", appellation: "Land Cruiser Prado", categorie: "vehicule-leger", usage: "utilitaire", energie: "gasoil", bu: "siege", regime: "fonction", statut: "en-service", engage: false, pourquoi: "Toyota Prado du Directeur général (fiche du parc : « DG Franck ») ; attributaire à créer au référentiel" },
  AA372WJ: { marque: "SUZUKI", appellation: "Burgman", categorie: "moto", usage: "autre", energie: "essence", bu: "commercial", regime: "service", statut: "en-service", engage: false, pourquoi: "Scooter Suzuki Burgman 2025 du Teral Shop (fiche du parc). L'assurance écrit AA 372 YJ : plaque à confirmer sur la carte grise", attribution: { attributaire: BABACAR_TERAL_SHOP, nom: "Babacar (Teral Shop)" } },
};

/** Les plaques de la fiche qui ne sont pas des véhicules manquants. */
export const COQUILLES: Record<string, string> = { AA783SN: "AA783BN", AA078JS: "AB078JS", DK6875DF: "DK6875BF" };
export const RENOMMAGES: Record<string, string> = { AB930BB: "AB930BV" };
export const A_TRANCHER = ["AB077FP"];
export const CREES = Object.keys(DECISIONS);

/* -- La fiche : chaque plaque décidée doit y être, et chaque absente décidée. -- */

const fiche = new Map<string, { lieu: string; chauffeur: string; commentaire: string }>();
for (const f of lireClasseur(FICHE)) {
  const debut = f.lignes.findIndex((l) => l.map(texte).includes("N° Immatriculation"));
  if (debut < 0) continue;
  const e = f.lignes[debut]!.map((c) => texte(c).replace(/\s+/g, " "));
  const [cP, cL, cC, cX] = ["N° Immatriculation", "Lieu d'assignation", "Chauffeur affecté", "Commentaires"].map((n) => e.indexOf(n));
  for (const l of f.lignes.slice(debut + 1)) if (texte(l[cP!])) fiche.set(normaliser(texte(l[cP!])), { lieu: texte(l[cL!]), chauffeur: texte(l[cC!]), commentaire: texte(l[cX!]) });
}
for (const p of [...CREES, ...Object.keys(COQUILLES), "AB930BV", ...A_TRANCHER]) if (!fiche.has(p)) throw new Error(`${p} absent de la fiche du parc`);

/* -- Le fichier ------------------------------------------------------------- */

const sql = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? "null" : `'${v.replace(/'/g, "''")}'`);
const commentaire = (p: string, d: Decision) => {
  const f = fiche.get(p)!;
  return `Créé le 11 septembre 2026 depuis la fiche complète du parc. ${d.pourquoi}.${f.chauffeur && f.chauffeur !== "NON AFFECTE" ? ` Chauffeur à la fiche : ${f.chauffeur}.` : ""}${f.commentaire ? ` ${f.commentaire}.` : ""}`;
};
const lignes = Object.entries(DECISIONS);
const attributions = lignes.filter(([, d]) => d.attribution);
const lots = lignes.filter(([, d]) => d.lot);

writeFileSync(
  join(projet, "supabase/vehicules-manquants.sql"),
  `-- ============================================================================
-- SEDIMA Parc — les véhicules du parc que l'application ne connaissait pas.
--
-- **Ce n'est pas une migration.** ${lignes.length} véhicules créés, une plaque corrigée
-- (AB 930 BB → AB 930 BV), ${attributions.length} attributions, ${lots.length} lots « à recevoir » reçus.
-- Source : FICHE COMPLET VEHICULES PARC LIVRAISONS ET PERSONNELS.xlsx (10/09/2026),
-- cartes grises, plan d'affectation des véhicules légers. Voir
-- docs/CARACTERISTIQUES-VEHICULES.md.
--
-- À jouer AVANT caracteristiques-vehicules.sql, qui complète ensuite les
-- caractéristiques techniques de tous les véhicules, ceux-ci compris.
-- REJOUABLE.
-- ============================================================================

begin;

-- ---- La plaque corrigée : la carte grise dit AB 930 BV ----
update vehicule set immatriculation = 'AB930BV',
       commentaire = concat_ws(' ', commentaire, 'Plaque corrigée le 11 septembre 2026 : AB 930 BV selon la carte grise, l''assurance et l''attestation 2026 (l''application écrivait AB 930 BB).')
 where immatriculation = 'AB930BB'
   and not exists (select 1 from vehicule where immatriculation = 'AB930BV');

-- ---- Les véhicules ----
insert into vehicule (immatriculation, marque, appellation, categorie, categorie_flotte, usage, transport_special, energie, business_unit, statut, engage, commentaire, regime) values
${lignes.map(([p, d]) => `  ('${p}', ${sql(d.marque)}, ${sql(d.appellation)}, '${d.categorie}', 'interne', '${d.usage}', false, '${d.energie}', '${d.bu}', '${d.statut}', ${d.engage}, ${sql(commentaire(p, d))}, '${d.regime}')`).join(",\n")}
on conflict (immatriculation) do nothing;

-- ---- Les attributions ----
insert into attribution_legere (vehicule_id, attributaire_id, pool, debut, commentaire)
select v.id, x.attributaire_id::uuid, x.pool, x.debut::date, x.commentaire
  from (values
${attributions.map(([p, d]) => `    ('${p}', ${sql(d.attribution!.attributaire)}, ${sql(d.attribution!.pool)}, ${sql(d.attribution!.debut)}, ${sql(`Véhicule neuf ou entré au parc le 11 septembre 2026${d.attribution!.nom ? `, attribué à ${d.attribution!.nom}` : ""}. ${d.pourquoi}.`)})`).join(",\n")}
  ) as x(immatriculation, attributaire_id, pool, debut, commentaire)
  join vehicule v on v.immatriculation = x.immatriculation
 where not exists (select 1 from attribution_legere a where a.vehicule_id = v.id);

-- ---- Les lots « à recevoir » reçus ----
update vehicule_a_recevoir r
   set recu_le = '2026-09-01', vehicule_id = v.id
  from (values
${lots.map(([p, d]) => `    ('${d.lot}', '${p}')`).join(",\n")}
  ) as x(lot, immatriculation)
  join vehicule v on v.immatriculation = x.immatriculation
 where r.lot = x.lot and r.recu_le is null;

commit;

-- ---------------------------------------------------------------------------
-- Vérification
-- ---------------------------------------------------------------------------

select v.immatriculation, v.marque, v.appellation, v.categorie, v.business_unit, v.regime, v.statut,
       coalesce(t.nom, a.pool) as detenteur, r.lot
  from vehicule v
  left join attribution_legere a on a.vehicule_id = v.id
  left join attributaire t on t.id = a.attributaire_id
  left join vehicule_a_recevoir r on r.vehicule_id = v.id
 where v.immatriculation in (${[...CREES, "AB930BV"].map((p) => `'${p}'`).join(", ")})
 order by v.categorie, v.immatriculation;
`,
);

console.log(`${lignes.length} véhicules créés, ${attributions.length} attributions, ${lots.length} lots reçus, 1 plaque corrigée`);
console.log(`coquilles de la fiche rattachées : ${Object.entries(COQUILLES).map(([a, b]) => `${a} → ${b}`).join(", ")}`);
console.log(`à trancher : ${A_TRANCHER.join(", ")}`);
