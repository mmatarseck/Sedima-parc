"use client";

import { Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { BUSINESS_UNIT } from "@/domaine/libelles";
import { ETAT_LEGER, REGIME_USAGE, SITUATION_ATTRIBUTAIRE, type LigneAttributaire } from "@/domaine/parc-leger";

/* ============================================================================
 * Liste des autres conducteurs — les attributaires.
 *
 * Une table à part de celle des chauffeurs, et non un filtre de plus sur la
 * même : les colonnes qui comptent ici ne sont pas les mêmes. Un attributaire
 * n'a ni permis, ni visite médicale, ni aptitude à faire valoir au parc — il
 * tient un véhicule au titre de sa fonction. Lui servir ces colonnes vides le
 * ferait passer pour non conforme, ce qu'il n'est pas ; on montre à la place ce
 * qui le concerne : sa fonction, son département, sa BU, ce qu'il tient, son
 * plan car et son forfait carburant.
 * ==========================================================================*/

const FILTRES: FiltreListe<LigneAttributaire>[] = [
  { cle: "tous", libelle: "Tous", retient: () => true },
  { cle: "fonction", libelle: "Véhicule de fonction", retient: (l) => l.vehicules.some((v) => v.regime === "fonction") },
  { cle: "service", libelle: "Véhicule de service", retient: (l) => l.vehicules.some((v) => v.regime === "service") },
  { cle: "sans-vehicule", libelle: "Sans véhicule", retient: (l) => l.situation === "sans-vehicule" },
];

const IDENTIFIANT = {
  cle: "nom",
  libelle: "Conducteur",
  largeur: 190,
  rendu: (l: LigneAttributaire) => (
    <span className="flex items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-fond text-[10.5px] font-semibold text-accent-tres-fonce">{l.initiales}</span>
      <span className="truncate">{l.nom}</span>
    </span>
  ),
};

const COLONNES: ColonneListe<LigneAttributaire>[] = [
  { cle: "fonction", libelle: "Fonction", parDefaut: true, largeur: 250, rendu: (l) => <span className="block truncate">{l.attributaire.fonction ?? <span className="text-attenue-2">—</span>}</span> },
  { cle: "departement", libelle: "Département", parDefaut: true, largeur: 160, rendu: (l) => <span className="block truncate">{l.attributaire.departement ?? <span className="text-attenue-2">—</span>}</span> },
  {
    cle: "bu",
    libelle: "Business unit",
    parDefaut: false,
    largeur: 140,
    rendu: (l) => <span className="block truncate">{l.attributaire.businessUnit ? BUSINESS_UNIT[l.attributaire.businessUnit] : <span className="text-attenue-2">—</span>}</span>,
    texte: (l) => (l.attributaire.businessUnit ? BUSINESS_UNIT[l.attributaire.businessUnit] : ""),
  },
  {
    cle: "vehicule",
    libelle: "Véhicule tenu",
    parDefaut: true,
    largeur: 200,
    rendu: (l) =>
      l.vehiculePrincipal ? (
        <>
          <span className="block truncate">
            <span className="code font-medium">{l.vehiculePrincipal.immatriculationAffichee}</span>
            <span className="text-texte-2"> · {l.vehiculePrincipal.marque}</span>
          </span>
          {l.vehicules.length > 1 ? <span className="meta block truncate">+ {l.vehicules.slice(1).map((v) => v.immatriculationAffichee).join(", ")}</span> : null}
        </>
      ) : (
        <span className="text-attenue-2">Sans véhicule</span>
      ),
    texte: (l) => l.vehicules.map((v) => v.immatriculationAffichee).join(" "),
  },
  {
    cle: "regime",
    libelle: "Régime",
    parDefaut: true,
    largeur: 130,
    rendu: (l) => (l.vehiculePrincipal ? <span className="block truncate" title={REGIME_USAGE[l.vehiculePrincipal.regime].precision}>{REGIME_USAGE[l.vehiculePrincipal.regime].libelle}</span> : <span className="text-attenue-2">—</span>),
    texte: (l) => (l.vehiculePrincipal ? REGIME_USAGE[l.vehiculePrincipal.regime].libelle : ""),
  },
  {
    cle: "etat",
    libelle: "État du véhicule",
    parDefaut: false,
    largeur: 150,
    rendu: (l) => (l.vehiculePrincipal ? <Pastille ton={ETAT_LEGER[l.vehiculePrincipal.etat].ton}>{ETAT_LEGER[l.vehiculePrincipal.etat].libelle}</Pastille> : <span className="text-attenue-2">—</span>),
    texte: (l) => (l.vehiculePrincipal ? ETAT_LEGER[l.vehiculePrincipal.etat].libelle : ""),
  },
  /* Le plan car et le forfait carburant relèvent de la DCH : l'application ne les suit pas (métier, 22 septembre 2026). */
  { cle: "carte", libelle: "Carte carburant", parDefaut: false, largeur: 150, rendu: (l) => <span className="code block truncate">{l.forfait?.carte ?? "—"}</span> },
  { cle: "lot", libelle: "Lot de cascade", parDefaut: false, largeur: 130, rendu: (l) => <span className="block truncate">{l.vehiculePrincipal?.lot ?? <span className="text-attenue-2">—</span>}</span> },
];

function champsRecherche(l: LigneAttributaire): string[] {
  return [
    l.nom,
    l.attributaire.fonction ?? "",
    l.attributaire.departement ?? "",
    l.forfait?.carte ?? "",
    ...l.vehicules.flatMap((v) => [v.immatriculationAffichee, v.immatriculation ?? "", v.marque, v.modele]),
  ];
}

export function TableAttributaires({ lignes }: { lignes: LigneAttributaire[] }) {
  return (
    <TableListe<LigneAttributaire>
      /* Une clé d'écran à elle : les colonnes choisies ici ne sont pas celles
         de la liste des chauffeurs, et les deux réglages ne doivent pas se
         marcher dessus. */
      ecran="attributaires"
      lignes={lignes}
      cle={(l) => l.id}
      href={(l) => `/attributaires/${l.id}`}
      filet={(l) => {
        const s = SITUATION_ATTRIBUTAIRE[l.situation];
        return { couleur: s.couleur, libelle: s.libelle, precision: s.precision };
      }}
      identifiant={IDENTIFIANT}
      colonnes={COLONNES}
      filtres={FILTRES}
      champsRecherche={champsRecherche}
      placeholderRecherche="Nom, fonction, département, véhicule…"
      libelleRecherche="Rechercher un conducteur"
      libelleUnite="conducteurs"
      vide="Aucun conducteur ne correspond à cette recherche."
    />
  );
}
