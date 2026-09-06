"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, Lock, LockOpen, X } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { Numero } from "@/composants/interface/Numero";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { peutCloturer, type ClotureMois, type DemandeModification } from "@/domaine/cloture";
import { libelleMoisLong } from "@/domaine/performance";
import { TYPE_TRANSACTION } from "@/domaine/reference";
import { trouverRole } from "@/domaine/roles";
import { cloturer, decider, lireClotures, lireDemandes, rouvrir } from "@/lib/clotures-demo";
import { date } from "@/lib/format";
import { lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Clôture des mois — l'écran de la direction.
 *
 * Un mois clos ne bouge plus sans approbation : c'est la garantie donnée au
 * contrôle de gestion et à la paie que ce qu'ils ont lu ne changera pas dans
 * leur dos. Ici : les douze derniers mois et leur état, les demandes de
 * modification en attente, et l'historique des décisions.
 * ==========================================================================*/

function heure(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function EcranClotures({ mois }: { mois: string[] }) {
  const [clotures, setClotures] = useState<ClotureMois[]>([]);
  const [demandes, setDemandes] = useState<DemandeModification[]>([]);
  const [habilite, setHabilite] = useState(false);
  const [nomRole, setNomRole] = useState("");
  const [commentaires, setCommentaires] = useState<Record<string, string>>({});

  /* Filtre par année (demande du métier du 3 septembre) : les années présentes
     dans la liste, la plus récente d'abord et retenue par défaut. */
  const annees = [...new Set(mois.map((m) => m.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const [annee, setAnnee] = useState<string>(annees[0] ?? "");
  const moisAffiches = mois.filter((m) => m.startsWith(annee));

  useEffect(() => {
    setClotures(lireClotures());
    setDemandes(lireDemandes());
    const r = trouverRole(lireRole());
    setHabilite(peutCloturer(r.role));
    setNomRole(r.libelle);
  }, []);

  const enAttente = demandes.filter((d) => d.statut === "en-attente");
  const decidees = demandes.filter((d) => d.statut !== "en-attente");
  const attenteParMois = (m: string) => enAttente.filter((d) => d.mois === m).length;

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Paramètres
        </Link>
      </nav>
      <TitreEcran
        titre="Clôture des mois"
        sousTitre={
          habilite
            ? `${clotures.length} mois clos · ${enAttente.length} demande${enAttente.length > 1 ? "s" : ""} en attente · vous pouvez clôturer, rouvrir et approuver`
            : `${clotures.length} mois clos · lecture seule — la clôture et l'approbation relèvent de la direction (vous êtes ${nomRole.toLowerCase()})`
        }
        actions={
          <div className="flex h-8 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Année">
            {annees.map((a) => (
              <button key={a} type="button" aria-pressed={annee === a} onClick={() => setAnnee(a)} className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${annee === a ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}>
                {a}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* ---- Les mois ---- */}
        <Carte titre="Mois" precision="Un mois clos n'accepte plus de modification sans approbation" sansMarge>
          <ul className="flex flex-col">
            {moisAffiches.map((m) => {
              const c = clotures.find((x) => x.mois === m) ?? null;
              const attente = attenteParMois(m);
              return (
                <li key={m} className="flex items-center gap-3 border-b border-bordure px-5 py-3 last:border-b-0">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full ${c ? "bg-surface-3 text-texte-2" : "bg-accent-fond text-accent-tres-fonce"}`}>
                    {c ? <Lock className="size-4" strokeWidth={1.8} /> : <LockOpen className="size-4" strokeWidth={1.8} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-texte">{libelleMoisLong(m)}</span>
                    <span className="meta block truncate">{c ? `clos par ${c.closPar} le ${date(c.closLe)}${c.commentaire ? ` — ${c.commentaire}` : ""}` : "ouvert"}</span>
                  </span>
                  {attente > 0 ? <Echeance ton="vigilance">{attente} en attente</Echeance> : null}
                  {habilite ? (
                    c ? (
                      <button type="button" onClick={() => setClotures(rouvrir(m))} className="bouton-discret">
                        Rouvrir
                      </button>
                    ) : (
                      <button type="button" onClick={() => setClotures(cloturer(m, null))} className="bouton-secondaire h-8 px-3 text-[12.5px]">
                        <Lock className="size-3.5" strokeWidth={1.8} />
                        Clôturer
                      </button>
                    )
                  ) : c ? (
                    <Pastille ton="neutre">clos</Pastille>
                  ) : (
                    <Pastille ton="favorable">ouvert</Pastille>
                  )}
                </li>
              );
            })}
          </ul>
        </Carte>

        {/* ---- Demandes ---- */}
        <div className="flex min-w-0 flex-col gap-5">
          <Carte titre="Demandes en attente" precision={enAttente.length === 0 ? "Rien à approuver" : `${enAttente.length} modification${enAttente.length > 1 ? "s" : ""} sur des mois clos`}>
            {enAttente.length === 0 ? (
              <p className="meta py-2">Les modifications demandées sur un mois clos apparaîtront ici.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {enAttente.map((d) => (
                  <li key={d.id} className="rounded-[12px] border border-bordure p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[10.5px] font-semibold text-texte-2">{d.initiales}</span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                          <span className="font-medium text-texte">{d.auteur}</span>
                          <span className="text-texte-2">demande de modifier</span>
                          <Link href={d.href} className="font-medium text-accent-fonce hover:underline">
                            {d.titre}
                          </Link>
                          <span className="code ml-auto text-[11.5px] text-attenue">
                            {date(d.date)} {heure(d.date)}
                          </span>
                        </p>
                        <p className="meta mt-0.5 flex items-center gap-2">
                          <Numero valeur={d.numero} />
                          <span>· {TYPE_TRANSACTION[d.type].libelle} · mois {libelleMoisLong(d.mois).toLowerCase()} clos</span>
                        </p>
                        <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-texte-2">
                          {d.modifications.map((m) => (
                            <li key={m.champ}>
                              <span className="font-medium text-texte">{m.libelleChamp}</span> : <span className="line-through">{m.avant}</span> → <span className="font-medium text-texte">{m.apres}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 rounded-[8px] bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-texte">« {d.motif} »</p>
                        {habilite ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={commentaires[d.id] ?? ""}
                              onChange={(e) => setCommentaires((c) => ({ ...c, [d.id]: e.target.value }))}
                              placeholder="Commentaire de décision (facultatif)"
                              className="h-8 min-w-[220px] flex-1 rounded-[8px] border border-bordure-champ bg-surface px-3 text-[12.5px] outline-none placeholder:text-attenue focus:border-accent"
                            />
                            <button type="button" onClick={() => setDemandes(decider(d.id, "refusee", commentaires[d.id] || null))} className="bouton-secondaire h-8 px-3 text-[12.5px]">
                              <X className="size-3.5" strokeWidth={2} />
                              Refuser
                            </button>
                            <button type="button" onClick={() => setDemandes(decider(d.id, "approuvee", commentaires[d.id] || null))} className="bouton-principal h-8 px-3 text-[12.5px]">
                              <Check className="size-3.5" strokeWidth={2.2} />
                              Approuver
                            </button>
                          </div>
                        ) : (
                          <p className="meta mt-2">En attente d&apos;une décision de la direction.</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          <Carte titre="Décisions" precision="Approuvées et refusées, du plus récent au plus ancien">
            {decidees.length === 0 ? (
              <p className="meta py-2">Aucune décision pour l&apos;instant.</p>
            ) : (
              <ul className="flex flex-col">
                {decidees.map((d) => (
                  <li key={d.id} className="flex items-start gap-3 border-b border-bordure py-3 first:pt-0 last:border-b-0 last:pb-0">
                    <Echeance ton={d.statut === "approuvee" ? "favorable" : "defavorable"}>{d.statut === "approuvee" ? "approuvée" : "refusée"}</Echeance>
                    <div className="min-w-0 flex-1 text-[12.5px]">
                      <p>
                        <Link href={d.href} className="font-medium text-accent-fonce hover:underline">
                          {d.titre}
                        </Link>{" "}
                        <span className="text-texte-2">
                          — {d.modifications.map((m) => m.libelleChamp).join(", ")} · demandé par {d.auteur} le {date(d.date)}
                        </span>
                      </p>
                      <p className="meta mt-0.5">
                        {d.statut === "approuvee" ? "Approuvée" : "Refusée"} par {d.decideePar} le {date(d.decideeLe)}
                        {d.commentaireDecision ? ` — ${d.commentaireDecision}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>
      </div>
    </div>
  );
}
