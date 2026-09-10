"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ArrowUpRight, Loader2, Sparkles, X } from "lucide-react";
import { HAUTEUR_BARRE } from "@/composants/coquille/mesures";
import { CLASSES_TON } from "@/domaine/libelles";
import type { Reponse } from "@/domaine/assistant";
import { assistantDemo, questionsSuggerees } from "@/donnees/assistant-demo";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";

/* ============================================================================
 * L'assistant du parc, accessible de partout.
 *
 * Demande du métier du 4 septembre 2026 : « un module IA accessible de partout
 * pour poser des questions sur la flotte ». Il vit donc dans la barre
 * d'application, comme la recherche et la cloche, et s'ouvre en volet à droite
 * sans quitter l'écran où l'on travaille — la question naît le plus souvent
 * d'un écran qu'on est en train de lire, et le lui faire quitter serait
 * absurde.
 *
 * **Une réponse est un chiffre et sa source.** Chaque réponse porte les
 * chiffres nommés, les lignes qui les composent, et le lien de l'écran qui fait
 * foi. On peut donc vérifier, et citer. Un assistant qui affirme sans montrer
 * d'où il tient son chiffre ne sert à rien dans une réunion de parc.
 *
 * L'implémentation est celle de démonstration (`assistantDemo`), qui interroge
 * les données par des règles. Le contrat est celui de la version finale : le
 * jour où l'API Claude prendra le relais, seule la ligne d'import changera.
 * ==========================================================================*/

interface Echange {
  id: string;
  question: string;
  reponse: Reponse | null;
}

function Chiffres({ reponse }: { reponse: Reponse }) {
  if (!reponse.chiffres?.length) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {reponse.chiffres.map((c) => (
        <div key={c.libelle} className="min-w-0 rounded-[10px] bg-surface-2 px-3 py-2">
          <p className="label-champ truncate">{c.libelle}</p>
          <p className={`code mt-0.5 text-[15px] leading-tight font-semibold ${c.ton ? CLASSES_TON[c.ton].split(" ").find((x) => x.startsWith("text-")) : "text-texte"}`}>{c.valeur}</p>
          {c.precision ? <p className="meta mt-0.5 line-clamp-2">{c.precision}</p> : null}
        </div>
      ))}
    </div>
  );
}

