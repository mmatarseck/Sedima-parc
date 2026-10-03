"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Download, Plus } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Echeance } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { PhotoVehicule } from "@/composants/vehicule/PhotoVehicule";
import { TYPE_CONTRAT, chauffeurAffiche, libelleCamion, type LigneCamionTiers } from "@/domaine/camions-tiers";
import { BUSINESS_UNIT, STATUT_VEHICULE } from "@/domaine/libelles";
import { dateCourte, montantCourt, nombre } from "@/lib/format";
import { peutCourant } from "@/lib/acces-courant";

/* ============================================================================
 * Transporteurs — la liste des camions, comme la Flotte (métier, 3 octobre
 * 2026).
 *
 * Une ligne par camion de transporteur : son identité, son transporteur (en
 * filtre), son chauffeur, son statut, son contrat, et ce que ses trente
 * derniers jours disent — voyages, tonnes, carburant fourni. Le transporteur
 * lui-même — contrat, grille, facturation, notation — se lit sur sa fiche
 * fournisseur, comme tout prestataire.
 * ==========================================================================*/

const operationnel = (l: LigneCamionTiers) => STATUT_VEHICULE[l.statut]?.operationnel ?? true;

const FILTRES: FiltreListe<LigneCamionTiers>[] = [
  { cle: "tous", libelle: "Engagés", retient: (l) => l.actif },
  { cle: "disponibles", libelle: "Opérationnels", retient: (l) => l.actif && operationnel(l) },
  { cle: "immobilises", libelle: "Immobilisés", retient: (l) => l.actif && !operationnel(l) },
  { cle: "mad", libelle: "Mise à disposition", retient: (l) => l.actif && l.typeContrat === "mise-a-disposition" },
  { cle: "carburant", libelle: "Carburant fourni", retient: (l) => l.actif && l.carburantFourni },
  { cle: "inactifs", libelle: "Plus engagés", retient: (l) => !l.actif },
];

const IDENTIFIANT = {
  cle: "immat",
  libelle: "Immat.",
  largeur: 108,
  rendu: (l: LigneCamionTiers) => <span className="code">{l.immatriculationAffichee}</span>,
};

const FIXES: ColonneListe<LigneCamionTiers>[] = [
  { cle: "vehicule", libelle: "Véhicule", parDefaut: true, largeur: 150, texte: (l) => libelleCamion(l), rendu: (l) => <span className="block truncate text-[13px] font-medium text-texte">{libelleCamion(l)}</span> },
];

