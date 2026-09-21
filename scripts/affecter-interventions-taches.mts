/* ============================================================================
 * Fabrique `supabase/interventions-taches.sql` — chaque intervention déjà
 * faite sur le parc, affectée aux tâches du catalogue qu'elle a couvertes.
 *
 * Métier, 21 septembre 2026 : « la colonne Utilisation Fleetio n'est pas
 * relevant ; il faut évaluer le nombre d'utilisations dans notre propre
 * flotte, en extrayant les interventions déjà effectuées sur chaque véhicule
 * et en les affectant au bon service, ou à divers si pas possible ».
 *
 * CE QU'ON LIT, en lecture seule :
 *   * les interventions de la base (clé de service, jamais affichée) ;
 *   * le classeur des bons de commande de maintenance : l'objet de la
 *     demande d'achat et les désignations de ses lignes, plus parlants que
 *     l'objet de l'intervention (« ENTRETIEN VEHICULE ») quand l'intervention
 *     vient d'un bon.
 *
 * COMMENT ON AFFECTE. Le texte de l'intervention passe devant une liste de
 * motifs relus à la main, chacun vers une tâche du catalogue. Une intervention
 * peut en couvrir plusieurs (« disque embrayage et huile boîte »). Quelques
 * motifs génériques — « Freins (Divers) », « Moteur (Divers) » — ne jouent
 * que si aucune tâche précise du même système n'a été reconnue. Un entretien
 * « aux 50 000 km » est l'entretien périodique. Ce qui ne se reconnaît pas va
 * à l'entretien périodique si l'intervention est préventive, à « Travaux non
 * détaillés (Divers) » sinon.
 *
 * Toutes les tâches citées doivent exister dans `taches-service.sql` : le
 * script s'arrête sinon.
 *
 * Lancer : npx tsx scripts/affecter-interventions-taches.mts
 * ==========================================================================*/

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";

const CLASSEUR =
  "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/62. Transport & Flotte Automobile/61. Gestion Parc/Maintenance/SEDIMA_Maintenance_Parc_Bons_de_commande.xlsx";

const PERIODIQUE = "Entretien périodique (révision)";
const DIVERS = "Travaux non détaillés (Divers)";

/**
 * Les motifs, sur le texte sans accents et en minuscules. `siAucun` : ne joue
 * que si aucune tâche déjà reconnue n'a un système qui commence ainsi.
 * `sauf` : ne joue pas si le texte le contient.
 */
