"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { BandeauKpi } from "@/composants/interface/BandeauKpi";
import { Pastille } from "@/composants/interface/Pastille";
import { StatutModifiable } from "@/composants/vehicule/StatutModifiable";
import { FournisseurEdition } from "@/composants/transactions/ContexteEdition";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { etatDisponibilite, type LigneDisponibilite } from "@/domaine/disponibilite";
import { REGIME_USAGE } from "@/domaine/parc-leger";
import { lireToutesCreations } from "@/lib/clotures-demo";
import type { StatutVehicule } from "@/domaine/types";
import { BUSINESS_UNIT, CATEGORIE_FLOTTE, CATEGORIE_VEHICULE, STATUT_VEHICULE } from "@/domaine/libelles";
import type { BusinessUnit, RegimeUsage } from "@/domaine/types";
import { date, nombre } from "@/lib/format";

/* ============================================================================
 * Disponibilité du jour.
 *
 * Un bandeau, puis la liste véhicule par véhicule : le statut, et le chauffeur
 * affecté — son nom — ou pas (métier, 22 septembre 2026 : « faire simple »).
 * La capacité par catégorie et « Ce qui manque » ont quitté l'écran.
 *
 * Le serveur calcule la liste sur le jeu de démonstration ; **un changement de
 * statut déclaré dans l'application** — mise en réparation après un incident,
 * remise en service — ne lui est pas connu. L'écran le reprend donc au montage,
 * et l'état de disponibilité se recalcule avec : déclarer qu'un véhicule est en
 * réparation doit le sortir des prêts à charger le matin même, sinon la
 * déclaration ne sert à rien.
 * ==========================================================================*/

/* Faire simple (métier, 22 septembre 2026) : le statut du véhicule, et un
   chauffeur affecté — avec son nom — ou pas. Pour un véhicule de service ou de
   fonction, la personne qui le tient en fait office. */
const aUnChauffeur = (l: LigneDisponibilite) => l.conducteur !== null || l.attributaire !== null;
const operationnel = (l: LigneDisponibilite) => STATUT_VEHICULE[l.statutEffectif].operationnel;

const FILTRES: FiltreListe<LigneDisponibilite>[] = [
  { cle: "tous", libelle: "Tous", retient: () => true },
  { cle: "operationnels", libelle: "Opérationnels", retient: operationnel },
  { cle: "avec", libelle: "Avec chauffeur", retient: (l) => operationnel(l) && aUnChauffeur(l) },
  { cle: "sans", libelle: "Sans chauffeur", retient: (l) => operationnel(l) && !aUnChauffeur(l) },
  { cle: "immobilises", libelle: "Immobilisés", retient: (l) => !operationnel(l) },
];

const IDENTIFIANT = { cle: "immat", libelle: "Immat.", largeur: 108, rendu: (l: LigneDisponibilite) => <span className="code">{l.immatriculationAffichee}</span> };

