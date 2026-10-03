"use client";

import { useEffect, useMemo, useState } from "react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { BandeauKpi } from "@/composants/interface/BandeauKpi";
import { FournisseurEdition } from "@/composants/transactions/ContexteEdition";
import { etatDisponibilite, type LigneDisponibilite } from "@/domaine/disponibilite";
import { lireToutesCreations } from "@/lib/clotures-demo";
import type { StatutVehicule } from "@/domaine/types";
import { STATUT_VEHICULE } from "@/domaine/libelles";
import { date, nombre } from "@/lib/format";
import type { LigneCamionTiers } from "@/domaine/camions-tiers";
import { avecAttelages, pointDuMatin } from "@/domaine/point-du-matin";
import { PointDuMatin } from "./PointDuMatin";

/* ============================================================================
 * Disponibilité du jour — les véhicules d'exploitation et ceux des
 * transporteurs, pour les opérations de la journée.
 *
 * Un bandeau, puis le point du matin (métier, 3 octobre 2026) : par BU, le parc
 * SEDIMA puis chaque transporteur, les véhicules prêts et leurs capacités. Un
 * clic sur la pastille d'un véhicule ouvre sa fenêtre d'ajustement — statut,
 * chauffeur (au quart), BU, site ; à la validation, le véhicule est mis à jour.
 * La longue liste qui suivait a quitté l'écran : elle doublait le tableau, et
 * c'est sur le véhicule qu'on agit.
 *
 * **Un changement de statut déclaré dans l'application** n'est connu du serveur
 * qu'au rendu suivant. L'écran le reprend donc au montage, et l'état de
 * disponibilité se recalcule avec : déclarer qu'un véhicule est en réparation
 * doit le sortir des prêts à charger le matin même.
 * ==========================================================================*/

const aUnChauffeur = (l: LigneDisponibilite) => l.conducteur !== null || l.attributaire !== null;
const operationnel = (l: LigneDisponibilite) => STATUT_VEHICULE[l.statutEffectif].operationnel;

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

/** Le contexte d'édition porte la fenêtre d'ajustement : c'est ici qu'on découvre au matin qu'un camion ne partira pas. */
export function EcranDisponibilite(props: { lignes: LigneDisponibilite[]; camions: LigneCamionTiers[]; aujourdhui: string }) {
  return (
    <FournisseurEdition sujet="disponibilite" href="/disponibilite">
      <Interieur {...props} />
    </FournisseurEdition>
  );
}

function Interieur({ lignes: toutes, camions, aujourdhui }: { lignes: LigneDisponibilite[]; camions: LigneCamionTiers[]; aujourdhui: string }) {
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

  const point = useMemo(() => pointDuMatin(aJour, camions, aujourdhui), [aJour, camions, aujourdhui]);
  const jourLong = new Date(`${aujourdhui}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  /* Les compteurs parlent du parc SEDIMA, en unités qui roulent : un tracteur et sa semi n'en font qu'une, comme au point du matin (métier, 3 octobre 2026). */
  const engages = avecAttelages(aJour).filter((l) => l.engage && l.etat !== "hors-perimetre");
  const operationnels = engages.filter(operationnel);
  const avecChauffeur = operationnels.filter(aUnChauffeur);
  const sansChauffeur = operationnels.length - avecChauffeur.length;
  const tdpa = engages.length ? (operationnels.length / engages.length) * 100 : null;

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran titre="Disponibilité du jour" sousTitre={`Au ${date(aujourdhui)} · les véhicules d'exploitation et ceux des transporteurs — un clic sur un véhicule pour l'ajuster`} />

      <div className="shrink-0">
        <BandeauKpi
          kpis={[
            { label: "Parc SEDIMA opérationnel", valeur: `${operationnels.length}`, unite: `/ ${engages.length}`, precision: "véhicules engagés — un attelage compte pour un" },
            { label: "Disponibilité du parc", valeur: tdpa === null ? "—" : nombre(tdpa, 0), unite: "%", precision: "D_TDPA du jour — opérationnels sur engagés", ton: tdpa !== null && tdpa < 85 ? "defavorable" : "favorable" },
            { label: "Prêts avec chauffeur", valeur: `${point.totalVehicules}`, precision: `${point.parcPrets} parc SEDIMA + ${point.tiersPrets} transporteurs` },
            { label: "Sans chauffeur", valeur: `${sansChauffeur}`, precision: "véhicules du parc opérationnels sans chauffeur affecté", ton: sansChauffeur > 0 ? "vigilance" : "favorable" },
          ]}
        />
      </div>

      <PointDuMatin point={point} jourLong={jourLong} lignes={aJour} camions={camions} />
    </div>
  );
}
