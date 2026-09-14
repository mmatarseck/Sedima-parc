/* ============================================================================
 * Fabrique `supabase/cartes-grises.sql` — ce que disent les cartes grises
 * elles-mêmes.
 *
 * Le chargement du 11 septembre (`charger-caracteristiques.mts`) tirait ses
 * valeurs d'un **tableur recopié** des cartes grises
 * (`FICHE COMPLET VEHICULES PARC LIVRAISONS ET PERSONNELS.xlsx`). La recopie
 * avait ses trous : au 14 septembre 2026, le référentiel portait le PTAC de 98
 * véhicules sur 184 et le VIN de 56. Les originaux sont dans
 * `MALICK/CARTE GRISE VEHICULES` — 90 PDF et 12 .docx, **tous des scans**, sans
 * la moindre couche de texte.
 *
 * COMMENT ILS ONT ÉTÉ LUS. Les pages sont des JPEG embarqués (DCTDecode,
 * parfois sous une couche Flate) : `pdf-lib`, déjà au projet pour les
 * étiquettes QR, les sort du PDF ; les `.docx` les portent dans `word/media`.
 * Les images ont ensuite été lues à l'œil, une par une, le 14 septembre 2026.
 * **Le tableau ci-dessous est cette lecture** — il n'y a pas d'extraction
 * automatique à relancer, et c'est pourquoi la donnée vit ici plutôt que dans
 * un fichier tiers : elle doit pouvoir se relire et se corriger à la main.
 *
 * CE QUE LA CARTE GRISE DONNE : le VIN, la marque, l'appellation commerciale,
 * le type, l'énergie, la puissance, la cylindrée, les places assises, le PTAC,
 * le poids à vide, la charge utile — et, au recto, les deux dates et
 * **l'immatriculation précédente**, qui est ce qui rattache un véhicule à son
 * passé.
 *
 * CE QU'ELLE NE DONNE PAS, et qu'il ne faut pas venir y chercher : la capacité
 * du réservoir, la valeur d'acquisition, le site de rattachement. Ces trois-là
 * restent à saisir ou à trouver ailleurs.
 *
 * LES VIN DE LA DÉMONSTRATION SONT FABRIQUÉS, et ceux-là s'écrasent. En lisant
 * les cartes, cinq VIN se sont révélés différents de ceux du référentiel —
 * « XXXH9N7LSUMJSLU1M », « MATWPSULS9CLFYWY2 »… `vinDemo()` de
 * `src/donnees/parc-demo.ts` les invente : trois lettres de constructeur et
 * quatorze caractères tirés d'un hachage de l'immatriculation. Sa propre note
 * l'annonçait — « l'inventaire de référence apportera les vrais ».
 *
 * La fonction étant déterministe, on la rejoue ici pour **reconnaître à coup
 * sûr** un VIN inventé, et on le remplace sans état d'âme : ce n'est pas une
 * valeur saisie ou vérifiée, c'est un bouche-trou. Un numéro de châssis faux
 * dans un registre de flotte est pire qu'une case vide — c'est lui qu'on
 * donnera à l'assureur.
 *
 * CE QU'ON NE FAIT PAS.
 *
 *   * **Écraser une valeur saisie.** Hors VIN fabriqués, seul un champ vide se
 *     remplit. Une valeur déjà en base a été saisie ou vérifiée ; la carte ne la
 *     contredit pas en silence. Quand elles divergent, l'écart est **nommé au
 *     compte rendu** pour que le métier tranche — c'est tout l'intérêt d'avoir
 *     lu la source primaire.
 *   * **Charger un zéro.** La carte grise d'une voiture particulière écrit
 *     « 0 kg » en PTAC, en poids à vide et en charge utile : c'est « sans
 *     objet », pas une masse. Une remorque écrit « 0 CV » et « 0 cm3 » : elle
 *     n'a pas de moteur. Zéro devient inconnu.
 *   * **Charger un VIN que le document ne donne pas.** Celui de AA 909 CW est
 *     écrit `XXXXXXXXXXXXXX090` sur la carte elle-même ; celui de AA 507 BQ est
 *     masqué par une vignette de visite. Ils restent vides.
 *   * **Créer un véhicule absent.** C'est `vehicules-manquants.sql` qui crée,
 *     avec les décisions écrites du métier. Les plaques du dossier que le
 *     référentiel ignore sont listées au compte rendu, avec ce que leur carte
 *     dit — il y a de quoi trancher.
 *
 * Lancer : npx tsx scripts/charger-cartes-grises.mts
 * ==========================================================================*/

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normaliser } from "../src/domaine/immatriculation";

