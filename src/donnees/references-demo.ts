/* ============================================================================
 * Index des numéros de référence — pour la recherche transversale.
 *
 * Un numéro, une transaction, une adresse : la fiche qui la porte, l'onglet
 * qui la liste, la ligne à souligner. Construit une fois depuis les fiches de
 * démonstration ; au branchement, une vue Supabase `transaction` (numéro, type,
 * libellé, véhicule, chauffeur, date) interrogée côté serveur.
 * ==========================================================================*/

import { ETAPE_ACHAT, SENS_CAISSE } from "@/domaine/caisse";
import { SENS_CUVE } from "@/domaine/carburant";
import { STATUT_ORDRE } from "@/domaine/maintenance";
import { TYPE_TRANSACTION, type TypeTransaction } from "@/domaine/reference";
import { GROUPE_CHARGE, MOTIF_INDISPONIBILITE, TYPE_DOCUMENT, TYPE_INCIDENT, TYPE_SANCTION, groupeDuPoste } from "@/domaine/libelles";
import { date, montant, nombre } from "@/lib/format";
import { demandesAchat, journalCaisse } from "./caisse-demo";
import { livraisonsEtJauges } from "./carburant-demo";
import { fichesChauffeurs } from "./chauffeurs-demo";
import { ordresDeTravail } from "./maintenance-demo";
import { listePrestataires } from "./prestataires-demo";
import { TYPE_PRESTATAIRE } from "@/domaine/prestataires";
import { fichePourImmatriculation } from "./fiche-demo";
import { FLOTTE } from "./parc-demo";

export interface EntreeReference {
  numero: string;
  type: TypeTransaction;
  /** « Plein · Gasoil cuve — 62,5 L ». */
  titre: string;
  /** « 14/06/2026 · AA 032 EA · 39 375 F ». */
  precision: string;
  href: string;
}

let INDEX: EntreeReference[] | null = null;

