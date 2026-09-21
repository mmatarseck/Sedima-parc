/* Les services de maintenance, les pannes signalées et le catalogue des tâches
 * (0059, 0060 — décisions du métier du 21 septembre 2026).
 *
 * Sans base : le calcul d'une facture (remises de ligne et globale, TVA 18 %,
 * BRS 5 %), sa répartition en dépenses, ce qu'écrit la clôture, l'atelier qui
 * la lit en une ligne, l'état d'un signalement, la reconnaissance des systèmes.
 * Avec PGlite : les migrations, le catalogue tiré de Fleetio, la clôture que
 * seul le responsable du parc peut faire, la résolution des pannes incluses, le
 * prix de référence suivi à l'entrée de stock.
 *
 * Lancer : PGLITE_DIR=<dossier PGlite> node --import tsx --import ./scripts/rendu/hook.mjs scripts/tester-services-maintenance.mts */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { FormulaireService } from "../src/composants/maintenance/FormulaireService";
import { apparierAtelier } from "../src/domaine/atelier";
import { libelleClassement, systemeReconnu } from "../src/domaine/categories-maintenance";
import { ecrituresDeCloture } from "../src/domaine/cloture-service";
import type { LigneOrdre } from "../src/domaine/maintenance";
import { calculerService, depensesDuService, joursImmobilisation, lireLignes, peutCloturerService, type FactureService } from "../src/domaine/service";
import { travauxOuverts } from "../src/domaine/maintenance";
import { construireRapportDe } from "../src/domaine/assembler-rapports";
import { RAPPORTS } from "../src/domaine/rapports";
import { motsClesDe } from "../src/domaine/entretien";
import { ChampPieces } from "../src/composants/interface/ChampPieces";
import { sourceRapportsDemo } from "../src/donnees/rapports-demo";
import { programmesDepuisLignes } from "../src/donnees/entretien";
import { programmeParDefaut } from "../src/donnees/entretien-demo";
import { etatSignalement, trierSignalements, type LigneSignalement } from "../src/domaine/signalements";
import { cleTache, tacheParLibelle } from "../src/domaine/taches";
import { colonnesModification, ligneCreation } from "../src/lib/transactions-colonnes";

let echecs = 0;
const attendu = (libelle: string, ok: boolean) => {
  console.log(`${ok ? "ok " : "ÉCHEC"} ${libelle}`);
  if (!ok) echecs++;
};

/* -- La facture, calculée à la main ---------------------------------------------- */

const facture: FactureService = {
  lignes: [
    { cle: "a", tacheNumero: "TCH-2026-00010", libelle: "Remplacement de l'assemblage d'embrayage", systeme: "023", mainOeuvre: 150_000, piecesAchetees: 420_000, piecesStock: [], remiseMode: "pourcentage", remiseValeur: 10 },
    { cle: "b", tacheNumero: "TCH-2026-00020", libelle: "Remplacement des plaquettes de frein", systeme: "013", mainOeuvre: 25_000, piecesAchetees: 65_000, piecesStock: [{ pieceNumero: "PCE-1", designation: "Batterie 150 AH", quantite: 2, prixUnitaire: 35_000 }], remiseMode: "montant", remiseValeur: 5_000 },
  ],
  remiseMode: "pourcentage",
  remiseValeur: 2,
  tvaTaux: 18,
  brsTaux: 5,
};
const t = calculerService(facture);
/* L1 : 570 000 − 10 % = 513 000 ; L2 : 90 000 − 5 000 = 85 000 ; sous-total 598 000 ; remise 2 % = 11 960 ; HT 586 040 ;
   TVA 18 % = 105 487 ; TTC 691 527 ; BRS 5 % du HT = 29 302 ; net 662 225 ; magasin 70 000 ; coût 761 527. */