const projet = process.cwd();

/** Une carte grise, telle qu'elle a été lue. `null` = la carte ne le donne pas. */
interface Carte {
  plaque: string;
  marque: string;
  appellation: string;
  type: string;
  /** Nul quand le document lui-même ne le porte pas. */
  vin: string | null;
  energie: "gasoil" | "essence" | null;
  puissanceCv: number;
  cylindree: number;
  places: number;
  ptac: number;
  poidsVide: number;
  chargeUtile: number;
  /** Ce que le recto donne, quand il a été lu. */
  mec?: string;
  immatriculation?: string;
  /** L'immatriculation précédente : elle rattache le véhicule à son passé. */
  precedente?: string;
  /** Genre et carrosserie, pour le compte rendu — la base n'a pas de colonne. */
  genre: string;
}

/* -- Les cartes lues le 14 septembre 2026 ---------------------------------- */

const CARTES: Carte[] = [
  { plaque: "AA 021 EA", marque: "Citroen", appellation: "C Elysee", type: "DDNFH5", vin: "VF7DDNFH5KJ896183", energie: "essence", puissanceCv: 9, cylindree: 1587, places: 5, ptac: 0, poidsVide: 0, chargeUtile: 0, genre: "Voiture particulière · conduite intérieure" },
  { plaque: "AA 053 AP", marque: "Cubas Segre", appellation: "Sm13 10s", type: "B3SA5AC1", vin: "VV1B3SA5ASN188289", energie: "gasoil", puissanceCv: 0, cylindree: 0, places: 0, ptac: 37000, poidsVide: 7940, chargeUtile: 29060, mec: "2019-11-06", immatriculation: "2019-11-06", genre: "Semi-remorque · citerne alimentaire" },
  { plaque: "AA 106 NE", marque: "Toyota", appellation: "Coaster", type: "HZB70L", vin: "JTGABAB8106710662", energie: "gasoil", puissanceCv: 12, cylindree: 4164, places: 28, ptac: 5670, poidsVide: 3635, chargeUtile: 2035, genre: "Autocar · aménagée" },
  { plaque: "AA 139 HP", marque: "Land-Rover", appellation: "Range Rover", type: "WA2EFXEA", vin: "SALWA2EFXEA383004", energie: "essence", puissanceCv: 29, cylindree: 4999, places: 5, ptac: 0, poidsVide: 0, chargeUtile: 0, mec: "2015-01-29", immatriculation: "2022-06-03", precedente: "DK 6633 AX", genre: "Voiture particulière · station wagon" },
  { plaque: "AA 189 JM", marque: "Toyota", appellation: "Corolla Cross", type: "ZSG10L", vin: "AHTKFCAGX00604226", energie: "essence", puissanceCv: 10, cylindree: 1798, places: 5, ptac: 0, poidsVide: 0, chargeUtile: 0, genre: "Voiture particulière · station wagon" },
  { plaque: "AA 200 EA", marque: "Citroen", appellation: "Berlingo", type: "E1NFJE", vin: "VR7E1NFJELJ914496", energie: "essence", puissanceCv: 9, cylindree: 1587, places: 2, ptac: 1930, poidsVide: 1165, chargeUtile: 765, genre: "Camionnette · fourgonnette" },
  { plaque: "AA 214 XK", marque: "Fruehauf", appellation: "Tx34cu2eaa", type: "TX34C", vin: "VFKT34CW32FX2011", energie: null, puissanceCv: 0, cylindree: 0, places: 0, ptac: 37000, poidsVide: 6000, chargeUtile: 31000, genre: "Semi-remorque · plateau nu" },
  { plaque: "AA 266 JC", marque: "Suzuki", appellation: "Vitara GI 4x2", type: "LYD21S", vin: "TSMLYD21S00B05803", energie: "essence", puissanceCv: 9, cylindree: 1586, places: 5, ptac: 0, poidsVide: 0, chargeUtile: 0, genre: "Voiture particulière · conduite intérieure" },
  { plaque: "AA 324 JE", marque: "Ford", appellation: "Ecosport", type: "J6DAT15", vin: "MAJBXXMRKBMP30585", energie: "essence", puissanceCv: 9, cylindree: 1498, places: 5, ptac: 0, poidsVide: 0, chargeUtile: 0, genre: "Voiture particulière · station wagon" },
  { plaque: "AA 359 AH", marque: "Tata", appellation: "Lpt709", type: "386321FI", vin: "MAT386321K7L00277", energie: "gasoil", puissanceCv: 11, cylindree: 3784, places: 3, ptac: 4400, poidsVide: 0, chargeUtile: 2500, genre: "Camion · frigorifique" },
  { plaque: "AA 389 JG", marque: "Mitsubishi", appellation: "L200 Dc", type: "KL3TJNJTL", vin: "MMBJNKL30NH078053", energie: "gasoil", puissanceCv: 10, cylindree: 2477, places: 5, ptac: 2850, poidsVide: 1775, chargeUtile: 1075, genre: "Camionnette · pick up" },
  { plaque: "AA 390 JG", marque: "Peugeot", appellation: "301", type: "DDNFP5", vin: "VF7DDNFP5MJ964645", energie: "essence", puissanceCv: 9, cylindree: 1587, places: 5, ptac: 0, poidsVide: 0, chargeUtile: 0, genre: "Voiture particulière · conduite intérieure" },
  { plaque: "AA 392 JG", marque: "Peugeot", appellation: "301", type: "DDNFP5", vin: "VF7DDNFP5MJ964644", energie: "essence", puissanceCv: 9, cylindree: 1587, places: 5, ptac: 0, poidsVide: 0, chargeUtile: 0, genre: "Voiture particulière · conduite intérieure" },
  { plaque: "AA 403 JG", marque: "Citroen", appellation: "C Elysee", type: "DDNFP5", vin: "VF7DDNFP5MJ964646", energie: "essence", puissanceCv: 9, cylindree: 1587, places: 5, ptac: 0, poidsVide: 0, chargeUtile: 0, genre: "Voiture particulière · conduite intérieure" },
  /* Le VIN est masqué par la vignette de visite technique collée sur la carte. */
  { plaque: "AA 507 BQ", marque: "Schmitz", appellation: "Ski 24", type: "000000", vin: null, energie: "gasoil", puissanceCv: 0, cylindree: 0, places: 0, ptac: 38000, poidsVide: 5050, chargeUtile: 32950, mec: "2006-05-24", immatriculation: "2020-07-15", precedente: "BQ 096 CN", genre: "Semi-remorque · benne" },
  { plaque: "AA 541 JD", marque: "Toyota", appellation: "Corolla Cross", type: "ZSG10L", vin: "AHTKFCAG200603443", energie: "essence", puissanceCv: 10, cylindree: 1798, places: 5, ptac: 0, poidsVide: 0, chargeUtile: 0, mec: "2022-07-22", immatriculation: "2022-07-22", genre: "Voiture particulière · station wagon" },
  { plaque: "AA 554 JD", marque: "Toyota", appellation: "Corolla Cross", type: "ZSG10L", vin: "AHTKFCAG300604701", energie: "essence", puissanceCv: 10, cylindree: 1798, places: 5, ptac: 0, poidsVide: 0, chargeUtile: 0, genre: "Voiture particulière · station wagon" },
  { plaque: "AA 713 VE", marque: "Lecitrailer", appellation: "D1317", type: "SR3ESA", vin: "VV1SR3ESAFLL70437", energie: null, puissanceCv: 0, cylindree: 0, places: 0, ptac: 37000, poidsVide: 6000, chargeUtile: 31000, genre: "Semi-remorque · plateau nu" },
  { plaque: "AA 769 PA", marque: "Mitsubishi", appellation: "L200 Dc", type: "KL3TJNJTL", vin: "MMBJNKL30PH078658", energie: "gasoil", puissanceCv: 10, cylindree: 2477, places: 5, ptac: 2850, poidsVide: 1775, chargeUtile: 1075, genre: "Camionnette · pick up" },
  /* La carte elle-même écrit « XXXXXXXXXXXXXX090 » à la place du VIN. */
  { plaque: "AA 909 CW", marque: "Coder", appellation: "M32c2", type: "C2CNCE", vin: null, energie: "gasoil", puissanceCv: 0, cylindree: 0, places: 0, ptac: 32000, poidsVide: 5400, chargeUtile: 26600, genre: "Véhicule très spécial · citerne à eau" },
  { plaque: "AA 963 JM", marque: "Kia", appellation: "Sorento", type: "RH81DD", vin: "KNARH81DDN5157346", energie: "essence", puissanceCv: 14, cylindree: 2497, places: 7, ptac: 0, poidsVide: 0, chargeUtile: 0, genre: "Voiture particulière · station wagon" },
  { plaque: "AB 078 JS", marque: "Mitsubishi", appellation: "L200 Dc", type: "KL3TJNJTL", vin: "MMBJNKL30HH006910", energie: "gasoil", puissanceCv: 10, cylindree: 2477, places: 5, ptac: 2850, poidsVide: 1775, chargeUtile: 1075, precedente: "DK 2348 BD", genre: "Camionnette · pick up" },
  { plaque: "AB 282 JT", marque: "Mitsubishi", appellation: "L200", type: "LC1TJLHFCL", vin: "MMBJLLC10SH079793", energie: "gasoil", puissanceCv: 10, cylindree: 2446, places: 5, ptac: 3000, poidsVide: 1965, chargeUtile: 1035, genre: "Camionnette · pick up" },
  { plaque: "AB 361 JL", marque: "Howo", appellation: "Zz3317n", type: "5EXSC", vin: "LZZ5EXSC0SD390777", energie: "gasoil", puissanceCv: 26, cylindree: 9726, places: 2, ptac: 26000, poidsVide: 13200, chargeUtile: 12800, genre: "Véhicule très spécial · benne" },
  { plaque: "AB 364 HK", marque: "Peugeot", appellation: "5008", type: "0ERHE8", vin: "VF30ERHE89S251304", energie: "gasoil", puissanceCv: 8, cylindree: 1997, places: 7, ptac: 0, poidsVide: 0, chargeUtile: 0, genre: "Voiture particulière · combi" },
  { plaque: "AB 489 JY", marque: "Mitsubishi", appellation: "L200", type: "LC1TJLHFCL", vin: "MMBJLLC10RH012176", energie: "gasoil", puissanceCv: 10, cylindree: 2446, places: 5, ptac: 3000, poidsVide: 1965, chargeUtile: 1035, genre: "Camionnette · pick up" },
  { plaque: "AB 551 HS", marque: "Jac", appellation: "Hfc9640zxc", type: "39VRG", vin: "LA939VRG2S0CLW700", energie: null, puissanceCv: 0, cylindree: 0, places: 0, ptac: 34500, poidsVide: 10180, chargeUtile: 24320, genre: "Véhicule très spécial · citerne alimentaire" },
  /* Les dix pick-up du lot KP : même véhicule, seul le VIN change. */
  { plaque: "AB 565 KP", marque: "Mitsubishi", appellation: "L200 Dc GI", type: "LC1TJNUFAL", vin: "MMBJNLC10SH083967", energie: "gasoil", puissanceCv: 10, cylindree: 2442, places: 5, ptac: 2755, poidsVide: 1800, chargeUtile: 955, genre: "Camionnette · pick up" },
  { plaque: "AB 609 KP", marque: "Mitsubishi", appellation: "L200 Dc GI", type: "LC1TJNUFAL", vin: "MMBJNLC10SH083994", energie: "gasoil", puissanceCv: 10, cylindree: 2442, places: 5, ptac: 2755, poidsVide: 1800, chargeUtile: 955, genre: "Camionnette · pick up" },
  { plaque: "AB 611 KP", marque: "Mitsubishi", appellation: "L200 Dc GI", type: "LC1TJNUFAL", vin: "MMBJNLC10SH083992", energie: "gasoil", puissanceCv: 10, cylindree: 2442, places: 5, ptac: 2755, poidsVide: 1800, chargeUtile: 955, genre: "Camionnette · pick up" },
  { plaque: "AB 612 KP", marque: "Mitsubishi", appellation: "L200 Dc GI", type: "LC1TJNUFAL", vin: "MMBJNLC10SH083988", energie: "gasoil", puissanceCv: 10, cylindree: 2442, places: 5, ptac: 2755, poidsVide: 1800, chargeUtile: 955, genre: "Camionnette · pick up" },
  { plaque: "AB 614 KP", marque: "Mitsubishi", appellation: "L200 Dc GI", type: "LC1TJNUFAL", vin: "MMBJNLC10SH084003", energie: "gasoil", puissanceCv: 10, cylindree: 2442, places: 5, ptac: 2755, poidsVide: 1800, chargeUtile: 955, genre: "Camionnette · pick up" },
  { plaque: "AB 615 KP", marque: "Mitsubishi", appellation: "L200 Dc GI", type: "LC1TJNUFAL", vin: "MMBJNLC10SH083986", energie: "gasoil", puissanceCv: 10, cylindree: 2442, places: 5, ptac: 2755, poidsVide: 1800, chargeUtile: 955, genre: "Camionnette · pick up" },
  { plaque: "AB 616 KP", marque: "Mitsubishi", appellation: "L200 Dc GI", type: "LC1TJNUFAL", vin: "MMBJNLC10SH083927", energie: "gasoil", puissanceCv: 10, cylindree: 2442, places: 5, ptac: 2755, poidsVide: 1800, chargeUtile: 955, genre: "Camionnette · pick up" },
  { plaque: "AB 617 KP", marque: "Mitsubishi", appellation: "L200 Dc GI", type: "LC1TJNUFAL", vin: "MMBJNLC10SH083978", energie: "gasoil", puissanceCv: 10, cylindree: 2442, places: 5, ptac: 2755, poidsVide: 1800, chargeUtile: 955, genre: "Camionnette · pick up" },
  { plaque: "AB 619 KP", marque: "Mitsubishi", appellation: "L200 Dc GI", type: "LC1TJNUFAL", vin: "MMBJNLC10SH083976", energie: "gasoil", puissanceCv: 10, cylindree: 2442, places: 5, ptac: 2755, poidsVide: 1800, chargeUtile: 955, genre: "Camionnette · pick up" },
  { plaque: "AB 622 KP", marque: "Mitsubishi", appellation: "L200 Dc GI", type: "LC1TJNUFAL", vin: "MMBJNLC10SH083969", energie: "gasoil", puissanceCv: 10, cylindree: 2442, places: 5, ptac: 2755, poidsVide: 1800, chargeUtile: 955, genre: "Camionnette · pick up" },
  { plaque: "AB 716 FK", marque: "Hyundai", appellation: "Santa Fe", type: "S281HGMU", vin: "KMHS281HGMU328988", energie: "gasoil", puissanceCv: 8, cylindree: 1995, places: 5, ptac: 0, poidsVide: 0, chargeUtile: 0, genre: "Voiture particulière · station wagon" },
  { plaque: "AB 900 JW", marque: "Toyota", appellation: "Hilux Dnpshn 33", type: "GUN125L", vin: "AHTDB9CD106651300", energie: "gasoil", puissanceCv: 10, cylindree: 2393, places: 5, ptac: 2910, poidsVide: 2060, chargeUtile: 850, genre: "Camionnette · pick up" },
  { plaque: "AB 903 JW", marque: "Toyota", appellation: "Hilux Dnpshn 33", type: "GUN125L", vin: "AHTDB9CD806651309", energie: "gasoil", puissanceCv: 10, cylindree: 2393, places: 5, ptac: 2910, poidsVide: 2060, chargeUtile: 850, mec: "2026-07-03", immatriculation: "2026-07-03", genre: "Camionnette · pick up" },
  { plaque: "AB 907 JW", marque: "Toyota", appellation: "Hilux Dnpshn 33", type: "GUN125L", vin: "AHTDB9CD306651315", energie: "gasoil", puissanceCv: 10, cylindree: 2393, places: 5, ptac: 2910, poidsVide: 2060, chargeUtile: 850, genre: "Camionnette · pick up" },
  { plaque: "AB 930 BV", marque: "Hyundai", appellation: "Santa Fe", type: "S281HGMU", vin: "KMHS281HGMU328180", energie: "gasoil", puissanceCv: 8, cylindree: 1995, places: 5, ptac: 0, poidsVide: 0, chargeUtile: 0, genre: "Voiture particulière · station wagon" },
];

