/* ============================================================================
 * L'assistant de démonstration — il lit, il ne devine pas.
 *
 * Il répond **depuis les lignes des rapports**, pas depuis un calcul à lui :
 * `construireRapport` produit exactement ce que l'écran montre, et l'assistant
 * le résume. C'est ce qui garantit qu'un chiffre cité en réunion se retrouve à
 * l'écran, au même endroit, à la même valeur. Un assistant qui recompterait de
 * son côté finirait par diverger, et une divergence d'un franc suffit à ce que
 * personne ne fasse plus confiance à aucun des deux.
 *
 * Chaque réponse porte donc **le lien du rapport qui fait foi**.
 *
 * Quand l'API Claude prendra le relais (`assistant-claude.ts`), ce sont ces
 * mêmes fonctions qui lui seront données comme outils de lecture : la source
 * des chiffres ne changera pas, seule la façon de comprendre la question.
 * ==========================================================================*/

import {
  INTENTIONS,
  normaliserQuestion,
  reconnaitre,
  type Assistant,
  type Demande,
  type LigneReponse,
  type Reponse,
} from "@/domaine/assistant";
import { afficher, normaliser } from "@/domaine/immatriculation";
import { estEtat, texteDe, type LigneRapport, type ValeurRapport } from "@/domaine/rapports";
import { type Periode } from "@/domaine/periodes";
import type { Ton } from "@/domaine/libelles";
import { montant as formaterMontant, date as formaterDate, kilometrage, nombre, pourcentage } from "@/lib/format";
import { FLOTTE } from "./parc-demo";
import { construireRapport, type ContexteRapport } from "./rapports-demo";
import { fichePourImmatriculation } from "./fiche-demo";

/* -- Outils -------------------------------------------------------------------- */

const DOUZE_MOIS: Periode = { preset: "12-mois", debut: null, fin: null };
const contexte = (periode: Periode = DOUZE_MOIS): ContexteRapport => ({ periode, perimetre: "exploitation" });

/** La valeur brute d'une colonne, pour compter et comparer. */
function nb(l: LigneRapport, cle: string): number {
  const v = l[cle];
  return typeof v === "number" ? v : 0;
}

function txt(l: LigneRapport, cle: string): string {
  return texteDe(l[cle] ?? null);
}

function tonDe(v: ValeurRapport): Ton | undefined {
  return estEtat(v) ? v.ton : undefined;
}

/** Le lien de la fiche que porte une ligne de rapport, quand elle en a un. */
function lienDe(l: LigneRapport, onglet?: string): string | undefined {
  const immat = typeof l.immatriculationCanonique === "string" ? l.immatriculationCanonique : null;
  if (immat) return `/flotte/${immat}${onglet ? `?onglet=${onglet}` : ""}`;
  const chauffeur = typeof l.chauffeurId === "string" ? l.chauffeurId : null;
  return chauffeur ? `/chauffeurs/${chauffeur}` : undefined;
}

/** Compte les lignes par valeur d'une colonne, de la plus fournie à la moins. */
function repartition(lignes: LigneRapport[], cle: string): { valeur: string; compte: number }[] {
  const parValeur = new Map<string, number>();
  for (const l of lignes) {
    const v = txt(l, cle) || "—";
    parValeur.set(v, (parValeur.get(v) ?? 0) + 1);
  }
  return [...parValeur.entries()].map(([valeur, compte]) => ({ valeur, compte })).sort((a, b) => b.compte - a.compte);
}

/** L'immatriculation citée dans la question, si elle désigne un véhicule du parc. */
function vehiculeCite(question: string, origine?: string): string | null {
  const compact = question
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  for (const l of FLOTTE) {
    if (compact.includes(l.vehicule.immatriculation)) return l.vehicule.immatriculation;
  }
  /* « Ce véhicule », posé depuis une fiche : c'est celui de l'écran. */
  const depuisFiche = origine?.match(/^\/flotte\/([A-Za-z0-9]+)/);
  if (depuisFiche && /\bce vehicule\b|\bce camion\b|\bcelui ci\b|\bil\b/.test(normaliserQuestion(question))) {
    const canonique = normaliser(depuisFiche[1]!);
    if (FLOTTE.some((l) => l.vehicule.immatriculation === canonique)) return canonique;
  }
  return null;
}

