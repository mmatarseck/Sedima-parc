"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleAlert, Hash } from "lucide-react";
import { TYPE_TRANSACTION, analyserNumero, type TypeTransaction } from "@/domaine/reference";
import { afficher } from "@/domaine/immatriculation";
import { indexReferences, type EntreeReference } from "@/donnees/references-demo";
import { lireToutesCreations } from "@/lib/clotures-demo";
import { date as formaterDate } from "@/lib/format";

/* ============================================================================
 * Champ « transaction d'origine » — un numéro choisi, jamais tapé à l'aveugle.
 *
 * Demande du métier du 3 septembre 2026 : « tout ce qui est transaction
 * d'origine à saisir dans les formulaires devrait pouvoir être sélectionnable
 * avec contrôle de validité, pour être sûr du rattachement ». Le champ propose
 * les transactions de l'index de recherche (et celles créées dans le
 * navigateur) dès qu'on tape un bout de numéro ou de libellé, ne retient que
 * les types attendus, et dit clairement si le numéro saisi n'existe pas, n'est
 * pas du bon type, ou appartient à un autre véhicule que celui du formulaire.
 * La modale n'enregistre pas tant qu'une référence n'est pas valide.
 * ==========================================================================*/

export interface ReferenceResolue extends EntreeReference {
  /** Créée dans l'application, absente de l'index du serveur. */
  creee: boolean;
  /** L'immatriculation normalisée du véhicule porteur, quand l'adresse la donne. */
  immatriculation: string | null;
}

export type EtatReference = "vide" | "valide" | "inconnue" | "hors-type" | "autre-vehicule";

function immatDe(href: string): string | null {
  const m = /^\/flotte\/([A-Z0-9]+)/.exec(href);
  return m ? m[1]! : null;
}

