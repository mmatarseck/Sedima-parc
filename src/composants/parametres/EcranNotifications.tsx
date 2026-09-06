"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BellOff, Check, ChevronLeft, RotateCcw } from "lucide-react";
import { Carte } from "@/composants/interface/Carte";
import {
  CANAL,
  PREVENANCE_DEFAUT,
  alertesPour,
  famillesActives,
  reglageParDefaut,
  type Canal,
  type FamilleAlerte,
  type ReglageAlertes,
} from "@/domaine/alertes";
import { trouverRole } from "@/domaine/roles";
import { lireParametres } from "@/lib/parametres-demo";
import { lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Réglage des notifications — l'écran de l'entrée « Notifications » du compte.
 *
 * Une ligne par sorte d'alerte, trois cases par ligne : dans l'application, par
 * courriel, par Teams. On lit d'un coup ce qu'on reçoit et par où — ce qu'une
 * liste de cases sans colonnes ne permet pas.
 *
 * Le réglage est **par compte**, comme les colonnes des listes et les vues des
 * rapports : deux personnes sur le même poste n'ont pas les mêmes besoins. Il
 * s'enregistre à chaque clic, sans bouton — celui qu'on oublierait de presser.
 *
 * Ce que l'écran ne fait pas encore, et le dit : **envoyer**. La cloche
 * fonctionne ; le courriel et Teams attendent le branchement (déclencheur sur
 * `notification`, puis passerelle). Cocher une case décrit donc ce que le
 * compte **recevra**, et l'écran ne prétend pas le contraire.
 * ==========================================================================*/

const CLE = "sedima.parc.alertes";

function lire(compte: string, defaut: ReglageAlertes): ReglageAlertes {
  try {
    const brut = localStorage.getItem(`${CLE}.${compte}`);
    if (!brut) return defaut;
    const r = JSON.parse(brut) as ReglageAlertes;
    return { canaux: r.canaux ?? {}, prevenance: Array.isArray(r.prevenance) && r.prevenance.length ? r.prevenance : defaut.prevenance, silence: Boolean(r.silence) };
  } catch {
    return defaut;
  }
}

function ecrire(compte: string, r: ReglageAlertes): void {
  try {
    localStorage.setItem(`${CLE}.${compte}`, JSON.stringify(r));
  } catch {
    /* sans stockage, le réglage ne vaut que pour la session */
  }
}

function Case({ coche, onBasculer, etiquette, inactif }: { coche: boolean; onBasculer: () => void; etiquette: string; inactif?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={coche}
      aria-label={etiquette}
      onClick={onBasculer}
      disabled={inactif}
      className={`grid size-[18px] place-items-center rounded-[5px] border transition-colors ${
        coche ? "border-accent bg-accent text-white" : "border-bordure-champ bg-surface hover:border-accent"
      } ${inactif ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {coche ? <Check className="size-3" strokeWidth={3} /> : null}
    </button>
  );
}

export function EcranNotifications() {
  const [role, setRole] = useState(trouverRole(null));
  const [reglage, setReglage] = useState<ReglageAlertes>(() => reglageParDefaut(trouverRole(null).role));
  const [pret, setPret] = useState(false);

  useEffect(() => {
    const r = trouverRole(lireRole());
    setRole(r);
    setReglage(lire(r.role, reglageParDefaut(r.role, lireParametres().alertes)));
    setPret(true);
  }, []);

  function poser(suivant: ReglageAlertes) {
    setReglage(suivant);
    if (pret) ecrire(role.role, suivant);
  }

  function basculer(famille: FamilleAlerte, canal: Canal) {
    const actuels = reglage.canaux[famille] ?? [];
    const suivants = actuels.includes(canal) ? actuels.filter((c) => c !== canal) : [...actuels, canal];
    poser({ ...reglage, canaux: { ...reglage.canaux, [famille]: suivants } });
  }

  function toutePlusieurs(canal: Canal, valeur: boolean) {
    const canaux = { ...reglage.canaux };
    for (const a of alertesPour(role.role)) {
      const actuels = canaux[a.cle] ?? [];
      canaux[a.cle] = valeur ? [...new Set([...actuels, canal])] : actuels.filter((c) => c !== canal);
    }
    poser({ ...reglage, canaux });
  }

  const alertes = alertesPour(role.role);
  const canaux: Canal[] = ["application", "courriel", "teams"];
  const actives = famillesActives(reglage);

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Paramètres
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0">
          <h1 className="titre-page">Notifications</h1>
          <p className="meta mt-1 text-[13px]">
            Ce que vous recevez, et par où — réglage propre à votre compte ({role.libelle}). {actives} sorte{actives > 1 ? "s" : ""} d&apos;alerte sur {alertes.length} activée
            {actives > 1 ? "s" : ""}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => poser({ ...reglageParDefaut(role.role, lireParametres().alertes), silence: reglage.silence })}
          className="bouton-secondaire ml-auto h-8"
        >
          <RotateCcw className="size-4" strokeWidth={1.8} />
          Valeurs par défaut
        </button>
      </div>

      {/* ---- Le silence, en tête : c'est le réglage qui prime sur tous les autres ---- */}
      <div className={`flex flex-wrap items-center gap-3 rounded-[12px] border px-4 py-3 ${reglage.silence ? "border-vigilance bg-vigilance-fond" : "border-bordure bg-surface"}`}>
        <BellOff className={`size-4 shrink-0 ${reglage.silence ? "text-vigilance" : "text-attenue"}`} strokeWidth={1.8} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-texte">Suspendre toutes les notifications</p>
          <p className="meta">
            {reglage.silence
              ? "Rien ne part, la cloche comprise. Vos réglages ci-dessous sont conservés et reprennent dès que vous rétablissez."
              : "Pour un congé ou une absence — le réglage détaillé reste en place."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reglage.silence}
          onClick={() => poser({ ...reglage, silence: !reglage.silence })}
          className="flex shrink-0 items-center gap-2 text-[13px] font-medium text-texte"
        >
          <span className={`relative inline-block h-5 w-9 rounded-full transition-colors ${reglage.silence ? "bg-vigilance" : "bg-bordure-champ"}`}>
            <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${reglage.silence ? "left-[18px]" : "left-0.5"}`} />
          </span>
          {reglage.silence ? "Suspendu" : "Actif"}
        </button>
      </div>

      <Carte titre="Ce que vous recevez" precision="Une ligne par sorte d'alerte, un canal par colonne — cochez ce que vous voulez, décochez le reste" sansMarge>
        <div className={`defilement-discret overflow-x-auto ${reglage.silence ? "opacity-50" : ""}`}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-bordure">
                <th scope="col" className="px-5 py-2.5 text-left text-[12px] font-medium text-texte-2">
                  Alerte
                </th>
                {canaux.map((c) => (
                  <th key={c} scope="col" className="w-[130px] px-3 py-2.5 text-center align-bottom">
                    <span className="block text-[12px] font-medium text-texte-2">{CANAL[c].libelle}</span>
                    <span className="meta mt-0.5 block leading-snug">{CANAL[c].precision}</span>
                    {/* Cocher une colonne entière : dix cases à la main, personne ne le fait. */}
                    <span className="mt-1 flex items-center justify-center gap-1.5">
                      <button type="button" onClick={() => toutePlusieurs(c, true)} disabled={reglage.silence} className="bouton-discret h-6 px-1.5 text-[11px]">
                        tout
                      </button>
                      <button type="button" onClick={() => toutePlusieurs(c, false)} disabled={reglage.silence} className="bouton-discret h-6 px-1.5 text-[11px]">
                        aucun
                      </button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertes.map((a) => (
                <tr key={a.cle} className="border-b border-bordure last:border-b-0 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <Link href={a.href} className="group inline-flex items-baseline gap-1.5">
                      <span className="text-[13px] font-medium text-texte group-hover:text-accent-fonce">{a.libelle}</span>
                      <ArrowUpRight className="size-3 shrink-0 self-center text-attenue-2" strokeWidth={2} />
                    </Link>
                    <p className="meta mt-0.5">{a.declencheur}</p>
                  </td>
                  {canaux.map((c) => (
                    <td key={c} className="px-3 py-3 text-center">
                      <span className="inline-flex justify-center">
                        <Case
                          coche={(reglage.canaux[a.cle] ?? []).includes(c)}
                          onBasculer={() => basculer(a.cle, c)}
                          etiquette={`${a.libelle} — ${CANAL[c].libelle}`}
                          inactif={reglage.silence}
                        />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Carte>

      <Carte titre="Prévenance des échéances" precision="Combien de jours avant le terme d'un document vous êtes prévenu — le même réglage que l'échéancier de Conformité">
        <div className="flex flex-wrap items-center gap-2">
          {[90, 60, 30, 15, 7, 3, 1].map((j) => {
            const retenu = reglage.prevenance.includes(j);
            return (
              <button
                key={j}
                type="button"
                aria-pressed={retenu}
                onClick={() => poser({ ...reglage, prevenance: retenu ? reglage.prevenance.filter((x) => x !== j) : [...reglage.prevenance, j].sort((a, b) => b - a) })}
                className={`h-8 rounded-full border px-3.5 text-[12.5px] transition-colors ${
                  retenu ? "border-accent bg-accent-fond font-semibold text-accent-tres-fonce" : "border-bordure-champ bg-surface text-texte-2 hover:border-accent"
                }`}
              >
                J−{j}
              </button>
            );
          })}
        </div>
        <p className="meta mt-3">
          {reglage.prevenance.length === 0
            ? "Aucun rappel avant le terme : vous ne serez prévenu que le jour de l'échéance."
            : `Rappel à ${reglage.prevenance.map((j) => `J−${j}`).join(", ")}, puis le jour du terme, puis chaque semaine tant que le document reste échu.`}{" "}
          Réglage livré : J−{PREVENANCE_DEFAUT.join(", J−")}.
        </p>
      </Carte>

      <p className="meta">
        La cloche de la barre fonctionne aujourd&apos;hui. Le courriel et Teams sont décrits ici et partiront au branchement : un déclencheur sur la table
        <span className="code"> notification</span>, puis la passerelle. Ce que vous cochez sera repris tel quel — rien n&apos;est à refaire.
      </p>
    </div>
  );
}