const ligne = (l: LigneRapport, titreCle: string, precisionCle: string | null, valeur: string | undefined, tonCle?: string, onglet?: string): LigneReponse => ({
  titre: txt(l, titreCle),
  precision: precisionCle ? txt(l, precisionCle) || undefined : undefined,
  valeur,
  ton: tonCle ? tonDe(l[tonCle] ?? null) : undefined,
  href: lienDe(l, onglet),
});

/* -- Les réponses --------------------------------------------------------------- */

function fiche(immatriculation: string): Reponse {
  const l = FLOTTE.find((x) => x.vehicule.immatriculation === immatriculation)!;
  const v = l.vehicule;
  const f = fichePourImmatriculation(immatriculation);
  const dispo = construireRapport("flotte-disponibilite", contexte()).find((x) => x.immatriculationCanonique === immatriculation);
  const cout = construireRapport("couts-vehicule", contexte()).find((x) => x.immatriculationCanonique === immatriculation);
  const conso = construireRapport("carburant-consommation", contexte()).find((x) => x.immatriculationCanonique === immatriculation);
  const aTraiter = (f?.documents ?? []).filter((d) => d.etat === "manquant" || d.etat === "echu" || d.etat === "bientot");

  return {
    texte: `${afficher(immatriculation)} — ${v.marque} ${v.appellation}, ${dispo ? txt(dispo, "etat").toLowerCase() : "situation inconnue"}${dispo && txt(dispo, "motif") ? ` : ${txt(dispo, "motif")}` : ""}.`,
    chiffres: [
      { libelle: "Statut", valeur: dispo ? txt(dispo, "statut") : "—", ton: dispo ? tonDe(dispo.statut ?? null) : undefined },
      { libelle: "Conducteur du jour", valeur: (dispo && txt(dispo, "conducteur")) || "aucun", ton: dispo && txt(dispo, "conducteur") ? "favorable" : "vigilance" },
      { libelle: "Kilométrage", valeur: kilometrage(l.kilometrage) },
      ...(cout ? [{ libelle: "Coût 12 mois", valeur: formaterMontant(nb(cout, "total")), precision: `${formaterMontant(nb(cout, "coutParKm"))}/km · ${txt(cout, "verdict").toLowerCase()}` }] : []),
      ...(conso && conso.l100 !== null ? [{ libelle: "Consommation", valeur: `${nombre(nb(conso, "l100"), 1)} L/100`, precision: `référence ${nombre(nb(conso, "reference"), 1)} · ${txt(conso, "verdict").toLowerCase()}` }] : []),
      { libelle: "Documents à traiter", valeur: String(aTraiter.length), ton: aTraiter.length ? "vigilance" : "favorable" },
    ],
    lignes: aTraiter.slice(0, 4).map((d) => ({
      titre: d.type,
      precision: d.echeance ? `échéance ${formaterDate(d.echeance)}` : "aucune pièce enregistrée",
      valeur: d.etat === "manquant" ? "Manquant" : d.etat === "echu" ? "Échu" : "Bientôt",
      ton: d.etat === "bientot" ? "vigilance" : "defavorable",
      href: `/flotte/${immatriculation}?onglet=conformite`,
    })),
    sources: [{ libelle: `Fiche ${afficher(immatriculation)}`, href: `/flotte/${immatriculation}` }],
    suites: [`Combien coûte ${afficher(immatriculation)} au kilomètre ?`, `Quels documents manquent à ${afficher(immatriculation)} ?`],
  };
}

