/* ============================================================================
 * Fabrique `supabase/taches-service.sql` — le catalogue des tâches de service,
 * tiré de l'export Fleetio (21 septembre 2026).
 *
 * L'export compte 510 tâches ; 350 ont servi au moins une fois, pour 11 481
 * utilisations. Décision du métier du même jour : partir de celles-là, avec la
 * classification de Fleetio (catégorie, système, ensemble).
 *
 * LE NETTOYAGE.
 *   * « main d'oeuvre » (1 678 utilisations) n'est pas une tâche : c'est la
 *     colonne main-d'œuvre de chaque ligne de service. Écartée, avec les
 *     libellés qui ne désignent pas un travail — « Maintenance curative »,
 *     « Maintenance préventive », « Transport ».
 *   * Les doublons se fondent : même libellé aux accents, à la casse et à la
 *     ponctuation près (« MOTEUR DIVERS » et « Moteur (Divers) »), et quelques
 *     synonymes relus à la main (« vidange » est « Remplacement de l'huile
 *     moteur et du filtre »). Le nom fondu reste en alias : il se retrouve
 *     encore dans le formulaire.
 *   * Les 143 tâches créées à la main dans Fleetio n'ont aucun code : leur
 *     système se reconnaît au libellé (`systemeReconnu`), puis la REVUE
 *     (plus bas) retire, fond ou recode celles qui étaient mal créées. Le
 *     script s'arrête si une tâche reste sans système : rien n'est « à
 *     classer ».
 *
 * Rejouable : les tâches venues de Fleetio sont remplacées, celles saisies
 * dans l'application restent.
 *
 * Lancer : npx tsx scripts/charger-taches-fleetio.mts [chemin de l'export]
 * ==========================================================================*/

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur } from "./lire-xlsx.mts";
import { systemeDe, systemeReconnu } from "../src/domaine/categories-maintenance";
import { cleTache } from "../src/domaine/taches";

const EXPORT = process.argv[2] ?? "C:/Users/mamadou.seck/Downloads/fleetio-service-task-export-2026-09-21.xlsx";

