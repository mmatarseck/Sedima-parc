/* ============================================================================
 * Clôtures, modifications et demandes — stockage de démonstration.
 *
 * Trois registres dans le navigateur :
 *  - les mois clos (`sedima.parc.clotures`) ;
 *  - le journal des modifications, par transaction
 *    (`sedima.parc.historique.<numero>`), jamais purgé ;
 *  - les valeurs modifiées qui recouvrent les données de démonstration
 *    (`sedima.parc.surcharges.<numero>`), pour que la fiche montre ce qui a été
 *    changé sans réécrire le jeu de données ;
 *  - les demandes en attente d'approbation (`sedima.parc.demandes`).
 *
 * En production, tout ceci est en base, et la surcharge n'existe plus : la
 * transaction elle-même change, et le journal d'audit garde l'avant.
 * ==========================================================================*/

import { CHAMP_DATE, ROLES_CLOTURANT, formaterValeur, moisDe, peutCloturer, type ChampEdition, type ClotureMois, type Creation, type DemandeModification, type Modification } from "@/domaine/cloture";
import { TYPE_TRANSACTION, formerNumero, type TypeTransaction } from "@/domaine/reference";
import { ROLES, trouverRole } from "@/domaine/roles";
import { ajouterNotification } from "./notifications-demo";
import { lireRole } from "./session-demo";

function lireJson<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

function ecrireJson(cle: string, valeur: unknown): void {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* sans stockage, rien ne persiste */
  }
}

/* -- Clôtures ------------------------------------------------------------------ */

const CLE_CLOTURES = "sedima.parc.clotures";

export function lireClotures(): ClotureMois[] {
  return lireJson<ClotureMois[]>(CLE_CLOTURES, []).sort((a, b) => b.mois.localeCompare(a.mois));
}

export function moisEstClos(mois: string): boolean {
  return lireClotures().some((c) => c.mois === mois);
}

export function cloturer(mois: string, commentaire: string | null): ClotureMois[] {
  const role = trouverRole(lireRole());
  if (!peutCloturer(role.role)) return lireClotures();
  const liste = lireClotures().filter((c) => c.mois !== mois);
  liste.push({ mois, closLe: new Date().toISOString(), closPar: role.nom, closParId: role.role, commentaire });
  ecrireJson(CLE_CLOTURES, liste);
  return lireClotures();
}

export function rouvrir(mois: string): ClotureMois[] {
  const role = trouverRole(lireRole());
  if (!peutCloturer(role.role)) return lireClotures();
  ecrireJson(CLE_CLOTURES, lireClotures().filter((c) => c.mois !== mois));
  return lireClotures();
}

/* -- Surcharges : ce que la fiche affiche à la place des données de démonstration -- */

function cleSurcharge(numero: string): string {
  return `sedima.parc.surcharges.${numero}`;
}

export function lireSurcharge(numero: string): Record<string, unknown> {
  return lireJson<Record<string, unknown>>(cleSurcharge(numero), {});
}

function appliquerSurcharge(numero: string, valeurs: Record<string, unknown>): void {
  ecrireJson(cleSurcharge(numero), { ...lireSurcharge(numero), ...valeurs });
}

/** Toutes les surcharges connues, pour recouvrir une fiche d'un coup. */
export function lireToutesSurcharges(): Map<string, Record<string, unknown>> {
  const resultat = new Map<string, Record<string, unknown>>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sedima.parc.surcharges.")) resultat.set(k.slice("sedima.parc.surcharges.".length), lireJson(k, {}));
    }
  } catch {
    /* stockage indisponible */
  }
  return resultat;
}

/* -- Historique ----------------------------------------------------------------- */

function cleHistorique(numero: string): string {
  return `sedima.parc.historique.${numero}`;
}

export function lireHistorique(numero: string): Modification[] {
  return lireJson<Modification[]>(cleHistorique(numero), []).sort((a, b) => b.date.localeCompare(a.date));
}

function ajouterHistorique(numero: string, modifications: Modification[]): void {
  ecrireJson(cleHistorique(numero), [...lireHistorique(numero), ...modifications]);
}

/* -- Demandes ------------------------------------------------------------------- */

const CLE_DEMANDES = "sedima.parc.demandes";

export function lireDemandes(): DemandeModification[] {
  return lireJson<DemandeModification[]>(CLE_DEMANDES, []).sort((a, b) => b.date.localeCompare(a.date));
}

function ecrireDemandes(liste: DemandeModification[]): void {
  ecrireJson(CLE_DEMANDES, liste);
}

export interface Enregistrement {
  numero: string;
  type: TypeTransaction;
  titre: string;
  href: string;
  champs: ChampEdition[];
  avant: Record<string, unknown>;
  apres: Record<string, unknown>;
  motif: string;
}

