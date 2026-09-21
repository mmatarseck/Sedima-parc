"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Lock, Package, Plus, Trash2, Wrench, X } from "lucide-react";
import { ChampCombo } from "@/composants/interface/ChampCombo";
import { ChampPieces } from "@/composants/interface/ChampPieces";
import { Numero } from "@/composants/interface/Numero";
import { Echeance } from "@/composants/interface/Pastille";
import { ChampSaisie } from "@/composants/transactions/ChampSaisie";
import { CHAMPS } from "@/composants/transactions/champs";
import { optionsPrestataires, optionsVehicules } from "@/composants/transactions/options";
import type { ChampEdition } from "@/domaine/cloture";
import { optionsSystemes } from "@/domaine/categories-maintenance";
import type { LigneOrdre } from "@/domaine/maintenance";
import { STATUT_ORDRE } from "@/domaine/maintenance";
import { TYPES_GARAGE } from "@/domaine/prestataires";
import { PRIORITE_SERVICE, TAUX_BRS, TAUX_TVA, calculerService, joursImmobilisation, peutCloturerService, type LigneService, type ModeRemise, type PrioriteService } from "@/domaine/service";
import { ETAT_SIGNALEMENT, PRIORITE_SIGNALEMENT, etatSignalement, trierSignalements, type LigneSignalement } from "@/domaine/signalements";
import { precisionTache, tacheParLibelle } from "@/domaine/taches";
import { jourCourant } from "@/domaine/temps";
import { enregistrerCreation, enregistrerModification, lireCreations } from "@/lib/clotures-demo";
import { date as formaterDate, montant } from "@/lib/format";
import { lirePiecesDisponibles, type PieceDisponible } from "@/lib/pieces-actions";
import { lireReferentiels } from "@/lib/referentiels-navigateur";
import { lireRole } from "@/lib/session-demo";
import { cloturerService } from "./cloturer-service";

/* ============================================================================
 * Le service de maintenance : un formulaire, de la planification à la clôture.
 *
 * Métier, 21 septembre 2026 : « créer des services de maintenance, où l'on
 * choisit le véhicule, la priorité (planifié, non planifié, urgent), le type
 * (préventif, curatif), les dates de début et de fin des travaux, le
 * prestataire ; on voit les pannes et anomalies déclarées et on sélectionne
 * celles qui seront incluses ; on sélectionne des pièces de rechange du stock ;
 * on attache des documents ou photos ; puis un tableau qui détaille les
 * dépenses » — avec remise par ligne, remise globale, TVA 18 %, BRS 5 %,
 * total HT et TTC.
 *
 * Il remplace l'ordre de travail : même table, même numéro OTR. Les calculs
 * sont dans `domaine/service`, ce que la clôture écrit dans
 * `domaine/cloture-service`. Seul le responsable du parc clôt.
 * ==========================================================================*/

export interface VehiculeService {
  immatriculation: string;
  immatriculationAffichee: string;
  libelle: string;
}

export interface DemandeService {
  /** Le service à modifier ; absent pour en créer un. */
  service?: LigneOrdre | null;
  /** Le véhicule de la fiche ; absent depuis la page Maintenance, où on le choisit. */
  vehicule?: VehiculeService | null;
  /** Les signalements connus de l'écran appelant : ceux du véhicule choisi s'y proposent. */
  signalements: LigneSignalement[];
  /** Les services connus : un signalement déjà pris par un autre service ouvert ne se propose pas. */
  services?: LigneOrdre[];
  /** Ce qu'un « Planifier » propose d'avance : la panne signalée, l'échéance du plan. */
  propose?: { type?: "preventif" | "curatif"; objet?: string; origineNumero?: string | null; signalements?: string[]; priorite?: PrioriteService; vehiculeImmatriculation?: string };
}

const ligneVide = (): LigneService => ({ cle: Math.random().toString(36).slice(2, 10), tacheNumero: null, libelle: "", systeme: null, mainOeuvre: 0, piecesAchetees: 0, piecesStock: [], remiseMode: "montant", remiseValeur: 0 });

