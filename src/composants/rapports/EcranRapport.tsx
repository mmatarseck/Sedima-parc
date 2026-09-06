"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpDown, Bookmark, ChevronDown, ChevronUp, Download, PencilLine, Search, Trash2, X } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { PERIMETRE, type Perimetre } from "@/domaine/couts";
import { periodeDeLAdresse, resoudrePeriode, type Periode } from "@/domaine/periodes";
import { cleDeTri, estEtat, rapportParId, texteDe, type ColonneRapport, type LigneRapport, type ValeurRapport } from "@/domaine/rapports";
import { date as formaterDate, nombre } from "@/lib/format";
import { classeurRapport, telecharger, type ColonneClasseur, type FormatCellule, type ValeurCellule } from "@/lib/xlsx";
import { trouverRole, type Role } from "@/domaine/roles";
import { lireRole } from "@/lib/session-demo";
import { ALIGNEE_DROITE, CelluleRapport, MONOSPACE, formaterValeur } from "./cellules";
import { definitionDe, personnaliseParId, type RapportPersonnalise } from "./personnalises";
import { ChoixPeriode } from "./ChoixPeriode";
import { ColonnesRapport } from "./ColonnesRapport";
import { FiltresRapport, appliquerFacettes } from "./FiltresRapport";
import { colonnesInitiales, ecrireEtat, enregistrerVue, lireEtat, lireVues, supprimerVue, type Facettes, type ReglageRapport, type VueEnregistree } from "./reglages";

/* ============================================================================
 * Un rapport : la période, les filtres, la table, les totaux, l'export.
 *
 * **La période est dans l'adresse** — c'est elle qui change les lignes, donc
 * elle appartient au serveur et au lien que l'on transmet. Les filtres, le
 * tri, l'ordre et le choix des colonnes travaillent sur les lignes reçues :
 * ils restent dans le navigateur et sont **conservés par profil** (demande du
 * métier du 4 septembre 2026), aussi bien d'un simple retour au rapport que
 * par une vue enregistrée et nommée.
 *
 * Le pied porte les totaux déclarés par le rapport (somme ou moyenne). Une
 * colonne sans total n'en affiche pas : additionner des pourcentages ou des
 * dates ne veut rien dire, et un chiffre faux en pied décrédibilise la table.
 * ==========================================================================*/

type Sens = "asc" | "desc";

/** Le total d'une colonne, quand elle en déclare un et qu'elle porte des nombres. */
function totalDe(lignes: LigneRapport[], colonne: ColonneRapport): number | null {
  if (!colonne.total || colonne.total === "aucun") return null;
  const valeurs = lignes.map((l) => l[colonne.cle]).filter((v): v is number => typeof v === "number");
  if (valeurs.length === 0) return null;
  const somme = valeurs.reduce((s, x) => s + x, 0);
  return colonne.total === "moyenne" ? Math.round((somme / valeurs.length) * 10) / 10 : somme;
}

function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Le format Excel d'une colonne, d'après son type. Les montants, les dates et
 * les mesures partent en **nombres** : dans le classeur, on doit pouvoir
 * sommer, trier et croiser — ce qu'un tableau de chaînes interdit.
 */
const FORMAT_CLASSEUR: Record<ColonneRapport["type"], FormatCellule> = {
  texte: "texte",
  etat: "texte",
  "oui-non": "texte",
  mois: "texte",
  nombre: "decimal",
  montant: "montant",
  pourcentage: "pourcentage",
  ecart: "pourcentage",
  date: "date",
  distance: "distance",
  volume: "volume",
  duree: "duree",
  poids: "poids",
};

/** La valeur d'une cellule du classeur — typée, pas mise en forme. */
function valeurClasseur(v: ValeurRapport, colonne: ColonneRapport): ValeurCellule {
  if (v === null || v === "") return { type: "vide" };
  /* Un état, un booléen : c'est le libellé qui a du sens, pas le code. */
  if (estEtat(v) || typeof v === "boolean") return { type: "texte", valeur: texteDe(v) };
  if (colonne.type === "date") return typeof v === "string" ? { type: "date", valeur: v } : { type: "texte", valeur: String(v) };
  if (typeof v === "number") return { type: "nombre", valeur: v };
  return { type: "texte", valeur: String(v) };
}

