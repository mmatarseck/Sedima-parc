/* ============================================================================
 * La police d'assurance 2026 — une vraie donnée d'entreprise.
 *
 * Source : « FICHE RENOUVELLEMENT ASSURANCES 2026.xlsx » (dossier DO,
 * `6. Logistique & Distribution\61. Gestion Parc\BOCAR\M.SECK`, classeur du
 * 3 septembre 2026), onglets « ASSURANCE SEDIMA SA 2026 » et « ASSURANCE
 * SEDIMA ABATTOIRS 2026 ». Le classeur porte en tête : **« Du 1er Janvier
 * 2026 au 31 Décembre 2026 »**.
 *
 * Pourquoi ce fichier existe. Le suivi administratif porte une colonne
 * « Expiration Assurance » qui dit **31 décembre 2025 pour les 98 véhicules
 * qu''elle couvre** — la police précédente. Elle n''a pas été reprise après le
 * renouvellement : elle est en retard d''un cycle. La lire telle quelle
 * déclarerait tout le parc non assuré. La police, elle, se lit sans
 * ambiguïté, et c''est elle qui fait foi ici.
 *
 * Ce que porte la liste : les immatriculations couvertes, normalisées. Un
 * véhicule absent n''est pas assuré au titre de 2026 — et c''est un fait, pas
 * une lacune : la situation note par exemple le camion neuf AB 681 HE comme
 * « pas encore assuré ».
 * ==========================================================================*/

/** Fin de la période couverte, commune aux deux polices. */
export const FIN_POLICE_2026 = "2026-12-31";

/** Les véhicules de SEDIMA SA couverts en 2026 (117 plaques). */
const SA: string[] = ["AA022EA", "AA023EA", "AA032EA", "AA053AP", "AA099DZ", "AA105VA", "AA106NE", "AA128JC", "AA129JC", "AA131EX", "AA135JC", "AA139HP", "AA189JM", "AA214JC", "AA217FF", "AA226SX", "AA235MR", "AA236MR", "AA265JC", "AA266JC", "AA270JF", "AA277PT", "AA278JE", "AA281PT", "AA285PT", "AA291PT", "AA296PT", "AA300PT", "AA301PT", "AA320JF", "AA324JE", "AA339EN", "AA350JN", "AA372YJ", "AA386JG", "AA389JG", "AA390JG", "AA392JG", "AA397JG", "AA403JG", "AA433AJ", "AA484BH", "AA485DR", "AA489BH", "AA507BQ", "AA518EK", "AA541JD", "AA542BQ", "AA544JD", "AA547JD", "AA550JD", "AA554JD", "AA556JD", "AA562EE", "AA605TR", "AA633JL", "AA708BB", "AA713VE", "AA735MY", "AA764PA", "AA768JV", "AA769PA", "AA783BN", "AA856FG", "AA877YM", "AA898PZ", "AA905CW", "AA909CW", "AA920VA", "AA923YM", "AA927CA", "AA963JM", "AA966AD", "AA966JM", "AA972AJ", "AA977MR", "AA985MR", "AA990DZ", "AB741AP", "AB820EL", "AB930BV", "AB932EF", "DK0082BD", "DK1306BB", "DK1307BB", "DK1870BG", "DK2346BD", "DK2347BD", "DK2348BD", "DK2507BD", "DK2517BG", "DK3032BD", "DK3033BD", "DK3454BD", "DK4003AG", "DK4740BH", "DK5077AS", "DK5241AN", "DK5347BM", "DK5679BL", "DK5830AK", "DK6067AM", "DK6153AS", "DK6154AS", "DK6875BF", "DK7370AL", "DK7485BK", "DK8077BD", "DK8741BG", "DK9046AT", "DK9181BB", "DK9361BB", "DK9619BB", "DK9649BG", "DK9723BG", "DK9839BK", "TH4207D"];

/** Les véhicules de SEDIMA Abattoirs couverts en 2026 (22 plaques). */
const ABATTOIRS: string[] = ["AA013AT", "AA018EA", "AA019EA", "AA021EA", "AA093VA", "AA119AH", "AA180CQ", "AA186CQ", "AA200EA", "AA214XK", "AA318AM", "AA359AH", "AA565GA", "AA568GA", "AA737ZW", "DK1319BL", "DK1320BL", "DK4424BF", "DK4517BF", "DK4922BB", "DK5680BL", "DK7620BG"];

const COUVERTS = new Set([...SA, ...ABATTOIRS]);

/** Vrai quand la police 2026 couvre cette immatriculation (normalisée). */
export function assureEn2026(immatriculation: string): boolean {
  return COUVERTS.has(immatriculation);
}

/** Le nombre de véhicules couverts, pour les bancs et les notes. */
export const NOMBRE_ASSURES = COUVERTS.size;