function nombre(s: string): number {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function EntreeMontant({ valeur, onChange, unite = "F", large = false, etiquette }: { valeur: number; onChange: (n: number) => void; unite?: string; large?: boolean; etiquette: string }) {
  const [texte, setTexte] = useState(valeur ? String(valeur) : "");
  useEffect(() => setTexte(valeur ? String(valeur) : ""), [valeur]);
  return (
    <span className={`relative block ${large ? "w-full" : "w-[120px]"}`}>
      <input
        aria-label={etiquette}
        inputMode="decimal"
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          onChange(nombre(e.target.value));
        }}
        className="code h-9 w-full rounded-[10px] border border-bordure-champ bg-surface pr-7 pl-2 text-right text-[13px] outline-none focus:border-accent"
      />
      <span className="meta pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">{unite}</span>
    </span>
  );
}

function ModeRemiseBascule({ mode, onChange }: { mode: ModeRemise; onChange: (m: ModeRemise) => void }) {
  return (
    <button type="button" onClick={() => onChange(mode === "montant" ? "pourcentage" : "montant")} className="bouton-discret h-9 w-9 justify-center p-0 text-[12px] font-semibold" title="Remise en francs ou en pour cent">
      {mode === "montant" ? "F" : "%"}
    </button>
  );
}

