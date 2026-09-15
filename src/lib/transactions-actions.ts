"use server";

/* ============================================================================
 * Les transactions saisies dans l'application, écrites en base.
 *
 * Jusqu'ici, tout ce que la modale de transaction, la fiche rapide ou
 * l'atelier enregistraient vivait dans le navigateur. Base branchée, ces deux
 * fonctions serveur écrivent la même chose dans la table du type — relevé,
 * plein, dépense, document, incident, affectation, intervention,
 * indisponibilité, sanction, et le transport tiers : ligne de relevé, ligne
 * de grille, affrètement, mise à disposition, prestation — et le statut d'un
 * véhicule sur sa ligne, avec
 * sa trace dans `modification` (c'est elle que `situation_journaliere()` lit
 * pour rendre le statut d'un jour passé). Les politiques RLS décident, avec la
 * session de l'utilisateur.
 *
 * Le numéro : celui que le navigateur a formé, sauf s'il existe déjà — deux
 * postes peuvent numéroter en même temps — ; la base donne alors le suivant,
 * et le navigateur renumérote sa copie.
 *
 * Les identifiants : la démonstration nomme un véhicule par son
 * immatriculation et un chauffeur par un identifiant lisible ; le seed les a
 * transposés en UUID déterministes (sha1 de « sedima-parc:chauffeur:… »). On
 * retrouve donc un véhicule par son immatriculation, un chauffeur par son
 * UUID ou par cette transposition.
 * ==========================================================================*/

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Creation } from "@/domaine/cloture";
import { afficher } from "@/domaine/immatriculation";
import { TYPE_TRANSACTION, formerNumero, type TypeTransaction } from "@/domaine/reference";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur, utilisateurCourant } from "@/lib/supabase";
import { EST_UUID, RETRAIT_CHAUFFEUR, cleDe, colonnesModification, decomposerSujet, immatriculationCanonique, ligneCreation, scinderUsage, tableDe, type Rattachement } from "@/lib/transactions-colonnes";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultatEcriture = { issue: "ecrite"; numero: string } | { issue: "refusee"; motif: string } | { issue: "hors-base" };