attendu(`remises de ligne : 57 000 et 5 000 (${t.lignes.map((l) => l.remise).join(" et ")})`, t.lignes[0]!.remise === 57_000 && t.lignes[1]!.remise === 5_000);
attendu(`sous-total 598 000, remise globale 11 960, HT 586 040 (${t.sousTotalHT}, ${t.remiseGlobale}, ${t.totalHT})`, t.sousTotalHT === 598_000 && t.remiseGlobale === 11_960 && t.totalHT === 586_040);
attendu(`TVA 105 487, TTC 691 527 (${t.tva}, ${t.totalTTC})`, t.tva === 105_487 && t.totalTTC === 691_527);
attendu(`BRS sur le HT 29 302, net à payer 662 225 (${t.brs}, ${t.netAPayer})`, t.brs === 29_302 && t.netAPayer === 662_225);
attendu(`les pièces du magasin, hors facture : 70 000 ; coût du service 761 527 (${t.stock}, ${t.coutTotal})`, t.stock === 70_000 && t.coutTotal === 761_527);
attendu("les lignes se partagent le TTC au franc près", t.lignes.reduce((s, l) => s + l.cout, 0) === t.coutTotal);
const sansTaxe = calculerService({ ...facture, tvaTaux: 0, brsTaux: 0, remiseValeur: 0 });
attendu("sans TVA ni BRS ni remise globale, le coût est le net des lignes plus le magasin", sansTaxe.coutTotal === 598_000 + 70_000 && sansTaxe.netAPayer === 598_000);
const remiseExcessive = calculerService({ lignes: [{ ...facture.lignes[0]!, remiseMode: "montant", remiseValeur: 9_999_999 }], remiseMode: "pourcentage", remiseValeur: 150, tvaTaux: 18, brsTaux: 0 });
attendu("une remise ne rend jamais un montant négatif", remiseExcessive.lignes[0]!.netHT === 0 && remiseExcessive.totalHT === 0 && remiseExcessive.coutTotal === 0);

/* -- Les dépenses que la clôture en tire ----------------------------------------------- */

const depenses = depensesDuService(facture, "curatif");
attendu(`la somme des dépenses est le coût du service (${depenses.reduce((s, d) => s + d.montant, 0)})`, depenses.reduce((s, d) => s + d.montant, 0) === t.coutTotal);
attendu("main-d'œuvre au poste curatif, pièces au poste pièces, magasin d'origine « stock »", depenses.some((d) => d.poste === "maintenance-curative" && d.origine === "facture") && depenses.some((d) => d.poste === "pieces" && d.origine === "facture") && depenses.filter((d) => d.origine === "stock").length === 1 && depenses.find((d) => d.origine === "stock")!.montant === 70_000);
attendu("un service préventif porte sa main-d'œuvre au poste préventif", depensesDuService(facture, "preventif").some((d) => d.poste === "maintenance-preventive"));

const service: LigneOrdre = {
  numero: "OTR-2026-90001", vehiculeId: "AA565GA", immatriculation: "AA565GA", immatriculationAffichee: "AA-565-GA", vehicule: "TATA LPT1618", businessUnit: null, site: null,
  type: "curatif", objet: "Embrayage et freins", origineNumero: "SIG-2026-90001", origineLibelle: null, garage: "TATA INTERNATIONAL / UNITECH",
  datePrevue: "2026-09-18", immobilisationPrevueJours: 3, montantEstime: null, statut: "en-atelier", dateDebut: "2026-09-18", dateCloture: null, interventionNumero: null, commentaire: null, demandeur: "Banc", creee: true,
  priorite: "urgent", dateFin: "2026-09-21", kilometrage: 245_300, numeroFacture: "F-2031", lignes: facture.lignes, remiseMode: "pourcentage", remiseValeur: 2, tvaTaux: 18, brsTaux: 5,
  pieces: ["pieces/documents/2026/09/facture-f2031.pdf"], signalements: ["SIG-2026-90001"],
};
const ecritures = ecrituresDeCloture(service, "2026-09-21", "FAC-260921-TEST", "uuid-aa565ga");
const intervention = ecritures[0]!;
attendu("la clôture écrit d'abord l'intervention, au coût du service, sur le véhicule", intervention.type === "intervention" && intervention.valeurs.montant === t.coutTotal && intervention.sujet === "vehicule:AA565GA");
attendu(`l'immobilisation court du début à la fin des travaux (${intervention.valeurs.immobilisationJours} jours)`, intervention.valeurs.immobilisationJours === 4 && intervention.valeurs.km === 245_300);
attendu("puis une dépense par part de ligne, avec la facture jointe — sauf le magasin", ecritures.filter((e) => e.type === "depense").length === depenses.length && ecritures.filter((e) => e.type === "depense" && e.valeurs.origine === "facture").every((e) => e.valeurs.photo === service.pieces![0]) && ecritures.filter((e) => e.type === "depense" && e.valeurs.origine === "stock").every((e) => e.valeurs.photo === null && e.valeurs.beneficiaire === "Magasin SEDIMA"));
const sorties = ecritures.filter((e) => e.type === "mouvement");
attendu("puis une sortie de stock par pièce du magasin, au prix de référence, rattachée au service et au véhicule", sorties.length === 1 && sorties[0]!.valeurs.quantite === 2 && sorties[0]!.valeurs.prixUnitaire === 35_000 && sorties[0]!.valeurs.ordreNumero === service.numero && sorties[0]!.valeurs.vehiculeId === "uuid-aa565ga");
attendu("toutes citent le service, la facture et la clé", ecritures.filter((e) => e.type !== "mouvement").every((e) => String(e.valeurs.reference) === "OTR-2026-90001 · F-2031 · FAC-260921-TEST"));