/**
 * Les cartes du dossier dont la plaque n'est pas au référentiel. Elles ne
 * chargent rien : elles sont là pour que le métier tranche, avec ce que leur
 * carte dit — c'est plus qu'on n'en savait.
 */
const HORS_REFERENTIEL = [
  {
    plaque: "AB 098 JC",
    dit: "Titulaire « SÉNÉGALAISE DE DISTRIBUTION DE MATERIEL AVICOLE » — la raison sociale de SEDIMA. 1re mise en circulation le 20/06/2016, immatriculé le 06/05/2026, ex-DK 1306 BB, Rufisque Ouest. La plaque portait déjà des pneus chargés le 14 septembre (PNEUS-REELS.md) : c'est un véhicule du parc qui n'a pas de fiche.",
  },
  {
    plaque: "AB 077 FP",
    dit: "Le fichier s'appelle « AB 077 BP », mais la carte et sa vignette écrivent toutes deux AB-077-FP. Titulaire SEDIMA, 1re mise en circulation et immatriculation le 02/01/2026, Dakar. Le référentiel, lui, porte AA 077 FP : c'est la première paire de lettres qui est fausse, pas la dernière.",
  },
  {
    plaque: "AA 205 VH",
    dit: "Titulaire « S P I - SARL », pas SEDIMA. 1re mise en circulation le 16/10/2024. La carte est au dossier, le véhicule n'est pas au parc : rien à créer.",
  },
  {
    plaque: "DK 2348 BD",
    dit: "Ancienne carte papier. Même numéro de série que AB 078 JS (HH006910) : c'est le même pick-up Mitsubishi L200 avant son changement de plaque, pas un second véhicule.",
  },
];

