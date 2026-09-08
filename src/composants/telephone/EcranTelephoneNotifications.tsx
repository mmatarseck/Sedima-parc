"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { depuis, marquerLues, mesNotifications, type Notification } from "@/lib/notifications-demo";
import { EnTeteTelephone } from "./Telephone";

/* ============================================================================
 * Téléphone › Notifications — la liste entière, filtrée par nature comme
 * chez Fleetio (Toutes, Demandes, Transferts, Discussions, Base), groupée
 * aujourd'hui / plus tôt, un point rouge sur le non lu. Ouvrir la liste
 * marque tout comme lu ; chaque ligne mène où il faut.
 * ==========================================================================*/

type Filtre = "toutes" | "demandes" | "transferts" | "discussions" | "base";

function natureDe(n: Notification): Exclude<Filtre, "toutes"> {
  if (n.id.startsWith("demande-")) return "demandes";
  if (n.id.startsWith("transfert-")) return "transferts";
  if (n.id.startsWith("refus-")) return "base";
  return "discussions";
}

const FILTRES: { cle: Filtre; libelle: string }[] = [
  { cle: "toutes", libelle: "Toutes" },
  { cle: "demandes", libelle: "Demandes" },
  { cle: "transferts", libelle: "Transferts" },
  { cle: "discussions", libelle: "Discussions" },
  { cle: "base", libelle: "Refus" },
];

export function EcranTelephoneNotifications() {
  const router = useRouter();
  const [liste, setListe] = useState<Notification[]>([]);
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    setListe(mesNotifications());
    setMaintenant(new Date());
    /* Lues dès qu'on les a sous les yeux ; la liste reste. */
    const t = window.setTimeout(() => marquerLues(), 1500);
    return () => window.clearTimeout(t);
  }, []);

  const visibles = useMemo(() => liste.filter((n) => filtre === "toutes" || natureDe(n) === filtre), [liste, filtre]);
  const jour = maintenant.toISOString().slice(0, 10);
  const duJour = visibles.filter((n) => n.date.slice(0, 10) === jour);
  const avant = visibles.filter((n) => n.date.slice(0, 10) !== jour);
  const nonLues = liste.filter((n) => !n.lue).length;

  function ouvrir(n: Notification) {
    if (n.href && n.href !== "#") router.push(n.href);
  }

  const groupe = (titre: string, items: Notification[]) =>
    items.length === 0 ? null : (
      <section>
        <h2 className="micro-sur-titre mb-1 px-1">{titre}</h2>
        <div className="carte divide-y divide-bordure">
          {items.map((n) => (
            <button key={n.id} type="button" onClick={() => ouvrir(n)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
              <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-texte-2">
                {n.initiales}
                {!n.lue ? <span className="absolute -top-0.5 -left-0.5 size-2.5 rounded-full bg-defavorable ring-2 ring-surface" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[13.5px] leading-snug ${n.lue ? "text-texte-2" : "font-semibold text-texte"}`}>{n.sujetLibelle}</span>
                <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-texte-2">{n.extrait}</span>
                <span className="meta mt-0.5 block">
                  {n.auteur} · {depuis(n.date, maintenant)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    );

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-1">
      <EnTeteTelephone
        titre={
          <span className="flex items-center gap-2">
            Notifications
            {nonLues > 0 ? <span className="badge-texte rounded-full bg-defavorable px-1.5 py-px text-[11px] text-white">{nonLues}</span> : null}
          </span>
        }
        droite={
          <Link href="/parametres/notifications" className="grid size-9 place-items-center rounded-full text-texte-2 hover:bg-surface-3" aria-label="Régler mes notifications">
            <Settings className="size-5" strokeWidth={1.8} />
          </Link>
        }
      />
      <div className="sans-barre -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTRES.map((f) => (
          <button key={f.cle} type="button" onClick={() => setFiltre(f.cle)} aria-pressed={filtre === f.cle} className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[12.5px] font-medium ${filtre === f.cle ? "border-accent-bordure bg-accent-fond text-accent-tres-fonce" : "border-bordure bg-surface text-texte-2"}`}>
            {f.libelle}
          </button>
        ))}
      </div>
      {visibles.length === 0 ? <p className="meta px-2 py-6 text-center">Rien pour vous ici. Vous serez prévenu d&apos;une demande, d&apos;une fiche à signer, d&apos;une citation.</p> : null}
      {groupe("Aujourd'hui", duJour)}
      {groupe("Plus tôt", avant)}
    </div>
  );
}
