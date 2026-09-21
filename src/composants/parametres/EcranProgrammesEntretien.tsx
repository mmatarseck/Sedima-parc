"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { ChampCombo } from "@/composants/interface/ChampCombo";
import { Echeance } from "@/composants/interface/Pastille";
import { GROUPE_OPERATION, libellePeriodicite, motsClesDe, type GroupeOperation, type OperationEntretien, type ProgrammeEntretien } from "@/domaine/entretien";
import { CATEGORIE_VEHICULE } from "@/domaine/libelles";
import type { CategorieVehicule } from "@/domaine/types";
import { enregistrerOperation, enregistrerProgramme, retirerOperation, retirerProgramme, type Issue } from "@/lib/entretien-actions";
import { montant, nombre } from "@/lib/format";

/* ============================================================================
 * Les programmes d'entretien standards — éditables (0062).
 *
 * Un gabarit par type de véhicule. Métier, 21 septembre 2026 : « les
 * programmes d'entretien doivent être éditables, on peut rajouter ou retirer
 * des tâches, ou rajouter un nouveau programme pour une nouvelle catégorie de
 * véhicule ». Une opération cite une tâche du catalogue ; ses mots-clés la
 * reconnaissent dans l'historique des interventions.
 *
 * L'ajustement véhicule par véhicule reste sur la fiche, dans l'onglet
 * Maintenance, sans toucher au gabarit des autres.
 *
 * L'écran montre ce que le programme **coûte** et **immobilise** sur un cycle
 * de référence : resserrer une vidange n'est pas gratuit, et le chiffre doit
 * être sous les yeux au moment où on en décide.
 * ==========================================================================*/

const CHAMP = "h-9 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] outline-none focus:border-accent";

interface Brouillon {
  code?: string;
  libelle: string;
  tacheLibelle: string;
  groupe: GroupeOperation;
  km: string;
  heures: string;
  mois: string;
  motsCles: string;
  dureeHeures: string;
  coutEstime: string;
  critique: boolean;
}

const nb = (s: string): number | null => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return s.trim() && Number.isFinite(n) ? n : null;
};

function brouillonDe(o: OperationEntretien | null): Brouillon {
  return o
    ? { code: o.code, libelle: o.libelle, tacheLibelle: o.tacheLibelle ?? "", groupe: o.groupe, km: o.periodicite.km?.toString() ?? "", heures: o.periodicite.heures?.toString() ?? "", mois: o.periodicite.mois?.toString() ?? "", motsCles: o.motsCles.join(", "), dureeHeures: String(o.dureeHeures), coutEstime: String(o.coutEstime), critique: o.critique }
    : { libelle: "", tacheLibelle: "", groupe: "moteur", km: "", heures: "", mois: "", motsCles: "", dureeHeures: "1", coutEstime: "0", critique: false };
}

