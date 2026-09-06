"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from "lucide-react";
import { lireRole } from "@/lib/session-demo";
import { ChoixColonnes } from "./ChoixColonnes";
import { PoigneeLargeur } from "./PoigneeLargeur";
import { colonnesParDefaut, ecrireColonnes, ecrireLargeurs, lireColonnes, lireLargeurs } from "./preferences-liste";
import { retientFiltre, texteDe, triSuivant, trierLignes, valeurDeTri, type Tri } from "./tri";

/**
 * Carte de section — le bloc de base des fiches et du tableau de bord.
 *
 * Un titre de bloc à gauche, une action facultative à droite, le contenu en
 * dessous. Le traitement vient des références : rayon 14 px, un seul filet,
 * ombre à peine perceptible, titre en 15 px semi-gras plutôt qu'en majuscules.
 */
export function Carte({
  titre,
  precision,
  action,
  children,
  sansMarge,
  className = "",
}: {
  titre?: string;
  precision?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Vrai quand le contenu gère lui-même ses marges (tableau pleine largeur). */
  sansMarge?: boolean;
  className?: string;
}) {
  return (
    <section className={`carte flex min-w-0 flex-col ${className}`}>
      {titre ? (
        <header className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="titre-bloc">{titre}</h2>
            {precision ? <p className="meta mt-0.5">{precision}</p> : null}
          </div>
          {action ? <div className="ml-auto shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={sansMarge ? "min-w-0" : `min-w-0 px-5 pb-5 ${titre ? "" : "pt-5"}`}>{children}</div>
    </section>
  );
}

/**
 * Grille de définitions — libellé au-dessus, valeur en dessous, sur deux ou
 * trois colonnes. C'est la forme des blocs « Identification » et
 * « Caractéristiques » de la maquette validée.
 */
export function Definitions({
  elements,
  colonnes = 2,
}: {
  elements: { libelle: string; valeur: React.ReactNode }[];
  colonnes?: 2 | 3 | 4;
}) {
  const grille = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[colonnes];
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-4 ${grille}`}>
      {elements.map((e) => (
        <div key={e.libelle} className="min-w-0">
          <dt className="label-champ">{e.libelle}</dt>
          <dd className="mt-1 truncate text-[13.5px] text-texte">{e.valeur ?? <span className="text-attenue-2">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Largeur de la colonne des actions : un crayon, pas une colonne de données. */
const LARGEUR_ACTIONS = 48;

/**
 * Plafond de la largeur mesurée. La mesure se fait sur le contenu déployé —
 * sans quoi une cellule se couperait en deux dès le premier rendu ; sans
 * plafond, une colonne de commentaires prendrait à elle seule tout l'écran.
 */
const LARGEUR_MESUREE_MAX = 320;

/**
 * Tableau simple, pleine largeur d'une carte : en-tête en petites capitales,
 * lignes de 44 px, chiffres alignés à droite. Pour les listes de la fiche —
 * documents, interventions, mois de carburant — qui n'ont pas besoin des
 * colonnes figées de la liste flotte. Les largeurs, elles, se règlent quand le
 * tableau le demande (`ajustable`).
 */
export function TableauSimple<T>({
  colonnes,
  lignes,
  cle,
  vide = "Aucune ligne.",
  fixe = false,
  numero,
  cible,
  surModifier,
  filtrable,
  reglages,
  figerEnTete = "fiche",
  ajustable = false,
}: {
  colonnes: { cle: string; libelle: string; alignee?: "droite"; largeur?: string; rendu: (l: T) => React.ReactNode; parDefaut?: boolean }[];
  lignes: T[];
  cle: (l: T) => string;
  vide?: string;
  /** Vrai pour tenir dans une carte étroite : les colonnes sans largeur se partagent
   *  le reste et tronquent, au lieu d'élargir le tableau au-delà de la carte. */
  fixe?: boolean;
  /** Numéro de référence de la ligne, pour qu'une recherche puisse la viser. */
  numero?: (l: T) => string;
  /** Numéro visé : la ligne est soulignée et amenée à l'écran (voir `useCible`). */
  cible?: string;
  /** Ouvre la modification de la ligne : un crayon en bout de ligne, visible au survol. */
  surModifier?: (l: T) => void;
  /** Faux pour un tableau de quelques lignes où filtrer n'a pas de sens. */
  filtrable?: boolean;
  /**
   * Clé sous laquelle les colonnes choisies sont enregistrées pour le compte
   * (« fiche-vehicule.pleins »). Sans clé, pas de choix : toutes les colonnes.
   */
  reglages?: string;
  /**
   * Où l'en-tête se fige quand le contenu défile : dans une fiche (zone à
   * `py-6`), dans une page (zone à `py-7`), ou nulle part. Le décalage compense
   * le rembourrage du conteneur, sans quoi l'en-tête colle 24 px trop bas.
   */
  figerEnTete?: "fiche" | "page" | false;
  /**
   * Vrai pour que les colonnes se redimensionnent, comme sur la liste Flotte :
   * la poignée au bord droit de l'en-tête, les flèches au clavier, la largeur
   * enregistrée pour le compte quand `reglages` est donné.
   *
   * Le tableau défile alors dans sa propre boîte, en largeur comme en hauteur,
   * et son en-tête se fige en haut de cette boîte — `figerEnTete` ne s'applique
   * plus. C'est la forme d'un tableau de page qu'on lit colonne par colonne ;
   * dans une fiche, on préfère laisser la page défiler d'un seul tenant.
   */
  ajustable?: boolean;
}) {
  /* Colonnes visibles : celles du compte quand un réglage est enregistré,
     sinon celles marquées par défaut. La signature des clés, et non le
     tableau, sert de dépendance : les écrans recréent leurs colonnes à chaque
     rendu, et l'effet repartirait en boucle. */
  const signature = colonnes.map((c) => c.cle).join("|");
  const [visibles, setVisibles] = useState<string[]>(() => colonnesParDefaut(colonnes.map((c) => ({ cle: c.cle, parDefaut: c.parDefaut !== false }))));
  const [compte, setCompte] = useState<string | null>(null);
  useEffect(() => {
    const definitions = signature.split("|").map((cle) => ({ cle, parDefaut: colonnes.find((c) => c.cle === cle)?.parDefaut !== false }));
    if (!reglages) {
      setVisibles(colonnesParDefaut(definitions));
      return;
    }
    const role = lireRole() ?? "invite";
    setCompte(role);
    setVisibles(lireColonnes(reglages, role, definitions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reglages, signature]);

  const definitions = useMemo(() => colonnes.map((c) => ({ cle: c.cle, parDefaut: c.parDefaut !== false })), [colonnes]);
  const affichees_colonnes = useMemo(() => (reglages ? colonnes.filter((c) => visibles.includes(c.cle)) : colonnes), [colonnes, visibles, reglages]);

  function basculerColonne(c: string) {
    setVisibles((precedent) => {
      const suivant = precedent.includes(c) ? precedent.filter((x) => x !== c) : colonnes.filter((x) => precedent.includes(x.cle) || x.cle === c).map((x) => x.cle);
      if (reglages && compte) ecrireColonnes(reglages, compte, suivant, definitions);
      return suivant;
    });
  }

  function retablirColonnes() {
    const defaut = colonnesParDefaut(definitions);
    setVisibles(defaut);
    if (reglages && compte) ecrireColonnes(reglages, compte, defaut, definitions);
    if (ajustable) {
      /* Vidées, les largeurs se remesurent au rendu suivant : on retrouve la
         largeur naturelle du contenu, et non une largeur par défaut inventée. */
      largeursRef.current = {};
      setLargeurs({});
      if (reglages && compte) ecrireLargeurs(reglages, compte, {});
    }
  }

  /*
   * Largeurs réglables — la base est *mesurée*, pas déclarée.
   *
   * Un tableau de carte ne déclare pas ses largeurs : il laisse le navigateur
   * répartir. On part donc de ce que le navigateur a décidé au premier rendu,
   * et le réglage de l'utilisateur se pose par-dessus. Une colonne déjà connue
   * n'est jamais remesurée — sa largeur imposée reviendrait à la place de sa
   * largeur naturelle, et la remise à zéro ne rétablirait plus rien.
   */
  const enTetes = useRef<Map<string, HTMLTableCellElement | null>>(new Map());
  const [largeurs, setLargeurs] = useState<Record<string, number>>({});
  /* Miroir : au relâchement de la poignée, l'état React n'est pas encore à jour. */
  const largeursRef = useRef<Record<string, number>>({});
  const signatureVisible = affichees_colonnes.map((c) => c.cle).join("|");

  useEffect(() => {
    if (!ajustable) return;
    const mesurees: Record<string, number> = {};
    for (const cle of signatureVisible.split("|")) {
      if (largeursRef.current[cle] !== undefined) continue;
      const el = enTetes.current.get(cle);
      if (el) mesurees[cle] = Math.min(LARGEUR_MESUREE_MAX, Math.round(el.getBoundingClientRect().width));
    }
    if (Object.keys(mesurees).length === 0) return;
    const role = compte ?? lireRole() ?? "invite";
    largeursRef.current = { ...largeursRef.current, ...(reglages ? lireLargeurs(reglages, role, mesurees) : mesurees) };
    setLargeurs(largeursRef.current);
  }, [ajustable, signatureVisible, reglages, compte]);

  function ajusterLargeur(c: string, px: number) {
    largeursRef.current = { ...largeursRef.current, [c]: px };
    setLargeurs(largeursRef.current);
  }

  function enregistrerLargeurs() {
    if (reglages && compte) ecrireLargeurs(reglages, compte, largeursRef.current);
  }

  /* Tant qu'une colonne n'est pas mesurée, on laisse le navigateur faire : les
     largeurs ne s'imposent qu'une fois toutes connues, sinon la table sauterait. */
  const largeursPretes = ajustable && affichees_colonnes.length > 0 && affichees_colonnes.every((c) => largeurs[c.cle] !== undefined);
  const largeurTotale = largeursPretes ? affichees_colonnes.reduce((somme, c) => somme + largeurs[c.cle], 0) + (surModifier ? LARGEUR_ACTIONS : 0) : undefined;

  /* Un tableau réglable défile dans sa propre boîte : son en-tête s'y fige, en
     haut de la boîte et non de la page (voir le conteneur plus bas). */
  const dansBoite = ajustable;
  const classeFige = dansBoite
    ? "sticky top-0 z-10"
    : figerEnTete === "fiche"
      ? "sticky top-0 z-10 lg:-top-6"
      : figerEnTete === "page"
        ? "sticky top-0 z-10 lg:-top-7"
        : "";
  const enTeteFige = figerEnTete;
  /* Tri sur ce que la colonne affiche, filtre sur ce que la ligne affiche :
     aucune configuration à fournir, chaque tableau les a. */
  const [tri, setTri] = useState<Tri | null>(null);
  const [filtre, setFiltre] = useState("");
  const parCle = useMemo(() => new Map(colonnes.map((c) => [c.cle, c])), [colonnes]);

  const affichees = useMemo(() => {
    const texteLigne = (l: T) => colonnes.map((c) => texteDe(c.rendu(l))).join(" ");
    const filtrees = filtre.trim() ? lignes.filter((l) => retientFiltre(texteLigne(l), filtre)) : lignes;
    return trierLignes(filtrees, tri, (l, cle) => {
      const c = parCle.get(cle);
      return c ? valeurDeTri(texteDe(c.rendu(l))) : null;
    });
  }, [lignes, colonnes, parCle, filtre, tri]);

  const peutFiltrer = filtrable ?? lignes.length > 5;

  return (
    <div className="min-w-0">
      {peutFiltrer || reglages ? (
        /* Hors de la zone de défilement : filtrer un tableau dont la barre de
           filtre est partie avec le défilement n'a pas de sens. */
        <div className="flex items-center gap-3 px-5 pb-3">
          {peutFiltrer ? (
            <label className="champ-pilule h-8 w-full max-w-[320px]">
              <Search className="size-3.5 shrink-0 text-attenue" strokeWidth={1.8} />
              <input
                type="search"
                value={filtre}
                onChange={(e) => setFiltre(e.target.value)}
                placeholder="Filtrer les lignes…"
                aria-label="Filtrer les lignes"
                className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-attenue"
              />
            </label>
          ) : null}
          {filtre.trim() ? (
            <span className="meta code whitespace-nowrap">
              {affichees.length} sur {lignes.length}
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-2">
            {tri ? (
              <button type="button" onClick={() => setTri(null)} className="meta whitespace-nowrap hover:text-texte">
                Ordre d&apos;origine
              </button>
            ) : null}
            {reglages ? (
              <ChoixColonnes
                compact
                colonnes={colonnes}
                visibles={visibles}
                onBasculer={basculerColonne}
                onRetablir={retablirColonnes}
                {...(ajustable
                  ? {
                      libelleRetablir: "Rétablir colonnes et largeurs",
                      note: "Colonnes et largeurs sont enregistrées pour votre compte. Pour ajuster une largeur, glissez le bord droit de son en-tête.",
                    }
                  : {})}
              />
            ) : null}
          </span>
        </div>
      ) : null}
      {/*
       * Où le tableau défile, et où son en-tête se fige.
       *
       * Les deux ne font qu'un : un en-tête `sticky` se fige par rapport à sa
       * zone de défilement. Sans zone, il se fige dans la page (`clip` empêche
       * alors le conteneur d'en devenir une, ce qui le décrocherait) ; avec une
       * zone, il se fige en haut d'elle.
       *
       * Un tableau réglable défile donc dans sa propre boîte, plafonnée à 70 %
       * de la hauteur d'écran : c'est ce qui lui permet de défiler en largeur
       * sans perdre ses en-têtes de vue.
       */}
      <div className={dansBoite ? "defilement-discret max-h-[70vh] overflow-auto" : enTeteFige ? "overflow-x-clip" : "defilement-discret overflow-x-auto"}>
      <table
        className={`border-separate border-spacing-0 ${
          largeursPretes ? "table-fixed" : ajustable ? "w-max min-w-full" : `w-full ${fixe ? "table-fixed" : ""}`
        }`}
        style={largeursPretes ? { width: largeurTotale, minWidth: "100%" } : undefined}
      >
        {largeursPretes ? (
          <colgroup>
            {affichees_colonnes.map((c) => (
              <col key={c.cle} style={{ width: largeurs[c.cle] }} />
            ))}
            {surModifier ? <col style={{ width: LARGEUR_ACTIONS }} /> : null}
          </colgroup>
        ) : null}
        <thead>
          <tr>
            {affichees_colonnes.map((c) => {
              const actif = tri?.cle === c.cle;
              return (
                <th
                  key={c.cle}
                  ref={(el) => {
                    enTetes.current.set(c.cle, el);
                  }}
                  style={largeursPretes ? undefined : { width: c.largeur }}
                  aria-sort={actif ? (tri!.sens === "asc" ? "ascending" : "descending") : "none"}
                  className={`en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-5 whitespace-nowrap ${ajustable ? "relative" : ""} ${classeFige} ${
                    c.alignee === "droite" ? "text-right" : "text-left"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setTri((t) => triSuivant(t, c.cle))}
                    title={actif ? (tri!.sens === "asc" ? "Tri croissant — cliquer pour décroissant" : "Tri décroissant — cliquer pour retirer le tri") : "Trier"}
                    className={`group inline-flex max-w-full items-center gap-1 ${c.alignee === "droite" ? "flex-row-reverse" : ""} ${actif ? "text-texte" : "hover:text-texte"}`}
                  >
                    <span className="truncate">{c.libelle}</span>
                    {actif ? (
                      tri!.sens === "asc" ? <ChevronUp className="size-3 shrink-0" strokeWidth={2.2} /> : <ChevronDown className="size-3 shrink-0" strokeWidth={2.2} />
                    ) : (
                      <ChevronsUpDown className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" strokeWidth={2} />
                    )}
                  </button>
                  {ajustable && largeurs[c.cle] !== undefined ? (
                    <PoigneeLargeur largeur={largeurs[c.cle]} onLargeur={(px) => ajusterLargeur(c.cle, px)} onFin={enregistrerLargeurs} libelle={c.libelle} />
                  ) : null}
                </th>
              );
            })}
            {surModifier ? <th className={`h-10 w-12 border-y border-bordure bg-surface-2 p-0 ${classeFige}`} aria-label="Actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {affichees.map((l) => {
            const n = numero?.(l);
            const visee = n !== undefined && n === cible;
            return (
            <tr key={cle(l)} data-numero={n} className={`group ${visee ? "bg-accent-fond" : "hover:bg-surface-2"}`}>
              {affichees_colonnes.map((c) => (
                <td
                  key={c.cle}
                  className={`h-11 border-b border-bordure px-5 text-[13px] text-texte last:border-b-0 ${
                    c.alignee === "droite" ? "code text-right" : ""
                  }`}
                >
                  {c.rendu(l)}
                </td>
              ))}
              {surModifier ? (
                <td className="h-11 w-12 border-b border-bordure p-0 text-center last:border-b-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      surModifier(l);
                    }}
                    title="Modifier — chaque modification est tracée"
                    className="grid size-7 place-items-center rounded-full text-attenue opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-3 hover:text-texte focus-visible:opacity-100"
                  >
                    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    <span className="sr-only">Modifier</span>
                  </button>
                </td>
              ) : null}
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      {lignes.length === 0 ? <p className="meta px-5 py-6 text-center">{vide}</p> : affichees.length === 0 ? <p className="meta px-5 py-6 text-center">Aucune ligne ne correspond au filtre.</p> : null}
    </div>
  );
}
