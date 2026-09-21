/* ============================================================================
 * La classification des tâches de maintenance, comme Fleetio.
 *
 * Métier, 21 septembre 2026 : « proposer un système de catégorisation comme
 * Fleetio ». Fleetio range ses tâches selon les codes VMRS, sur trois
 * niveaux :
 *
 *   * la **catégorie** — un chiffre : 0 cabine et carrosserie, 1 châssis,
 *     2 transmission, 3 électricité, 4 moteur, 5 accessoires et fluides,
 *     9 divers ;
 *   * le **système** — trois chiffres, dont celui des dizaines est la
 *     catégorie : 013 Freins, 017 Pneus, 045 Moteur ;
 *   * l'**ensemble** — trois chiffres dans le système : 013-017 plaquettes et
 *     garnitures, 045-011 huile et filtre.
 *
 * Les libellés des systèmes viennent de l'export Fleetio lui-même (ses tâches
 * « … (Divers) »), et de la table VMRS quand l'export n'en a pas. Les
 * ensembles n'ont pas de libellé dans l'export : ils se lisent par leur code et
 * par les tâches qu'ils rassemblent.
 * ==========================================================================*/

export const CATEGORIES_MAINTENANCE: Record<string, string> = {
  "0": "Cabine et carrosserie",
  "1": "Châssis",
  "2": "Transmission",
  "3": "Électricité",
  "4": "Moteur",
  "5": "Accessoires et fluides",
  "9": "Divers",
};

export interface SystemeMaintenance {
  code: string;
  libelle: string;
  categorie: string;
}

export const SYSTEMES_MAINTENANCE: SystemeMaintenance[] = [
  { code: "001", libelle: "Climatisation et chauffage", categorie: "0" },
  { code: "002", libelle: "Carrosserie et cabine", categorie: "0" },
  { code: "003", libelle: "Instruments et tableau de bord", categorie: "0" },
  { code: "013", libelle: "Freins", categorie: "1" },
  { code: "014", libelle: "Châssis et cadre", categorie: "1" },
  { code: "015", libelle: "Direction", categorie: "1" },
  { code: "016", libelle: "Suspension", categorie: "1" },
  { code: "017", libelle: "Pneus", categorie: "1" },
  { code: "018", libelle: "Roues et moyeux", categorie: "1" },
  { code: "111", libelle: "Soubassement", categorie: "1" },
  /* Les « divers » d'une catégorie, que Fleetio rangeait sans système (revue du 21 septembre 2026). */
  { code: "020", libelle: "Transmission — divers", categorie: "2" },
  { code: "021", libelle: "Pont avant", categorie: "2" },
  { code: "022", libelle: "Pont arrière", categorie: "2" },
  { code: "023", libelle: "Embrayage", categorie: "2" },
  { code: "024", libelle: "Arbre de transmission", categorie: "2" },
  { code: "025", libelle: "Boîte de transfert", categorie: "2" },
  { code: "026", libelle: "Boîte de vitesses manuelle", categorie: "2" },
  { code: "027", libelle: "Boîte de vitesses automatique", categorie: "2" },
  { code: "030", libelle: "Électricité — divers", categorie: "3" },
  { code: "031", libelle: "Charge et alternateur", categorie: "3" },
  { code: "032", libelle: "Démarrage et batterie", categorie: "3" },
  { code: "033", libelle: "Allumage", categorie: "3" },
  { code: "034", libelle: "Éclairage et signalisation", categorie: "3" },
  { code: "036", libelle: "Caméras, alarmes et sécurité", categorie: "3" },
  { code: "041", libelle: "Admission d'air", categorie: "4" },
  { code: "042", libelle: "Refroidissement", categorie: "4" },
  { code: "043", libelle: "Échappement et émissions", categorie: "4" },
  { code: "044", libelle: "Alimentation en carburant", categorie: "4" },
  { code: "045", libelle: "Moteur", categorie: "4" },
  { code: "050", libelle: "Accessoires et aménagements", categorie: "5" },
  { code: "052", libelle: "Hydraulique — benne et vérins", categorie: "5" },
  { code: "053", libelle: "Fluides et fournitures", categorie: "5" },
  { code: "054", libelle: "Groupe frigorifique et caisse isotherme", categorie: "5" },
  { code: "999", libelle: "Divers", categorie: "9" },
];

const PAR_CODE = new Map(SYSTEMES_MAINTENANCE.map((s) => [s.code, s]));

export function systemeDe(code: string | null | undefined): SystemeMaintenance | null {
  return code ? (PAR_CODE.get(code) ?? null) : null;
}

