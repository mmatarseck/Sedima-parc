"use client";

import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { STATUT_CHAUFFEUR, nonConforme, prochaineEcheance, type EcheanceChauffeur, type LigneChauffeur } from "@/domaine/chauffeur";
import { APTITUDE, CONTRAT_CHAUFFEUR, MOTIF_INDISPONIBILITE, TYPE_DOCUMENT, formulerEcheance, tonEcheance } from "@/domaine/libelles";
import { kilometrage } from "@/lib/format";
import { PastilleStatutChauffeur } from "./PastilleStatutChauffeur";

/* ============================================================================
 * Liste des chauffeurs — ce que chaque colonne contient.
 *
 * Le filet porte le statut déduit (en poste, disponible, indisponible, sorti),
 * le nom est la seule colonne figée. Comme sur la Flotte, la liste sert à
 * retrouver et à comparer ; le détail est sur la fiche.
 * ==========================================================================*/

const FILTRES: FiltreListe<LigneChauffeur>[] = [
  { cle: "tous", libelle: "Tous", retient: () => true },
  { cle: "en-poste", libelle: "En poste", retient: (l) => l.statut === "en-poste" },
  { cle: "disponibles", libelle: "Disponibles", retient: (l) => l.statut === "disponible" },
  { cle: "indisponibles", libelle: "Indisponibles", retient: (l) => l.statut === "indisponible" },
  { cle: "non-conformes", libelle: "Non conformes", retient: (l) => l.chauffeur.actif && nonConforme(l) },
  { cle: "sortis", libelle: "Sortis", retient: (l) => l.statut === "sorti" },
];

const IDENTIFIANT = {
  cle: "nom",
  libelle: "Chauffeur",
  largeur: 190,
  rendu: (l: LigneChauffeur) => (
    <span className="flex items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-fond text-[10.5px] font-semibold text-accent-tres-fonce">{l.initiales}</span>
      <span className="truncate">{l.nomComplet}</span>
    </span>
  ),
};

function EcheanceDocument({ e }: { e: EcheanceChauffeur }) {
  if (e.manquant) return <Echeance ton="defavorable">manquant</Echeance>;
  return <Echeance ton={tonEcheance(e.joursRestants)}>{formulerEcheance(e.joursRestants)}</Echeance>;
}