export function FormulaireService({ demande, onFermer, onEnregistre }: { demande: DemandeService; onFermer: () => void; onEnregistre: () => void }) {
  const existant = demande.service ?? null;
  const clos = existant?.statut === "clos" || existant?.statut === "annule";
  const aujourdhui = jourCourant();
  const vehiculeFixe = demande.vehicule ?? null;

  const [entete, setEntete] = useState<Record<string, string | boolean>>(() => ({
    vehiculeId: existant ? (lireReferentiels().vehicules.find((v) => v.immatriculation === existant.immatriculation)?.id ?? "") : demande.propose?.vehiculeImmatriculation ? (lireReferentiels().vehicules.find((v) => v.immatriculation === demande.propose!.vehiculeImmatriculation)?.id ?? "") : "",
    priorite: existant?.priorite ?? demande.propose?.priorite ?? "planifie",
    type: existant?.type ?? demande.propose?.type ?? "curatif",
    objet: existant?.objet ?? demande.propose?.objet ?? "",
    datePrevue: existant?.datePrevue ?? aujourdhui,
    dateFin: existant?.dateFin ?? "",
    garage: existant && existant.garage !== "—" ? existant.garage : "",
    kilometrage: existant?.kilometrage ? String(existant.kilometrage) : "",
    numeroFacture: existant?.numeroFacture ?? "",
    commentaire: existant?.commentaire ?? "",
  }));
  const [lignes, setLignes] = useState<LigneService[]>(() => (existant?.lignes?.length ? existant.lignes : [ligneVide()]));
  const [remiseMode, setRemiseMode] = useState<ModeRemise>(existant?.remiseMode ?? "montant");
  const [remiseValeur, setRemiseValeur] = useState<number>(existant?.remiseValeur ?? 0);
  const [mainOeuvreGlobale, setMainOeuvreGlobale] = useState<number>(existant?.mainOeuvreGlobale ?? 0);
  const [tvaTaux, setTvaTaux] = useState<number>(existant ? (existant.tvaTaux ?? 0) : TAUX_TVA);
  const [brsTaux, setBrsTaux] = useState<number>(existant?.brsTaux ?? 0);
  const [pieces, setPieces] = useState<string[]>(existant?.pieces ?? []);
  const [inclus, setInclus] = useState<string[]>(existant?.signalements ?? demande.propose?.signalements ?? []);
  const [stock, setStock] = useState<PieceDisponible[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const [tentee, setTentee] = useState(false);

  useEffect(() => {
    let vivant = true;
    void lirePiecesDisponibles().then((p) => vivant && setStock(p));
    return () => {
      vivant = false;
    };
  }, []);

  const taches = lireReferentiels().taches;
  const vehiculeChoisi = vehiculeFixe ?? (() => {
    const v = lireReferentiels().vehicules.find((x) => x.id === entete.vehiculeId);
    return v ? { immatriculation: v.immatriculation, immatriculationAffichee: v.immatriculationAffichee, libelle: `${v.marque} ${v.appellation}` } : existant ? { immatriculation: existant.immatriculation, immatriculationAffichee: existant.immatriculationAffichee, libelle: existant.vehicule } : null;
  })();

  /* Les signalements du véhicule : ouverts, ou déjà inclus dans ce service. Un signalement pris par un autre service ouvert ne se propose pas. */
  const proposables = useMemo(() => {
    if (!vehiculeChoisi) return [];
    const autres = (demande.services ?? []).filter((o) => o.numero !== existant?.numero);
    /* Une panne ne se propose qu'une fois, même si l'appelant la tient deux fois — sa copie du navigateur et la ligne de la base (métier, 21 septembre 2026). */
    const uniques = [...new Map(demande.signalements.map((s) => [s.numero, s])).values()];
    return trierSignalements(uniques.filter((s) => s.vehiculeId === vehiculeChoisi.immatriculation && (inclus.includes(s.numero) || etatSignalement(s, autres) === "ouvert")));
  }, [demande.signalements, demande.services, vehiculeChoisi, inclus, existant?.numero]);

  const totaux = calculerService({ lignes, mainOeuvreGlobale, remiseMode, remiseValeur, tvaTaux, brsTaux });
  /* L'immobilisation se calcule (métier, 21 septembre 2026) : du début à la fin des travaux, ou jusqu'à aujourd'hui tant qu'ils courent. */
  const debutTravaux = String(entete.datePrevue ?? "") || null;
  const finTravaux = String(entete.dateFin ?? "") || null;
  const immobilisation = joursImmobilisation(debutTravaux, finTravaux ?? (debutTravaux && debutTravaux <= aujourdhui ? aujourdhui : null));

  const champsEntete: ChampEdition[] = [
    ...(vehiculeFixe || existant ? [] : [{ cle: "vehiculeId", libelle: "Véhicule", type: "choix" as const, options: optionsVehicules(), obligatoire: true }]),
    { cle: "priorite", libelle: "Priorité", type: "choix", options: Object.entries(PRIORITE_SERVICE).map(([valeur, d]) => ({ valeur, libelle: d.libelle })), obligatoire: true },
    { cle: "type", libelle: "Type d'intervention", type: "choix", options: [{ valeur: "curatif", libelle: "Curative" }, { valeur: "preventif", libelle: "Préventive" }], obligatoire: true },
    { cle: "datePrevue", libelle: "Début des travaux", type: "date", obligatoire: true },
    { cle: "dateFin", libelle: "Fin des travaux", type: "date" },
    { cle: "garage", libelle: "Prestataire", type: "suggestion", suggestionsDe: () => optionsPrestataires([...TYPES_GARAGE, "pieces", "pneumatiques"], lireCreations), obligatoire: true },
    { cle: "kilometrage", libelle: "Kilométrage", type: "nombre", unite: "km" },
    { cle: "numeroFacture", libelle: "N° de facture ou de devis", type: "texte" },
    { cle: "objet", libelle: "Objet du service", type: "texte", obligatoire: true },
  ];
  const manquants = champsEntete.filter((c) => c.obligatoire && !String(entete[c.cle] ?? "").trim());

  function changerLigne(i: number, modif: Partial<LigneService>) {
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...modif } : l)));
  }

  function choisirTache(i: number, libelle: string) {
    const t = tacheParLibelle(taches, libelle);
    changerLigne(i, t ? { libelle: t.libelle, tacheNumero: t.numero, systeme: t.systeme } : { libelle, tacheNumero: null });
    if (t?.typeDefaut && i === 0 && !existant) setEntete((e) => ({ ...e, type: t.typeDefaut! }));
  }

  function valeursDuService(lignesFinales: LigneService[]): Record<string, unknown> {
    const vehicule = lireReferentiels().vehicules.find((v) => v.immatriculation === vehiculeChoisi?.immatriculation);
    return {
      vehiculeId: vehicule?.id ?? entete.vehiculeId,
      type: entete.type,
      objet: String(entete.objet).trim(),
      garage: String(entete.garage).trim(),
      datePrevue: entete.datePrevue,
      dateFin: entete.dateFin || null,
      priorite: entete.priorite,
      kilometrage: entete.kilometrage ? nombre(String(entete.kilometrage)) : null,
      numeroFacture: String(entete.numeroFacture ?? "").trim() || null,
      immobilisationPrevueJours: immobilisation,
      montantEstime: calculerService({ lignes: lignesFinales, mainOeuvreGlobale, remiseMode, remiseValeur, tvaTaux, brsTaux }).coutTotal || null,
      commentaire: String(entete.commentaire ?? "").trim() || null,
      lignes: JSON.stringify(lignesFinales),
      remiseMode,
      remiseValeur,
      mainOeuvreGlobale,
      tvaTaux,
      brsTaux,
      pieces,
      signalements: inclus,
      origineNumero: existant?.origineNumero ?? demande.propose?.origineNumero ?? (inclus[0] ?? null),
    };
  }

  /* Une tâche écrite à la main entre au catalogue : c'est ce qui rendra les rapports justes. */
  function catalogueCompletePar(ls: LigneService[]): LigneService[] {
    return ls.map((l) => {
      if (l.tacheNumero || !l.libelle.trim()) return l;
      const existante = tacheParLibelle(lireReferentiels().taches, l.libelle);
      if (existante) return { ...l, tacheNumero: existante.numero, systeme: existante.systeme };
      const r = enregistrerCreation({ sujet: "catalogue", type: "tache", champs: CHAMPS.tache, valeurs: { libelle: l.libelle.trim(), systeme: l.systeme ?? "999", typeDefaut: entete.type, actif: true }, motif: "Créée depuis un service de maintenance" });
      return r.issue === "creee" ? { ...l, tacheNumero: r.creation.numero } : l;
    });
  }

  function enregistrer(): LigneOrdre | null {
    setTentee(true);
    setErreur(null);
    if (!vehiculeChoisi) return setErreur("Choisissez le véhicule."), null;
    if (manquants.length) return setErreur(`À renseigner : ${manquants.map((c) => c.libelle.toLowerCase()).join(", ")}.`), null;
    const lignesSaisies = lignes.filter((l) => l.libelle.trim() || l.precision?.trim() || l.mainOeuvre || l.piecesAchetees || l.piecesStock.length);
    if (lignesSaisies.some((l) => !l.libelle.trim())) return setErreur("Chaque ligne nomme sa tâche."), null;
    const lignesFinales = catalogueCompletePar(lignesSaisies);
    const valeurs = valeursDuService(lignesFinales);
    const sujet = `vehicule:${vehiculeChoisi.immatriculation}`;

    if (!existant) {
      const r = enregistrerCreation({ sujet, type: "ordre", champs: CHAMPS.ordre, valeurs: { ...valeurs, statut: "planifie" }, motif: "" });
      if (r.issue === "mois-clos") return setErreur(`Le mois de ${r.mois} est clos : changez la date de début.`), null;
      if (r.issue !== "creee") return setErreur("La date de début est illisible."), null;
      setFait(r.creation.numero);
      onEnregistre();
      return { ...(r.creation.valeurs as unknown as LigneOrdre), numero: r.creation.numero };
    }
    const avant = { ...(existant as unknown as Record<string, unknown>), lignes: JSON.stringify(existant.lignes ?? []), dateFin: existant.dateFin ?? null };
    const apres = { ...avant, ...valeurs };
    const res = enregistrerModification({ numero: existant.numero, sujet, type: "ordre", titre: `Service ${existant.numero} · ${String(valeurs.objet)}`, href: `/maintenance?vue=ordres&ref=${existant.numero}`, champs: CHAMPS.ordre, avant, apres, motif: "Service mis à jour" });
    if (res.issue === "en-attente") setErreur("Le mois est clos : la modification attend l'accord de la direction.");
    setFait(existant.numero);
    onEnregistre();
    return { ...existant, ...(valeurs as unknown as Partial<LigneOrdre>), lignes: lignesFinales, pieces, signalements: inclus, dateFin: (valeurs.dateFin as string | null) ?? null } as LigneOrdre;
  }

  function enregistrerEtFermer() {
    if (enregistrer()) setTimeout(onFermer, 1400);
  }

  const peutClore = Boolean(existant) && !clos && peutCloturerService(lireRole());
  function clore() {
    const service = enregistrer();
    if (!service) return;
    const r = cloturerService({ ...existant!, ...service }, aujourdhui);
    if (r.issue === "refus") return setErreur(r.motif);
    setFait(`${existant!.numero} clos · intervention ${r.intervention} · ${r.depenses} dépense${r.depenses > 1 ? "s" : ""}${r.sorties ? ` · ${r.sorties} sortie${r.sorties > 1 ? "s" : ""} de stock` : ""}`);
    onEnregistre();
    setTimeout(onFermer, 2200);
  }

  const titre = existant ? `Service ${existant.numero}` : "Nouveau service de maintenance";

  return (
    <>
      <button type="button" aria-label="Fermer" onClick={onFermer} className="fixed inset-0 z-50 cursor-default bg-encre/30" />
      <div role="dialog" aria-modal="true" aria-label={titre} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="pointer-events-auto flex max-h-[94vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[16px] border border-bordure bg-surface shadow-modale" style={{ animation: "apparition 160ms ease-out" }}>
          {/* ---- En-tête ---- */}
          <div className="flex items-start gap-3 border-b border-bordure px-6 py-4">
            <div className="min-w-0 flex-1">
              <p className="micro-sur-titre">Service de maintenance{existant ? ` · ${STATUT_ORDRE[existant.statut].toLowerCase()}` : " · création"}</p>
              <h2 className="titre-bloc mt-0.5 truncate">{vehiculeChoisi ? `${titre} · ${vehiculeChoisi.immatriculationAffichee} · ${vehiculeChoisi.libelle}` : titre}</h2>
              <p className="mt-1">{existant ? <Numero valeur={existant.numero} /> : <span className="meta">Le numéro OTR sera attribué à l&apos;enregistrement.</span>}</p>
            </div>
            <button type="button" onClick={onFermer} className="grid size-8 shrink-0 place-items-center rounded-full text-texte-2 hover:bg-surface-3 hover:text-texte">
              <X className="size-4" strokeWidth={1.8} />
              <span className="sr-only">Fermer</span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {clos ? (
              <p className="mb-4 flex items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2 text-[12.5px] text-texte-2">
                <Lock className="size-3.5" strokeWidth={1.8} />
                Service {existant!.statut === "clos" ? `clos le ${formaterDate(existant!.dateCloture)}` : "annulé"} : il se lit, il ne se modifie plus. Ses dépenses sont sur la fiche du véhicule.
              </p>
            ) : null}

            {/* ---- Le service ---- */}
            <fieldset disabled={clos} className="contents">
              <h3 className="titre-bloc mb-3 border-b border-bordure pb-1.5 text-[13px]">Le service</h3>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {champsEntete.map((c) => (
                  <label key={c.cle} className={`flex flex-col gap-1.5 ${c.cle === "objet" ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                    <span className="label-champ">
                      {c.libelle}
                      {c.obligatoire ? <span className="text-defavorable"> ●</span> : null}
                    </span>
                    <ChampSaisie champ={c} valeur={entete[c.cle] ?? ""} saisie={entete} onChange={(v) => setEntete((e) => ({ ...e, [c.cle]: v }))} invalide={tentee && Boolean(c.obligatoire) && !String(entete[c.cle] ?? "").trim()} />
                  </label>
                ))}
                <div className="flex flex-col gap-1.5">
                  <span className="label-champ">Immobilisation</span>
                  <span className="flex h-9 items-center rounded-[10px] bg-surface-2 px-3 text-[13px]">
                    {immobilisation === null ? <span className="text-attenue">Calculée des dates de travaux</span> : <span className="code font-medium">{immobilisation} jour{immobilisation > 1 ? "s" : ""}{finTravaux ? "" : " à ce jour"}</span>}
                  </span>
                </div>
              </div>

              {/* ---- Les pannes et anomalies incluses ---- */}
              <h3 className="titre-bloc mt-6 mb-3 border-b border-bordure pb-1.5 text-[13px]">Pannes et anomalies incluses</h3>
              {!vehiculeChoisi ? (
                <p className="meta">Choisissez le véhicule : ses pannes signalées s&apos;afficheront ici.</p>
              ) : proposables.length === 0 ? (
                <p className="meta">Aucune panne signalée en attente sur ce véhicule.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {proposables.map((s) => {
                    const coche = inclus.includes(s.numero);
                    return (
                      <li key={s.numero}>
                        <label className={`flex cursor-pointer items-start gap-3 rounded-[10px] border px-3 py-2 ${coche ? "border-accent bg-accent-fond" : "border-bordure hover:bg-surface-2"}`}>
                          <input type="checkbox" checked={coche} onChange={() => setInclus((x) => (coche ? x.filter((n) => n !== s.numero) : [...x, s.numero]))} className="mt-1" />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{s.description}</span>
                              <Echeance ton={PRIORITE_SIGNALEMENT[s.priorite].ton}>{PRIORITE_SIGNALEMENT[s.priorite].libelle}</Echeance>
                              <Echeance ton={ETAT_SIGNALEMENT[etatSignalement(s, demande.services ?? [])].ton}>{ETAT_SIGNALEMENT[etatSignalement(s, demande.services ?? [])].libelle}</Echeance>
                            </span>
                            <span className="meta block">
                              <Numero valeur={s.numero} /> · signalé le {formaterDate(s.date)}
                              {s.details ? ` · ${s.details}` : ""}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* ---- Les lignes ---- */}
              <div className="mt-6 mb-2 flex items-center gap-3 border-b border-bordure pb-1.5">
                <h3 className="titre-bloc flex-1 text-[13px]">Les lignes — tâches, main-d&apos;œuvre, pièces</h3>
                <button type="button" onClick={() => setLignes((ls) => [...ls, ligneVide()])} className="bouton-discret h-8 px-2 text-[12px]">
                  <Plus className="size-3.5" strokeWidth={2} />
                  Ajouter une tâche
                </button>
              </div>
              <div className="hidden grid-cols-[minmax(0,1fr)_120px_120px_170px_120px_36px] gap-2 px-2 pb-1 text-[11.5px] font-medium text-texte-2 lg:grid">
                <span>Tâche du catalogue</span>
                <span className="text-right">Main-d&apos;œuvre</span>
                <span className="text-right">Pièces achetées</span>
                <span className="text-right">Remise</span>
                <span className="text-right">Sous-total HT</span>
                <span />
              </div>
              <ul className="flex flex-col gap-2">
                {lignes.map((l, i) => {
                  const c = totaux.lignes[i]!;
                  const nouvelle = Boolean(l.libelle.trim()) && !l.tacheNumero && !tacheParLibelle(taches, l.libelle);
                  return (
                    <li key={l.cle} className={`rounded-[10px] border p-2 ${tentee && !l.libelle.trim() && (l.mainOeuvre || l.piecesAchetees) ? "border-defavorable" : "border-bordure"}`}>
                      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-[minmax(0,1fr)_120px_120px_170px_120px_36px]">
                        <div className="min-w-0">
                          <ChampCombo
                            valeur={l.libelle}
                            onChange={(v) => choisirTache(i, v)}
                            options={taches.map((t) => ({ valeur: t.libelle, libelle: t.libelle, precision: precisionTache(t) }))}
                            creation
                            placeholder="Choisir une tâche, ou l'écrire pour la créer"
                          />
                          {nouvelle ? (
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="meta shrink-0">Nouvelle tâche — son système :</span>
                              <ChampSaisie champ={{ cle: "systeme", libelle: "Système", type: "choix", options: optionsSystemes() }} valeur={l.systeme ?? ""} saisie={{}} onChange={(v) => changerLigne(i, { systeme: String(v) || null })} />
                            </div>
                          ) : l.tacheNumero ? (
                            <span className="meta mt-1 block">{precisionTache(taches.find((t) => t.numero === l.tacheNumero) ?? { categorie: null, systeme: l.systeme })}</span>
                          ) : null}
                          {l.libelle.trim() ? (
                            <input
                              aria-label="Précision sur la tâche"
                              value={l.precision ?? ""}
                              onChange={(e) => changerLigne(i, { precision: e.target.value })}
                              placeholder="Précision libre — côté, pièce, constat…"
                              className="mt-1.5 h-8 w-full rounded-[8px] border border-bordure-champ bg-surface px-2.5 text-[12.5px] outline-none focus:border-accent"
                            />
                          ) : null}
                        </div>
                        <EntreeMontant etiquette="Main-d'œuvre" valeur={l.mainOeuvre} onChange={(n) => changerLigne(i, { mainOeuvre: n })} />
                        <EntreeMontant etiquette="Pièces achetées" valeur={l.piecesAchetees} onChange={(n) => changerLigne(i, { piecesAchetees: n })} />
                        <span className="flex items-center gap-1">
                          <EntreeMontant etiquette="Remise de la ligne" valeur={l.remiseValeur} unite={l.remiseMode === "montant" ? "F" : "%"} onChange={(n) => changerLigne(i, { remiseValeur: n })} />
                          <ModeRemiseBascule mode={l.remiseMode} onChange={(m) => changerLigne(i, { remiseMode: m })} />
                        </span>
                        <span className="code flex h-9 items-center justify-end text-[13px] font-medium">{montant(c.netHT)}</span>
                        <button type="button" onClick={() => setLignes((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [ligneVide()]))} className="grid size-9 place-items-center rounded-[10px] text-attenue hover:bg-surface-3 hover:text-defavorable" aria-label="Retirer cette ligne" title="Retirer cette ligne">
                          <Trash2 className="size-4" strokeWidth={1.7} />
                        </button>
                      </div>

                      {/* Les pièces prises au magasin : hors facture, au prix de référence. */}
                      <div className="mt-2 rounded-[8px] bg-surface-2 px-2 py-1.5">
                        {l.piecesStock.map((p, k) => (
                          <div key={k} className="flex flex-wrap items-center gap-2 py-0.5 text-[12.5px]">
                            <Package className="size-3.5 text-attenue" strokeWidth={1.8} />
                            <span className="min-w-0 flex-1 truncate">{p.designation}</span>
                            <span className="meta">
                              {montant(p.prixUnitaire)} l&apos;unité
                              {(() => {
                                const dispo = stock?.find((x) => x.numero === p.pieceNumero)?.stock;
                                return dispo !== undefined ? ` · ${dispo} en stock` : "";
                              })()}
                            </span>
                            <EntreeMontant etiquette="Quantité" valeur={p.quantite} unite="×" onChange={(n) => changerLigne(i, { piecesStock: l.piecesStock.map((x, m) => (m === k ? { ...x, quantite: n } : x)) })} />
                            <span className="code w-[100px] text-right">{montant(Math.round(p.quantite * p.prixUnitaire))}</span>
                            <button type="button" onClick={() => changerLigne(i, { piecesStock: l.piecesStock.filter((_, m) => m !== k) })} className="grid size-7 place-items-center rounded-full text-attenue hover:text-defavorable" aria-label="Retirer cette pièce">
                              <Trash2 className="size-3.5" strokeWidth={1.7} />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <span className="meta shrink-0">Pièce du magasin :</span>
                          <div className="min-w-0 flex-1">
                            <ChampCombo
                              valeur=""
                              onChange={(numero) => {
                                const p = stock?.find((x) => x.numero === numero);
                                if (!p) return;
                                changerLigne(i, { piecesStock: [...l.piecesStock, { pieceNumero: p.numero, designation: `${p.designation} (${p.reference})`, quantite: 1, prixUnitaire: p.prix ?? 0 }] });
                              }}
                              options={(stock ?? []).map((p) => ({ valeur: p.numero, libelle: `${p.designation} · ${p.reference}`, precision: `${p.stock} en stock · ${p.prix === null ? "prix inconnu" : montant(p.prix)}` }))}
                              placeholder={stock === null ? "Lecture du magasin…" : stock.length ? "Prendre une pièce au magasin" : "Aucune pièce au magasin"}
                              vide="Aucune pièce ne correspond"
                            />
                          </div>
                          {c.stock ? <span className="code w-[120px] text-right text-[12.5px]">{montant(c.stock)}</span> : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* ---- Les totaux, comme une facture ---- */}
              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 overflow-hidden rounded-[12px] border border-bordure">
                    {[
                      ["Main-d'œuvre", totaux.mainOeuvre],
                      ["Pièces", totaux.piecesAchetees + totaux.stock],
                      ["Coût du service", totaux.coutTotal],
                    ].map(([l, v], k) => (
                      <div key={String(l)} className={`px-4 py-3 ${k ? "border-l border-bordure" : ""}`}>
                        <p className="meta">{l}</p>
                        <p className="code mt-1 text-[18px] font-semibold">{montant(Number(v))}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="label-champ">Photos et documents — avant et après, devis, facture</span>
                    <ChampPieces valeur={pieces} onChange={setPieces} separer />
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="label-champ">Commentaire</span>
                    <textarea value={String(entete.commentaire ?? "")} onChange={(e) => setEntete((x) => ({ ...x, commentaire: e.target.value }))} rows={2} className="w-full resize-none rounded-[10px] border border-bordure-champ bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent" />
                  </label>
                </div>

                <dl className="flex flex-col gap-2 rounded-[12px] border border-bordure p-4 text-[13px]">
                  <div className="flex items-center justify-between gap-2 text-texte-2">
                    <dt title="La main-d'œuvre facturée d'un seul montant, sans ventilation par tâche">Main-d&apos;œuvre globale</dt>
                    <dd>
                      <EntreeMontant etiquette="Main-d'œuvre globale" valeur={mainOeuvreGlobale} onChange={setMainOeuvreGlobale} />
                    </dd>
                  </div>
                  <Ligne libelle="Main-d'œuvre — total" valeur={totaux.mainOeuvre} />
                  <Ligne libelle="Pièces achetées" valeur={totaux.piecesAchetees} />
                  {totaux.remisesLignes ? <Ligne libelle="Remises des lignes" valeur={-totaux.remisesLignes} /> : null}
                  <Ligne libelle="Sous-total HT" valeur={totaux.sousTotalHT} fort />
                  <div className="flex items-center justify-between gap-2">
                    <dt className="flex items-center gap-1.5">
                      Remise globale
                      <ModeRemiseBascule mode={remiseMode} onChange={setRemiseMode} />
                    </dt>
                    <dd className="flex items-center gap-2">
                      <EntreeMontant etiquette="Remise globale" valeur={remiseValeur} unite={remiseMode === "montant" ? "F" : "%"} onChange={setRemiseValeur} />
                    </dd>
                  </div>
                  <Ligne libelle="Total HT" valeur={totaux.totalHT} fort />
                  <Taux libelle="TVA" taux={tvaTaux} parDefaut={TAUX_TVA} onChange={setTvaTaux} valeur={totaux.tva} />
                  <Ligne libelle="Total TTC" valeur={totaux.totalTTC} fort />
                  <Taux libelle="BRS — retenue à la source" taux={brsTaux} parDefaut={TAUX_BRS} onChange={setBrsTaux} valeur={-totaux.brs} />
                  <Ligne libelle="Net à payer au prestataire" valeur={totaux.netAPayer} fort />
                  {totaux.stock ? <Ligne libelle="Pièces du magasin (hors facture)" valeur={totaux.stock} /> : null}
                  <div className="mt-1 flex items-center justify-between border-t border-bordure pt-2 text-[14px] font-semibold">
                    <dt>Coût du service</dt>
                    <dd className="code">{montant(totaux.coutTotal)}</dd>
                  </div>
                  <p className="meta">Le coût porte le TTC : la BRS est payée aussi, à l&apos;État.</p>
                </dl>
              </div>
            </fieldset>
          </div>

          {/* ---- Pied ---- */}
          <div className="flex flex-wrap items-center gap-3 border-t border-bordure px-6 py-4">
            <div className="meta min-w-0 flex-1">
              {fait ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-favorable">
                  <Check className="size-4" strokeWidth={2.2} />
                  Enregistré : {fait}
                </span>
              ) : erreur ? (
                <span className="text-defavorable">{erreur}</span>
              ) : existant && !clos && !peutClore ? (
                "Seul le responsable du parc clôt un service."
              ) : (
                "La clôture écrit l'intervention, les dépenses et les sorties de stock, et résout les pannes incluses."
              )}
            </div>
            <button type="button" onClick={onFermer} className="bouton-secondaire">
              {clos ? "Fermer" : "Annuler"}
            </button>
            {!clos ? (
              <button type="button" onClick={enregistrerEtFermer} disabled={Boolean(fait)} className={peutClore ? "bouton-secondaire" : "bouton-principal"}>
                Enregistrer
              </button>
            ) : null}
            {peutClore ? (
              <button type="button" onClick={clore} disabled={Boolean(fait)} className="bouton-principal" title="Écrit l'intervention, les dépenses et les sorties de stock">
                <Wrench className="size-4" strokeWidth={2} />
                Clôturer le service
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function Ligne({ libelle, valeur, fort = false }: { libelle: string; valeur: number; fort?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 ${fort ? "font-semibold" : "text-texte-2"}`}>
      <dt>{libelle}</dt>
      <dd className="code">{montant(valeur)}</dd>
    </div>
  );
}

function Taux({ libelle, taux, parDefaut, onChange, valeur }: { libelle: string; taux: number; parDefaut: number; onChange: (n: number) => void; valeur: number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-texte-2">
      <dt className="flex items-center gap-2">
        <input type="checkbox" checked={taux > 0} onChange={(e) => onChange(e.target.checked ? parDefaut : 0)} aria-label={`Appliquer ${libelle}`} />
        {libelle}
        {taux > 0 ? <EntreeMontant etiquette={`Taux de ${libelle}`} valeur={taux} unite="%" onChange={onChange} /> : null}
      </dt>
      <dd className="code">{montant(valeur)}</dd>
    </div>
  );
}
