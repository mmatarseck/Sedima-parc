/* ============================================================================
 * Parc léger — données de démonstration, relevées dans le dossier de la
 * Direction des Opérations (7 septembre 2026) :
 *
 *   * « PARC LEGERS AFFECTATION 2026.xlsx » (Données Finance, mai 2026) — les
 *     64 véhicules légers, la feuille CAR-PLAN (10), MOTO (7), ALMADIE (7) ;
 *   * « Plan d'affectation des véhicules légers vf.xlsx » (10 août 2026) — la
 *     cascade des 20 véhicules neufs (lot 1 reçu, lot 2 à commander), les
 *     réaffectations, les réformes et les attributions cibles.
 *
 * Quand les deux sources divergent, le plan d'août fait foi : c'est la cible
 * arrêtée. Les immatriculations sont canonisées ; « lot-2-07 » tient lieu
 * d'identifiant tant qu'un véhicule à commander n'est pas immatriculé.
 * ==========================================================================*/

import { afficher, normaliser } from "@/domaine/immatriculation";
import { idAttributaire, type Attributaire, type EtatLeger, type ForfaitCarburant, type RegimeUsage, type VehiculeLeger } from "@/domaine/parc-leger";
import type { BusinessUnit } from "@/domaine/types";

type Categorie = VehiculeLeger["categorie"];

/** [immat ou identifiant, marque, modèle, année, km, catégorie, régime, état, attributaire, fonction, département, BU, lot, commentaire] */
type Brut = [string, string, string, number | null, number | null, Categorie, RegimeUsage, EtatLeger, string | null, string | null, string | null, BusinessUnit | null, string | null, string | null];