interface Motif {
  re: RegExp;
  tache: string;
  siAucun?: string;
  sauf?: RegExp;
}
const FRIGO = /frigo|froid|supra|carrier|groupe/;
/** Le groupe frigorifique, et non le « groupe » du vrac (la soufflerie de dépotage) ni l'entretien d'un porteur Aubineau. */
const GROUPE_FROID = /frigo|froid|supra|carrier|groupe aubineau|moteur (du )?groupe aubineau|groupe pour aubineau/;
const MOTIFS: Motif[] = [
  /* Divers du véhicule */
  { re: /lavage/, tache: "Lavage du véhicule" },
  { re: /graissage|graisse/, tache: "Graissage général du véhicule" },
  { re: /remorquage|depannage/, tache: "Assistance routière/remorquage" },
  { re: /franchise[^|]*\bsin\b|sinistre|suite accident/, tache: "Remise en état après sinistre" },
  { re: /diagnostic/, tache: "Diagnostic (Non spécifié)" },
  { re: /visite technique/, tache: "Inspection Multi-Points du Véhicule" },

  /* Carrosserie et cabine */
  { re: /pare[- ]?brise|brise de glace/, tache: "Remplacement du pare-brise" },
  { re: /toler|peinture|pare[- ]?choc|parbou|\baile\b|carrosserie/, tache: "Tôlerie et peinture" },
  { re: /tapiss|sellerie/, tache: "Sellerie et tapisserie de la cabine" },
  { re: /retroviseur/, tache: "Remplacement du rétroviseur extérieur" },
  { re: /locket|serrure|clavier|marche a pied/, tache: "Carrosserie (Divers)" },

  /* Climatisation */
  { re: /compresseur clim|compresseur, condensateur|compresseur, condasateur/, tache: "Remplacement du compresseur de climatisation", sauf: FRIGO },
  { re: /recharge gaz|charge gaz/, tache: "Evacuation et recharge du système de climatisation", sauf: FRIGO },
  { re: /condenseur clim|condensateur|condasateur/, tache: "Remplacement du condenseur de climatisation", sauf: FRIGO },
  { re: /filtre a pollen/, tache: "Remplacement du filtre d'air de cabine" },
  { re: /\bclim/, tache: "HVAC (Divers)", siAucun: "001" },

  /* Groupe frigorifique */
  { re: /caisse (frigo|isotherme)|porte frigorifique|interieur caisse/, tache: "Réparation de la caisse isotherme" },
  { re: GROUPE_FROID, tache: "Réparation du groupe frigorifique", sauf: /huile boite|^(?!.*groupe).*caisse frigo/ },
  { re: /groupe du vrac/, tache: "Accessoires/Aménagements (Divers)" },

  /* Freins */
  { re: /plaquette/, tache: "Remplacement des plaquettes de frein" },
  { re: /disques? (de )?frein|plaquettes? et disques?|disques? plaquettes?|disques? et plaquettes?/, tache: "Remplacement des disques de frein" },
  { re: /garniture|ferodo|machoir/, tache: "Remplacement des garnitures de frein" },
  { re: /tambour/, tache: "Remplacement du tambour de frein" },
  { re: /etrier/, tache: "Remplacement de l'étrier de frein" },
  { re: /dess?icat|dissicat/, tache: "Remplacement de la cartouche de dessiccant du sécheur d'air" },
  { re: /frein a main/, tache: "Réparation du frein à main" },
  { re: /tuyau air|appareil frein|circuit d.air/, tache: "Réparation du circuit d'air de freinage" },
  { re: /poumon|pumon/, tache: "Remplacement des vases de frein (poumons)", sauf: /suspension/ },
  { re: /frein/, tache: "Freins (Divers)", siAucun: "013" },

  /* Embrayage */
  { re: /(disque|disc)\W+(d.)?(embray|embrey)|disque,? plateau/, tache: "Remplacement du disque d'embrayage" },
  { re: /plateau,? (et )?(disque|butee)|changement plateau|butee? (et )?disque|kit embrayage|quit embrayage|appareil embrayage|mette cylindre|mette embrayage|roulement volant/, tache: "Remplacement de l'assemblage d'embrayage" },
  { re: /embray|embrey/, tache: "Remplacement de l'assemblage d'embrayage", siAucun: "023" },

  /* Suspension, direction, roues, pneus */
  { re: /amortisseur/, tache: "Remplacement des amortisseurs ou des jambes de force" },
  { re: /\blames?\b/, tache: "Remplacement des lames de ressort", sauf: /support lame/ },
  { re: /bio?lette/, tache: "Remplacement du lien de barre stabilisatrice" },
  { re: /pumon suspension|ballon/, tache: "Remplacement des ballons de suspension pneumatique" },
  { re: /silent ?bloc/, tache: "Suspension (Divers)" },
  { re: /rotule/, tache: "Remplacement du joint de rotule de suspension" },
  { re: /cremaill|cremayer|direction|\bfuses?\b/, tache: "Système de direction (Divers)" },
  { re: /pneu|penus|chambre a air|\bflap\b/, tache: "Remplacement des pneus" },
  { re: /equilibrage/, tache: "Equilibrage des pneus" },
  { re: /parallelisme|geometrie/, tache: "Alignement des roues" },
  { re: /pression pneu/, tache: "Contrôle et gonflage des pneus" },
  { re: /roulement/, tache: "Remplacement des roulements de roue", sauf: /roulement volant/ },

  /* Transmission, ponts */
  { re: /noyau|carcasse pont|pont dxi/, tache: "Remplacement du différentiel" },
  { re: /huile (du )?pont|differentiel/, tache: "Vidange et remplissage de l'ensemble essieu arrière" },
  { re: /pont avant|transfert|transfaire/, tache: "Transmission (Divers)" },
  { re: /boite automatique/, tache: "Remplacement de l'ensemble de transmission automatique" },
  { re: /(changement|changemnt|achat|remplacement)\s+(de\s+(la\s+)?)?boite(?! automatique)|boite manuel|01 boite|boite (de )?vitesses? # coki|boite vitesse # coki/, tache: "Remplacement de l'ensemble de transmission" },
  { re: /huile (de )?boite|huile bvit/, tache: "Vidange et remplissage du liquide de transmission" },
  { re: /cardan|cardant|croison|croisillon|arbre (de )?transmission|godet/, tache: "Remplacement de l'arbre de transmission ou du cardan" },
  { re: /(?<!huile )(?<!huile de )boite|prise directe|pignon/, tache: "Réparation de la boîte de vitesses", siAucun: "02" },

  /* Moteur */
  { re: /huile moteur|vidange|cartouche huile|filtre (a )?huile|jeux? (de )?cartouche|huile vrac|huile vrain|rimula/, tache: "Remplacement de l'huile moteur et du filtre" },
  { re: /filtre (a )?(gasoil|gazoil)|cartouche (gasoil|gazoil)|filtre gazoil/, tache: "Remplacement du filtre à carburant" },
  { re: /filtre (a )?air/, tache: "Remplacement du filtre à air du moteur" },
  { re: /changement (des )?filtres/, tache: "Remplacement du filtre à air du moteur" },
  { re: /changement moteur|moteur neuf|achat moteur|nouveau moteur|moteur (dxi|iveco|premium|deutz|camion|vehicule leger)|changement et reparation moteur|remplace moteur|moteur complet|changermen?t moteur|changement de moteur/, tache: "Remplacement de l'ensemble moteur", sauf: FRIGO },
  { re: /revision (du )?moteur|refection|segment|piston|coussinet|biel|pall?ier|pochette (de )?joint|rabot/, tache: "Réfection du moteur (segmentation, pochette de joints)" },
  { re: /culasse/, tache: "Remplacement du joint de culasse", sauf: /capteur/ },
  { re: /turbo/, tache: "Remplacement de l'ensemble du turbocompresseur", sauf: /groupe/ },
  { re: /injecteur|inecteur|injection|tarage/, tache: "Remplacement des injecteurs de carburant" },
  { re: /pompe (a )?(gazoil|gasoil|injection|injecteur|carburant)/, tache: "Remplacement de la pompe à carburant" },
  { re: /soupape/, tache: "Réglage du jeu des soupapes" },
  { re: /courroie/, tache: "Remplacement de la courroie de distribution" },
  { re: /accelerateur/, tache: "Carburant (Divers)" },
  { re: /catalyseur|filtre a pollution/, tache: "Remplacement du convertisseur catalytique" },
  { re: /adblue/, tache: "Remplissage du liquide des émissions diesel" },
  { re: /echappement/, tache: "Remplacement du tuyau d'échappement" },
  { re: /radiateur/, tache: "Remplacement du radiateur" },
  { re: /pompe a eau/, tache: "Remplacement de la Pompe à Eau" },
  { re: /glaciol/, tache: "Vidange et remplissage du liquide de refroidissement du moteur" },
  { re: /fuite eau|vase d.eau|durite/, tache: "Système de refroidissement du moteur (Divers)" },
  { re: /moteur|carti?ere|carter|arret huile|organe|argane/, tache: "Moteur (Divers)", siAucun: "04", sauf: FRIGO },

  /* Électricité */
  { re: /demarreur/, tache: "Remplacement du moteur de démarrage" },
  { re: /alternateur/, tache: "Remplacement de l'alternateur", sauf: FRIGO },
  { re: /batterie/, tache: "Remplacement de la batterie" },
  { re: /bougie/, tache: "Remplacement des bougies d'allumage" },
  { re: /bobine d.allumage/, tache: "Remplacement de la bobine d'allumage" },
  { re: /neiman/, tache: "Remplacement de l'interrupteur d'allumage" },
  { re: /phare/, tache: "Remplacement Phare" },
  { re: /feux? arriere|feux avants/, tache: "Remplacement Feux arrières, stop, clignotants ou plaque" },
  { re: /ampoule|signal/, tache: "Remplacement des ampoules extérieures" },
  { re: /capteur vitesse|abs\b/, tache: "Remplacement du capteur de vitesse de roue" },
  { re: /electri|fuible|fusible|relais|capteur|tableau de bord|robinet courant|plaque jode/, tache: "Système électrique (Divers)", siAucun: "03" },

  /* Accessoires et aménagements */
  { re: /v[e]rin/, tache: "Réparation d'un vérin hydraulique" },
  { re: /bache|branding|flexible|\bdol+y\b|modification|etrylleur|gyrophare|support lame/, tache: "Accessoires/Aménagements (Divers)", sauf: /moteur|clim/ },

  /* L'entretien périodique : « entretien aux 50 000 km », « révision », « entretien général » — pas « entretien et réparation ». */
  { re: /entretien(?!\s*(et|&|\+)?\s*(la\s+)?r[e]?par)(?!\s+(du\s+|de\s+la\s+)?(systeme\s+)?(clim|condenseur|et maintenace des froids))|revision|\d\s?kms?\b/, tache: PERIODIQUE, sauf: /froids? des camions/ },
];

/** Les désignations qui ne disent rien du travail : on ne les lit pas. */
const GENERIQUE = /^(entretien vehicule|entretien et reparation vehicule|retenue 5%|maintenance et entretien( un)?|main d.oeuvre( un)?|reparation( un)?|null|entretien et maintenance|pieces? de rechange( un)?|petit materiel et outillage|autres couts|vehicule|entretien et piece)$/;

const sansAccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());
const echappe = (s: string) => s.replace(/'/g, "''");

export function tachesDe(t: string, preventif: boolean): string[] {
  const x = sansAccent(t).replace(/\b(aa|ab|dk)[\s-]?\d{3,4}[\s-]?[a-z]{2}\b/g, "#").replace(/\s+/g, " ");
  const trouvees: string[] = [];
  for (const m of MOTIFS) {
    if (!m.re.test(x) || (m.sauf && m.sauf.test(x)) || trouvees.includes(m.tache)) continue;
    if (m.siAucun && trouvees.some((t2) => SYSTEME.get(t2)?.startsWith(m.siAucun!))) continue;
    trouvees.push(m.tache);
  }
  if (trouvees.length === 0) trouvees.push(preventif ? PERIODIQUE : DIVERS);
  return trouvees;
}

/* Le catalogue, lu dans le SQL qu'il fabrique : le libellé et le système de chaque tâche. */
const catalogue = readFileSync(join(process.cwd(), "supabase/taches-service.sql"), "utf8");
const SYSTEME = new Map<string, string>();
for (const m of catalogue.matchAll(/^ {2}\('TCH-2026-\d+', '((?:[^']|'')*)', (?:null|'(?:[^']|'')*'), '\d', '(\d{3})'/gm)) SYSTEME.set(m[1]!.replace(/''/g, "'"), m[2]!);
const absentes = [...new Set([...MOTIFS.map((m) => m.tache), PERIODIQUE, DIVERS])].filter((t) => !SYSTEME.has(t));
if (absentes.length) throw new Error(`tâches absentes du catalogue : ${absentes.join(" | ")}`);

