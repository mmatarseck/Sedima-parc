"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, History, Lock, Trash2, X } from "lucide-react";
import { Numero } from "@/composants/interface/Numero";
import { Echeance } from "@/composants/interface/Pastille";
import { CHAMP_DATE, moisDe, peutCloturer, type ChampEdition, type Creation, type Modification } from "@/domaine/cloture";
import { TYPE_TRANSACTION, type TypeTransaction } from "@/domaine/reference";
import { enregistrerCreation, enregistrerModification, lireClotures, lireHistorique, retirerCreationLocale } from "@/lib/clotures-demo";
import { estSupprimable, resumeSuppression } from "@/domaine/suppression";
import { lireReferentiels } from "@/lib/referentiels-navigateur";
import { supprimerTransaction } from "@/lib/transactions-actions";
import { champsCourants } from "./champs";
import { resoudreReference } from "./ChampReference";
import { ChampSaisie } from "./ChampSaisie";
import { date as formaterDate } from "@/lib/format";
import { lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Modale de transaction — création ou modification.
 *
 * Une carte centrée, les champs du type, et pour une modification un motif
 * obligatoire — parce que chaque modification est tracée, et qu'une trace sans
 * raison ne sert à rien. Si le mois est clos, la modale le dit avant qu'on ne
 * touche à quoi que ce soit : la modification partira en demande, la création
 * attendra la réouverture. L'historique de la transaction se lit au même endroit.
 * ==========================================================================*/

function heure(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function valeurInitiale(champ: ChampEdition, brut: unknown): string | boolean {
  if (champ.type === "oui-non") return Boolean(brut);
  if (brut === null || brut === undefined) return "";
  if (champ.type === "date") return String(brut).slice(0, 10);
  if ((champ.type === "pieces" || champ.type === "lignes") && Array.isArray(brut)) return brut.length ? JSON.stringify(brut) : "";
  return String(brut);
}

function valeurSortie(champ: ChampEdition, saisie: string | boolean): unknown {
  if (champ.type === "oui-non") return Boolean(saisie);
  const s = String(saisie).trim();
  if (champ.type === "pieces") {
    try {
      return s.startsWith("[") ? (JSON.parse(s) as string[]) : [];
    } catch {
      return [];
    }
  }
  if (s === "") return null;
  if (champ.type === "nombre") {
    const n = Number(s.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return s;
}

/** Ce que le contrôle avant validation rend : une note, et une alerte bloquante. */
export interface ControleSaisie {
  note?: string | null;
  alerte?: string | null;
  /** Le libellé de la case qui confirme malgré l'alerte. */
  confirmation?: string;
}

type Issue = "appliquee" | "en-attente" | "rien" | "creee" | "mois-clos" | "invalide";

export function ModaleTransaction({
  mode,
  sujet,
  sujetDe,
  type,
  numero,
  titre,
  champs: champsDonnes,
  valeurs,
  href,
  cleMetier,
  onFermer,
  onEnregistre,
  apresCreation,
  apresModification,
  entraine,
  controle,
}: {
  mode: "modification" | "creation";
  sujet: string;
  sujetDe?: (valeurs: Record<string, unknown>) => string;
  /** Ce qu'une création entraîne ailleurs : clore l'ordre de travail que l'intervention réalise. */
  apresCreation?: (creation: Creation) => void;
  /**
   * Ce qu'une modification entraîne ailleurs, une fois appliquée : changer la
   * plaque d'un véhicule change l'adresse de sa fiche, qui doit suivre.
   */
  apresModification?: (apres: Record<string, unknown>) => void;
  /** Ce qu'un champ entraîne sur les autres : choisir la dépense réglée remplit le libellé et le montant. */
  entraine?: (cle: string, valeur: string | boolean, saisie: Record<string, string | boolean>) => Record<string, string | boolean> | null;
  /**
   * Le contrôle de cohérence avant validation (métier, 22 septembre 2026, pour le
   * relevé kilométrique) : une note — le dernier relevé — en bas du formulaire,
   * et une alerte qui bloque l'enregistrement tant qu'on ne l'a pas confirmée.
   */
  controle?: (saisie: Record<string, string | boolean>) => ControleSaisie;
  type: TypeTransaction;
  /** Nul à la création : le numéro est attribué à l'enregistrement. */
  numero: string | null;
  /** La clé métier, quand le numéro n'en est pas une (plan d'entretien). */
  cleMetier?: string;
  titre: string;
  /** Les champs à proposer ; ceux du type par défaut, relus des paramètres pour un véhicule. */
  champs?: ChampEdition[];
  valeurs: Record<string, unknown>;
  /** Adresse de la fiche, pour que la demande y ramène. */
  href: string;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const creation = mode === "creation";
  const tousChamps = useMemo(() => champsDonnes ?? champsCourants(type), [champsDonnes, type]);
  const [saisie, setSaisie] = useState<Record<string, string | boolean>>(() => Object.fromEntries(tousChamps.map((c) => [c.cle, valeurInitiale(c, valeurs[c.cle])])));
  const [motif, setMotif] = useState("");
  const [historique, setHistorique] = useState<Modification[]>([]);
  const [voirHistorique, setVoirHistorique] = useState(false);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [numeroAttribue, setNumeroAttribue] = useState<string | null>(null);
  const [approbateur, setApprobateur] = useState(false);
  const router = useRouter();
  const [suppression, setSuppression] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);
  const [supprimant, setSupprimant] = useState(false);
  const [forcer, setForcer] = useState(false);

  const champDate = CHAMP_DATE[type];
  const moisInitial = champDate ? moisDe(String(valeurs[champDate] ?? "")) : "";
  const moisSaisi = champDate ? moisDe(String(saisie[champDate] ?? "")) : "";
  const clotures = useMemo(() => (typeof window === "undefined" ? [] : lireClotures()), []);
  const clotureConcernee = clotures.find((c) => (moisInitial && c.mois === moisInitial) || (moisSaisi && c.mois === moisSaisi)) ?? null;

  useEffect(() => {
    if (numero) setHistorique(lireHistorique(numero));
    setApprobateur(peutCloturer(lireRole()));
  }, [numero]);

  useEffect(() => {
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("keydown", surEchap);
    return () => document.removeEventListener("keydown", surEchap);
  }, [onFermer]);

  /* Toute saisie passe par ici, pour qu'un champ puisse en remplir d'autres :
     la sortie de caisse qui cite la dépense réglée reprend son libellé, son
     montant et son bénéficiaire, et les reprend encore si l'on change d'avis.
     Ce que la fonction renvoie n'est qu'une proposition — l'utilisateur reste
     libre de la corriger ensuite. */
  function changer(cle: string, valeur: string | boolean) {
    setSaisie((s) => {
      const suivant = { ...s, [cle]: valeur };
      return { ...suivant, ...(entraine?.(cle, valeur, suivant) ?? {}) };
    });
  }

  /* Un champ qui n'a pas lieu d'être est retiré du formulaire, et avec lui son
     obligation : la date de sortie n'a de sens qu'une fois « sorti » choisi, et
     une obligation invisible bloquerait l'enregistrement sans rien expliquer. */
  const champs = useMemo(() => tousChamps.filter((c) => c.visibleSi?.(saisie) ?? true), [tousChamps, saisie]);

  const manquants = champs.filter((c) => c.obligatoire && String(saisie[c.cle] ?? "").trim() === "");
  const bloqueParCloture = creation && clotureConcernee !== null && !approbateur;

  /* Le véhicule du formulaire, pour borner les références : celui choisi dans
     le formulaire, sinon celui de la fiche qui porte la création. */
  const immatFormulaire = String(saisie.vehiculeId ?? valeurs.vehiculeId ?? "") || (sujet.startsWith("vehicule:") ? sujet.slice("vehicule:".length) : "") || null;
  /* Une référence saisie mais introuvable, du mauvais type ou d'un autre
     véhicule bloque l'enregistrement : c'est tout l'objet du contrôle. */
  const referencesInvalides = champs.filter((c) => c.type === "reference" && String(saisie[c.cle] ?? "").trim() !== "" && resoudreReference(String(saisie[c.cle] ?? ""), c.references, immatFormulaire).etat !== "valide");
  const verdict = useMemo(() => controle?.(saisie) ?? null, [controle, saisie]);
  const alerte = verdict?.alerte ?? null;
  /* Une confirmation vaut pour l'alerte lue, pas pour la suivante. */
  useEffect(() => setForcer(false), [alerte]);
  const peutEnregistrer = manquants.length === 0 && referencesInvalides.length === 0 && (creation || motif.trim().length >= 3) && issue === null && !bloqueParCloture && (!alerte || forcer);

  /* Les champs groupés dans l'ordre où ils viennent : une section par titre
     déclaré, et un groupe sans titre pour les types qui n'en déclarent pas —
     l'immense majorité, qui tiennent en cinq champs. */
  const sections = useMemo(() => {
    const groupes: { titre?: string; champs: ChampEdition[] }[] = [];
    for (const c of champs) {
      const dernier = groupes.at(-1);
      if (dernier && dernier.titre === c.section) dernier.champs.push(c);
      else groupes.push({ titre: c.section, champs: [c] });
    }
    return groupes;
  }, [champs]);

  function enregistrer() {
    if (!peutEnregistrer) return;
    const apres: Record<string, unknown> = { ...valeurs };
    for (const c of champs) apres[c.cle] = valeurSortie(c, saisie[c.cle] ?? "");
    /* Confirmée malgré l'alerte : la saisie reste, avec son motif — le contrôle l'écartera des calculs. */
    if (alerte && forcer) apres.motifRejet = alerte;

    if (creation) {
      const resultat = enregistrerCreation({ sujet: sujetDe ? sujetDe(apres) : sujet, type, champs, valeurs: apres, motif: motif.trim() });
      setIssue(resultat.issue);
      if (resultat.issue === "creee") {
        setNumeroAttribue(resultat.creation.numero);
        apresCreation?.(resultat.creation);
        onEnregistre();
        setTimeout(onFermer, 1600);
      }
      return;
    }

    const resultat = enregistrerModification({ numero: numero!, type, titre, href, champs, avant: valeurs, apres, motif: motif.trim(), sujet, cleMetier });
    setIssue(resultat.issue);
    if (resultat.issue !== "rien") {
      onEnregistre();
      if (resultat.issue === "appliquee") apresModification?.(apres);
      setTimeout(onFermer, 1400);
    }
  }

  const libelleType = TYPE_TRANSACTION[type].libelle;

  /*
   * Supprimer (métier, 21 septembre 2026 : « possibilité de supprimer une panne
   * créée, un service créé ou autre — garder la trace dans le journal »). Le
   * motif est obligatoire, comme pour une modification. Une ligne que la base
   * n'a pas encore prise s'efface du navigateur ; les autres, en base, avec une
   * ligne « Suppression » dans la trace.
   */
  const supprimable = !creation && Boolean(numero) && estSupprimable(type);
  async function supprimer() {
    if (!numero) return;
    if (motif.trim().length < 3) return setSuppression({ ton: "erreur", texte: "Donnez le motif de la suppression : il reste dans le journal." });
    if (!window.confirm(`Supprimer ${libelleType.toLowerCase()} ${numero} ? La ligne disparaît ; sa trace reste au journal.`)) return;
    setSupprimant(true);
    const plaque = immatFormulaire ? (lireReferentiels().vehicules.find((v) => v.id === immatFormulaire || v.immatriculation === immatFormulaire)?.immatriculation ?? immatFormulaire) : null;
    const locale = retirerCreationLocale(numero);
    if (locale.trouvee && !locale.enBase) {
      setSupprimant(false);
      setSuppression({ ton: "ok", texte: "Supprimée : elle n'était pas encore en base." });
      onEnregistre();
      setTimeout(onFermer, 1200);
      return;
    }
    const r = await supprimerTransaction({ type, numero, motif: motif.trim(), resume: resumeSuppression(libelleType, numero, titre, plaque) });
    setSupprimant(false);
    if (r.issue === "refusee") return setSuppression({ ton: "erreur", texte: r.motif });
    if (r.issue === "hors-base") return setSuppression({ ton: "erreur", texte: "La suppression demande une base branchée." });
    setSuppression({ ton: "ok", texte: "Supprimée — la trace reste au journal." });
    onEnregistre();
    router.refresh();
    setTimeout(onFermer, 1200);
  }

  return (
    <>
      <button type="button" aria-label="Fermer" onClick={onFermer} className="fixed inset-0 z-50 cursor-default bg-encre/30" />
      <div role="dialog" aria-modal="true" aria-label={`${creation ? "Créer" : "Modifier"} ${titre}`} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="pointer-events-auto flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[16px] border border-bordure bg-surface shadow-modale" style={{ animation: "apparition 160ms ease-out" }}>
          {/* ---- En-tête ---- */}
          <div className="flex items-start gap-3 border-b border-bordure px-6 py-4">
            <div className="min-w-0 flex-1">
              <p className="micro-sur-titre">
                {libelleType} · {creation ? "création" : "modification"}
              </p>
              <h2 className="titre-bloc mt-0.5 truncate">{titre}</h2>
              <p className="mt-1">{numero ? <Numero valeur={numero} /> : numeroAttribue ? <Numero valeur={numeroAttribue} /> : <span className="meta">Le numéro sera attribué à l&apos;enregistrement.</span>}</p>
            </div>
            {!creation ? (
              <button type="button" onClick={() => setVoirHistorique((v) => !v)} aria-pressed={voirHistorique} className={`bouton-discret ${voirHistorique ? "bg-surface-3 text-texte" : ""}`}>
                <History className="size-4" strokeWidth={1.7} />
                Historique
                {historique.length ? <span className="badge-texte rounded-full bg-surface-3 px-1.5 py-px">{historique.length}</span> : null}
              </button>
            ) : null}
            <button type="button" onClick={onFermer} className="grid size-8 shrink-0 place-items-center rounded-full text-texte-2 hover:bg-surface-3 hover:text-texte">
              <X className="size-4" strokeWidth={1.8} />
              <span className="sr-only">Fermer</span>
            </button>
          </div>

          <div className="defilement-discret min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {/* ---- Mois clos ---- */}
            {clotureConcernee ? (
              <div className={`mb-5 flex items-start gap-3 rounded-[10px] px-4 py-3 ${approbateur ? "bg-vigilance-fond" : "bg-defavorable-fond"}`}>
                <Lock className={`mt-0.5 size-4 shrink-0 ${approbateur ? "text-vigilance" : "text-defavorable"}`} strokeWidth={1.9} />
                <div className="text-[13px] leading-relaxed text-texte">
                  <p className="font-medium">
                    Mois {clotureConcernee.mois} clos par {clotureConcernee.closPar} le {formaterDate(clotureConcernee.closLe)}.
                  </p>
                  <p className="text-texte-2">
                    {approbateur
                      ? `Vous pouvez ${creation ? "créer" : "modifier"} : l'opération sera tracée comme approuvée par vous.`
                      : creation
                        ? "On ne crée pas de transaction sur un mois clos : changez la date, ou demandez la réouverture à la direction."
                        : "Votre modification partira en demande d'approbation à la direction ; rien ne change tant qu'elle n'est pas approuvée."}
                  </p>
                </div>
              </div>
            ) : null}

            {voirHistorique ? (
              <div className="mb-5 rounded-[12px] border border-bordure">
                <p className="micro-sur-titre border-b border-bordure px-4 py-2.5">Historique des modifications</p>
                {historique.length === 0 ? (
                  <p className="meta px-4 py-5 text-center">Aucune modification depuis la création.</p>
                ) : (
                  <ol className="flex flex-col">
                    {historique.map((m) => (
                      <li key={m.id} className="flex items-start gap-3 border-b border-bordure px-4 py-2.5 last:border-b-0">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-[10px] font-semibold text-texte-2">{m.initiales}</span>
                        <div className="min-w-0 flex-1 text-[12.5px]">
                          <p className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-medium text-texte">{m.auteur}</span>
                            <span className="code text-[11.5px] text-attenue">
                              {formaterDate(m.date)} {heure(m.date)}
                            </span>
                            <span className="ml-auto">
                              <Echeance ton={m.statut === "appliquee" ? "favorable" : m.statut === "en-attente" ? "vigilance" : "defavorable"}>
                                {m.statut === "appliquee" ? "appliquée" : m.statut === "en-attente" ? "en attente" : "refusée"}
                              </Echeance>
                            </span>
                          </p>
                          <p className="mt-0.5 text-texte-2">
                            <span className="font-medium text-texte">{m.libelleChamp}</span> : {m.champ === "creation" ? m.apres : (
                              <>
                                <span className="line-through">{m.avant}</span> → <span className="font-medium text-texte">{m.apres}</span>
                              </>
                            )}
                          </p>
                          <p className="meta mt-0.5">
                            {m.motif}
                            {m.moisClos ? ` · mois ${m.moisClos} clos` : ""}
                            {m.decideePar ? ` · ${m.statut === "refusee" ? "refusée" : "approuvée"} par ${m.decideePar}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : null}

            {/* ---- Champs, par sections quand le type en déclare ---- */}
            {sections.map((s) => (
              <div key={s.titre ?? "—"} className={s.titre ? "mt-5 first:mt-0" : ""}>
                {s.titre ? <h3 className="titre-bloc mb-3 border-b border-bordure pb-1.5 text-[13px]">{s.titre}</h3> : null}
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                  {s.champs.map((c) => {
                    const large = c.type === "texte-long" || c.type === "reference";
                    return (
                      <label key={c.cle} className={`flex flex-col gap-1.5 ${large ? "sm:col-span-2" : ""}`}>
                        <span className="label-champ">
                          {c.libelle}
                          {c.obligatoire ? <span className="text-defavorable"> ●</span> : null}
                        </span>
                        <ChampSaisie champ={c} valeur={saisie[c.cle] ?? ""} saisie={saisie} onChange={(valeur) => changer(c.cle, valeur)} immatriculation={immatFormulaire} />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* ---- Contrôle avant validation ---- */}
            {verdict?.note ? <p className="mt-5 rounded-[10px] bg-surface-2 px-4 py-2.5 text-[12.5px] leading-relaxed text-texte-2">{verdict.note}</p> : null}
            {alerte ? (
              <div className="mt-3 rounded-[10px] bg-defavorable-fond px-4 py-3 text-[12.5px] leading-relaxed">
                <p className="font-medium text-defavorable">Contrôle de cohérence : {alerte}.</p>
                <label className="mt-2 flex items-start gap-2 text-texte-2">
                  <input type="checkbox" checked={forcer} onChange={(e) => setForcer(e.target.checked)} className="mt-0.5 accent-accent" />
                  {verdict?.confirmation ?? "Enregistrer quand même : la saisie est gardée, mais écartée des calculs."}
                </label>
              </div>
            ) : null}

            {/* ---- Motif ---- */}
            <label className="mt-5 flex flex-col gap-1.5">
              <span className="label-champ">
                {creation ? "Commentaire" : supprimable ? "Motif de la modification ou de la suppression" : "Motif de la modification"} {creation ? null : <span className="text-defavorable">●</span>}
              </span>
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={2}
                placeholder={creation ? "Facultatif — ce qu'il faut savoir sur cette transaction." : "Pourquoi cette modification ? Elle sera lue dans l'historique, et par la direction si le mois est clos."}
                className="w-full resize-none rounded-[10px] border border-bordure-champ bg-surface px-3 py-2 text-[13px] leading-relaxed text-texte outline-none placeholder:text-attenue focus:border-accent"
              />
            </label>
          </div>

          {/* ---- Pied ---- */}
          <div className="flex items-center gap-3 border-t border-bordure px-6 py-4">
            {supprimable ? (
              <button type="button" onClick={() => void supprimer()} disabled={supprimant || issue !== null} className="bouton-secondaire text-defavorable" title="Le motif ci-dessus est obligatoire ; la suppression reste au journal">
                <Trash2 className="size-4" strokeWidth={1.8} />
                Supprimer
              </button>
            ) : null}
            <p className="meta min-w-0 flex-1">
              {suppression ? (
                <span className={`font-medium ${suppression.ton === "ok" ? "text-favorable" : "text-defavorable"}`}>{suppression.texte}</span>
              ) : issue === "appliquee" ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-favorable">
                  <Check className="size-4" strokeWidth={2.2} />
                  Modification enregistrée et tracée.
                </span>
              ) : issue === "creee" ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-favorable">
                  <Check className="size-4" strokeWidth={2.2} />
                  Créée sous le numéro {numeroAttribue}.
                </span>
              ) : issue === "en-attente" ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-vigilance">
                  <Lock className="size-4" strokeWidth={2} />
                  Demande envoyée à la direction pour approbation.
                </span>
              ) : issue === "mois-clos" ? (
                <span className="font-medium text-defavorable">Mois clos : changez la date ou demandez la réouverture.</span>
              ) : issue === "rien" ? (
                "Aucun champ n'a changé."
              ) : issue === "invalide" ? (
                "La date est obligatoire."
              ) : manquants.length ? (
                `À renseigner : ${manquants.map((c) => c.libelle.toLowerCase()).join(", ")}.`
              ) : referencesInvalides.length ? (
                <span className="font-medium text-defavorable">Rattachement à vérifier : {referencesInvalides.map((c) => c.libelle.toLowerCase()).join(", ")}.</span>
              ) : alerte && !forcer ? (
                <span className="font-medium text-defavorable">Saisie incohérente : corrigez-la, ou confirmez-la.</span>
              ) : !creation && motif.trim().length < 3 ? (
                "Le motif est obligatoire."
              ) : bloqueParCloture ? (
                "Mois clos : la création est bloquée."
              ) : clotureConcernee && !approbateur ? (
                "Enregistrer soumettra la demande."
              ) : creation ? (
                "Un numéro unique sera attribué et la création tracée avec votre nom."
              ) : (
                "Chaque champ modifié sera tracé avec votre nom, la date et le motif."
              )}
            </p>
            <button type="button" onClick={onFermer} className="bouton-secondaire">
              Annuler
            </button>
            <button type="button" onClick={enregistrer} disabled={!peutEnregistrer} className="bouton-principal disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-attenue-2">
              {creation ? "Créer" : clotureConcernee && !approbateur ? "Soumettre la demande" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
