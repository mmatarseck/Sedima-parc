"use client";

import { ENERGIE } from "@/domaine/libelles";

import { Echeance } from "@/composants/interface/Pastille";
import { StatutModifiable } from "@/composants/vehicule/StatutModifiable";
import { ChauffeurDeLaLigne } from "@/composants/vehicule/ChauffeurDeLaLigne";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { REGIME_USAGE } from "@/domaine/parc-leger";
import { PhotoVehicule } from "@/composants/vehicule/PhotoVehicule";
import {
  BUSINESS_UNIT,
  CATEGORIE_FLOTTE,
  libelleCategorie,
  STATUT_VEHICULE,
  TYPE_DOCUMENT,
  formulerEcheance,
  tonEcheance,
} from "@/domaine/libelles";
import type { LigneFlotte } from "@/domaine/types";
import { dateCourte, kilometrage, montantCourt } from "@/lib/format";

/* ============================================================================
 * Liste flotte — ce que chaque colonne contient.
 *
 * Le filet de statut et l'immatriculation sont figés : ce sont eux qui
 * identifient la ligne. « Véhicule » est toujours affichée mais défile. Toutes
 * les autres sont au choix. Les largeurs sont déclarées, jamais déduites du
 * contenu, pour qu'une colonne ne change pas d'épaisseur quand un filtre
 * change ce qui s'affiche.
 * ==========================================================================*/

/** Le statut affiché : effectif si la page l'a calculé, saisi sinon. */
const statutDe = (l: LigneFlotte) => l.statutEffectif ?? l.vehicule.statut;

/* Un véhicule sorti a quitté le parc : il n'est plus du sujet quand on lit
   « la flotte », et il fausserait tout compte fait sur la liste. Il reste
   consultable — sa fiche, son historique, ses coûts —, par son filtre et par
   la recherche, qui le trouve à sa plaque. C'est « Tous » qui le tait, pas
   l'application qui l'efface. */
const sorti = (l: LigneFlotte) => l.vehicule.statut === "sorti";

const FILTRES: FiltreListe<LigneFlotte>[] = [
  { cle: "tous", libelle: "Tous", retient: (l) => !sorti(l) },
  { cle: "operationnels", libelle: "Opérationnels", retient: (l) => !sorti(l) && STATUT_VEHICULE[statutDe(l)].operationnel },
  {
    cle: "immobilises",
    libelle: "Immobilisés",
    retient: (l) => statutDe(l) === "en-reparation" || statutDe(l) === "en-restauration" || statutDe(l) === "hors-service",
  },
  { cle: "sortants", libelle: "Sortants", retient: (l) => l.vehicule.statut === "en-mutation" || l.vehicule.statut === "retrait-en-cours" },
  { cle: "non-conformes", libelle: "Non conformes", retient: (l) => !sorti(l) && (l.prochaineEcheanceConformite?.joursRestants ?? 1) < 0 },
  { cle: "a-recevoir", libelle: "À recevoir", retient: (l) => l.vehicule.statut === "a-recevoir" },
  { cle: "sortis", libelle: "Sortis du parc", retient: sorti },
];

/* Le second jeu de pilules, croisé avec l'état : le régime d'usage. Le parc
   léger a rejoint la liste le 7 septembre 2026 ; sans ce filtre, les camions
   se noieraient dans les pick-up de service. */
const regimeDe = (l: LigneFlotte) => l.vehicule.regime ?? "exploitation";
const REGIMES: FiltreListe<LigneFlotte>[] = [
  { cle: "tous", libelle: "Tout le parc", retient: () => true },
  { cle: "exploitation", libelle: "Exploitation", retient: (l) => regimeDe(l) === "exploitation" },
  { cle: "service", libelle: "Service", retient: (l) => regimeDe(l) === "service" },
  { cle: "fonction", libelle: "Fonction", retient: (l) => regimeDe(l) === "fonction" },
  { cle: "plan-car", libelle: "Plan car", retient: (l) => l.attributaire?.planCar === true },
];

const IDENTIFIANT = {
  cle: "immat",
  libelle: "Immat.",
  largeur: 108,
  rendu: (l: LigneFlotte) => <span className="code">{l.vehicule.immatriculationAffichee}</span>,
};

const FIXES: ColonneListe<LigneFlotte>[] = [
  {
    cle: "vehicule",
    libelle: "Véhicule",
    parDefaut: true,
    largeur: 132,
    rendu: (l) => <span className="block truncate text-[13px] font-medium text-texte">{l.vehicule.marque}</span>,
  },
];