function Lignes({ reponse, onFermer }: { reponse: Reponse; onFermer: () => void }) {
  if (!reponse.lignes?.length) return null;
  return (
    <ul className="mt-3 flex flex-col rounded-[10px] border border-bordure">
      {reponse.lignes.map((l, i) => {
        const contenu = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-texte">{l.titre}</span>
              {l.precision ? <span className="meta block truncate">{l.precision}</span> : null}
            </span>
            {l.valeur ? (
              <span className={`code shrink-0 text-[12px] font-semibold ${l.ton ? CLASSES_TON[l.ton].split(" ").find((x) => x.startsWith("text-")) : "text-texte-2"}`}>{l.valeur}</span>
            ) : null}
            {l.href ? <ArrowUpRight className="size-3.5 shrink-0 text-attenue-2" strokeWidth={1.9} /> : null}
          </>
        );
        return (
          <li key={`${l.titre}-${i}`} className="border-b border-bordure last:border-b-0">
            {l.href ? (
              <Link href={l.href} onClick={onFermer} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2">
                {contenu}
              </Link>
            ) : (
              <span className="flex items-center gap-2 px-3 py-2">{contenu}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CarteReponse({ reponse, onFermer, onSuite }: { reponse: Reponse; onFermer: () => void; onSuite: (q: string) => void }) {
  return (
    <div className="rounded-[12px] border border-bordure bg-surface px-4 py-3.5">
      <p className="text-[13px] leading-relaxed text-texte">{reponse.texte}</p>
      <Chiffres reponse={reponse} />
      <Lignes reponse={reponse} onFermer={onFermer} />

      {/* Le lien de l'écran qui fait foi : c'est ce qui rend la réponse citable. */}
      {reponse.sources.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="meta shrink-0">{reponse.incomprise ? "Voir" : "Vérifier dans"} :</span>
          {reponse.sources.map((s) => (
            <Link key={s.href} href={s.href} onClick={onFermer} className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-3 px-2.5 text-[12px] font-medium text-texte-2 hover:bg-accent-fond hover:text-accent-fonce">
              {s.libelle}
              <ArrowUpRight className="size-3" strokeWidth={2} />
            </Link>
          ))}
        </div>
      ) : null}

      {reponse.suites?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-bordure pt-3">
          {reponse.suites.map((s) => (
            <button key={s} type="button" onClick={() => onSuite(s)} className="inline-flex h-7 items-center rounded-full border border-bordure-champ px-2.5 text-left text-[12px] text-texte-2 hover:border-accent hover:text-texte">
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Assistant() {
  const [ouvert, setOuvert] = useState(false);
  const [question, setQuestion] = useState("");
  const [echanges, setEchanges] = useState<Echange[]>([]);
  const [attente, setAttente] = useState(false);
  const chemin = usePathname();
  const fil = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLTextAreaElement>(null);

  /* Ctrl/⌘ + J l'ouvre de n'importe où — la recherche a déjà Ctrl + K. */
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOuvert((o) => !o);
      }
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, []);

  useEffect(() => {
    if (ouvert) champ.current?.focus();
  }, [ouvert]);

  useEffect(() => {
    fil.current?.scrollTo({ top: fil.current.scrollHeight, behavior: "smooth" });
  }, [echanges, attente]);

  const demander = useCallback(
    async (texte: string) => {
      const q = texte.trim();
      if (!q || attente) return;
      const id = `e-${Date.now().toString(36)}`;
      setEchanges((liste) => [...liste, { id, question: q, reponse: null }]);
      setQuestion("");
      setAttente(true);
      const reponse = await assistantDemo.repondre({ question: q, origine: chemin, aujourdhui: DATE_REFERENCE });
      setEchanges((liste) => liste.map((e) => (e.id === id ? { ...e, reponse } : e)));
      setAttente(false);
    },
    [attente, chemin],
  );

  const fermer = useCallback(() => setOuvert(false), []);
  const suggerees = questionsSuggerees();

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-label="Poser une question sur le parc"
        title="Poser une question sur le parc — Ctrl + J"
        className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors ${ouvert ? "bg-accent-fond text-accent-fonce" : "text-texte-2 hover:bg-surface-3 hover:text-texte"}`}
      >
        {/* Le mot « Demander » a été retiré le 10 septembre 2026 : la barre
            porte désormais trois icônes de même taille — assistant, demandes,
            notifications — et un seul mot au milieu déséquilibrait la file.
            L'infobulle et le texte pour lecteur d'écran disent ce qu'il fait. */}
        <Sparkles className="size-[18px]" strokeWidth={1.7} />
        <span className="sr-only">Demander à l&apos;assistant</span>
      </button>

      {ouvert ? (
        <>
          <button type="button" aria-label="Fermer l'assistant" onClick={fermer} className="fixed inset-0 z-30 cursor-default bg-encre/10" />
          <aside
            role="dialog"
            aria-label="Assistant du parc"
            className="fixed right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-bordure bg-surface-2 shadow-flottante"
            style={{ top: HAUTEUR_BARRE, height: `calc(100vh - ${HAUTEUR_BARRE}px)`, animation: "apparition 160ms ease-out" }}
          >
            <div className="flex shrink-0 items-start gap-3 border-b border-bordure bg-surface px-5 py-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-fond text-accent-tres-fonce">
                <Sparkles className="size-4" strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="titre-bloc truncate">Assistant du parc</h2>
                <p className="meta mt-0.5">Il lit les données du parc et cite l&apos;écran qui fait foi. Il ne crée ni ne modifie rien.</p>
              </div>
              <button type="button" onClick={fermer} className="grid size-8 shrink-0 place-items-center rounded-full text-texte-2 hover:bg-surface-3 hover:text-texte">
                <X className="size-4" strokeWidth={1.8} />
                <span className="sr-only">Fermer</span>
              </button>
            </div>

            <div ref={fil} className="defilement-discret min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {echanges.length === 0 ? (
                <div className="flex flex-col gap-3">
                  <p className="text-[13px] leading-relaxed text-texte-2">
                    Posez une question sur la flotte, les coûts, la conformité, la maintenance ou les chauffeurs. Citez une immatriculation pour parler d&apos;un véhicule précis.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {suggerees.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => demander(s)}
                        className="flex items-center gap-2 rounded-[10px] border border-bordure bg-surface px-3 py-2 text-left text-[12.5px] text-texte hover:border-accent"
                      >
                        <span className="min-w-0 flex-1">{s}</span>
                        <ArrowRight className="size-3.5 shrink-0 text-attenue-2" strokeWidth={1.9} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ol className="flex flex-col gap-4">
                  {echanges.map((e) => (
                    <li key={e.id} className="flex flex-col gap-2">
                      <p className="self-end rounded-[12px] rounded-br-[4px] bg-accent-fond px-3.5 py-2 text-[13px] leading-relaxed font-medium text-accent-tres-fonce">{e.question}</p>
                      {e.reponse ? (
                        <CarteReponse reponse={e.reponse} onFermer={fermer} onSuite={demander} />
                      ) : (
                        <p className="flex items-center gap-2 px-1 text-[13px] text-attenue">
                          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                          Je regarde…
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                demander(question);
              }}
              className="flex shrink-0 items-end gap-2 border-t border-bordure bg-surface px-4 py-3"
            >
              <textarea
                ref={champ}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    demander(question);
                  }
                }}
                rows={1}
                placeholder="Combien de véhicules sont prêts à charger ?"
                aria-label="Votre question"
                className="defilement-discret max-h-24 min-h-9 flex-1 resize-none rounded-[10px] border border-bordure-champ bg-surface px-3 py-2 text-[13px] leading-relaxed text-texte outline-none placeholder:text-attenue focus:border-accent"
              />
              <button type="submit" disabled={!question.trim() || attente} className="bouton-principal size-9 shrink-0 justify-center px-0 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-attenue-2">
                <ArrowRight className="size-4" strokeWidth={2.2} />
                <span className="sr-only">Demander</span>
              </button>
            </form>
          </aside>
        </>
      ) : null}
    </>
  );
}
