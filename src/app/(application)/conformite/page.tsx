import { EcranConformite } from "@/composants/conformite/EcranConformite";
import { niveauPour, trier, type Echeance } from "@/domaine/conformite";
import { TYPE_DOCUMENT } from "@/domaine/libelles";
import { titrePage } from "@/domaine/marque";
import { joursRestants } from "@/lib/format";
import { DATE_REFERENCE, fichesChauffeurs } from "@/donnees/chauffeurs-demo";
import { fichePourImmatriculation } from "@/donnees/fiche-demo";
import { parametresServeur } from "@/lib/parametres-serveur";
import { FLOTTE, LICENCES } from "@/donnees/parc-demo";

export const metadata = { title: titrePage("Conformité") };

/**
 * L'échéancier unique : chaque document de chaque véhicule et de chaque
 * chauffeur, plus la prochaine échéance d'entretien, sur une seule liste.
 * Construit ici depuis les fiches — une seule source ; demain, une vue.
 */
export default async function PageConformite() {
  const parametres = await parametresServeur();
  const echeances: Echeance[] = [];

  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation, parametres);
    if (!f) continue;
    const v = l.vehicule;
    const precision = `${v.marque} ${v.appellation}${l.site ? ` · ${l.site.libelle}` : ""}`;
    for (const d of f.documents) {
      /* Une licence portée par la flotte est une seule échéance : elle est ajoutée plus bas, une fois. */
      if (d.type === "licence-transport" && d.etat !== "manquant") continue;
      echeances.push({
        cle: `v-${v.id}-${d.numero}`,
        numero: d.numero,
        sujet: "vehicule",
        sujetId: v.id,
        sujetLibelle: v.immatriculationAffichee,
        sujetPrecision: precision,
        sujetHref: `/flotte/${v.immatriculation}?onglet=conformite&ref=${d.numero}`,
        type: d.type,
        libelle: TYPE_DOCUMENT[d.type],
        numeroPiece: d.numeroPiece,
        emetteur: d.emetteur,
        echeance: d.echeance,
        joursRestants: d.joursRestants,
        niveau: niveauPour(d.joursRestants, d.etat === "manquant", d.etat === "permanent"),
        repere: null,
        site: l.site?.libelle ?? null,
      });
    }
    /* Un document critique exigé que la fiche n'a pas du tout — typiquement un
       document ajouté dans Paramètres — manque aussi : il immobilise, il doit
       apparaître dans l'échéancier. */
    for (const d of f.immobilisationAdministrative?.documents ?? []) {
      if (d.etat !== "manquant" || f.documents.some((x) => x.type === d.type)) continue;
      echeances.push({
        cle: `v-${v.id}-manquant-${d.type}`,
        numero: null,
        sujet: "vehicule",
        sujetId: v.id,
        sujetLibelle: v.immatriculationAffichee,
        sujetPrecision: precision,
        sujetHref: `/flotte/${v.immatriculation}?onglet=conformite`,
        type: d.type,
        libelle: TYPE_DOCUMENT[d.type],
        numeroPiece: null,
        emetteur: null,
        echeance: null,
        joursRestants: null,
        niveau: niveauPour(null, true),
        repere: null,
        site: l.site?.libelle ?? null,
      });
    }
    /* Le processus de visite technique : un refus ouvre un délai de contre-visite ;
       un rendez-vous pris est une échéance à tenir. */
    const refus = f.visitesTechniques.find((x) => x.statut === "refusee");
    const contreVisitePrise = f.visitesTechniques.some((x) => x.type === "contre-visite" && x.statut === "rendez-vous");
    if (refus?.dateLimiteContreVisite && !contreVisitePrise) {
      const j = joursRestants(refus.dateLimiteContreVisite, new Date(`${DATE_REFERENCE}T00:00:00Z`));
      const ouvertes = f.observationsVisite.filter((o) => o.statut !== "corrigee").length;
      echeances.push({
        cle: `v-${v.id}-contre-visite`,
        numero: refus.numero,
        sujet: "vehicule",
        sujetId: v.id,
        sujetLibelle: v.immatriculationAffichee,
        sujetPrecision: precision,
        sujetHref: `/flotte/${v.immatriculation}?onglet=conformite&ref=${refus.numero}`,
        type: "contre-visite",
        libelle: `Contre-visite à programmer · ${ouvertes} observation${ouvertes > 1 ? "s" : ""} à corriger`,
        numeroPiece: refus.numeroPv,
        emetteur: refus.centre,
        echeance: refus.dateLimiteContreVisite,
        joursRestants: j,
        niveau: niveauPour(j, false),
        repere: null,
        site: l.site?.libelle ?? null,
      });
    }
    for (const rdv of f.visitesTechniques.filter((x) => x.statut === "rendez-vous")) {
      const j = joursRestants(rdv.dateRendezVous, new Date(`${DATE_REFERENCE}T00:00:00Z`));
      echeances.push({
        cle: `v-${v.id}-${rdv.numero}`,
        numero: rdv.numero,
        sujet: "vehicule",
        sujetId: v.id,
        sujetLibelle: v.immatriculationAffichee,
        sujetPrecision: precision,
        sujetHref: `/flotte/${v.immatriculation}?onglet=conformite&ref=${rdv.numero}`,
        type: "rendez-vous",
        libelle: `Rendez-vous ${rdv.type === "contre-visite" ? "contre-visite" : "visite technique"}${rdv.heure ? ` à ${rdv.heure}` : ""}`,
        numeroPiece: null,
        emetteur: rdv.centre,
        echeance: rdv.dateRendezVous,
        joursRestants: j,
        niveau: niveauPour(j, false),
        repere: null,
        site: l.site?.libelle ?? null,
      });
    }
    if (f.prochaineIntervention) {
      const p = f.prochaineIntervention;
      echeances.push({
        cle: `v-${v.id}-entretien`,
        numero: null,
        sujet: "vehicule",
        sujetId: v.id,
        sujetLibelle: v.immatriculationAffichee,
        sujetPrecision: precision,
        sujetHref: `/flotte/${v.immatriculation}?onglet=entretien`,
        type: "entretien",
        libelle: p.libelle,
        numeroPiece: null,
        emetteur: null,
        echeance: null,
        joursRestants: p.joursEstimes,
        niveau: niveauPour(p.joursEstimes, false),
        repere: `dans ${p.kmRestants.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`,
        site: l.site?.libelle ?? null,
      });
    }
  }

  /* Les licences de transport — une ligne par licence, pas par véhicule. */
  for (const lic of LICENCES) {
    const j = joursRestants(lic.echeance, new Date(`${DATE_REFERENCE}T00:00:00Z`));
    const immats = lic.vehiculeIds.map((id) => FLOTTE.find((l) => l.vehicule.id === id)?.vehicule.immatriculationAffichee ?? id);
    echeances.push({
      cle: `lic-${lic.id}`,
      numero: lic.numero,
      sujet: "vehicule",
      sujetId: "flotte",
      sujetLibelle: lic.perimetre === "flotte" ? "Toute la flotte" : `${lic.vehiculeIds.length} véhicules`,
      sujetPrecision: lic.perimetre === "flotte" ? lic.libelle : `${lic.libelle} — ${immats.join(", ")}`,
      sujetHref: "/flotte",
      type: "licence-transport",
      libelle: TYPE_DOCUMENT["licence-transport"],
      numeroPiece: lic.numeroPiece,
      emetteur: lic.emetteur,
      echeance: lic.echeance,
      joursRestants: j,
      niveau: niveauPour(j, false),
      repere: null,
      site: null,
    });
  }

  for (const f of fichesChauffeurs()) {
    const c = f.ligne;
    if (!c.chauffeur.actif) continue;
    const precision = c.vehiculeTitulaire ? `Titulaire de ${c.vehiculeTitulaire.immatriculationAffichee}${c.site ? ` · ${c.site.libelle}` : ""}` : (c.site?.libelle ?? "Sans véhicule");
    for (const d of f.documents) {
      echeances.push({
        cle: `c-${c.id}-${d.numero}`,
        numero: d.numero,
        sujet: "chauffeur",
        sujetId: c.id,
        sujetLibelle: c.nomComplet,
        sujetPrecision: precision,
        sujetHref: `/chauffeurs/${c.id}?onglet=documents&ref=${d.numero}`,
        type: d.type,
        libelle: TYPE_DOCUMENT[d.type],
        numeroPiece: d.numeroPiece,
        emetteur: d.emetteur,
        echeance: d.echeance,
        joursRestants: d.joursRestants,
        niveau: niveauPour(d.joursRestants, d.etat === "manquant", d.etat === "permanent"),
        repere: null,
        site: c.site?.libelle ?? null,
      });
    }
  }

  return <EcranConformite echeances={trier(echeances)} aujourdhui={DATE_REFERENCE} />;
}
