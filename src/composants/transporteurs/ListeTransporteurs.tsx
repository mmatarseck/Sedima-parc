"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { FORME_TRANSPORTEUR, MODE_REMUNERATION } from "@/domaine/flotte-tierce";
import { NIVEAU_TRANSPORTEUR } from "@/domaine/notation-transporteur";
import type { listeTransporteurs } from "@/donnees/fiche-transporteur-demo";
import { montant, montantCourt, nombre, pourcentage } from "@/lib/format";

type Ligne = ReturnType<typeof listeTransporteurs>[number];

/* ============================================================================
 * La liste des transporteurs — une entrée par partenaire, comme la Flotte.
 *
 * Refonte du 5 septembre 2026, à la demande du métier : « simplifier la page
 * transporteur avec la liste des transporteurs et les colonnes nécessaires, et
 * dans chaque ligne on rejoint la page du transporteur ».
 *
 * Ce qui vivait ici — affrètements, mises à disposition, prestations, grilles —
 * a rejoint la **fiche** de chaque transporteur, où il est utile ; et les vues
 * d'ensemble ont rejoint **Rapports**, où l'on filtre et où l'on exporte. Un
 * écran de référentiel liste, il n'analyse pas.
 *
 * Le tableau est celui de la Flotte et des Chauffeurs (`TableListe`) : filet
 * de couleur en début de ligne, raison sociale figée à gauche, en-tête figé,
 * colonnes au choix et largeurs enregistrées par compte. Le filet porte la
 * **notation** — c'est elle qui qualifie un transporteur, comme le statut
 * qualifie un véhicule —, et la colonne « Notation » n'est plus affichée par
 * défaut : elle en donne le nom pour qui ne retient pas encore les cinq
 * couleurs.
 * ==========================================================================*/

/** Le gris des non notés : moins de trois dimensions mesurées, on ne colore pas. */
const FILET_SANS_NOTE = { couleur: "var(--color-neutre)", libelle: "Non noté", precision: "Moins de trois dimensions mesurées sur la période — on ne note pas au hasard" };

/* Le tableau enveloppe déjà cette cellule dans le lien vers la fiche : la
   colonne ne pose que le texte, sinon on imbriquerait deux liens. */
const IDENTIFIANT = {
  cle: "nom",
  libelle: "Transporteur",
  largeur: 208,
  rendu: (l: Ligne) => <span className="block truncate">{l.prestataire.raisonSociale}</span>,
};

const FILTRES: FiltreListe<Ligne>[] = [
  { cle: "tous", libelle: "Tous", retient: () => true },
  { cle: "contrat", libelle: "Sous contrat", retient: (l) => l.profil.sousContrat },
  { cle: "sans-ecrit", libelle: "Sans écrit", retient: (l) => !l.profil.sousContrat },
  { cle: "actifs", libelle: "Actifs", retient: (l) => l.activite.missions > 0 },
  { cle: "du", libelle: "Restant dû", retient: (l) => l.activite.restantDu > 0 },
];