function construire(): EntreeReference[] {
  const entrees: EntreeReference[] = [];
  const vus = new Set<string>();
  const ajouter = (e: EntreeReference) => {
    if (vus.has(e.numero)) return;
    vus.add(e.numero);
    entrees.push(e);
  };
  const lien = (immat: string, onglet: string | null, numero: string) => `/flotte/${immat}?onglet=${onglet ?? "apercu"}&ref=${numero}`;

  for (const l of FLOTTE) {
    const f = fichePourImmatriculation(l.vehicule.immatriculation);
    if (!f) continue;
    const v = f.ligne.vehicule;
    const T = TYPE_TRANSACTION;

    for (const a of f.affectations) {
      ajouter({ numero: a.numero, type: "affectation", titre: `Affectation · ${a.chauffeur ?? "sans chauffeur"}${a.role ? ` (${a.role})` : ""}`, precision: `${date(a.debut)}${a.fin ? ` → ${date(a.fin)}` : " → en cours"} · ${v.immatriculationAffichee}`, href: lien(v.immatriculation, T.affectation.ongletVehicule, a.numero) });
    }
    for (const a of f.attelages) {
      ajouter({ numero: a.numero, type: "attelage", titre: `Attelage · ${v.immatriculationAffichee} ${a.role === "tracteur" ? "→" : "←"} ${a.autreImmatriculationAffichee}`, precision: `${date(a.debut)}${a.fin ? ` → ${date(a.fin)}` : a.permanent ? " → définitif" : " → en cours"}`, href: lien(v.immatriculation, T.attelage.ongletVehicule, a.numero) });
    }
    for (const x of f.visitesTechniques) {
      ajouter({ numero: x.numero, type: "visite", titre: `${x.type === "contre-visite" ? "Contre-visite" : "Visite technique"} · ${x.centre}`, precision: `${date(x.datePassage ?? x.dateRendezVous)} · ${v.immatriculationAffichee}${x.numeroPv ? ` · ${x.numeroPv}` : ""}`, href: lien(v.immatriculation, T.visite.ongletVehicule, x.numero) });
    }
    for (const o of f.observationsVisite) {
      ajouter({ numero: o.numero, type: "observation", titre: `Observation · ${o.libelle}`, precision: `${v.immatriculationAffichee} · ${o.statut === "corrigee" ? "corrigée" : "à corriger"}`, href: lien(v.immatriculation, T.observation.ongletVehicule, o.numero) });
    }
    for (const d of f.documents) {
      ajouter({ numero: d.numero, type: "document", titre: `Document · ${TYPE_DOCUMENT[d.type]}${d.numeroPiece ? ` ${d.numeroPiece}` : ""}`, precision: `${d.echeance ? `échéance ${date(d.echeance)}` : "permanent"} · ${v.immatriculationAffichee}`, href: lien(v.immatriculation, T.document.ongletVehicule, d.numero) });
    }
    for (const i of f.interventions) {
      ajouter({ numero: i.numero, type: "intervention", titre: `Intervention · ${i.objet}`, precision: `${date(i.date)} · ${v.immatriculationAffichee} · ${montant(i.montant)}`, href: lien(v.immatriculation, T.intervention.ongletVehicule, i.numero) });
    }
    for (const p of f.pleins) {
      ajouter({ numero: p.numero, type: "plein", titre: `Plein · ${nombre(p.litres, 1)} L — ${p.source}`, precision: `${date(p.date)} · ${v.immatriculationAffichee} · ${montant(p.montant)}`, href: lien(v.immatriculation, T.plein.ongletVehicule, p.numero) });
    }
    for (const d of f.depenses) {
      const groupe = groupeDuPoste(d.poste);
      const onglet = groupe === "maintenance" ? "entretien" : groupe === "carburant" ? "carburant" : d.poste === "assurance" || d.poste === "conformite" ? "conformite" : "autres";
      ajouter({ numero: d.numero, type: "depense", titre: `Dépense · ${d.libelle}`, precision: `${date(d.date)} · ${v.immatriculationAffichee} · ${montant(d.montant)} · ${GROUPE_CHARGE[groupe]}`, href: lien(v.immatriculation, onglet, d.numero) });
    }
    for (const r of f.releves) {
      ajouter({ numero: r.numero, type: "releve", titre: `Relevé · ${nombre(r.valeur)} km — ${r.source}`, precision: `${date(r.date)} · ${v.immatriculationAffichee}${r.valide ? "" : " · écarté"}`, href: lien(v.immatriculation, T.releve.ongletVehicule, r.numero) });
    }
  }

  for (const f of fichesChauffeurs()) {
    const c = f.ligne;
    const lienC = (onglet: string | null, numero: string) => `/chauffeurs/${c.id}?onglet=${onglet ?? "apercu"}&ref=${numero}`;
    for (const i of f.incidents) {
      ajouter({ numero: i.declaration.numero, type: "incident", titre: `${i.declaration.nature === "accident" ? "Accident" : "Incident"} · ${TYPE_INCIDENT[i.declaration.type]}`, precision: `${date(i.declaration.dateHeure)} · ${i.immatriculationAffichee} · ${c.nomComplet}`, href: lienC(TYPE_TRANSACTION.incident.ongletChauffeur, i.declaration.numero) });
    }
    for (const s of f.sanctions) {
      ajouter({ numero: s.numero, type: "sanction", titre: `Sanction · ${TYPE_SANCTION[s.type]}`, precision: `${date(s.date)} · ${c.nomComplet}`, href: lienC(TYPE_TRANSACTION.sanction.ongletChauffeur, s.numero) });
    }
    for (const i of f.indisponibilites) {
      ajouter({ numero: i.numero, type: "indisponibilite", titre: `Indisponibilité · ${MOTIF_INDISPONIBILITE[i.motif]}`, precision: `${date(i.debut)}${i.fin ? ` → ${date(i.fin)}` : ""} · ${c.nomComplet}`, href: lienC(TYPE_TRANSACTION.indisponibilite.ongletChauffeur, i.numero) });
    }
  }

  /* Caisse et achats ne vivent pas sur une fiche : leur adresse est l'écran du
     module, la vue et la ligne visée. */
  for (const m of journalCaisse()) {
    ajouter({
      numero: m.numero,
      type: "caisse",
      titre: `${SENS_CAISSE[m.sens]} · ${m.libelle}`,
      precision: `${date(m.date)}${m.immatriculationAffichee ? ` · ${m.immatriculationAffichee}` : ""} · ${montant(m.montant)}`,
      href: `/caisse?vue=journal&ref=${m.numero}`,
    });
  }
  for (const m of livraisonsEtJauges()) {
    ajouter({
      numero: m.numero,
      type: "cuve",
      titre: `${SENS_CUVE[m.sens]} · ${m.libelle}`,
      precision: `${date(m.date)} · ${nombre(m.litres)} L${m.montant ? ` · ${montant(m.montant)}` : ""}`,
      href: `/carburant?vue=cuve&ref=${m.numero}`,
    });
  }
  for (const p of listePrestataires()) {
    ajouter({
      numero: p.numero,
      type: "prestataire",
      titre: `Prestataire · ${p.raisonSociale}`,
      precision: `${TYPE_PRESTATAIRE[p.type]}${p.ville ? ` · ${p.ville}` : ""}${p.actif ? "" : " · inactif"}`,
      href: `/prestataires/${p.numero}`,
    });
  }
  for (const o of ordresDeTravail()) {
    ajouter({
      numero: o.numero,
      type: "ordre",
      titre: `Ordre de travail · ${o.objet}`,
      precision: `prévu le ${date(o.datePrevue)} · ${o.immatriculationAffichee} · ${o.garage} · ${STATUT_ORDRE[o.statut]}`,
      href: `/maintenance?vue=ordres&ref=${o.numero}`,
    });
  }
  for (const a of demandesAchat()) {
    ajouter({
      numero: a.numero,
      type: "achat",
      titre: `Demande d'achat · ${a.objet}`,
      precision: `${date(a.date)}${a.immatriculationAffichee ? ` · ${a.immatriculationAffichee}` : ""} · ${montant(a.montantEstime)} · ${ETAPE_ACHAT[a.etape]}`,
      href: `/caisse?vue=achats&ref=${a.numero}`,
    });
  }

  return entrees;
}

export function indexReferences(): EntreeReference[] {
  if (!INDEX) INDEX = construire();
  return INDEX;
}

function normaliser(texte: string): string {
  return texte.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Les transactions dont le numéro contient ce qu'on a tapé — « dep 15 », « PLN-2026 », « 15012 ». */
export function chercherReferences(terme: string, limite = 6): EntreeReference[] {
  const t = normaliser(terme);
  if (t.length < 3) return [];
  return indexReferences()
    .filter((e) => normaliser(e.numero).includes(t))
    .slice(0, limite);
}