function repondreIntention(cle: string, d: Demande): Reponse {
  switch (cle) {
    /* ---- Flotte ---- */
    case "parc-taille": {
      const lignes = construireRapport("flotte-details", contexte());
      const parCategorie = repartition(lignes, "categorie");
      const engages = lignes.filter((l) => l.engage === true).length;
      return {
        texte: `Le parc compte ${lignes.length} véhicules, dont ${engages} engagés au parc.`,
        chiffres: parCategorie.slice(0, 5).map((r) => ({ libelle: r.valeur, valeur: String(r.compte) })),
        lignes: repartition(lignes, "businessUnit")
          .slice(0, 6)
          .map((r) => ({ titre: r.valeur, valeur: `${r.compte} véhicule${r.compte > 1 ? "s" : ""}` })),
        sources: [{ libelle: "Détail des véhicules", href: "/rapports/flotte-details" }],
        suites: ["Combien de véhicules sont prêts à charger ?", "Quels véhicules sont immobilisés ?"],
      };
    }

    case "disponibilite": {
      const lignes = construireRapport("flotte-disponibilite", contexte());
      const parEtat = repartition(lignes, "etat");
      const prets = lignes.filter((l) => txt(l, "etat") === "Prêt à charger");
      const engages = lignes.filter((l) => txt(l, "etat") !== "Hors périmètre");
      const charge = prets.reduce((s, l) => s + nb(l, "chargeUtile"), 0);
      const nonPrets = lignes.filter((l) => txt(l, "etat") === "Sans conducteur" || txt(l, "etat") === "Conducteur empêché");
      return {
        texte: `${prets.length} véhicules sont prêts à charger sur ${engages.length} engagés, soit ${pourcentage(engages.length ? (prets.length / engages.length) * 100 : 0, 0)} du parc.`,
        chiffres: [
          { libelle: "Prêts à charger", valeur: String(prets.length), ton: "favorable" },
          { libelle: "Charge utile prête", valeur: `${nombre(Math.round(charge / 1000))} t` },
          ...parEtat.filter((r) => r.valeur !== "Prêt à charger").map((r) => ({ libelle: r.valeur, valeur: String(r.compte), ton: (r.valeur === "Immobilisé" ? "defavorable" : "vigilance") as Ton })),
        ],
        lignes: nonPrets.slice(0, 6).map((l) => ligne(l, "immatriculation", "motif", txt(l, "etat"), "etat")),
        sources: [
          { libelle: "Prêts à charger", href: "/rapports/flotte-disponibilite" },
          { libelle: "Disponibilité du jour", href: "/disponibilite" },
        ],
        suites: ["Quels véhicules n'ont pas de chauffeur ?", "Quels véhicules sont immobilisés ?"],
      };
    }

    case "immobilises": {
      const lignes = construireRapport("flotte-disponibilite", contexte()).filter((l) => txt(l, "etat") === "Immobilisé");
      const administratives = lignes.filter((l) => txt(l, "immobilisationMotif"));
      return {
        texte: lignes.length
          ? `${lignes.length} véhicule${lignes.length > 1 ? "s sont immobilisés" : " est immobilisé"}, dont ${administratives.length} pour un document manquant ou échu.`
          : "Aucun véhicule immobilisé aujourd'hui.",
        chiffres: [
          { libelle: "Immobilisés", valeur: String(lignes.length), ton: lignes.length ? "defavorable" : "favorable" },
          { libelle: "Dont administratif", valeur: String(administratives.length), precision: "un document régularisé les remet en service" },
        ],
        lignes: lignes.map((l) => ligne(l, "immatriculation", "motif", txt(l, "statut"), "statut", "conformite")),
        sources: [{ libelle: "Prêts à charger", href: "/rapports/flotte-disponibilite" }],
        suites: ["Quels documents sont échus ?", "Quels ordres de travail sont ouverts ?"],
      };
    }

    case "sans-chauffeur": {
      const lignes = construireRapport("flotte-affectations", contexte()).filter((l) => txt(l, "couverture") === "Sans conducteur" || txt(l, "couverture") === "Suppléant seul");
      const sansPersonne = lignes.filter((l) => txt(l, "couverture") === "Sans conducteur");
      return {
        texte: sansPersonne.length
          ? `${sansPersonne.length} véhicule${sansPersonne.length > 1 ? "s n'ont" : " n'a"} aucun conducteur affecté.`
          : "Tous les véhicules ont un conducteur affecté.",
        chiffres: [
          { libelle: "Sans conducteur", valeur: String(sansPersonne.length), ton: sansPersonne.length ? "defavorable" : "favorable" },
          { libelle: "Suppléant seul", valeur: String(lignes.length - sansPersonne.length), ton: "vigilance", precision: "sans titulaire" },
        ],
        lignes: lignes.map((l) => ligne(l, "immatriculation", "vehicule", txt(l, "couverture"), "couverture", "affectations")),
        sources: [
          { libelle: "Affectations en cours", href: "/rapports/flotte-affectations" },
          { libelle: "Affectations", href: "/affectations" },
        ],
      };
    }

    /* ---- Conformité ---- */
    case "conformite": {
      const lignes = construireRapport("conformite-documents", contexte());
      const manquants = lignes.filter((l) => txt(l, "etat") === "Manquant");
      const echus = lignes.filter((l) => txt(l, "etat") === "Échu");
      const bientot = lignes.filter((l) => txt(l, "etat") === "Bientôt échu");
      const aTraiter = [...manquants, ...echus, ...bientot];
      return {
        texte: aTraiter.length
          ? `${aTraiter.length} documents demandent une action : ${manquants.length} manquants, ${echus.length} échus, ${bientot.length} bientôt échus.`
          : "Tous les documents du parc et des chauffeurs sont à jour.",
        chiffres: [
          { libelle: "Manquants", valeur: String(manquants.length), ton: manquants.length ? "defavorable" : "favorable" },
          { libelle: "Échus", valeur: String(echus.length), ton: echus.length ? "defavorable" : "favorable" },
          { libelle: "Bientôt échus", valeur: String(bientot.length), ton: bientot.length ? "vigilance" : "favorable" },
        ],
        lignes: aTraiter
          .slice(0, 8)
          .map((l) => ({ titre: `${txt(l, "porteur")} · ${txt(l, "document")}`, precision: txt(l, "echeance") ? `échéance ${formaterDate(txt(l, "echeance"))}` : "aucune pièce", valeur: txt(l, "etat"), ton: tonDe(l.etat ?? null), href: lienDe(l, "conformite") })),
        sources: [
          { libelle: "Documents et échéances", href: "/rapports/conformite-documents" },
          { libelle: "Conformité", href: "/conformite" },
        ],
        suites: ["Quels véhicules sont immobilisés ?", "Quels chauffeurs ne peuvent pas conduire ?"],
      };
    }

    case "chauffeurs-conformite": {
      const lignes = construireRapport("chauffeurs-details", contexte());
      const nonConformes = lignes.filter((l) => txt(l, "conformite") === "Non conforme");
      return {
        texte: nonConformes.length
          ? `${nonConformes.length} chauffeur${nonConformes.length > 1 ? "s ne peuvent" : " ne peut"} pas conduire : permis ou visite médicale non valide, ou inaptitude déclarée.`
          : "Tous les chauffeurs sont en règle et aptes.",
        chiffres: [
          { libelle: "Non conformes", valeur: String(nonConformes.length), ton: nonConformes.length ? "defavorable" : "favorable" },
          { libelle: "Effectif", valeur: String(lignes.length) },
        ],
        lignes: nonConformes.map((l) => ({
          titre: txt(l, "nom"),
          precision: `permis ${formaterDate(txt(l, "permisEcheance")) || "—"} · visite ${formaterDate(txt(l, "visiteMedicale")) || "—"} · ${txt(l, "aptitude").toLowerCase()}`,
          valeur: txt(l, "statut"),
          ton: "defavorable" as Ton,
          href: lienDe(l),
        })),
        sources: [{ libelle: "Détail des chauffeurs", href: "/rapports/chauffeurs-details" }],
      };
    }

    /* ---- Coûts ---- */
    case "cout-total": {
      const postes = construireRapport("couts-poste-mois", contexte());
      const total = postes.reduce((s, l) => s + nb(l, "total"), 0);
      const bus = construireRapport("couts-business-unit", contexte());
      return {
        texte: `Le parc a coûté ${formaterMontant(total)} sur les douze derniers mois, périmètre exploitation.`,
        chiffres: postes.slice(0, 4).map((l) => ({ libelle: txt(l, "poste"), valeur: formaterMontant(nb(l, "total")), precision: pourcentage(nb(l, "part"), 0) })),
        lignes: bus.map((l) => ({ titre: txt(l, "businessUnit"), precision: `${nb(l, "vehicules")} véhicules · ${formaterMontant(nb(l, "coutParKm"))}/km`, valeur: formaterMontant(nb(l, "total")) })),
        sources: [
          { libelle: "Dépenses par poste", href: "/rapports/couts-poste-mois" },
          { libelle: "Coût par business unit", href: "/rapports/couts-business-unit" },
        ],
        suites: ["Quel véhicule coûte le plus cher au kilomètre ?", "Quels véhicules dérivent en consommation ?"],
      };
    }

    case "cout-vehicule": {
      const lignes = construireRapport("couts-vehicule", contexte());
      const parKm = [...lignes].sort((a, b) => nb(b, "coutParKm") - nb(a, "coutParKm"));
      const aArbitrer = lignes.filter((l) => txt(l, "verdict") === "À arbitrer");
      const premier = parKm[0];
      return {
        texte: premier
          ? `${txt(premier, "immatriculation")} coûte le plus au kilomètre : ${formaterMontant(nb(premier, "coutParKm"))}/km, ${pourcentage(Math.abs(nb(premier, "ecartCategorie")), 0)} au-dessus de la médiane de sa catégorie.`
          : "Aucun véhicule à comparer sur la période.",
        chiffres: [
          { libelle: "À arbitrer", valeur: String(aArbitrer.length), ton: aArbitrer.length ? "defavorable" : "favorable", precision: "au-delà de 40 % de la médiane" },
          { libelle: "Coût total du parc", valeur: formaterMontant(lignes.reduce((s, l) => s + nb(l, "total"), 0)) },
        ],
        lignes: parKm.slice(0, 6).map((l) => ({
          titre: txt(l, "immatriculation"),
          precision: `${txt(l, "vehicule")} · ${formaterMontant(nb(l, "total"))} sur 12 mois`,
          valeur: `${formaterMontant(nb(l, "coutParKm"))}/km`,
          ton: tonDe(l.verdict ?? null),
          href: lienDe(l, "couts"),
        })),
        sources: [{ libelle: "Coût par véhicule", href: "/rapports/couts-vehicule" }],
        suites: ["Combien coûte le parc sur douze mois ?", "Quels véhicules dérivent en consommation ?"],
      };
    }

    case "consommation": {
      const lignes = construireRapport("carburant-consommation", contexte());
      const derives = lignes.filter((l) => txt(l, "verdict") === "Dérive");
      const surveiller = lignes.filter((l) => txt(l, "verdict") === "À surveiller");
      const litres = lignes.reduce((s, l) => s + nb(l, "litres"), 0);
      return {
        texte: derives.length
          ? `${derives.length} véhicule${derives.length > 1 ? "s dérivent" : " dérive"} de plus de 15 % au-dessus de la référence de leur catégorie, et ${surveiller.length} sont à surveiller.`
          : `Aucune dérive de consommation ; ${surveiller.length} véhicules restent à surveiller.`,
        chiffres: [
          { libelle: "En dérive", valeur: String(derives.length), ton: derives.length ? "defavorable" : "favorable" },
          { libelle: "À surveiller", valeur: String(surveiller.length), ton: surveiller.length ? "vigilance" : "favorable" },
          { libelle: "Litres sur 12 mois", valeur: `${nombre(litres)} L` },
        ],
        lignes: [...derives, ...surveiller].slice(0, 6).map((l) => ({
          titre: txt(l, "immatriculation"),
          precision: `${nombre(nb(l, "l100"), 1)} L/100 contre ${nombre(nb(l, "reference"), 1)} en référence`,
          valeur: `${nb(l, "ecart") > 0 ? "+" : ""}${pourcentage(nb(l, "ecart"), 0)}`,
          ton: tonDe(l.verdict ?? null),
          href: lienDe(l, "carburant"),
        })),
        sources: [
          { libelle: "Consommation par véhicule", href: "/rapports/carburant-consommation" },
          { libelle: "Carburant", href: "/carburant" },
        ],
      };
    }

    case "cuve": {
      /* Le journal de la cuve est rendu du plus ancien au plus récent, parce que
         le stock se recalcule dans cet ordre : le dernier mouvement est en fin
         de liste, pas en tête. */
      const mouvements = [...construireRapport("carburant-cuve", contexte())].sort((a, b) => txt(b, "date").localeCompare(txt(a, "date")));
      const dernier = mouvements[0];
      const livraisons = mouvements.filter((l) => txt(l, "sens") === "Livraison");
      const sorties = mouvements.reduce((s, l) => s + nb(l, "sortie"), 0);
      return {
        texte: dernier
          ? `La cuve interne affiche ${nombre(nb(dernier, "stock"))} litres au dernier mouvement, le ${formaterDate(txt(dernier, "date"))}.`
          : "Aucun mouvement de cuve sur la période.",
        chiffres: [
          { libelle: "Stock", valeur: dernier ? `${nombre(nb(dernier, "stock"))} L` : "—" },
          { libelle: "Sorties 12 mois", valeur: `${nombre(Math.round(sorties))} L`, precision: "les pleins pris à la cuve" },
          { libelle: "Livraisons", valeur: String(livraisons.length) },
        ],
        lignes: mouvements.slice(0, 5).map((l) => ({
          titre: txt(l, "libelle"),
          precision: `${formaterDate(txt(l, "date"))} · stock ${nombre(nb(l, "stock"))} L`,
          valeur: txt(l, "sens"),
          ton: tonDe(l.sens ?? null),
        })),
        sources: [
          { libelle: "Journal de la cuve", href: "/rapports/carburant-cuve" },
          { libelle: "Carburant", href: "/carburant?vue=cuve" },
        ],
      };
    }

    /* ---- Maintenance & incidents ---- */
    case "maintenance": {
      const ordres = construireRapport("maintenance-ordres", contexte());
      const ouverts = ordres.filter((l) => txt(l, "statut") === "Planifié" || txt(l, "statut") === "En atelier");
      const aFaire = construireRapport("maintenance-a-faire", contexte());
      const urgents = aFaire.filter((l) => txt(l, "urgence") === "Immobilisant" || txt(l, "urgence") === "Urgent");
      return {
        texte: `${ouverts.length} ordre${ouverts.length > 1 ? "s" : ""} de travail ouvert${ouverts.length > 1 ? "s" : ""}, et ${aFaire.length} travaux réclamés par les fiches dont ${urgents.length} urgents.`,
        chiffres: [
          { libelle: "Ordres ouverts", valeur: String(ouverts.length), ton: ouverts.length ? "vigilance" : "favorable" },
          { libelle: "À faire", valeur: String(aFaire.length) },
          { libelle: "Urgents", valeur: String(urgents.length), ton: urgents.length ? "defavorable" : "favorable" },
        ],
        lignes: [...ouverts, ...urgents].slice(0, 6).map((l) => ({
          titre: `${txt(l, "immatriculation")} · ${txt(l, "objet") || txt(l, "libelle")}`,
          precision: txt(l, "garage") || txt(l, "echeance") || undefined,
          valeur: txt(l, "statut") || txt(l, "urgence"),
          ton: tonDe(l.statut ?? l.urgence ?? null),
          href: lienDe(l, "maintenance"),
        })),
        sources: [
          { libelle: "Ordres de travail", href: "/rapports/maintenance-ordres" },
          { libelle: "Maintenance", href: "/maintenance" },
        ],
      };
    }

    case "incidents": {
      const lignes = construireRapport("incidents-declarations", contexte());
      const accidents = lignes.filter((l) => txt(l, "nature") === "Accident");
      const cout = lignes.reduce((s, l) => s + nb(l, "cout"), 0);
      const jours = lignes.reduce((s, l) => s + nb(l, "immobilisation"), 0);
      return {
        texte: `${lignes.length} déclarations sur douze mois, dont ${accidents.length} accidents, pour ${formaterMontant(cout)} de coûts rattachés et ${nombre(jours)} jours d'immobilisation.`,
        chiffres: [
          { libelle: "Déclarations", valeur: String(lignes.length) },
          { libelle: "Accidents", valeur: String(accidents.length), ton: accidents.length ? "defavorable" : "favorable" },
          { libelle: "Coût rattaché", valeur: formaterMontant(cout) },
          { libelle: "Immobilisation", valeur: `${nombre(jours)} j` },
        ],
        lignes: lignes.slice(0, 6).map((l) => ({
          titre: `${txt(l, "immatriculation")} · ${txt(l, "type")}`,
          precision: `${formaterDate(txt(l, "date"))}${txt(l, "chauffeur") ? ` · ${txt(l, "chauffeur")}` : ""}`,
          valeur: txt(l, "statut"),
          ton: tonDe(l.nature ?? null),
          href: lienDe(l, "incidents"),
        })),
        sources: [
          { libelle: "Déclarations d'incidents", href: "/rapports/incidents-declarations" },
          { libelle: "Incidents & sinistres", href: "/incidents" },
        ],
        suites: [`Quels véhicules sont immobilisés ?`, `Qui sont les meilleurs chauffeurs du mois ?`],
      };
    }

    /* ---- Caisse & achats ---- */
    case "caisse": {
      /* Le solde d'une caisse est celui du **dernier** mouvement : on trie par
         date décroissante plutôt que de se fier à l'ordre du journal. */
      const mouvements = [...construireRapport("caisse-journal", contexte())].sort((a, b) => txt(b, "date").localeCompare(txt(a, "date")));
      const dernier = mouvements[0];
      const sansJustificatif = mouvements.filter((l) => txt(l, "justificatif") === "Manquant");
      const sorties = mouvements.reduce((s, l) => s + nb(l, "sortie"), 0);
      return {
        texte: dernier
          ? `La caisse parc affiche ${formaterMontant(nb(dernier, "solde"))} au dernier mouvement, le ${formaterDate(txt(dernier, "date"))}.`
          : "Aucun mouvement de caisse sur la période.",
        chiffres: [
          { libelle: "Solde", valeur: dernier ? formaterMontant(nb(dernier, "solde")) : "—" },
          { libelle: "Sorties 12 mois", valeur: formaterMontant(sorties) },
          { libelle: "Sans justificatif", valeur: String(sansJustificatif.length), ton: sansJustificatif.length ? "vigilance" : "favorable" },
        ],
        lignes: sansJustificatif.slice(0, 5).map((l) => ({ titre: txt(l, "libelle"), precision: `${formaterDate(txt(l, "date"))} · ${txt(l, "beneficiaire")}`, valeur: formaterMontant(nb(l, "sortie")), ton: "vigilance" as Ton })),
        sources: [
          { libelle: "Journal de caisse", href: "/rapports/caisse-journal" },
          { libelle: "Caisse & achats", href: "/caisse" },
        ],
      };
    }

    case "achats": {
      const lignes = construireRapport("achats-demandes", contexte());
      const parEtape = repartition(lignes, "etape");
      const enCours = lignes.filter((l) => !["Réglée", "Refusée"].includes(txt(l, "etape")));
      const engage = enCours.reduce((s, l) => s + (nb(l, "montantEngage") || nb(l, "montantEstime")), 0);
      return {
        texte: `${enCours.length} demandes d'achat sont en cours, pour ${formaterMontant(engage)} engagés ou estimés.`,
        chiffres: parEtape.slice(0, 5).map((r) => ({ libelle: r.valeur, valeur: String(r.compte) })),
        lignes: enCours.slice(0, 6).map((l) => ({
          titre: txt(l, "objet"),
          precision: `${txt(l, "numero")} · ${txt(l, "fournisseur") || "fournisseur à choisir"}`,
          valeur: txt(l, "etape"),
          ton: tonDe(l.etape ?? null),
          href: `/caisse?vue=achats&ref=${txt(l, "numero")}`,
        })),
        sources: [
          { libelle: "Demandes d'achat", href: "/rapports/achats-demandes" },
          { libelle: "Caisse & achats", href: "/caisse?vue=achats" },
        ],
      };
    }

    /* ---- Chauffeurs & prestataires ---- */
    case "classement": {
      const lignes = construireRapport("chauffeurs-performance", contexte());
      const classes = lignes.filter((l) => l.classable === true);
      const podium = classes.slice(0, 5);
      return {
        texte: podium.length
          ? `Sur le mois révolu, ${txt(podium[0]!, "nom")} est en tête avec ${nb(podium[0]!, "score")} sur 100.`
          : "Aucun chauffeur classable sur le mois révolu.",
        chiffres: [
          { libelle: "Classés", valeur: String(classes.length), precision: `sur ${lignes.length} chauffeurs` },
          { libelle: "Non classables", valeur: String(lignes.length - classes.length), ton: "vigilance", precision: "accident, sanction, ou trop peu de kilomètres" },
        ],
        lignes: podium.map((l) => ({
          titre: `${nb(l, "rang")}. ${txt(l, "nom")}`,
          precision: `${txt(l, "vehicule") || "sans véhicule"} · ${kilometrage(nb(l, "km"))} · prime ${pourcentage(nb(l, "prime"), 0)}`,
          valeur: `${nb(l, "score")}/100`,
          ton: tonDe(l.tranche ?? null),
          href: lienDe(l),
        })),
        sources: [
          { libelle: "Performance SQDCM", href: "/rapports/chauffeurs-performance" },
          { libelle: "Classement des chauffeurs", href: "/chauffeurs/classement" },
        ],
        suites: ["Quels chauffeurs ne peuvent pas conduire ?"],
      };
    }

    case "prestataires": {
      const lignes = construireRapport("prestataires-activite", contexte());
      const parMontant = [...lignes].sort((a, b) => nb(b, "montant") - nb(a, "montant")).filter((l) => nb(l, "montant") > 0);
      const du = lignes.reduce((s, l) => s + nb(l, "enAttente"), 0);
      return {
        texte: parMontant.length
          ? `${txt(parMontant[0]!, "nom")} est le premier prestataire du parc sur douze mois, avec ${formaterMontant(nb(parMontant[0]!, "montant"))}.`
          : "Aucun achat rattaché à un prestataire sur la période.",
        chiffres: [
          { libelle: "Prestataires actifs", valeur: String(parMontant.length), precision: `sur ${lignes.length} au référentiel` },
          { libelle: "Reste à régler", valeur: formaterMontant(du), ton: du > 0 ? "vigilance" : "favorable" },
        ],
        lignes: parMontant.slice(0, 6).map((l) => ({
          titre: txt(l, "nom"),
          precision: `${txt(l, "type")} · ${nb(l, "demandes")} achats`,
          valeur: formaterMontant(nb(l, "montant")),
          href: `/prestataires/${txt(l, "numero")}`,
        })),
        sources: [
          { libelle: "Activité des prestataires", href: "/rapports/prestataires-activite" },
          { libelle: "Prestataires", href: "/prestataires" },
        ],
      };
    }

    default:
      return incomprise(d);
  }
}

