"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, History, Lock, X } from "lucide-react";
import { Numero } from "@/composants/interface/Numero";
import { Echeance } from "@/composants/interface/Pastille";
import { CHAMP_DATE, moisDe, peutCloturer, type ChampEdition, type Creation, type Modification } from "@/domaine/cloture";
import { TYPE_TRANSACTION, type TypeTransaction } from "@/domaine/reference";
import { enregistrerCreation, enregistrerModification, lireClotures, lireHistorique } from "@/lib/clotures-demo";
import { ChampReference, resoudreReference } from "./ChampReference";
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
  return String(brut);
}

function valeurSortie(champ: ChampEdition, saisie: string | boolean): unknown {
  if (champ.type === "oui-non") return Boolean(saisie);
  const s = String(saisie).trim();
  if (s === "") return null;
  if (champ.type === "nombre") {
    const n = Number(s.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return s;
}

type Issue = "appliquee" | "en-attente" | "rien" | "creee" | "mois-clos" | "invalide";

export function ModaleTransaction({
  mode,
  sujet,
  sujetDe,
  type,
  numero,
  titre,
  champs,
  valeurs,
  href,
  onFermer,
  onEnregistre,
  apresCreation,
  entraine,
}: {
  mode: "modification" | "creation";
  sujet: string;
  sujetDe?: (valeurs: Record<string, unknown>) => string;
  /** Ce qu'une création entraîne ailleurs : clore l'ordre de travail que l'intervention réalise. */
  apresCreation?: (creation: Creation) => void;
  /** Ce qu'un champ entraîne sur les autres : choisir la dépense réglée remplit le libellé et le montant. */
  entraine?: (cle: string, valeur: string | boolean, saisie: Record<string, string | boolean>) => Record<string, string | boolean> | null;
  type: TypeTransaction;
  /** Nul à la création : le numéro est attribué à l'enregistrement. */
  numero: string | null;
  titre: string;
  champs: ChampEdition[];
  valeurs: Record<string, unknown>;
  /** Adresse de la fiche, pour que la demande y ramène. */
  href: string;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const creation = mode === "creation";
  const [saisie, setSaisie] = useState<Record<string, string | boolean>>(() => Object.fromEntries(champs.map((c) => [c.cle, valeurInitiale(c, valeurs[c.cle])])));
  const [motif, setMotif] = useState("");
  const [historique, setHistorique] = useState<Modification[]>([]);
  const [voirHistorique, setVoirHistorique] = useState(false);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [numeroAttribue, setNumeroAttribue] = useState<string | null>(null);
  const [approbateur, setApprobateur] = useState(false);

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

  const manquants = champs.filter((c) => c.obligatoire && String(saisie[c.cle] ?? "").trim() === "");
  const bloqueParCloture = creation && clotureConcernee !== null && !approbateur;

  /* Le véhicule du formulaire, pour borner les références : celui choisi dans
     le formulaire, sinon celui de la fiche qui porte la création. */
  const immatFormulaire = String(saisie.vehiculeId ?? valeurs.vehiculeId ?? "") || (sujet.startsWith("vehicule:") ? sujet.slice("vehicule:".length) : "") || null;
  /* Une référence saisie mais introuvable, du mauvais type ou d'un autre
     véhicule bloque l'enregistrement : c'est tout l'objet du contrôle. */
  const referencesInvalides = champs.filter((c) => c.type === "reference" && String(saisie[c.cle] ?? "").trim() !== "" && resoudreReference(String(saisie[c.cle] ?? ""), c.references, immatFormulaire).etat !== "valide");
  const peutEnregistrer = manquants.length === 0 && referencesInvalides.length === 0 && (creation || motif.trim().length >= 3) && issue === null && !bloqueParCloture;

  function enregistrer() {
    if (!peutEnregistrer) return;
    const apres: Record<string, unknown> = { ...valeurs };
    for (const c of champs) apres[c.cle] = valeurSortie(c, saisie[c.cle] ?? "");

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

    const resultat = enregistrerModification({ numero: numero!, type, titre, href, champs, avant: valeurs, apres, motif: motif.trim() });
    setIssue(resultat.issue);
    if (resultat.issue !== "rien") {
      onEnregistre();
      setTimeout(onFermer, 1400);
    }
  }

  const libelleType = TYPE_TRANSACTION[type].libelle;

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

            {/* ---- Champs ---- */}
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              {champs.map((c) => {
                const v = saisie[c.cle];
                const large = c.type === "texte-long" || c.type === "reference";
                const commun = "h-9 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent";
                return (
                  <label key={c.cle} className={`flex flex-col gap-1.5 ${large ? "sm:col-span-2" : ""}`}>
                    <span className="label-champ">
                      {c.libelle}
                      {c.obligatoire ? <span className="text-defavorable"> ●</span> : null}
                    </span>
                    {c.type === "oui-non" ? (
                      <button type="button" role="switch" aria-checked={Boolean(v)} onClick={() => changer(c.cle, !saisie[c.cle])} className="flex h-9 items-center gap-2.5 text-[13px] text-texte">
                        <span className={`relative inline-block h-5 w-9 rounded-full transition-colors ${v ? "bg-accent" : "bg-bordure-champ"}`}>
                          <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${v ? "left-[18px]" : "left-0.5"}`} />
                        </span>
                        {v ? "Oui" : "Non"}
                      </button>
                    ) : c.type === "choix" ? (
                      <select value={String(v ?? "")} onChange={(e) => changer(c.cle, e.target.value)} className={commun}>
                        <option value="">—</option>
                        {c.options?.map((o) => (
                          <option key={o.valeur} value={o.valeur}>
                            {o.libelle}
                          </option>
                        ))}
                      </select>
                    ) : c.type === "texte-long" ? (
                      <textarea value={String(v ?? "")} onChange={(e) => changer(c.cle, e.target.value)} rows={3} className={`${commun} h-auto resize-none py-2 leading-relaxed`} />
                    ) : c.type === "reference" ? (
                      <ChampReference valeur={String(v ?? "")} onChange={(valeur) => changer(c.cle, valeur)} types={c.references} immatriculation={immatFormulaire} />
                    ) : (
                      <span className="relative">
                        <input
                          type={c.type === "date" ? "date" : "text"}
                          inputMode={c.type === "nombre" ? "decimal" : undefined}
                          value={String(v ?? "")}
                          onChange={(e) => changer(c.cle, e.target.value)}
                          className={`${commun} ${c.unite ? "pr-12" : ""} ${c.type === "nombre" ? "code text-right" : ""}`}
                        />
                        {c.unite ? <span className="meta pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">{c.unite}</span> : null}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* ---- Motif ---- */}
            <label className="mt-5 flex flex-col gap-1.5">
              <span className="label-champ">
                {creation ? "Commentaire" : "Motif de la modification"} {creation ? null : <span className="text-defavorable">●</span>}
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
            <p className="meta min-w-0 flex-1">
              {issue === "appliquee" ? (
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