/* Le même UUID que le seed forme pour un identifiant de démonstration. */
function uuidDeterministe(etiquette: string): string {
  const h = createHash("sha1").update(`sedima-parc:${etiquette}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function vehiculeIdDe(client: SupabaseClient, cle: unknown): Promise<string | null> {
  if (typeof cle !== "string" || !cle) return null;
  if (EST_UUID.test(cle)) return cle;
  const immat = immatriculationCanonique(cle);
  const r = await client.from("vehicule").select("id").eq("immatriculation", immat).maybeSingle<{ id: string }>();
  if (r.data) return r.data.id;
  /* Un identifiant de démonstration transposé par le seed. */
  const devine = uuidDeterministe(`vehicule:${cle}`);
  const d = await client.from("vehicule").select("id").eq("id", devine).maybeSingle<{ id: string }>();
  return d.data?.id ?? null;
}

/**
 * Le chauffeur, depuis ce que l'écran en dit : un identifiant de table, ou son
 * adresse lisible (« babacar-ndiaye »).
 *
 * L'adresse se traduit d'abord par l'identifiant dérivé — le jeu de départ les
 * a posés ainsi, et l'application fait de même à la création. Mais une fiche
 * saisie directement en base porte un identifiant quelconque : on retombe alors
 * sur le nom, sans quoi elle serait introuvable depuis l'application et toute
 * écriture la concernant serait refusée sans qu'on sache pourquoi.
 */
async function chauffeurIdDe(client: SupabaseClient, cle: unknown): Promise<string | null> {
  if (typeof cle !== "string" || !cle) return null;
  if (EST_UUID.test(cle)) return cle;
  const devine = uuidDeterministe(`chauffeur:${cle}`);
  const d = await client.from("chauffeur").select("id").eq("id", devine).maybeSingle<{ id: string }>();
  if (d.data) return d.data.id;
  /* Par le nom : « babacar-ndiaye » se relit « babacar ndiaye », et la
     comparaison se fait sur le prénom et le nom accolés, sans accent. */
  const mots = cle.split("-").filter(Boolean);
  if (mots.length < 2) return null;
  const tous = await client.from("chauffeur").select("id, nom, prenom").limit(2000).returns<{ id: string; nom: string; prenom: string }[]>();
  if (tous.error || !tous.data) return null;
  const trouves = tous.data.filter((c) => idLisible(`${c.prenom} ${c.nom}`) === cle);
  /* Deux homonymes : on ne choisit pas au hasard lequel des deux on modifie. */
  return trouves.length === 1 ? trouves[0]!.id : null;
}

/** La même transformation que `idChauffeur` du domaine, côté serveur. */
function idLisible(nom: string): string {
  return nom
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Le site d'une saisie : son identifiant s'il a été choisi, sinon celui qui
 * porte ce nom — et à défaut un site créé sur-le-champ.
 *
 * Demande du métier du 15 septembre 2026 : pouvoir créer depuis la liste
 * déroulante, comme pour la marque ou l'usage. Un site n'est pas une étiquette :
 * la table en exige une région et un type, que le formulaire demande alors
 * plutôt que de les inventer. Le code, lui, se dérive du nom — c'est une clé
 * technique, pas une information qu'on invente.
 */
async function siteIdDe(client: SupabaseClient, valeur: unknown, region: unknown, type: unknown, utilisateurId: string): Promise<string | null> {
  if (typeof valeur !== "string" || !valeur.trim()) return null;
  const saisi = valeur.trim();
  if (EST_UUID.test(saisi)) return saisi;
  const connu = await client.from("site").select("id").ilike("libelle", saisi).limit(1).maybeSingle<{ id: string }>();
  if (connu.data) return connu.data.id;
  const libelleRegion = typeof region === "string" ? region.trim() : "";
  const typeSite = typeof type === "string" ? type.trim() : "";
  /* Sans région ni type, on ne crée pas : le formulaire les demande dès qu'un
     nom est écrit, et une ligne posée avec « Dakar » par défaut serait fausse
     pour un dépôt de Ziguinchor — et personne n'irait la corriger. */
  if (!libelleRegion || !typeSite) return null;
  const code = saisi
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const cree = await client.from("site").insert({ code: code || `SITE-${Date.now().toString(36).toUpperCase()}`, libelle: saisi, region: libelleRegion, type: typeSite, cree_par: utilisateurId }).select("id").maybeSingle<{ id: string }>();
  if (cree.error) {
    /* Le code est déjà pris : le site existe sous un libellé voisin, on le
       reprend plutôt que d'en poser un second. */
    const parCode = await client.from("site").select("id").eq("code", code).maybeSingle<{ id: string }>();
    return parCode.data?.id ?? null;
  }
  return cree.data?.id ?? null;
}

/**
 * Le conducteur d'une attribution : son identifiant s'il a été choisi dans la
 * liste, sinon celui qui porte ce nom — et à défaut une fiche créée sur-le-champ.
 *
 * Demande du métier du 15 septembre 2026 : « à l'ajout d'un autre conducteur,
 * pouvoir spécifier pour ne pas le mettre dans la liste des chauffeurs du
 * parc ». La fiche naît donc **chez les attributaires**, et le nom suffit à la
 * poser : un attributaire ne doit au parc ni permis, ni visite médicale, ni
 * aptitude — contrairement au chauffeur, qu'on ne peut pas enregistrer sans.
 *
 * La base tient l'unicité sur le nom : deux attributions de suite au même nom
 * retrouvent la même personne au lieu d'en poser deux.
 */
async function attributaireIdDe(client: SupabaseClient, valeur: string, fonction: unknown, departement: unknown, utilisateurId: string): Promise<string | null> {
  const saisi = valeur.trim();
  if (!saisi) return null;
  if (EST_UUID.test(saisi)) return saisi;
  const connu = await client.from("attributaire").select("id").ilike("nom", saisi).limit(1).maybeSingle<{ id: string }>();
  if (connu.data) return connu.data.id;
  const cree = await client
    .from("attributaire")
    .insert({ nom: saisi, fonction: typeof fonction === "string" && fonction.trim() ? fonction.trim() : null, departement: typeof departement === "string" && departement.trim() ? departement.trim() : null, cree_par: utilisateurId })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (cree.error) {
    /* Le nom est déjà pris à la casse près : on reprend la fiche existante
       plutôt que d'en poser une seconde pour la même personne. */
    const reprise = await client.from("attributaire").select("id").ilike("nom", saisi).limit(1).maybeSingle<{ id: string }>();
    return reprise.data?.id ?? null;
  }
  return cree.data?.id ?? null;
}

async function prestataireIdDe(client: SupabaseClient, nom: unknown): Promise<string | null> {
  if (typeof nom !== "string" || !nom.trim()) return null;
  const r = await client.from("prestataire").select("id").ilike("raison_sociale", nom.trim()).limit(1).maybeSingle<{ id: string }>();
  return r.data?.id ?? null;
}

/** Un prestataire par son numéro (« PRE-2026-00012 ») — la demande d'achat le cite ainsi. */
async function prestataireIdParNumero(client: SupabaseClient, numero: unknown): Promise<string | null> {
  if (typeof numero !== "string" || !numero.trim()) return null;
  const r = await client.from("prestataire").select("id").eq("numero", numero.trim()).limit(1).maybeSingle<{ id: string }>();
  return r.data?.id ?? null;
}

/** Une pièce de rechange, par son numéro PCE ou par sa référence de casier. */
async function pieceIdDe(client: SupabaseClient, numeroOuReference: unknown): Promise<string | null> {
  if (typeof numeroOuReference !== "string" || !numeroOuReference.trim()) return null;
  const cle = numeroOuReference.trim();
  const parNumero = await client.from("piece").select("id").eq("numero", cle).limit(1).maybeSingle<{ id: string }>();
  if (parNumero.data) return parNumero.data.id;
  const parReference = await client.from("piece").select("id").ilike("reference", cle).limit(1).maybeSingle<{ id: string }>();
  return parReference.data?.id ?? null;
}

/** Un camion du référentiel tiers, par sa plaque telle qu'on l'écrit ; nul quand la plaque n'y est pas — elle restera libre. */
async function camionTiersDe(client: SupabaseClient, plaque: unknown): Promise<string | null> {
  if (typeof plaque !== "string" || !plaque.trim()) return null;
  const canonique = immatriculationCanonique(plaque.replace(/^tiers:/, ""));
  const r = await client.from("camion_tiers").select("immatriculation").eq("immatriculation", canonique).maybeSingle<{ immatriculation: string }>();
  return r.data?.immatriculation ?? null;
}

async function affretementIdDe(client: SupabaseClient, numero: unknown): Promise<string | null> {
  if (typeof numero !== "string" || !numero.trim()) return null;
  const r = await client.from("affretement").select("id").eq("numero", numero.trim()).maybeSingle<{ id: string }>();
  return r.data?.id ?? null;
}

/** Le libellé de la pièce qu'une évaluation cite, lu sur sa table : ce que l'écran affichera en face de la note. */
async function libellePieceDe(client: SupabaseClient, numero: unknown): Promise<string | null> {
  if (typeof numero !== "string" || !numero.trim()) return null;
  const n = numero.trim();
  const prefixe = n.slice(0, 3).toUpperCase();
  if (prefixe === "INT") {
    const r = await client.from("intervention").select("objet, vehicule (immatriculation)").eq("numero", n).maybeSingle<{ objet: string; vehicule: { immatriculation: string } | null }>();
    return r.data ? `${r.data.objet}${r.data.vehicule ? ` — ${afficher(r.data.vehicule.immatriculation)}` : ""}` : null;
  }
  if (prefixe === "DAC") {
    const r = await client.from("demande_achat").select("objet").eq("numero", n).maybeSingle<{ objet: string }>();
    return r.data?.objet ?? null;
  }
  if (prefixe === "AFF") {
    const r = await client.from("affretement").select("origine, destination").eq("numero", n).maybeSingle<{ origine: string; destination: string }>();
    return r.data ? `${r.data.origine} → ${r.data.destination}` : null;
  }
  if (prefixe === "MAD") {
    const r = await client.from("mise_a_disposition").select("immatriculation, mois").eq("numero", n).maybeSingle<{ immatriculation: string; mois: string }>();
    return r.data ? `${afficher(r.data.immatriculation)} · ${r.data.mois}` : null;
  }
  if (prefixe === "PRS") {
    const r = await client.from("prestation").select("libelle").eq("numero", n).maybeSingle<{ libelle: string }>();
    return r.data?.libelle ?? null;
  }
  return null;
}

async function rattacher(client: SupabaseClient, c: Creation, utilisateurId: string): Promise<Rattachement> {
  const s = decomposerSujet(c.sujet);
  const v = c.valeurs;
  const vehiculeId = (await vehiculeIdDe(client, v.vehiculeId)) ?? (s.genre === "vehicule" ? await vehiculeIdDe(client, s.cle) : null);
  const chauffeurId = (await chauffeurIdDe(client, v.chauffeurId)) ?? (s.genre === "chauffeur" ? await chauffeurIdDe(client, s.cle) : null);
  /* Le prestataire : par son numéro quand la fiche le porte — la fiche
     transporteur porte le sien dans son sujet —, par son nom sinon. */
  const prestataireId =
    (await prestataireIdParNumero(client, v.prestataireNumero)) ??
    (await prestataireIdParNumero(client, v.transporteurNumero)) ??
    (s.genre === "prestataire" ? await prestataireIdParNumero(client, s.cle) : null) ??
    (await prestataireIdDe(client, v.garage ?? v.prestataire ?? v.fournisseur ?? v.beneficiaire ?? v.transporteur));
  /* Le camion du transporteur, s'il est au référentiel ; l'affrètement que cite une ligne de relevé. */
  const transport = c.type === "transport" || c.type === "affretement" || c.type === "mise-a-disposition";
  const camionTiers = transport ? await camionTiersDe(client, v.camion ?? v.immatriculationExterne ?? v.immatriculation ?? v.camionTiersImmatriculation) : null;
  const affretementId = c.type === "transport" ? await affretementIdDe(client, v.affretementNumero) : null;
  /* La demande d'achat nomme qui demande : la personne de la session (son rôle est posé par l'écriture, qui la connaît). */
  if (c.type === "achat" && !v.demandeur) v.demandeur = c.auteur;
  /* Le journal de caisse et celui de la cuve nomment qui enregistre : la personne de la session. */
  if ((c.type === "caisse" || c.type === "cuve") && !v.enregistrePar) v.enregistrePar = c.auteur;
  /* Le demandeur d'un ordre ou d'un affrètement : la personne qui le crée, telle que le navigateur la nomme. */
  if ((c.type === "ordre" || c.type === "affretement") && !v.demandeur) v.demandeur = c.auteur;
  /* L'auteur d'une évaluation, et le libellé de la pièce qu'elle juge, lu sur sa table. */
  if (c.type === "evaluation") {
    if (!v.auteur) v.auteur = c.auteur;
    if (!v.pieceLibelle) v.pieceLibelle = (await libellePieceDe(client, v.pieceNumero)) ?? undefined;
  }
  /* Un mouvement de stock ou un pneu cite sa pièce de rechange ; le mouvement nomme qui l'a fait. */
  const pieceId = c.type === "mouvement" || c.type === "pneu" ? await pieceIdDe(client, v.pieceNumero) : null;
  /* Le site : choisi, retrouvé par son nom, ou créé — c'est le seul référentiel
     qu'une liste déroulante peut enrichir, parce qu'il tient en trois champs. */
  const siteId = await siteIdDe(client, v.siteId, v.siteRegion, v.siteType, utilisateurId);
  /* L'attelage lie deux véhicules : celui de la fiche, et celui que le formulaire nomme. */
  const autreVehiculeId = c.type === "attelage" ? await vehiculeIdDe(client, v.autreId) : null;
  if (c.type === "mouvement" && !v.auteur) v.auteur = c.auteur;
  return { vehiculeId, chauffeurId, prestataireId, camionTiers, affretementId, pieceId, autreVehiculeId, siteId };
}

/** Le numéro suivant du type pour l'année, d'après ce que la table porte déjà. */
async function numeroSuivant(client: SupabaseClient, table: string, type: TypeTransaction, numero: string): Promise<string> {
  const prefixe = `${TYPE_TRANSACTION[type].prefixe}-${numero.split("-")[1]}-`;
  const r = await client.from(table).select("numero").like("numero", `${prefixe}%`).order("numero", { ascending: false }).limit(1).maybeSingle<{ numero: string }>();
  const dernier = r.data ? Number(r.data.numero.slice(prefixe.length)) || 0 : 0;
  return formerNumero(type, `${numero.split("-")[1]}-01-01`, dernier + 1);
}

/** Écrit une création. Le numéro rendu est celui que la base a retenu. */
export async function ecrireCreation(c: Creation): Promise<ResultatEcriture> {
  if (!authentificationReelle()) return { issue: "hors-base" };
  const client = await clientServeur();
  const moi = await utilisateurCourant(client);
  if (!moi) return { issue: "refusee", motif: "Session absente : reconnectez-vous." };

  if (c.type === "statut") return poserStatut(client, moi.utilisateurId, c);
  if (c.type === "aptitude") return poserAptitude(client, moi.utilisateurId, c);
  if (c.type === "attribution") return poserAttribution(client, moi.utilisateurId, c);
  /* « Personne — retirer le chauffeur » : on clôt sans rouvrir. Ce n'est pas
     une affectation à écrire, c'est celle qui court qu'il faut arrêter. */
  if (c.type === "affectation" && typeof c.valeurs.chauffeurId === "string" && c.valeurs.chauffeurId.trim() === RETRAIT_CHAUFFEUR) return retirerAffectation(client, moi.utilisateurId, c);
  const table = tableDe(c.type);
  if (!table) return { issue: "hors-base" };

  const r = await rattacher(client, c, moi.utilisateurId);
  if (c.type === "achat" && !c.valeurs.demandeurRole) c.valeurs.demandeurRole = moi.role;
  const prep = ligneCreation(c.type, c.numero, c.valeurs, r);
  if ("refus" in prep) return { issue: "refusee", motif: `Non enregistré en base : ${prep.refus}.` };
  const ligne: Record<string, unknown> = { ...prep.ligne, cree_par: moi.utilisateurId };

  /*
   * Remplacer un chauffeur, c'est en clore un et en ouvrir un autre.
   *
   * L'affectation s'ajoutait sans fermer la précédente : le véhicule se
   * retrouvait avec deux titulaires en cours, et les écrans montraient le
   * premier venu — donc souvent l'ancien. « Chauffeur remplacé, mais ne tient
   * pas » (signalé le 15 septembre 2026). Rien en base ne l'interdisait : un
   * camion peut avoir plusieurs suppléants, mais pas deux titulaires.
   *
   * Un suppléant ne clôt rien : on en désigne plusieurs, c'est l'usage.
   */
  if (c.type === "affectation" && ligne.role === "titulaire" && typeof ligne.vehicule_id === "string" && typeof ligne.debut === "string") {
    const veille = new Date(`${ligne.debut}T00:00:00Z`);
    veille.setUTCDate(veille.getUTCDate() - 1);
    const fin = veille.toISOString().slice(0, 10);
    const courante = await client.from("affectation").select("id, debut").eq("vehicule_id", ligne.vehicule_id).eq("role", "titulaire").is("fin", null).maybeSingle<{ id: string; debut: string }>();
    if (courante.data) {
      /* Une affectation ouverte le jour même se referme sur son propre début :
         la veille donnerait une période à l'envers, que la base refuse. */
      const cloture = courante.data.debut > fin ? courante.data.debut : fin;
      const fermee = await client.from("affectation").update({ fin: cloture, modifie_le: new Date().toISOString(), modifie_par: moi.utilisateurId }).eq("id", courante.data.id);
      if (fermee.error) return { issue: "refusee", motif: `Affectation précédente non close : ${fermee.error.message}` };
    }
  }

  /* Un véhicule n'est pas numéroté : sa clé est sa plaque, et deux véhicules ne
     peuvent pas la partager. Un doublon ne se renumérote donc pas — il se dit,
     parce que c'est presque toujours le même camion saisi deux fois. */
  /* La personne reçoit l'identifiant dérivé de son nom : c'est ce qui permet à
     l'adresse de sa fiche de la désigner ensuite, et ce qui fait qu'enregistrer
     deux fois la même personne bute sur la clé primaire au lieu de créer un
     doublon silencieux. */
  if (c.type === "chauffeur") {
    const lisible = idLisible(`${ligne.prenom ?? ""} ${ligne.nom ?? ""}`);
    const ecriture = await client.from(table).insert({ ...ligne, id: uuidDeterministe(`chauffeur:${lisible}`) }).select("id").maybeSingle<{ id: string }>();
    if (ecriture.error) {
      const nom = `${ligne.prenom ?? ""} ${ligne.nom ?? ""}`.trim();
      return { issue: "refusee", motif: ecriture.error.code === "23505" ? `${nom} a déjà une fiche : ouvrez-la plutôt que d'en créer une seconde.` : `Non enregistré en base : ${ecriture.error.message}` };
    }
    revalidatePath("/", "layout");
    return { issue: "ecrite", numero: `CHA-${lisible}` };
  }

  /*
   * Un autre conducteur se crée là où on l'ajoute — la liste des conducteurs ou
   * l'attribution d'un véhicule —, et il entre chez les attributaires, pas chez
   * les chauffeurs du parc (demande du 15 septembre 2026).
   *
   * La table n'a pas de numéro : sa clé est son identifiant, et l'unicité porte
   * sur le nom. Deux fiches pour la même personne se refusent donc d'elles-mêmes
   * — encore faut-il le dire autrement que par un code d'erreur Postgres.
   */
  if (c.type === "attributaire") {
    const ecriture = await client.from(table).insert(ligne).select("id").maybeSingle<{ id: string }>();
    if (ecriture.error) {
      const nom = String(ligne.nom ?? "").trim();
      return { issue: "refusee", motif: ecriture.error.code === "23505" ? `${nom} a déjà une fiche : ouvrez-la plutôt que d'en créer une seconde.` : `Non enregistré en base : ${ecriture.error.message}` };
    }
    revalidatePath("/", "layout");
    return { issue: "ecrite", numero: `ATB-${ecriture.data?.id ?? ""}` };
  }

  if (c.type === "vehicule") {
    const ecriture = await client.from(table).insert(ligne).select("id").maybeSingle<{ id: string }>();
    if (ecriture.error) {
      const plaque = afficher(String(ligne.immatriculation ?? ""));
      return { issue: "refusee", motif: ecriture.error.code === "23505" ? `${plaque} est déjà au parc : ouvrez sa fiche plutôt que d'en créer une seconde.` : `Non enregistré en base : ${ecriture.error.message}` };
    }
    if (ecriture.data) await entreeAuParc(client, ecriture.data.id, moi.utilisateurId, c.valeurs);
    revalidatePath("/", "layout");
    return { issue: "ecrite", numero: `VEH-${ligne.immatriculation}` };
  }

  let ecriture = await client.from(table).insert(ligne);
  let numero = c.numero;
  if (ecriture.error && ecriture.error.code === "23505") {
    numero = await numeroSuivant(client, table, c.type, c.numero);
    ecriture = await client.from(table).insert({ ...ligne, numero });
  }
  if (ecriture.error) return { issue: "refusee", motif: `Non enregistré en base : ${ecriture.error.message}` };
  revalidatePath("/", "layout");
  return { issue: "ecrite", numero };
}