if (process.argv[1]?.endsWith("affecter-interventions-taches.mts")) {
  for (const ligne of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*)$/.exec(ligne);
    if (m && !ligne.trimStart().startsWith("#") && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const interventions: { numero: string; type: string; objet: string; reference: string | null }[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await sb.from("intervention").select("numero, type, objet, reference").order("numero").range(i, i + 999);
    if (error) throw new Error(`lecture des interventions : ${error.message}`);
    interventions.push(...data);
    if (data.length < 1000) break;
  }

  const feuilles = lireClasseur(CLASSEUR);
  const commandes = new Map(feuilles.find((f) => f.nom === "Commandes")!.lignes.slice(1).map((l) => [texte(l[0]), texte(l[14])]));
  const designations = new Map<string, string[]>();
  for (const l of feuilles.find((f) => f.nom === "Lignes")!.lignes.slice(1)) {
    const d = texte(l[8]);
    if (!d || GENERIQUE.test(sansAccent(d))) continue;
    designations.set(texte(l[0]), [...(designations.get(texte(l[0])) ?? []), d]);
  }

  const affectations: [string, string][] = [];
  const parTache = new Map<string, number>();
  let viaBon = 0;
  for (const i of interventions) {
    const bon = (i.reference ?? "").split(/\s*·\s*/).find((r) => commandes.has(r));
    if (bon) viaBon++;
    /* L'objet sans ses désignations creuses (« ENTRETIEN VEHICULE ; RETENUE 5% »). Une ligne du grand livre qui nomme son travail se
       suffit : l'objet de son bon, commun à plusieurs véhicules, brouillerait. */
    const objet = i.objet.split(/\s*;\s*/).filter((m) => !GENERIQUE.test(sansAccent(m).trim())).join(" ; ");
    const seul = objet !== "" && i.numero.startsWith("INT-GL-");
    const morceaux = [objet, bon && !seul ? commandes.get(bon)! : "", ...(bon && !seul ? (designations.get(bon) ?? []) : [])];
    const lu = morceaux.filter(Boolean).join(" | ") || i.objet;
    if (process.env.AUDIT) console.log(`${i.numero} ${i.type} :: ${lu.slice(0, 150)}\n      → ${tachesDe(lu, i.type === "preventif").join(" · ")}`);
    for (const t of tachesDe(lu, i.type === "preventif")) {
      affectations.push([i.numero, t]);
      parTache.set(t, (parTache.get(t) ?? 0) + 1);
    }
  }

  const divers = parTache.get(DIVERS) ?? 0;
  writeFileSync(
    join(process.cwd(), "supabase/interventions-taches.sql"),
    `-- ============================================================================
-- SEDIMA Parc — les interventions du parc, affectées aux tâches du catalogue.
--
-- **Ce n'est pas une migration.** À jouer après 0061 et taches-service.sql.
-- Fabriqué par \`scripts/affecter-interventions-taches.mts\` — voir
-- docs/SERVICES-MAINTENANCE.md.
--
-- ${interventions.length} interventions, dont ${viaBon} lues avec leur bon de commande ;
-- ${affectations.length} affectations sur ${parTache.size} tâches ; ${divers} interventions en
-- « ${DIVERS} ».
-- Les utilisations du catalogue sont ensuite recomptées sur notre parc.
--
-- REJOUABLE : les affectations « historique » sont refaites ; celles posées
-- dans l'application restent.
-- ============================================================================

delete from intervention_tache where origine = 'historique';

insert into intervention_tache (intervention_id, tache_id, origine)
select i.id, t.id, 'historique'
  from (values
${affectations.map(([n, t]) => `    ('${echappe(n)}', '${echappe(t)}')`).join(",\n")}
  ) as v (numero, tache)
  join intervention i on i.numero = v.numero
  join tache_service t on lower(t.libelle) = lower(v.tache)
on conflict do nothing;

select recompter_utilisations_taches();

select t.libelle, t.utilisations from tache_service t where t.utilisations > 0 order by t.utilisations desc limit 40;
`,
    "utf8",
  );

  console.log(`${interventions.length} interventions · ${viaBon} avec leur bon · ${affectations.length} affectations · ${parTache.size} tâches · ${divers} en divers`);
  for (const [t, n] of [...parTache].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${t}`);
  console.log("supabase/interventions-taches.sql");
}
