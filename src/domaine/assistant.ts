/* ============================================================================
 * L'assistant du parc — poser une question, obtenir un chiffre.
 *
 * Demande du métier du 4 septembre 2026 : « un module IA accessible de partout
 * pour poser des questions sur la flotte ». Tranché la même session :
 * **démonstration locale, couturée pour brancher**. L'assistant livré
 * interprète la question et va chercher la réponse dans les données du parc par
 * des règles — sans clé, sans appel réseau, hors ligne. L'interface et le
 * contrat d'appel sont ceux de la version finale : brancher l'API Claude
 * derrière ne touchera qu'un fichier.
 *
 * **La règle qui tient tout** : une réponse est un **chiffre et sa source**,
 * jamais une phrase seule. Un assistant qui affirme sans montrer d'où il tient
 * son chiffre n'est pas utilisable dans une réunion de parc — on ne peut ni le
 * vérifier, ni le citer. Chaque réponse porte donc :
 *  - une phrase qui répond à la question posée ;
 *  - les chiffres, nommés et unités comprises ;
 *  - éventuellement les lignes qui les composent ;
 *  - **et le lien vers l'écran qui fait foi**, où l'on retrouvera le même
 *    chiffre. Si les deux divergent un jour, c'est l'écran qui a raison, et
 *    l'assistant qui est en faute.
 *
 * Ce que l'assistant ne fait pas, et ne fera pas : décider, écrire, envoyer.
 * Il lit. Une transaction se crée dans un formulaire, avec son motif et sa
 * trace — pas dans une conversation.
 * ==========================================================================*/

import type { Ton } from "./libelles";

/* -- La demande ---------------------------------------------------------------- */

export interface Demande {
  question: string;
  /** L'écran d'où la question est posée : « /flotte/AA032EA ». Sert à comprendre « ce véhicule ». */
  origine?: string;
  /** La date du jour du jeu de données, pour que « ce mois-ci » veuille dire quelque chose. */
  aujourdhui: string;
}

/* -- La réponse ----------------------------------------------------------------- */

export interface ChiffreReponse {
  libelle: string;
  /** Déjà formaté — l'assistant sait mieux que l'écran ce que son chiffre veut dire. */
  valeur: string;
  precision?: string;
  ton?: Ton;
}

export interface LigneReponse {
  /** « AA 032 EA », « Moustapha Diaw ». */
  titre: string;
  precision?: string;
  /** La valeur qui motive la présence de la ligne : « 432 F/km ». */
  valeur?: string;
  ton?: Ton;
  href?: string;
}

export interface Source {
  libelle: string;
  href: string;
}

export interface Reponse {
  /** La phrase qui répond. Courte : le détail est dans les chiffres et les lignes. */
  texte: string;
  chiffres?: ChiffreReponse[];
  lignes?: LigneReponse[];
  /** L'écran qui fait foi — obligatoire dès qu'un chiffre est avancé. */
  sources: Source[];
  /** Ce qu'on peut demander ensuite, dans la foulée. */
  suites?: string[];
  /** Vrai quand l'assistant n'a pas compris : la vue le dit autrement. */
  incomprise?: boolean;
}

/* -- Le contrat ------------------------------------------------------------------ */

/**
 * Ce que l'écran appelle. Une seule méthode, asynchrone : la démonstration
 * répond dans l'instant, l'implémentation branchée sur l'API Claude mettra une
 * seconde ou deux, et l'écran n'aura pas à changer.
 *
 * L'implémentation à venir (`src/lib/assistant-claude.ts`) appellera une route
 * serveur qui interroge l'API Claude en lui donnant, comme outils de lecture,
 * les mêmes fonctions de domaine que la démonstration emploie ici — de sorte
 * que les deux répondent le même chiffre, et que la clé ne quitte pas le
 * serveur.
 */
export interface Assistant {
  repondre(demande: Demande): Promise<Reponse>;
}

/* -- Comprendre la question ------------------------------------------------------ */