/* La photo, en colonne facultative : elle sert à reconnaître le véhicule dans
   une liste où trois camions du même modèle portent le même libellé. */
const COLONNE_PHOTO: ColonneListe<LigneFlotte> = {
  cle: "photo",
  libelle: "Photo",
  parDefaut: false,
  largeur: 90,
  texte: (l) => (l.vehicule.photo ? "avec photo" : "sans photo"),
  rendu: (l) => <PhotoVehicule photo={l.vehicule.photo ?? null} categorie={l.vehicule.categorie} immatriculation={l.vehicule.immatriculationAffichee} taille="vignette" />,
};

const COLONNES: ColonneListe<LigneFlotte>[] = [
  { cle: "modele", libelle: "Modèle", parDefaut: true, largeur: 148, rendu: (l) => <span className="block truncate">{l.vehicule.appellation}</span> },
  { cle: "vin", libelle: "VIN", parDefaut: false, largeur: 190, rendu: (l) => <span className="code block truncate text-texte-2">{l.vehicule.vin ?? "—"}</span> },
  { cle: "energie", libelle: "Énergie", parDefaut: false, largeur: 110, rendu: (l) => (l.vehicule.energie ? ENERGIE[l.vehicule.energie] : <span className="text-attenue-2">—</span>) },
  { cle: "categorie", libelle: "Catégorie", parDefaut: true, largeur: 128, rendu: (l) => <span className="block truncate">{libelleCategorie(l.vehicule)}</span> },
  /* Le régime d'usage (cadrage du 7 septembre 2026) : exploitation, service,
     fonction — et le plan car en mention, parce qu'il change le devenir du véhicule. */
  {
    cle: "regime",
    libelle: "Régime",
    parDefaut: true,
    largeur: 118,
    texte: (l) => `${REGIME_USAGE[l.vehicule.regime ?? "exploitation"].libelle}${l.attributaire?.planCar ? " plan car" : ""}`,
    rendu: (l) => (
      <>
        <span className="block truncate">{REGIME_USAGE[l.vehicule.regime ?? "exploitation"].libelle}</span>
        {l.attributaire?.planCar ? <span className="meta block truncate">plan car</span> : null}
      </>
    ),
  },
  { cle: "flotte", libelle: "Catégorie de flotte", parDefaut: false, largeur: 140, rendu: (l) => <span className="block truncate">{CATEGORIE_FLOTTE[l.vehicule.categorieFlotte]}</span> },
  {
    cle: "bu",
    libelle: "Business unit",
    parDefaut: true,
    largeur: 140,
    rendu: (l) => <span className="block truncate">{l.vehicule.businessUnit ? BUSINESS_UNIT[l.vehicule.businessUnit] : "—"}</span>,
  },
  { cle: "site", libelle: "Site", parDefaut: true, largeur: 150, rendu: (l) => <span className="block truncate">{l.site?.libelle ?? <span className="text-attenue-2">—</span>}</span> },
  {
    cle: "chauffeur",
    libelle: "Chauffeur ou attributaire",
    parDefaut: true,
    largeur: 170,
    texte: (l) => l.attributaire?.nom ?? l.chauffeurTitulaire?.nom ?? "Non affecté",
    rendu: (l) => <ChauffeurDeLaLigne ligne={l} />,
  },
  {
    cle: "attelage",
    libelle: "Attelage",
    parDefaut: false,
    largeur: 150,
    rendu: (l) =>
      l.attelageCourant ? (
        <span className="block truncate">
          <span className="text-texte-2">{l.attelageCourant.role === "tracteur" ? "tire " : "tirée par "}</span>
          <span className="code font-medium">{l.attelageCourant.immatriculationAffichee}</span>
        </span>
      ) : (
        <span className="text-attenue-2">—</span>
      ),
  },
  {
    cle: "km",
    libelle: "Dernier kilométrage",
    alignee: "droite",
    parDefaut: true,
    largeur: 168,
    // La date du relevé passe en infobulle : la liste sert à comparer des
    // kilométrages, le détail est dans la fiche du véhicule.
    rendu: (l) =>
      l.kilometrage === null ? (
        <span className="text-attenue-2">—</span>
      ) : (
        <span className="code block truncate" title={`Relevé le ${dateCourte(l.dateKilometrage)}`}>
          {kilometrage(l.kilometrage)}
        </span>
      ),
  },
  {
    cle: "entretien",
    libelle: "Entretien",
    parDefaut: true,
    largeur: 128,
    rendu: (l) =>
      l.prochaineEcheanceEntretien?.kmRestants ? (
        <Echeance ton={l.prochaineEcheanceEntretien.kmRestants < 1000 ? "vigilance" : "favorable"}>dans {kilometrage(l.prochaineEcheanceEntretien.kmRestants)}</Echeance>
      ) : (
        <span className="text-attenue-2">—</span>
      ),
  },
  {
    cle: "conformite",
    libelle: "Conformité",
    parDefaut: false,
    largeur: 196,
    rendu: (l) => {
      const e = l.prochaineEcheanceConformite;
      return e ? (
        <Echeance ton={tonEcheance(e.joursRestants)}>
          {TYPE_DOCUMENT[e.type]} · {formulerEcheance(e.joursRestants)}
        </Echeance>
      ) : (
        <span className="text-attenue-2">—</span>
      );
    },
  },
  { cle: "cout", libelle: "Coût 12 mois", alignee: "droite", parDefaut: false, largeur: 112, rendu: (l) => <span className="code block truncate">{montantCourt(l.coutDouzeMois)}</span> },
  /* Chez qui il a été acheté (0048) : facultative, mais c'est elle qui répond à
     « qu'avons-nous pris chez ce concessionnaire ». */
  {
    cle: "fournisseur",
    libelle: "Fournisseur",
    parDefaut: false,
    largeur: 170,
    texte: (l) => l.vehicule.fournisseur ?? "",
    rendu: (l) => (l.vehicule.fournisseur ? <span className="block truncate">{l.vehicule.fournisseur}</span> : <span className="text-attenue-2">—</span>),
  },
  // Le filet de début de ligne porte déjà la couleur ; cette colonne en donne
  // le nom, pour qui ne retient pas encore le code couleur des sept états.
  {
    cle: "statut",
    libelle: "Statut",
    parDefaut: false,
    largeur: 220,
    /* Le motif administratif n'est plus écrit sous la pastille (demande du
       métier du 3 septembre) : la fiche le détaille, la ligne reste sur une
       hauteur ; il reste lisible au survol. */
    /* Le crayon change le statut sans quitter la liste : c'est là qu'on
       parcourt le parc, et le détour par la fiche fait qu'on ne le fait pas. */
    rendu: (l) => (
      <StatutModifiable
        statut={statutDe(l)}
        immatriculation={l.vehicule.immatriculation}
        immatriculationAffichee={l.vehicule.immatriculationAffichee}
        immobilisation={l.immobilisationAdministrative}
      />
    ),
    texte: (l) => `${STATUT_VEHICULE[statutDe(l)].libelle} ${l.immobilisationAdministrative?.length ? "administratif" : ""}`,
  },
];

