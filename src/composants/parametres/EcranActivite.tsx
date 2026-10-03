"use client";

import Link from "next/link";
import { ChevronLeft, Info, Smartphone } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { BandeauKpi } from "@/composants/interface/BandeauKpi";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Echeance } from "@/composants/interface/Pastille";
import { NIVEAU_USAGE, modulesDe, niveauUsage, type LigneActivite } from "@/domaine/activite";
import { ROLES } from "@/domaine/roles";
import { date as formaterDate, nombre } from "@/lib/format";

/* ============================================================================
 * Paramètres › Activité des utilisateurs (0078).
 *
 * Métier, 3 octobre 2026 : « voir qui utilise réellement l'application et
 * comment ». Par personne : dernière connexion, dernière activité, jours
 * actifs, écrans consultés (dont au téléphone), saisies et modifications, et
 * les modules qu'elle fréquente. En bas, les modules eux-mêmes : lesquels
 * servent, et à combien de personnes.
 *
 * Les écrans consultés se comptent depuis la mise en place du suivi (0078) ;
 * les saisies et modifications, elles, se lisent dans tout l'historique.
 * ==========================================================================*/

const PERIODES = [7, 30, 90] as const;

const libelleRole = (r: string) => ROLES.find((x) => x.role === r)?.libelle ?? r;