/**
 * Ce qu'un véhicule apporte en entrant au parc, et qui n'est pas une propriété
 * de sa ligne : son compteur, et le rendez-vous de sa première visite. Le
 * formulaire de création les demande parce que c'est le moment où on les a
 * sous les yeux ; la base les range chacun dans sa table.
 *
 * Un échec ici n'annule pas la création — le véhicule, lui, est bien entré.
 * Il est signalé, pour que personne ne croie le relevé enregistré.
 */
async function entreeAuParc(client: SupabaseClient, vehiculeId: string, utilisateurId: string, valeurs: Record<string, unknown>): Promise<void> {
  const jour = new Date().toISOString().slice(0, 10);
  const km = typeof valeurs.kilometrage === "number" ? valeurs.kilometrage : Number(String(valeurs.kilometrage ?? "").replace(/\s/g, "").replace(",", "."));
  if (Number.isFinite(km) && km > 0) {
    const numero = await numeroSuivant(client, "releve_kilometrique", "releve", `REL-${jour.slice(0, 4)}-00000`);
    await client.from("releve_kilometrique").insert({ numero, vehicule_id: vehiculeId, date: jour, km: Math.round(km), origine: "saisie", cree_par: utilisateurId });
  }
  const visite = typeof valeurs.premiereVisiteTechnique === "string" ? valeurs.premiereVisiteTechnique.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(visite)) {
    const numero = await numeroSuivant(client, "visite_technique", "visite", `VTE-${visite.slice(0, 4)}-00000`);
    await client.from("visite_technique").insert({ numero, vehicule_id: vehiculeId, type: "visite", centre: "À désigner", date_rendez_vous: visite, statut: "rendez-vous", cree_par: utilisateurId });
  }
}