const texte = (x: unknown) => String(x ?? "").trim();
const entier = (x: unknown) => Number(x ?? 0) || 0;
const echappe = (s: string) => s.replace(/'/g, "''");

/** Ce qui n'est pas une tâche de maintenance. */
const ECARTES = new Set(["main d'oeuvre", "MAIN DOEUVRE", "Maintenance curative", "Maintenance préventive", "Transport"].map(cleTache));

/** Les synonymes relus à la main : le premier est absorbé par le second. */
const SYNONYMES: [string, string][] = [
  ["vidange", "Remplacement de l'huile moteur et du filtre"],
  ["Electrical System (Miscellaneous)", "Système électrique (Divers)"],
  ["Carrosserie et châssis (Divers)", "Carrosserie (Divers)"],
  ["MAIN D OEUVRE DEPANNAGE", "Assistance routière/remorquage"],
];
const VERS = new Map(SYNONYMES.map(([a, b]) => [cleTache(a), cleTache(b)]));

/** La nature habituelle d'une tâche, lue dans son nom : l'entretien prévu, ou la réparation. */
function typeDe(libelle: string): "preventif" | "curatif" | null {
  if (/inspection|contr[ôo]le|v[ée]rification|vidange|huile|lubrifi|graissage|entretien|rotation|[ée]quilibrage|alignement|couple de serrage|couple des|nettoyage|remplissage|filtre|service de|test/i.test(libelle)) return "preventif";
  if (/r[ée]paration|remplacement|divers|changement|d[ée]pannage|remorquage|carrosserie/i.test(libelle)) return "curatif";
  return null;
}

interface Tache {
  libelle: string;
  description: string | null;
  categorie: string | null;
  systeme: string | null;
  ensemble: string | null;
  utilisations: number;
  alias: string[];
  aClasser: boolean;
}

const lignes = lireClasseur(EXPORT)[0]!.lignes;
const entete = lignes[0]!.map(texte);
const col = (nom: string) => {
  const i = entete.indexOf(nom);
  if (i < 0) throw new Error(`colonne « ${nom} » introuvable dans l'export`);
  return i;
};
const cNom = col("Name"), cDesc = col("Description"), cUtil = col("Service Entries"), cCat = col("Default Category Code"), cSys = col("Default System Code"), cEns = col("Default Assembly Code");

const parCle = new Map<string, Tache>();
let lues = 0, jamais = 0, ecartees = 0, fondues = 0;
for (const l of lignes.slice(1)) {
  const libelle = texte(l[cNom]).replace(/\s+/g, " ");
  if (!libelle) continue;
  lues++;
  const utilisations = entier(l[cUtil]);
  if (utilisations === 0) {
    jamais++;
    continue;
  }
  const k0 = cleTache(libelle);
  if (ECARTES.has(k0)) {
    ecartees++;
    continue;
  }
  const k = VERS.get(k0) ?? k0;
  const systemeFleetio = texte(l[cSys]) || null;
  const categorieFleetio = texte(l[cCat]) || null;
  const deja = parCle.get(k);
  if (deja) {
    fondues++;
    deja.utilisations += utilisations;
    if (cleTache(deja.libelle) !== k0) deja.alias.push(libelle);
    /* Le libellé retenu est celui du synonyme cible, ou le plus utilisé ; un code Fleetio passe devant une reconnaissance. */
    if (k0 === k && cleTache(deja.libelle) !== k) {
      deja.alias.push(deja.libelle);
      deja.libelle = libelle;
    }
    if (systemeFleetio && (!deja.systeme || deja.aClasser)) {
      deja.systeme = systemeFleetio;
      deja.categorie = categorieFleetio ?? systemeDe(systemeFleetio)?.categorie ?? null;
      deja.aClasser = false;
    }
    if (!deja.ensemble && texte(l[cEns])) deja.ensemble = texte(l[cEns]);
    continue;
  }
  let systeme = systemeFleetio;
  let categorie = categorieFleetio;
  let aClasser = false;
  if (!systeme && !categorie) {
    systeme = systemeReconnu(libelle);
    if (!systeme) {
      systeme = "999";
      aClasser = true;
    }
    categorie = systemeDe(systeme)?.categorie ?? null;
  }
  parCle.set(k, { libelle, description: texte(l[cDesc]) || null, categorie, systeme, ensemble: texte(l[cEns]) || null, utilisations, alias: k0 === k ? [] : [libelle], aClasser });
}
/* Un synonyme lu avant sa cible a pris la place : on rend son nom à la cible. */
for (const [, cible] of SYNONYMES.map(([a, b]) => [a, b] as const)) {
  const t = parCle.get(cleTache(cible));
  if (t && cleTache(t.libelle) !== cleTache(cible)) {
    t.alias.push(t.libelle);
    t.libelle = cible;
  }
}

/* ----------------------------------------------------------------------------
 * LA REVUE, relue à la main (21 septembre 2026). Métier : « revoir les tâches
 * non classées, sûrement créées par l'équipe qui utilisait Fleetio, pas
 * correctement, et retirer ; que toute la liste soit codifiée, en rajoutant
 * des services au besoin ». Les 143 tâches sans code Fleetio mêlent :
 *   * des achats de pièces saisis comme des tâches (« ACHATS PNEU 385 »,
 *     « RIMULA EXTRA 15W40209L », « batterie75AH ») : fondus dans la tâche
 *     qu'ils servent ;
 *   * des doublons d'une tâche standard (« FILTRE A HUILE », « GLACIOLE
 *     EAUX ») : fondus ;
 *   * des réparations réelles sans équivalent Fleetio (« appareil air »,
 *     poumons, groupe frigorifique) : regroupées dans une tâche standard
 *     nouvelle, bien nommée et codée ;
 *   * ce qui n'est pas de la maintenance, ou illisible (« Location de
 *     véhicule », « raccord ») : retiré.
 * Le nom fondu reste en alias : il se retrouve encore dans le formulaire.
 * --------------------------------------------------------------------------*/

/** Retirées : pas une tâche de maintenance, ou trop vague pour en faire une. */
const RETIREES = ["raccord", "CONFECTIONNEUSE ECROUS", "JEUX ARRET MERCESDES AXOR", "réparation quaie de chargement", "service HSE", "Location de véhicule", "AWD Filter Replacement", "Circle Drive Oil Replacement"];

type Type = "preventif" | "curatif";
/** Les tâches standard ajoutées, et celles qu'elles absorbent. */
const NOUVELLES: { libelle: string; systeme: string; ensemble: string; type: Type; depuis: string[] }[] = [
  { libelle: "Contrôle et gonflage des pneus", systeme: "017", ensemble: "001", type: "preventif", depuis: ["GONFLAGE PNEU"] },
  { libelle: "Remplacement de l'étrier de frein", systeme: "013", ensemble: "002", type: "curatif", depuis: ["REMPLACEMENT ETRIER ARRIERE"] },
  { libelle: "Réparation du circuit d'air de freinage", systeme: "013", ensemble: "010", type: "curatif", depuis: ["appareil air", "VANNE AIRE", "APPAREIL DISTRIBUTEUR", "appareil electrovanne", "appareil purchage", "COMMANDE BOUDIN", "BOUDIN LAC PM"] },
  { libelle: "Remplacement des vases de frein (poumons)", systeme: "013", ensemble: "999", type: "curatif", depuis: ["POUMON FREIN", "POUMON ARRIERE", "POUMON AIR"] },
  { libelle: "Réparation du compresseur d'air", systeme: "013", ensemble: "010", type: "curatif", depuis: ["SEGMENT COMPRESSEUR", "PISTON COMPRESSEUR"] },
  { libelle: "Réparation du frein à main", systeme: "013", ensemble: "003", type: "curatif", depuis: ["appareil frein à main"] },
  { libelle: "Remplacement des ballons de suspension pneumatique", systeme: "016", ensemble: "008", type: "curatif", depuis: ["BALLON AIR"] },
  { libelle: "Remplacement des lames de ressort", systeme: "016", ensemble: "999", type: "curatif", depuis: ["PAQUETS LAM"] },
  { libelle: "Remplacement des goujons et écrous de roue", systeme: "018", ensemble: "003", type: "curatif", depuis: ["goujon", "bicones"] },
  { libelle: "Réparation de l'attelage (crochet, sellette)", systeme: "014", ensemble: "999", type: "curatif", depuis: ["crochet teton"] },
  { libelle: "Entretien du groupe frigorifique", systeme: "054", ensemble: "001", type: "preventif", depuis: ["FROID ET ACCESSOIRES", "verification circuit froid", "Entretien Frigo Golden Shop"] },
  { libelle: "Réparation du compresseur du groupe frigorifique", systeme: "054", ensemble: "002", type: "curatif", depuis: ["Compresseur Golden Shop", "Moteur Frigo"] },
  { libelle: "Recharge en gaz frigorigène", systeme: "054", ensemble: "003", type: "curatif", depuis: ["Fréon Golden Shop (R 134 A, R 22, R 410 ou R 141)"] },
  { libelle: "Remplacement du ventilateur ou du condenseur du groupe frigorifique", systeme: "054", ensemble: "004", type: "curatif", depuis: ["Ventilo, Condenseur Golden Shop"] },
  { libelle: "Remplacement des filtres et capillaires du groupe frigorifique", systeme: "054", ensemble: "005", type: "curatif", depuis: ["Lampe, Filtre, Capillaire Golden Shop"] },
  { libelle: "Réparation d'un vérin hydraulique", systeme: "052", ensemble: "001", type: "curatif", depuis: ["CARTOUCHE VERIN"] },
  { libelle: "Remplacement de l'huile et du filtre hydrauliques", systeme: "052", ensemble: "002", type: "preventif", depuis: ["Hydraulic Oil Filter Replacement"] },
  { libelle: "Réparation de la commande de boîte (robot de vitesses)", systeme: "026", ensemble: "999", type: "curatif", depuis: ["APPAREIL ROBOT A VITESSE"] },
  { libelle: "Remplacement des feux de gabarit", systeme: "034", ensemble: "002", type: "curatif", depuis: ["feu de gabarie"] },
  { libelle: "Remplacement de l'avertisseur sonore (klaxon)", systeme: "034", ensemble: "999", type: "curatif", depuis: ["KLAXON"] },
  { libelle: "Réparation de la prise de remorque", systeme: "034", ensemble: "999", type: "curatif", depuis: ["prise courant"] },
  { libelle: "Graissage général du véhicule", systeme: "053", ensemble: "999", type: "preventif", depuis: ["Lubricate Grease Points", "Graisse"] },
  { libelle: "Réfection du moteur (segmentation, pochette de joints)", systeme: "045", ensemble: "999", type: "curatif", depuis: ["JEU DE SEGMENT", "POCHETTE DE GAIN"] },
  { libelle: "Entretien périodique (révision)", systeme: "045", ensemble: "999", type: "preventif", depuis: ["Maintenance périodique", "Entretien Préventive"] },
  { libelle: "Remplacement de la courroie de ventilateur", systeme: "042", ensemble: "003", type: "curatif", depuis: ["CROIE HELICE"] },
];

/** Fondues dans une tâche Fleetio existante : [la tâche mal créée, sa cible]. */
const FONDUES: [string, string][] = [
  ["vidange huile moteur", "Remplacement de l'huile moteur et du filtre"],
  ["FILTRE A HUILE", "Remplacement de l'huile moteur et du filtre"],
  ["RIMULA EXTRA 15W40209L", "Remplacement de l'huile moteur et du filtre"],
  ["FILTRE A GASOIL", "Remplacement du filtre à carburant"],
  ["CARTOUCHE GASOIL", "Remplacement du filtre à carburant"],
  ["ACHATS PNEU 385", "Remplacement des pneus"],
  ["ACHAT PNEU 315", "Remplacement des pneus"],
  ["PNEU 215", "Remplacement des pneus"],
  ["JEU DE PLAQUETTE", "Remplacement des plaquettes de frein"],
  ["PLAQUETTE FREIN", "Remplacement des plaquettes de frein"],
  ["JEU DE GARNITURE", "Remplacement des garnitures de frein"],
  ["DISQUE EMBRAYAGE MERCEDES AXOR", "Remplacement du disque d'embrayage"],
  ["Huile pour engreanages", "Vidange et remplissage de l'ensemble essieu arrière"],
  ["Remplacement Huile de différentiel", "Vidange et remplissage de l'ensemble essieu arrière"],
  ["APPAREIL DESSICATEUR AXOR", "Remplacement de la cartouche de dessiccant du sécheur d'air"],
  ["Brake Hydraulic Oil Replacement", "Vidange, remplissage et purge du système hydraulique de freinage"],
  ["Transmission Oil Replacement", "Vidange et remplissage du liquide de transmission"],
  ["ACHAT BATTERIE", "Remplacement de la batterie"],
  ["batterie75AH", "Remplacement de la batterie"],
  ["Acide batterie", "Service de batterie"],
  ["ampoule veilleuse", "Remplacement des ampoules extérieures"],
  ["12V 10W BULB", "Remplacement des ampoules extérieures"],
  ["RELAIS STOP", "Remplacement Feux arrières, stop, clignotants ou plaque"],
  ["réparation contacteur", "Remplacement de l'interrupteur d'allumage"],
  ["COLE SILICONE", "Fournitures pour atelier"],
  ["cole crezi", "Fournitures pour atelier"],
  ["Bouteille gaz", "Fournitures pour atelier"],
  ["TOLES", "Carrosserie (Divers)"],
  ["GLACIOLE EAUX", "Vidange et remplissage du liquide de refroidissement du moteur"],
  ["LAVAGE VEHICULE", "Lavage du véhicule"],
  ["Déchets de l'état/province", "Frais administratifs/divers"],
];

/** Recodées : un système à donner, un nom à corriger. L'ensemble manquant devient « 999 », le divers du système. */
const RECODEES: [string, { systeme: string; ensemble?: string; libelle?: string }][] = [
  ["Moteur (Divers)", { systeme: "045" }],
  ["Transmission (Divers)", { systeme: "020" }],
  ["Système électrique (Divers)", { systeme: "030" }],
  ["Accessoires/Aménagements (Divers)", { systeme: "050" }],
  ["Inspection des conduites du refroidisseur d'huile de transmission", { systeme: "026" }],
  ["Couple des boulons de fixation de l'ensemble de l'essieu de traction", { systeme: "022", ensemble: "003" }],
  ["Remplacement de l'arbre d'essieu", { systeme: "022", ensemble: "003" }],
  ["Vidange et remplissage de l'ensemble essieu moteur", { systeme: "022", ensemble: "007" }],
  ["Inspection de l'ensemble essieu moteur", { systeme: "022", ensemble: "007" }],
  ["Remplacement du filtre de transmission", { systeme: "026" }],
  ["Remise en état Sinistre", { systeme: "002", libelle: "Remise en état après sinistre" }],
  ["Désinfection et désincestisation", { systeme: "999", libelle: "Désinfection et désinsectisation du véhicule" }],
];

const exige = (libelle: string, pourquoi: string) => {
  const t = parCle.get(cleTache(libelle));
  if (!t) throw new Error(`revue : « ${libelle} » (${pourquoi}) n'est pas au catalogue — l'export a changé ?`);
  return t;
};
const fondre = (source: string, cible: Tache) => {
  const t = exige(source, "à fondre");
  cible.utilisations += t.utilisations;
  cible.alias.push(t.libelle, ...t.alias);
  parCle.delete(cleTache(source));
  revues.fondues++;
};
const revues = { retirees: 0, nouvelles: 0, fondues: 0, recodees: 0 };
const typeImpose = new Map<string, Type>();

for (const libelle of RETIREES) {
  exige(libelle, "à retirer");
  parCle.delete(cleTache(libelle));
  revues.retirees++;
}
for (const n of NOUVELLES) {
  if (parCle.has(cleTache(n.libelle))) throw new Error(`revue : « ${n.libelle} » existe déjà`);
  const t: Tache = { libelle: n.libelle, description: null, categorie: systemeDe(n.systeme)!.categorie, systeme: n.systeme, ensemble: n.ensemble, utilisations: 0, alias: [], aClasser: false };
  for (const d of n.depuis) fondre(d, t);
  parCle.set(cleTache(n.libelle), t);
  typeImpose.set(cleTache(n.libelle), n.type);
  revues.nouvelles++;
}
for (const [source, cible] of FONDUES) fondre(source, exige(cible, `cible de « ${source} »`));
for (const [libelle, r] of RECODEES) {
  const t = exige(libelle, "à recoder");
  t.systeme = r.systeme;
  t.categorie = systemeDe(r.systeme)!.categorie;
  if (r.ensemble) t.ensemble = r.ensemble;
  if (r.libelle) {
    parCle.delete(cleTache(libelle));
    t.alias.push(t.libelle);
    t.libelle = r.libelle;
    parCle.set(cleTache(r.libelle), t);
  }
  t.aClasser = false;
  revues.recodees++;
}
/* Tout est codifié : un système connu, sa catégorie, un ensemble — « 999 », le divers du système, quand Fleetio n'en donnait pas. */
for (const t of parCle.values()) {
  if (t.aClasser || !t.systeme || !systemeDe(t.systeme)) throw new Error(`revue : « ${t.libelle} » reste sans système (${t.systeme ?? "—"}) — à ajouter à la revue`);
  t.categorie = systemeDe(t.systeme)!.categorie;
  if (!t.ensemble || !/^\d{3}$/.test(t.ensemble)) t.ensemble = "999";
}

const taches = [...parCle.values()].sort((a, b) => b.utilisations - a.utilisations || a.libelle.localeCompare(b.libelle, "fr"));
const lignesSql = taches.map((t, i) => {
  const alias = t.alias.filter((a, j, x) => x.indexOf(a) === j && cleTache(a) !== cleTache(t.libelle));
  const tableau = alias.length ? `array[${alias.map((a) => `'${echappe(a)}'`).join(", ")}]::text[]` : `'{}'::text[]`;
  const sql = (v: string | null) => (v === null ? "null" : `'${echappe(v)}'`);
  return `  ('TCH-2026-${String(i + 1).padStart(5, "0")}', ${sql(t.libelle)}, ${sql(t.description)}, ${sql(t.categorie)}, ${sql(t.systeme)}, ${sql(t.ensemble)}, ${sql(typeImpose.get(cleTache(t.libelle)) ?? typeDe(t.libelle))}, ${tableau}, ${t.utilisations}, 'fleetio', false)`;
});

const divers = taches.filter((t) => t.ensemble === "999").length;
writeFileSync(
  join(process.cwd(), "supabase/taches-service.sql"),
  `-- ============================================================================
-- SEDIMA Parc — le catalogue des tâches de service, tiré de l'export Fleetio.
--
-- **Ce n'est pas une migration.** À jouer après 0060. Fabriqué par
-- \`scripts/charger-taches-fleetio.mts\` — voir docs/SERVICES-MAINTENANCE.md.
--
-- ${lues} tâches dans l'export ; ${jamais} jamais utilisées, laissées ; ${ecartees} qui ne sont pas des
-- tâches (main-d'œuvre, « maintenance curative »…), écartées ; ${fondues} doublons fondus.
-- Revue du 21 septembre 2026 des tâches créées à la main dans Fleetio :
-- ${revues.retirees} retirées, ${revues.fondues} fondues dans une tâche standard, ${revues.nouvelles} tâches standard
-- ajoutées, ${revues.recodees} recodées.
-- Restent **${taches.length} tâches**, toutes codifiées comme Fleetio (catégorie, système,
-- ensemble ; « 999 » est le divers du système, ${divers} tâches). Aucune à classer.
-- Leurs utilisations dans Fleetio ordonnent les listes.
--
-- REJOUABLE : les tâches venues de Fleetio sont remplacées ; celles saisies
-- dans l'application restent. Aucune ligne de service ne pointe une tâche par
-- clé étrangère : une ligne garde son libellé.
-- ============================================================================

delete from tache_service where source = 'fleetio';

insert into tache_service (numero, libelle, description, categorie, systeme, ensemble, type_defaut, alias, utilisations, source, a_classer) values
${lignesSql.join(",\n")}
on conflict do nothing;

select count(*) as taches, count(*) filter (where a_classer) as a_classer, sum(utilisations) as utilisations from tache_service;
`,
  "utf8",
);

console.log(`${lues} tâches lues · ${jamais} jamais utilisées · ${ecartees} écartées · ${fondues} fondues`);
console.log(`revue : ${revues.retirees} retirées · ${revues.fondues} fondues · ${revues.nouvelles} ajoutées · ${revues.recodees} recodées`);
console.log(`${taches.length} tâches au catalogue, toutes codifiées · ${divers} à l'ensemble « 999 »`);
const parCategorie = new Map<string, number>();
for (const t of taches) parCategorie.set(t.categorie ?? "—", (parCategorie.get(t.categorie ?? "—") ?? 0) + 1);
console.log(`par catégorie : ${[...parCategorie].sort().map(([c, n]) => `${c}: ${n}`).join(" · ")}`);
console.log(`fondues : ${taches.filter((t) => t.alias.length).slice(0, 12).map((t) => `${t.libelle} ← ${t.alias.join(", ")}`).join(" | ")}`);
console.log("supabase/taches-service.sql");