const paires = apparierAtelier([{ numero: "INT-2026-90011", reference: String(intervention.valeurs.reference) }], ecritures.filter((e) => e.type === "depense").map((e, i) => ({ numero: `DEP-2026-9002${i}`, reference: String(e.valeurs.reference), montant: Number(e.valeurs.montant) })));
attendu("l'atelier du véhicule lit le service clos en une seule ligne, à son coût", paires.paires.length === 1 && paires.paires[0]!.lignes.reduce((s, d) => s + d.montant, 0) === t.coutTotal && paires.depensesSeules.length === 0);

/* -- Le signalement, et qui clôt ---------------------------------------------------- */

const sig = (numero: string, priorite: LigneSignalement["priorite"], date: string) => ({ numero, statut: "ouvert" as const, priorite, date });
attendu("un signalement inclus dans un service ouvert est « pris en charge »", etatSignalement(sig("SIG-1", "haute", "2026-09-01"), [{ statut: "en-atelier", signalements: ["SIG-1"] }]) === "pris-en-charge");
attendu("inclus dans un service clos, il est résolu ; sinon, ouvert", etatSignalement(sig("SIG-1", "haute", "2026-09-01"), [{ statut: "clos", signalements: ["SIG-1"] }]) === "resolu" && etatSignalement(sig("SIG-2", "basse", "2026-09-01"), [{ statut: "planifie", signalements: ["SIG-1"] }]) === "ouvert");
attendu("les pannes critiques d'abord, puis les plus anciennes", trierSignalements([sig("A", "normale", "2026-09-01"), sig("B", "critique", "2026-09-10"), sig("C", "normale", "2026-08-01")]).map((s) => s.numero).join() === "B,C,A");
attendu("seul le responsable du parc — et l'administrateur — clôt un service", peutCloturerService("gestionnaire-parc") && peutCloturerService("administrateur") && !peutCloturerService("responsable-maintenance") && !peutCloturerService(null));

/* -- La classification comme Fleetio ----------------------------------------------------- */

attendu("« vidange » se range au moteur, « PLAQUETTE FREIN AV » aux freins, « appareil air » au freinage pneumatique", systemeReconnu("vidange") === "045" && systemeReconnu("PLAQUETTE FREIN AV") === "013" && systemeReconnu("appareil air") === "013");
attendu("le composant précis l'emporte sur le mot générique : disque d'embrayage à l'embrayage, ballon d'air à la suspension, compresseur frigo au groupe frigorifique", systemeReconnu("DISQUE EMBRAYAGE") === "023" && systemeReconnu("BALLON AIR") === "016" && systemeReconnu("Compresseur Golden Shop") === "054");
attendu("un libellé qu'on ne reconnaît pas reste à classer", systemeReconnu("service HSE") === null);
{
  const { tachesDe } = await import("./affecter-interventions-taches.mts");
  const a = tachesDe("ACHAT DISQUE EMBRAYAGE ET HUILE BOITE AA 542 BQ (BENNE)", false);
  attendu("une intervention du parc se range sous ses tâches : disque d'embrayage et huile de boîte", a.includes("Remplacement du disque d'embrayage") && a.includes("Vidange et remplissage du liquide de transmission") && a.length === 2);
  attendu("un entretien « aux 50 000 km » est l'entretien périodique ; « entretien et réparation » sans détail, du divers",
    tachesDe("ENTRETIEN DU VEHICULE AA 324 JE AUX 50000 KMS A LASA", false).join() === "Entretien périodique (révision)" && tachesDe("ENTRETIEN ET RÉPARATION DU VÉHICULE DK6154AS", false).join() === "Travaux non détaillés (Divers)");
  attendu("le groupe frigorifique n'est pas le moteur du camion ; le divers d'un système ne double pas une tâche précise",
    tachesDe("REPARATION DU MOTEUR DU GROUPE AUBINEAU AA 300 PT", false).join() === "Réparation du groupe frigorifique" && !tachesDe("CHANGEMENT PLAQUETTE FREIN AVANT", false).includes("Freins (Divers)"));
}
attendu(`le classement se lit catégorie › système (${libelleClassement({ systeme: "017", ensemble: "001" })})`, libelleClassement({ systeme: "017", ensemble: "001" }) === "Châssis › Pneus › 001" && libelleClassement({}) === "À classer");
attendu("une tâche se retrouve par son nom ou un alias, aux accents près", tacheParLibelle([{ libelle: "Remplacement de l'huile moteur et du filtre", alias: ["vidange"] }], "VIDANGE")?.libelle === "Remplacement de l'huile moteur et du filtre" && cleTache("Moteur (Divers)") === cleTache("MOTEUR DIVERS"));