/** « Châssis › Freins › 017 » — ce qu'on sait, dans l'ordre, sans trou. */
export function libelleClassement(t: { categorie?: string | null; systeme?: string | null; ensemble?: string | null }): string {
  const s = systemeDe(t.systeme);
  const categorie = t.categorie ?? s?.categorie ?? null;
  return [categorie ? CATEGORIES_MAINTENANCE[categorie] : null, s?.libelle ?? (t.systeme ? `Système ${t.systeme}` : null), t.ensemble && t.ensemble !== "999" ? t.ensemble : null].filter(Boolean).join(" › ") || "À classer";
}

/** Les systèmes, rangés par catégorie : les listes de choix des formulaires. */
export function optionsSystemes(): { valeur: string; libelle: string }[] {
  return [...SYSTEMES_MAINTENANCE]
    .sort((a, b) => a.categorie.localeCompare(b.categorie) || a.libelle.localeCompare(b.libelle, "fr"))
    .map((s) => ({ valeur: s.code, libelle: `${CATEGORIES_MAINTENANCE[s.categorie]} › ${s.libelle}` }));
}

/**
 * Le système qu'un libellé nomme, pour classer les tâches que Fleetio n'avait
 * pas classées — 143 sur 510, créées à la main (« vidange », « MOTEUR
 * DIVERS »). Nul quand rien ne se reconnaît : la tâche reste « à classer ».
 */
const MOTS: [RegExp, string][] = [
  /* L'ordre compte : le premier motif reconnu l'emporte. Les composants
     précis passent donc avant les mots génériques — un « disque
     d'embrayage » est de l'embrayage, pas du freinage ; un « ballon d'air »
     est de la suspension, pas du freinage ; un compresseur « frigo » est du
     groupe frigorifique, pas de la climatisation (revue du 21 septembre 2026). */
  [/embray/i, "023"],
  [/ballon|suspension pneumatique/i, "016"],
  [/golden shop|frigo|froid|fr[ée]on|frigorig[èe]ne|isotherme/i, "054"],
  [/v[ée]rin|hydrauliqu(e|es) (de|du) (benne|v[ée]rin)|benne|hydraulic oil/i, "052"],
  [/vidange|huile moteur|filtre (à|a) huile/i, "045"],
  [/clim|chauffage|hvac/i, "001"],
  [/carross|t[ôo]le|peinture|pare[- ]?(brise|choc)|r[ée]troviseur|vitre|porti[èe]re|serrure|si[èe]ge|essuie|sinistre|remise en [ée]tat/i, "002"],
  [/tableau de bord|compteur|indicateur|jauge/i, "003"],
  [/\bair\b|aire\b|dessicat|poumon|[ée]lectrovanne|distributeur|boudin|compresseur/i, "013"],
  [/frein|plaquette|disque|tambour|garniture|m[âa]choire|[ée]trier/i, "013"],
  [/attelage|sellette|crochet|ch[âa]ssis|cadre|soudure/i, "014"],
  [/direction|cr[ée]maill[èe]re|rotule de direction/i, "015"],
  [/suspension|amortisseur|ressort|\blames?\b|silent|barre stab|jambe de force|bras/i, "016"],
  [/pneu|vulcani|chambre (à|a) air|crevaison|gonflage/i, "017"],
  [/roue|moyeu|roulement|jante|goujon|bic[ôo]ne|parall[ée]lisme|alignement/i, "018"],
  [/pont avant|homocin[ée]tique|cardan avant/i, "021"],
  [/pont arri[èe]re|diff[ée]rentiel|essieu|engren/i, "022"],
  [/arbre de transmission|cardan|croisillon/i, "024"],
  [/bo[îi]te (de )?(vitesse|transfert)|transmission|robot/i, "026"],
  [/alternateur|r[ée]gulateur de charge/i, "031"],
  [/batterie|d[ée]marreur/i, "032"],
  [/allumage|bougie|bobine|contact/i, "033"],
  [/feu|phare|ampoule|bulb|clignotant|[ée]clairage|signalisation|gabarit|relais|klaxon|avertisseur|prise (de )?(courant|remorque)/i, "034"],
  [/cam[ée]ra|alarme|gps|balise|traceur/i, "036"],
  [/filtre (à|a) air|admission|papillon|collecteur d.admission/i, "041"],
  [/radiateur|refroidiss|glaciol|pompe (à|a) eau|thermostat|ventilateur|h[ée]lice|durite/i, "042"],
  [/[ée]chappement|\bpot\b|silencieux|turbo|egr|fap|adblue/i, "043"],
  [/carburant|gasoil|gazole|injecteur|injection|r[ée]servoir/i, "044"],
  [/moteur|culasse|courroie|distribution|segment|piston|vilebrequin/i, "045"],
  [/graissage|graisse|grease|lubrifi|liquide|fourniture|atelier|silicone|\bcol+e\b/i, "053"],
  [/lavage|remorquage|d[ée]pannage|assistance|d[ée]sinfection|administratif/i, "999"],
];

export function systemeReconnu(libelle: string): string | null {
  return MOTS.find(([re]) => re.test(libelle))?.[1] ?? null;
}
