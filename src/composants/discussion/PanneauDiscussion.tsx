"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AtSign, MessageSquare, SendHorizontal, X } from "lucide-react";
import { HAUTEUR_BARRE } from "@/composants/coquille/mesures";
import { mentionsDe, segmenter, type Message, type Personne } from "@/domaine/discussion";
import { lireMessagesServeur, publierMessage } from "@/lib/discussion-actions";
import { ajouterMessage, lireMessages } from "@/lib/discussion-demo";
import { date as formaterDate } from "@/lib/format";
import { authentificationReelle } from "@/lib/session-demo";

/* ============================================================================
 * Panneau de discussion — le fil attaché à une fiche.
 *
 * Il s'ouvre depuis le bouton « Discussion » de l'en-tête et se pose à droite,
 * par-dessus le contenu, sans le décaler : on discute d'un véhicule en gardant
 * sa fiche sous les yeux. Les messages sont horodatés et groupés par jour ;
 * on cite quelqu'un avec « @ », et la personne citée est mise en évidence.
 * ==========================================================================*/

function heure(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** « Aujourd'hui », « Hier », sinon la date. */
function libelleJour(iso: string, maintenant: Date): string {
  const d = new Date(iso);
  const jour = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const ecart = Math.round((jour(maintenant) - jour(d)) / (24 * 3600 * 1000));
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return "Hier";
  return formaterDate(iso);
}

function Texte({ texte, personnes }: { texte: string; personnes: Personne[] }) {
  const segments = useMemo(() => segmenter(texte, personnes), [texte, personnes]);
  return (
    <p className="text-[13px] leading-[1.55] whitespace-pre-wrap text-texte">
      {segments.map((s, i) =>
        s.type === "mention" ? (
          <span key={i} title={s.personne.precision} className="rounded-[6px] bg-accent-fond px-1 py-px font-medium text-accent-tres-fonce">
            @{s.valeur}
          </span>
        ) : (
          <span key={i}>{s.valeur}</span>
        ),
      )}
    </p>
  );
}

export function BoutonDiscussion({ nombre, ouvert, onClick }: { nombre: number | null; ouvert: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={ouvert} className={`bouton-secondaire ${ouvert ? "border-accent bg-accent-fond" : ""}`}>
      <MessageSquare className="size-4 text-texte-2" strokeWidth={1.7} />
      Discussion
      {nombre !== null && nombre > 0 ? (
        <span className="badge-texte rounded-full bg-surface-3 px-1.5 py-px text-texte-2">{nombre}</span>
      ) : null}
    </button>
  );
}

export function PanneauDiscussion({
  sujet,
  libelle,
  href,
  personnes,
  ouvert,
  onFermer,
  onNombre,
}: {
  /** « vehicule:AA032EA » — la clé du fil. */
  sujet: string;
  /** Ce dont on parle, pour le titre : « AA-032-EA ». */
  libelle: string;
  /** Adresse de la fiche, pour que la notification y ramène, discussion ouverte. */
  href: string;
  personnes: Personne[];
  ouvert: boolean;
  onFermer: () => void;
  /** Remonte le nombre de messages, pour la pastille du bouton. */
  onNombre?: (n: number) => void;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [maintenant] = useState(() => new Date());
  const zone = useRef<HTMLTextAreaElement>(null);
  const fil = useRef<HTMLDivElement>(null);

  /* Sélecteur de mention : ouvert dès qu'un « @ » commence un mot, filtré par
     ce qui suit, fermé sur Échap ou quand le mot se termine. */
  const [mention, setMention] = useState<{ debut: number; terme: string } | null>(null);
  const [surligne, setSurligne] = useState(0);

  const [refus, setRefus] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let vivant = true;
    /* Base branchée : le fil vient de la table, par le serveur ; sinon du navigateur. */
    if (authentificationReelle()) {
      void lireMessagesServeur(sujet).then((lus) => {
        if (!vivant) return;
        const liste = lus ?? [];
        setMessages(liste);
        onNombre?.(liste.length);
      });
    } else {
      const lus = lireMessages(sujet, libelle, personnes);
      setMessages(lus);
      onNombre?.(lus.length);
    }
    return () => {
      vivant = false;
    };
    // Les personnes ne changent pas pendant la vie de la fiche ; les relire à
    // chaque rendu recréerait le fil à chaque frappe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sujet, libelle]);

  useEffect(() => {
    if (!ouvert) return;
    const f = fil.current;
    if (f) f.scrollTop = f.scrollHeight;
    zone.current?.focus();
  }, [ouvert, messages]);

  useEffect(() => {
    if (!ouvert) return;
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (mention) setMention(null);
        else onFermer();
      }
    }
    document.addEventListener("keydown", surEchap);
    return () => document.removeEventListener("keydown", surEchap);
  }, [ouvert, mention, onFermer]);

  const candidats = useMemo(() => {
    if (!mention) return [];
    const t = mention.terme.toLowerCase();
    return personnes.filter((p) => !t || p.nom.toLowerCase().includes(t) || p.precision.toLowerCase().includes(t)).slice(0, 6);
  }, [mention, personnes]);

  function surSaisie(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const valeur = e.target.value;
    setBrouillon(valeur);
    const curseur = e.target.selectionStart ?? valeur.length;
    const avant = valeur.slice(0, curseur);
    const m = /(?:^|\s)@([^\s@]*)$/.exec(avant);
    if (m) {
      setMention({ debut: curseur - m[1]!.length - 1, terme: m[1]! });
      setSurligne(0);
    } else {
      setMention(null);
    }
  }

  function inserer(p: Personne) {
    if (!mention) return;
    const z = zone.current;
    const curseur = z?.selectionStart ?? brouillon.length;
    const suite = `${brouillon.slice(0, mention.debut)}@${p.nom} ${brouillon.slice(curseur)}`;
    setBrouillon(suite);
    setMention(null);
    requestAnimationFrame(() => {
      if (!z) return;
      const position = mention.debut + p.nom.length + 2;
      z.focus();
      z.setSelectionRange(position, position);
    });
  }

  function envoyer() {
    const texte = brouillon.trim();
    if (!texte || !messages || envoi) return;
    const mentions = mentionsDe(texte, personnes);
    if (authentificationReelle()) {
      setEnvoi(true);
      setRefus(null);
      void publierMessage(sujet, libelle, `${href}?discussion=1`, texte, mentions).then((r) => {
        setEnvoi(false);
        if ("refus" in r) {
          setRefus(r.refus);
          return;
        }
        const suite = [...messages, r.message];
        setMessages(suite);
        onNombre?.(suite.length);
        setBrouillon("");
        setMention(null);
      });
      return;
    }
    const suite = ajouterMessage(sujet, libelle, `${href}?discussion=1`, texte, mentions, messages);
    setMessages(suite);
    onNombre?.(suite.length);
    setBrouillon("");
    setMention(null);
  }

  function surTouche(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention && candidats.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSurligne((s) => (s + 1) % candidats.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSurligne((s) => (s - 1 + candidats.length) % candidats.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        inserer(candidats[surligne]!);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      envoyer();
    }
  }

  /* Groupement par jour : un séparateur dès que la date change. */
  const groupes = useMemo(() => {
    const sortie: { jour: string; messages: Message[] }[] = [];
    for (const m of messages ?? []) {
      const jour = libelleJour(m.date, maintenant);
      const dernier = sortie[sortie.length - 1];
      if (dernier && dernier.jour === jour) dernier.messages.push(m);
      else sortie.push({ jour, messages: [m] });
    }
    return sortie;
  }, [messages, maintenant]);

  const cites = useMemo(() => mentionsDe(brouillon, personnes).map((id) => personnes.find((p) => p.id === id)!).filter(Boolean), [brouillon, personnes]);

  if (!ouvert) return null;

  return (
    <>
      <button type="button" aria-label="Fermer la discussion" onClick={onFermer} className="fixed inset-0 z-30 cursor-default bg-encre/10" />
      <aside
        role="dialog"
        aria-label={`Discussion — ${libelle}`}
        className="fixed right-0 z-40 flex w-full max-w-[420px] flex-col border-l border-bordure bg-surface shadow-flottante"
        style={{ top: HAUTEUR_BARRE, height: `calc(100vh - ${HAUTEUR_BARRE}px)`, animation: "apparition 160ms ease-out" }}
      >
        {/* ---- En-tête ---- */}
        <div className="flex shrink-0 items-start gap-3 border-b border-bordure px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-fond text-accent-tres-fonce">
            <MessageSquare className="size-4" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="titre-bloc truncate">Discussion · {libelle}</h2>
            <p className="meta mt-0.5">
              {messages === null ? "…" : `${messages.length} message${messages.length > 1 ? "s" : ""}`} · citez quelqu'un avec @
            </p>
          </div>
          <button type="button" onClick={onFermer} className="grid size-8 shrink-0 place-items-center rounded-full text-texte-2 hover:bg-surface-3 hover:text-texte">
            <X className="size-4" strokeWidth={1.8} />
            <span className="sr-only">Fermer</span>
          </button>
        </div>

        {/* ---- Fil ---- */}
        <div ref={fil} className="defilement-discret min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {messages !== null && messages.length === 0 ? (
            <p className="corps py-10 text-center text-attenue">Aucun message. Lancez la conversation.</p>
          ) : null}
          {groupes.map((g) => (
            <div key={g.jour} className="mb-4 last:mb-0">
              <div className="my-3 flex items-center gap-3">
                <span className="h-px flex-1 bg-bordure" />
                <span className="micro-sur-titre">{g.jour}</span>
                <span className="h-px flex-1 bg-bordure" />
              </div>
              <ol className="flex flex-col gap-4">
                {g.messages.map((m) => (
                  <li key={m.id} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[10.5px] font-semibold text-texte-2">{m.initiales}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-2">
                        <span className="truncate text-[13px] font-medium text-texte">{m.auteur}</span>
                        <span className="code ml-auto shrink-0 text-[11.5px] text-attenue" title={`${formaterDate(m.date)} à ${heure(m.date)}`}>
                          {heure(m.date)}
                        </span>
                      </p>
                      <div className="mt-1 rounded-[10px] rounded-tl-[4px] bg-surface-2 px-3 py-2">
                        <Texte texte={m.texte} personnes={personnes} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        {/* ---- Composer ---- */}
        <div className="relative shrink-0 border-t border-bordure px-4 py-3">
          {mention && candidats.length > 0 ? (
            <div role="listbox" className="absolute bottom-full left-4 z-10 mb-1 w-[300px] rounded-[14px] border border-bordure bg-surface p-1.5 shadow-flottante">
              <p className="micro-sur-titre px-3 py-1.5">Citer quelqu'un</p>
              {candidats.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={i === surligne}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => inserer(p)}
                  onMouseEnter={() => setSurligne(i)}
                  className={`flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left ${i === surligne ? "bg-surface-3" : ""}`}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-fond text-[10px] font-semibold text-accent-tres-fonce">{p.initiales}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-texte">{p.nom}</span>
                    <span className="meta block truncate">{p.precision}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-end gap-2 rounded-[14px] border border-bordure-champ bg-surface px-3 py-2 focus-within:border-accent">
            <textarea
              ref={zone}
              value={brouillon}
              onChange={surSaisie}
              onKeyDown={surTouche}
              rows={2}
              placeholder={`Écrire à propos de ${libelle}… @ pour citer`}
              aria-label="Nouveau message"
              className="max-h-[140px] min-h-[40px] w-full resize-none bg-transparent text-[13px] leading-[1.5] outline-none placeholder:text-attenue"
            />
            <button
              type="button"
              onClick={() =>
                setMention((m) => {
                  if (m) return null;
                  const z = zone.current;
                  const curseur = z?.selectionStart ?? brouillon.length;
                  const avant = brouillon.slice(0, curseur);
                  const prefixe = avant.length === 0 || /\s$/.test(avant) ? "" : " ";
                  const suite = `${avant}${prefixe}@${brouillon.slice(curseur)}`;
                  setBrouillon(suite);
                  const debut = avant.length + prefixe.length;
                  requestAnimationFrame(() => {
                    z?.focus();
                    z?.setSelectionRange(debut + 1, debut + 1);
                  });
                  return { debut, terme: "" };
                })
              }
              title="Citer quelqu'un"
              className="grid size-8 shrink-0 place-items-center rounded-full text-texte-2 hover:bg-surface-3 hover:text-texte"
            >
              <AtSign className="size-4" strokeWidth={1.8} />
              <span className="sr-only">Citer quelqu'un</span>
            </button>
            <button
              type="button"
              onClick={envoyer}
              disabled={!brouillon.trim() || envoi}
              title="Envoyer (Entrée)"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-white transition-colors hover:bg-accent-fonce disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-attenue-2"
            >
              <SendHorizontal className="size-4" strokeWidth={1.8} />
              <span className="sr-only">Envoyer</span>
            </button>
            {refus ? <p className="w-full px-1 pb-1 text-[12px] text-defavorable">{refus}</p> : null}
          </div>
          <p className="meta mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
            {cites.length > 0 ? (
              <>
                <span>Seront prévenus :</span>
                {cites.map((p) => (
                  <span key={p.id} className="rounded-full bg-accent-fond px-2 py-px font-medium text-accent-tres-fonce">
                    {p.nom}
                  </span>
                ))}
              </>
            ) : (
              <span>Entrée pour envoyer, Maj + Entrée pour aller à la ligne.</span>
            )}
          </p>
        </div>
      </aside>
    </>
  );
}