const COLONNES: ColonneListe<LigneCamionTiers>[] = [
  {
    cle: "photo",
    libelle: "Photo",
    parDefaut: false,
    largeur: 90,
    texte: (l) => (l.photo ? "avec photo" : "sans photo"),
    rendu: (l) => <PhotoVehicule photo={l.photo} categorie={l.categorie} immatriculation={l.immatriculationAffichee} taille="vignette" />,
  },
  { cle: "transporteur", libelle: "Transporteur", parDefaut: true, largeur: 150, texte: (l) => l.transporteur, rendu: (l) => <span className="block truncate">{l.transporteur}</span> },
  {
    cle: "capacite",
    libelle: "Capacité",
    alignee: "droite",
    parDefaut: true,
    largeur: 96,
    tri: (l) => l.capaciteTonnes,
    rendu: (l) => (l.capaciteTonnes ? <span className="code">{nombre(l.capaciteTonnes, Number.isInteger(l.capaciteTonnes) ? 0 : 1)} t</span> : <span className="text-attenue-2">—</span>),
  },
  {
    cle: "chauffeur",
    libelle: "Chauffeur",
    parDefaut: true,
    largeur: 170,
    texte: (l) => chauffeurAffiche(l)?.nom ?? "Non renseigné",
    rendu: (l) => {
      const c = chauffeurAffiche(l);
      if (!c) return <span className="text-attenue-2">Non renseigné</span>;
      return (
        <span className="block truncate" title={c.source === "releve" ? "Chauffeur du dernier voyage au relevé — aucun chauffeur n'est affecté" : (l.chauffeur?.telephone ?? undefined)}>
          {c.nom}
          {c.source === "releve" ? <span className="meta"> · relevé</span> : null}
        </span>
      );
    },
  },
  { cle: "contrat", libelle: "Contrat", parDefaut: true, largeur: 150, texte: (l) => TYPE_CONTRAT[l.typeContrat].court, rendu: (l) => <span className="block truncate">{TYPE_CONTRAT[l.typeContrat].court}</span> },
  { cle: "carburant", libelle: "Carburant", parDefaut: true, largeur: 110, texte: (l) => (l.carburantFourni ? "fourni par SEDIMA" : "à sa charge"), rendu: (l) => (l.carburantFourni ? "Fourni" : <span className="text-attenue-2">À sa charge</span>) },
  { cle: "bu", libelle: "Business unit", parDefaut: true, largeur: 130, texte: (l) => (l.businessUnit ? BUSINESS_UNIT[l.businessUnit] : ""), rendu: (l) => <span className="block truncate">{l.businessUnit ? BUSINESS_UNIT[l.businessUnit] : "—"}</span> },
  {
    cle: "dernier",
    libelle: "Dernier voyage",
    parDefaut: true,
    largeur: 170,
    tri: (l) => l.dernierVoyage,
    texte: (l) => (l.dernierVoyage ? `${dateCourte(l.dernierVoyage)} ${l.derniereDestination ?? ""}` : ""),
    rendu: (l) =>
      l.dernierVoyage ? (
        <span className="block truncate">
          {dateCourte(l.dernierVoyage)}
          {l.derniereDestination ? <span className="text-texte-2"> · {l.derniereDestination}</span> : null}
        </span>
      ) : (
        <span className="text-attenue-2">—</span>
      ),
  },
  { cle: "voyages", libelle: "Voyages 30 j", alignee: "droite", parDefaut: true, largeur: 110, tri: (l) => l.voyages30j, rendu: (l) => <span className="code">{l.voyages30j || <span className="text-attenue-2">—</span>}</span> },
  { cle: "tonnes", libelle: "Tonnes 30 j", alignee: "droite", parDefaut: true, largeur: 110, tri: (l) => l.tonnes30j, rendu: (l) => <span className="code">{l.tonnes30j ? nombre(l.tonnes30j, 1) : <span className="text-attenue-2">—</span>}</span> },
  { cle: "litres", libelle: "Carburant 30 j", alignee: "droite", parDefaut: false, largeur: 130, tri: (l) => l.carburant30j, rendu: (l) => <span className="code">{l.carburant30j ? montantCourt(l.carburant30j) : <span className="text-attenue-2">—</span>}</span> },
  {
    cle: "incidents",
    libelle: "Incidents ouverts",
    alignee: "droite",
    parDefaut: false,
    largeur: 140,
    tri: (l) => l.incidentsOuverts,
    rendu: (l) => (l.incidentsOuverts ? <Echeance ton="vigilance">{l.incidentsOuverts}</Echeance> : <span className="text-attenue-2">—</span>),
  },
  { cle: "vin", libelle: "VIN", parDefaut: false, largeur: 190, rendu: (l) => <span className="code block truncate text-texte-2">{l.vin ?? "—"}</span> },
  { cle: "balise", libelle: "Balise", parDefaut: false, largeur: 80, texte: (l) => (l.balise ? "oui" : "non"), rendu: (l) => (l.balise ? "Oui" : <span className="text-attenue-2">Non</span>) },
  { cle: "secaa", libelle: "Carte SECAA", parDefaut: false, largeur: 120, texte: (l) => (l.carteSecaa ? (l.numeroCarteSecaa ?? "oui") : "non"), rendu: (l) => (l.carteSecaa ? <span className="code block truncate">{l.numeroCarteSecaa ?? "Oui"}</span> : <span className="text-attenue-2">—</span>) },
  { cle: "ageroute", libelle: "Carte Agéroute", parDefaut: false, largeur: 120, texte: (l) => (l.carteAgeroute ? (l.numeroCarteAgeroute ?? "oui") : "non"), rendu: (l) => (l.carteAgeroute ? <span className="code block truncate">{l.numeroCarteAgeroute ?? "Oui"}</span> : <span className="text-attenue-2">—</span>) },
  {
    cle: "creation",
    libelle: "Créé le",
    parDefaut: false,
    largeur: 104,
    tri: (l) => l.creeLe ?? null,
    texte: (l) => (l.creeLe ? dateCourte(l.creeLe.slice(0, 10)) : ""),
    rendu: (l) => (l.creeLe ? <span className="block truncate">{dateCourte(l.creeLe.slice(0, 10))}</span> : <span className="text-attenue-2">—</span>),
  },
  {
    cle: "statut",
    libelle: "Statut",
    parDefaut: true,
    largeur: 160,
    texte: (l) => STATUT_VEHICULE[l.statut]?.libelle ?? l.statut,
    rendu: (l) => {
      const s = STATUT_VEHICULE[l.statut];
      return <Echeance ton={s?.operationnel ? "favorable" : "vigilance"}>{s?.libelle ?? l.statut}</Echeance>;
    },
  },
];