/* Le statut d'un véhicule : sa ligne change, et la trace garde l'avant. */
/**
 * Une décision d'aptitude : apte, apte avec réserve, inapte.
 *
 * Elle n'a pas de table — ce sont trois colonnes de la fiche du chauffeur,
 * comme le statut est une colonne du véhicule. Elle passe donc par son propre
 * écrivain, et laisse une trace dans `modification` : une inaptitude prononcée
 * doit pouvoir se relire, avec sa date et son motif.
 */
/**
 * Changer qui tient un véhicule de service ou de fonction — ou le lui retirer.
 *
 * UNE ATTRIBUTION NE SE MODIFIE PAS, ELLE SE REMPLACE. On clôt celle qui court
 * à la veille de la nouvelle, puis on en ouvre une autre. Écraser la ligne
 * existante ferait disparaître qui tenait le véhicule le mois dernier — or
 * c'est précisément ce que le budget et les forfaits carburant lisent pour
 * répartir la charge sur la bonne business unit.
 *
 * Retirer l'attribution, c'est clore sans rouvrir : le véhicule redevient
 * disponible, sa fiche le dit, et l'historique reste entier.
 *
 * La base tient la règle : un index partiel (0004) interdit deux attributions
 * en cours pour un même véhicule. Clore avant d'ouvrir n'est donc pas une
 * précaution de style — sans cela, l'écriture serait refusée.
 */