/* -- Ce que la base porte déjà --------------------------------------------- */

/** Les noms que l'alias du chargement du 11 septembre donne aux colonnes. */
const ALIAS: Record<string, string> = {
  premiere: "premiere_mise_en_circulation",
  immatriculation_le: "date_immatriculation",
  puissance: "puissance_cv",
};

/** Les valeurs déjà chargées, lues dans les fichiers joués — sans base à interroger. */
function referentiel(): Map<string, Record<string, string>> {
  const parPlaque = new Map<string, Record<string, string>>();
  const poser = (plaque: string, champ: string, valeur: string) => {
    const v = parPlaque.get(plaque) ?? {};
    if (valeur && valeur !== "null") v[champ] = valeur;
    parPlaque.set(plaque, v);
  };
  /* Le socle : les colonnes du `insert into vehicule` du seed et des ajouts. */
  for (const f of ["supabase/seed.sql", "supabase/aligner-referentiel.sql", "supabase/vehicules-manquants.sql"]) {
    const t = readFileSync(join(projet, f), "utf8");
    for (const b of t.matchAll(/insert into vehicule \(([^)]*)\) values([\s\S]*?)\non conflict[^;]*;/g)) {
      const colonnes = b[1]!.split(",").map((c) => c.trim());
      const iPlaque = colonnes.indexOf("immatriculation");
      if (iPlaque < 0) continue;
      for (const ligne of b[2]!.matchAll(/^\s*\((.*)\),?$/gm)) {
        const champs = decouper(ligne[1]!);
        const plaque = champs[iPlaque]?.replace(/^'|'$/g, "") ?? "";
        if (!plaque) continue;
        colonnes.forEach((c, i) => poser(plaque, c, (champs[i] ?? "").replace(/^'|'$/g, "")));
      }
    }
  }
  /* Les caractéristiques du 11 septembre. Elles ne s'écrivent pas colonne par
     colonne mais en `update … from (values …) as x(…)` : c'est l'alias qui
     nomme les colonnes, et la première d'entre elles porte la plaque. Le lire
     de travers reviendrait à croire le référentiel vide, donc à ne signaler
     aucun écart avec les cartes grises — tout l'intérêt de les avoir lues. */
  const t = readFileSync(join(projet, "supabase/caracteristiques-vehicules.sql"), "utf8");
  for (const b of t.matchAll(/update vehicule v set[\s\S]*?from \(values([\s\S]*?)\) as x\(([^)]*)\)/g)) {
    const colonnes = b[2]!.split(",").map((c) => c.trim());
    for (const ligne of b[1]!.matchAll(/^\s*\((.*?)\),?\s*$/gm)) {
      const champs = decouper(ligne[1]!);
      const plaque = champs[0]?.replace(/^'|'$/g, "") ?? "";
      if (!plaque) continue;
      colonnes.forEach((c, i) => poser(plaque, ALIAS[c] ?? c, (champs[i] ?? "").replace(/^'|'$/g, "")));
    }
  }
  return parPlaque;
}