function Champ({ libelle, children, large = false }: { libelle: string; children: React.ReactNode; large?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${large ? "sm:col-span-2 lg:col-span-4" : ""}`}>
      <span className="label-champ">{libelle}</span>
      {children}
    </label>
  );
}

export function EcranProgrammesEntretien({ programmes, comptes, taches, enBase }: { programmes: ProgrammeEntretien[]; comptes: Record<string, number>; taches: { libelle: string; precision: string }[]; enBase: boolean }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [choisi, setChoisi] = useState(programmes[0]?.code ?? "");
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);
  const [operation, setOperation] = useState<Brouillon | null>(null);
  const [programmeEdite, setProgrammeEdite] = useState<{ code?: string; libelle: string; precision: string; base: "km" | "heures"; categories: CategorieVehicule[] } | null>(null);
  const programme = programmes.find((p) => p.code === choisi) ?? programmes[0];

  function agir(action: () => Promise<Issue>, reussite: string, apres?: (code: string) => void) {
    setMessage(null);
    demarrer(async () => {
      const r = await action();
      if (!r.ok) return setMessage({ ton: "erreur", texte: r.motif });
      setMessage({ ton: "ok", texte: reussite });
      apres?.(r.code);
      router.refresh();
    });
  }

  if (!programme) return null;

  /* Le coût d'un cycle de référence : ce que le programme demande par an, sur un véhicule qui parcourt 60 000 km ou travaille 1 500 heures. */
  const REFERENCE_KM = 60_000;
  const REFERENCE_HEURES = 1_500;
  const passagesAnnuels = (o: OperationEntretien): number => {
    if (programme.base === "heures" && o.periodicite.heures !== null) return REFERENCE_HEURES / o.periodicite.heures;
    if (o.periodicite.km !== null) return REFERENCE_KM / o.periodicite.km;
    if (o.periodicite.mois !== null) return 12 / o.periodicite.mois;
    return 0;
  };
  const coutAnnuel = programme.operations.reduce((s, o) => s + passagesAnnuels(o) * o.coutEstime, 0);
  const heuresAnnuelles = programme.operations.reduce((s, o) => s + passagesAnnuels(o) * o.dureeHeures, 0);
  const proprietaire = (c: CategorieVehicule) => programmes.find((p) => p.categories.includes(c));

  function enregistrerLOperation() {
    if (!operation) return;
    const o = operation;
    agir(
      () =>
        enregistrerOperation(programme!.code, {
          code: o.code,
          libelle: o.libelle || o.tacheLibelle,
          tacheLibelle: o.tacheLibelle.trim() || null,
          groupe: o.groupe,
          km: nb(o.km),
          heures: nb(o.heures),
          mois: nb(o.mois),
          motsCles: o.motsCles.split(","),
          dureeHeures: nb(o.dureeHeures) ?? 0,
          coutEstime: nb(o.coutEstime) ?? 0,
          critique: o.critique,
          ordre: o.code ? programme!.operations.findIndex((x) => x.code === o.code) + 1 : programme!.operations.length + 1,
        }),
      o.code ? "Opération mise à jour." : "Tâche ajoutée au programme.",
      () => setOperation(null),
    );
  }

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran
        titre="Programmes d'entretien"
        sousTitre={`${programmes.length} gabarits — un par type de véhicule · appliqués automatiquement selon la catégorie, ajustables ensuite fiche par fiche`}
        actions={
          enBase ? (
            <button type="button" className="bouton-principal" onClick={() => setProgrammeEdite({ libelle: "", precision: "", base: "km", categories: [] })}>
              <Plus className="size-4" strokeWidth={2} />
              Nouveau programme
            </button>
          ) : null
        }
      />

      <p className="meta">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={2} />
          Paramètres
        </Link>
      </p>

      {!enBase ? (
        <p className="rounded-[10px] bg-vigilance-fond px-3 py-2 text-[13px]">Les gabarits d&apos;origine s&apos;affichent en lecture : jouez la migration 0062 pour les modifier ici.</p>
      ) : null}
      {message ? <p className={`text-[13px] ${message.ton === "ok" ? "text-favorable" : "text-defavorable"}`}>{message.texte}</p> : null}

      <div className="sans-barre flex flex-wrap items-center gap-1.5" role="group" aria-label="Programme">
        {programmes.map((p) => (
          <button
            key={p.code}
            type="button"
            aria-pressed={p.code === programme.code}
            onClick={() => {
              setChoisi(p.code);
              setOperation(null);
              setProgrammeEdite(null);
            }}
            className={`h-8 rounded-full px-3 text-[12.5px] whitespace-nowrap transition-colors ${p.code === programme.code ? "bg-surface font-semibold text-texte shadow-onglet" : "bg-surface-3 font-medium text-texte-2 hover:text-texte"}`}
          >
            {p.libelle}
            <span className="ml-1.5 text-attenue">{comptes[p.code] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* ---- Le programme : lecture, ou édition ---- */}
      {programmeEdite ? (
        <Carte titre={programmeEdite.code ? "Modifier le programme" : "Nouveau programme"} precision="Une catégorie n'appartient qu'à un programme : la cocher ici la retire à l'autre">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Champ libelle="Nom du programme">
              <input className={CHAMP} value={programmeEdite.libelle} onChange={(e) => setProgrammeEdite({ ...programmeEdite, libelle: e.target.value })} />
            </Champ>
            <Champ libelle="Compteur">
              <select className={CHAMP} value={programmeEdite.base} onChange={(e) => setProgrammeEdite({ ...programmeEdite, base: e.target.value as "km" | "heures" })}>
                <option value="km">Kilomètres</option>
                <option value="heures">Heures moteur</option>
              </select>
            </Champ>
            <Champ libelle="Précision" large>
              <input className={CHAMP} value={programmeEdite.precision} onChange={(e) => setProgrammeEdite({ ...programmeEdite, precision: e.target.value })} placeholder="Ce qui distingue ce type de véhicule" />
            </Champ>
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
              <span className="label-champ">Catégories de véhicules</span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORIE_VEHICULE) as CategorieVehicule[]).map((c) => {
                  const coche = programmeEdite.categories.includes(c);
                  const ailleurs = proprietaire(c);
                  return (
                    <label key={c} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-[12.5px] ${coche ? "border-accent bg-accent-fond" : "border-bordure"}`}>
                      <input type="checkbox" checked={coche} onChange={() => setProgrammeEdite({ ...programmeEdite, categories: coche ? programmeEdite.categories.filter((x) => x !== c) : [...programmeEdite.categories, c] })} />
                      {CATEGORIE_VEHICULE[c]}
                      {ailleurs && ailleurs.code !== programmeEdite.code ? <span className="meta">· {ailleurs.libelle}</span> : null}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="bouton-secondaire" onClick={() => setProgrammeEdite(null)}>
              Annuler
            </button>
            <button
              type="button"
              className="bouton-principal"
              disabled={enCours}
              onClick={() => agir(() => enregistrerProgramme(programmeEdite), programmeEdite.code ? "Programme mis à jour." : "Programme créé : ajoutez-lui ses tâches.", (code) => (setProgrammeEdite(null), setChoisi(code)))}
            >
              Enregistrer
            </button>
          </div>
        </Carte>
      ) : (
        <div className="flex items-start gap-3 rounded-[12px] border border-bordure bg-surface px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.9} />
          <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-texte">
            <p>
              <span className="font-medium">{programme.libelle}</span>
              {programme.precision ? ` — ${programme.precision}` : ""} S&apos;applique à{" "}
              {programme.categories.length ? programme.categories.map((c) => CATEGORIE_VEHICULE[c]).join(", ").toLowerCase() : "aucune catégorie"}, soit <strong className="font-semibold">{comptes[programme.code] ?? 0} véhicules</strong> du parc.
            </p>
            <p className="meta mt-1">
              Sur un cycle de référence de {programme.base === "heures" ? `${nombre(REFERENCE_HEURES)} heures` : `${nombre(REFERENCE_KM)} km`} par an, ce programme représente <strong className="font-semibold text-texte">{montant(Math.round(coutAnnuel))}</strong> et{" "}
              <strong className="font-semibold text-texte">{Math.round(heuresAnnuelles)} heures d&apos;atelier</strong> par véhicule.
            </p>
          </div>
          {enBase ? (
            <div className="flex shrink-0 gap-1.5">
              <button type="button" className="bouton-discret h-8 px-2 text-[12px]" onClick={() => setProgrammeEdite({ code: programme.code, libelle: programme.libelle, precision: programme.precision, base: programme.base, categories: programme.categories })}>
                <Pencil className="size-3.5" strokeWidth={1.8} />
                Modifier
              </button>
              <button
                type="button"
                className="bouton-discret h-8 px-2 text-[12px] hover:text-defavorable"
                disabled={enCours}
                onClick={() => {
                  if (window.confirm(`Retirer le programme « ${programme.libelle} » ? Ses catégories reviendront au programme léger.`)) agir(() => retirerProgramme(programme.code), "Programme retiré.", () => setChoisi(programmes.find((p) => p.code !== programme.code)?.code ?? ""));
                }}
              >
                <Trash2 className="size-3.5" strokeWidth={1.8} />
                Retirer
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* ---- Ajouter ou modifier une opération ---- */}
      {operation ? (
        <Carte titre={operation.code ? "Modifier l'opération" : "Ajouter une tâche au programme"} precision="Une périodicité au moins : la première limite atteinte déclenche l'échéance">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="label-champ">Tâche du catalogue</span>
              <ChampCombo
                valeur={operation.tacheLibelle}
                onChange={(t) => setOperation({ ...operation, tacheLibelle: t, libelle: operation.libelle && operation.code ? operation.libelle : t, motsCles: operation.motsCles || motsClesDe(t).join(", ") })}
                options={taches.map((t) => ({ valeur: t.libelle, libelle: t.libelle, precision: t.precision }))}
                placeholder="Choisir une tâche"
              />
            </div>
            <Champ libelle="Nom dans le programme">
              <input className={CHAMP} value={operation.libelle} onChange={(e) => setOperation({ ...operation, libelle: e.target.value })} />
            </Champ>
            <Champ libelle="Ensemble">
              <select className={CHAMP} value={operation.groupe} onChange={(e) => setOperation({ ...operation, groupe: e.target.value as GroupeOperation })}>
                {(Object.keys(GROUPE_OPERATION) as GroupeOperation[]).map((g) => (
                  <option key={g} value={g}>
                    {GROUPE_OPERATION[g]}
                  </option>
                ))}
              </select>
            </Champ>
            {programme.base === "km" ? (
              <Champ libelle="Tous les … km">
                <input inputMode="numeric" className={CHAMP} value={operation.km} onChange={(e) => setOperation({ ...operation, km: e.target.value })} />
              </Champ>
            ) : (
              <Champ libelle="Toutes les … heures">
                <input inputMode="numeric" className={CHAMP} value={operation.heures} onChange={(e) => setOperation({ ...operation, heures: e.target.value })} />
              </Champ>
            )}
            <Champ libelle="Ou tous les … mois">
              <input inputMode="numeric" className={CHAMP} value={operation.mois} onChange={(e) => setOperation({ ...operation, mois: e.target.value })} />
            </Champ>
            <Champ libelle="Immobilisation (heures)">
              <input inputMode="decimal" className={CHAMP} value={operation.dureeHeures} onChange={(e) => setOperation({ ...operation, dureeHeures: e.target.value })} />
            </Champ>
            <Champ libelle="Coût estimé par passage (F)">
              <input inputMode="numeric" className={CHAMP} value={operation.coutEstime} onChange={(e) => setOperation({ ...operation, coutEstime: e.target.value })} />
            </Champ>
            <Champ libelle="Reconnue dans l'historique par (mots séparés par des virgules)" large>
              <input className={CHAMP} value={operation.motsCles} onChange={(e) => setOperation({ ...operation, motsCles: e.target.value })} placeholder="vidange, filtre à huile" />
            </Champ>
            <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
              <input type="checkbox" checked={operation.critique} onChange={(e) => setOperation({ ...operation, critique: e.target.checked })} />
              Opération de sécurité — elle ne se reporte pas
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="bouton-secondaire" onClick={() => setOperation(null)}>
              Annuler
            </button>
            <button type="button" className="bouton-principal" disabled={enCours || !(operation.libelle || operation.tacheLibelle)} onClick={enregistrerLOperation}>
              Enregistrer
            </button>
          </div>
        </Carte>
      ) : null}

      <Carte
        titre="Opérations du programme"
        precision="Ce que le gabarit prévoit — la fiche de chaque véhicule peut s'en écarter, avec motif"
        sansMarge
        action={
          enBase && !operation ? (
            <button type="button" className="bouton-discret h-8 px-2 text-[12px]" onClick={() => setOperation(brouillonDe(null))}>
              <Plus className="size-3.5" strokeWidth={2} />
              Ajouter une tâche
            </button>
          ) : null
        }
      >
        <TableauSimple<OperationEntretien>
          reglages="parametres.programmes-entretien"
          cle={(o) => o.code}
          lignes={programme.operations}
          ajustable
          filtrable={false}
          colonnes={[
            {
              cle: "libelle",
              libelle: "Opération",
              rendu: (o) => (
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-medium text-texte">{o.libelle}</span>
                  {o.critique ? (
                    <span className="meta shrink-0" title="Opération de sécurité : elle ne se reporte pas">
                      sécurité
                    </span>
                  ) : null}
                </span>
              ),
            },
            { cle: "tache", libelle: "Tâche du catalogue", rendu: (o) => (o.tacheLibelle ? <span className="block truncate text-texte-2">{o.tacheLibelle}</span> : <span className="text-attenue">—</span>) },
            { cle: "groupe", libelle: "Ensemble", parDefaut: false, rendu: (o) => GROUPE_OPERATION[o.groupe] },
            { cle: "periodicite", libelle: "Périodicité", rendu: (o) => libellePeriodicite(o.periodicite) },
            { cle: "frequence", libelle: programme.base === "heures" ? "Passages / 1 500 h" : "Passages / 60 000 km", alignee: "droite", rendu: (o) => <span className="code">{passagesAnnuels(o).toFixed(1)}</span> },
            { cle: "duree", libelle: "Immobilisation", alignee: "droite", rendu: (o) => <span className="code">{o.dureeHeures} h</span> },
            { cle: "cout", libelle: "Coût par passage", alignee: "droite", rendu: (o) => <span className="code">{montant(o.coutEstime)}</span> },
            { cle: "annuel", libelle: "Coût sur le cycle", alignee: "droite", rendu: (o) => <span className="code font-medium">{montant(Math.round(passagesAnnuels(o) * o.coutEstime))}</span> },
            { cle: "reconnaissance", libelle: "Reconnue dans l'historique par", parDefaut: false, rendu: (o) => <span className="block truncate text-texte-2">{o.motsCles.join(", ")}</span> },
            { cle: "critique", libelle: "Sécurité", parDefaut: false, rendu: (o) => (o.critique ? <Echeance ton="defavorable">Ne se reporte pas</Echeance> : <span className="text-attenue">—</span>) },
            ...(enBase
              ? [
                  {
                    cle: "actions",
                    libelle: "",
                    rendu: (o: OperationEntretien) => (
                      <span className="flex justify-end gap-1">
                        <button type="button" onClick={() => setOperation(brouillonDe(o))} className="grid size-7 place-items-center rounded-full text-attenue hover:bg-surface-3 hover:text-texte" aria-label={`Modifier ${o.libelle}`} title="Modifier">
                          <Pencil className="size-3.5" strokeWidth={1.8} />
                        </button>
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => {
                            if (window.confirm(`Retirer « ${o.libelle} » du programme ? Les ajustements de véhicules qui la citent partent avec.`)) agir(() => retirerOperation(programme.code, o.code), "Tâche retirée du programme.");
                          }}
                          className="grid size-7 place-items-center rounded-full text-attenue hover:bg-surface-3 hover:text-defavorable"
                          aria-label={`Retirer ${o.libelle}`}
                          title="Retirer du programme"
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.8} />
                        </button>
                      </span>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Carte>
    </div>
  );
}
