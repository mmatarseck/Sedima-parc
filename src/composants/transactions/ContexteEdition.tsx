"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ChampEdition, Creation } from "@/domaine/cloture";
import type { TypeTransaction } from "@/domaine/reference";
import { lireCreations, lireToutesCreations, lireToutesSurcharges } from "@/lib/clotures-demo";
import dynamic from "next/dynamic";

/* La modale — et avec elle les champs, le catalogue des références et les
   listes de choix — ne se charge qu'à la première ouverture : un lecteur qui
   ne crée rien ne la télécharge pas (revue de performance du 8 septembre 2026). */
const ModaleTransaction = dynamic(() => import("./ModaleTransaction").then((m) => m.ModaleTransaction), { ssr: false });

/* ============================================================================
 * Contexte d'édition d'une fiche.
 *
 * Trois services aux onglets : `surcharger`, qui recouvre un objet affiché des
 * valeurs modifiées depuis ; `creations`, qui donne ce qui a été créé sur la
 * fiche depuis l'application (le jeu de démonstration ne bouge pas, la fiche
 * montre pourtant ce qui a changé) ; `demander` et `creer`, qui ouvrent la
 * modale sur une transaction existante ou nouvelle. La modale vit ici, une
 * fois pour toute la fiche, et fait remonter chaque enregistrement.
 * ==========================================================================*/

export interface DemandeEdition {
  type: TypeTransaction;
  numero: string;
  titre: string;
  valeurs: Record<string, unknown>;
  /** Champs à proposer ; ceux du type par défaut. */
  champs?: ChampEdition[];
}

export interface DemandeCreation {
  type: TypeTransaction;
  titre: string;
  champs: ChampEdition[];
  /** Valeurs proposées d'avance : la date du jour, le véhicule de la fiche… */
  valeurs?: Record<string, unknown>;
  /** Où ranger la création, quand ce n'est pas la fiche courante : le planning range sur le véhicule choisi. */
  sujetDe?: (valeurs: Record<string, unknown>) => string;
  /** Ce que la création entraîne ailleurs, une fois numérotée : clore l'ordre de travail qu'une intervention réalise. */
  apresCreation?: (creation: Creation) => void;
  /** Ce qu'un champ entraîne sur les autres dans le formulaire : la dépense réglée remplit le libellé et le montant. */
  entraine?: (cle: string, valeur: string | boolean, saisie: Record<string, string | boolean>) => Record<string, string | boolean> | null;
}

interface Edition {
  sujet: string;
  demander: (d: DemandeEdition) => void;
  creer: (d: DemandeCreation) => void;
  surcharger: <T extends { numero: string }>(objet: T) => T;
  /** Ce qui a été créé sur cette fiche, du plus récent au plus ancien, fabriqué à la forme voulue. */
  creations: <T>(type: TypeTransaction, fabriquer: (c: Creation) => T | null) => T[];
  /**
   * Ce qui a été créé sur une **autre** fiche mais concerne celle-ci : l'incident
   * déclaré depuis un chauffeur appartient aussi au véhicule qu'il cite. Les
   * créations sont rangées par fiche ; en base, une transaction est une ligne
   * que ses clés étrangères rattachent aux deux, et cette fonction disparaîtra.
   */
  creationsLiees: <T>(type: TypeTransaction, concerne: (c: Creation) => boolean, fabriquer: (c: Creation) => T | null) => T[];
  /** Change à chaque enregistrement : ce qui en dépend se recalcule. */
  version: number;
  /** À appeler quand une création a eu lieu hors de la modale (formulaire de déclaration). */
  actualiser: () => void;
}

const Contexte = createContext<Edition | null>(null);

type Courante = { mode: "modification"; d: DemandeEdition } | { mode: "creation"; d: DemandeCreation };

export function FournisseurEdition({ sujet, href, children }: { sujet: string; href: string; children: React.ReactNode }) {
  const [surcharges, setSurcharges] = useState<Map<string, Record<string, unknown>>>(() => new Map());
  const [creees, setCreees] = useState<Creation[]>([]);
  const [version, setVersion] = useState(0);
  const [courante, setCourante] = useState<Courante | null>(null);

  useEffect(() => {
    setSurcharges(lireToutesSurcharges());
    setCreees(lireCreations(sujet));
  }, [version, sujet]);

  const surcharger = useCallback(
    <T extends { numero: string }>(objet: T): T => {
      const s = surcharges.get(objet.numero);
      return s ? { ...objet, ...s } : objet;
    },
    [surcharges],
  );

  const creations = useCallback(
    <T,>(type: TypeTransaction, fabriquer: (c: Creation) => T | null): T[] =>
      creees
        .filter((c) => c.type === type)
        .map((c) => fabriquer({ ...c, valeurs: { ...c.valeurs, ...(surcharges.get(c.numero) ?? {}) } }))
        .filter((x): x is T => x !== null),
    [creees, surcharges],
  );

  const creationsLiees = useCallback(
    <T,>(type: TypeTransaction, concerne: (c: Creation) => boolean, fabriquer: (c: Creation) => T | null): T[] =>
      lireToutesCreations(type)
        /* Celles de la fiche courante sont déjà servies par `creations` : les
           reprendre ici les afficherait deux fois. */
        .filter((c) => c.sujet !== sujet && concerne(c))
        .map((c) => fabriquer({ ...c, valeurs: { ...c.valeurs, ...(surcharges.get(c.numero) ?? {}) } }))
        .filter((x): x is T => x !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sujet, surcharges, version],
  );

  const valeur = useMemo<Edition>(
    () => ({
      sujet,
      demander: (d) => setCourante({ mode: "modification", d }),
      creer: (d) => setCourante({ mode: "creation", d }),
      surcharger,
      creations,
      creationsLiees,
      version,
      actualiser: () => setVersion((v) => v + 1),
    }),
    [sujet, surcharger, creations, creationsLiees, version],
  );

  return (
    <Contexte.Provider value={valeur}>
      {children}
      {courante?.mode === "modification" ? (
        <ModaleTransaction
          mode="modification"
          sujet={sujet}
          type={courante.d.type}
          numero={courante.d.numero}
          titre={courante.d.titre}
          champs={courante.d.champs}
          valeurs={surcharger({ numero: courante.d.numero, ...courante.d.valeurs })}
          href={href}
          onFermer={() => setCourante(null)}
          onEnregistre={() => setVersion((v) => v + 1)}
        />
      ) : null}
      {courante?.mode === "creation" ? (
        <ModaleTransaction
          mode="creation"
          sujet={sujet}
          sujetDe={courante.d.sujetDe}
          apresCreation={courante.d.apresCreation}
          entraine={courante.d.entraine}
          type={courante.d.type}
          numero={null}
          titre={courante.d.titre}
          champs={courante.d.champs}
          valeurs={courante.d.valeurs ?? {}}
          href={href}
          onFermer={() => setCourante(null)}
          onEnregistre={() => setVersion((v) => v + 1)}
        />
      ) : null}
    </Contexte.Provider>
  );
}

export function useEdition(): Edition {
  const c = useContext(Contexte);
  if (!c) throw new Error("useEdition s'emploie sous FournisseurEdition");
  return c;
}