/**
 * Laisser un véhicule sans chauffeur.
 *
 * « On doit pouvoir supprimer une affectation de véhicule et le laisser sans
 * chauffeur » (métier, 15 septembre 2026). Rien ne le permettait : le champ
 * n'acceptait qu'un nom, et un camion qui perdait son conducteur gardait le
 * sien à l'écran — avec les kilomètres, la consommation et les incidents du
 * mois rattachés à quelqu'un qui ne le conduisait plus.
 *
 * ON CLÔT, ON N'EFFACE PAS. L'affectation qui court est un fait daté : elle a
 * porté des pleins, des relevés, peut-être un incident. L'effacer rendrait ces
 * faits orphelins et réécrirait l'histoire du véhicule. On lui pose une fin, ce
 * qui dit exactement ce qui s'est passé — quelqu'un a conduit jusqu'à cette
 * date, et plus personne depuis.
 *
 * Une saisie du jour même se referme sur son propre début : la veille donnerait
 * une période à l'envers, que la base refuse.
 */
async function retirerAffectation(client: SupabaseClient, utilisateurId: string, c: Creation): Promise<ResultatEcriture> {
  const s = decomposerSujet(c.sujet);
  const vehiculeId = (await vehiculeIdDe(client, c.valeurs.vehiculeId)) ?? (s.genre === "vehicule" ? await vehiculeIdDe(client, s.cle) : null);
  if (!vehiculeId) return { issue: "refusee", motif: "Non enregistré en base : véhicule introuvable." };

  const role = typeof c.valeurs.role === "string" && c.valeurs.role.trim() ? c.valeurs.role.trim() : "titulaire";
  const jour = typeof c.valeurs.debut === "string" && c.valeurs.debut ? c.valeurs.debut : new Date().toISOString().slice(0, 10);
  const veille = new Date(`${jour}T00:00:00Z`);
  veille.setUTCDate(veille.getUTCDate() - 1);
  const fin = veille.toISOString().slice(0, 10);

  const courante = await client.from("affectation").select("id, numero, chauffeur_id, debut").eq("vehicule_id", vehiculeId).eq("role", role).is("fin", null).maybeSingle<{ id: string; numero: string; chauffeur_id: string; debut: string }>();
  if (courante.error) return { issue: "refusee", motif: `Affectation non retirée : ${courante.error.message}` };
  if (!courante.data) {
    return { issue: "refusee", motif: role === "titulaire" ? "Ce véhicule n'a pas de chauffeur à retirer." : "Ce véhicule n'a pas de suppléant à retirer." };
  }

  const cloture = courante.data.debut > fin ? courante.data.debut : fin;
  const fermee = await client.from("affectation").update({ fin: cloture, motif: typeof c.valeurs.motif === "string" && c.valeurs.motif.trim() ? c.valeurs.motif.trim() : "Chauffeur retiré", modifie_le: new Date().toISOString(), modifie_par: utilisateurId }).eq("id", courante.data.id);
  if (fermee.error) return { issue: "refusee", motif: `Affectation non retirée : ${fermee.error.message}` };

  /* Le nom part dans la trace, pas l'identifiant : c'est ce qu'on relit six
     mois plus tard en se demandant qui conduisait. */
  const qui = await client.from("chauffeur").select("nom, prenom").eq("id", courante.data.chauffeur_id).maybeSingle<{ nom: string; prenom: string }>();
  const trace = await client.from("modification").insert({
    table_cible: "affectation",
    numero: courante.data.numero,
    champ: "fin",
    libelle_champ: "Fin d'affectation",
    avant: "",
    apres: cloture,
    motif: typeof c.valeurs.motif === "string" && c.valeurs.motif.trim() ? c.valeurs.motif.trim() : `Chauffeur retiré${qui.data ? ` : ${qui.data.prenom} ${qui.data.nom}` : ""}`,
    statut: "appliquee",
    cree_par: utilisateurId,
  });
  if (trace.error) return { issue: "refusee", motif: `Retirée, mais sans trace : ${trace.error.message}` };
  revalidatePath("/", "layout");
  return { issue: "ecrite", numero: courante.data.numero };
}

async function poserAttribution(client: SupabaseClient, utilisateurId: string, c: Creation): Promise<ResultatEcriture> {
  const s = decomposerSujet(c.sujet);
  const vehiculeId = (await vehiculeIdDe(client, c.valeurs.vehiculeId)) ?? (s.genre === "vehicule" ? await vehiculeIdDe(client, s.cle) : null);
  if (!vehiculeId) return { issue: "refusee", motif: "Non enregistré en base : véhicule introuvable." };

  const choix = typeof c.valeurs.attributaireId === "string" ? c.valeurs.attributaireId.trim() : "";
  const pool = typeof c.valeurs.pool === "string" ? c.valeurs.pool.trim() : "";
  if (choix === "pool" && !pool) return { issue: "refusee", motif: "Non enregistré en base : nommez le pool ou le service." };
  /* Une personne écrite plutôt que choisie : sa fiche d'autre conducteur naît
     ici, et nulle part chez les chauffeurs du parc. */
  const attributaireId = choix === "" || choix === "pool" ? null : await attributaireIdDe(client, choix, c.valeurs.fonction, c.valeurs.departement, utilisateurId);
  if (choix !== "" && choix !== "pool" && !attributaireId) return { issue: "refusee", motif: `Non enregistré en base : la fiche de ${choix} n'a pas pu être créée.` };
  const debut = typeof c.valeurs.debut === "string" && c.valeurs.debut ? c.valeurs.debut : new Date().toISOString().slice(0, 10);
  /* La veille du nouveau début : deux attributions ne se chevauchent pas d'un
     jour, sans quoi le véhicule aurait deux détenteurs ce jour-là. */
  const veille = new Date(`${debut}T00:00:00Z`);
  veille.setUTCDate(veille.getUTCDate() - 1);
  const finPrecedente = veille.toISOString().slice(0, 10);

  const courante = await client.from("attribution_legere").select("id, attributaire_id, pool, debut").eq("vehicule_id", vehiculeId).is("fin", null).maybeSingle<{ id: string; attributaire_id: string | null; pool: string | null; debut: string | null }>();
  if (courante.error) return { issue: "refusee", motif: `Attribution non changée : ${courante.error.message}` };
  if (courante.data) {
    /* Une attribution ouverte le jour même n'a pas d'antériorité à garder : on
       la referme sur son propre début plutôt que sur la veille, ce qui donnerait
       une période à l'envers. */
    const fin = courante.data.debut && courante.data.debut > finPrecedente ? courante.data.debut : finPrecedente;
    const cloture = await client.from("attribution_legere").update({ fin, modifie_le: new Date().toISOString(), modifie_par: utilisateurId }).eq("id", courante.data.id);
    if (cloture.error) return { issue: "refusee", motif: `Attribution précédente non close : ${cloture.error.message}` };
  }

  if (choix !== "") {
    const ouverture = await client.from("attribution_legere").insert({
      vehicule_id: vehiculeId,
      attributaire_id: attributaireId,
      pool: choix === "pool" ? pool : null,
      debut,
      commentaire: typeof c.valeurs.motif === "string" && c.valeurs.motif.trim() ? c.valeurs.motif.trim() : null,
      cree_par: utilisateurId,
    });
    if (ouverture.error) return { issue: "refusee", motif: `Attribution non ouverte : ${ouverture.error.message}` };
  } else if (!courante.data) {
    return { issue: "refusee", motif: "Ce véhicule n'a pas d'attributaire à retirer." };
  }

  const trace = await client.from("modification").insert({
    table_cible: "attribution_legere",
    numero: vehiculeId,
    champ: "attributaire_id",
    libelle_champ: "Attributaire",
    avant: courante.data?.attributaire_id ?? courante.data?.pool ?? "",
    apres: choix === "pool" ? pool : (attributaireId ?? ""),
    motif: typeof c.valeurs.motif === "string" && c.valeurs.motif.trim() ? c.valeurs.motif.trim() : choix === "" ? "Attribution retirée" : "Changement d'attributaire",
    statut: "appliquee",
    cree_par: utilisateurId,
  });
  if (trace.error) return { issue: "refusee", motif: `Changée, mais sans trace : ${trace.error.message}` };
  revalidatePath("/", "layout");
  return { issue: "ecrite", numero: c.numero };
}