/** « 03/10/2026 à 14:32 », ou « — ». */
function moment(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formaterDate(iso)} à ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function EcranActivite({ jours, lignes, motif }: { jours: number; lignes: LigneActivite[]; motif: string | null }) {
  const comptes = lignes.filter((l) => l.actif);
  const niveaux = comptes.map((l) => niveauUsage(l, jours));
  const actifs = niveaux.filter((n) => n === "regulier" || n === "occasionnel").length;
  const reguliers = niveaux.filter((n) => n === "regulier").length;
  const jamais = niveaux.filter((n) => n === "jamais").length;
  const vues = comptes.reduce((s, l) => s + l.vues, 0);
  const vuesTel = comptes.reduce((s, l) => s + l.vuesTelephone, 0);

  /* Les modules, toutes personnes confondues. */
  const parModule = new Map<string, { vues: number; personnes: Set<string> }>();
  for (const l of comptes) {
    for (const m of modulesDe(l.ecrans)) {
      const x = parModule.get(m.module) ?? { vues: 0, personnes: new Set<string>() };
      x.vues += m.vues;
      x.personnes.add(l.utilisateurId);
      parModule.set(m.module, x);
    }
  }
  const modules = [...parModule].map(([module, x]) => ({ module, vues: x.vues, personnes: x.personnes.size })).sort((a, b) => b.vues - a.vues);

  const lignesTriees = [...lignes].sort((a, b) => NIVEAU_USAGE[niveauUsage(a, jours)].rang - NIVEAU_USAGE[niveauUsage(b, jours)].rang || b.joursActifs - a.joursActifs || b.vues - a.vues || a.nom.localeCompare(b.nom, "fr"));

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran titre="Activité des utilisateurs" sousTitre={`Qui utilise l'application, et comment — sur les ${jours} derniers jours`} />

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/parametres" className="meta inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={2} />
          Paramètres
        </Link>
        <div className="ml-auto flex gap-1.5" role="group" aria-label="Période">
          {PERIODES.map((p) => (
            <Link
              key={p}
              href={`/parametres/activite?jours=${p}`}
              aria-current={p === jours ? "page" : undefined}
              className={`h-8 rounded-full px-3 text-[12.5px] leading-8 ${p === jours ? "bg-surface font-semibold text-texte shadow-onglet" : "bg-surface-3 font-medium text-texte-2 hover:text-texte"}`}
            >
              {p} jours
            </Link>
          ))}
        </div>
      </div>

      {motif ? (
        <p className="rounded-[10px] bg-vigilance-fond px-3 py-2 text-[13px]">{motif}</p>
      ) : (
        <>
          <BandeauKpi
            kpis={[
              { label: "Comptes actifs", valeur: `${actifs}`, unite: `/ ${comptes.length}`, precision: `au moins un jour d'activité ou une saisie sur ${jours} jours` },
              { label: "Usage régulier", valeur: `${reguliers}`, precision: "au moins un jour sur trois" },
              { label: "Jamais connectés", valeur: `${jamais}`, precision: "comptes ouverts, jamais utilisés", ton: jamais > 0 ? "vigilance" : "favorable" },
              { label: "Écrans consultés", valeur: nombre(vues), precision: vues ? `dont ${Math.round((vuesTel / vues) * 100)} % au téléphone` : "depuis la mise en place du suivi" },
            ]}
          />

          <p className="flex items-start gap-2 text-[12.5px] text-texte-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-attenue" strokeWidth={1.9} />
            Les écrans consultés se comptent depuis la mise en place du suivi ; les saisies et modifications se lisent dans tout l&apos;historique. Un écran se note sans ce qu&apos;il montre : « fiche d&apos;un véhicule », pas laquelle.
          </p>

          <Carte titre="Par personne" precision="Du plus assidu au moins — un compte désactivé reste listé, grisé" sansMarge>
            <TableauSimple<LigneActivite>
              reglages="parametres.activite.personnes"
              cle={(l) => l.utilisateurId}
              lignes={lignesTriees}
              filtrable={false}
              vide="Aucun compte."
              colonnes={[
                {
                  cle: "nom",
                  libelle: "Personne",
                  rendu: (l) => (
                    <span className={`block min-w-0 ${l.actif ? "" : "opacity-50"}`}>
                      <span className="block truncate font-medium text-texte">{l.nom}</span>
                      <span className="meta block truncate">
                        {libelleRole(l.role)}
                        {l.courriel ? ` · ${l.courriel}` : ""}
                        {l.actif ? "" : " · désactivé"}
                      </span>
                    </span>
                  ),
                },
                {
                  cle: "usage",
                  libelle: "Usage",
                  rendu: (l) => {
                    const n = NIVEAU_USAGE[niveauUsage(l, jours)];
                    return <Echeance ton={n.ton}>{n.libelle}</Echeance>;
                  },
                },
                { cle: "connexion", libelle: "Dernière connexion", rendu: (l) => <span className="code text-texte-2">{moment(l.derniereConnexion)}</span> },
                { cle: "activite", libelle: "Dernier écran", rendu: (l) => <span className="code text-texte-2">{moment(l.derniereActivite)}</span> },
                { cle: "jours", libelle: "Jours actifs", alignee: "droite", rendu: (l) => <span className="code">{l.joursActifs}</span> },
                {
                  cle: "vues",
                  libelle: "Écrans",
                  alignee: "droite",
                  rendu: (l) => (
                    <span className="code">
                      {nombre(l.vues)}
                      {l.vuesTelephone ? (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-attenue" title="dont au téléphone">
                          <Smartphone className="size-3" strokeWidth={2} />
                          {nombre(l.vuesTelephone)}
                        </span>
                      ) : null}
                    </span>
                  ),
                },
                { cle: "saisies", libelle: "Saisies", alignee: "droite", rendu: (l) => <span className="code">{nombre(l.saisies)}</span> },
                { cle: "modifications", libelle: "Modifications", alignee: "droite", rendu: (l) => <span className="code">{nombre(l.modifications)}</span> },
                {
                  cle: "modules",
                  libelle: "Modules les plus utilisés",
                  rendu: (l) => {
                    const m = modulesDe(l.ecrans).slice(0, 3);
                    return m.length ? <span className="block truncate text-texte-2">{m.map((x) => `${x.module} (${x.vues})`).join(" · ")}</span> : <span className="text-attenue">—</span>;
                  },
                },
              ]}
            />
          </Carte>

          <Carte titre="Par module" precision="Les modules consultés sur la période, et par combien de personnes" sansMarge>
            <TableauSimple<{ module: string; vues: number; personnes: number }>
              reglages="parametres.activite.modules"
              cle={(m) => m.module}
              lignes={modules}
              filtrable={false}
              vide="Aucun écran noté sur la période."
              colonnes={[
                { cle: "module", libelle: "Module", rendu: (m) => <span className="font-medium text-texte">{m.module}</span> },
                { cle: "vues", libelle: "Écrans consultés", alignee: "droite", rendu: (m) => <span className="code">{nombre(m.vues)}</span> },
                { cle: "personnes", libelle: "Personnes", alignee: "droite", rendu: (m) => <span className="code">{m.personnes}</span> },
              ]}
            />
          </Carte>
        </>
      )}
    </div>
  );
}