/* -- Ce que la base reçoit ------------------------------------------------------------ */

const r = { vehiculeId: "v-1", chauffeurId: null, prestataireId: "p-1" };
const ecrit = ligneCreation("ordre", "OTR-2026-90001", { vehiculeId: "v-1", type: "curatif", objet: "Embrayage", garage: "TATA", datePrevue: "2026-09-18", priorite: "urgent", lignes: JSON.stringify(facture.lignes), remiseMode: "pourcentage", remiseValeur: 2, tvaTaux: 18, brsTaux: 5, pieces: ["pieces/x.pdf"], signalements: ["SIG-1"] }, r);
attendu("un service s'écrit avec ses lignes en JSON, ses taux, ses pièces et ses pannes", "ligne" in ecrit && Array.isArray(ecrit.ligne.lignes) && (ecrit.ligne.lignes as unknown[]).length === 2 && ecrit.ligne.tva_taux === 18 && ecrit.ligne.brs_taux === 5 && JSON.stringify(ecrit.ligne.signalements) === '["SIG-1"]');
const ancien = ligneCreation("ordre", "OTR-2026-90002", { vehiculeId: "v-1", type: "curatif", objet: "Vidange", garage: "TATA", datePrevue: "2026-09-18" }, r);
attendu("un ordre de l'ancien chemin n'écrit pas les colonnes de 0060", "ligne" in ancien && !("lignes" in ancien.ligne) && !("priorite" in ancien.ligne));
const modif = colonnesModification("ordre", [{ champ: "lignes", valeur: JSON.stringify(facture.lignes) }, { champ: "pieces", valeur: ["a.pdf", "b.jpg"] }, { champ: "tvaTaux", valeur: "18" }]);
attendu("une modification réécrit les lignes en JSON, les pièces en tableau, le taux en nombre", Array.isArray(modif.lignes) && JSON.stringify(modif.pieces) === '["a.pdf","b.jpg"]' && modif.tva_taux === 18);
const sgn = ligneCreation("signalement", "SIG-2026-90001", { date: "2026-09-21", priorite: "critique", systeme: "013", description: "Freins qui sifflent", pieces: ["pieces/p.jpg"] }, r);
attendu("un signalement s'écrit avec sa priorité, son système et ses photos", "ligne" in sgn && sgn.ligne.priorite === "critique" && sgn.ligne.systeme === "013" && JSON.stringify(sgn.ligne.pieces) === '["pieces/p.jpg"]');
const tch = ligneCreation("tache", "TCH-2026-90001", { libelle: "Remplacement du klaxon", systeme: "034" }, r);
attendu("une tâche créée prend la catégorie de son système", "ligne" in tch && tch.ligne.categorie === "3" && tch.ligne.source === "saisie");
attendu("les lignes se relisent d'un tableau comme d'une chaîne JSON", lireLignes(facture.lignes).length === 2 && lireLignes(JSON.stringify(facture.lignes))[1]!.piecesStock[0]!.quantite === 2 && lireLignes("pas du json").length === 0);

/* -- Le formulaire ------------------------------------------------------------------------ */

const panne = { numero: "SIG-2026-90001", vehiculeId: "AA565GA", immatriculationAffichee: "AA-565-GA", vehicule: "TATA", date: "2026-09-18", priorite: "critique" as const, systeme: "013", description: "Freins qui sifflent", details: null, kilometrage: null, pieces: [], statut: "ouvert" as const, resoluLe: null, serviceNumero: null, declarant: "Banc", creee: true };
const html = renderToString(React.createElement(FormulaireService, { demande: { vehicule: { immatriculation: "AA565GA", immatriculationAffichee: "AA-565-GA", libelle: "TATA LPT1618" }, signalements: [panne], services: [] }, onFermer: () => {}, onEnregistre: () => {} }));
attendu("le formulaire propose les pannes signalées du véhicule, à cocher", html.includes("Pannes et anomalies incluses") && html.includes("Freins qui sifflent"));
attendu("il porte la priorité, le type, les dates, le prestataire", ["Priorité", "Type d&#x27;intervention", "Début des travaux", "Fin des travaux", "Prestataire"].every((m) => html.includes(m)));
attendu("et la facture : lignes, remise globale, total HT, TVA, TTC, BRS, net à payer, coût", ["Main-d&#x27;œuvre", "Remise globale", "Total HT", "TVA", "Total TTC", "BRS", "Net à payer au prestataire", "Coût du service"].every((m) => html.includes(m)));
attendu("à un utilisateur qui n'est pas responsable du parc, pas de bouton « Clôturer »", !html.includes("Clôturer le service"));

/* -- La base ---------------------------------------------------------------------------- */