const BRUT: Brut[] = [
  /* -- Lot 1 : cinq véhicules neufs, commandés et réceptionnés (août 2026) -- */
  ["AB489JY", "Mitsubishi", "L200 Confort DC BA", 2026, null, "camionnette", "fonction", "actif", "Assane Gueye", "Directeur général adjoint", "Direction Générale", "siege", "Lot 1 - 01", "Neuf. Libère AB792JA pour Abdoulaye Soumboundou"],
  ["AB282JT", "Mitsubishi", "L200 Confort DC BA", 2026, null, "camionnette", "fonction", "actif", "Thierry Goudiaby", "Directeur Abattoir", "Abattoir", "abattoir", "Lot 1 - 02", "Neuf. Libère AB795JA pour Macodou Gassama — réalisé"],
  ["AB900JW", "Toyota", "Hilux DC", 2026, null, "camionnette", "service", "actif", "Pape Makhtar Diack", "Commercial Farine, Zone Ouest-Centre", "Commercial", "commercial", "Lot 1 - 03", "Neuf. Remplace DK2346BD, à réformer"],
  ["AB903JW", "Toyota", "Hilux DC", 2026, null, "camionnette", "service", "actif", "Adji Néné Boye", "Commerciale Farine, Dakar", "Commercial", "commercial", "Lot 1 - 04", "Neuf. Sans véhicule depuis son recrutement"],
  ["AB907JW", "Toyota", "Hilux DC", 2026, null, "camionnette", "service", "actif", "Arfand Bakary Coly", "Commercial, Zone Thiès et périphéries", "Commercial", "commercial", "Lot 1 - 05", "Neuf. Libère AA389JG pour Ibrahima Camara"],

  /* -- Lot 2 : quinze véhicules neufs (La Sénégalaise de l'Automobile, 19,94 M F l'unité). Dix reçus et
     assurés le 19 août 2026, affectés par le métier le 7 septembre 2026 dans l'ordre des lignes du lot ;
     Maimouna Gaye garde le L200 ; les postes à recruter d'ici la fin de l'année attendent. -- */
  ["AB565KP", "Mitsubishi", "L200 DC", 2026, null, "camionnette", "service", "actif", "Aly Gaye", "Technicien intégration, Pôle Intégrés", "Commercial", "commercial", "Lot 2 - 01", "Remplace DK1307BB, à réformer"],
  ["AB609KP", "Mitsubishi", "L200 DC", 2026, null, "camionnette", "service", "actif", "Bakary Sow", "Commercial Farine, Zone Sud", "Commercial", "commercial", "Lot 2 - 02", "Remplace AB078JS, à réformer"],
  ["AB611KP", "Mitsubishi", "L200 DC", 2026, null, "camionnette", "service", "actif", "Bineta Djiba", "Commerciale axe Kaolack-Ziguinchor", "Commercial", "commercial", "Lot 2 - 03", "Libère AA022EA pour Mourtalla Thiaw"],
  ["AB612KP", "Mitsubishi", "L200 DC", 2026, null, "camionnette", "service", "actif", "Yacine Siby", "Responsable Dépôts", "Logistique", "siege", "Lot 2 - 04", "Sans véhicule"],
  ["AB614KP", "Mitsubishi", "L200 DC", 2026, null, "camionnette", "fonction", "actif", "Maimouna Gaye", "Responsable Pôle Farine & Bétail", "Commercial", "commercial", "Lot 2 - 05", "Remplace DK5679BL, à réformer"],
  ["lot-2-06", "Mitsubishi", "L200 DC", null, null, "camionnette", "service", "a-recevoir", "Amacodou Ndiaye", "Commercial Ziguinchor, navette Kédougou-Tamba-Matam", "Commercial", "commercial", "Lot 2 - 06", "Libère AA119AH pour le futur Responsable Logistique"],
  ["lot-2-07", "Mitsubishi", "L200 DC", null, null, "camionnette", "fonction", "a-recevoir", "Amadou Yoro Ba", "Responsable Pôle Aviculture", "Commercial", "commercial", "Lot 2 - 07", "Libère AA397JG pour Alioune Diop"],
  ["AB615KP", "Mitsubishi", "L200 DC", 2026, null, "camionnette", "service", "actif", "Moustapha Mboup", "Commercial axe Diourbel-Linguère", "Commercial", "commercial", "Lot 2 - 08", "Libère AA023EA pour Alla Faye"],
  ["lot-2-09", "Mitsubishi", "L200 DC", null, null, "camionnette", "service", "a-recevoir", "Pape Bouba Gaye", "Commercial Dakar et banlieue", "Commercial", "commercial", "Lot 2 - 09", "Libère AA131EX pour le transport de poussins"],
  ["AB616KP", "Mitsubishi", "L200 DC", 2026, null, "camionnette", "fonction", "actif", "Dr Babacar Soumaré", "Responsable Pôle SATV", "SATV", "commercial", "Lot 2 - 10", "Libère AA386JG pour Mamadou Gueye"],
  ["lot-2-11", "Mitsubishi", "L200 DC", null, null, "camionnette", "service", "a-recevoir", null, "Commercial Sud 2 — recrutement au 1er octobre 2026", "Commercial", "commercial", "Lot 2 - 11", "Poste en cours de recrutement"],
  ["AB617KP", "Mitsubishi", "L200 DC", 2026, null, "camionnette", "service", "actif", "Adama Wane", "Responsable Couvoir", "DTPA", "couvoir", "Lot 2 - 12", "Libère AA019EA pour Khady Mbaye, après réparation"],
  ["lot-2-13", "Mitsubishi", "L200 DC", null, null, "camionnette", "service", "a-recevoir", null, "Commercial Zone Nord 2 — recrutement au 1er octobre 2026", "Commercial", "commercial", "Lot 2 - 13", "Poste en cours de recrutement"],
  ["AB619KP", "Mitsubishi", "L200 DC", 2026, null, "camionnette", "service", "actif", "Papa Samba Mbengue", "Responsable Maintenance Fermes et Couvoir", "DT", "fermes", "Lot 2 - 14", "Nouvelle recrue"],
  ["AB622KP", "Mitsubishi", "L200 DC", 2026, null, "camionnette", "service", "actif", "Cheikhou Keïta", "Responsable Maintenance Abattoir", "DT", "abattoir", "Lot 2 - 15", "Libère DK1306BB pour Ibrahima Faye"],

  /* -- Véhicules libérés et redéployés par la cascade -- */
  ["AB792JA", "Toyota", "Hilux BA", 2020, 90_000, "camionnette", "fonction", "actif", "Abdoulaye Soumboundou", "Directeur DTPA", "DO", "fermes", "Lot 1 - 01", "Ancien véhicule d'Assane Gueye — défauts tableau de bord, à réparer"],
  ["AB571HZ", "Toyota", "Hilux", 2019, null, "camionnette", "service", "actif", "Aly Bo", "Responsable Maintenance Usine, camions vracs, astreintes", "DT", "aliment", "Lot 1 - 01", "Ancien véhicule d'Abdoulaye Soumboundou"],
  ["AB795JA", "Toyota", "Hilux BA", 2019, null, "camionnette", "service", "actif", "Macodou Gassama", "Coordonnateur Sécurité", "DCH", "siege", "Lot 1 - 02", "Ancien véhicule de Thierry Goudiaby — attribution réalisée"],
  ["AA873QG", "Mitsubishi", "L200 essence", 2023, null, "camionnette", "service", "pool", null, null, "DACI · DSI · Contrôle de gestion", "siege", "Lot 1 - 02", "Véhicule de liaison versé au pool"],
  ["AA389JG", "Mitsubishi", "L200 DC", 2022, 125_000, "camionnette", "service", "actif", "Ibrahima Camara", "Commercial Zone Nord 1", "Commercial", "commercial", "Lot 1 - 05", "Ancien véhicule d'Arfand Bakary Coly"],
  ["AA022EA", "Mitsubishi", "L200 DC", 2021, 192_624, "camionnette", "service", "actif", "Mourtalla Thiaw", "Assistance technique clients, Pôle SATV", "SATV", "commercial", "Lot 2 - 03", "Ancien véhicule de Bineta Djiba"],
  ["AA119AH", "Mitsubishi", "L200 DC", 2019, 182_755, "camionnette", "service", "panne", null, "Responsable Logistique — recrutement au 1er octobre 2026", "DO", "siege", "Lot 2 - 06", "Remise à niveau, cible fin septembre 2026"],
  ["AA397JG", "Mitsubishi", "L200", 2022, 137_000, "camionnette", "service", "actif", "Alioune Diop", "Commercial, Mbour et périphéries", "Commercial", "commercial", "Lot 2 - 07", "Ancien véhicule d'Amadou Yoro Ba"],
  ["AA562EE", "Mitsubishi", "L200 simple cabine", 2019, 151_000, "camionnette", "exploitation", "actif", null, null, "UAB · Minoterie", "aliment", "Lot 2 - 07", "Versé à la livraison farine et aliments"],
  ["AA023EA", "Mitsubishi", "L200", 2021, 163_959, "camionnette", "service", "actif", "Alla Faye", "Commercial Touba, zone Centre", "Commercial", "commercial", "Lot 2 - 08", "Ancien véhicule de Moustapha Mboup"],
  ["AA131EX", "Mitsubishi", "L200 simple cabine", 2021, 151_000, "camionnette", "exploitation", "actif", null, null, "Transport de poussins", "couvoir", "Lot 2 - 09", "À équiper pour le transport de poussins"],
  ["AA386JG", "Mitsubishi", "L200", 2022, 160_000, "camionnette", "service", "actif", "Mamadou Gueye", "Assistance technique clients, Pôle SATV", "SATV", "commercial", "Lot 2 - 10", "Ancien véhicule du Dr Babacar Soumaré"],
  ["AA019EA", "Citroën", "Berlingo", 2021, 99_744, "vehicule-leger", "service", "panne", "Khady Mbaye", "Responsable Labo — transfert de vaccins et prélèvements", "DTPA", "fermes", "Lot 2 - 12", "Réparation, cible fin septembre 2026"],
  ["DK1306BB", "Mitsubishi", "L200", 2016, 237_013, "camionnette", "service", "actif", "Ibrahima Faye", "Équipe mobile maintenance", "DT", "aliment", "Lot 2 - 15", "Ancien véhicule de Cheikhou Keïta"],

  /* -- Véhicules conservés (commerciaux, liaisons, pools) -- */
  ["AA769PA", "Mitsubishi", "L200", 2023, 89_129, "camionnette", "service", "actif", "Idrissa Ndiaye", "Commercial zone Nord, farine", "Commercial", "commercial", null, "Conservé"],
  ["AA390JG", "Citroën", "C-Elysée", 2022, 55_300, "vehicule-leger", "service", "actif", "Modou Fall", "Commercial Dakar Abattoirs", "Abattoir · Commercial", "abattoir", null, "Conservé"],
  ["AA392JG", "Citroën", "C-Elysée", 2022, 70_000, "vehicule-leger", "service", "actif", "Souleymane Diallo", "Commercial Abattoirs", "Abattoir · Commercial", "abattoir", null, "Conservé"],
  ["AA403JG", "Citroën", "C-Elysée", 2022, 86_000, "vehicule-leger", "service", "actif", "Djibril Ndiaye", "Commercial Abattoirs", "Abattoir · Commercial", "abattoir", null, "Conservé"],
  ["AA021EA", "Citroën", "C-Elysée", 2021, 116_076, "vehicule-leger", "service", "actif", "Moukhtar Sall", "Commercial Thiès Abattoirs", "Abattoir · Commercial", "abattoir", null, "Conservé"],
  ["DK9046AT", "Mitsubishi", "ASX", 2014, 168_561, "vehicule-leger", "service", "actif", "Fallou Gueye", "Commercial Abattoirs", "Abattoir · Commercial", "abattoir", null, "Conservé"],
  ["AA200EA", "Citroën", "Berlingo", 2021, null, "vehicule-leger", "service", "actif", "Mansour Seck", "Liaison Abattoirs, chauffeur", "Abattoir", "abattoir", null, "Conservé"],
  ["AA758QF", "Mitsubishi", "L200", 2023, null, "camionnette", "service", "pool", null, null, "Qualité · Achats · Contrôle de gestion", "siege", null, "Pool, pour missions"],
  ["AA550JD", "Toyota", "Corolla Cross", null, null, "vehicule-leger", "service", "pool", null, null, "Commercial · Invités", "siege", null, "Ancien véhicule de Mouhamadou Ndoye, prêté à Khady Diouf"],
  ["AA324JE", "Ford", "Ecosport", 2022, null, "vehicule-leger", "service", "pool", "Amy Collé Guèye", null, "DO", "siege", null, "Non adapté pour les fermes, à réaffecter"],
  ["DK4517BF", "Citroën", "C-Elysée", null, null, "vehicule-leger", "service", "pool", null, null, "Commercial", "commercial", null, "Non affecté"],
  ["AA735MY", "Mitsubishi", "L200 DID", null, null, "camionnette", "service", "actif", "Doudou Sarr", "Juridique", "Juridique", "siege", null, null],
  ["AA856FG", "Mitsubishi", "L200", null, null, "camionnette", "service", "pool", null, null, "Siège", "siege", null, "Pool"],
  ["AA966AD", "Renault", "Oroch", null, null, "camionnette", "service", "pool", null, null, "Siège", "siege", null, "Pool"],
  ["AB741AP", "Kia", "Sorento", null, null, "vehicule-leger", "service", "pool", null, null, "Siège", "siege", null, "Pool"],
  ["DK3454BD", "Hyundai", "Santa Fe 2.5", null, null, "vehicule-leger", "service", "pool", null, null, "Siège", "siege", null, "Pool"],
  ["DK4424BF", "Citroën", "C-Elysée", null, null, "vehicule-leger", "service", "actif", "Mamadou Mbaye", "Courriers", "Siège", "siege", null, null],
  ["DK6154AS", "Citroën", "C3 Aircross", null, null, "vehicule-leger", "service", "actif", null, null, "DACI", "siege", null, "Véhicule DACI"],
  ["DK7485BK", "Peugeot", "5008", null, null, "vehicule-leger", "service", "pool", null, null, "Siège", "siege", null, "Non affecté"],
  ["DK6067AM", "Toyota", "Hilux", null, null, "camionnette", "service", "actif", "Omar Sarr", null, "Siège", "siege", null, null],
  ["AA489BH", "Mitsubishi", "L200", null, null, "camionnette", "service", "actif", "Khaly Sarr", "Maintenance", "Maintenance", "aliment", null, null],
  ["AA484BH", "Mitsubishi", "L200", null, null, "camionnette", "service", "actif", null, "Sécurité", "Maintenance", "aliment", null, "Véhicule de la sécurité"],
  ["DK5347BM", "Ford", "Ecosport", null, null, "vehicule-leger", "service", "actif", "Abdou Aziz Ba", "Responsable QHSE Fermes et Couvoirs", "QHSE", "fermes", null, null],
  ["DK1870BG", "Hyundai", "Creta", null, null, "vehicule-leger", "service", "actif", "Fatou Thiam Dioum", "QHSE Abattoirs", "Abattoir", "abattoir", null, null],
  ["DK5680BL", "Citroën", "C-Elysée", null, null, "vehicule-leger", "service", "actif", "Pauline Faye Ndiaye", "Responsable Teral Shop", "Commercial", "commercial", null, null],
  ["DK4740BH", "Hyundai", "Sonata", null, null, "vehicule-leger", "fonction", "actif", "Papa Thipidon Ndao", "Responsable Marketing", "Marketing", "siege", null, null],
  ["DK2348BD", "Mitsubishi", "L200 DID", null, null, "camionnette", "service", "actif", null, "Commercial Farine Kaolack", "Commercial", "commercial", null, "Tenu par Bakary Sow selon l'inventaire de mai"],

  /* -- Sécurité et liaisons -- */
  ["DK5077AS", "Kia", "Station wagon", null, null, "vehicule-leger", "service", "actif", "Faye", "Chef Sécurité", "Sécurité", "siege", null, null],
  ["DK5830AK", "Citroën", "Berlingo", null, null, "vehicule-leger", "service", "actif", "Boubacar Baldé", "Sécurité", "Sécurité", "siege", null, null],
  ["DK5241AN", "Toyota", "Pick-up", null, null, "camionnette", "service", "actif", "Moussa Dia", "Sécurité", "Sécurité", "siege", null, null],
  ["DK3033BD", "Mitsubishi", "L200 DID", null, null, "camionnette", "service", "actif", null, "Sécurité", "Sécurité", "siege", null, null],

  /* -- Véhicules de fonction de la direction -- */
  ["AA099DZ", "Hyundai", "Santa Fe 2.5", null, null, "vehicule-leger", "fonction", "actif", "Adji Kanouté", "Conseillère du Directeur général", "Direction Générale", "siege", null, null],
  ["AA963JM", "Kia", "Sorento", null, null, "vehicule-leger", "fonction", "actif", "Mme Guèye", "CV", "Siège", "siege", null, null],
  ["AA485DR", "Mercedes", "GLE", null, null, "vehicule-leger", "fonction", "actif", "Mme Ndiaye", "Directrice", "Direction", "siege", null, null],
  ["DK9723BD", "Hyundai", "Santa Fe 2.5", null, null, "vehicule-leger", "fonction", "actif", "Mamadou Faye", "Karaouni", "Siège", "siege", null, null],
  ["DK9649BG", "Kia", "Sorento", null, null, "vehicule-leger", "fonction", "actif", "Mme Samb", "Responsable RH", "RH", "siege", null, null],
  ["AB543GA", "Hyundai", "Santa Fe", null, null, "vehicule-leger", "fonction", "actif", "Latyr Diop", "Responsable Contrôle de gestion", "Contrôle de gestion", "siege", null, null],
  ["AB716FK", "Hyundai", "Santa Fe", null, null, "vehicule-leger", "fonction", "actif", "M. Diongue", "Directeur Informatique", "DSI", "siege", null, null],
  ["AB930BB", "Hyundai", "Santa Fe", null, null, "vehicule-leger", "fonction", "actif", "Matar Seck", "Directeur des Opérations", "DO", "siege", null, null],
  ["AB592HD", "Hyundai", "Santa Fe", null, null, "vehicule-leger", "fonction", "actif", "Innocence Lopy Diedhiou", "Directrice Marketing", "Marketing", "siege", null, null],
  ["AB563HD", "Jeep", "Cherokee", null, null, "vehicule-leger", "fonction", "actif", "M. Mbaye", "Chargé de missions", "Direction", "siege", null, null],
  ["AA544JD", "Toyota", "Corolla Cross", null, null, "vehicule-leger", "fonction", "actif", "Mme Cissé", "RH", "RH", "siege", null, null],
  ["DK8077BD", "Hyundai", "Santa Fe", null, null, "vehicule-leger", "fonction", "actif", "Bocar Mbaye", "Responsable Parc", "DO", "siege", null, null],
  ["AA266JC", "Suzuki", "Vitara", null, null, "vehicule-leger", "fonction", "actif", "Issakha Diouf", "Responsable Pôle Achats, Transit, Stocks", "Supply chain", "siege", null, null],

  /* -- Plan car (feuille CAR-PLAN) : dix véhicules, attributaires nommés -- */
  ["AA135JC", "Suzuki", "Vitara", null, null, "vehicule-leger", "fonction", "actif", "Khady Ndiaye", null, null, "siege", null, "Plan car"],
  ["AA128JC", "Suzuki", "Vitara", null, null, "vehicule-leger", "fonction", "actif", "El Hadj Abdoulaye Ngom", null, null, "siege", null, "Plan car"],
  ["AA129JC", "Suzuki", "Vitara", null, null, "vehicule-leger", "fonction", "actif", "Marième Guèye", "Responsable DACI · IT · Contrôle de gestion", "DACI", "siege", null, "Plan car"],
  ["AA270JF", "Suzuki", "Vitara", null, null, "vehicule-leger", "fonction", "actif", "Maguette Ndoye", "Qualité · Achats · Contrôle de gestion", "Siège", "siege", null, "Plan car"],
  ["AA541JD", "Toyota", "Corolla Cross", null, null, "vehicule-leger", "fonction", "actif", "Alassane Ndiaye", null, null, "siege", null, "Plan car"],
  ["AA189JM", "Toyota", "Corolla Cross", null, null, "vehicule-leger", "fonction", "actif", "Ndèye Yacine Diop", null, null, "siege", null, "Plan car"],
  ["AA547JD", "Toyota", "Corolla Cross", null, null, "vehicule-leger", "fonction", "actif", "Malick Logbo", null, null, "siege", null, "Plan car"],
  ["AA554JD", "Toyota", "Corolla Cross", null, null, "vehicule-leger", "fonction", "actif", "Babacar Ba", null, null, "siege", null, "Plan car"],
  ["AA278JE", "BAIC", "BAIC", null, null, "vehicule-leger", "fonction", "actif", "Khady Fall Diouf", null, null, "siege", null, "Plan car"],
  ["AA764PA", "Mitsubishi", "L200", 2023, null, "camionnette", "fonction", "actif", "Awa Mbodj", "Responsable Intégrés", "Commercial", "commercial", null, "Plan car — conservé"],

  /* -- Almadies : les véhicules tenus à la résidence -- */
  ["DK0082BD", "Lexus", "Lexus", null, null, "vehicule-leger", "fonction", "actif", "Mme Ngom", null, "Présidence — Almadies", "siege", null, null],
  ["DK9181BB", "Chrysler", "Chrysler", null, null, "vehicule-leger", "fonction", "actif", "Mouhamed Ngom", null, "Présidence — Almadies", "siege", null, null],
  ["AA139HP", "Range Rover", "Range Rover", null, null, "vehicule-leger", "fonction", "actif", "Mme Diack", null, "Présidence — Almadies", "siege", null, null],
  ["AA214JC", "BAIC", "BAIC", null, null, "vehicule-leger", "fonction", "actif", "Mme Diack", null, "Présidence — Almadies", "siege", null, null],
  ["AA966JM", "Kia", "Sorento", null, null, "vehicule-leger", "fonction", "actif", "Mme Diack", null, "Présidence — Almadies", "siege", null, null],
  ["AA320JF", "Suzuki", "Vitara", null, null, "vehicule-leger", "fonction", "actif", "Président", null, "Présidence — Almadies", "siege", null, null],
  ["AA556JD", "Toyota", "Corolla", null, null, "vehicule-leger", "fonction", "pool", null, null, "Présidence — Almadies", "siege", null, null],

  /* -- Bus du personnel -- */
  ["AA296PT", "Toyota", "Hiace", null, null, "bus", "service", "actif", null, null, "Bus Usine", "aliment", null, "Bus du personnel de l'usine"],
  ["AA077FP", "Tata", "Airforce", null, null, "bus", "service", "actif", null, null, "Bus Notto", "couvoir", null, "Bus du personnel de Notto"],
  ["AA106NE", "Toyota", "Coaster", null, null, "bus", "service", "actif", null, null, "Bus personnel, siège", "siege", null, "Bus du personnel du siège"],

  /* -- Motos -- */
  ["DK1319BL", "Suzuki", "Moto", null, null, "moto", "service", "pool", null, null, "Keur Massar", "aliment", null, "Non affectée"],
  ["AA308DT", "Suzuki", "Moto", null, null, "moto", "service", "pool", null, null, "Keur Massar", "aliment", null, "Non affectée"],
  ["AA518EK", "Suzuki", "Moto", null, null, "moto", "service", "pool", null, null, "Keur Massar", "aliment", null, "Non affectée"],
  ["DK1320BL", "Suzuki", "Moto", null, null, "moto", "service", "pool", null, null, "Keur Massar", "aliment", null, "Non affectée"],
  ["AA272YJ", "Suzuki", "Moto", null, null, "moto", "service", "actif", "Babacar", null, "Teral Shop", "commercial", null, null],
  ["AA877YM", "Suzuki", "Moto", null, null, "moto", "service", "actif", "Mapenda Thiam", null, "Abattoirs", "abattoir", null, null],
  ["AA923YM", "Suzuki", "Moto", null, null, "moto", "service", "actif", "Mbaye Sarr", null, "Ndiakhirat", "fermes", null, null],

  /* -- En panne, à réformer : sortie de parc décidée ou proposée -- */
  ["DK2346BD", "Mitsubishi", "L200 DC", 2017, 231_354, "camionnette", "service", "a-reformer", null, null, "Commercial", "commercial", "Lot 1 - 03", "Pannes répétitives — ancien véhicule de Pape Makhtar Diack"],
  ["DK1307BB", "Mitsubishi", "L200", 2016, 257_838, "camionnette", "service", "a-reformer", null, null, "Commercial", "commercial", "Lot 2 - 01", "Pannes récurrentes — ancien véhicule d'Aly Gaye"],
  ["AB078JS", "Mitsubishi", "L200 DC", 2017, 322_134, "camionnette", "service", "a-reformer", null, null, "Commercial", "commercial", "Lot 2 - 02", "Pannes fréquentes — ancien véhicule de Bakary Sow"],
  ["DK5679BL", "Citroën", "C-Elysée", 2019, 165_456, "vehicule-leger", "fonction", "a-reformer", null, null, "Commercial", "commercial", "Lot 2 - 05", "Accident 2023, pannes répétitives — ancien véhicule de Maimouna Gaye"],
  ["DK4922BB", "Renault", "Duster", 2016, null, "vehicule-leger", "service", "a-reformer", null, null, "Notto", "couvoir", null, "Hors service — ancien véhicule de Paul Birame Sène"],
  ["DK2347BD", "Mitsubishi", "L200", 2017, null, "camionnette", "service", "a-reformer", null, null, "Keur Massar", "aliment", null, "Hors service — moteur à changer, immobilisé à Thiès"],
  ["DK3032BD", "Mitsubishi", "L200", 2017, null, "camionnette", "service", "a-reformer", null, null, "Keur Massar", "aliment", null, "Hors service — panne moteur et organes"],
  ["DK4942AK", "Mitsubishi", "L200 GL", 2010, null, "camionnette", "service", "a-reformer", null, null, "Sécurité", "siege", null, "Panne moteur, organes et carrosserie — équipe Sécurité"],
  ["DK6153AS", "Citroën", "C3 Aircross", null, null, "vehicule-leger", "service", "panne", null, null, "Siège", "siege", null, "Changement moteur, tôlerie, peinture — délai estimé deux semaines"],
  ["DK7370AL", "Kia", "Kia", null, null, "vehicule-leger", "service", "panne", null, null, "Garage", "siege", null, "En panne, au garage"],
  ["AA301PT", "Toyota", "Toyota", null, null, "vehicule-leger", "service", "panne", null, null, "Keur Massar", "aliment", null, "En panne"],
];