/** Découpe une ligne de `values`, en respectant les apostrophes doublées. */
function decouper(ligne: string): string[] {
  const champs: string[] = [];
  let courant = "";
  let dansChaine = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i]!;
    if (c === "'" && ligne[i + 1] === "'") {
      courant += "''";
      i++;
      continue;
    }
    if (c === "'") dansChaine = !dansChaine;
    if (c === "," && !dansChaine) {
      champs.push(courant.trim());
      courant = "";
      continue;
    }
    courant += c;
  }
  champs.push(courant.trim());
  return champs;
}

/* -- Le rapprochement ------------------------------------------------------- */

const COLONNES: { champ: keyof Carte; colonne: string; texte?: boolean }[] = [
  { champ: "vin", colonne: "vin", texte: true },
  { champ: "type", colonne: "type_modele", texte: true },
  { champ: "puissanceCv", colonne: "puissance_cv" },
  { champ: "cylindree", colonne: "cylindree" },
  { champ: "ptac", colonne: "ptac" },
  { champ: "poidsVide", colonne: "poids_vide" },
  { champ: "chargeUtile", colonne: "charge_utile" },
  { champ: "mec", colonne: "premiere_mise_en_circulation", texte: true },
  { champ: "immatriculation", colonne: "date_immatriculation", texte: true },
];

