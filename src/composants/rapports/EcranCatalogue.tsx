"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PencilLine, Plus, Search, Star, X } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { FAMILLE_RAPPORT, RAPPORTS, famillesServies, type DefinitionRapport, type FamilleRapport } from "@/domaine/rapports";
import { lireRole } from "@/lib/session-demo";
import { listePersonnalises, type RapportPersonnalise } from "./personnalises";

/* ============================================================================
 * Catalogue des rapports.
 *
 * L'écran d'entrée du module : à gauche les familles, au centre les rapports,
 * chacun avec la phrase qui dit à quelle question il répond — un nom seul ne
 * suffit pas, « Coût par véhicule » et « Coût par catégorie » ne se choisissent
 * pas au titre. La recherche porte sur le nom **et** sur la description : on
 * cherche « consommation » sans savoir que le rapport s'appelle autrement.
 *
 * Les favoris sont rangés dans le navigateur, par compte ; en production, une
 * table de préférences. Un rapport mis en favori remonte en tête, parce qu'un
 * gestionnaire de parc rouvre trois rapports par semaine et les cherche chaque
 * fois dans la même liste de vingt.
 * ==========================================================================*/

const CLE_FAVORIS = "sedima.parc.rapports.favoris";

function lireFavoris(): string[] {
  try {
    const brut = localStorage.getItem(CLE_FAVORIS);
    const liste = brut ? (JSON.parse(brut) as unknown) : [];
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function ecrireFavoris(liste: string[]): void {
  try {
    localStorage.setItem(CLE_FAVORIS, JSON.stringify(liste));
  } catch {
    /* sans stockage, le favori ne vaut que pour la session */
  }
}

function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function CarteRapport({ rapport, favori, onFavori }: { rapport: DefinitionRapport; favori: boolean; onFavori: () => void }) {
  return (
    <div className="group relative flex min-w-0 flex-col rounded-[14px] border border-bordure bg-surface p-5 transition-shadow hover:shadow-carte">
      <Link href={`/rapports/${rapport.id}`} className="min-w-0">
        <span className="absolute inset-0 rounded-[14px]" aria-hidden />
        <p className="micro-sur-titre">{FAMILLE_RAPPORT[rapport.famille].libelle}</p>
        <h2 className="titre-bloc mt-1">{rapport.libelle}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-texte-2">{rapport.description}</p>
      </Link>
      <p className="meta mt-4 pt-3">
        {rapport.colonnes.length} colonnes · une ligne par {rapport.unite.replace(/s$/, "")}
      </p>
      <button
        type="button"
        onClick={onFavori}
        aria-pressed={favori}
        aria-label={favori ? `Retirer ${rapport.libelle} des favoris` : `Mettre ${rapport.libelle} en favori`}
        className={`absolute top-4 right-4 z-10 grid size-8 place-items-center rounded-full transition-colors ${favori ? "text-vigilance" : "text-attenue-2 opacity-0 group-hover:opacity-100 hover:text-texte-2 focus-visible:opacity-100"}`}
      >
        <Star className="size-4" strokeWidth={1.9} fill={favori ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

/** Un rapport composé par l'utilisateur : sa carte le dit, et mène à sa retouche. */
function CarteMienne({ rapport }: { rapport: RapportPersonnalise }) {
  const base = RAPPORTS.find((r) => r.id === rapport.base);
  return (
    <div className="group relative flex min-w-0 flex-col rounded-[14px] border border-accent-fond bg-surface p-5 transition-shadow hover:shadow-carte">
      <Link href={`/rapports/${rapport.base}?perso=${rapport.id}`} className="min-w-0">
        <span className="absolute inset-0 rounded-[14px]" aria-hidden />
        <p className="micro-sur-titre text-accent-fonce">Mon rapport</p>
        <h2 className="titre-bloc mt-1">{rapport.nom}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-texte-2">{rapport.description || `D'après « ${base?.libelle ?? rapport.base} ».`}</p>
      </Link>
      <p className="meta mt-4 pt-3">
        {rapport.colonnes.length} colonnes · une ligne par {base?.unite.replace(/s$/, "") ?? "ligne"}
      </p>
      <Link
        href={`/rapports/nouveau?base=${rapport.base}&perso=${rapport.id}`}
        aria-label={`Modifier ${rapport.nom}`}
        className="absolute top-4 right-4 z-10 grid size-8 place-items-center rounded-full text-attenue-2 opacity-0 transition-colors group-hover:opacity-100 hover:text-texte-2 focus-visible:opacity-100"
      >
        <PencilLine className="size-4" strokeWidth={1.9} />
      </Link>
    </div>
  );
}

/**
 * Une entrée du rail. Les entrées **transverses** — tout, les miens, les
 * favoris — se lisent en gras sur fond légèrement appuyé : elles ne sont pas
 * une rubrique de plus dans la liste, elles coupent le catalogue autrement.
 */
function BoutonRubrique({ libelle, compte, actif, transverse, onClick }: { libelle: string; compte: number; actif: boolean; transverse?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={actif}
      className={`flex h-9 w-full items-center gap-2 rounded-[10px] px-3 text-left text-[13px] transition-colors ${
        actif
          ? "bg-accent-fond font-semibold text-accent-fonce"
          : transverse
            ? "bg-surface-2 font-semibold text-texte hover:bg-surface-3"
            : "font-medium text-texte-2 hover:bg-surface-3 hover:text-texte"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{libelle}</span>
      <span className={`badge-texte shrink-0 ${transverse && !actif ? "text-texte-2" : "text-attenue"}`}>{compte}</span>
    </button>
  );
}

export function EcranCatalogue() {
  const [famille, setFamille] = useState<FamilleRapport | "toutes" | "favoris" | "miens">("toutes");
  const [terme, setTerme] = useState("");
  const [favoris, setFavoris] = useState<string[]>([]);
  const [miens, setMiens] = useState<RapportPersonnalise[]>([]);

  /* Favoris et rapports personnalisés vivent dans le navigateur : ils se lisent
     **après** le montage, jamais pendant le rendu. Une lecture pendant le rendu
     ferait diverger le premier rendu du client de celui du serveur, et React
     rejetterait l'hydratation de la page entière. */
  useEffect(() => {
    setFavoris(lireFavoris());
    setMiens(listePersonnalises(lireRole() ?? "invite"));
  }, []);

  function basculerFavori(id: string) {
    setFavoris((f) => {
      const suivant = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
      ecrireFavoris(suivant);
      return suivant;
    });
  }

  const familles = famillesServies();
  const resultats = useMemo(() => {
    const t = sansAccents(terme.trim());
    const retenus = (famille === "miens" ? [] : RAPPORTS).filter((r) => {
      if (famille === "favoris" && !favoris.includes(r.id)) return false;
      if (famille !== "toutes" && famille !== "favoris" && r.famille !== famille) return false;
      if (!t) return true;
      return sansAccents(`${r.libelle} ${r.description} ${FAMILLE_RAPPORT[r.famille].libelle} ${r.unite}`).includes(t);
    });
    /* Les favoris d'abord — c'est tout leur intérêt. */
    return [...retenus].sort((a, b) => Number(favoris.includes(b.id)) - Number(favoris.includes(a.id)));
  }, [famille, terme, favoris]);

  /* Les rapports composés par l'utilisateur passent devant les standards : ce
     sont les siens, il les cherche en premier. */
  const miensRetenus = useMemo(() => {
    if (famille !== "toutes" && famille !== "miens") return [];
    const t = sansAccents(terme.trim());
    return miens.filter((x) => !t || sansAccents(x.nom + " " + x.description).includes(t));
  }, [famille, terme, miens]);

  /*
   * Deux registres dans le même rail, et le métier a demandé le 5 septembre 2026
   * de les distinguer : en tête, les **entrées transverses** — tout, les miens,
   * les favoris — qui ne sont pas des rubriques mais des façons de couper le
   * catalogue ; en dessous, séparées par un filet et annoncées par un intitulé,
   * les **rubriques** elles-mêmes.
   */
  const transverses: { cle: FamilleRapport | "toutes" | "favoris" | "miens"; libelle: string; compte: number }[] = [
    { cle: "toutes", libelle: "Tous les rapports", compte: RAPPORTS.length },
    ...(miens.length ? [{ cle: "miens" as const, libelle: "Mes rapports", compte: miens.length }] : []),
    ...(favoris.length ? [{ cle: "favoris" as const, libelle: "Favoris", compte: favoris.length }] : []),
  ];
  const rubriques = familles.map((f) => ({ cle: f, libelle: FAMILLE_RAPPORT[f].libelle, compte: RAPPORTS.filter((r) => r.famille === f).length }));

  return (
    /* La coquille borne la hauteur de `main` : sans zone de défilement propre,
       le bas du catalogue reste inaccessible. C'est la convention des écrans
       longs de l'application (Paramètres, Tableau de bord). */
    <div className="defilement-discret flex flex-col gap-6 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran
        titre="Rapports"
        sousTitre="Les rapports standards du parc, par dimension — filtrables, triables, exportables. Le tableau de bord donne le coup d'œil ; un rapport donne la table."
        actions={
          <Link href="/rapports/nouveau" className="bouton-principal">
            <Plus className="size-4" strokeWidth={2.2} />
            Nouveau rapport
          </Link>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ---- Les familles ---- */}
        <nav aria-label="Familles de rapports" className="shrink-0 lg:sticky lg:top-0 lg:w-[230px] lg:self-start">
          <ul className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap">
            {transverses.map((o) => (
              <li key={o.cle}>
                <BoutonRubrique libelle={o.libelle} compte={o.compte} actif={famille === o.cle} transverse onClick={() => setFamille(o.cle)} />
              </li>
            ))}
          </ul>

          {/* Le filet et l'intitulé disent le changement de registre : au-dessus,
              des coupes du catalogue ; au-dessous, les rubriques du métier. */}
          <p className="micro-sur-titre mt-4 mb-1.5 border-t border-bordure px-3 pt-4">Rubriques</p>

          <ul className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap">
            {rubriques.map((o) => (
              <li key={o.cle}>
                <BoutonRubrique libelle={o.libelle} compte={o.compte} actif={famille === o.cle} onClick={() => setFamille(o.cle)} />
              </li>
            ))}
          </ul>
        </nav>

        {/* ---- Les rapports ---- */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex h-10 items-center gap-2 rounded-full border border-bordure-champ bg-surface px-4 focus-within:border-accent">
            <Search className="size-4 shrink-0 text-attenue" strokeWidth={1.8} />
            <input
              value={terme}
              onChange={(e) => setTerme(e.target.value)}
              placeholder="Chercher un rapport — « consommation », « échéance », « prestataire »…"
              aria-label="Chercher un rapport"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-texte outline-none placeholder:text-attenue"
            />
            {terme ? (
              <button type="button" onClick={() => setTerme("")} aria-label="Effacer la recherche" className="grid size-6 shrink-0 place-items-center rounded-full text-attenue hover:bg-surface-3 hover:text-texte">
                <X className="size-3.5" strokeWidth={2} />
              </button>
            ) : null}
          </div>

          {famille === "miens" ? (
            <p className="meta -mt-2">Vos rapports, composés à partir d'une base standard — modifiables et supprimables à tout moment.</p>
          ) : famille !== "toutes" && famille !== "favoris" ? (
            <p className="meta -mt-2">{FAMILLE_RAPPORT[famille].precision}.</p>
          ) : null}

          {resultats.length === 0 && miensRetenus.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-bordure px-6 py-14 text-center text-[13px] text-attenue">
              {terme ? <>Aucun rapport ne répond à « {terme} ». </> : <>Aucun rapport ici pour l&apos;instant. </>}
              Vous pouvez en composer un : « Nouveau rapport » choisit une base, puis vos colonnes, vos filtres et votre période.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {miensRetenus.map((x) => (
                <CarteMienne key={x.id} rapport={x} />
              ))}
              {resultats.map((r) => (
                <CarteRapport key={r.id} rapport={r} favori={favoris.includes(r.id)} onFavori={() => basculerFavori(r.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
