"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, MessageSquare } from "lucide-react";
import { depuis, marquerLues, mesNotifications, type Notification } from "@/lib/notifications-demo";
import { authentificationReelle } from "@/lib/session-demo";

/* Base branchée : la cloche lit la table `notification` par l'API, pour la
   personne connectée ; en démonstration, le navigateur. */
async function lireDepuisLeServeur(marquer = false): Promise<Notification[] | null> {
  try {
    const r = await fetch("/api/notifications", { method: marquer ? "POST" : "GET", cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as Notification[];
  } catch {
    return null;
  }
}

/**
 * Cloche de la barre d'application.
 *
 * Elle porte ce qui attend la personne connectée : aujourd'hui, les messages
 * où elle est citée. Le point rouge ne s'allume que s'il y a du non lu ; ouvrir
 * la liste marque tout comme lu — la liste reste consultable. Chaque entrée
 * mène à la fiche, discussion ouverte.
 */
export function Cloche() {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [maintenant, setMaintenant] = useState(() => new Date());
  const reel = authentificationReelle();

  useEffect(() => {
    let vivant = true;
    // Le stockage change quand on envoie un message depuis un autre onglet,
    // ou quand on change d'identité de démonstration ; en base, on relit le
    // serveur à chaque retour sur l'onglet.
    function rafraichir() {
      setMaintenant(new Date());
      if (reel) void lireDepuisLeServeur().then((l) => { if (vivant && l) setNotifications(l); });
      else setNotifications(mesNotifications());
    }
    rafraichir();
    window.addEventListener("storage", rafraichir);
    window.addEventListener("focus", rafraichir);
    return () => {
      vivant = false;
      window.removeEventListener("storage", rafraichir);
      window.removeEventListener("focus", rafraichir);
    };
  }, [reel]);

  const nonLues = notifications.filter((n) => !n.lue).length;

  function basculer() {
    setOuverte((o) => {
      if (!o) {
        setMaintenant(new Date());
        if (reel) void lireDepuisLeServeur().then((l) => { if (l) setNotifications(l); });
        else setNotifications(mesNotifications());
      }
      return !o;
    });
  }

  function fermer() {
    setOuverte(false);
    if (nonLues === 0) return;
    if (reel) {
      setNotifications((l) => l.map((n) => ({ ...n, lue: true })));
      void lireDepuisLeServeur(true).then((l) => { if (l) setNotifications(l); });
    } else setNotifications(marquerLues());
  }

  function ouvrir(n: Notification) {
    fermer();
    router.push(n.href);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={basculer}
        aria-expanded={ouverte}
        aria-haspopup="menu"
        title={nonLues > 0 ? `${nonLues} notification${nonLues > 1 ? "s" : ""} non lue${nonLues > 1 ? "s" : ""}` : "Notifications"}
        className={`relative grid size-9 place-items-center rounded-full text-texte-2 hover:bg-surface-3 hover:text-texte ${ouverte ? "bg-surface-3 text-texte" : ""}`}
      >
        <Bell className="size-[18px]" strokeWidth={1.7} />
        {nonLues > 0 ? <span className="absolute top-2 right-2 size-1.5 rounded-full bg-defavorable ring-2 ring-surface" /> : null}
        <span className="sr-only">Notifications</span>
      </button>

      {ouverte ? (
        <>
          <button type="button" aria-label="Fermer les notifications" onClick={fermer} className="fixed inset-0 z-30 cursor-default" />
          <div role="menu" className="absolute top-full right-0 z-40 mt-2 w-[360px] rounded-[14px] border border-bordure bg-surface p-2 shadow-flottante">
            <p className="micro-sur-titre flex items-center px-3 py-2">
              Notifications
              {nonLues > 0 ? <span className="badge-texte ml-auto rounded-full bg-defavorable px-1.5 py-px text-white">{nonLues}</span> : null}
            </p>
            {notifications.length === 0 ? (
              <p className="corps px-3 py-6 text-center text-attenue">Rien pour vous. Vous serez prévenu quand quelqu&apos;un vous citera dans une discussion.</p>
            ) : (
              <ul className="defilement-discret flex max-h-[420px] flex-col overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => ouvrir(n)} className="flex w-full items-start gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-surface-3">
                      <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[10.5px] font-semibold text-texte-2">
                        {n.initiales}
                        {!n.lue ? <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-defavorable ring-2 ring-surface" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={`truncate text-[13px] ${n.lue ? "font-medium text-texte-2" : "font-semibold text-texte"}`}>
                            {n.auteur} vous a cité
                          </span>
                          <span className="meta ml-auto shrink-0 text-[11px]">{depuis(n.date, maintenant)}</span>
                        </span>
                        <span className="meta mt-0.5 flex items-center gap-1.5">
                          <MessageSquare className="size-3" strokeWidth={1.8} />
                          <span className="truncate">Discussion · {n.sujetLibelle}</span>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-[12.5px] leading-snug text-texte-2">{n.extrait}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