/**
 * Les quatorze caractères que `vinDemo()` tire de l'immatriculation. Le WMI qui
 * les précède dépend de la marque ; le suffixe, non — il suffit à reconnaître
 * un VIN inventé, quelle que soit l'orthographe de la marque en base.
 */
function suffixeInvente(canonique: string): string {
  let h = 7;
  for (const ch of canonique) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const alphabet = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  let suite = "";
  for (let i = 0; i < 14; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    suite += alphabet[h % alphabet.length];
  }
  return suite;
}

const vinInvente = (plaque: string, vin: string) => vin.length === 17 && vin.slice(3) === suffixeInvente(plaque);

const parc = referentiel();
const remplissages: { plaque: string; colonne: string; valeur: string; force?: boolean }[] = [];
const ecarts: string[] = [];
const absentes: string[] = [];
const sansObjet: string[] = [];
const vinsRemplaces: string[] = [];

for (const c of CARTES) {
  const plaque = normaliser(c.plaque);
  const connu = parc.get(plaque);
  if (!connu) {
    absentes.push(c.plaque);
    continue;
  }
  for (const { champ, colonne, texte } of COLONNES) {
    const lu = c[champ];
    /* Zéro : « sans objet » sur la carte, pas une valeur. */
    if (lu === null || lu === undefined || lu === "" || lu === 0) {
      if (lu === 0) sansObjet.push(`${c.plaque} ${colonne}`);
      continue;
    }
    const enBase = connu[colonne];
    const valeur = texte ? `'${String(lu).replace(/'/g, "''")}'` : String(lu);
    if (enBase === undefined || enBase === "" || enBase === "null") {
      remplissages.push({ plaque, colonne, valeur });
      continue;
    }
    /* Un VIN que l'application s'est inventé n'est pas une valeur à protéger. */
    if (colonne === "vin" && vinInvente(plaque, enBase)) {
      remplissages.push({ plaque, colonne, valeur, force: true });
      vinsRemplaces.push(`${c.plaque} : ${enBase} → ${lu}`);
      continue;
    }
    if (String(enBase).toUpperCase() !== String(lu).toUpperCase()) ecarts.push(`${c.plaque} · ${colonne} : base « ${enBase} », carte grise « ${lu} »`);
  }
}