function champsRecherche(l: LigneCamionTiers): string[] {
  return [l.immatriculationAffichee, l.immatriculation, l.marque ?? "", l.modele ?? "", l.transporteur, l.chauffeur?.nom ?? "", l.chauffeurReleve ?? "", l.vin ?? "", l.derniereDestination ?? ""];
}

export function EcranCamionsTiers({ lignes }: { lignes: LigneCamionTiers[] }) {
  return (
    <FournisseurEdition sujet="transporteurs" href="/transporteurs">
      <Interieur lignes={lignes} />
    </FournisseurEdition>
  );
}

function Interieur({ lignes }: { lignes: LigneCamionTiers[] }) {
  const { creer } = useEdition();
  const [peutCreer, setPeutCreer] = useState(false);
  useEffect(() => setPeutCreer(peutCourant("transporteurs", "gestion")), []);

  /* Le transporteur, en second jeu de pilules : la question « qu'a Adex
     aujourd'hui ? » se pose d'un clic (métier, 3 octobre 2026). */
  const parTransporteur = useMemo<FiltreListe<LigneCamionTiers>[]>(() => {
    const noms = [...new Set(lignes.filter((l) => l.actif).map((l) => l.transporteur))].sort((a, b) => a.localeCompare(b, "fr"));
    return [{ cle: "tous", libelle: "Tous les transporteurs", retient: () => true }, ...noms.map((nom) => ({ cle: nom, libelle: nom, retient: (l: LigneCamionTiers) => l.transporteur === nom }))];
  }, [lignes]);

  const engages = lignes.filter((l) => l.actif);
  const capacite = engages.reduce((s, l) => s + (l.capaciteTonnes ?? 0), 0);
  const transporteurs = new Set(engages.map((l) => l.transporteur)).size;

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Transporteurs"
        sousTitre={`${engages.length} camions engagés chez ${transporteurs} transporteurs · ${nombre(capacite)} t de capacité`}
        actions={
          <>
            <Link href="/transporteurs/volumes" className="bouton-secondaire" title="Le tonnage de la semaine camion par camion, et la facturation du mois calculée sur la grille">
              <CalendarRange className="size-4 text-texte-2" strokeWidth={1.7} />
              Volumes et facturation
            </Link>
            <Link href="/rapports/transporteurs-activite" className="bouton-secondaire" title="Ouvre les rapports des transporteurs, d'où le classeur se tire">
              <Download className="size-4 text-texte-2" strokeWidth={1.7} />
              Exporter
            </Link>
            {peutCreer ? (
              <button
                type="button"
                className="bouton-principal"
                onClick={() => creer({ type: "camion", titre: "Nouveau camion de transporteur", champs: champsCreation("camion", { pour: "vehicule" }), valeurs: { typeContrat: "voyage", categorie: "camion" } })}
              >
                <Plus className="size-4" strokeWidth={2.2} />
                Ajouter un camion
              </button>
            ) : null}
          </>
        }
      />

      <TableListe<LigneCamionTiers>
        ecran="transporteurs-camions"
        lignes={lignes}
        cle={(l) => l.immatriculation}
        href={(l) => `/transporteurs/camions/${l.immatriculation}`}
        filet={(l) => {
          const s = STATUT_VEHICULE[l.statut];
          return { couleur: s?.couleur ?? "var(--color-attenue)", libelle: s?.libelle ?? l.statut, precision: s?.precision ?? "" };
        }}
        identifiant={IDENTIFIANT}
        fixes={FIXES}
        colonnes={COLONNES}
        filtres={FILTRES}
        filtresSecondaires={parTransporteur}
        libelleFiltresSecondaires="Filtrer par transporteur"
        champsRecherche={champsRecherche}
        placeholderRecherche="Immatriculation, transporteur, chauffeur, destination…"
        libelleRecherche="Rechercher un camion"
        libelleUnite="camions"
        vide="Aucun camion ne correspond à cette recherche."
      />
    </div>
  );
}