function champsRecherche(l: LigneFlotte): string[] {
  return [l.vehicule.immatriculationAffichee, l.vehicule.immatriculation, l.vehicule.vin ?? "", l.vehicule.marque, l.vehicule.appellation, l.vehicule.fournisseur ?? "", l.chauffeurTitulaire?.nom ?? "", l.attributaire?.nom ?? "", l.attributaire?.fonction ?? "", l.site?.libelle ?? ""];
}

export function TableFlotte({ lignes }: { lignes: LigneFlotte[] }) {
  return (
    <TableListe<LigneFlotte>
      ecran="flotte"
      lignes={lignes}
      cle={(l) => l.vehicule.id}
      href={(l) => `/flotte/${l.vehicule.immatriculation}`}
      filet={(l) => {
        const s = STATUT_VEHICULE[statutDe(l)];
        const admin = l.immobilisationAdministrative?.length ? ` — immobilisé administrativement : ${l.immobilisationAdministrative.map((d) => TYPE_DOCUMENT[d.type].toLowerCase()).join(", ")}` : "";
        return { couleur: s.couleur, libelle: s.libelle, precision: s.precision + admin };
      }}
      identifiant={IDENTIFIANT}
      fixes={FIXES}
      colonnes={[COLONNE_PHOTO, ...COLONNES]}
      filtres={FILTRES}
      filtresSecondaires={REGIMES}
      libelleFiltresSecondaires="Filtrer par régime d'usage"
      champsRecherche={champsRecherche}
      placeholderRecherche="Immatriculation, chauffeur, attributaire, site…"
      libelleRecherche="Rechercher un véhicule"
      libelleUnite="véhicules"
      vide="Aucun véhicule ne correspond à cette recherche."
    />
  );
}