/* Ceux qui restent inventés, faute d'avoir leur carte grise au dossier. */
const vinsInventesRestants = [...parc]
  .filter(([plaque, v]) => v.vin && vinInvente(plaque, v.vin) && !CARTES.some((c) => normaliser(c.plaque) === plaque && c.vin))
  .map(([plaque, v]) => `${plaque} (${v.vin})`);

/* -- Le fichier ------------------------------------------------------------- */

const parVehicule = new Map<string, { colonne: string; valeur: string; force?: boolean }[]>();
for (const r of remplissages) parVehicule.set(r.plaque, [...(parVehicule.get(r.plaque) ?? []), { colonne: r.colonne, valeur: r.valeur, force: r.force }]);

const sql = `-- ============================================================================
-- SEDIMA Parc — ce que disent les cartes grises.
--
-- **Ce n'est pas une migration.** ${remplissages.length} valeurs posées sur ${parVehicule.size} véhicules, lues
-- une à une sur les scans du dossier \`MALICK/CARTE GRISE VEHICULES\` le
-- 14 septembre 2026. Voir docs/CARTES-GRISES.md.
--
-- **Seul un champ vide se remplit** : \`coalesce\` s'en charge, et le fichier est
-- rejouable sans rien écraser. Les valeurs que la base portait déjà et que la
-- carte contredit ne sont pas touchées — elles sont nommées dans la doc, pour
-- que le métier tranche.
--
-- **Sauf ${vinsRemplaces.length} numéros de châssis**, écrits sans \`coalesce\` : ceux-là étaient
-- inventés par \`vinDemo()\` de la démonstration, et un VIN faux dans un registre
-- de flotte est pire qu'une case vide. La ligne dit chaque fois lequel elle
-- remplace.
--
-- Un « 0 kg » de carte grise — le PTAC d'une voiture particulière, la puissance
-- d'une remorque — veut dire « sans objet » : il n'entre pas.
--
-- À jouer après aligner-referentiel.sql, vehicules-manquants.sql et
-- caracteristiques-vehicules.sql, tous déjà joués.
-- ============================================================================

${[...parVehicule]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([plaque, valeurs]) => {
    const remplace = valeurs.find((v) => v.force);
    const note = remplace ? `\n-- VIN inventé par la démonstration, remplacé par celui de la carte grise.` : "";
    return `${note}\nupdate vehicule set ${valeurs.map((v) => `${v.colonne} = ${v.force ? v.valeur : `coalesce(${v.colonne}, ${v.valeur})`}`).join(", ")} where immatriculation = '${plaque}';`;
  })
  .join("\n")}

-- ---------------------------------------------------------------------------
-- Les VIN que la démonstration s'est inventés, et dont on n'a pas la carte.
--
-- \`vinDemo()\` en a fabriqué un pour chaque véhicule du jeu de départ : trois
-- lettres de constructeur, quatorze caractères tirés d'un hachage de la plaque.
-- ${vinsInventesRestants.length} d'entre eux n'ont pas de carte grise au dossier pour les corriger.
--
-- **Ils sont effacés.** Un numéro de châssis est ce qu'on donne à l'assureur, au
-- constructeur, à la police : faux, il est pire que vide, parce que rien ne dit
-- qu'il l'est. Vide, la fiche demande qu'on le saisisse. Aucune information
-- n'est perdue — ces chaînes se recalculent à partir de l'immatriculation, et
-- c'est bien ce qui prouve qu'elles n'en portaient aucune.
--
-- Les cinq que les cartes grises ont corrigés plus haut ne sont pas concernés.
-- ---------------------------------------------------------------------------

update vehicule set vin = null where immatriculation in (${vinsInventesRestants.map((v) => `'${v.split(" ")[0]}'`).join(", ")});

-- ---------------------------------------------------------------------------
-- Vérification : ce que le référentiel porte désormais.
-- ---------------------------------------------------------------------------

select count(*)::int as vehicules, count(vin)::int as vin, count(ptac)::int as ptac,
       count(charge_utile)::int as charge_utile, count(poids_vide)::int as poids_vide,
       count(puissance_cv)::int as puissance, count(cylindree)::int as cylindree
  from vehicule where statut <> 'sorti';
`;

