"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Lock, Plus, Trash2, X } from "lucide-react";
import { Numero } from "@/composants/interface/Numero";
import { CHAMPS } from "@/composants/transactions/champs";
import { type ChampEdition } from "@/domaine/cloture";
import { BLESSES, ROULANT, TYPES_PAR_NATURE, destinatairesDeclaration, motifDeclaration, statutPropose, type Blesses, type Roulant, type SanctionSuite, type TiersIncident } from "@/domaine/incidents";
import { MISSION_INCIDENT, NATURE_INCIDENT, RESPONSABILITE, STATUT_VEHICULE, TYPE_INCIDENT } from "@/domaine/libelles";
import { controlerReleves } from "@/domaine/releves";
import { trouverRole } from "@/domaine/roles";
import type { MissionIncident, NatureIncident, Responsabilite, StatutVehicule, TypeIncident } from "@/domaine/types";
import { listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { fichePourImmatriculation } from "@/donnees/fiche-demo";
import { FLOTTE, SITES } from "@/donnees/parc-demo";
import { enregistrerCreation } from "@/lib/clotures-demo";
import { date as formaterDate, montant } from "@/lib/format";
import { ajouterNotification } from "@/lib/notifications-demo";
import { lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Déclaration d'un accident ou d'un incident — le formulaire en quatre étapes
 * du cadrage (`docs/CADRAGE-INCIDENTS.md` §3).
 *
 *  1. Les faits — véhicule, nature, type, date, lieu, conducteur, compteur.
 *  2. Conséquences sur le véhicule — roule-t-il, nouveau statut, dépannage.
 *  3. Tiers et responsabilité — accident seulement.
 *  4. Suites — assureur, franchise, sanction, actions correctives.
 *
 * À la validation, une seule saisie produit plusieurs transactions, chacune
 * avec sa référence et sa trace : la déclaration (INC), la période de statut
 * (STA) si le véhicule change d'état, le relevé (REL) — signalé s'il est
 * incohérent avec le dernier connu —, la dépense de dépannage (DEP), la
 * sanction du conducteur (SAN). Et les personnes à prévenir le sont.
 * ==========================================================================*/

const COMMUN = "h-9 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent disabled:bg-surface-2 disabled:text-texte-2";

interface Saisie {
  vehiculeId: string;
  nature: NatureIncident;
  type: TypeIncident | "";
  dateJour: string;
  heure: string;
  lieu: string;
  siteId: string;
  chauffeurId: string;
  kilometrage: string;
  mission: MissionIncident | "";
  description: string;
  roulant: Roulant;
  nouveauStatut: StatutVehicule;
  depannage: boolean;
  prestataire: string;
  coutDepannage: string;
  garage: string;
  retourPrevu: string;
  tiers: TiersIncident[];
  constat: boolean;
  police: boolean;
  numeroPv: string;
  blesses: Blesses;
  gravite: string;
  responsabilite: Responsabilite | "";
  temoins: string;
  assureur: "" | "oui" | "non";
  numeroPolice: string;
  franchise: string;
  sanction: SanctionSuite;
  actionsCorrectives: string;
}

/** Les champs tels que la trace les nomme (historique de la transaction). */
const CHAMPS_DECLARATION: ChampEdition[] = [
  { cle: "vehiculeId", libelle: "Véhicule", type: "texte" },
  { cle: "nature", libelle: "Nature", type: "choix", options: Object.entries(NATURE_INCIDENT).map(([valeur, libelle]) => ({ valeur, libelle })) },
  { cle: "type", libelle: "Type", type: "choix", options: Object.entries(TYPE_INCIDENT).map(([valeur, libelle]) => ({ valeur, libelle })) },
  { cle: "dateHeure", libelle: "Date et heure", type: "texte" },
  { cle: "lieu", libelle: "Lieu", type: "texte" },
  { cle: "chauffeur", libelle: "Conducteur", type: "texte" },
  { cle: "kilometrage", libelle: "Compteur", type: "nombre", unite: "km" },
  { cle: "mission", libelle: "Mission", type: "choix", options: Object.entries(MISSION_INCIDENT).map(([valeur, libelle]) => ({ valeur, libelle })) },
  { cle: "description", libelle: "Description", type: "texte-long" },
  { cle: "roulant", libelle: "Véhicule roulant", type: "choix", options: Object.entries(ROULANT).map(([valeur, libelle]) => ({ valeur, libelle })) },
  { cle: "nouveauStatut", libelle: "Nouveau statut", type: "choix", options: Object.entries(STATUT_VEHICULE).map(([valeur, d]) => ({ valeur, libelle: d.libelle })) },
  { cle: "prestataire", libelle: "Dépannage", type: "texte" },
  { cle: "garage", libelle: "Garage", type: "texte" },
  { cle: "retourPrevu", libelle: "Retour prévu", type: "date" },
  { cle: "tiersResume", libelle: "Tiers", type: "texte" },
  { cle: "numeroPv", libelle: "N° de PV", type: "texte" },
  { cle: "blesses", libelle: "Blessés", type: "choix", options: Object.entries(BLESSES).map(([valeur, libelle]) => ({ valeur, libelle })) },
  { cle: "responsabilite", libelle: "Responsabilité présumée", type: "choix", options: Object.entries(RESPONSABILITE).map(([valeur, libelle]) => ({ valeur, libelle })) },
  { cle: "numeroPolice", libelle: "N° de police", type: "texte" },
  { cle: "franchise", libelle: "Franchise attendue", type: "nombre", unite: "F" },
  { cle: "sanction", libelle: "Sanction", type: "texte" },
  { cle: "actionsCorrectives", libelle: "Actions correctives", type: "texte-long" },
];

const ETAPES = [
  { n: 1, libelle: "Les faits" },
  { n: 2, libelle: "Conséquences" },
  { n: 3, libelle: "Tiers et responsabilité" },
  { n: 4, libelle: "Suites" },
] as const;

type Resultat = { numero: string; suites: string[] } | { erreur: string };

export function FormulaireDeclaration({ vehiculeId, aujourdhui, onFermer, onEnregistre }: { vehiculeId?: string; aujourdhui: string; onFermer: () => void; onEnregistre: (numero: string) => void }) {
  const role = useMemo(() => trouverRole(lireRole()), []);
  const chauffeurs = useMemo(() => listeChauffeurs().filter((c) => c.chauffeur.actif), []);
  const vehicules = useMemo(() => FLOTTE.filter((l) => l.vehicule.engage || l.vehicule.id === vehiculeId), [vehiculeId]);

  const [s, setS] = useState<Saisie>(() => {
    const l = FLOTTE.find((x) => x.vehicule.id === vehiculeId);
    return {
      vehiculeId: vehiculeId ?? "",
      nature: "incident",
      type: "",
      dateJour: aujourdhui,
      heure: "08:00",
      lieu: "",
      siteId: l?.site?.id ?? "",
      chauffeurId: l?.chauffeurTitulaire?.id ?? "non-affecte",
      kilometrage: "",
      mission: "livraison",
      description: "",
      roulant: "oui",
      nouveauStatut: l?.vehicule.statut ?? "en-service",
      depannage: false,
      prestataire: "",
      coutDepannage: "",
      garage: "",
      retourPrevu: "",
      tiers: [],
      constat: false,
      police: false,
      numeroPv: "",
      blesses: "aucun",
      gravite: "",
      responsabilite: "",
      temoins: "",
      assureur: "",
      numeroPolice: "",
      franchise: "",
      sanction: "aucune",
      actionsCorrectives: "",
    };
  });
  const [etape, setEtape] = useState<1 | 2 | 3 | 4>(1);
  const [resultat, setResultat] = useState<Resultat | null>(null);

  const regler = <K extends keyof Saisie>(cle: K, valeur: Saisie[K]) => setS((prev) => ({ ...prev, [cle]: valeur }));

  const ligne = FLOTTE.find((x) => x.vehicule.id === s.vehiculeId) ?? null;
  const accident = s.nature === "accident";
  const ordre: (1 | 2 | 3 | 4)[] = accident ? [1, 2, 3, 4] : [1, 2, 4];

  /* Quand le véhicule change : le site, le titulaire et le statut suivent. */
  useEffect(() => {
    if (!ligne) return;
    setS((prev) => ({
      ...prev,
      siteId: prev.siteId || (ligne.site?.id ?? ""),
      chauffeurId: prev.chauffeurId === "non-affecte" && ligne.chauffeurTitulaire ? ligne.chauffeurTitulaire.id : prev.chauffeurId,
      nouveauStatut: statutPropose(prev.roulant, ligne.vehicule.statut),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.vehiculeId]);

  /* Le type dépend de la nature ; la nature change, le type se réinitialise. */
  useEffect(() => {
    setS((prev) => (prev.type && !TYPES_PAR_NATURE[prev.nature].includes(prev.type) ? { ...prev, type: "" } : prev));
  }, [s.nature]);

  /* Le statut proposé suit « roulant » (cadrage, étape 2) tant qu'on ne l'a pas forcé. */
  useEffect(() => {
    if (ligne) setS((prev) => ({ ...prev, nouveauStatut: statutPropose(prev.roulant, ligne.vehicule.statut) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.roulant]);

  /* Le numéro de police vient du document « Assurance » du véhicule. */
  useEffect(() => {
    if (!ligne || s.numeroPolice) return;
    const f = fichePourImmatriculation(ligne.vehicule.immatriculation);
    const police = f?.documents.find((d) => d.type === "assurance" && d.etat !== "manquant")?.numeroPiece ?? "";
    if (police) setS((prev) => ({ ...prev, numeroPolice: prev.numeroPolice || police }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.vehiculeId]);

  useEffect(() => {
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("keydown", surEchap);
    return () => document.removeEventListener("keydown", surEchap);
  }, [onFermer]);

  /* ---- Contrôles ---- */
  const dateHeure = s.dateJour && s.heure ? `${s.dateJour}T${s.heure}:00` : "";
  const dansLeFutur = dateHeure !== "" && new Date(dateHeure).getTime() > Date.now();
  const km = Number(s.kilometrage.replace(/\s/g, ""));
  const verdictKm = useMemo(() => {
    if (!ligne || !s.kilometrage || !Number.isFinite(km) || !s.dateJour) return null;
    const releves = [{ date: s.dateJour, valeur: km }];
    if (ligne.kilometrage !== null && ligne.dateKilometrage) releves.push({ date: ligne.dateKilometrage, valeur: ligne.kilometrage });
    return controlerReleves(releves, ligne.vehicule.categorie)[0] ?? null;
  }, [ligne, s.kilometrage, s.dateJour, km]);

  const manquants: Record<1 | 2 | 3 | 4, string[]> = {
    1: [
      !s.vehiculeId ? "véhicule" : "",
      !s.type ? "type" : "",
      !s.dateJour || !s.heure ? "date et heure" : "",
      dansLeFutur ? "une date qui n'est pas dans le futur" : "",
      !s.lieu.trim() ? "lieu" : "",
      !s.chauffeurId ? "conducteur" : "",
      !s.kilometrage || !Number.isFinite(km) || km <= 0 ? "kilométrage au compteur" : "",
      !s.description.trim() ? "description" : "",
    ].filter(Boolean),
    2: [s.depannage && !s.prestataire.trim() ? "prestataire de dépannage" : ""].filter(Boolean),
    3: [],
    4: [accident && !s.assureur ? "déclaration à l'assureur" : ""].filter(Boolean),
  };
  const etapeValide = manquants[etape].length === 0;
  const indice = ordre.indexOf(etape);
  const derniere = indice === ordre.length - 1;

  function suivante() {
    if (!etapeValide || derniere) return;
    setEtape(ordre[indice + 1]!);
  }
  function precedente() {
    if (indice === 0) return;
    setEtape(ordre[indice - 1]!);
  }

  /* ---- Validation : une saisie, plusieurs transactions ---- */
  function declarer() {
    if (!ligne || !etapeValide) return;
    const chauffeur = chauffeurs.find((c) => c.id === s.chauffeurId) ?? null;
    const tiersResume = s.tiers.map((t) => [t.nom, t.immatriculation, t.assureur].filter(Boolean).join(" · ")).join(" ; ");
    const valeurs: Record<string, unknown> = {
      vehiculeId: ligne.vehicule.id,
      nature: s.nature,
      type: s.type,
      dateHeure,
      lieu: s.lieu.trim(),
      siteId: s.siteId || null,
      chauffeurId: chauffeur?.id ?? null,
      chauffeur: chauffeur?.nomComplet ?? "Non affecté",
      kilometrage: km,
      mission: s.mission || null,
      description: s.description.trim(),
      roulant: s.roulant,
      nouveauStatut: s.nouveauStatut,
      depannage: s.depannage,
      prestataire: s.depannage ? s.prestataire.trim() : null,
      coutDepannage: s.depannage && s.coutDepannage ? Number(s.coutDepannage.replace(/\s/g, "")) : null,
      garage: s.garage.trim() || null,
      retourPrevu: s.retourPrevu || null,
      tiers: accident ? s.tiers : [],
      tiersResume: accident && tiersResume ? tiersResume : null,
      constat: accident ? s.constat : false,
      police: accident ? s.police : false,
      numeroPv: accident && s.police ? s.numeroPv.trim() || null : null,
      blesses: accident ? s.blesses : "aucun",
      gravite: accident && s.blesses !== "aucun" ? s.gravite.trim() || null : null,
      responsabilite: accident ? s.responsabilite || null : null,
      temoins: accident ? s.temoins.trim() || null : null,
      sinistreOuvert: accident && s.assureur === "oui",
      numeroPolice: accident && s.assureur === "oui" ? s.numeroPolice.trim() || null : null,
      franchise: s.franchise ? Number(s.franchise.replace(/\s/g, "")) : null,
      sanction: s.sanction === "aucune" ? null : s.sanction,
      actionsCorrectives: s.actionsCorrectives.trim() || null,
      statut: "declare",
      declarant: role.nom,
      kmMotifRejet: verdictKm && !verdictKm.valide ? verdictKm.motifRejet : null,
    };
    const sujet = `vehicule:${ligne.vehicule.id}`;
    const r = enregistrerCreation({ sujet, type: "incident", champs: CHAMPS_DECLARATION, valeurs, motif: "" });
    if (r.issue === "mois-clos") {
      setResultat({ erreur: `Le mois ${r.mois} est clos : changez la date, ou demandez la réouverture à la direction.` });
      return;
    }
    if (r.issue !== "creee") {
      setResultat({ erreur: "La date est obligatoire." });
      return;
    }
    const numero = r.creation.numero;
    const suites: string[] = [];
    const jour = s.dateJour;

    /* Période de statut : le véhicule change d'état à l'instant de la déclaration. */
    if (s.nouveauStatut !== ligne.vehicule.statut) {
      const st = enregistrerCreation({ sujet, type: "statut", champs: CHAMPS.statut, valeurs: { statut: s.nouveauStatut, motif: motifDeclaration(s.nature), debut: jour, commentaire: `Déclaration ${numero}` }, motif: `Déclaration ${numero}` });
      if (st.issue === "creee") suites.push(`Statut passé à « ${STATUT_VEHICULE[s.nouveauStatut].libelle} » (${st.creation.numero})`);
    }
    /* Relevé : enregistré, ou écarté avec le motif du contrôle. */
    const rel = enregistrerCreation({ sujet, type: "releve", champs: CHAMPS.releve, valeurs: { date: jour, valeur: km, source: `Déclaration ${numero}`, motifRejet: verdictKm && !verdictKm.valide ? verdictKm.motifRejet : null }, motif: `Déclaration ${numero}` });
    if (rel.issue === "creee") suites.push(verdictKm && !verdictKm.valide ? `Relevé ${rel.creation.numero} enregistré, signalé incohérent (${verdictKm.motifRejet})` : `Relevé ${rel.creation.numero} enregistré`);
    /* Dépannage : une dépense rattachée au véhicule. */
    if (s.depannage && valeurs.coutDepannage) {
      const dep = enregistrerCreation({ sujet, type: "depense", champs: CHAMPS.depense, valeurs: { date: jour, poste: "divers", origine: "facture", libelle: `Dépannage — ${s.prestataire.trim()}`, montant: valeurs.coutDepannage, beneficiaire: s.prestataire.trim(), reference: numero, km, justificatif: false }, motif: `Déclaration ${numero}` });
      if (dep.issue === "creee") suites.push(`Dépense de dépannage ${dep.creation.numero} (${montant(valeurs.coutDepannage as number)})`);
    }
    /* Sanction : sur la fiche du conducteur, une trace. */
    if (s.sanction !== "aucune" && chauffeur) {
      const san = enregistrerCreation({ sujet: `chauffeur:${chauffeur.id}`, type: "sanction", champs: CHAMPS.sanction, valeurs: { date: jour, type: s.sanction, jours: null, motif: `${NATURE_INCIDENT[s.nature]} du ${formaterDate(jour)} — ${numero}` }, motif: `Déclaration ${numero}` });
      if (san.issue === "creee") suites.push(`${s.sanction === "blame" ? "Blâme" : "Avertissement"} ${san.creation.numero} sur la fiche de ${chauffeur.nomComplet}`);
    }
    /* Les personnes à prévenir. */
    const maintenant = new Date().toISOString();
    const destinataires = destinatairesDeclaration(s.nature, s.blesses !== "aucun", s.tiers.length > 0).filter((d) => d !== role.role);
    for (const d of destinataires) {
      ajouterNotification(d, {
        id: `${numero}-${d}`,
        date: maintenant,
        auteur: role.nom,
        initiales: role.initiales,
        sujetLibelle: ligne.vehicule.immatriculationAffichee,
        extrait: `${NATURE_INCIDENT[s.nature]} déclaré (${numero}) — ${TYPE_INCIDENT[s.type as TypeIncident].toLowerCase()}, ${s.lieu.trim()}${s.roulant === "non" ? ", véhicule immobilisé" : ""}.`,
        href: `/incidents?ref=${numero}`,
      });
    }
    if (destinataires.length) suites.push(`Prévenus : ${destinataires.map((d) => trouverRole(d).libelle.toLowerCase()).join(", ")}`);

    setResultat({ numero, suites });
    onEnregistre(numero);
  }

  const libelleEtape = (n: 1 | 2 | 3 | 4) => (n === 3 && !accident ? "Tiers — sans objet" : ETAPES[n - 1].libelle);

  return (
    <>
      <button type="button" aria-label="Fermer" onClick={onFermer} className="fixed inset-0 z-50 cursor-default bg-encre/30" />
      <div role="dialog" aria-modal="true" aria-label="Déclarer un accident ou un incident" className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="pointer-events-auto flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[16px] border border-bordure bg-surface shadow-modale" style={{ animation: "apparition 160ms ease-out" }}>
          {/* ---- En-tête et frise ---- */}
          <div className="border-b border-bordure px-6 pt-4 pb-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="micro-sur-titre">Déclaration · {NATURE_INCIDENT[s.nature].toLowerCase()}</p>
                <h2 className="titre-bloc mt-0.5 truncate">
                  {ligne ? `${ligne.vehicule.immatriculationAffichee} · ${ligne.vehicule.marque} ${ligne.vehicule.appellation}` : "Déclarer un accident ou un incident"}
                </h2>
                <p className="mt-1">{resultat && "numero" in resultat ? <Numero valeur={resultat.numero} /> : <span className="meta">Le numéro INC sera attribué à la déclaration.</span>}</p>
              </div>
              <button type="button" onClick={onFermer} className="grid size-8 shrink-0 place-items-center rounded-full text-texte-2 hover:bg-surface-3 hover:text-texte">
                <X className="size-4" strokeWidth={1.8} />
                <span className="sr-only">Fermer</span>
              </button>
            </div>
            <ol className="mt-4 flex items-center gap-2">
              {ETAPES.map((e, i) => {
                const sansObjet = e.n === 3 && !accident;
                const faite = ordre.indexOf(e.n) !== -1 && ordre.indexOf(e.n) < indice;
                const active = e.n === etape;
                return (
                  <li key={e.n} className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      type="button"
                      disabled={sansObjet || resultat !== null}
                      onClick={() => (faite || active ? setEtape(e.n) : null)}
                      className={`flex min-w-0 items-center gap-2 text-left ${faite ? "cursor-pointer" : "cursor-default"}`}
                      aria-current={active ? "step" : undefined}
                    >
                      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${active ? "bg-accent text-white" : faite ? "bg-accent-fond text-accent-tres-fonce" : "bg-surface-3 text-attenue"}`}>{faite ? <Check className="size-3.5" strokeWidth={2.5} /> : e.n}</span>
                      <span className={`truncate text-[12.5px] ${active ? "font-semibold text-texte" : sansObjet ? "text-attenue-2" : "text-texte-2"}`}>{libelleEtape(e.n)}</span>
                    </button>
                    {i < ETAPES.length - 1 ? <span className="h-px min-w-3 flex-1 bg-bordure" /> : null}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* ---- Corps ---- */}
          <div className="defilement-discret min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {resultat && "numero" in resultat ? (
              <div className="rounded-[12px] bg-favorable-fond px-5 py-4">
                <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-favorable">
                  <Check className="size-4" strokeWidth={2.4} />
                  Déclaration enregistrée sous le numéro {resultat.numero}.
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-[13px] text-texte">
                  {resultat.suites.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                      {x}
                    </li>
                  ))}
                  <li className="flex items-start gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    Une entrée au journal du véhicule ; la déclaration est « Déclaré », à qualifier par le gestionnaire de parc.
                  </li>
                </ul>
              </div>
            ) : null}
            {resultat && "erreur" in resultat ? (
              <div className="mb-5 flex items-start gap-3 rounded-[10px] bg-defavorable-fond px-4 py-3">
                <Lock className="mt-0.5 size-4 shrink-0 text-defavorable" strokeWidth={1.9} />
                <p className="text-[13px] leading-relaxed text-texte">{resultat.erreur}</p>
              </div>
            ) : null}

            {!(resultat && "numero" in resultat) ? (
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                {/* ================= Étape 1 — Les faits ================= */}
                {etape === 1 ? (
                  <>
                    <Champ libelle="Véhicule" obligatoire>
                      <select value={s.vehiculeId} disabled={Boolean(vehiculeId)} onChange={(e) => regler("vehiculeId", e.target.value)} className={COMMUN}>
                        <option value="">—</option>
                        {vehicules.map((l) => (
                          <option key={l.vehicule.id} value={l.vehicule.id}>
                            {l.vehicule.immatriculationAffichee} · {l.vehicule.marque} {l.vehicule.appellation}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ libelle="Nature" obligatoire>
                      <div className="flex h-9 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Nature">
                        {(Object.keys(NATURE_INCIDENT) as NatureIncident[]).map((n) => (
                          <button key={n} type="button" aria-pressed={s.nature === n} onClick={() => regler("nature", n)} className={`h-7 flex-1 rounded-full px-3 text-[12.5px] whitespace-nowrap transition-colors ${s.nature === n ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}>
                            {NATURE_INCIDENT[n]}
                          </button>
                        ))}
                      </div>
                    </Champ>
                    <Champ libelle="Type" obligatoire>
                      <select value={s.type} onChange={(e) => regler("type", e.target.value as TypeIncident)} className={COMMUN}>
                        <option value="">—</option>
                        {TYPES_PAR_NATURE[s.nature].map((t) => (
                          <option key={t} value={t}>
                            {TYPE_INCIDENT[t]}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ libelle="Date et heure" obligatoire precision={dansLeFutur ? "Ne peut pas être dans le futur" : undefined} defavorable={dansLeFutur}>
                      <span className="flex gap-2">
                        <input type="date" value={s.dateJour} max={new Date().toISOString().slice(0, 10)} onChange={(e) => regler("dateJour", e.target.value)} className={COMMUN} />
                        <input type="time" value={s.heure} onChange={(e) => regler("heure", e.target.value)} className={`${COMMUN} w-[120px]`} />
                      </span>
                    </Champ>
                    <Champ libelle="Lieu" obligatoire>
                      <input type="text" value={s.lieu} onChange={(e) => regler("lieu", e.target.value)} placeholder="Route, carrefour, quai…" className={COMMUN} />
                    </Champ>
                    <Champ libelle="Site SEDIMA le plus proche">
                      <select value={s.siteId} onChange={(e) => regler("siteId", e.target.value)} className={COMMUN}>
                        <option value="">—</option>
                        {SITES.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.libelle}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ libelle="Conducteur au moment des faits" obligatoire precision={ligne?.chauffeurTitulaire ? `Titulaire : ${ligne.chauffeurTitulaire.nom}` : undefined}>
                      <select value={s.chauffeurId} onChange={(e) => regler("chauffeurId", e.target.value)} className={COMMUN}>
                        <option value="non-affecte">Non affecté / inconnu</option>
                        {chauffeurs.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nomComplet}
                            {ligne?.chauffeurTitulaire?.id === c.id ? " · titulaire" : ""}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ
                      libelle="Kilométrage au compteur"
                      obligatoire
                      precision={
                        verdictKm && !verdictKm.valide
                          ? `Relevé incohérent — ${verdictKm.motifRejet}. Il sera enregistré et signalé.`
                          : ligne?.kilometrage !== null && ligne?.kilometrage !== undefined
                            ? `Dernier relevé : ${ligne.kilometrage.toLocaleString("fr-FR")} km${ligne.dateKilometrage ? ` le ${formaterDate(ligne.dateKilometrage)}` : ""}`
                            : undefined
                      }
                      defavorable={Boolean(verdictKm && !verdictKm.valide)}
                    >
                      <span className="relative">
                        <input type="text" inputMode="numeric" value={s.kilometrage} onChange={(e) => regler("kilometrage", e.target.value)} className={`code ${COMMUN} pr-12 text-right`} />
                        <span className="meta pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">km</span>
                      </span>
                    </Champ>
                    <Champ libelle="Mission en cours" precision="Seules les pannes en mission comptent dans D_NPVEL">
                      <select value={s.mission} onChange={(e) => regler("mission", e.target.value as MissionIncident)} className={COMMUN}>
                        <option value="">—</option>
                        {(Object.keys(MISSION_INCIDENT) as MissionIncident[]).map((m) => (
                          <option key={m} value={m}>
                            {MISSION_INCIDENT[m]}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ libelle="Description" obligatoire large precision="Ce qui s'est passé, dans les mots du déclarant">
                      <textarea value={s.description} onChange={(e) => regler("description", e.target.value)} rows={3} className={`${COMMUN} h-auto resize-none py-2 leading-relaxed`} />
                    </Champ>
                    <p className="meta sm:col-span-2">Pièces jointes (photos, PDF) : au branchement de la base — lot 2 du cadrage.</p>
                  </>
                ) : null}

                {/* ================= Étape 2 — Conséquences ================= */}
                {etape === 2 ? (
                  <>
                    <Champ libelle="Le véhicule peut-il rouler ?" obligatoire>
                      <div className="flex h-9 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Véhicule roulant">
                        {(Object.keys(ROULANT) as Roulant[]).map((r) => (
                          <button key={r} type="button" aria-pressed={s.roulant === r} onClick={() => regler("roulant", r)} className={`h-7 flex-1 rounded-full px-3 text-[12.5px] whitespace-nowrap transition-colors ${s.roulant === r ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}>
                            {ROULANT[r]}
                          </button>
                        ))}
                      </div>
                    </Champ>
                    <Champ libelle="Nouveau statut" obligatoire precision={ligne ? `Aujourd'hui : ${STATUT_VEHICULE[ligne.vehicule.statut].libelle}${s.nouveauStatut !== ligne.vehicule.statut ? ` — ouvre une période « ${motifDeclaration(s.nature)} »` : " — inchangé"}` : undefined}>
                      <select value={s.nouveauStatut} onChange={(e) => regler("nouveauStatut", e.target.value as StatutVehicule)} className={COMMUN}>
                        {(Object.keys(STATUT_VEHICULE) as StatutVehicule[]).map((st) => (
                          <option key={st} value={st}>
                            {STATUT_VEHICULE[st].libelle}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ libelle="Dépannage ou remorquage">
                      <Interrupteur actif={s.depannage} onChange={(v) => regler("depannage", v)} libelle={s.depannage ? "Oui — une dépense sera rattachée au véhicule" : "Non"} />
                    </Champ>
                    {s.depannage ? (
                      <>
                        <Champ libelle="Prestataire" obligatoire>
                          <input type="text" value={s.prestataire} onChange={(e) => regler("prestataire", e.target.value)} className={COMMUN} />
                        </Champ>
                        <Champ libelle="Coût du dépannage">
                          <span className="relative">
                            <input type="text" inputMode="numeric" value={s.coutDepannage} onChange={(e) => regler("coutDepannage", e.target.value)} className={`code ${COMMUN} pr-10 text-right`} />
                            <span className="meta pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">F</span>
                          </span>
                        </Champ>
                      </>
                    ) : null}
                    <Champ libelle="Garage de destination">
                      <input type="text" value={s.garage} onChange={(e) => regler("garage", e.target.value)} placeholder="Atelier SEDIMA, garage agréé…" className={COMMUN} />
                    </Champ>
                    <Champ libelle="Retour prévu" precision="Sert à la disponibilité du jour">
                      <input type="date" value={s.retourPrevu} min={s.dateJour} onChange={(e) => regler("retourPrevu", e.target.value)} className={COMMUN} />
                    </Champ>
                  </>
                ) : null}

                {/* ================= Étape 3 — Tiers et responsabilité ================= */}
                {etape === 3 ? (
                  <>
                    <div className="sm:col-span-2">
                      <div className="flex items-center gap-3">
                        <span className="label-champ">Tiers impliqués</span>
                        <button type="button" onClick={() => regler("tiers", [...s.tiers, { nom: "", immatriculation: "", assureur: "", telephone: "" }])} className="bouton-discret ml-auto h-7 px-2 text-[12px]">
                          <Plus className="size-3.5" strokeWidth={2} />
                          Ajouter un tiers
                        </button>
                      </div>
                      {s.tiers.length === 0 ? (
                        <p className="meta mt-1.5">Aucun tiers — collision sans tiers, renversement, incendie…</p>
                      ) : (
                        <ul className="mt-2 flex flex-col gap-2">
                          {s.tiers.map((t, i) => (
                            <li key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-2 rounded-[10px] border border-bordure p-2">
                              {(["nom", "immatriculation", "assureur", "telephone"] as (keyof TiersIncident)[]).map((cle) => (
                                <input
                                  key={cle}
                                  type="text"
                                  value={t[cle]}
                                  placeholder={cle === "nom" ? "Nom" : cle === "immatriculation" ? "Immatriculation" : cle === "assureur" ? "Assureur" : "Téléphone"}
                                  onChange={(e) => regler("tiers", s.tiers.map((x, j) => (j === i ? { ...x, [cle]: e.target.value } : x)))}
                                  className={`${COMMUN} h-8 ${cle === "immatriculation" ? "code" : ""}`}
                                />
                              ))}
                              <button type="button" onClick={() => regler("tiers", s.tiers.filter((_, j) => j !== i))} className="bouton-discret text-attenue hover:text-defavorable" aria-label="Retirer ce tiers">
                                <Trash2 className="size-4" strokeWidth={1.7} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <Champ libelle="Constat amiable">
                      <Interrupteur actif={s.constat} onChange={(v) => regler("constat", v)} libelle={s.constat ? "Établi — pièce à joindre au branchement" : "Non"} />
                    </Champ>
                    <Champ libelle="Police ou gendarmerie">
                      <Interrupteur actif={s.police} onChange={(v) => regler("police", v)} libelle={s.police ? "Intervenue" : "Non"} />
                    </Champ>
                    {s.police ? (
                      <Champ libelle="N° de procès-verbal">
                        <input type="text" value={s.numeroPv} onChange={(e) => regler("numeroPv", e.target.value)} className={`code ${COMMUN}`} />
                      </Champ>
                    ) : null}
                    <Champ libelle="Blessés">
                      <select value={s.blesses} onChange={(e) => regler("blesses", e.target.value as Blesses)} className={COMMUN}>
                        {(Object.keys(BLESSES) as Blesses[]).map((b) => (
                          <option key={b} value={b}>
                            {BLESSES[b]}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    {s.blesses !== "aucun" ? (
                      <Champ libelle="Gravité">
                        <input type="text" value={s.gravite} onChange={(e) => regler("gravite", e.target.value)} placeholder="Léger, hospitalisation…" className={COMMUN} />
                      </Champ>
                    ) : null}
                    <Champ libelle="Responsabilité présumée">
                      <select value={s.responsabilite} onChange={(e) => regler("responsabilite", e.target.value as Responsabilite)} className={COMMUN}>
                        <option value="">—</option>
                        {(Object.keys(RESPONSABILITE) as Responsabilite[]).map((r) => (
                          <option key={r} value={r}>
                            {RESPONSABILITE[r]}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ libelle="Témoins" large>
                      <textarea value={s.temoins} onChange={(e) => regler("temoins", e.target.value)} rows={2} className={`${COMMUN} h-auto resize-none py-2 leading-relaxed`} />
                    </Champ>
                  </>
                ) : null}

                {/* ================= Étape 4 — Suites ================= */}
                {etape === 4 ? (
                  <>
                    {accident ? (
                      <>
                        <Champ libelle="Déclarer à l'assureur" obligatoire precision="Oui : ouvre un dossier sinistre">
                          <div className="flex h-9 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Déclarer à l'assureur">
                            {(["oui", "non"] as const).map((v) => (
                              <button key={v} type="button" aria-pressed={s.assureur === v} onClick={() => regler("assureur", v)} className={`h-7 flex-1 rounded-full px-3 text-[12.5px] transition-colors ${s.assureur === v ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}>
                                {v === "oui" ? "Oui" : "Non"}
                              </button>
                            ))}
                          </div>
                        </Champ>
                        {s.assureur === "oui" ? (
                          <Champ libelle="N° de police" precision="Pré-rempli depuis le document « Assurance » du véhicule">
                            <input type="text" value={s.numeroPolice} onChange={(e) => regler("numeroPolice", e.target.value)} className={`code ${COMMUN}`} />
                          </Champ>
                        ) : null}
                      </>
                    ) : null}
                    <Champ libelle="Franchise attendue">
                      <span className="relative">
                        <input type="text" inputMode="numeric" value={s.franchise} onChange={(e) => regler("franchise", e.target.value)} className={`code ${COMMUN} pr-10 text-right`} />
                        <span className="meta pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">F</span>
                      </span>
                    </Champ>
                    <Champ libelle="Sanction du conducteur" precision={s.chauffeurId === "non-affecte" ? "Aucun conducteur identifié" : "Tracée sur la fiche chauffeur ; la retenue est une donnée de paie"}>
                      <select value={s.sanction} disabled={s.chauffeurId === "non-affecte"} onChange={(e) => regler("sanction", e.target.value as SanctionSuite)} className={COMMUN}>
                        <option value="aucune">Aucune</option>
                        <option value="avertissement">Avertissement</option>
                        <option value="blame">Blâme</option>
                      </select>
                    </Champ>
                    <Champ libelle="Actions correctives" large precision="Rappel des consignes, contrôle du plan d'entretien…">
                      <textarea value={s.actionsCorrectives} onChange={(e) => regler("actionsCorrectives", e.target.value)} rows={3} className={`${COMMUN} h-auto resize-none py-2 leading-relaxed`} />
                    </Champ>
                    <div className="rounded-[12px] border border-bordure px-4 py-3 text-[12.5px] leading-relaxed text-texte-2 sm:col-span-2">
                      <p className="micro-sur-titre mb-1">À la validation</p>
                      <p>
                        Référence INC attribuée · entrée au journal de {ligne?.vehicule.immatriculationAffichee}
                        {ligne && s.nouveauStatut !== ligne.vehicule.statut ? ` · statut « ${STATUT_VEHICULE[s.nouveauStatut].libelle} » à compter du ${formaterDate(s.dateJour)}` : ""}
                        {s.kilometrage ? ` · relevé ${Number(s.kilometrage.replace(/\s/g, "")).toLocaleString("fr-FR")} km${verdictKm && !verdictKm.valide ? " (signalé incohérent)" : ""}` : ""}
                        {s.depannage && s.coutDepannage ? ` · dépense de dépannage` : ""}
                        {s.sanction !== "aucune" ? ` · ${s.sanction} tracé sur la fiche du conducteur` : ""}
                        {` · prévenus : ${destinatairesDeclaration(s.nature, s.blesses !== "aucun", s.tiers.length > 0).map((d) => trouverRole(d).libelle.toLowerCase()).join(", ")}`}.
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* ---- Pied ---- */}
          <div className="flex items-center gap-3 border-t border-bordure px-6 py-4">
            <p className="meta min-w-0 flex-1">
              {resultat && "numero" in resultat ? "" : !etapeValide ? `À renseigner : ${manquants[etape].join(", ")}.` : derniere ? "Déclarer attribue le numéro et enregistre les suites d'un coup." : `Étape ${indice + 1} sur ${ordre.length}`}
            </p>
            {resultat && "numero" in resultat ? (
              <button type="button" onClick={onFermer} className="bouton-principal">
                Fermer
              </button>
            ) : (
              <>
                <button type="button" onClick={indice === 0 ? onFermer : precedente} className="bouton-secondaire">
                  {indice === 0 ? "Annuler" : <ChevronLeft className="size-4 text-texte-2" strokeWidth={1.8} />}
                  {indice === 0 ? "" : "Précédent"}
                </button>
                {derniere ? (
                  <button type="button" onClick={declarer} disabled={!etapeValide} className="bouton-principal disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-attenue-2">
                    <AlertTriangle className="size-4" strokeWidth={2} />
                    Déclarer
                  </button>
                ) : (
                  <button type="button" onClick={suivante} disabled={!etapeValide} className="bouton-principal disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-attenue-2">
                    Suivant
                    <ChevronRight className="size-4" strokeWidth={2.2} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Champ({ libelle, obligatoire, precision, defavorable, large, children }: { libelle: string; obligatoire?: boolean; precision?: string; defavorable?: boolean; large?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${large ? "sm:col-span-2" : ""}`}>
      <span className="label-champ">
        {libelle}
        {obligatoire ? <span className="text-defavorable"> ●</span> : null}
      </span>
      {children}
      {precision ? <span className={`meta leading-snug ${defavorable ? "text-defavorable" : ""}`}>{precision}</span> : null}
    </label>
  );
}

function Interrupteur({ actif, onChange, libelle }: { actif: boolean; onChange: (v: boolean) => void; libelle: string }) {
  return (
    <button type="button" role="switch" aria-checked={actif} onClick={() => onChange(!actif)} className="flex h-9 items-center gap-2.5 text-left text-[13px] text-texte">
      <span className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${actif ? "bg-accent" : "bg-bordure-champ"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${actif ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {libelle}
    </button>
  );
}
