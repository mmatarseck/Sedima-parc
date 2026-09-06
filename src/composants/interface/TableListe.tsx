"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, Search } from "lucide-react";
import { lireRole } from "@/lib/session-demo";
import { ChoixColonnes } from "./ChoixColonnes";
import { PoigneeLargeur } from "./PoigneeLargeur";
import { colonnesParDefaut, ecrireColonnes, ecrireLargeurs, lireColonnes, lireLargeurs } from "./preferences-liste";
import { texteDe, triSuivant, trierLignes, valeurDeTri, type Tri } from "./tri";

/* ============================================================================
 * Liste de référentiel — le tableau des écrans Flotte, Chauffeurs, et de tous
 * ceux qui viendront.
 *
 * Ce qu'il fait, et que chaque écran n'a plus à refaire : recherche et filtres
 * en bascule dans la barre d'outils de la carte, une seule colonne figée qui
 * identifie la ligne, précédée d'un filet de couleur qui porte le statut,
 * colonnes au choix et largeurs réglables enregistrées par compte, en-tête
 * figé, défilement latéral par flèches calé sur les colonnes, pagination en pied.
 *
 * Ce qu'il ne décide pas : ce qu'il y a dans les colonnes. Chaque écran le lui
 * dit, avec ses libellés et ses largeurs par défaut.
 * ==========================================================================*/

export interface ColonneListe<T> {
  cle: string;
  libelle: string;
  alignee?: "droite";
  parDefaut: boolean;
  largeur: number;
  rendu: (ligne: T) => React.ReactNode;
  /** Clé de tri explicite ; sinon, le texte affiché (dates et nombres reconnus). */
  tri?: (ligne: T) => number | string | null;
  /** Texte de la cellule pour la recherche et le tri, quand le rendu ne le porte pas (pastille sans enfants). */
  texte?: (ligne: T) => string;
}

/** La colonne figée : identifie la ligne, ne se masque pas, s'élargit. */
export interface ColonneIdentifiante<T> {
  /** Clé de sa largeur dans les préférences : « immat » sur la Flotte. */
  cle: string;
  libelle: string;
  largeur: number;
  rendu: (ligne: T) => React.ReactNode;
  tri?: (ligne: T) => number | string | null;
}

export interface FiletListe {
  couleur: string;
  libelle: string;
  precision: string;
}

export interface FiltreListe<T> {
  cle: string;
  libelle: string;
  retient: (ligne: T) => boolean;
}

/** Largeur du filet de statut. Fixe : ce n'est pas une colonne de données. */
const LARGEUR_FILET = 10;

/** Tailles de page proposées en pied de tableau. */
const TAILLES_PAGE = [25, 50, 100] as const;

/* Un tableau vide stable : un `= []` dans les paramètres créerait un nouveau
   tableau à chaque rendu, et l'effet qui lit les préférences repartirait en boucle. */
const AUCUNE: never[] = [];

