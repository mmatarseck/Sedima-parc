"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { IndicateurPiece } from "@/composants/interface/IndicateurPiece";
import { ListeEtPiece } from "@/composants/interface/ListeEtPiece";
import { VisionneusePiece } from "@/composants/interface/VisionneusePiece";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { CHAMPS } from "@/composants/transactions/champs";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerLigneIncident } from "@/composants/transactions/fabriques";
import { ROULANT, TON_STATUT_DECLARATION, estEnCours, type LigneIncident } from "@/domaine/incidents";
import type { FicheVehicule } from "@/domaine/fiche";
import { NATURE_INCIDENT, RESPONSABILITE, STATUT_DECLARATION, TYPE_INCIDENT } from "@/domaine/libelles";
import { dateCourte, montant, montantCourt } from "@/lib/format";

/* ============================================================================
 * Fiche véhicule › Incidents & sinistres — la liste des déclarations du
 * véhicule (un seul type de transaction, règle des onglets), le coût et les
 * jours d'immobilisation en précision d'en-tête. « Déclarer », en tête de
 * liste comme sur les autres onglets (21 septembre 2026), ouvre le formulaire
 * en quatre étapes — photos et documents compris ; la déclaration créée arrive
 * ici. Un clic sur une ligne ouvre ses pièces à droite, une à une.
 * ==========================================================================*/

export function OngletIncidents({ fiche, cible, onDeclarer }: { fiche: FicheVehicule; cible?: string; onDeclarer?: () => void }) {
  const { creations, creationsLiees, surcharger, demander } = useEdition();
  const vehiculeId = fiche.ligne.vehicule.id;
  const lignes = useMemo(() => {
    /* Une déclaration saisie depuis la fiche d'un chauffeur cite le véhicule :
       elle appartient à ce véhicule autant qu'au chauffeur, et doit se lire
       ici. C'est le rangement par fiche de la démonstration qui les sépare. */
    const creees = [...creations("incident", fabriquerLigneIncident), ...creationsLiees("incident", (c) => String(c.valeurs.vehiculeId ?? "") === vehiculeId, fabriquerLigneIncident)];
    /* Les incidents de la fiche, et non plus ceux du jeu de démonstration :
       l'onglet montrait des accidents inventés sur un camion réel (corrigé le
       15 septembre 2026). Ils passent par le même convertisseur que l'écran
       Incidents et que le rapport — les trois disent donc la même chose. */
    return [...creees, ...fiche.incidents].map((l) => surcharger(l));
  }, [creations, creationsLiees, surcharger, vehiculeId, fiche.incidents]);

  const cout = lignes.reduce((s, l) => s + (l.cout ?? 0), 0);
  const jours = lignes.reduce((s, l) => s + (l.immobilisationJours ?? 0), 0);
  const enCours = lignes.filter((l) => estEnCours(l.statut)).length;
  const [ouverte, setOuverte] = useState<{ numero: string; rang: number } | null>(null);
  const ligneOuverte = ouverte ? (lignes.find((l) => l.numero === ouverte.numero) ?? null) : null;
  const pieces = ligneOuverte?.pieces ?? [];
  const rang = Math.min(ouverte?.rang ?? 0, Math.max(0, pieces.length - 1));

  return (
    <ListeEtPiece
      piece={
        ligneOuverte ? (
          <VisionneusePiece
            fichier={pieces[rang] ?? null}
            libelle={`${NATURE_INCIDENT[ligneOuverte.nature]} · ${TYPE_INCIDENT[ligneOuverte.type]}`}
            precision={[dateCourte(ligneOuverte.dateHeure.slice(0, 10)), ligneOuverte.lieu || null, pieces.length > 1 ? `pièce ${rang + 1} sur ${pieces.length}` : null].filter(Boolean).join(" · ")}
            vide="Aucune photo ni document sur cette déclaration."
            onFermer={() => setOuverte(null)}
            actions={
              pieces.length > 1 ? (
                <span className="flex items-center gap-1">
                  <button type="button" disabled={rang === 0} onClick={() => setOuverte({ numero: ligneOuverte.numero, rang: rang - 1 })} className="bouton-discret size-9 justify-center p-0 disabled:opacity-30" aria-label="Pièce précédente">
                    <ChevronLeft className="size-4" strokeWidth={1.8} />
                  </button>
                  <button type="button" onClick={() => setOuverte({ numero: ligneOuverte.numero, rang: rang + 1 })} disabled={rang + 1 >= pieces.length} className="bouton-discret size-9 justify-center p-0 disabled:opacity-30" aria-label="Pièce suivante">
                    <ChevronRight className="size-4" strokeWidth={1.8} />
                  </button>
                </span>
              ) : null
            }
          />
        ) : null
      }
    >
    <Carte
      titre="Incidents & sinistres"
      precision={lignes.length ? `${lignes.length} déclaration${lignes.length > 1 ? "s" : ""} · ${enCours} en cours · ${montant(cout)} de coûts rattachés · ${jours} j d'immobilisation` : "Aucune déclaration sur ce véhicule"}
      action={
        onDeclarer ? (
          <button type="button" onClick={onDeclarer} className="bouton-secondaire h-9" title="Panne, accident, vol, vandalisme — avec photos et documents">
            <AlertTriangle className="size-4" strokeWidth={1.8} />
            Déclarer un incident ou sinistre
          </button>
        ) : undefined
      }
      sansMarge
    >
      <TableauSimple<LigneIncident> reglages="fiche-vehicule.incidents"
        cle={(l) => l.numero}
        numero={(l) => l.numero}
        cible={cible}
        lignes={lignes}
        vide="Aucune déclaration — « Déclarer un incident ou sinistre » pour en saisir une."
        seulement={ligneOuverte ? ["date", "type", "statut"] : undefined}
        surLigne={(l) => setOuverte((o) => (o?.numero === l.numero ? null : { numero: l.numero, rang: 0 }))}
        ouverte={ouverte?.numero ?? null}
        surModifier={(l) => demander({ type: "incident", numero: l.numero, titre: `Déclaration ${l.numero}`, valeurs: l as unknown as Record<string, unknown>, champs: CHAMPS.incident })}
        colonnes={[
          { cle: "date", libelle: "Date", rendu: (l) => <span className="code">{dateCourte(l.dateHeure.slice(0, 10))}</span> },
          { cle: "nature", libelle: "Nature", rendu: (l) => <Pastille ton={l.nature === "accident" ? "defavorable" : "vigilance"}>{NATURE_INCIDENT[l.nature]}</Pastille> },
          {
            cle: "type",
            libelle: "Type",
            rendu: (l) => (
              <span className="flex items-center gap-2">
                <IndicateurPiece present={Boolean(l.pieces?.length)} />
                <span className="font-medium">{TYPE_INCIDENT[l.type]}</span>
                {(l.pieces?.length ?? 0) > 1 ? <span className="meta">{l.pieces!.length}</span> : null}
              </span>
            ),
          },
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
    </ListeEtPiece>
  );
}