writeFileSync(join(projet, "supabase/cartes-grises.sql"), sql);

/* -- Le compte rendu -------------------------------------------------------- */

console.log(`${CARTES.length} cartes grises lues, ${parVehicule.size} véhicules complétés, ${remplissages.length} valeurs posées`);
const parColonne = new Map<string, number>();
for (const r of remplissages) parColonne.set(r.colonne, (parColonne.get(r.colonne) ?? 0) + 1);
console.log("\npar colonne :");
for (const [c, n] of [...parColonne].sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(30)} ${String(n).padStart(3)}`);

console.log(`\n${vinsRemplaces.length} VIN inventé(s) par la démonstration, remplacé(s) par celui de la carte :`);
for (const v of vinsRemplaces) console.log(`  ${v}`);
console.log(`\n${vinsInventesRestants.length} VIN encore inventé(s), faute de carte grise au dossier :`);
console.log(`  ${vinsInventesRestants.join(", ") || "aucun"}`);

console.log(`\n${ecarts.length} écart(s) entre la base et la carte grise :`);
for (const e of ecarts) console.log(`  ${e}`);

console.log(`\n${absentes.length} plaque(s) lue(s) mais absente(s) du référentiel : ${absentes.join(", ") || "aucune"}`);
console.log(`\n${HORS_REFERENTIEL.length} carte(s) du dossier à trancher :`);
for (const h of HORS_REFERENTIEL) console.log(`  ${h.plaque} — ${h.dit}`);
console.log(`\n${sansObjet.length} valeur(s) « 0 » écartée(s) comme sans objet.`);