async function poserAptitude(client: SupabaseClient, utilisateurId: string, c: Creation): Promise<ResultatEcriture> {
  const s = decomposerSujet(c.sujet);
  const chauffeurId = (await chauffeurIdDe(client, c.valeurs.chauffeurId)) ?? (s.genre === "chauffeur" ? await chauffeurIdDe(client, s.cle) : null);
  if (!chauffeurId) return { issue: "refusee", motif: "Non enregistré en base : chauffeur introuvable." };
  const aptitude = typeof c.valeurs.aptitude === "string" ? c.valeurs.aptitude : null;
  if (!aptitude) return { issue: "refusee", motif: "Non enregistré en base : aptitude absente." };
  const avant = await client.from("chauffeur").select("nom, prenom, aptitude").eq("id", chauffeurId).maybeSingle<{ nom: string; prenom: string; aptitude: string }>();
  if (!avant.data) return { issue: "refusee", motif: "Non enregistré en base : chauffeur introuvable." };
  const motif = typeof c.valeurs.motif === "string" ? c.valeurs.motif : null;
  const date = typeof c.valeurs.date === "string" ? c.valeurs.date : null;
  const maj = await client
    .from("chauffeur")
    .update({ aptitude, aptitude_motif: motif, aptitude_date: date, modifie_le: new Date().toISOString(), modifie_par: utilisateurId })
    .eq("id", chauffeurId);
  if (maj.error) return { issue: "refusee", motif: `Décision non enregistrée : ${maj.error.message}` };
  const trace = await client.from("modification").insert({
    table_cible: "chauffeur",
    numero: chauffeurId,
    champ: "aptitude",
    libelle_champ: "Aptitude",
    avant: avant.data.aptitude,
    apres: aptitude,
    motif: motif ?? "Décision d'aptitude",
    statut: "appliquee",
    cree_par: utilisateurId,
  });
  if (trace.error) return { issue: "refusee", motif: `Enregistrée, mais sans trace : ${trace.error.message}` };
  revalidatePath("/", "layout");
  return { issue: "ecrite", numero: c.numero };
}

async function poserStatut(client: SupabaseClient, utilisateurId: string, c: Creation): Promise<ResultatEcriture> {
  const s = decomposerSujet(c.sujet);
  const vehiculeId = (await vehiculeIdDe(client, c.valeurs.vehiculeId)) ?? (s.genre === "vehicule" ? await vehiculeIdDe(client, s.cle) : null);
  if (!vehiculeId) return { issue: "refusee", motif: "Non enregistré en base : véhicule introuvable." };
  const statut = typeof c.valeurs.statut === "string" ? c.valeurs.statut : null;
  if (!statut) return { issue: "refusee", motif: "Non enregistré en base : statut absent." };
  const avant = await client.from("vehicule").select("immatriculation, statut").eq("id", vehiculeId).maybeSingle<{ immatriculation: string; statut: string }>();
  if (!avant.data) return { issue: "refusee", motif: "Non enregistré en base : véhicule introuvable." };
  /* Sortir du parc est terminal : la date est exigée (0047), le motif la
     complète. Revenir d'une sortie les efface — sans quoi un véhicule remis en
     service traînerait une date de sortie qui ne veut plus rien dire. */
  const sortie =
    statut === "sorti"
      ? { date_sortie: typeof c.valeurs.dateSortie === "string" ? c.valeurs.dateSortie : null, motif_sortie: typeof c.valeurs.motifSortie === "string" ? c.valeurs.motifSortie : null }
      : avant.data.statut === "sorti"
        ? { date_sortie: null, motif_sortie: null }
        : {};
  if (statut === "sorti" && !sortie.date_sortie) return { issue: "refusee", motif: "Non enregistré en base : une sortie de parc porte sa date." };
  const maintenant = new Date().toISOString();
  const maj = await client.from("vehicule").update({ statut, ...sortie, modifie_le: maintenant, modifie_par: utilisateurId }).eq("id", vehiculeId);
  if (maj.error) return { issue: "refusee", motif: `Statut refusé : ${maj.error.message}` };
  const motif = [typeof c.valeurs.motif === "string" ? c.valeurs.motif : null, typeof c.valeurs.commentaire === "string" ? c.valeurs.commentaire : null].filter(Boolean).join(" — ") || `Statut posé (${c.numero})`;
  const trace = await client.from("modification").insert({ table_cible: "vehicule", numero: avant.data.immatriculation, champ: "statut", libelle_champ: "Statut", avant: avant.data.statut, apres: statut, motif, statut: "appliquee", cree_par: utilisateurId });
  if (trace.error) return { issue: "refusee", motif: `Statut posé, mais sans trace : ${trace.error.message}` };
  revalidatePath("/", "layout");
  return { issue: "ecrite", numero: c.numero };
}