export function TableListe<T>({
  ecran,
  lignes,
  cle,
  href,
  filet,
  libelleFilet = "Statut",
  identifiant,
  fixes = AUCUNE,
  colonnes,
  filtres,
  champsRecherche,
  placeholderRecherche,
  libelleRecherche,
  libelleUnite,
  vide,
  surLigne,
}: {
  /** Clé de l'écran, pour ses préférences : « flotte », « chauffeurs ». */
  ecran: string;
  lignes: T[];
  cle: (ligne: T) => string;
  href: (ligne: T) => string;
  /**
   * Ce que fait un clic sur la ligne quand ce n'est pas naviguer : ouvrir la
   * pièce de caisse, la demande d'achat. L'adresse `href` reste celle du lien
   * de la colonne figée, pour qui veut rejoindre la fiche.
   */
  surLigne?: (ligne: T) => void;
  filet: (ligne: T) => FiletListe;
  /** Ce que le filet qualifie, pour les lecteurs d'écran : « Statut » sur la Flotte, « Notation » chez les transporteurs. */
  libelleFilet?: string;
  identifiant: ColonneIdentifiante<T>;
  /** Colonnes toujours affichées, non figées, non masquables — « Véhicule » sur la Flotte. */
  fixes?: ColonneListe<T>[];
  colonnes: ColonneListe<T>[];
  filtres: FiltreListe<T>[];
  champsRecherche: (ligne: T) => string[];
  placeholderRecherche: string;
  libelleRecherche: string;
  /** « véhicules », « chauffeurs » — pour le compteur du pied. */
  libelleUnite: string;
  vide: string;
}) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<string>(filtres[0]?.cle ?? "tous");
  const [taillePage, setTaillePage] = useState<number>(TAILLES_PAGE[0]);
  const [page, setPage] = useState(1);
  /* Tri par clic sur un en-tête : croissant, décroissant, puis l'ordre d'origine. */
  const [tri, setTri] = useState<Tri | null>(null);

  /* Largeurs par défaut de tout ce qui se règle : la colonne figée, les fixes, les autres. */
  const largeursParDefaut = useMemo<Record<string, number>>(() => {
    const d: Record<string, number> = { [identifiant.cle]: identifiant.largeur };
    for (const c of fixes) d[c.cle] = c.largeur;
    for (const c of colonnes) d[c.cle] = c.largeur;
    return d;
  }, [identifiant.cle, identifiant.largeur, fixes, colonnes]);

  /* Préférences d'affichage, rattachées au compte connecté. */
  const [compte, setCompte] = useState<string | null>(null);
  const [visibles, setVisibles] = useState<string[]>(() => colonnesParDefaut(colonnes));
  const [largeurs, setLargeurs] = useState<Record<string, number>>(largeursParDefaut);

  /* Miroir des largeurs : au relâchement de la poignée, React n'a pas encore
     réappliqué l'état, et l'enregistrement écrirait la valeur précédente. */
  const largeursRef = useRef<Record<string, number>>(largeursParDefaut);

  useEffect(() => {
    const role = lireRole() ?? "invite";
    setCompte(role);
    setVisibles(lireColonnes(ecran, role, colonnes));
    const lues = lireLargeurs(ecran, role, largeursParDefaut);
    largeursRef.current = lues;
    setLargeurs(lues);
  }, [ecran, colonnes, largeursParDefaut]);

  function basculerColonne(c: string) {
    setVisibles((precedent) => {
      const suivant = precedent.includes(c)
        ? precedent.filter((x) => x !== c)
        : colonnes.filter((x) => precedent.includes(x.cle) || x.cle === c).map((x) => x.cle);
      if (compte) ecrireColonnes(ecran, compte, suivant, colonnes);
      return suivant;
    });
  }

  function reinitialiserAffichage() {
    const defaut = colonnesParDefaut(colonnes);
    setVisibles(defaut);
    largeursRef.current = { ...largeursParDefaut };
    setLargeurs({ ...largeursParDefaut });
    if (compte) {
      ecrireColonnes(ecran, compte, defaut, colonnes);
      ecrireLargeurs(ecran, compte, largeursParDefaut);
    }
  }

  function ajusterLargeur(c: string, px: number) {
    largeursRef.current = { ...largeursRef.current, [c]: px };
    setLargeurs(largeursRef.current);
  }

  function enregistrerLargeurs() {
    if (compte) ecrireLargeurs(ecran, compte, largeursRef.current);
  }

  const colonnesAffichees = useMemo(() => colonnes.filter((c) => visibles.includes(c.cle)), [colonnes, visibles]);
  const defilantes = useMemo(() => [...fixes, ...colonnesAffichees], [fixes, colonnesAffichees]);
  const largeur = useCallback((c: string) => largeurs[c] ?? largeursParDefaut[c] ?? 120, [largeurs, largeursParDefaut]);

  const largeurTotale = useMemo(
    () => LARGEUR_FILET + largeur(identifiant.cle) + defilantes.reduce((somme, c) => somme + largeur(c.cle), 0),
    [largeur, identifiant.cle, defilantes],
  );

  /* Défilement latéral par flèches, calé sur les bords de colonne. */
  const zoneDefilement = useRef<HTMLDivElement>(null);
  const [peutReculer, setPeutReculer] = useState(false);
  const [peutAvancer, setPeutAvancer] = useState(false);

  const evaluerDefilement = useCallback(() => {
    const zone = zoneDefilement.current;
    if (!zone) return;
    setPeutReculer(zone.scrollLeft > 1);
    setPeutAvancer(zone.scrollLeft + zone.clientWidth < zone.scrollWidth - 1);
  }, []);

  useEffect(() => {
    evaluerDefilement();
    const zone = zoneDefilement.current;
    if (!zone) return;
    zone.addEventListener("scroll", evaluerDefilement, { passive: true });
    window.addEventListener("resize", evaluerDefilement);
    return () => {
      zone.removeEventListener("scroll", evaluerDefilement);
      window.removeEventListener("resize", evaluerDefilement);
    };
  }, [evaluerDefilement, largeurTotale]);

  function defiler(sens: -1 | 1) {
    const zone = zoneDefilement.current;
    if (!zone) return;
    // Butées : le début de chaque colonne défilante, en position de défilement.
    let position = 0;
    const butees = defilantes.map((c) => {
      const debut = position;
      position += largeur(c.cle);
      return debut;
    });
    const courant = zone.scrollLeft;
    const cible = sens === 1 ? butees.find((x) => x > courant + 1) : [...butees].reverse().find((x) => x < courant - 1);
    zone.scrollTo({ left: cible ?? (sens === 1 ? zone.scrollWidth : 0), behavior: "smooth" });
  }

  const resultats = useMemo(() => {
    /* La recherche lit toutes les colonnes — affichées ou non — plus les champs
       que l'écran ajoute, sans tenir compte des accents ni de la casse. Chaque
       mot tapé doit se retrouver quelque part dans la ligne. */
    const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const mots = normaliser(recherche.trim()).split(/\s+/).filter(Boolean);
    const f = filtres.find((x) => x.cle === filtre);
    const toutes = [...fixes, ...colonnes];
    const retenues = lignes.filter((l) => {
      if (f && !f.retient(l)) return false;
      if (mots.length === 0) return true;
      const texte = normaliser([...champsRecherche(l), texteDe(identifiant.rendu(l)), ...toutes.map((c) => (c.texte ? c.texte(l) : texteDe(c.rendu(l))))].join(" "));
      return mots.every((m) => texte.includes(m));
    });
    return trierLignes(retenues, tri, (l, cle) => {
      if (cle === identifiant.cle) return identifiant.tri ? identifiant.tri(l) : valeurDeTri(texteDe(identifiant.rendu(l)));
      const c = toutes.find((x) => x.cle === cle);
      if (!c) return null;
      return c.tri ? c.tri(l) : valeurDeTri(c.texte ? c.texte(l) : texteDe(c.rendu(l)));
    });
  }, [lignes, recherche, filtre, filtres, champsRecherche, tri, fixes, colonnes, identifiant]);

  function EnTeteTriable({ cle: cleColonne, libelle, droite }: { cle: string; libelle: string; droite?: boolean }) {
    const actif = tri?.cle === cleColonne;
    return (
      <button
        type="button"
        onClick={() => {
          setTri((t) => triSuivant(t, cleColonne));
          setPage(1);
        }}
        title={actif ? (tri!.sens === "asc" ? "Tri croissant — cliquer pour décroissant" : "Tri décroissant — cliquer pour l'ordre d'origine") : "Trier"}
        className={`group inline-flex max-w-full items-center gap-1 ${droite ? "flex-row-reverse" : ""} ${actif ? "text-texte" : "hover:text-texte"}`}
      >
        <span className="truncate">{libelle}</span>
        {actif ? (
          tri!.sens === "asc" ? <ChevronUp className="size-3 shrink-0" strokeWidth={2.2} /> : <ChevronDown className="size-3 shrink-0" strokeWidth={2.2} />
        ) : (
          <ChevronsUpDown className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" strokeWidth={2} />
        )}
      </button>
    );
  }

  /* Pagination : on revient à la première page dès que le jeu change, sinon on
     pourrait rester sur une page qui n'existe plus. */
  const nombrePages = Math.max(1, Math.ceil(resultats.length / taillePage));
  const pageCourante = Math.min(page, nombrePages);
  const premier = (pageCourante - 1) * taillePage;
  const pageLignes = resultats.slice(premier, premier + taillePage);

  function changerFiltre(f: string) {
    setFiltre(f);
    setPage(1);
  }

  function changerRecherche(valeur: string) {
    setRecherche(valeur);
    setPage(1);
  }

  function changerTaillePage(valeur: number) {
    setTaillePage(valeur);
    setPage(1);
  }

  /* Numéros de page affichés : les deux extrémités, la page courante et ses
     voisines. Au-delà, des points de suspension. */
  const numeros = useMemo(() => {
    const ensemble = new Set<number>([1, nombrePages, pageCourante - 1, pageCourante, pageCourante + 1]);
    const tries = [...ensemble].filter((n) => n >= 1 && n <= nombrePages).sort((a, b) => a - b);
    const sortie: (number | "…")[] = [];
    tries.forEach((n, i) => {
      if (i > 0 && n - tries[i - 1]! > 1) sortie.push("…");
      sortie.push(n);
    });
    return sortie;
  }, [nombrePages, pageCourante]);

  const celluleFigee = "sticky z-10 border-b border-bordure bg-surface group-hover:bg-surface-2";
  const enTete = "en-tete-colonne relative sticky top-0 h-11 border-b border-bordure bg-surface-2 px-4";
  const boutonRond =
    "grid size-8 place-items-center rounded-full text-texte-2 transition-colors hover:bg-surface-3 hover:text-texte disabled:cursor-not-allowed disabled:text-attenue-2 disabled:hover:bg-transparent";

  return (
    <div className="carte flex flex-col overflow-hidden lg:min-h-0 lg:flex-1">
      {/* ---- Barre d'outils, dans la carte : recherche, filtres, colonnes ---- */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-bordure px-5 py-3.5">
        <label className="champ-pilule h-9 w-full min-w-[220px] sm:w-[300px]">
          <Search className="size-4 shrink-0 text-attenue" strokeWidth={1.8} />
          <input
            type="search"
            value={recherche}
            onChange={(e) => changerRecherche(e.target.value)}
            placeholder={placeholderRecherche}
            aria-label={libelleRecherche}
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-attenue"
          />
        </label>

        <div className="flex h-9 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Filtrer par état">
          {filtres.map((f) => (
            <button
              key={f.cle}
              type="button"
              aria-pressed={filtre === f.cle}
              onClick={() => changerFiltre(f.cle)}
              className={[
                "h-7 rounded-full px-3 text-[12.5px] whitespace-nowrap transition-colors",
                filtre === f.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte",
              ].join(" ")}
            >
              {f.libelle}
            </button>
          ))}
        </div>

        <div className="relative ml-auto flex items-center gap-1.5">
          <span className="meta code mr-2 whitespace-nowrap">
            {resultats.length} sur {lignes.length}
          </span>
          {tri ? (
            <button type="button" onClick={() => setTri(null)} className="meta mr-1 whitespace-nowrap hover:text-texte" title="Revenir à l'ordre d'origine">
              Ordre d&apos;origine
            </button>
          ) : null}

          <button type="button" onClick={() => defiler(-1)} disabled={!peutReculer} title="Colonnes précédentes" className={boutonRond}>
            <ChevronLeft className="size-4" strokeWidth={1.8} />
            <span className="sr-only">Colonnes précédentes</span>
          </button>
          <button type="button" onClick={() => defiler(1)} disabled={!peutAvancer} title="Colonnes suivantes" className={boutonRond}>
            <ChevronRight className="size-4" strokeWidth={1.8} />
            <span className="sr-only">Colonnes suivantes</span>
          </button>

          {/* Le même panneau que sur les tableaux des fiches (ChoixColonnes). */}
          <span className="ml-1">
            <ChoixColonnes
              colonnes={colonnes}
              visibles={visibles}
              onBasculer={basculerColonne}
              onRetablir={reinitialiserAffichage}
              libelleRetablir="Rétablir colonnes et largeurs"
              note="Colonnes et largeurs sont enregistrées pour votre compte. Pour ajuster une largeur, glissez le bord droit de son en-tête."
            />
          </span>
        </div>
      </div>

      {/* ---- Tableau ---- */}
      <div ref={zoneDefilement} className="defilement-discret overflow-auto lg:min-h-0 lg:flex-1">
        {/* Largeurs déclarées : elles ne bougent pas quand un filtre change le
            contenu. La dernière colonne, sans largeur, absorbe l'espace restant
            quand le tableau est plus étroit que la carte — sans elle, cet espace
            serait réparti entre les colonnes et les décalages figés seraient faux. */}
        <table className="table-fixed border-separate border-spacing-0" style={{ width: largeurTotale, minWidth: "100%" }}>
          <colgroup>
            <col style={{ width: LARGEUR_FILET }} />
            <col style={{ width: largeur(identifiant.cle) }} />
            {defilantes.map((c) => (
              <col key={c.cle} style={{ width: largeur(c.cle) }} />
            ))}
            <col />
          </colgroup>

          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 h-11 border-b border-bordure bg-surface-2 p-0">
                <span className="sr-only">{libelleFilet}</span>
              </th>
              <th className={`${enTete} z-30 border-r text-left`} style={{ left: LARGEUR_FILET }} aria-sort={tri?.cle === identifiant.cle ? (tri.sens === "asc" ? "ascending" : "descending") : "none"}>
                <EnTeteTriable cle={identifiant.cle} libelle={identifiant.libelle} />
                <PoigneeLargeur largeur={largeur(identifiant.cle)} onLargeur={(px) => ajusterLargeur(identifiant.cle, px)} onFin={enregistrerLargeurs} libelle={identifiant.libelle} />
              </th>
              {defilantes.map((c) => (
                <th key={c.cle} className={`${enTete} z-20 ${c.alignee === "droite" ? "text-right" : "text-left"}`} aria-sort={tri?.cle === c.cle ? (tri.sens === "asc" ? "ascending" : "descending") : "none"}>
                  <EnTeteTriable cle={c.cle} libelle={c.libelle} droite={c.alignee === "droite"} />
                  <PoigneeLargeur largeur={largeur(c.cle)} onLargeur={(px) => ajusterLargeur(c.cle, px)} onFin={enregistrerLargeurs} libelle={c.libelle} />
                </th>
              ))}
              <th className="sticky top-0 z-20 h-11 border-b border-bordure bg-surface-2 p-0" aria-hidden="true" />
            </tr>
          </thead>

          <tbody>
            {pageLignes.map((l) => {
              const f = filet(l);
              const lien = href(l);
              return (
                <tr key={cle(l)} className="group cursor-pointer" onClick={() => (surLigne ? surLigne(l) : router.push(lien))}>
                  <td className={`${celluleFigee} left-0 h-12 p-0 align-middle`}>
                    <span title={`${f.libelle} — ${f.precision}`} className="ml-2 block h-6 w-[3px] rounded-full" style={{ background: f.couleur }}>
                      <span className="sr-only">{libelleFilet} : {f.libelle}</span>
                    </span>
                  </td>
                  <td className={`${celluleFigee} h-12 truncate border-r px-4 text-[13px] font-semibold text-accent-fonce`} style={{ left: LARGEUR_FILET }}>
                    <Link href={lien} onClick={(e) => e.stopPropagation()} className="text-accent-fonce hover:text-accent hover:underline">
                      {identifiant.rendu(l)}
                    </Link>
                  </td>
                  {defilantes.map((c) => (
                    <td
                      key={c.cle}
                      className={`h-12 border-b border-bordure px-4 text-[13px] text-texte group-hover:bg-surface-2 ${c.alignee === "droite" ? "text-right" : ""}`}
                    >
                      {c.rendu(l)}
                    </td>
                  ))}
                  <td className="h-12 border-b border-bordure p-0 group-hover:bg-surface-2" aria-hidden="true" />
                </tr>
              );
            })}
          </tbody>
        </table>

        {resultats.length === 0 ? <p className="corps px-4 py-12 text-center text-attenue">{vide}</p> : null}
      </div>

      {/* ---- Pied : pagination ---- */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-bordure px-5 py-3">
        <label className="flex items-center gap-2 text-[12.5px] text-texte-2">
          Afficher
          <span className="relative">
            <select
              value={taillePage}
              onChange={(e) => changerTaillePage(Number(e.target.value))}
              aria-label={`Nombre de ${libelleUnite} par page`}
              className="h-8 appearance-none rounded-[8px] border border-bordure-champ bg-surface pr-7 pl-2.5 text-[12.5px] font-medium text-texte outline-none focus:border-accent"
            >
              {TAILLES_PAGE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-attenue" strokeWidth={1.8} />
          </span>
          par page
        </label>

        <div className="ml-auto flex items-center gap-1">
          <span className="meta code mr-3 whitespace-nowrap">
            {resultats.length === 0 ? "0" : `${premier + 1}–${Math.min(premier + taillePage, resultats.length)}`} sur {resultats.length}
          </span>
          <button type="button" onClick={() => setPage(pageCourante - 1)} disabled={pageCourante <= 1} className={boutonRond}>
            <ChevronLeft className="size-4" strokeWidth={1.8} />
            <span className="sr-only">Page précédente</span>
          </button>
          {numeros.map((n, i) =>
            n === "…" ? (
              <span key={`e-${i}`} className="px-1 text-[12.5px] text-attenue">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === pageCourante ? "page" : undefined}
                className={`grid size-8 place-items-center rounded-full text-[12.5px] transition-colors ${
                  n === pageCourante ? "bg-accent font-semibold text-white" : "font-medium text-texte-2 hover:bg-surface-3 hover:text-texte"
                }`}
              >
                {n}
              </button>
            ),
          )}
          <button type="button" onClick={() => setPage(pageCourante + 1)} disabled={pageCourante >= nombrePages} className={boutonRond}>
            <ChevronRight className="size-4" strokeWidth={1.8} />
            <span className="sr-only">Page suivante</span>
          </button>
        </div>
      </div>
    </div>
  );
}