function sansAccents(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function numeroCompact(texte: string): string {
  return texte.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Tout ce qu'un champ de référence peut citer : l'index du serveur, plus les
 * transactions créées dans le navigateur, remises à la même forme. Lu à la
 * demande — l'index est déjà en mémoire, les créations sont peu nombreuses.
 */
export function catalogueReferences(types?: TypeTransaction[]): ReferenceResolue[] {
  const retenus = new Set<TypeTransaction>(types ?? (Object.keys(TYPE_TRANSACTION) as TypeTransaction[]));
  const liste: ReferenceResolue[] = indexReferences()
    .filter((e) => retenus.has(e.type))
    .map((e) => ({ ...e, creee: false, immatriculation: immatDe(e.href) }));
  const vus = new Set(liste.map((e) => e.numero));
  for (const type of retenus) {
    if (type === "vehicule" || type === "chauffeur" || type === "prestataire") continue;
    for (const c of lireToutesCreations(type)) {
      if (vus.has(c.numero)) continue;
      vus.add(c.numero);
      const v = c.valeurs;
      const sujetVehicule = c.sujet.startsWith("vehicule:") ? c.sujet.slice("vehicule:".length) : null;
      const libelle = [v.objet, v.libelle, v.nature, v.type].map((x) => (x === null || x === undefined ? "" : String(x))).find((x) => x !== "") ?? "";
      const dateTx = [v.date, v.datePrevue, v.dateEffet, v.dateHeure, v.debut, v.dateRendezVous].map((x) => (x ? String(x).slice(0, 10) : "")).find((x) => x !== "") ?? c.date.slice(0, 10);
      const onglet = TYPE_TRANSACTION[type].ongletVehicule;
      liste.push({
        numero: c.numero,
        type,
        titre: `${TYPE_TRANSACTION[type].libelle}${libelle ? ` · ${libelle}` : ""}`,
        precision: `${formaterDate(dateTx)}${sujetVehicule ? ` · ${afficher(sujetVehicule)}` : ""} · créée dans l'application`,
        href: sujetVehicule && onglet ? `/flotte/${sujetVehicule}?onglet=${onglet}&ref=${c.numero}` : "",
        creee: true,
        immatriculation: sujetVehicule,
      });
    }
  }
  return liste;
}

/**
 * Le verdict sur un numéro saisi : trouvé et du bon type et du bon véhicule,
 * ou pourquoi pas. Le véhicule n'est vérifié que quand les deux sont connus —
 * une déclaration d'incident n'a pas d'adresse de véhicule dans l'index.
 */
export function resoudreReference(valeur: string, types: TypeTransaction[] | undefined, immatriculation: string | null, catalogue?: ReferenceResolue[]): { etat: EtatReference; entree: ReferenceResolue | null } {
  const brut = valeur.trim();
  if (!brut) return { etat: "vide", entree: null };
  const numero = analyserNumero(brut)?.numero ?? brut.toUpperCase();
  const tout = catalogue ?? catalogueReferences();
  const entree = tout.find((e) => e.numero === numero) ?? null;
  if (!entree) return { etat: "inconnue", entree: null };
  if (types && !types.includes(entree.type)) return { etat: "hors-type", entree };
  if (immatriculation && entree.immatriculation && entree.immatriculation !== immatriculation) return { etat: "autre-vehicule", entree };
  return { etat: "valide", entree };
}

export function ChampReference({
  valeur,
  onChange,
  types,
  immatriculation,
  placeholder,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  types?: TypeTransaction[];
  /** Le véhicule du formulaire, normalisé (« AA032EA ») : les propositions s'y limitent, et un numéro d'un autre véhicule est refusé. */
  immatriculation: string | null;
  placeholder?: string;
}) {
  const [focus, setFocus] = useState(false);
  const [surligne, setSurligne] = useState(0);
  /* Le catalogue se lit au montage et à chaque ouverture : les créations du
     navigateur peuvent avoir changé entre deux formulaires. */
  const [catalogue, setCatalogue] = useState<ReferenceResolue[]>([]);
  useEffect(() => {
    setCatalogue(catalogueReferences(types));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types?.join("|")]);
  const liste = useRef<HTMLUListElement>(null);

  const verdict = useMemo(() => resoudreReference(valeur, types, immatriculation, catalogue), [valeur, types, immatriculation, catalogue]);

  /* Propositions : le numéro tapé, ou n'importe quel mot du libellé — d'abord
     celles du véhicule du formulaire, puis les autres. */
  const propositions = useMemo(() => {
    const terme = valeur.trim();
    if (terme.length < 2 || verdict.etat === "valide") return [];
    const compact = numeroCompact(terme);
    const mots = sansAccents(terme).split(/\s+/).filter(Boolean);
    const retenues = catalogue.filter((e) => {
      if (compact.length >= 2 && numeroCompact(e.numero).includes(compact)) return true;
      const texte = sansAccents(`${e.titre} ${e.precision}`);
      return mots.every((m) => texte.includes(m));
    });
    const duVehicule = immatriculation ? retenues.filter((e) => e.immatriculation === immatriculation || e.immatriculation === null) : retenues;
    return duVehicule.slice(0, 8);
  }, [valeur, verdict.etat, catalogue, immatriculation]);

  useEffect(() => setSurligne(0), [propositions.length]);

  function choisir(e: ReferenceResolue) {
    onChange(e.numero);
    setFocus(false);
  }

  const libellesTypes = types ? types.map((t) => TYPE_TRANSACTION[t].libelle.toLowerCase()).join(", ") : "toute transaction";
  const ouvert = focus && propositions.length > 0;

  return (
    <div className="relative flex flex-col gap-1.5">
      <span className="relative">
        <Hash className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-attenue" strokeWidth={1.8} />
        <input
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 120)}
          onKeyDown={(e) => {
            if (!ouvert) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSurligne((s) => Math.min(propositions.length - 1, s + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSurligne((s) => Math.max(0, s - 1));
            } else if (e.key === "Enter" || e.key === "Tab") {
              const p = propositions[surligne];
              if (p) {
                e.preventDefault();
                choisir(p);
              }
            }
          }}
          placeholder={placeholder ?? "Numéro ou mot du libellé — OBS-2026…, « injecteurs »"}
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={ouvert}
          aria-invalid={verdict.etat !== "vide" && verdict.etat !== "valide"}
          className={`code h-9 w-full rounded-[10px] border bg-surface pr-3 pl-8 text-[13px] text-texte outline-none focus:border-accent ${
            verdict.etat === "valide" ? "border-accent-bordure" : verdict.etat === "vide" ? "border-bordure-champ" : "border-defavorable"
          }`}
        />
        {verdict.etat === "valide" ? <Check className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-accent-fonce" strokeWidth={2.2} /> : null}
      </span>

      {ouvert ? (
        <ul ref={liste} role="listbox" className="absolute top-full right-0 left-0 z-10 mt-1 max-h-[260px] overflow-y-auto rounded-[12px] border border-bordure bg-surface py-1 shadow-modale">
          {propositions.map((p, i) => (
            <li key={p.numero} role="option" aria-selected={i === surligne}>
              <button
                type="button"
                /* Choisir dès l'appui : l'input garde le focus et le choix ne
                   dépend pas d'un clic qui arriverait après la fermeture de la liste. */
                onMouseDown={(e) => {
                  e.preventDefault();
                  choisir(p);
                }}
                onMouseEnter={() => setSurligne(i)}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left ${i === surligne ? "bg-surface-2" : ""}`}
              >
                <span className="flex w-full items-baseline gap-2">
                  <span className="code text-[12px] font-medium text-texte">{p.numero}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-texte">{p.titre}</span>
                </span>
                <span className="meta truncate">{p.precision}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Le verdict, toujours dit : c'est lui qui garantit le rattachement. */}
      {verdict.etat === "valide" && verdict.entree ? (
        <span className="meta flex items-start gap-1.5 text-accent-fonce">
          <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
          <span className="min-w-0 truncate">
            {verdict.entree.titre} · {verdict.entree.precision}
          </span>
        </span>
      ) : verdict.etat === "inconnue" ? (
        <span className="meta flex items-start gap-1.5 text-defavorable">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          Aucune transaction ne porte ce numéro — choisissez-la dans la liste ({libellesTypes}).
        </span>
      ) : verdict.etat === "hors-type" && verdict.entree ? (
        <span className="meta flex items-start gap-1.5 text-defavorable">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          {verdict.entree.numero} est {TYPE_TRANSACTION[verdict.entree.type].libelle.toLowerCase()} : ce champ attend {libellesTypes}.
        </span>
      ) : verdict.etat === "autre-vehicule" && verdict.entree ? (
        <span className="meta flex items-start gap-1.5 text-defavorable">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          {verdict.entree.numero} appartient à {afficher(verdict.entree.immatriculation ?? "")}, pas au véhicule de ce formulaire.
        </span>
      ) : (
        <span className="meta">Tapez un numéro ou un mot du libellé, puis choisissez ; le rattachement est vérifié.</span>
      )}
    </div>
  );
}