const COLONNES: ColonneListe<LigneDisponibilite>[] = [
  {
    cle: "statut",
    libelle: "Statut",
    parDefaut: true,
    largeur: 220,
    /* Le cadenas de la pastille dit qu'un document échu tient le statut, et le
       crayon le change sans quitter l'écran du matin. */
    rendu: (l) => (
      <StatutModifiable
        statut={l.statutEffectif}
        immatriculation={l.immatriculation}
        immatriculationAffichee={l.immatriculationAffichee}
        immobilisation={l.immobilisation?.documents ?? null}
      />
    ),
    texte: (l) => STATUT_VEHICULE[l.statutEffectif].libelle,
  },
  {
    cle: "chauffeur",
    libelle: "Chauffeur affecté",
    parDefaut: true,
    largeur: 210,
    rendu: (l) =>
      l.conducteur ? (
        <Link
          href={`/chauffeurs/${l.conducteur.id}`}
          onClick={(e) => e.stopPropagation()}
          title={l.conducteur.empechement ? `Empêché : ${l.conducteur.empechement}` : l.conducteur.role === "suppleant" ? "Suppléant" : "Titulaire"}
          className={`block truncate font-medium ${l.conducteur.empechement ? "text-vigilance" : "text-texte"} hover:underline`}
        >
          {l.conducteur.nom}
        </Link>
      ) : l.attributaire ? (
        <span className="block truncate font-medium text-texte">{l.attributaire}</span>
      ) : (
        <Pastille ton="vigilance">Non affecté</Pastille>
      ),
    texte: (l) => l.conducteur?.nom ?? l.attributaire ?? "Non affecté",
  },
  { cle: "regime", libelle: "Régime", parDefaut: false, largeur: 120, rendu: (l) => REGIME_USAGE[l.regime].libelle },
  { cle: "vehicule", libelle: "Véhicule", parDefaut: true, largeur: 200, rendu: (l) => <span className="block truncate">{l.marque} {l.appellation}</span> },
  { cle: "categorie", libelle: "Catégorie", parDefaut: true, largeur: 128, rendu: (l) => CATEGORIE_VEHICULE[l.categorie] },
  { cle: "flotte", libelle: "Catégorie de flotte", parDefaut: false, largeur: 140, rendu: (l) => CATEGORIE_FLOTTE[l.categorieFlotte] },
  { cle: "charge", libelle: "Charge utile", alignee: "droite", parDefaut: true, largeur: 120, rendu: (l) => (l.chargeUtile ? <span className="code">{nombre(l.chargeUtile / 1000, 1)} t</span> : <span className="text-attenue-2">—</span>) },
  { cle: "site", libelle: "Site", parDefaut: true, largeur: 150, rendu: (l) => l.site ?? "—" },
  {
    cle: "action",
    libelle: "Action",
    parDefaut: true,
    largeur: 120,
    rendu: (l) =>
      operationnel(l) && !aUnChauffeur(l) ? (
        <Link href="/affectations" onClick={(e) => e.stopPropagation()} className="bouton-discret h-7 px-2 text-[12px]">
          Affecter
        </Link>
      ) : !operationnel(l) ? (
        <Link href={`/flotte/${l.immatriculation}?onglet=${l.immobilisation ? "conformite" : "journal"}`} onClick={(e) => e.stopPropagation()} className="bouton-discret h-7 px-2 text-[12px]">
          {l.immobilisation ? "Régulariser" : "Voir"}
        </Link>
      ) : null,
  },
];

/** Le dernier statut déclaré pour chaque véhicule, à la date du jour. */
function statutsDeclares(jour: string): Map<string, StatutVehicule> {
  const parVehicule = new Map<string, { debut: string; statut: StatutVehicule }>();
  for (const c of lireToutesCreations("statut")) {
    if (!c.sujet.startsWith("vehicule:")) continue;
    const immatriculation = c.sujet.slice("vehicule:".length);
    const debut = String(c.valeurs.debut ?? c.date).slice(0, 10);
    /* Un statut à effet futur ne vaut pas aujourd'hui. */
    if (debut > jour) continue;
    const statut = String(c.valeurs.statut ?? "") as StatutVehicule;
    if (!statut) continue;
    const connu = parVehicule.get(immatriculation);
    if (!connu || debut >= connu.debut) parVehicule.set(immatriculation, { debut, statut });
  }
  return new Map([...parVehicule].map(([immat, x]) => [immat, x.statut]));
}

/**
 * Le contexte d'édition sert au seul crayon des pastilles de statut : c'est ici
 * qu'on découvre au matin qu'un camion ne partira pas, et c'est donc ici qu'on
 * doit pouvoir le déclarer en réparation — sans passer par sa fiche.
 */
export function EcranDisponibilite(props: { lignes: LigneDisponibilite[]; aujourdhui: string }) {
  return (
    <FournisseurEdition sujet="disponibilite" href="/disponibilite">
      <Interieur {...props} />
    </FournisseurEdition>
  );
}

