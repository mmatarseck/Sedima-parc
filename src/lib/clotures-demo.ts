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
 * Base branchée (8 septembre 2026) : le navigateur garde sa copie — l'écran
 * répond tout de suite — et la même écriture part vers la base par
 * `transactions-actions.ts`. Un numéro déjà pris est renuméroté ; un refus
 * de la base arrive à la cloche, pour que personne ne croie enregistré ce qui
 * ne l'est pas. Les types sans table restent dans le navigateur.
 * ==========================================================================*/

import { CHAMP_DATE, ROLES_CLOTURANT, formaterValeur, moisDe, peutCloturer, type ChampEdition, type ClotureMois, type Creation, type DemandeModification, type Modification } from "@/domaine/cloture";
import { TYPE_TRANSACTION, formerNumero, type TypeTransaction } from "@/domaine/reference";
import { ROLES, trouverRole } from "@/domaine/roles";
import { ajouterNotification } from "./notifications-demo";
import { apprendreVehicule } from "@/lib/parametres-demo";
import { authentificationReelle, lireRole } from "./session-demo";
import { ecrireCreation, ecrireModification } from "./transactions-actions";

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
  /**
   * La fiche d'où part la modification — « vehicule:AA032EA ».
   *
   * La création l'a toujours porté ; la modification, non, et cela suffisait
   * tant que chaque ligne se repérait par son numéro. Une ligne de plan
   * d'entretien, elle, se repère par le couple véhicule + opération : sans le
   * sujet, l'écriture ne sait pas de quel véhicule on parle.
   */
  sujet?: string;
  /**
   * La clé métier de la ligne quand son numéro n'en est pas une : le code de
   * l'opération pour un plan d'entretien, dont le numéro affiché est recalculé
   * à chaque rendu et ne désigne rien de stable.
   */
  cleMetier?: string;
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
  if (e.type === "vehicule") apprendreDuVehicule(e.apres);
  if (authentificationReelle()) void synchroniserModification(e, diffs);
  return { issue: "appliquee", modifications };
}

/* -- La base, quand elle est branchée --------------------------------------- */

/** Prévient la personne connectée qu'une écriture n'est pas passée en base. */
function signalerRefus(sujetLibelle: string, motif: string, href: string): void {
  const role = trouverRole(lireRole());
  ajouterNotification(role.role, { id: `refus-${Date.now().toString(36)}`, date: new Date().toISOString(), auteur: "SEDIMA Parc", initiales: "SP", sujetLibelle, extrait: motif, href });
}

/** Le navigateur reprend le numéro que la base a retenu, quand il diffère du sien. */
function renumeroter(sujet: string, ancien: string, nouveau: string): void {
  ecrireJson(cleCreations(sujet), lireCreations(sujet).map((c) => (c.numero === ancien ? { ...c, numero: nouveau } : c)));
  const historique = lireHistorique(ancien).map((m) => ({ ...m, numero: nouveau }));
  if (historique.length > 0) {
    ecrireJson(cleHistorique(nouveau), historique);
    try {
      localStorage.removeItem(cleHistorique(ancien));
    } catch {
      /* rien à retirer */
    }
  }
}

/**
 * La base a pris la ligne : c'est désormais la sienne qui fait foi. La copie du
 * navigateur est marquée plutôt qu'effacée — elle porte le journal de sa
 * création —, et les écrans cessent de la servir. Sans cela, la ligne
 * s'afficherait deux fois dès que le serveur la renvoie, et compterait double
 * dans les listes, les totaux et les alertes.
 */
function confirmerCreation(sujet: string, numero: string): void {
  ecrireJson(
    cleCreations(sujet),
    lireCreations(sujet).map((c) => (c.numero === numero ? { ...c, enBase: true } : c)),
  );
}

/**
 * La base vient d'accepter une écriture : le serveur a de quoi rendre autre
 * chose qu'avant.
 *
 * POURQUOI CE SIGNAL EXISTE. Les listes déroulantes se construisent sur les
 * référentiels que la mise en page a posés en mémoire au dernier rendu du
 * serveur (`AmorceReferentiels`). L'écriture appelle bien `revalidatePath()`,
 * mais côté serveur : sans que le routeur redemande la page, le navigateur
 * garde la liste d'avant. Un chauffeur, un site, un usage ou un autre conducteur
 * créé à l'instant restait donc introuvable dans le formulaire suivant — jusqu'à
 * ce qu'on navigue ou qu'on recharge.
 *
 * Trois signalements du métier des 15 septembre 2026 avaient la même cause :
 * « le site rajouté ne se retrouve pas sur un autre véhicule », « l'usage
 * rajouté ne figure pas dans la liste », « les nouveaux chauffeurs ne figurent
 * pas sur la liste pour affectation ».
 *
 * Un évènement du navigateur plutôt qu'un appel direct : ce module ne connaît
 * pas React, et c'est la coquille qui sait rafraîchir.
 */
export const EVENEMENT_BASE_ECRITE = "sedima:base-ecrite";

function signalerEcritureEnBase(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENEMENT_BASE_ECRITE));
}

