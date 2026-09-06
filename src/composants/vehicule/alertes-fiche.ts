import { MOTIF_IMMOBILISATION, STATUT_VEHICULE, TYPE_DOCUMENT, TYPE_VISITE, type Ton } from "@/domaine/libelles";
import type { DocumentFiche, FicheVehicule, ReleveFiche } from "@/domaine/fiche";
import { date, nombre } from "@/lib/format";
import { libelleMois } from "@/donnees/fiche-demo";
import { libelleEcheance } from "@/domaine/entretien";

/* ============================================================================
 * Ce qui, sur une fiche véhicule, demande une action — **et où le traiter**.
 *
 * Demande du métier du 4 septembre 2026 : la carte « Alertes » de l'Aperçu est
 * retirée, et les alertes se signalent **sur l'onglet qui les concerne**. C'est
 * plus juste : une visite technique échue ne se règle pas dans l'Aperçu mais
 * dans Conformité, et un compteur écarté dans Kilométrages. Le badge dit où
 * aller ; l'onglet montre la ligne et permet d'agir.
 *
 * Chaque alerte porte donc son onglet. Le calcul vit ici et non dans l'Aperçu,
 * pour que l'en-tête de la fiche et le contenu des onglets lisent la même
 * chose — sans quoi le badge et l'écran finiraient par se contredire.
 * ==========================================================================*/

/**
 * L'onglet où l'alerte se traite. C'est un sous-ensemble des onglets de la
 * fiche : l'Aperçu et les Caractéristiques ne portent jamais d'alerte, puisqu'on
 * n'y agit pas. La carte s'indexe pourtant sur **tous** les onglets, pour que
 * la barre puisse l'interroger sans conversion de type.
 */
export type OngletCible = "affectations" | "conformite" | "incidents" | "maintenance" | "carburant" | "kilometrage" | "journal";

export interface AlerteFiche {
  onglet: OngletCible;
  ton: Ton;
  titre: string;
  precision: string;
}

/**
 * Les alertes d'une fiche, de la plus grave à la plus bénigne. Les listes
 * passées en argument sont celles que les onglets affichent — créations
 * comprises : c'est l'appelant qui les fournit, pour que le badge compte
 * exactement ce que l'onglet montrera.
 */