function Interieur({ lignes: toutes, aujourdhui }: { lignes: LigneDisponibilite[]; aujourdhui: string }) {
  /* Le régime d'abord — tout le parc, exploitation, service, fonction —, puis la
     BU : KPI et liste parlent toujours de la même population. */
  const [regime, setRegime] = useState<RegimeUsage | "tout">("tout");
  const [bu, setBu] = useState<BusinessUnit | "toutes">("toutes");
  const bus = useMemo(() => (Object.keys(BUSINESS_UNIT) as BusinessUnit[]).filter((b) => toutes.some((l) => l.businessUnit === b)), [toutes]);

  /* Les créations vivent dans le navigateur : elles ne peuvent être lues qu'après
     le montage, sinon le rendu du serveur et celui du client divergeraient. */
  const [declares, setDeclares] = useState<Map<string, StatutVehicule>>(() => new Map());
  useEffect(() => setDeclares(statutsDeclares(aujourdhui)), [aujourdhui]);

  const aJour = useMemo(() => {
    if (declares.size === 0) return toutes;
    return toutes.map((l) => {
      const statutEffectif = declares.get(l.immatriculation);
      if (!statutEffectif || statutEffectif === l.statutEffectif) return l;
      /* Un statut déclaré prime sur celui du référentiel, document échu compris. */
      const base = { ...l, statutSaisi: statutEffectif, statutEffectif };
      const { etat, motif } = etatDisponibilite(base);
      return { ...base, etat, motif };
    });
  }, [toutes, declares]);

  const lignes = useMemo(() => aJour.filter((l) => (regime === "tout" || l.regime === regime) && (bu === "toutes" || l.businessUnit === bu)), [aJour, regime, bu]);

  const engages = lignes.filter((l) => l.engage && l.etat !== "hors-perimetre");
  const operationnels = engages.filter(operationnel);
  const avecChauffeur = operationnels.filter(aUnChauffeur);
  const sansChauffeur = operationnels.length - avecChauffeur.length;
  const tdpa = engages.length ? (operationnels.length / engages.length) * 100 : null;
  /* Ce qui peut partir ce matin : la charge utile des opérationnels qui ont un
     chauffeur, sur celle de tous les opérationnels. */
  const charge = (liste: LigneDisponibilite[]) => liste.reduce((t, l) => t + (l.chargeUtile ?? 0), 0);
  const chargePrete = charge(avecChauffeur);
  const chargeOperationnelle = charge(operationnels);

  const segment = (actif: boolean) => `h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${actif ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`;

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full lg:min-h-0">
      <TitreEcran
        titre="Disponibilité du jour"
        sousTitre={`Au ${date(aujourdhui)} · le statut du véhicule, et son chauffeur affecté ou pas`}
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <div className="sans-barre flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-surface-3 p-1" role="group" aria-label="Régime">
              {[{ cle: "tout" as const, libelle: "Tout le parc" }, ...(Object.keys(REGIME_USAGE) as RegimeUsage[]).map((r) => ({ cle: r, libelle: REGIME_USAGE[r].libelle }))].map((o) => (
                <button key={o.cle} type="button" aria-pressed={regime === o.cle} onClick={() => setRegime(o.cle)} className={segment(regime === o.cle)}>
                  {o.libelle}
                </button>
              ))}
            </div>
            {bus.length > 1 ? (
              <div className="sans-barre flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-surface-3 p-1" role="group" aria-label="Business unit">
                {[{ cle: "toutes" as const, libelle: "Toutes BU" }, ...bus.map((b) => ({ cle: b, libelle: BUSINESS_UNIT[b] }))].map((o) => (
                  <button key={o.cle} type="button" aria-pressed={bu === o.cle} onClick={() => setBu(o.cle)} className={segment(bu === o.cle)}>
                    {o.libelle}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        }
      />

      <div className="shrink-0">
        <BandeauKpi
          kpis={[
            { label: "Opérationnels", valeur: `${operationnels.length}`, unite: `/ ${engages.length}`, precision: "véhicules engagés au parc" },
            { label: "Disponibilité du parc", valeur: tdpa === null ? "—" : nombre(tdpa, 0), unite: "%", precision: "D_TDPA du jour — opérationnels sur engagés", ton: tdpa !== null && tdpa < 85 ? "defavorable" : "favorable" },
            { label: "Charge utile prête", valeur: nombre(chargePrete / 1000, 1), unite: "t", precision: `opérationnels avec chauffeur, sur ${nombre(chargeOperationnelle / 1000, 1)} t opérationnelles` },
            { label: "Sans chauffeur", valeur: `${sansChauffeur}`, precision: "véhicules opérationnels sans chauffeur affecté", ton: sansChauffeur > 0 ? "vigilance" : "favorable" },
          ]}
        />
      </div>

      <TableListe<LigneDisponibilite>
        ecran="disponibilite"
        lignes={lignes}
        cle={(l) => l.vehiculeId}
        href={(l) => `/flotte/${l.immatriculation}`}
        filet={(l) => ({ couleur: STATUT_VEHICULE[l.statutEffectif].couleur, libelle: STATUT_VEHICULE[l.statutEffectif].libelle, precision: STATUT_VEHICULE[l.statutEffectif].precision })}
        identifiant={IDENTIFIANT}
        colonnes={COLONNES}
        filtres={FILTRES}
        champsRecherche={(l) => [l.immatriculationAffichee, l.immatriculation, l.marque, l.appellation, l.conducteur?.nom ?? "", l.attributaire ?? "", l.site ?? ""]}
        placeholderRecherche="Immatriculation, chauffeur, site…"
        libelleRecherche="Rechercher un véhicule"
        libelleUnite="véhicules"
        vide="Aucun véhicule ne correspond."
      />
    </div>
  );
}
