"use client";

import { useMemo } from "react";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { CHAMPS } from "@/composants/transactions/champs";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerLigneIncident } from "@/composants/transactions/fabriques";
import { ROULANT, TON_STATUT_DECLARATION, estEnCours, type LigneIncident } from "@/domaine/incidents";
import type { FicheVehicule } from "@/domaine/fiche";
import { NATURE_INCIDENT, RESPONSABILITE, STATUT_DECLARATION, TYPE_INCIDENT } from "@/domaine/libelles";
import { incidentsDuVehicule } from "@/donnees/incidents-demo";
import { dateCourte, montant, montantCourt } from "@/lib/format";

/* ============================================================================
 * Fiche véhicule › Incidents & sinistres — la liste des déclarations du
 * véhicule (un seul type de transaction, règle des onglets), le coût et les
 * jours d'immobilisation en précision d'en-tête. « Ajouter › Déclarer » de la
 * fiche ouvre le formulaire en quatre étapes ; la déclaration créée arrive ici.
 * ==========================================================================*/

export function OngletIncidents({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
  const { creations, creationsLiees, surcharger, demander } = useEdition();
  const vehiculeId = fiche.ligne.vehicule.id;
  const lignes = useMemo(() => {
    /* Une déclaration saisie depuis la fiche d'un chauffeur cite le véhicule :
       elle appartient à ce véhicule autant qu'au chauffeur, et doit se lire
       ici. C'est le rangement par fiche de la démonstration qui les sépare. */
    const creees = [...creations("incident", fabriquerLigneIncident), ...creationsLiees("incident", (c) => String(c.valeurs.vehiculeId ?? "") === vehiculeId, fabriquerLigneIncident)];
    return [...creees, ...incidentsDuVehicule(vehiculeId)].map((l) => surcharger(l));
  }, [creations, creationsLiees, surcharger, vehiculeId]);

  const cout = lignes.reduce((s, l) => s + (l.cout ?? 0), 0);
  const jours = lignes.reduce((s, l) => s + (l.immobilisationJours ?? 0), 0);
  const enCours = lignes.filter((l) => estEnCours(l.statut)).length;

  return (
    <Carte
      titre="Incidents & sinistres"
      precision={lignes.length ? `${lignes.length} déclaration${lignes.length > 1 ? "s" : ""} · ${enCours} en cours · ${montant(cout)} de coûts rattachés · ${jours} j d'immobilisation` : "Aucune déclaration sur ce véhicule"}
      sansMarge
    >
      <TableauSimple<LigneIncident> reglages="fiche-vehicule.incidents"
        cle={(l) => l.numero}
        numero={(l) => l.numero}
        cible={cible}
        lignes={lignes}
        vide="Aucune déclaration — « Ajouter › Déclarer un incident ou un accident » pour en saisir une."
        surModifier={(l) => demander({ type: "incident", numero: l.numero, titre: `Déclaration ${l.numero}`, valeurs: l as unknown as Record<string, unknown>, champs: CHAMPS.incident })}
        colonnes={[
          { cle: "date", libelle: "Date", rendu: (l) => <span className="code">{dateCourte(l.dateHeure.slice(0, 10))}</span> },
          { cle: "nature", libelle: "Nature", rendu: (l) => <Pastille ton={l.nature === "accident" ? "defavorable" : "vigilance"}>{NATURE_INCIDENT[l.nature]}</Pastille> },
          { cle: "type", libelle: "Type", rendu: (l) => <span className="font-medium">{TYPE_INCIDENT[l.type]}</span> },
          { cle: "chauffeur", libelle: "Conducteur", rendu: (l) => l.chauffeur ?? <span className="text-attenue">non affecté</span> },
          { cle: "lieu", libelle: "Lieu", rendu: (l) => l.lieu },
          { cle: "roulant", libelle: "Roulant", rendu: (l) => <Echeance ton={l.roulant === "oui" ? "favorable" : l.roulant === "non" ? "defavorable" : "vigilance"}>{ROULANT[l.roulant]}</Echeance> },
          { cle: "responsabilite", libelle: "Responsabilité", rendu: (l) => (l.responsabilite ? RESPONSABILITE[l.responsabilite] : <span className="text-attenue">—</span>) },
          { cle: "sinistre", libelle: "Sinistre", rendu: (l) => (l.sinistreOuvert ? <Echeance ton="vigilance">Dossier ouvert</Echeance> : <span className="text-attenue">—</span>) },
          { cle: "cout", libelle: "Coût", alignee: "droite", rendu: (l) => (l.cout === null ? <span className="text-attenue">—</span> : <span className="code">{montantCourt(l.cout)}</span>) },
          { cle: "immobilisation", libelle: "Immob.", alignee: "droite", rendu: (l) => (l.immobilisationJours === null ? <span className="text-attenue">—</span> : <span className="code">{l.immobilisationJours} j</span>) },
          { cle: "statut", libelle: "Suivi", rendu: (l) => <Echeance ton={TON_STATUT_DECLARATION[l.statut]}>{STATUT_DECLARATION[l.statut]}</Echeance> },
        ]}
      />
    </Carte>
  );
}