const COLONNES: ColonneListe<LigneChauffeur>[] = [
  { cle: "matricule", libelle: "Matricule", parDefaut: false, largeur: 112, rendu: (l) => <span className="code block truncate text-texte-2">{l.chauffeur.matriculeRh ?? "—"}</span> },
  { cle: "contrat", libelle: "Contrat", parDefaut: false, largeur: 112, rendu: (l) => <span className="block truncate">{CONTRAT_CHAUFFEUR[l.chauffeur.contrat]}</span> },
  { cle: "site", libelle: "Site", parDefaut: true, largeur: 150, rendu: (l) => <span className="block truncate">{l.site?.libelle ?? <span className="text-attenue-2">—</span>}</span> },
  {
    cle: "vehicule",
    libelle: "Véhicule",
    parDefaut: true,
    largeur: 190,
    rendu: (l) =>
      l.vehiculeTitulaire ? (
        <>
          <span className="block truncate">
            <span className="code font-medium">{l.vehiculeTitulaire.immatriculationAffichee}</span>
            <span className="text-texte-2"> · {l.vehiculeTitulaire.marque}</span>
          </span>
          {l.suppleances.length > 0 ? <span className="meta block truncate">+ suppléant de {l.suppleances.map((s) => s.immatriculationAffichee).join(", ")}</span> : null}
        </>
      ) : l.suppleances.length > 0 ? (
        <span className="block truncate">
          <span className="text-texte-2">Suppléant · </span>
          <span className="code font-medium">{l.suppleances.map((s) => s.immatriculationAffichee).join(", ")}</span>
        </span>
      ) : (
        <span className="text-attenue-2">{l.statut === "sorti" ? "—" : "Sans véhicule"}</span>
      ),
  },
  {
    cle: "permis",
    libelle: "Permis",
    parDefaut: true,
    largeur: 104,
    rendu: (l) => (
      <span className="code block truncate" title={l.chauffeur.permisNumero ?? "Numéro non enregistré"}>
        {l.chauffeur.permisCategories.join(" · ")}
      </span>
    ),
  },
  { cle: "echeance-permis", libelle: "Échéance permis", parDefaut: true, largeur: 140, rendu: (l) => <EcheanceDocument e={l.permis} /> },
  { cle: "visite", libelle: "Visite médicale", parDefaut: true, largeur: 140, rendu: (l) => <EcheanceDocument e={l.visiteMedicale} /> },
  {
    cle: "aptitude",
    libelle: "Aptitude",
    parDefaut: false,
    largeur: 160,
    rendu: (l) => (
      <span title={l.chauffeur.aptitudeMotif ?? undefined}>
        <Pastille ton={APTITUDE[l.chauffeur.aptitude].ton}>{APTITUDE[l.chauffeur.aptitude].libelle}</Pastille>
      </span>
    ),
    texte: (l) => `${APTITUDE[l.chauffeur.aptitude].libelle} ${l.chauffeur.aptitudeMotif ?? ""}`,
  },
  {
    cle: "conformite",
    libelle: "Prochaine échéance",
    parDefaut: false,
    largeur: 210,
    rendu: (l) => {
      const e = prochaineEcheance(l);
      return (
        <Echeance ton={e.manquant ? "defavorable" : tonEcheance(e.joursRestants)}>
          {TYPE_DOCUMENT[e.type]} · {e.manquant ? "manquant" : formulerEcheance(e.joursRestants)}
        </Echeance>
      );
    },
  },
  {
    cle: "km",
    libelle: "Km 12 mois",
    alignee: "droite",
    parDefaut: true,
    largeur: 128,
    rendu: (l) => (l.kmDouzeMois === null ? <span className="text-attenue-2">—</span> : <span className="code block truncate">{kilometrage(l.kmDouzeMois)}</span>),
  },
  {
    cle: "contraventions",
    libelle: "Contraventions",
    alignee: "droite",
    parDefaut: true,
    largeur: 128,
    rendu: (l) => (l.contraventionsDouzeMois === 0 ? <span className="text-attenue-2">0</span> : <span className={`code ${l.contraventionsDouzeMois >= 2 ? "font-medium text-vigilance" : ""}`}>{l.contraventionsDouzeMois}</span>),
  },
  {
    cle: "incidents",
    libelle: "Incidents",
    alignee: "droite",
    parDefaut: true,
    largeur: 104,
    rendu: (l) => (l.incidentsDouzeMois === 0 ? <span className="text-attenue-2">0</span> : <span className={`code ${l.incidentsDouzeMois >= 2 ? "font-medium text-vigilance" : ""}`}>{l.incidentsDouzeMois}</span>),
  },
  { cle: "telephone", libelle: "Téléphone", parDefaut: false, largeur: 130, rendu: (l) => <span className="code block truncate">{l.chauffeur.telephone ?? "—"}</span> },
  {
    cle: "statut",
    libelle: "Statut",
    parDefaut: false,
    largeur: 190,
    rendu: (l) => (
      <span className="flex items-center gap-2">
        <PastilleStatutChauffeur statut={l.statut} />
        {l.indisponibilite ? <span className="meta truncate">{MOTIF_INDISPONIBILITE[l.indisponibilite.motif]}</span> : null}
      </span>
    ),
    texte: (l) => `${STATUT_CHAUFFEUR[l.statut].libelle} ${l.indisponibilite ? MOTIF_INDISPONIBILITE[l.indisponibilite.motif] : ""}`,
  },
];

function champsRecherche(l: LigneChauffeur): string[] {
  return [
    l.nomComplet,
    l.chauffeur.matriculeRh ?? "",
    l.chauffeur.telephone ?? "",
    l.site?.libelle ?? "",
    l.vehiculeTitulaire?.immatriculationAffichee ?? "",
    l.vehiculeTitulaire?.immatriculation ?? "",
    ...l.suppleances.map((s) => s.immatriculationAffichee),
  ];
}

export function TableChauffeurs({ lignes }: { lignes: LigneChauffeur[] }) {
  return (
    <TableListe<LigneChauffeur>
      ecran="chauffeurs"
      lignes={lignes}
      cle={(l) => l.id}
      href={(l) => `/chauffeurs/${l.id}`}
      filet={(l) => {
        const s = STATUT_CHAUFFEUR[l.statut];
        return { couleur: s.couleur, libelle: s.libelle, precision: l.indisponibilite ? MOTIF_INDISPONIBILITE[l.indisponibilite.motif] : s.precision };
      }}
      identifiant={IDENTIFIANT}
      colonnes={COLONNES}
      filtres={FILTRES}
      champsRecherche={champsRecherche}
      placeholderRecherche="Nom, matricule, véhicule, site…"
      libelleRecherche="Rechercher un chauffeur"
      libelleUnite="chauffeurs"
      vide="Aucun chauffeur ne correspond à cette recherche."
    />
  );
}
