"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { Pastille } from "@/composants/interface/Pastille";
import { peutCloturer } from "@/domaine/cloture";
import {
  FAMILLES_VEHICULE,
  PARAMETRES_DEFAUT,
  VEHICULES_DEFAUT,
  apprendreMarqueModele,
  cleNom,
  nouvelIdCategorie,
  type CategorieVehiculeParametree,
  type MarqueVehicule,
  type Parametres,
} from "@/domaine/parametres";
import { trouverRole } from "@/domaine/roles";
import type { CategorieVehicule } from "@/domaine/types";
import { nombre } from "@/lib/format";
import { ecrireParametres, lireParametres } from "@/lib/parametres-demo";
import { lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Paramètres › Véhicules — le référentiel des véhicules.
 *
 * Demande du métier du 7 septembre 2026 : marque, modèle et catégorie se
 * tiennent en paramètres, et s'enrichissent au fil des créations. L'écran
 * montre la liste, ce que le parc en porte, et ce que le parc porte sans que
 * la liste le sache. Marques et modèles se retirent quand rien ne les porte ;
 * les huit familles ne se retirent jamais — elles portent les règles —, mais
 * se renomment, et toute catégorie ajoutée se rattache à l'une d'elles.
 * ==========================================================================*/

export interface VehiculeDuParc {
  marque: string;
  modele: string;
  categorie: CategorieVehicule;
  categorieMetier: string | null;
}

const CHAMP = "h-8 rounded-[8px] border border-bordure-champ bg-surface px-2 text-[13px] text-texte outline-none focus:border-accent disabled:border-transparent disabled:bg-transparent disabled:px-0";
const CELLULE = "border-b border-bordure px-3 py-2 align-top";
const EN_TETE = "en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-3 text-left";

export function EcranVehicules({ parc }: { parc: VehiculeDuParc[] }) {
  const router = useRouter();
  const [p, setP] = useState<Parametres>(PARAMETRES_DEFAUT);
  const [habilite, setHabilite] = useState(false);
  const [nomRole, setNomRole] = useState("");
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouvelleMarque, setNouvelleMarque] = useState("");
  const [nouveauModele, setNouveauModele] = useState<Record<string, string>>({});
  const [aFocaliser, setAFocaliser] = useState<string | null>(null);
  const champs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setP(lireParametres());
    const r = trouverRole(lireRole());
    setHabilite(peutCloturer(r.role));
    setNomRole(r.libelle);
  }, []);

  useEffect(() => {
    if (aFocaliser) {
      champs.current[aFocaliser]?.focus();
      setAFocaliser(null);
    }
  }, [aFocaliser]);

  const { marques, categories } = p.vehicules;

  /* Ce que le parc porte : par marque, par modèle dans sa marque, par catégorie. */
  const usages = useMemo(() => {
    const parMarque = new Map<string, number>();
    const parModele = new Map<string, number>();
    const parCategorie = new Map<string, number>();
    for (const v of parc) {
      const m = cleNom(v.marque);
      parMarque.set(m, (parMarque.get(m) ?? 0) + 1);
      const mod = `${m}|${cleNom(v.modele)}`;
      parModele.set(mod, (parModele.get(mod) ?? 0) + 1);
      const c = v.categorieMetier ?? v.categorie;
      parCategorie.set(c, (parCategorie.get(c) ?? 0) + 1);
    }
    return { parMarque, parModele, parCategorie };
  }, [parc]);

  /* Les marques que le parc porte et que le référentiel ignore encore — avec
     leurs modèles — pour les intégrer d'un clic, orthographe comprise. */
  const inconnues = useMemo(() => {
    const connues = new Set(marques.map((m) => cleNom(m.nom)));
    const parCle = new Map<string, MarqueVehicule>();
    for (const v of parc) {
      const cle = cleNom(v.marque);
      if (!cle || connues.has(cle)) continue;
      const nom = v.marque.charAt(0).toUpperCase() + v.marque.slice(1).toLowerCase();
      const m = parCle.get(cle) ?? { nom, modeles: [] };
      const mod = v.modele.replace(/\s+/g, " ").trim();
      if (mod && !m.modeles.some((x) => cleNom(x) === cleNom(mod))) m.modeles.push(mod);
      parCle.set(cle, m);
    }
    return [...parCle.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [marques, parc]);

  const modifie = JSON.stringify(p.vehicules) !== JSON.stringify(VEHICULES_DEFAUT);
  const sansNom = categories.filter((c) => !c.libelle.trim()).length + marques.filter((m) => !m.nom.trim()).length;
  const valide = sansNom === 0;

  function regler(vehicules: Parametres["vehicules"]) {
    setP({ ...p, vehicules });
    setEnregistre(false);
  }
  function reglerMarques(suite: MarqueVehicule[]) {
    regler({ ...p.vehicules, marques: suite });
  }
  function reglerCategories(suite: CategorieVehiculeParametree[]) {
    regler({ ...p.vehicules, categories: suite });
  }

  function ajouterMarque(nom: string, modeles: string[] = []) {
    const propre = nom.replace(/\s+/g, " ").trim();
    if (!propre) return;
    let suite = apprendreMarqueModele(marques, propre, null);
    for (const mod of modeles) suite = apprendreMarqueModele(suite, propre, mod);
    reglerMarques(suite);
    setNouvelleMarque("");
  }
  function retirerMarque(m: MarqueVehicule) {
    reglerMarques(marques.filter((x) => x !== m));
  }
  function ajouterModele(m: MarqueVehicule) {
    const mod = (nouveauModele[m.nom] ?? "").trim();
    if (!mod) return;
    reglerMarques(apprendreMarqueModele(marques, m.nom, mod));
    setNouveauModele((v) => ({ ...v, [m.nom]: "" }));
  }
  function retirerModele(m: MarqueVehicule, mod: string) {
    reglerMarques(marques.map((x) => (x === m ? { ...x, modeles: x.modeles.filter((y) => y !== mod) } : x)));
  }

  function ajouterCategorie() {
    const id = nouvelIdCategorie("nouvelle", categories);
    reglerCategories([...categories, { id, libelle: "", famille: "camion", standard: false }]);
    setAFocaliser(id);
  }
  function reglerCategorie(id: string, champ: Partial<CategorieVehiculeParametree>) {
    reglerCategories(categories.map((c) => (c.id === id ? { ...c, ...champ } : c)));
  }
  function retirerCategorie(c: CategorieVehiculeParametree) {
    reglerCategories(categories.filter((x) => x.id !== c.id));
  }

  function enregistrer() {
    if (!valide) return;
    /* L'identifiant d'une catégorie ajoutée suit son libellé au premier enregistrement ; il est ensuite stable. */
    const suite: Parametres = {
      ...p,
      vehicules: {
        ...p.vehicules,
        categories: categories.map((c) => (c.standard || !c.id.startsWith("cat-nouvelle") ? c : { ...c, id: nouvelIdCategorie(c.libelle, categories.filter((x) => x.id !== c.id)) })),
      },
    };
    setP(suite);
    setErreur(null);
    void ecrireParametres(suite).then((refus) => {
      if (refus) {
        setErreur(refus);
        return;
      }
      setEnregistre(true);
      router.refresh();
      setTimeout(() => setEnregistre(false), 1800);
    });
  }

  function reinitialiser() {
    regler({ marques: VEHICULES_DEFAUT.marques.map((m) => ({ ...m, modeles: [...m.modeles] })), categories: VEHICULES_DEFAUT.categories.map((c) => ({ ...c })) });
    setErreur(null);
  }

  const libelleFamille = (f: CategorieVehicule) => categories.find((c) => c.id === f)?.libelle ?? f;
  const totalModeles = marques.reduce((s, m) => s + m.modeles.length, 0);

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Paramètres
        </Link>
      </nav>
      <TitreEcran
        titre="Véhicules"
        sousTitre={
          habilite
            ? `${marques.length} marques, ${totalModeles} modèles, ${categories.length} catégories — proposés à la création d'un véhicule, enrichis de ce qui s'y saisit`
            : `Lecture seule — le réglage relève de la direction et de l'administrateur (vous êtes ${nomRole.toLowerCase()})`
        }
        actions={
          habilite ? (
            <>
              {erreur ? <span className="max-w-[360px] text-[12.5px] leading-[1.4] text-defavorable">{erreur}</span> : null}
              <button type="button" onClick={reinitialiser} disabled={!modifie} className="bouton-secondaire disabled:cursor-not-allowed disabled:opacity-50">
                <RotateCcw className="size-4 text-texte-2" strokeWidth={1.7} />
                Liste de départ
              </button>
              <button type="button" onClick={enregistrer} disabled={!valide} className="bouton-principal disabled:cursor-not-allowed disabled:opacity-50" title={valide ? undefined : "Une ligne sans nom"}>
                <Check className="size-4" strokeWidth={2.2} />
                {enregistre ? "Enregistré" : "Enregistrer"}
              </button>
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Carte
            titre="Marques et modèles"
            precision="Ce que le formulaire propose ; ce qui s'y écrit de nouveau entre ici à la création du véhicule"
            action={
              habilite ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    ajouterMarque(nouvelleMarque);
                  }}
                >
                  <input type="text" value={nouvelleMarque} onChange={(e) => setNouvelleMarque(e.target.value)} placeholder="Nouvelle marque" aria-label="Nouvelle marque" className={`${CHAMP} w-[170px]`} />
                  <button type="submit" disabled={!nouvelleMarque.trim()} className="bouton-secondaire h-8 disabled:cursor-not-allowed disabled:opacity-50">
                    <Plus className="size-4" strokeWidth={2} />
                    Ajouter
                  </button>
                </form>
              ) : null
            }
            sansMarge
          >
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className={`${EN_TETE} px-5`}>Marque</th>
                    <th className={EN_TETE}>Modèles</th>
                    <th className={`${EN_TETE} text-right whitespace-nowrap`}>Véhicules</th>
                    <th className={EN_TETE} />
                  </tr>
                </thead>
                <tbody>
                  {marques.map((m) => {
                    const cle = cleNom(m.nom);
                    const portes = usages.parMarque.get(cle) ?? 0;
                    return (
                      <tr key={m.nom} className="hover:bg-surface-2">
                        <td className={`${CELLULE} px-5 whitespace-nowrap`}>
                          <span className="text-[13px] font-medium text-texte">{m.nom}</span>
                        </td>
                        <td className={CELLULE}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {m.modeles.map((mod) => {
                              const n = usages.parModele.get(`${cle}|${cleNom(mod)}`) ?? 0;
                              return (
                                <span key={mod} className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-3 pr-1 pl-2.5 text-[12px] text-texte" title={n ? `${nombre(n)} véhicule${n > 1 ? "s" : ""}` : "Aucun véhicule ne porte ce modèle"}>
                                  {mod}
                                  {n ? <span className="code text-[10.5px] text-attenue">{n}</span> : null}
                                  {habilite && n === 0 ? (
                                    <button type="button" onClick={() => retirerModele(m, mod)} className="grid size-5 place-items-center rounded-full text-attenue hover:bg-surface hover:text-defavorable" aria-label={`Retirer ${mod}`}>
                                      <X className="size-3" strokeWidth={2} />
                                    </button>
                                  ) : (
                                    <span className="w-1" />
                                  )}
                                </span>
                              );
                            })}
                            {habilite ? (
                              <form
                                className="inline-flex items-center gap-1"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  ajouterModele(m);
                                }}
                              >
                                <input type="text" value={nouveauModele[m.nom] ?? ""} onChange={(e) => setNouveauModele((v) => ({ ...v, [m.nom]: e.target.value }))} placeholder="Modèle…" aria-label={`Nouveau modèle ${m.nom}`} className={`${CHAMP} h-7 w-[120px] text-[12px]`} />
                                <button type="submit" disabled={!(nouveauModele[m.nom] ?? "").trim()} className="grid size-7 place-items-center rounded-full text-texte-2 hover:bg-surface-3 hover:text-texte disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Ajouter un modèle ${m.nom}`}>
                                  <Plus className="size-3.5" strokeWidth={2.2} />
                                </button>
                              </form>
                            ) : m.modeles.length === 0 ? (
                              <span className="meta">—</span>
                            ) : null}
                          </div>
                        </td>
                        <td className={`${CELLULE} text-right`}>{portes ? <span className="code">{nombre(portes)}</span> : <Pastille ton="neutre">aucun</Pastille>}</td>
                        <td className={`${CELLULE} text-right`}>
                          {habilite ? (
                            <button
                              type="button"
                              onClick={() => retirerMarque(m)}
                              disabled={portes > 0}
                              className="bouton-discret text-attenue hover:text-defavorable disabled:cursor-not-allowed disabled:opacity-40"
                              title={portes > 0 ? `${nombre(portes)} véhicule${portes > 1 ? "s" : ""} porte${portes > 1 ? "nt" : ""} cette marque : elle ne peut pas disparaître` : "Retirer cette marque"}
                              aria-label={`Retirer ${m.nom}`}
                            >
                              <Trash2 className="size-4" strokeWidth={1.7} />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {inconnues.length ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-bordure px-5 py-3">
                <span className="meta">Dans le parc, absentes du référentiel :</span>
                {inconnues.map((m) => (
                  <button key={m.nom} type="button" disabled={!habilite} onClick={() => ajouterMarque(m.nom, m.modeles)} className="champ-pilule h-7 text-[12px]" title={habilite ? `Intégrer ${m.nom} et ${m.modeles.length} modèle${m.modeles.length > 1 ? "s" : ""}` : undefined}>
                    {m.nom}
                    <span className="ml-1 code text-[10.5px] text-attenue">{usages.parMarque.get(cleNom(m.nom)) ?? 0}</span>
                    {habilite ? <span className="ml-1 text-attenue">· intégrer</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </Carte>

          <Carte
            titre="Catégories"
            precision="Les huit familles portent les règles et se renomment ; une catégorie ajoutée suit les règles de sa famille"
            action={
              habilite ? (
                <button type="button" onClick={ajouterCategorie} className="bouton-secondaire h-8">
                  <Plus className="size-4" strokeWidth={2} />
                  Ajouter une catégorie
                </button>
              ) : null
            }
            sansMarge
          >
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className={`${EN_TETE} px-5`}>Catégorie</th>
                    <th className={EN_TETE}>Famille (règles)</th>
                    <th className={`${EN_TETE} text-right whitespace-nowrap`}>Véhicules</th>
                    <th className={EN_TETE} />
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => {
                    const portes = usages.parCategorie.get(c.id) ?? 0;
                    return (
                      <tr key={c.id} className="hover:bg-surface-2">
                        <td className={`${CELLULE} px-5`}>
                          <div className="flex flex-col gap-0.5">
                            <input
                              ref={(el) => {
                                champs.current[c.id] = el;
                              }}
                              type="text"
                              value={c.libelle}
                              placeholder="Nom de la catégorie"
                              disabled={!habilite}
                              onChange={(e) => reglerCategorie(c.id, { libelle: e.target.value })}
                              className={`${CHAMP} w-[220px] font-medium ${c.libelle.trim() ? "" : "border-defavorable"}`}
                            />
                            <span className="code text-[10.5px] text-attenue">{c.standard ? `${c.id} · famille` : c.id.startsWith("cat-nouvelle") ? "identifiant donné à l'enregistrement" : c.id}</span>
                          </div>
                        </td>
                        <td className={CELLULE}>
                          {c.standard ? (
                            <span className="text-[12.5px] text-texte-2">Elle-même</span>
                          ) : (
                            <select value={c.famille} disabled={!habilite} onChange={(e) => reglerCategorie(c.id, { famille: e.target.value as CategorieVehicule })} className={`${CHAMP} w-[170px]`}>
                              {FAMILLES_VEHICULE.map((f) => (
                                <option key={f} value={f}>
                                  {libelleFamille(f)}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className={`${CELLULE} text-right`}>{portes ? <span className="code">{nombre(portes)}</span> : <Pastille ton="neutre">aucun</Pastille>}</td>
                        <td className={`${CELLULE} text-right`}>
                          {habilite && !c.standard ? (
                            <button
                              type="button"
                              onClick={() => retirerCategorie(c)}
                              disabled={portes > 0}
                              className="bouton-discret text-attenue hover:text-defavorable disabled:cursor-not-allowed disabled:opacity-40"
                              title={portes > 0 ? `${nombre(portes)} véhicule${portes > 1 ? "s" : ""} porte${portes > 1 ? "nt" : ""} cette catégorie : elle ne peut pas disparaître` : "Retirer cette catégorie"}
                              aria-label={`Retirer ${c.libelle || "cette catégorie"}`}
                            >
                              <Trash2 className="size-4" strokeWidth={1.7} />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Carte>
        </div>

        <div className="flex flex-col gap-5">
          <Carte titre="Où ce référentiel s'applique">
            <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-texte-2">
              <li>
                <span className="font-medium text-texte">À la création d&apos;un véhicule</span> : marque et modèle sont proposés en suggestion — on choisit ce qui existe, on écrit ce qui n&apos;existe pas encore, et la liste l&apos;apprend aussitôt. La catégorie se choisit dans cette liste.
              </li>
              <li>
                <span className="font-medium text-texte">Une orthographe, une marque</span> : « MITSUBISHI », « Mitsubishi » et « mitsibushi » se rapprochent ; c&apos;est le nom du référentiel qui s&apos;affiche.
              </li>
              <li>
                <span className="font-medium text-texte">Les familles</span> — camion, tracteur, semi-remorque, camionnette, véhicule léger, bus, moto, engin — sont les clés des règles : documents exigés des poids lourds, plafond kilométrique, programme d&apos;entretien, silhouette. Elles se renomment, jamais ne se retirent.
              </li>
              <li>
                <span className="font-medium text-texte">Une catégorie ajoutée</span> (« Citerne à eau », « Frigo 5 t ») se rattache à une famille et en suit les règles ; le véhicule la porte, la fiche et la liste la nomment, les rapports comptent par famille.
              </li>
              <li>
                <span className="font-medium text-texte">Retirer</span> : une marque, un modèle ou une catégorie que des véhicules portent ne peut pas disparaître — le compte le dit.
              </li>
              <li>
                <span className="font-medium text-texte">Usages et énergies</span> restent fixes : l&apos;usage filtre la disponibilité du jour, l&apos;énergie décide du prix du plein. Ils se lisent dans{" "}
                <Link href="/parametres/referentiels" className="font-medium text-accent-fonce hover:text-accent">
                  Référentiels
                </Link>
                .
              </li>
            </ul>
            <p className="mt-3 flex items-center gap-2">
              <Pastille ton={modifie ? "vigilance" : "neutre"}>{modifie ? "Liste modifiée" : "Liste de départ"}</Pastille>
              {sansNom ? <Pastille ton="defavorable">Une ligne sans nom</Pastille> : null}
            </p>
          </Carte>
        </div>
      </div>
    </div>
  );
}