function incomprise(d: Demande): Reponse {
  return {
    texte: "Je n'ai pas su rattacher cette question à ce que je sais lire du parc. Voici ce que je peux dire :",
    lignes: INTENTIONS.slice(0, 8).map((i) => ({ titre: i.libelle, precision: i.exemple })),
    sources: [{ libelle: "Tous les rapports", href: "/rapports" }],
    suites: INTENTIONS.slice(0, 4).map((i) => i.exemple),
    incomprise: true,
    chiffres: undefined,
    ...(d.question.trim() ? {} : {}),
  };
}

/* -- L'assistant ---------------------------------------------------------------- */

/**
 * L'assistant de démonstration. Il reconnaît l'intention, va chercher les
 * lignes du rapport correspondant, et les résume. Asynchrone bien qu'immédiat :
 * l'écran est ainsi écrit pour une réponse qui met une seconde, et le jour du
 * branchement rien ne bougera de son côté.
 */
export const assistantDemo: Assistant = {
  async repondre(d: Demande): Promise<Reponse> {
    const question = d.question.trim();
    if (!question) return incomprise(d);

    /* Une immatriculation citée l'emporte sur tout : quand on nomme un
       véhicule, c'est de lui qu'on veut entendre parler. */
    const immatriculation = vehiculeCite(question, d.origine);
    const intention = reconnaitre(question, INTENTIONS);
    if (immatriculation && (!intention || intention.cle === "vehicule" || intention.cle === "parc-taille")) return fiche(immatriculation);
    if (!intention) return immatriculation ? fiche(immatriculation) : incomprise(d);
    if (intention.cle === "vehicule") {
      return immatriculation
        ? fiche(immatriculation)
        : {
            texte: "De quel véhicule s'agit-il ? Citez son immatriculation — « Où en est AA-032-EA ? ».",
            lignes: FLOTTE.slice(0, 6).map((l) => ({ titre: l.vehicule.immatriculationAffichee, precision: `${l.vehicule.marque} ${l.vehicule.appellation}`, href: `/flotte/${l.vehicule.immatriculation}` })),
            sources: [{ libelle: "Flotte", href: "/flotte" }],
          };
    }
    return repondreIntention(intention.cle, d);
  },
};

/** Les questions proposées à l'ouverture — celles que l'équipe pose le matin. */
export function questionsSuggerees(): string[] {
  return [
    "Combien de véhicules sont prêts à charger ?",
    "Quels documents sont échus ou expirent bientôt ?",
    "Quel véhicule coûte le plus cher au kilomètre ?",
    "Quels véhicules dérivent en consommation ?",
    "Quels ordres de travail sont ouverts ?",
    "Quel est le solde de la caisse ?",
  ];
}