async function synchroniserCreation(creation: Creation): Promise<void> {
  try {
    const r = await ecrireCreation(creation);
    if (r.issue === "refusee") signalerRefus(`${TYPE_TRANSACTION[creation.type].libelle} ${creation.numero}`, r.motif, "#");
    else if (r.issue === "hors-base") signalerRefus(`${TYPE_TRANSACTION[creation.type].libelle} ${creation.numero}`, MOTIF_HORS_BASE, "#");
    else if (r.issue === "ecrite") {
      if (r.numero !== creation.numero) renumeroter(creation.sujet, creation.numero, r.numero);
      confirmerCreation(creation.sujet, r.numero);
      signalerEcritureEnBase();
    }
  } catch (e) {
    signalerRefus(`${TYPE_TRANSACTION[creation.type].libelle} ${creation.numero}`, `Non enregistré en base : ${e instanceof Error ? e.message : "erreur inconnue"}`, "#");
  }
}

/**
 * Ce que dit l'application quand la base ne peut pas recevoir une écriture.
 *
 * « hors-base » se taisait. La ligne restait alors dans le navigateur, où elle
 * recouvre ce que les écrans affichent — et elle avait donc **l'air
 * appliquée**, pendant que la base ignorait tout.
 *
 * C'est ce qui est arrivé au nom d'un chauffeur le 15 septembre 2026 : corrigé
 * sur sa fiche, qui le montrait aussitôt ; inchangé en base ; et l'en-tête du
 * véhicule qu'il conduit, lui, lisait la base et gardait l'ancien nom. Deux
 * écrans, deux réponses, sans le moindre avertissement.
 *
 * Un silence est pire qu'un refus : un refus se voit et se retente.
 */
const MOTIF_HORS_BASE = "Cette modification n'a pas été envoyée à la base : elle n'est visible que sur ce navigateur. Rechargez la page pour voir ce que la base porte réellement.";

async function synchroniserModification(e: Enregistrement, diffs: { champ: string; libelleChamp: string; avant: string; apres: string; valeur: unknown }[]): Promise<void> {
  try {
    const r = await ecrireModification({ numero: e.numero, type: e.type, motif: e.motif, diffs, sujet: e.sujet, cleMetier: e.cleMetier });
    if (r.issue === "refusee") signalerRefus(e.titre, r.motif, e.href);
    else if (r.issue === "hors-base") signalerRefus(e.titre, MOTIF_HORS_BASE, e.href);
    /* Une correction change ce que les listes proposent autant qu'une création :
       un chauffeur désactivé doit cesser d'être proposé à l'affectation. */
    else signalerEcritureEnBase();
  } catch (x) {
    signalerRefus(e.titre, `Non enregistré en base : ${x instanceof Error ? x.message : "erreur inconnue"}`, e.href);
  }
}

/* -- Créations ------------------------------------------------------------------ */

function cleCreations(sujet: string): string {
  return `sedima.parc.creations.${sujet}`;
}

export function lireCreations(sujet: string): Creation[] {
  return lireJson<Creation[]>(cleCreations(sujet), []);
}

/**
 * Toutes les créations d'un type, toutes fiches confondues — pour le planning.
 * Celles que la base a confirmées sont tues : le serveur les renvoie déjà, et
 * les servir en plus les compterait deux fois.
 */
export function lireToutesCreations(type: TypeTransaction): Creation[] {
  const resultat: Creation[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sedima.parc.creations.")) resultat.push(...lireJson<Creation[]>(k, []).filter((c) => c.type === type && !c.enBase));
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

/**
 * Ce qu'une fiche véhicule enregistrée apprend au référentiel.
 *
 * La marque, le modèle et l'usage écrits dans un formulaire y entrent aussitôt,
 * pour être **choisis** la fois suivante au lieu d'être réécrits.
 *
 * C'était fait sur l'écran « Nouveau véhicule » seulement. Un usage écrit dans
 * la modale — le geste ordinaire, sur une fiche existante — n'était appris nulle
 * part : il n'apparaissait pas dans la liste du véhicule suivant, et, pire, la
 * fiche qui le portait affichait « Autre », faute de pouvoir relier
 * « usa-vehicule-particulier » à un libellé (signalé le 15 septembre 2026).
 *
 * Posé ici, à l'enregistrement, il couvre tous les chemins : la modale, l'écran
 * de création, et ceux qui viendront.
 */
function apprendreDuVehicule(valeurs: Record<string, unknown>): void {
  const texte = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
  const marque = texte(valeurs.marque);
  const usage = texte(valeurs.usage);
  if (!marque && !usage) return;
  void apprendreVehicule(marque ?? "", texte(valeurs.appellation), usage).then((refus) => {
    /* Le véhicule est enregistré ; seul le référentiel n'a pas suivi. On le dit
       sans défaire quoi que ce soit. */
    if (refus) signalerRefus("Référentiel des véhicules", refus, "/parametres/vehicules");
  });
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
  if (e.type === "vehicule") apprendreDuVehicule(e.valeurs);
  if (authentificationReelle()) void synchroniserCreation(creation);
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
