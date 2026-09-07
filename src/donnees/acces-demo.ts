import { PERIMETRE_ENTIER, type AccesUtilisateur } from "@/domaine/acces";

/* ============================================================================
 * Les accès de démonstration : une personne par profil, plus deux cas qui
 * montrent ce que la fiche permet — un agent borné à son site avec un écart
 * en attente d'approbation, et un détenteur lié à un chauffeur.
 * ==========================================================================*/

const cree = "2026-09-01T08:00:00.000Z";

export const ACCES_DEMO: AccesUtilisateur[] = [
  { id: "u-admin", prenom: "Compte", nom: "Administrateur", courriel: "admin@sedima.test", telephone: null, fonction: "Administration de l'application", matricule: null, actif: true, profil: "administrateur", perimetre: PERIMETRE_ENTIER, modules: {}, sanctions: null, ecartsApprouves: true, approuvePar: null, chauffeurId: null, attributaireId: null, creeLe: cree, modifieLe: null },
  { id: "u-mseck", prenom: "Mamadou", nom: "Seck", courriel: "parc@sedima.test", telephone: null, fonction: "Directeur des opérations, gestion du parc", matricule: null, actif: true, profil: "responsable", perimetre: PERIMETRE_ENTIER, modules: { parametres: "gestion" }, sanctions: null, ecartsApprouves: true, approuvePar: "u-admin", chauffeurId: null, attributaireId: null, creeLe: cree, modifieLe: null },
  { id: "u-abo", prenom: "Aly", nom: "Bo", courriel: "maintenance@sedima.test", telephone: null, fonction: "Responsable maintenance usine, camions vracs", matricule: null, actif: true, profil: "maintenance", perimetre: PERIMETRE_ENTIER, modules: {}, sanctions: null, ecartsApprouves: true, approuvePar: null, chauffeurId: null, attributaireId: null, creeLe: cree, modifieLe: null },
  {
    id: "u-thies",
    prenom: "Correspondant",
    nom: "Thiès",
    courriel: "site.thies@sedima.test",
    telephone: "76 637 36 79",
    fonction: "Correspondant parc, dépôt Thiès",
    matricule: null,
    actif: true,
    profil: "agent-terrain",
    perimetre: { sites: ["s-thies"], businessUnits: "toutes", regimes: ["exploitation"] },
    /* Un écart demandé et pas encore approuvé : il lit la maintenance de son site. */
    modules: { maintenance: "lecture" },
    sanctions: null,
    ecartsApprouves: false,
    approuvePar: null,
    chauffeurId: null,
    attributaireId: null,
    creeLe: cree,
    modifieLe: "2026-09-06T10:30:00.000Z",
  },
  { id: "u-carburant", prenom: "Responsable", nom: "Carburant", courriel: "carburant@sedima.test", telephone: null, fonction: "Cuve, bons de sortie, pleins", matricule: null, actif: true, profil: "agent-terrain", perimetre: { sites: ["s-km", "s-uab"], businessUnits: "toutes", regimes: "tous" }, modules: { releves: "gestion" }, sanctions: null, ecartsApprouves: true, approuvePar: "u-admin", chauffeurId: null, attributaireId: null, creeLe: cree, modifieLe: null },
  { id: "u-controle", prenom: "Contrôle", nom: "de gestion", courriel: "controle@sedima.test", telephone: null, fonction: "Contrôle de gestion", matricule: null, actif: true, profil: "lecteur", perimetre: PERIMETRE_ENTIER, modules: {}, sanctions: null, ecartsApprouves: true, approuvePar: null, chauffeurId: null, attributaireId: null, creeLe: cree, modifieLe: null },
  { id: "u-direction", prenom: "Direction", nom: "des Opérations", courriel: "direction@sedima.test", telephone: null, fonction: "Direction", matricule: null, actif: true, profil: "responsable", perimetre: PERIMETRE_ENTIER, modules: {}, sanctions: null, ecartsApprouves: true, approuvePar: null, chauffeurId: null, attributaireId: null, creeLe: cree, modifieLe: null },
  { id: "u-achats", prenom: "Service", nom: "Achats", courriel: "achats@sedima.test", telephone: null, fonction: "Achats", matricule: null, actif: true, profil: "lecteur", perimetre: PERIMETRE_ENTIER, modules: { transporteurs: "gestion" }, sanctions: null, ecartsApprouves: true, approuvePar: "u-admin", chauffeurId: null, attributaireId: null, creeLe: cree, modifieLe: null },
  { id: "u-gdiop", prenom: "Gora", nom: "Diop", courriel: "detenteur@sedima.test", telephone: "76 637 36 79", fonction: "Chauffeur, dépôt Thiès", matricule: "99940", actif: true, profil: "detenteur", perimetre: PERIMETRE_ENTIER, modules: {}, sanctions: null, ecartsApprouves: true, approuvePar: null, chauffeurId: "gora-diop", attributaireId: null, creeLe: cree, modifieLe: null },
];