/** Écrit une modification : la ligne change, et chaque champ changé laisse sa trace. */
/**
 * Écarter un véhicule du gabarit d'entretien de sa catégorie.
 *
 * L'ajustement n'a pas de numéro : sa clé est le couple véhicule + opération
 * (`ajustement_entretien`, 0002). Le numéro que la fiche affiche est recalculé
 * à chaque rendu à partir du rang de l'opération dans le gabarit — il ne
 * désigne rien de stable, et ne pouvait donc pas servir de clé.
 *
 * La ligne n'existe pas tant que personne n'a rien ajusté : c'est un dépôt, pas
 * une mise à jour. Le motif est obligatoire en base, et c'est voulu — il dit
 * pourquoi ce véhicule s'écarte du gabarit, ce qu'aucune périodicité ne dira.
 */
async function poserAjustementEntretien(
  client: SupabaseClient,
  utilisateurId: string,
  e: { numero: string; motif: string; diffs: { champ: string; libelleChamp: string; valeur: unknown }[]; sujet?: string; cleMetier?: string },
): Promise<ResultatEcriture> {
  const s = decomposerSujet(e.sujet ?? "");
  const vehiculeId = s.genre === "vehicule" ? await vehiculeIdDe(client, s.cle) : null;
  if (!vehiculeId) return { issue: "refusee", motif: "Non enregistré en base : véhicule introuvable." };
  const code = e.cleMetier;
  if (!code) return { issue: "refusee", motif: "Non enregistré en base : opération d'entretien non désignée." };

  const valeur = (champ: string) => e.diffs.find((d) => d.champ === champ)?.valeur;
  const entier = (x: unknown) => {
    if (x === undefined || x === null || x === "") return null;
    const n = Number(String(x).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  /* Le motif durable — celui qui reste sur la ligne — est un champ du
     formulaire ; à défaut, le motif de la modification fait l'affaire, car la
     base en exige un. */
  const motifDurable = (valeur("motif") as string | undefined)?.trim() || e.motif.trim();
  if (!motifDurable) return { issue: "refusee", motif: "Non enregistré en base : un ajustement doit dire pourquoi." };

  const ancien = await client.from("ajustement_entretien").select("km, heures, mois").eq("vehicule_id", vehiculeId).eq("operation_code", code).maybeSingle<{ km: number | null; heures: number | null; mois: number | null }>();
  const depot = await client.from("ajustement_entretien").upsert(
    {
      vehicule_id: vehiculeId,
      operation_code: code,
      /* Un champ que l'agent n'a pas touché garde sa valeur : sans quoi ajuster
         le kilométrage effacerait la périodicité en mois posée la veille. */
      km: e.diffs.some((d) => d.champ === "km") ? entier(valeur("km")) : (ancien.data?.km ?? null),
      heures: e.diffs.some((d) => d.champ === "heures") ? entier(valeur("heures")) : (ancien.data?.heures ?? null),
      mois: e.diffs.some((d) => d.champ === "mois") ? entier(valeur("mois")) : (ancien.data?.mois ?? null),
      motif: motifDurable,
      modifie_le: new Date().toISOString(),
      modifie_par: utilisateurId,
      cree_par: utilisateurId,
    },
    { onConflict: "vehicule_id,operation_code" },
  );
  if (depot.error) return { issue: "refusee", motif: `Ajustement non enregistré : ${depot.error.message}` };

  const trace = await client.from("modification").insert(
    e.diffs.map((d) => ({ table_cible: "ajustement_entretien", numero: `${vehiculeId}:${code}`, champ: d.champ, libelle_champ: d.libelleChamp, avant: "", apres: String(d.valeur ?? ""), motif: e.motif, statut: "appliquee", cree_par: utilisateurId })),
  );
  if (trace.error) return { issue: "refusee", motif: `Ajustée, mais sans trace : ${trace.error.message}` };
  revalidatePath("/", "layout");
  return { issue: "ecrite", numero: e.numero };
}

export async function ecrireModification(e: {
  numero: string;
  type: TypeTransaction;
  motif: string;
  diffs: { champ: string; libelleChamp: string; avant: string; apres: string; valeur: unknown }[];
  /** La fiche d'où part la modification, quand la ligne ne se repère pas seule. */
  sujet?: string;
  /** La clé métier de la ligne quand son numéro n'en est pas une. */
  cleMetier?: string;
}): Promise<ResultatEcriture> {
  if (!authentificationReelle()) return { issue: "hors-base" };
  const client0 = await clientServeur();
  const moi0 = await utilisateurCourant(client0);
  if (!moi0) return { issue: "refusee", motif: "Session absente : reconnectez-vous." };
  /* L'ajustement d'un plan d'entretien ne se range pas par numéro : sa clé est
     le couple véhicule + opération, et la ligne n'existe pas toujours encore. */
  if (e.type === "entretien") return poserAjustementEntretien(client0, moi0.utilisateurId, e);
  const table = tableDe(e.type);
  if (!table) return { issue: "hors-base" };
  const client = client0;
  const moi = moi0;

  const colonnes = colonnesModification(e.type, e.diffs);

  /*
   * Le plan car se coche sur le véhicule, et s'écrit sur son attribution.
   *
   * Demande du métier du 15 septembre 2026 : une case à cocher dans la fiche du
   * véhicule. La colonne, elle, est sur `attribution_legere` — et la base
   * interdit un plan car sans attributaire (`plan_car_nomme`, 0004). C'est
   * cohérent : un plan car est un engagement envers **quelqu'un**, pas une
   * propriété d'un châssis. On écrit donc sur l'attribution en cours, et on
   * refuse en le disant quand personne ne tient le véhicule.
   */
  const ecartPlanCar = e.type === "vehicule" ? e.diffs.find((d) => d.champ === "planCar") : undefined;
  if (ecartPlanCar) {
    const cle = cleDe("vehicule", e.numero);
    const v = await client.from("vehicule").select("id").eq(cle.colonne, cle.valeur).maybeSingle<{ id: string }>();
    if (!v.data) return { issue: "refusee", motif: "Plan car non enregistré : véhicule introuvable." };
    const courante = await client.from("attribution_legere").select("id, attributaire_id").eq("vehicule_id", v.data.id).is("fin", null).maybeSingle<{ id: string; attributaire_id: string | null }>();
    if (courante.error) return { issue: "refusee", motif: `Plan car non enregistré : ${courante.error.message}` };
    /* La case rend un booléen ; une trace ancienne peut porter « oui ». */
    const brut = ecartPlanCar.valeur;
    const veut = typeof brut === "boolean" ? brut : ["oui", "true", "1"].includes(String(brut).trim().toLowerCase());
    if (veut && !courante.data?.attributaire_id) {
      return { issue: "refusee", motif: "Un plan car s'engage envers quelqu'un : attribuez d'abord ce véhicule à une personne, puis cochez le plan car." };
    }
    if (!courante.data) return { issue: "refusee", motif: "Ce véhicule n'a pas d'attribution en cours : rien où poser le plan car." };
    const pose = await client.from("attribution_legere").update({ plan_car: veut, modifie_le: new Date().toISOString(), modifie_par: moi.utilisateurId }).eq("id", courante.data.id);
    if (pose.error) return { issue: "refusee", motif: `Plan car non enregistré : ${pose.error.message}` };
    const trace = await client.from("modification").insert({
      table_cible: "attribution_legere",
      numero: v.data.id,
      champ: "plan_car",
      libelle_champ: "Plan car",
      avant: ecartPlanCar.avant,
      apres: ecartPlanCar.apres,
      motif: e.motif || (veut ? "Plan car engagé" : "Plan car levé"),
      statut: "appliquee",
      cree_par: moi.utilisateurId,
    });
    if (trace.error) return { issue: "refusee", motif: `Plan car posé, mais sans trace : ${trace.error.message}` };
    /* Seul écart de la saisie : plus rien à écrire sur le véhicule lui-même. */
    if (e.diffs.length === 1) {
      revalidatePath("/", "layout");
      return { issue: "ecrite", numero: e.numero };
    }
  }

  /*
   * Un écart sur un champ qu'aucune colonne ne porte était **silencieusement
   * perdu** : la trace s'écrivait, la modale disait « enregistré », et la base
   * ne bougeait pas. C'est la même faute que le « hors-base » muet corrigé ce
   * matin — l'écran affirmait ce que la base ignorait.
   */
  if (e.diffs.length > 0 && Object.keys(colonnes).length === 0) {
    return {
      issue: "refusee",
      motif: `Rien n'a été enregistré : ${e.diffs.map((d) => d.libelleChamp.toLowerCase()).join(", ")} ne se ${e.diffs.length > 1 ? "modifient" : "modifie"} pas ici.`,
    };
  }
  /* Le fournisseur d'un véhicule s'écrit en deux colonnes : son nom en clair,
     que le module pur a déjà posé, et le lien vers le référentiel, qu'il faut
     une base pour résoudre. Changer le nom refait le lien — ou l'efface, quand
     le nouveau vendeur n'est pas au référentiel. */
  if (e.type === "vehicule" && "fournisseur" in colonnes) colonnes.fournisseur_id = await prestataireIdDe(client, colonnes.fournisseur);
  /*
   * Le site : choisi, il arrive en identifiant ; écrit, il arrive en nom — et
   * la colonne attend un identifiant.
   *
   * Sans cette résolution, changer le site d'un véhicule pour un site nouveau
   * envoyait son nom dans `site_id` : Postgres refusait, la modification était
   * perdue, et aucun site n'était créé. La création passait, elle, parce
   * qu'elle traverse `rattacher()` — d'où un geste qui marchait à la création
   * et échouait à la modification (signalé le 15 septembre 2026).
   *
   * La région et le type se lisent dans les écarts : ils ne sont pas des
   * colonnes du véhicule, ils ne servent qu'à fonder le site.
   */
  /*
   * L'usage arrive en libellé et la colonne attend une énumération : on scinde,
   * comme à la création. Sans cela, changer l'usage d'un véhicule était refusé
   * par Postgres — même pour un usage ordinaire choisi dans la liste, puisque
   * « Frigorifique » n'est pas « frigorifique » (défaut du 15 septembre 2026,
   * introduit en rendant le champ créable).
   */
  if (e.type === "vehicule" && typeof colonnes.usage === "string") {
    const { usage, usage_metier } = scinderUsage(colonnes.usage);
    colonnes.usage = usage;
    colonnes.usage_metier = usage_metier;
  }
  if ("site_id" in colonnes) {
    const ecart = (champ: string) => e.diffs.find((d) => d.champ === champ)?.valeur;
    const id = await siteIdDe(client, colonnes.site_id, ecart("siteRegion"), ecart("siteType"), moi.utilisateurId);
    if (!id) {
      return {
        issue: "refusee",
        motif: `Le site « ${String(colonnes.site_id)} » n'existe pas et n'a pas pu être créé : indiquez sa région et son type.`,
      };
    }
    colonnes.site_id = id;
  }
  /* Tout se repère par `numero`, sauf le véhicule : sa clé est son
     immatriculation — celle d'**avant**, puisqu'une plaque peut être ce qui
     change. La trace, elle, se range sous cette même clé. */
  const cle = cleDe(e.type, e.numero);
  /* La fiche d'un chauffeur se nomme « CHA-babacar-ndiaye » : lisible, mais ce
     n'est pas la clé de la table. On la traduit ici — la base est sous la main,
     et elle seule sait à qui l'adresse renvoie. */
  if (e.type === "chauffeur") {
    const id = await chauffeurIdDe(client, cle.valeur);
    if (!id) return { issue: "refusee", motif: `Modification non appliquée : ${e.numero} n'est pas en base.` };
    cle.valeur = id;
  }
  if (Object.keys(colonnes).length > 0) {
    /* Le relevé n'a pas de colonnes de modification : il se corrige rarement, et la trace suffit. */
    const horodate = table === "releve_kilometrique" ? {} : { modifie_le: new Date().toISOString(), modifie_par: moi.utilisateurId };
    const maj = await client.from(table).update({ ...colonnes, ...horodate }).eq(cle.colonne, cle.valeur).select(cle.colonne);
    if (maj.error) {
      const plaque = typeof colonnes.immatriculation === "string" ? afficher(colonnes.immatriculation) : null;
      return { issue: "refusee", motif: plaque && maj.error.code === "23505" ? `${plaque} est déjà portée par un autre véhicule du parc.` : `Modification refusée : ${maj.error.message}` };
    }
    if (!maj.data || maj.data.length === 0) return { issue: "refusee", motif: `Modification non appliquée : ${e.numero} n'est pas en base.` };
  }
  const trace = await client.from("modification").insert(e.diffs.map((d) => ({ table_cible: table, numero: cle.valeur, champ: d.champ, libelle_champ: d.libelleChamp, avant: d.avant, apres: d.apres, motif: e.motif, statut: "appliquee", cree_par: moi.utilisateurId })));
  if (trace.error) return { issue: "refusee", motif: `Modifiée, mais sans trace : ${trace.error.message}` };
  revalidatePath("/", "layout");
  return { issue: "ecrite", numero: e.numero };
}