export type ResultatEnregistrement = { issue: "appliquee"; modifications: Modification[] } | { issue: "en-attente"; demande: DemandeModification } | { issue: "rien" };

/**
 * Enregistre une modification. Si le mois de la transaction — avant ou après
 * changement de date — est clos et que l'auteur ne peut pas clôturer, la
 * modification devient une demande, et les approbateurs sont prévenus.
 */
export function enregistrerModification(e: Enregistrement): ResultatEnregistrement {
  const role = trouverRole(lireRole());
  const maintenant = new Date().toISOString();
  const diffs = e.champs
    .filter((c) => String(e.avant[c.cle] ?? "") !== String(e.apres[c.cle] ?? ""))
    .map((c) => ({ champ: c.cle, libelleChamp: c.libelle, avant: formaterValeur(c, e.avant[c.cle]), apres: formaterValeur(c, e.apres[c.cle]), valeur: e.apres[c.cle] }));
  if (diffs.length === 0) return { issue: "rien" };

  const champDate = CHAMP_DATE[e.type];
  const moisAvant = champDate ? moisDe(String(e.avant[champDate] ?? "")) : "";
  const moisApres = champDate ? moisDe(String(e.apres[champDate] ?? moisAvant)) : "";
  const moisConcerne = [moisAvant, moisApres].find((m) => m && moisEstClos(m)) ?? null;

  if (moisConcerne && !peutCloturer(role.role)) {
    const demande: DemandeModification = {
      id: `dm-${Date.now().toString(36)}`,
      numero: e.numero,
      type: e.type,
      titre: e.titre,
      href: e.href,
      mois: moisConcerne,
      date: maintenant,
      auteurId: role.role,
      auteur: role.nom,
      initiales: role.initiales,
      motif: e.motif,
      modifications: diffs,
      statut: "en-attente",
      decideePar: null,
      decideeLe: null,
      commentaireDecision: null,
    };
    ecrireDemandes([...lireDemandes(), demande]);
    ajouterHistorique(
      e.numero,
      diffs.map((d) => ({
        id: `${demande.id}-${d.champ}`,
        numero: e.numero,
        type: e.type,
        date: maintenant,
        auteurId: role.role,
        auteur: role.nom,
        initiales: role.initiales,
        champ: d.champ,
        libelleChamp: d.libelleChamp,
        avant: d.avant,
        apres: d.apres,
        motif: e.motif,
        statut: "en-attente",
        moisClos: moisConcerne,
        decideePar: null,
        decideeLe: null,
        commentaireDecision: null,
      })),
    );
    for (const approbateur of ROLES_CLOTURANT) {
      if (approbateur === role.role) continue;
      const def = ROLES.find((r) => r.role === approbateur);
      if (!def) continue;
      ajouterNotification(approbateur, {
        id: `${demande.id}-${approbateur}`,
        date: maintenant,
        auteur: role.nom,
        initiales: role.initiales,
        sujetLibelle: e.titre,
        extrait: `Demande de modification sur un mois clos (${moisConcerne}) — ${e.motif}`,
        href: "/parametres/clotures",
      });
    }
    return { issue: "en-attente", demande };
  }

  const modifications: Modification[] = diffs.map((d) => ({
    id: `m-${Date.now().toString(36)}-${d.champ}`,
    numero: e.numero,
    type: e.type,
    date: maintenant,
    auteurId: role.role,
    auteur: role.nom,
    initiales: role.initiales,
    champ: d.champ,
    libelleChamp: d.libelleChamp,
    avant: d.avant,
    apres: d.apres,
    motif: e.motif,
    statut: "appliquee",
    moisClos: moisConcerne,
    decideePar: moisConcerne ? role.nom : null,
    decideeLe: moisConcerne ? maintenant : null,
    commentaireDecision: null,
  }));
  ajouterHistorique(e.numero, modifications);
  appliquerSurcharge(e.numero, Object.fromEntries(diffs.map((d) => [d.champ, d.valeur])));
  return { issue: "appliquee", modifications };
}

/* -- Créations ------------------------------------------------------------------ */

function cleCreations(sujet: string): string {
  return `sedima.parc.creations.${sujet}`;
}

export function lireCreations(sujet: string): Creation[] {
  return lireJson<Creation[]>(cleCreations(sujet), []);
}

/** Toutes les créations d'un type, toutes fiches confondues — pour le planning. */
export function lireToutesCreations(type: TypeTransaction): Creation[] {
  const resultat: Creation[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sedima.parc.creations.")) resultat.push(...lireJson<Creation[]>(k, []).filter((c) => c.type === type));
    }
  } catch {
    /* stockage indisponible */
  }
  return resultat.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Numéro suivant d'un type pour une année — une séquence par type et par
 * année, comme en base. Les séquences de démonstration partent de 90 001 pour
 * ne jamais croiser celles du jeu de données.
 */