/* -- Retours du métier, 21 septembre 2026 soir ------------------------------------------- */
{
  /* La main-d'œuvre globale : 100 000 F sans ventilation, s'ajoute au sous-total et porte remise et taxes. */
  const avecGlobale: FactureService = { ...facture, mainOeuvreGlobale: 100_000 };
  const g = calculerService(avecGlobale);
  attendu(`la main-d'œuvre globale entre au sous-total (${g.sousTotalHT}) et au total main-d'œuvre (${g.mainOeuvre})`, g.sousTotalHT === 698_000 && g.mainOeuvre === 275_000 && g.mainOeuvreGlobale === 100_000);
  const dg = depensesDuService(avecGlobale, "curatif");
  attendu("sa part du TTC devient une dépense, et les dépenses font le coût au franc", dg.some((d) => d.libelle === "Main-d'œuvre globale" && d.poste === "maintenance-curative") && dg.reduce((s, d) => s + d.montant, 0) === g.coutTotal);
  attendu("l'immobilisation se calcule des dates : du 18 au 21, quatre jours ; sans fin, rien", joursImmobilisation("2026-09-18", "2026-09-21") === 4 && joursImmobilisation("2026-09-18", null) === null && joursImmobilisation("2026-09-21", "2026-09-18") === null);
  attendu("une ligne garde sa précision libre", lireLignes([{ cle: "x", libelle: "Remplacement des plaquettes de frein", precision: "avant gauche" }])[0]?.precision === "avant gauche");

  /* Pannes et services ouverts dans le travail à faire ; fermés, ils n'y sont plus. */
  const panne = (numero: string, priorite: string, statut: string) => ({ numero, vehiculeId: "AA565GA", immatriculationAffichee: "AA-565-GA", vehicule: "TATA LPT", date: "2026-09-15", priorite, description: `Panne ${numero}`, statut });
  const service = (numero: string, statut: LigneOrdre["statut"], signalements: string[]) => ({ numero, vehiculeId: "AA565GA", immatriculation: "AA565GA", immatriculationAffichee: "AA-565-GA", vehicule: "TATA LPT", businessUnit: null, site: null, type: "curatif", objet: `Service ${numero}`, origineNumero: null, origineLibelle: null, garage: "TATA", datePrevue: "2026-09-16", immobilisationPrevueJours: null, montantEstime: null, statut, dateDebut: null, dateCloture: null, interventionNumero: null, commentaire: null, demandeur: "—", creee: false, signalements }) as LigneOrdre;
  const af = travauxOuverts([], [panne("SIG-1", "normale", "ouvert"), panne("SIG-2", "critique", "ouvert"), panne("SIG-3", "haute", "ouvert"), panne("SIG-4", "haute", "resolu")], [service("OTR-1", "en-atelier", ["SIG-3"]), service("OTR-2", "planifie", []), service("OTR-3", "clos", [])], "2026-09-21", () => ({ businessUnit: null, site: null }));
  const u = (cle: string) => af.find((x) => x.cle === cle)?.urgence;
  attendu(`à faire : panne ouverte à planifier, critique en retard, prise par un service en cours (${u("panne:SIG-1")}, ${u("panne:SIG-2")}, ${u("panne:SIG-3")})`, u("panne:SIG-1") === "a-planifier" && u("panne:SIG-2") === "en-retard" && u("panne:SIG-3") === "en-cours");
  attendu("une panne résolue et un service clos ne sont plus du travail à faire ; un service ouvert seul a sa ligne", !af.some((x) => x.cle === "panne:SIG-4" || x.ordreNumero === "OTR-3") && u("service:OTR-2") === "en-cours" && !af.some((x) => x.cle === "service:OTR-1"));

  /* Les rapports de maintenance : pannes et tâches. */
  const demo = sourceRapportsDemo();
  const avant = (iso: string, jours: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - jours * 86_400_000).toISOString().slice(0, 10);
  const source = {
    ...demo,
    signalements: [{ ...panne("SIG-9", "haute", "resolu"), date: avant(demo.aujourdhui, 10), systeme: "013", details: null, kilometrage: null, pieces: [], resoluLe: avant(demo.aujourdhui, 5), serviceNumero: "OTR-9", declarant: null, creee: false }] as LigneSignalement[],
    interventions: [{ ...demo.interventions[0]!, date: demo.aujourdhui, montant: 90_000, taches: ["Remplacement des plaquettes de frein", "Remplacement des disques de frein"] }],
    catalogueTaches: [{ libelle: "Remplacement des plaquettes de frein", categorie: "1", systeme: "013" }],
  };
  const lp = construireRapportDe(source, "maintenance-pannes", { periode: "12-mois", perimetre: "tout" } as never);
  attendu(`rapport des pannes : état, système, délai de résolution (${lp.length} ligne, délai ${String(lp[0]?.delai)})`, lp.length === 1 && lp[0]!.systeme === "Freins" && lp[0]!.delai === 5);
  const lt = construireRapportDe(source, "maintenance-taches", { periode: "12-mois", perimetre: "tout" } as never);
  const plaquettes = lt.find((l) => l.tache === "Remplacement des plaquettes de frein");
  attendu(`rapport des tâches : une intervention à deux tâches partage son coût (${lt.length} tâches, ${String(plaquettes?.cout)} F, ${String(plaquettes?.categorie)})`, lt.length === 2 && plaquettes?.cout === 45_000 && plaquettes.categorie === "Châssis" && plaquettes.utilisations === 1);
  attendu("chaque rapport de maintenance est au catalogue", ["maintenance-pannes", "maintenance-taches", "maintenance-ordres"].every((id) => RAPPORTS.some((r) => r.id === id)) && RAPPORTS.find((r) => r.id === "maintenance-ordres")!.libelle === "Services de maintenance");

  /* La zone de dépôt, et les programmes lus en base. */
  attendu("attacher une pièce passe par la zone de dépôt « glisser-déposer »", renderToString(React.createElement(ChampPieces, { valeur: [], onChange: () => {}, separer: true })).match(/Glisser-déposer/g)?.length === 2);
  const lus = programmesDepuisLignes(
    [{ code: "leger", libelle: "Léger", precision: null, categories: ["vehicule-leger"], base: "km", actif: true }, { code: "vieux", libelle: "Retiré", precision: null, categories: [], base: "km", actif: false }],
    [{ code: "leger.vidange-moteur", programme_code: "leger", libelle: "Vidange", groupe: "moteur", periodicite_km: 10_000, periodicite_heures: null, periodicite_mois: 12, mots_cles: ["vidange"], duree_heures: "2", cout_estime: "62000", critique: false, ordre: 1, tache_libelle: "Remplacement de l'huile moteur et du filtre" }],
  );
  attendu("un programme lu en base : code court, tâche citée, retirés écartés", lus.length === 1 && lus[0]!.operations[0]!.code === "vidange-moteur" && lus[0]!.operations[0]!.tacheLibelle === "Remplacement de l'huile moteur et du filtre" && programmeParDefaut("vehicule-leger", lus).code === "leger");
  attendu("les mots-clés proposés pour une tâche", motsClesDe("Remplacement des plaquettes de frein").join() === "plaquette,frein");
}