const COLONNES: ColonneListe<Ligne>[] = [
  { cle: "ville", libelle: "Ville", parDefaut: false, largeur: 132, rendu: (l) => <span className="block truncate">{l.prestataire.ville ?? <span className="text-attenue-2">—</span>}</span> },
  { cle: "forme", libelle: "Forme", parDefaut: false, largeur: 118, rendu: (l) => <span className="block truncate">{FORME_TRANSPORTEUR[l.profil.forme].libelle}</span> },
  {
    cle: "contrat",
    libelle: "Contrat",
    parDefaut: true,
    largeur: 126,
    rendu: (l) => (l.profil.sousContrat ? <Echeance ton="favorable">Sous contrat</Echeance> : <Echeance ton="vigilance">Sans écrit</Echeance>),
  },
  {
    cle: "remuneration",
    libelle: "Rémunération",
    parDefaut: false,
    largeur: 186,
    rendu: (l) => <span className="block truncate">{l.profil.modes.map((m) => MODE_REMUNERATION[m].libelle).join(", ")}</span>,
  },
  { cle: "camions", libelle: "Camions", alignee: "droite", parDefaut: true, largeur: 100, rendu: (l) => (l.camions > 0 ? <span className="code">{l.camions}</span> : <span className="text-attenue-2">—</span>) },
  {
    cle: "chauffeurs",
    libelle: "Chauffeurs",
    alignee: "droite",
    parDefaut: false,
    largeur: 112,
    rendu: (l) => (l.chauffeurs > 0 ? <span className="code">{l.chauffeurs}</span> : <span className="text-attenue-2">—</span>),
  },
  {
    cle: "capacite",
    libelle: "Capacité",
    alignee: "droite",
    parDefaut: false,
    largeur: 110,
    rendu: (l) => (l.capaciteTonnes !== null ? <span className="code">{nombre(l.capaciteTonnes)} t</span> : <span className="text-attenue-2">—</span>),
  },
  { cle: "missions", libelle: "Missions", alignee: "droite", parDefaut: true, largeur: 104, rendu: (l) => <span className="code">{l.activite.missions}</span> },
  { cle: "tonnes", libelle: "Tonnes", alignee: "droite", parDefaut: true, largeur: 104, rendu: (l) => (l.activite.tonnes > 0 ? <span className="code">{nombre(l.activite.tonnes)}</span> : <span className="text-attenue-2">—</span>) },
  { cle: "cout", libelle: "Coût 12 mois", alignee: "droite", parDefaut: true, largeur: 130, rendu: (l) => <span className="code font-medium">{montantCourt(l.activite.cout)}</span> },
  {
    cle: "coutTonne",
    libelle: "Coût à la tonne",
    alignee: "droite",
    parDefaut: true,
    largeur: 142,
    rendu: (l) => (l.activite.coutParTonne !== null ? <span className="code">{montant(l.activite.coutParTonne)}</span> : <span className="text-attenue-2">—</span>),
  },
  {
    cle: "du",
    libelle: "Restant dû",
    alignee: "droite",
    parDefaut: true,
    largeur: 124,
    rendu: (l) => (l.activite.restantDu > 0 ? <span className="code text-vigilance">{montantCourt(l.activite.restantDu)}</span> : <span className="text-attenue-2">—</span>),
  },
  {
    cle: "ecart",
    libelle: "Écart moyen",
    alignee: "droite",
    parDefaut: false,
    largeur: 132,
    tri: (l) => l.activite.ecartMoyen,
    rendu: (l) =>
      l.activite.ecartMoyen === null ? (
        <span className="text-attenue-2">—</span>
      ) : (
        <Echeance ton={Math.abs(l.activite.ecartMoyen) <= 5 ? "favorable" : l.activite.ecartMoyen > 0 ? "defavorable" : "vigilance"}>
          {l.activite.ecartMoyen > 0 ? "+" : ""}
          {pourcentage(l.activite.ecartMoyen, 1)}
        </Echeance>
      ),
  },
  {
    cle: "subies",
    libelle: "Missions subies",
    alignee: "droite",
    parDefaut: false,
    largeur: 144,
    tri: (l) => l.activite.subies,
    rendu: (l) => (l.activite.subies > 0 ? <Pastille ton="vigilance">{l.activite.subies}</Pastille> : <span className="text-attenue-2">—</span>),
  },
  {
    cle: "delai",
    libelle: "Délai convenu",
    alignee: "droite",
    parDefaut: false,
    largeur: 134,
    rendu: (l) => (l.prestataire.delaiPaiementJours !== null ? <span className="code">{l.prestataire.delaiPaiementJours} j</span> : <span className="text-attenue-2">—</span>),
  },
  /* Le filet de début de ligne porte déjà la couleur ; cette colonne en donne
     le nom et le score, pour qui veut le chiffre sous les yeux. */
  {
    cle: "notation",
    libelle: "Notation",
    parDefaut: false,
    largeur: 150,
    tri: (l) => l.notation.niveau && l.notation.score,
    texte: (l) => (l.notation.niveau ? `${NIVEAU_TRANSPORTEUR[l.notation.niveau].libelle} ${l.notation.score}` : "non noté"),
    rendu: (l) =>
      l.notation.niveau ? (
        <span
          className="inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-semibold text-white"
          style={{ background: NIVEAU_TRANSPORTEUR[l.notation.niveau].couleur }}
          title={`${NIVEAU_TRANSPORTEUR[l.notation.niveau].precision} — ${l.notation.mesurees} dimensions mesurées sur 5`}
        >
          {NIVEAU_TRANSPORTEUR[l.notation.niveau].libelle}
          <span className="code opacity-80">{l.notation.score}</span>
        </span>
      ) : (
        <span className="text-attenue" title="Moins de trois dimensions mesurées : on ne note pas au hasard">
          non noté
        </span>
      ),
  },
];

export function ListeTransporteurs({ lignes }: { lignes: Ligne[] }) {
  const totaux = useMemo(
    () => ({
      camions: lignes.reduce((s, l) => s + l.camions, 0),
      cout: lignes.reduce((s, l) => s + l.activite.cout, 0),
      sousContrat: lignes.filter((l) => l.profil.sousContrat).length,
    }),
    [lignes],
  );

  const champsRecherche = useCallback(
    (l: Ligne) => [l.prestataire.raisonSociale, l.prestataire.numero, l.prestataire.ville ?? "", FORME_TRANSPORTEUR[l.profil.forme].libelle, ...l.profil.modes.map((m) => MODE_REMUNERATION[m].libelle)],
    [],
  );

  const filet = useCallback((l: Ligne) => {
    if (!l.notation.niveau) return FILET_SANS_NOTE;
    const n = NIVEAU_TRANSPORTEUR[l.notation.niveau];
    return { couleur: n.couleur, libelle: `${n.libelle} — ${l.notation.score}/100`, precision: `${n.precision} · ${l.notation.mesurees} dimensions mesurées sur 5` };
  }, []);

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Transporteurs"
        sousTitre={`${lignes.length} partenaires · ${totaux.camions} camions identifiés · ${montantCourt(totaux.cout)} sur douze mois · ${totaux.sousContrat} sous contrat écrit`}
      />

      <TableListe<Ligne>
        ecran="transporteurs"
        lignes={lignes}
        cle={(l) => l.prestataire.numero}
        href={(l) => `/transporteurs/${l.prestataire.numero}`}
        filet={filet}
        libelleFilet="Notation"
        identifiant={IDENTIFIANT}
        colonnes={COLONNES}
        filtres={FILTRES}
        champsRecherche={champsRecherche}
        placeholderRecherche="Transporteur, ville, mode de rémunération…"
        libelleRecherche="Rechercher un transporteur"
        libelleUnite="transporteurs"
        vide="Aucun transporteur ne correspond à cette recherche."
      />

      <p className="meta shrink-0">
        Les affrètements, mises à disposition et prestations se lisent sur la fiche de chaque transporteur, onglet <strong className="font-medium text-texte">Facturation</strong> ; ses chargements
        sous <strong className="font-medium text-texte">Livraisons</strong>. Les vues d&apos;ensemble — relevé de transport, activité comparée, tonnages — sont dans{" "}
        <Link href="/rapports" className="font-medium text-accent-fonce hover:text-accent">
          Rapports
        </Link>
        .
      </p>
    </div>
  );
}