const PLAN_CAR = new Set(["AA135JC", "AA128JC", "AA129JC", "AA270JF", "AA541JD", "AA189JM", "AA547JD", "AA554JD", "AA278JE", "AA764PA"]);

let CACHE: { vehicules: VehiculeLeger[]; attributaires: Attributaire[]; forfaits: ForfaitCarburant[] } | null = null;

function construire() {
  if (CACHE) return CACHE;
  const attributaires = new Map<string, Attributaire>();
  const vehicules: VehiculeLeger[] = BRUT.map(([brut, marque, modele, annee, kilometrage, categorie, regime, etat, nom, fonction, departement, businessUnit, lot, commentaire]) => {
    const immatricule = !brut.startsWith("lot-");
    const canonique = immatricule ? normaliser(brut) : brut;
    let attributaireId: string | null = null;
    if (nom) {
      attributaireId = idAttributaire(nom);
      const existant = attributaires.get(attributaireId);
      if (!existant) attributaires.set(attributaireId, { id: attributaireId, nom, fonction, departement, businessUnit });
      else if (!existant.fonction && fonction) attributaires.set(attributaireId, { ...existant, fonction, departement: existant.departement ?? departement });
    }
    return {
      id: canonique,
      immatriculation: immatricule ? canonique : null,
      immatriculationAffichee: immatricule ? afficher(canonique) : `${lot} — à immatriculer`,
      marque,
      modele,
      annee,
      kilometrage,
      categorie,
      regime,
      etat,
      attributaireId,
      pool: nom ? null : (departement ?? null),
      departement,
      businessUnit,
      planCar: PLAN_CAR.has(canonique) ? { dureeMois: null, debut: null, statut: "en-cours" } : null,
      lot,
      commentaire,
    };
  });
  /* Le forfait carburant suit la personne qui tient un véhicule de fonction en
     circulation ; son montant suit le paramètre tant que la carte ne dit pas autre chose. */
  const forfaits: ForfaitCarburant[] = vehicules
    .filter((v) => v.regime === "fonction" && v.attributaireId && (v.etat === "actif" || v.etat === "a-recevoir"))
    .map((v) => ({ attributaireId: v.attributaireId!, montantMensuel: null, carte: null }))
    .filter((f, i, liste) => liste.findIndex((x) => x.attributaireId === f.attributaireId) === i);
  CACHE = { vehicules, attributaires: [...attributaires.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr")), forfaits };
  return CACHE;
}

/** Tous les véhicules légers, dans l'ordre du dossier. */
export function vehiculesLegers(): VehiculeLeger[] {
  return construire().vehicules;
}

export function attributaires(): Attributaire[] {
  return construire().attributaires;
}

export function attributairePour(id: string | null): Attributaire | null {
  return id ? (construire().attributaires.find((a) => a.id === id) ?? null) : null;
}

/** Les forfaits carburant mensuels des attributaires de véhicules de fonction. */
export function forfaitsCarburant(): ForfaitCarburant[] {
  return construire().forfaits;
}

/** Premier mois où les forfaits carburant sont portés en charge dans la démonstration. */
export const DEBUT_FORFAITS = "2025-01";

/** Un forfait carburant du mois, sous la forme d'une dépense : c'est ainsi que le budget et les coûts le lisent. */
export interface DepenseForfait {
  numero: string;
  date: string;
  mois: string;
  poste: "carburant";
  libelle: string;
  montant: number;
  beneficiaire: string;
  origine: "facture";
  justificatif: boolean;
  businessUnit: BusinessUnit | null;
  vehiculeId: string;
  immatriculation: string;
  immatriculationAffichee: string;
  vehicule: string;
}

let CACHE_FORFAITS: DepenseForfait[] | null = null;

/**
 * Les forfaits carburant mois par mois, depuis `DEBUT_FORFAITS` jusqu'au mois
 * de référence : une dépense de carburant par véhicule de fonction en
 * circulation et par mois, sur la BU de l'agent, sans plein ni kilométrage.
 * Une seule fabrique, lue par le budget et par les coûts — la même somme
 * des deux côtés.
 */
export function depensesForfaits(jusqua: string, forfaitDefaut: number): DepenseForfait[] {
  if (CACHE_FORFAITS) return CACHE_FORFAITS;
  const { vehicules, attributaires: liste, forfaits } = construire();
  const parAttributaire = new Map(liste.map((a) => [a.id, a]));
  const montantPar = new Map(forfaits.map((f) => [f.attributaireId, f.montantMensuel ?? forfaitDefaut]));
  const mois: string[] = [];
  for (let m = DEBUT_FORFAITS; m <= jusqua.slice(0, 7); ) {
    mois.push(m);
    const [a, mm] = m.split("-").map(Number);
    m = new Date(Date.UTC(a!, mm!, 1)).toISOString().slice(0, 7);
  }
  CACHE_FORFAITS = vehicules
    .filter((v) => v.immatriculation !== null && v.attributaireId !== null && montantPar.has(v.attributaireId))
    .flatMap((v) => {
      const a = parAttributaire.get(v.attributaireId!)!;
      const montant = montantPar.get(a.id)!;
      return mois.map((m) => ({
        numero: `FOR-${m.replace("-", "")}-${v.immatriculation}`,
        date: `${m}-01`,
        mois: m,
        poste: "carburant" as const,
        libelle: `Forfait carburant — ${a.nom}`,
        montant,
        beneficiaire: a.nom,
        origine: "facture" as const,
        justificatif: true,
        businessUnit: v.businessUnit,
        vehiculeId: v.id,
        immatriculation: v.immatriculation!,
        immatriculationAffichee: v.immatriculationAffichee,
        vehicule: `${v.marque} ${v.modele}`,
      }));
    });
  return CACHE_FORFAITS;
}