const bac = process.env.PGLITE_DIR ?? "";
if (bac) {
  const require = createRequire(join(bac, "package.json"));
  const { PGlite } = require("@electric-sql/pglite");
  const { btree_gist } = require("@electric-sql/pglite/contrib/btree_gist");
  const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
  const MOI = "00000000-0000-0000-0000-000000000001";
  const pg = new PGlite({ extensions: { btree_gist, pgcrypto } });
  await pg.exec(`create schema auth; create table auth.users (id uuid primary key); insert into auth.users values ('${MOI}');
    create function auth.uid() returns uuid language sql stable as $$ select '${MOI}'::uuid $$;`);
  for (const role of ["anon", "authenticated", "service_role"]) {
    try {
      await pg.exec(`create role ${role}`);
    } catch {}
  }
  for (const m of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(join("supabase/migrations", m), "utf8"));
  attendu("0059 et 0060 se jouent sur la base", true);

  const catalogue = readFileSync("supabase/taches-service.sql", "utf8");
  await pg.exec(catalogue);
  await pg.exec(catalogue);
  const nTaches = (await pg.query(`select count(*)::int as n, count(*) filter (where a_classer)::int as a from tache_service`)).rows[0] as { n: number; a: number };
  attendu(`le catalogue tiré de Fleetio entre, et se rejoue sans doublon (${nTaches.n} tâches)`, nTaches.n === (catalogue.match(/^\s+\('TCH-/gm) ?? []).length && nTaches.n > 250);
  const codifiees = (await pg.query(`select count(*) filter (where a_classer or systeme is null or ensemble is null or categorie is distinct from substr(systeme, 2, 1))::int as n from tache_service`)).rows[0] as { n: number };
  attendu("toutes les tâches sont codifiées : catégorie, système, ensemble ; aucune à classer", nTaches.a === 0 && codifiees.n === 0);
  const classeDe = async (alias: string) => ((await pg.query(`select libelle, systeme, ensemble from tache_service where $1 = any(alias)`, [alias])).rows[0] as { libelle: string; systeme: string; ensemble: string } | undefined);
  const air = await classeDe("appareil air"), ballon = await classeDe("BALLON AIR"), embrayage = await classeDe("DISQUE EMBRAYAGE MERCEDES AXOR"), pneu = await classeDe("ACHATS PNEU 385");
  attendu("la revue range les tâches mal créées : « appareil air » au circuit d'air des freins, « BALLON AIR » à la suspension, le disque d'embrayage à l'embrayage, l'achat de pneus au remplacement des pneus",
    air?.systeme === "013" && ballon?.systeme === "016" && embrayage?.libelle === "Remplacement du disque d'embrayage" && pneu?.libelle === "Remplacement des pneus");
  const retirees = (await pg.query(`select count(*)::int as n from tache_service where libelle in ('Location de véhicule', 'raccord', 'service HSE') or 'raccord' = any(alias)`)).rows[0] as { n: number };
  attendu("ce qui n'est pas une tâche de maintenance est retiré", retirees.n === 0);
  const vidange = (await pg.query(`select libelle, systeme, categorie from tache_service where 'vidange' = any(alias)`)).rows[0] as { libelle: string; systeme: string; categorie: string } | undefined;
  attendu("« vidange » est un alias de la vidange moteur, système 045, catégorie 4", vidange?.systeme === "045" && vidange.categorie === "4");
  const mo = (await pg.query(`select count(*)::int as n from tache_service where lower(libelle) like 'main d%oeuvre%'`)).rows[0] as { n: number };
  attendu("la main-d'œuvre n'est pas une tâche", mo.n === 0);
  const prog = (await pg.query(`select (select count(*)::int from programme_entretien) as p, (select count(*)::int from operation_entretien) as o, (select count(*)::int from operation_entretien where tache_libelle is null or tache_libelle not in (select libelle from tache_service)) as orphelines`)).rows[0] as { p: number; o: number; orphelines: number };
  attendu(`0062 : les quatre programmes d'origine en base, chaque opération cite une tâche du catalogue (${prog.p} programmes, ${prog.o} opérations, ${prog.orphelines} sans tâche)`, prog.p === 4 && prog.o > 15 && prog.orphelines === 0);
  /* La base de production avait le jeu de départ, codé « leger:vidange-moteur » : 0062 y doublait chaque opération. */
  await pg.exec(`insert into operation_entretien (code, programme_code, libelle, groupe, periodicite_km, mots_cles) select replace(code, '.', ':'), programme_code, libelle, groupe, periodicite_km, mots_cles from operation_entretien;`);
  const doublees = ((await pg.query(`select count(*)::int as n from operation_entretien`)).rows[0] as { n: number }).n;
  await pg.exec(readFileSync("supabase/correctif-operations-doublons.sql", "utf8"));
  await pg.exec(readFileSync("supabase/correctif-operations-doublons.sql", "utf8"));
  const apres = ((await pg.query(`select count(*)::int as n from operation_entretien`)).rows[0] as { n: number }).n;
  attendu(`le correctif ôte les opérations en double du jeu de départ, rejouable (${doublees} → ${apres})`, doublees === 2 * prog.o && apres === prog.o);
  const colonne = (await pg.query(`select count(*)::int as n from information_schema.columns where table_name = 'ordre_travail' and column_name = 'main_oeuvre_globale'`)).rows[0] as { n: number };
  attendu("0062 : le service porte sa main-d'œuvre globale", colonne.n === 1);

  await pg.exec(`insert into profil (utilisateur_id, nom, role, actif) values ('${MOI}', 'Banc', 'responsable-maintenance', true) on conflict (utilisateur_id) do update set role = excluded.role;
    insert into vehicule (id, immatriculation, marque, appellation, categorie) values ('00000000-0000-0000-0000-0000000000aa', 'AA565GA', 'TATA', 'LPT1618', 'camion');
    insert into signalement (numero, vehicule_id, date, priorite, systeme, description, pieces) values ('SIG-2026-00001', '00000000-0000-0000-0000-0000000000aa', '2026-09-18', 'critique', '013', 'Freins qui sifflent', array['pieces/p.jpg']);
    insert into ordre_travail (numero, vehicule_id, type, objet, garage, date_prevue, statut, priorite, lignes, tva_taux, brs_taux, signalements)
      values ('OTR-2026-00001', '00000000-0000-0000-0000-0000000000aa', 'curatif', 'Freins', 'TATA', '2026-09-18', 'en-atelier', 'urgent', '${JSON.stringify(facture.lignes).replace(/'/g, "''")}'::jsonb, 18, 5, array['SIG-2026-00001']);
    insert into depense (numero, vehicule_id, date, poste, libelle, montant, origine, reference) values ('DEP-2026-00001', '00000000-0000-0000-0000-0000000000aa', '2026-09-21', 'pieces', 'Batterie (magasin)', 70000, 'stock', 'OTR-2026-00001');`);
  attendu("une dépense d'origine « stock » s'écrit (0059)", ((await pg.query(`select count(*)::int as n from depense where origine = 'stock'`)).rows[0] as { n: number }).n === 1);

  let refus = "";
  try {
    await pg.exec(`update ordre_travail set statut = 'clos', date_cloture = '2026-09-21' where numero = 'OTR-2026-00001'`);
  } catch (e) {
    refus = String((e as Error).message);
  }
  attendu(`le responsable de la maintenance ne clôt pas : la base refuse (${refus.slice(0, 60)})`, refus.includes("responsable du parc"));
  await pg.exec(`update profil set role = 'gestionnaire-parc' where utilisateur_id = '${MOI}';
    update ordre_travail set statut = 'clos', date_cloture = '2026-09-21' where numero = 'OTR-2026-00001';`);
  const clos = (await pg.query(`select o.statut, o.cloture_par::text as par, s.statut as signalement, s.resolu_le::text as le, s.service_numero from ordre_travail o, signalement s where o.numero = 'OTR-2026-00001' and s.numero = 'SIG-2026-00001'`)).rows[0] as { statut: string; par: string; signalement: string; le: string; service_numero: string };
  attendu("le responsable du parc clôt ; la clôture se signe", clos.statut === "clos" && clos.par === MOI);
  attendu("et la panne incluse est résolue, datée, rattachée au service", clos.signalement === "resolu" && clos.le === "2026-09-21" && clos.service_numero === "OTR-2026-00001");

  /* 0061 : les interventions du parc affectées au catalogue, et les utilisations comptées chez nous. */
  const affectations = readFileSync("supabase/interventions-taches.sql", "utf8");
  const exemple = /\('(INT-[^']+)', '((?:[^']|'')+)'\)/.exec(affectations)!;
  const [numeroInt, tacheInt] = [exemple[1]!, exemple[2]!.replace(/''/g, "'")];
  const attendues = [...affectations.matchAll(new RegExp(`\\('${numeroInt}', '((?:[^']|'')+)'\\)`, "g"))].length;
  await pg.exec(`insert into intervention (numero, vehicule_id, date, type, objet) values ('${numeroInt}', '00000000-0000-0000-0000-0000000000aa', '2026-01-10', 'curatif', 'Banc');`);
  await pg.exec(affectations);
  await pg.exec(affectations);
  const liens = async () => ((await pg.query(`select count(*)::int as n from intervention_tache`)).rows[0] as { n: number }).n;
  const util = async (libelle: string) => ((await pg.query(`select utilisations as n from tache_service where libelle = $1`, [libelle])).rows[0] as { n: number } | undefined)?.n;
  attendu(`une intervention du parc est affectée à ses tâches, rejouable (${numeroInt} → ${attendues} tâche(s), dont « ${tacheInt} »)`, (await liens()) === attendues && (await util(tacheInt)) === 1);
  attendu("les utilisations se comptent sur notre parc : le service clos compte pour ses tâches", (await util("Remplacement des plaquettes de frein")) === 1 && (await util("Remplacement de l'assemblage d'embrayage")) === 1);
  await pg.exec(catalogue);
  attendu("rejouer le catalogue garde les affectations et le compte", (await liens()) === attendues && (await util(tacheInt)) === 1);

  const niveaux = (await pg.query(`select niveau_par_role('gestionnaire-parc', 'maintenance') as gp, niveau_par_role('direction', 'maintenance') as dir, niveau_par_role('responsable-maintenance', 'maintenance') as rm`)).rows[0] as { gp: string; dir: string; rm: string };
  attendu(`le responsable du parc gère la maintenance ; la direction la lit (${niveaux.gp}, ${niveaux.dir})`, niveaux.gp === "gestion" && niveaux.dir === "lecture" && niveaux.rm === "gestion");

  await pg.exec(`insert into piece (id, numero, reference, designation, prix_reference) values ('00000000-0000-0000-0000-0000000000bb', 'PCE-2026-00001', 'BAT-150', 'Batterie 150 AH', 30000);
    insert into mouvement_stock (numero, date, nature, piece_id, quantite, prix_unitaire) values ('MVT-2026-00001', '2026-09-20', 'entree', '00000000-0000-0000-0000-0000000000bb', 4, 35000);`);
  const prix = (await pg.query(`select prix_reference::int as p from piece where numero = 'PCE-2026-00001'`)).rows[0] as { p: number };
  attendu(`le prix de référence suit la dernière entrée de stock (${prix.p})`, prix.p === 35_000);
} else console.log("—   PGLITE_DIR absent : la base n'est pas éprouvée");

console.log(echecs ? `${echecs} échec(s)` : "tout passe");
process.exit(echecs ? 1 : 0);