/** Sans accents, sans ponctuation, en minuscules : la forme sur laquelle on compare. */
export function normaliserQuestion(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Une intention : ce que la question cherche à savoir. Les mots-clés sont des
 * **groupes** : il faut au moins un mot de chaque groupe pour que l'intention
 * soit retenue. « Combien de véhicules sont prêts » retient « prêt à charger »
 * parce qu'elle a un mot de {pret, disponible, charger} — et le score départage
 * quand plusieurs intentions répondent.
 */
export interface Intention {
  cle: string;
  /** Ce que l'intention sait dire, en une ligne — affiché dans l'aide. */
  libelle: string;
  /** Chaque groupe doit être touché au moins une fois. */
  groupes: string[][];
  /** Un exemple de question, proposé à l'utilisateur. */
  exemple: string;
  /** Départage deux intentions également touchées ; la plus précise gagne. */
  poids?: number;
}

/**
 * Le score d'une intention sur une question : 0 si un groupe n'est pas touché.
 *
 * Le rapprochement se fait sur des **mots entiers**, jamais sur des fragments :
 * chercher « da » dans la question ferait répondre les demandes d'achat à
 * « quelle est la météo à Dakar ». Seuls les mots-clés qui contiennent déjà un
 * espace — « ou en est », « pas de » — se cherchent comme une locution.
 */
export function scoreIntention(question: string, intention: Intention): number {
  const mots = new Set(question.split(" "));
  const contient = (cle: string) => (cle.includes(" ") ? question.includes(cle) : mots.has(cle));
  let score = 0;
  for (const groupe of intention.groupes) {
    const touche = groupe.filter(contient).length;
    if (touche === 0) return 0;
    score += touche;
  }
  return score + (intention.poids ?? 0);
}

/** L'intention la mieux touchée, ou nulle si la question ne dit rien de connu. */
export function reconnaitre(question: string, intentions: Intention[]): Intention | null {
  const normalisee = normaliserQuestion(question);
  let meilleure: Intention | null = null;
  let meilleurScore = 0;
  for (const i of intentions) {
    const s = scoreIntention(normalisee, i);
    if (s > meilleurScore) {
      meilleurScore = s;
      meilleure = i;
    }
  }
  return meilleure;
}

/* -- Le catalogue des intentions --------------------------------------------------
   Il vit dans le domaine, pas dans la vue : c'est lui qui dit ce que
   l'assistant sait faire, et l'aide de l'écran s'en déduit. */

export const INTENTIONS: Intention[] = [
  {
    cle: "parc-taille",
    libelle: "La taille du parc, et sa répartition",
    groupes: [["combien", "nombre", "taille", "compte"], ["vehicule", "vehicules", "camion", "camions", "parc", "flotte"]],
    exemple: "Combien de véhicules dans le parc ?",
  },
  {
    cle: "disponibilite",
    libelle: "Ce qui est prêt à charger aujourd'hui, et ce qui manque aux autres",
    groupes: [["pret", "prets", "disponible", "disponibles", "charger", "rouler", "roulent", "dispo"]],
    exemple: "Combien de véhicules sont prêts à charger ?",
    poids: 2,
  },
  {
    cle: "immobilises",
    libelle: "Les véhicules immobilisés, et pourquoi",
    groupes: [["immobilise", "immobilises", "immobilisation", "hors service", "en panne", "panne", "arret", "bloque", "bloques"]],
    exemple: "Quels véhicules sont immobilisés ?",
    poids: 2,
  },
  {
    cle: "conformite",
    libelle: "Les documents échus ou sur le point de l'être",
    groupes: [
      [
        "document", "documents", "assurance", "assurances", "visite", "visites", "echu", "echue", "echus", "echues",
        "echeance", "echeances", "conformite", "expire", "expirent", "expiration", "expirer", "renouveler",
        "renouvellement", "papier", "papiers", "carte grise",
      ],
    ],
    exemple: "Quels documents sont échus ou expirent bientôt ?",
    poids: 2,
  },
  {
    cle: "cout-total",
    libelle: "Ce que le parc coûte, et par quel poste",
    groupes: [["cout", "couts", "coute", "coutent", "depense", "depenses", "budget", "argent"], ["parc", "total", "flotte", "combien", "poste", "postes", "an", "annee", "mois"]],
    exemple: "Combien coûte le parc sur douze mois ?",
  },
  {
    cle: "cout-vehicule",
    libelle: "Les véhicules les plus coûteux, au total et au kilomètre",
    groupes: [["cout", "couts", "coute", "coutent", "cher", "chere", "couteux"], ["vehicule", "vehicules", "camion", "camions", "km", "kilometre", "kilometrique", "plus"]],
    exemple: "Quel véhicule coûte le plus cher au kilomètre ?",
    poids: 1,
  },
  {
    cle: "consommation",
    libelle: "La consommation et les dérives par rapport à la référence",
    groupes: [["consommation", "consomme", "consomment", "carburant", "gasoil", "litre", "litres", "derive", "derives", "l100"]],
    exemple: "Quels véhicules dérivent en consommation ?",
    poids: 2,
  },
  {
    cle: "sans-chauffeur",
    libelle: "Les véhicules que personne ne conduit",
    groupes: [["sans", "aucun", "pas de", "manque", "personne"], ["chauffeur", "chauffeurs", "conducteur", "conducteurs", "titulaire"]],
    exemple: "Quels véhicules n'ont pas de chauffeur ?",
    poids: 2,
  },
  {
    cle: "incidents",
    libelle: "Les accidents et incidents, leur coût et leur immobilisation",
    groupes: [["incident", "incidents", "accident", "accidents", "sinistre", "sinistres", "casse", "collision"]],
    exemple: "Combien d'accidents depuis le début de l'année ?",
    poids: 2,
  },
  {
    cle: "maintenance",
    libelle: "Les ordres de travail ouverts et ce qui reste à faire",
    groupes: [["maintenance", "atelier", "reparation", "reparations", "intervention", "interventions", "ordre", "ordres", "entretien", "vidange", "faire"]],
    exemple: "Quels ordres de travail sont ouverts ?",
    poids: 2,
  },
  {
    cle: "caisse",
    libelle: "Le solde de la caisse parc et ce qui reste à régler",
    groupes: [["caisse", "solde", "regler", "reglement", "justificatif", "justificatifs"]],
    exemple: "Quel est le solde de la caisse ?",
    poids: 2,
  },
  {
    cle: "achats",
    libelle: "Les demandes d'achat et l'étape où elles en sont",
    groupes: [["achat", "achats", "demande", "demandes", "commande", "commandes", "da", "bon"]],
    exemple: "Quelles demandes d'achat attendent une décision ?",
    poids: 1,
  },
  {
    cle: "cuve",
    libelle: "Le stock de la cuve interne et sa dernière livraison",
    groupes: [["cuve", "citerne", "stock", "jauge"]],
    exemple: "Où en est le stock de la cuve ?",
    poids: 3,
  },
  {
    cle: "classement",
    libelle: "Le classement SQDCM des chauffeurs du mois révolu",
    groupes: [["classement", "meilleur", "meilleurs", "performance", "sqdcm", "prime", "primes", "score", "note"]],
    exemple: "Qui sont les meilleurs chauffeurs du mois ?",
    poids: 2,
  },
  {
    cle: "chauffeurs-conformite",
    libelle: "Les chauffeurs non conformes ou inaptes",
    groupes: [
      ["chauffeur", "chauffeurs", "conducteur", "conducteurs", "permis"],
      ["conforme", "conformes", "inapte", "inaptes", "echu", "echus", "apte", "medicale", "valide", "conduire", "conduit", "empeche", "empeches", "interdit"],
    ],
    exemple: "Quels chauffeurs ne peuvent pas conduire ?",
    poids: 2,
  },
  {
    cle: "prestataires",
    libelle: "Les prestataires, ce qu'ils ont facturé et ce qu'on leur doit",
    groupes: [["prestataire", "prestataires", "garage", "garages", "fournisseur", "fournisseurs"]],
    exemple: "Quel garage a le plus facturé cette année ?",
    poids: 2,
  },
  {
    cle: "vehicule",
    libelle: "La situation d'un véhicule précis, par son immatriculation",
    groupes: [["ou en est", "situation", "etat", "fiche", "parle moi", "resume", "point sur"]],
    exemple: "Où en est AA 032 EA ?",
  },
];