function prochainNumero(type: TypeTransaction, dateIso: string): string {
  const annee = dateIso.slice(0, 4);
  const cle = `sedima.parc.sequence.${TYPE_TRANSACTION[type].prefixe}.${annee}`;
  const suivant = lireJson<number>(cle, 90_000) + 1;
  ecrireJson(cle, suivant);
  return formerNumero(type, dateIso, suivant);
}

export type ResultatCreation = { issue: "creee"; creation: Creation } | { issue: "mois-clos"; mois: string } | { issue: "invalide" };

/**
 * Crée une transaction sur une fiche. Sur un mois clos, seul un rôle qui
 * clôture peut créer : pour les autres, la création est refusée avec le motif —
 * une demande de création n'existe pas, on demande la réouverture.
 */
export function enregistrerCreation(e: { sujet: string; type: TypeTransaction; champs: ChampEdition[]; valeurs: Record<string, unknown>; motif: string }): ResultatCreation {
  const role = trouverRole(lireRole());
  const champDate = CHAMP_DATE[e.type];
  const dateIso = champDate ? String(e.valeurs[champDate] ?? "") : new Date().toISOString().slice(0, 10);
  if (champDate && !dateIso) return { issue: "invalide" };
  const mois = champDate ? moisDe(dateIso) : "";
  if (mois && moisEstClos(mois) && !peutCloturer(role.role)) return { issue: "mois-clos", mois };

  const maintenant = new Date().toISOString();
  const creation: Creation = { numero: prochainNumero(e.type, dateIso || maintenant), type: e.type, sujet: e.sujet, date: maintenant, auteur: role.nom, valeurs: e.valeurs };
  ecrireJson(cleCreations(e.sujet), [creation, ...lireCreations(e.sujet)]);
  ajouterHistorique(creation.numero, [
    {
      id: `c-${creation.numero}`,
      numero: creation.numero,
      type: e.type,
      date: maintenant,
      auteurId: role.role,
      auteur: role.nom,
      initiales: role.initiales,
      champ: "creation",
      libelleChamp: "Création",
      avant: "—",
      apres: e.champs
        .filter((c) => e.valeurs[c.cle] !== null && e.valeurs[c.cle] !== undefined && e.valeurs[c.cle] !== "")
        .map((c) => `${c.libelle} : ${formaterValeur(c, e.valeurs[c.cle])}`)
        .join(" · "),
      motif: e.motif || "Création",
      statut: "appliquee",
      moisClos: mois && moisEstClos(mois) ? mois : null,
      decideePar: null,
      decideeLe: null,
      commentaireDecision: null,
    },
  ]);
  return { issue: "creee", creation };
}

/** Approuve ou refuse une demande. Approuver applique les valeurs et trace la décision. */
export function decider(idDemande: string, decision: "approuvee" | "refusee", commentaire: string | null): DemandeModification[] {
  const role = trouverRole(lireRole());
  if (!peutCloturer(role.role)) return lireDemandes();
  const maintenant = new Date().toISOString();
  const demandes = lireDemandes();
  const d = demandes.find((x) => x.id === idDemande);
  if (!d || d.statut !== "en-attente") return demandes;
  d.statut = decision;
  d.decideePar = role.nom;
  d.decideeLe = maintenant;
  d.commentaireDecision = commentaire;
  ecrireDemandes(demandes);

  const historique = lireHistorique(d.numero).map((m) =>
    m.id.startsWith(`${d.id}-`) ? { ...m, statut: decision === "approuvee" ? ("appliquee" as const) : ("refusee" as const), decideePar: role.nom, decideeLe: maintenant, commentaireDecision: commentaire } : m,
  );
  ecrireJson(cleHistorique(d.numero), historique);
  if (decision === "approuvee") appliquerSurcharge(d.numero, Object.fromEntries(d.modifications.map((m) => [m.champ, m.valeur])));

  const auteur = ROLES.find((r) => r.role === d.auteurId);
  if (auteur && auteur.role !== role.role) {
    ajouterNotification(auteur.role, {
      id: `${d.id}-decision`,
      date: maintenant,
      auteur: role.nom,
      initiales: role.initiales,
      sujetLibelle: d.titre,
      extrait: `Votre demande de modification a été ${decision === "approuvee" ? "approuvée" : "refusée"}${commentaire ? ` — ${commentaire}` : ""}`,
      href: d.href,
    });
  }
  return lireDemandes();
}