export function EcranRapport({
  rapportId,
  lignes,
  aujourdhui,
}: {
  /* L'identifiant plutôt que la définition : celle-ci porte des fonctions, que
     le serveur ne peut pas transmettre à un composant client. */
  rapportId: string;
  lignes: LigneRapport[];
  aujourdhui: string;
}) {
  const base = rapportParId(rapportId)!;
  const router = useRouter();
  const parametres = useSearchParams();
  const persoId = parametres.get("perso");

  /* Un rapport personnalisé n'est pas un autre genre de rapport : c'est le même
     descripteur, dont on remplace le nom et les colonnes. Il vit dans le
     navigateur, donc il ne peut être lu qu'après le montage — la table s'affiche
     un instant avec les colonnes de la base, puis se règle. */
  const [perso, setPerso] = useState<RapportPersonnalise | null>(null);
  const rapport = useMemo(() => (perso ? (definitionDe(perso) ?? base) : base), [perso, base]);
  const identifiant = rapport.identifiant ?? rapport.colonnes[0]!.cle;
  /* Les réglages d'un rapport personnalisé lui appartiennent, pas à sa base :
     deux rapports bâtis sur « Coût par véhicule » ont chacun les leurs. */
  const cleReglage = perso ? perso.id : base.id;

  /* Lue par le domaine, pas par une conversion de type : un préréglage inconnu
     — un vieux lien « ?periode=6 » — doit retomber sur la valeur par défaut, et
     non se propager dans les réglages enregistrés. */
  const periodeAdresse: Periode = useMemo(() => periodeDeLAdresse((cle) => parametres.get(cle)), [parametres]);
  const perimetreAdresse: Perimetre = parametres.get("perimetre") === "complet" ? "complet" : "exploitation";

  const [compte, setCompte] = useState("invite");
  const [pret, setPret] = useState(false);
  const [visibles, setVisibles] = useState<string[]>(() => colonnesInitiales(rapport.colonnes, identifiant));
  const [facettes, setFacettes] = useState<Facettes>({});
  const [tri, setTri] = useState<{ cle: string; sens: Sens } | null>(null);
  const [terme, setTerme] = useState("");
  const [vues, setVues] = useState<VueEnregistree[]>([]);
  const [nomVue, setNomVue] = useState("");
  const [panneauVues, setPanneauVues] = useState(false);

  const poserPeriode = useCallback(
    (p: Periode, perimetre: Perimetre = perimetreAdresse) => {
      const q = new URLSearchParams();
      if (persoId) q.set("perso", persoId);
      if (p.preset !== "12-mois") q.set("periode", p.preset);
      if (p.preset === "personnalisee" && p.debut && p.fin) {
        q.set("du", p.debut);
        q.set("au", p.fin);
      }
      if (perimetre === "complet") q.set("perimetre", "complet");
      const s = q.toString();
      router.push(`/rapports/${rapport.id}${s ? `?${s}` : ""}`);
    },
    [router, rapport.id, perimetreAdresse, persoId],
  );

  /* Les réglages vivent dans le navigateur : ils ne peuvent être lus qu'après
     le montage, sinon le rendu du serveur et celui du client divergeraient. */
  useEffect(() => {
    const role = lireRole() ?? "invite";
    setCompte(role);
    const p = persoId ? personnaliseParId(role, persoId) : null;
    setPerso(p);
    const def = p ? (definitionDe(p) ?? base) : base;
    const id = def.identifiant ?? def.colonnes[0]!.cle;
    const cle = p ? p.id : base.id;
    /* Un rapport personnalisé s'ouvre sur les colonnes et les filtres qu'on lui
       a donnés ; ce que l'on change ensuite est retenu comme pour tout rapport. */
    const defaut: ReglageRapport = {
      colonnes: p ? [id, ...p.colonnes.filter((c) => c !== id)] : colonnesInitiales(def.colonnes, id),
      facettes: p ? p.facettes : {},
      periode: periodeAdresse,
      perimetre: perimetreAdresse,
      tri: p ? p.tri : null,
    };
    const e = lireEtat(role, cle, def.colonnes, id, defaut);
    setVisibles(e.colonnes);
    setFacettes(e.facettes);
    setTri(e.tri);
    setVues(lireVues(role, cle, def.colonnes, id));
    setPret(true);
    /* La période enregistrée reprend la main, sauf si l'adresse en porte une :
       un lien partagé doit ouvrir sur la période qu'il désigne, pas sur celle
       du dernier réglage de celui qui l'ouvre. */
    if (!parametres.get("periode") && e.periode.preset !== "12-mois") poserPeriode(e.periode, e.perimetre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rapportId, persoId]);

  /* Tout changement est retenu sans bouton « enregistrer », qu'on oublierait. */
  useEffect(() => {
    if (!pret) return;
    ecrireEtat(compte, cleReglage, { colonnes: visibles, facettes, periode: periodeAdresse, perimetre: perimetreAdresse, tri });
  }, [pret, compte, cleReglage, visibles, facettes, tri, periodeAdresse, perimetreAdresse]);

  const colonnes = visibles.map((cle) => rapport.colonnes.find((c) => c.cle === cle)).filter((c): c is ColonneRapport => Boolean(c));

  const filtrees = useMemo(() => appliquerFacettes(lignes, facettes), [lignes, facettes]);
  const cherchees = useMemo(() => {
    const t = sansAccents(terme.trim());
    if (!t) return filtrees;
    return filtrees.filter((l) => sansAccents(rapport.colonnes.map((c) => texteDe(l[c.cle] ?? null)).join(" ")).includes(t));
  }, [filtrees, terme, rapport.colonnes]);

  const triees = useMemo(() => {
    if (!tri) return cherchees;
    const facteur = tri.sens === "asc" ? 1 : -1;
    return [...cherchees].sort((a, b) => {
      const x = cleDeTri(a[tri.cle] ?? null);
      const y = cleDeTri(b[tri.cle] ?? null);
      if (typeof x === "number" && typeof y === "number") return (x - y) * facteur;
      return String(x).localeCompare(String(y), "fr") * facteur;
    });
  }, [cherchees, tri]);

  function basculerTri(cle: string) {
    setTri((t) => (t?.cle !== cle ? { cle, sens: "asc" } : t.sens === "asc" ? { cle, sens: "desc" } : null));
  }

  /*
   * L'export reprend ce que l'on voit : les colonnes choisies dans leur ordre,
   * le tri et les filtres du moment. Exporter autre chose serait une surprise.
   *
   * Le classeur porte en tête **les conditions du tableau** — période, filtres
   * posés, tri, qui a exporté et quand. Un tableau sans ses conditions ne se
   * relit pas trois mois plus tard, et deux exports du même rapport ne se
   * distinguent plus l'un de l'autre.
   */
  function exporter() {
    const colonnesClasseur: ColonneClasseur[] = colonnes.map((c) => ({
      entete: c.precision ? `${c.libelle} (${c.precision})` : c.libelle,
      format: FORMAT_CLASSEUR[c.type],
      largeurPx: c.largeur,
    }));

    const filtresPoses = Object.entries(facettes)
      .filter(([, v]) => v.length > 0)
      .map(([cle, v]) => {
        const col = rapport.colonnes.find((c) => c.cle === cle);
        return `${col?.libelle ?? cle} : ${v.join(", ")}`;
      });

    const cartouche: { libelle: string; valeur: string }[] = [];
    if (rapport.periode) cartouche.push({ libelle: "Période", valeur: `${resolue.libelle} — du ${formaterDate(resolue.debut)} au ${formaterDate(resolue.fin)}` });
    if (rapport.perimetre) cartouche.push({ libelle: "Périmètre du coût", valeur: `${PERIMETRE[perimetreAdresse].libelle} — ${PERIMETRE[perimetreAdresse].precision}` });
    cartouche.push({ libelle: "Filtres", valeur: filtresPoses.length ? filtresPoses.join(" · ") : "aucun" });
    if (terme.trim()) cartouche.push({ libelle: "Recherche", valeur: terme.trim() });
    if (tri) {
      const col = rapport.colonnes.find((c) => c.cle === tri.cle);
      cartouche.push({ libelle: "Tri", valeur: `${col?.libelle ?? tri.cle}, ${tri.sens === "asc" ? "croissant" : "décroissant"}` });
    }
    cartouche.push({ libelle: "Lignes", valeur: `${nombre(triees.length)} ${rapport.unite}${triees.length !== lignes.length ? ` sur ${nombre(lignes.length)}` : ""}` });
    cartouche.push({ libelle: "Exporté", valeur: `par ${trouverRole(compte === "invite" ? null : (compte as Role)).nom}, le ${formaterDate(new Date().toISOString())}` });

    /* La ligne de totaux du pied part avec le reste : c'est elle qu'on recopie
       dans une note de synthèse, et la retaper serait une occasion de se tromper. */
    const totauxClasseur: (ValeurCellule | null)[] = colonnes.map((_, i) =>
      totaux[i] !== null ? { type: "nombre", valeur: totaux[i]! } : i === 0 ? { type: "texte", valeur: "Total" } : null,
    );

    telecharger(
      classeurRapport({
        onglet: rapport.libelle,
        titre: rapport.libelle,
        sousTitre: rapport.description,
        cartouche,
        colonnes: colonnesClasseur,
        lignes: triees.map((l) => colonnes.map((c) => valeurClasseur(l[c.cle] ?? null, c))),
        totaux: aDesTotaux ? totauxClasseur : undefined,
      }),
      `${perso ? perso.nom.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : rapport.id}-${aujourdhui}.xlsx`,
    );
  }

  function enregistrerLaVue() {
    const nom = nomVue.trim();
    if (!nom) return;
    enregistrerVue(compte, cleReglage, nom, { colonnes: visibles, facettes, periode: periodeAdresse, perimetre: perimetreAdresse, tri });
    setVues(lireVues(compte, cleReglage, rapport.colonnes, identifiant));
    setNomVue("");
  }

  function rappeler(v: VueEnregistree) {
    setVisibles(v.colonnes);
    setFacettes(v.facettes);
    setTri(v.tri);
    setPanneauVues(false);
    poserPeriode(v.periode, v.perimetre);
  }

  const resolue = resoudrePeriode(periodeAdresse, aujourdhui);
  const totaux = colonnes.map((c) => totalDe(triees, c));
  const aDesTotaux = totaux.some((t) => t !== null);
  const facettesPosees = Object.values(facettes).filter((v) => v.length > 0).length;

  return (
    <div className="flex flex-col gap-4 px-8 py-7 lg:h-full lg:min-h-0">
      <TitreEcran
        titre={rapport.libelle}
        sousTitre={rapport.description}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setPanneauVues((p) => !p)} aria-expanded={panneauVues} className="bouton-secondaire h-8">
                <Bookmark className="size-4" strokeWidth={1.8} />
                Mes vues
                {vues.length ? <span className="badge-texte text-attenue">{vues.length}</span> : null}
              </button>
              {panneauVues ? (
                <div className="absolute top-full right-0 z-40 mt-1.5 w-[300px] overflow-hidden rounded-[12px] border border-bordure bg-surface shadow-modale">
                  <p className="micro-sur-titre border-b border-bordure px-3.5 py-2">Vues enregistrées</p>
                  {vues.length === 0 ? (
                    <p className="meta px-3.5 py-4">Aucune vue. Réglez la période, les filtres et les colonnes, puis nommez le résultat.</p>
                  ) : (
                    <ul className="defilement-discret max-h-[240px] overflow-y-auto py-1">
                      {vues.map((v) => (
                        <li key={v.id} className="flex items-center gap-1 px-2 py-0.5">
                          <button type="button" onClick={() => rappeler(v)} className="min-w-0 flex-1 rounded px-1.5 py-1 text-left text-[12.5px] text-texte hover:bg-surface-3">
                            <span className="block truncate font-medium">{v.nom}</span>
                            <span className="meta block truncate">
                              {v.colonnes.length} colonnes · {Object.values(v.facettes).filter((x) => x.length).length} filtres
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              supprimerVue(compte, cleReglage, v.id);
                              setVues(lireVues(compte, cleReglage, rapport.colonnes, identifiant));
                            }}
                            aria-label={`Supprimer la vue ${v.nom}`}
                            className="grid size-7 shrink-0 place-items-center rounded-full text-attenue hover:bg-surface-3 hover:text-defavorable"
                          >
                            <Trash2 className="size-3.5" strokeWidth={1.8} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center gap-2 border-t border-bordure bg-surface-2 px-3 py-2.5">
                    <input
                      value={nomVue}
                      onChange={(e) => setNomVue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") enregistrerLaVue();
                      }}
                      placeholder="Nommer la vue courante…"
                      aria-label="Nom de la vue"
                      className="h-8 min-w-0 flex-1 rounded-[8px] border border-bordure-champ bg-surface px-2.5 text-[12.5px] text-texte outline-none placeholder:text-attenue focus:border-accent"
                    />
                    <button type="button" onClick={enregistrerLaVue} disabled={!nomVue.trim()} className="bouton-principal h-8 shrink-0 px-3 text-[12.5px] disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-attenue-2">
                      Enregistrer
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            {perso ? (
              <Link href={`/rapports/nouveau?base=${base.id}&perso=${perso.id}`} className="bouton-secondaire h-8">
                <PencilLine className="size-4" strokeWidth={1.8} />
                Modifier
              </Link>
            ) : null}
            <Link href="/rapports" className="bouton-secondaire h-8">
              <ArrowLeft className="size-4" strokeWidth={1.8} />
              Tous les rapports
            </Link>
          </div>
        }
      />

      {/* ---- Période et périmètre : ce qui change les lignes ---- */}
      {rapport.periode || rapport.perimetre ? (
        <div className="flex flex-wrap items-center gap-3">
          {rapport.periode ? (
            <>
              <ChoixPeriode valeur={periodeAdresse} aujourdhui={aujourdhui} onChange={(p) => poserPeriode(p)} />
              <p className="meta">
                {resolue.libelle} borne {rapport.precisionPeriode ?? "les lignes"}.
              </p>
            </>
          ) : null}
          {rapport.perimetre ? (
            <div className="sans-barre flex h-8 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Périmètre du coût">
              {(["exploitation", "complet"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  title={PERIMETRE[p].precision}
                  aria-pressed={perimetreAdresse === p}
                  onClick={() => poserPeriode(periodeAdresse, p)}
                  className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${perimetreAdresse === p ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}
                >
                  {PERIMETRE[p].libelle}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ---- Facettes ---- */}
      <FiltresRapport colonnes={rapport.colonnes} lignes={lignes} facettes={facettes} onChanger={setFacettes} />

      {/* ---- Barre d'outils ---- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-8 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-bordure-champ bg-surface px-3.5 focus-within:border-accent">
          <Search className="size-4 shrink-0 text-attenue" strokeWidth={1.8} />
          <input
            value={terme}
            onChange={(e) => setTerme(e.target.value)}
            placeholder="Chercher dans les lignes affichées…"
            aria-label="Chercher dans les lignes"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-texte outline-none placeholder:text-attenue"
          />
          {terme ? (
            <button type="button" onClick={() => setTerme("")} aria-label="Effacer" className="grid size-6 shrink-0 place-items-center rounded-full text-attenue hover:bg-surface-3 hover:text-texte">
              <X className="size-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
        <p className="meta whitespace-nowrap">
          {nombre(triees.length)} {rapport.unite}
          {triees.length !== lignes.length ? ` sur ${nombre(lignes.length)}` : ""}
          {facettesPosees ? ` · ${facettesPosees} filtre${facettesPosees > 1 ? "s" : ""}` : ""}
        </p>
        <ColonnesRapport
          colonnes={rapport.colonnes}
          visibles={visibles}
          identifiant={identifiant}
          onChanger={setVisibles}
          onRetablir={() => setVisibles(colonnesInitiales(rapport.colonnes, identifiant))}
        />
        <button type="button" onClick={exporter} disabled={triees.length === 0} className="bouton-secondaire h-8 disabled:cursor-not-allowed disabled:text-attenue-2">
          <Download className="size-4" strokeWidth={1.8} />
          Exporter
        </button>
      </div>

      {/* ---- La table ---- */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-bordure bg-surface">
        <div className="defilement-discret min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-surface-2">
              <tr>
                {colonnes.map((c) => {
                  const actif = tri?.cle === c.cle;
                  const droite = ALIGNEE_DROITE.includes(c.type);
                  return (
                    <th key={c.cle} scope="col" style={{ width: c.largeur, minWidth: c.largeur }} className={`border-b border-bordure px-3 py-2.5 align-bottom font-medium ${droite ? "text-right" : "text-left"}`}>
                      <button
                        type="button"
                        onClick={() => basculerTri(c.cle)}
                        className={`inline-flex max-w-full items-center gap-1 text-[12px] whitespace-nowrap ${actif ? "font-semibold text-texte" : "text-texte-2 hover:text-texte"} ${droite ? "flex-row-reverse" : ""}`}
                      >
                        <span className="truncate">{c.libelle}</span>
                        {actif ? (
                          tri!.sens === "asc" ? (
                            <ChevronUp className="size-3.5 shrink-0" strokeWidth={2.2} />
                          ) : (
                            <ChevronDown className="size-3.5 shrink-0" strokeWidth={2.2} />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 shrink-0 text-attenue-2" strokeWidth={1.8} />
                        )}
                      </button>
                      {c.precision ? <span className="meta mt-0.5 block truncate font-normal">{c.precision}</span> : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {triees.length === 0 ? (
                <tr>
                  <td colSpan={colonnes.length} className="px-6 py-16 text-center text-[13px] text-attenue">
                    Aucune ligne — élargissez la période ou retirez un filtre.
                  </td>
                </tr>
              ) : (
                triees.map((l, i) => {
                  const href = rapport.lien?.(l) ?? null;
                  return (
                    /* La clé mêle l'identifiant et le rang : deux lignes peuvent
                       porter le même identifiant — un véhicule a quatre documents. */
                    <tr key={`${texteDe(l[identifiant] ?? null)}-${i}`} className="border-b border-bordure last:border-b-0 hover:bg-surface-2">
                      {colonnes.map((c) => {
                        const v = l[c.cle] ?? null;
                        const contenu =
                          c.cle === identifiant && href && !estEtat(v) ? (
                            <Link href={href} className="font-medium text-texte hover:text-accent-fonce">
                              {formaterValeur(v, c.type)}
                            </Link>
                          ) : (
                            <CelluleRapport valeur={v} colonne={c} />
                          );
                        return (
                          <td
                            key={c.cle}
                            style={{ width: c.largeur, minWidth: c.largeur }}
                            className={`px-3 py-2 ${ALIGNEE_DROITE.includes(c.type) ? "text-right" : ""} ${MONOSPACE.includes(c.type) ? "code" : ""}`}
                          >
                            <span className="block truncate">{contenu}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
            {aDesTotaux && triees.length > 0 ? (
              <tfoot className="sticky bottom-0 bg-surface-2">
                <tr>
                  {colonnes.map((c, i) => (
                    <td key={c.cle} className={`border-t border-bordure px-3 py-2.5 font-semibold ${ALIGNEE_DROITE.includes(c.type) ? "text-right" : ""} ${MONOSPACE.includes(c.type) ? "code" : ""}`}>
                      {/* La première colonne porte le mot « Total » quand elle n'a
                          rien à totaliser : un pied sans intitulé se lit mal. */}
                      {totaux[i] !== null ? (
                        <>
                          {formaterValeur(totaux[i]!, c.type)}
                          {c.total === "moyenne" ? <span className="meta ml-1 font-normal">moy.</span> : null}
                        </>
                      ) : i === 0 ? (
                        <span className="text-[12px] font-medium text-texte-2">Total</span>
                      ) : null}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}