export function alertesDeLaFiche(
  fiche: FicheVehicule,
  vues: { documents: DocumentFiche[]; affectations: { role: string | null; fin: string | null }[]; releves: ReleveFiche[] },
): AlerteFiche[] {
  const alertes: AlerteFiche[] = [];
  const { ligne, periodesStatut, carburant, referenceL100 } = fiche;
  const statut = STATUT_VEHICULE[fiche.immobilisationAdministrative?.statut ?? ligne.vehicule.statut];

  if (fiche.immobilisationAdministrative) {
    alertes.push({
      onglet: "conformite",
      ton: "defavorable",
      titre: "Immobilisé administrativement",
      precision: `${fiche.immobilisationAdministrative.documents
        .map((d) => `${TYPE_DOCUMENT[d.type]} ${d.etat === "manquant" ? "manquante" : "échue"}`)
        .join(", ")} — le véhicule ne compte ni disponible ni prêt à charger tant que le document n'est pas renouvelé`,
    });
  }

  const periodeCourante = periodesStatut.find((p) => p.fin === null && p.statut === ligne.vehicule.statut);
  if (!statut.operationnel && periodeCourante) {
    alertes.push({
      onglet: "journal",
      ton: "defavorable",
      titre: `${statut.libelle} depuis ${periodeCourante.jours} jour${periodeCourante.jours > 1 ? "s" : ""}`,
      precision: [periodeCourante.motif ? MOTIF_IMMOBILISATION[periodeCourante.motif] : null, ligne.vehicule.commentaire].filter(Boolean).join(" — ") || statut.precision,
    });
  }

  for (const d of vues.documents.filter((x) => x.etat === "echu" || x.etat === "manquant")) {
    alertes.push({
      onglet: "conformite",
      ton: "defavorable",
      titre: `${TYPE_DOCUMENT[d.type]} ${d.etat === "manquant" ? "manquante" : "échue"}`,
      precision: d.etat === "manquant" ? "Document à fournir — le véhicule n'est pas conforme" : `Échue depuis ${Math.abs(d.joursRestants ?? 0)} jours · ${d.emetteur ?? ""}`,
    });
  }

  if (!vues.affectations.some((a) => a.role === "titulaire" && a.fin === null)) {
    alertes.push({ onglet: "affectations", ton: "vigilance", titre: "Aucun chauffeur titulaire", precision: "Le véhicule ne peut pas être compté « prêt à charger »" });
  }

  for (const d of vues.documents.filter((x) => x.etat === "bientot")) {
    alertes.push({ onglet: "conformite", ton: "vigilance", titre: `${TYPE_DOCUMENT[d.type]} à renouveler`, precision: `Échéance dans ${d.joursRestants} jours · ${d.emetteur ?? ""}` });
  }

  {
    const visites = fiche.visitesTechniques;
    const refus = visites.find((x) => x.statut === "refusee");
    const contreVisitePrise = visites.some((x) => x.type === "contre-visite" && x.statut === "rendez-vous");
    const ouvertes = fiche.observationsVisite.filter((o) => o.statut !== "corrigee");
    const rdv = visites.filter((x) => x.statut === "rendez-vous").sort((a, b) => a.dateRendezVous.localeCompare(b.dateRendezVous))[0];
    if (refus && !contreVisitePrise) {
      alertes.push({
        onglet: "conformite",
        ton: "defavorable",
        titre: "Visite technique refusée — contre-visite à programmer",
        precision: `${refus.dateLimiteContreVisite ? `Avant le ${date(refus.dateLimiteContreVisite)} · ` : ""}${ouvertes.length} observation${ouvertes.length > 1 ? "s" : ""} à corriger`,
      });
    } else if (ouvertes.length > 0) {
      /* Une observation se corrige à l'atelier : elle appartient à Maintenance. */
      alertes.push({
        onglet: "maintenance",
        ton: "vigilance",
        titre: `${ouvertes.length} observation${ouvertes.length > 1 ? "s" : ""} de visite technique à corriger`,
        precision: ouvertes.map((o) => o.libelle).join(" — "),
      });
    }
    if (rdv) {
      alertes.push({
        onglet: "conformite",
        ton: "vigilance",
        titre: `${TYPE_VISITE[rdv.type]} technique le ${date(rdv.dateRendezVous)}${rdv.heure ? ` à ${rdv.heure}` : ""}`,
        precision: `${rdv.centre}${rdv.commentaire ? ` · ${rdv.commentaire}` : ""}`,
      });
    }
  }

  /*
   * Le plan d'entretien, échéance par échéance — c'est la part « à suivre en
   * alerte » de la demande du métier. Une seule alerte par état : dix lignes
   * dépassées sur un même véhicule ne se traitent pas dix fois, elles se
   * traitent en un passage à l'atelier.
   */
  const depassees = fiche.planEntretien.echeances.filter((e) => e.etat === "en-retard");
  const imminentes = fiche.planEntretien.echeances.filter((e) => e.etat === "a-planifier");
  if (depassees.length > 0) {
    alertes.push({
      onglet: "maintenance",
      ton: "defavorable",
      titre: depassees.length === 1 ? `${depassees[0]!.libelle} — échéance dépassée` : `${depassees.length} échéances d'entretien dépassées`,
      precision: depassees.map((e) => `${e.libelle} · ${libelleEcheance(e).toLowerCase()}`).join(" · "),
    });
  }
  if (imminentes.length > 0) {
    alertes.push({
      onglet: "maintenance",
      ton: "vigilance",
      titre: imminentes.length === 1 ? `${imminentes[0]!.libelle} à prévoir` : `${imminentes.length} entretiens à planifier`,
      precision: imminentes.map((e) => `${e.libelle} · ${libelleEcheance(e).toLowerCase()}`).join(" · "),
    });
  }

  const derive = carburant.find((c) => c.ecartPct >= 15);
  if (derive) {
    alertes.push({
      onglet: "carburant",
      ton: "vigilance",
      titre: `Dérive de consommation en ${libelleMois(derive.mois).toLowerCase()}`,
      precision: `${nombre(derive.litresAux100)} L/100 contre ${nombre(referenceL100)} en référence, soit +${Math.round(derive.ecartPct)} %`,
    });
  }

  const ecartes = vues.releves.filter((r) => !r.valide);
  if (ecartes.length > 0) {
    alertes.push({
      onglet: "kilometrage",
      ton: "vigilance",
      titre: `${ecartes.length} relevé${ecartes.length > 1 ? "s" : ""} kilométrique${ecartes.length > 1 ? "s" : ""} écarté${ecartes.length > 1 ? "s" : ""}`,
      precision: "Incohérents avec la série",
    });
  }

  return alertes;
}

/** Par onglet : le nombre d'alertes et la plus grave — ce que le badge affiche. */
export function alertesParOnglet(alertes: AlerteFiche[]): Map<string, { nombre: number; ton: Ton }> {
  const par = new Map<string, { nombre: number; ton: Ton }>();
  for (const a of alertes) {
    const actuel = par.get(a.onglet);
    par.set(a.onglet, {
      nombre: (actuel?.nombre ?? 0) + 1,
      /* Le badge prend le ton du plus grave : un onglet qui porte une échéance
         échue et un rendez-vous à venir se signale en rouge, pas en orange. */
      ton: actuel?.ton === "defavorable" || a.ton === "defavorable" ? "defavorable" : "vigilance",
    });
  }
  return par;
}
