"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, Fuel, Pencil, Plus, UserRound } from "lucide-react";
import { LienRetour } from "@/composants/interface/LienRetour";
import { BandeauKpi } from "@/composants/interface/BandeauKpi";
import { Carte, Definitions, TableauSimple } from "@/composants/interface/Carte";
import { Echeance } from "@/composants/interface/Pastille";
import { champsCamion, champsCreation } from "@/composants/transactions/champs";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { PastillesEquipement } from "@/composants/vehicule/PastillesEquipement";
import { PhotoVehicule } from "@/composants/vehicule/PhotoVehicule";
import { TYPE_CONTRAT, libelleCamion } from "@/domaine/camions-tiers";
import { BUSINESS_UNIT, CATEGORIE_VEHICULE, NATURE_INCIDENT, STATUT_DECLARATION, STATUT_VEHICULE, TYPE_INCIDENT, formulerEcheance, tonEcheance } from "@/domaine/libelles";
import { jourCourant } from "@/domaine/temps";
import type { TypeTransaction } from "@/domaine/reference";
import type { FicheCamionTiers as Fiche } from "@/donnees/camions-tiers";
import { peutCourant } from "@/lib/acces-courant";
import { enregistrerModification } from "@/lib/clotures-demo";
import { date as formaterDate, montant, montantCourt, nombre } from "@/lib/format";
import { OuvrirPiece } from "@/composants/interface/OuvrirPiece";

/* ============================================================================
 * La fiche d'un camion de transporteur (métier, 3 octobre 2026) — « le plus
 * possible proche de la vue de notre propre flotte ».
 *
 * L'en-tête comme celui d'un véhicule du parc : photo, plaque, statut,
 * équipements (balise, cartes péage), transporteur, chauffeur, contrat. Puis
 * les onglets de ce que SEDIMA suit d'un camion qui roule pour elle : le
 * carburant qu'elle lui fournit, les volumes qu'il transporte, ses incidents et
 * accidents, sa conformité administrative, ses mois de mise à disposition.
 * ==========================================================================*/

type Onglet = "apercu" | "caracteristiques" | "volumes" | "carburant" | "incidents" | "conformite" | "mad" | "journal";

const n1 = (x: number) => nombre(x, Number.isInteger(x) ? 0 : 1);

function ilYA(jours: number, aujourdhui: string): string {
  const d = new Date(`${aujourdhui}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - jours);
  return d.toISOString().slice(0, 10);
}

function joursEntre(debut: string, fin: string): number {
  return Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000);
}

export function FicheCamionTiers({ fiche, ongletInitial }: { fiche: Fiche; ongletInitial?: string }) {
  const c = fiche.camion;
  const { demander, creer, actualiser } = useEdition();
  const [peutGerer, setPeutGerer] = useState(false);
  useEffect(() => setPeutGerer(peutCourant("transporteurs", "gestion")), []);

  const avecMad = c.typeContrat === "mise-a-disposition" || fiche.misesADisposition.length > 0;
  const ONGLETS: { cle: Onglet; libelle: string }[] = [
    { cle: "apercu", libelle: "Aperçu" },
    { cle: "caracteristiques", libelle: "Caractéristiques" },
    { cle: "volumes", libelle: "Volumes transportés" },
    { cle: "carburant", libelle: "Carburant" },
    { cle: "incidents", libelle: "Incidents & accidents" },
    { cle: "conformite", libelle: "Conformité" },
    ...(avecMad ? [{ cle: "mad" as const, libelle: "Mise à disposition" }] : []),
    { cle: "journal", libelle: "Journal" },
  ];
  const [onglet, setOnglet] = useState<Onglet>(() => (ONGLETS.some((o) => o.cle === ongletInitial) ? (ongletInitial as Onglet) : "apercu"));

  const aujourdhui = fiche.aujourdhui;
  const depuis30 = ilYA(30, aujourdhui);
  const voyages30 = fiche.voyages.filter((v) => v.date >= depuis30);
  const pleins30 = fiche.pleins.filter((p) => p.date >= depuis30);
  const incidentsOuverts = fiche.incidents.filter((i) => i.statut !== "clos").length;
  /* Un document compte par son dernier exemplaire de chaque type : l'ancienne assurance échue, remplacée, ne dit plus rien. */
  const derniersDocuments = useMemo(() => {
    const m = new Map<string, Fiche["documents"][number]>();
    for (const d of fiche.documents) {
      const deja = m.get(d.type);
      if (!deja || (d.echeance ?? "") > (deja.echeance ?? "")) m.set(d.type, d);
    }
    return [...m.values()];
  }, [fiche.documents]);
  const echus = derniersDocuments.filter((d) => d.echeance && d.echeance < aujourdhui).length;

  const statut = STATUT_VEHICULE[c.statut];
  const numeroFiche = `CAM-${c.immatriculation}`;
  const href = `/transporteurs/camions/${c.immatriculation}`;

  function modifier() {
    demander({
      type: "camion",
      numero: numeroFiche,
      titre: `Camion ${c.immatriculationAffichee}`,
      champs: champsCamion("modification"),
      valeurs: {
        marque: c.marque ?? "",
        modele: c.modele ?? "",
        categorie: c.categorie,
        capaciteTonnes: c.capaciteTonnes ?? "",
        vin: c.vin ?? "",
        premiereMiseEnCirculation: c.premiereMiseEnCirculation ?? "",
        photo: c.photo ?? "",
        statut: c.statut,
        businessUnit: c.businessUnit ?? "",
        chauffeurNom: c.chauffeur?.nom ?? "",
        chauffeurTelephone: c.chauffeur?.telephone ?? "",
        actif: c.actif,
        typeContrat: c.typeContrat,
        carburantFourni: c.carburantFourni,
        baliseGeolocalisation: c.balise,
        cartePeageSecaa: c.carteSecaa,
        numeroCarteSecaa: c.numeroCarteSecaa ?? "",
        cartePeageAgeroute: c.carteAgeroute,
        numeroCarteAgeroute: c.numeroCarteAgeroute ?? "",
        commentaire: c.commentaire ?? "",
      },
    });
  }

  function ajouter(type: TypeTransaction) {
    const titres: Partial<Record<TypeTransaction, string>> = { plein: "Plein de carburant", incident: "Incident ou accident", document: "Document" };
    const champs = champsCreation(type, { pour: "vehicule" }).filter((ch) => ch.cle !== "chauffeurId");
    const jour = jourCourant();
    const valeurs: Record<string, unknown> = type === "incident" ? { dateHeure: `${jour}T08:00` } : type === "document" ? { dateEffet: jour } : { date: jour };
    creer({ type, titre: `${titres[type]} · ${c.immatriculationAffichee}`, champs, valeurs, apresCreation: () => setOnglet(type === "plein" ? "carburant" : type === "incident" ? "incidents" : "conformite") });
  }

  return (
    <div className="flex flex-col lg:h-full">
      {/* ---- En-tête fixe ---- */}
      <div className="flex shrink-0 flex-col gap-4 border-b border-bordure px-8 pt-6 pb-0">
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
          <LienRetour href="/transporteurs" libelle="Transporteurs" />
        </nav>

        <div className="flex flex-wrap items-start gap-4">
          <PhotoVehicule
            photo={c.photo}
            categorie={c.categorie}
            immatriculation={c.immatriculationAffichee}
            onChanger={
              peutGerer
                ? (photo) =>
                    enregistrerModification({
                      numero: numeroFiche,
                      type: "camion",
                      titre: `Camion ${c.immatriculationAffichee}`,
                      href,
                      champs: [{ cle: "photo", libelle: "Photo", type: "texte" }],
                      avant: { photo: c.photo ?? null },
                      apres: { photo },
                      motif: photo ? "Photo du camion ajoutée" : "Photo du camion retirée",
                    }) && actualiser()
                : undefined
            }
          />
          <div className="min-w-0 flex-1 basis-[420px]">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="titre-page code whitespace-nowrap">{c.immatriculationAffichee}</h1>
              <span title={statut?.precision} className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface-3 px-2.5 text-[12px] font-medium text-texte-2">
                <span className="size-2 rounded-full" style={{ background: statut?.couleur }} />
                {statut?.libelle ?? c.statut}
              </span>
              {!c.actif ? <span className="inline-flex h-6 items-center rounded-full bg-surface-3 px-2.5 text-[12px] font-medium text-texte-2">Plus engagé pour SEDIMA</span> : null}
              <PastillesEquipement e={{ balise: c.balise, carteSecaa: c.carteSecaa, numeroCarteSecaa: c.numeroCarteSecaa, carteAgeroute: c.carteAgeroute, numeroCarteAgeroute: c.numeroCarteAgeroute }} />
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-texte-2">
              <span className="font-medium text-texte">{libelleCamion(c)}</span>
              {c.capaciteTonnes ? (
                <>
                  <span className="text-attenue-2">·</span>
                  <span>{n1(c.capaciteTonnes)} t</span>
                </>
              ) : null}
              <span className="text-attenue-2">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5 text-attenue" strokeWidth={1.8} />
                <Link href={`/prestataires/${c.transporteurNumero}`} className="font-medium text-texte hover:text-accent-fonce hover:underline" title="La fiche du transporteur : contrat, grille, facturation, performance">
                  {c.transporteur}
                </Link>
              </span>
              <span className="text-attenue-2">·</span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-3.5 text-attenue" strokeWidth={1.8} />
                {c.chauffeur ? (
                  <span className="font-medium text-texte" title={c.chauffeur.telephone ?? undefined}>
                    {c.chauffeur.nom}
                    {c.chauffeur.telephone ? <span className="code font-normal text-texte-2"> · {c.chauffeur.telephone}</span> : null}
                  </span>
                ) : (
                  <span className="text-vigilance">Aucun chauffeur affecté</span>
                )}
              </span>
              <span className="text-attenue-2">·</span>
              <span>{TYPE_CONTRAT[c.typeContrat].court}</span>
              {c.carburantFourni ? (
                <>
                  <span className="text-attenue-2">·</span>
                  <span className="inline-flex items-center gap-1.5 text-accent-fonce">
                    <Fuel className="size-3.5" strokeWidth={1.8} />
                    Carburant fourni par SEDIMA
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {peutGerer ? (
              <button type="button" onClick={modifier} className="bouton-secondaire">
                <Pencil className="size-4 text-texte-2" strokeWidth={1.7} />
                Modifier
              </button>
            ) : null}
            <MenuAjoutCamion onChoix={ajouter} />
          </div>
        </div>

        <BandeauKpi
          kpis={[
            { label: "Voyages", valeur: String(voyages30.length), unite: "", precision: "30 derniers jours, au relevé" },
            { label: "Tonnes transportées", valeur: n1(Math.round(voyages30.reduce((s, v) => s + v.tonnage, 0) * 10) / 10), unite: "t", precision: "30 derniers jours" },
            { label: "Carburant fourni", valeur: n1(Math.round(pleins30.reduce((s, p) => s + p.litres, 0))), unite: "L", precision: `${montantCourt(pleins30.reduce((s, p) => s + p.montant, 0))} · 30 jours` },
            { label: "Incidents ouverts", valeur: String(incidentsOuverts), unite: "", precision: `${fiche.incidents.length} au total`, ton: incidentsOuverts ? "vigilance" : "neutre" },
            { label: "Documents échus", valeur: String(echus), unite: "", precision: `${derniersDocuments.length} suivis`, ton: echus ? "defavorable" : "favorable" },
          ]}
        />

        <div className="-mb-px flex flex-wrap items-end gap-1" role="tablist" aria-label="Sections de la fiche">
          {ONGLETS.map((o) => {
            const actif = o.cle === onglet;
            return (
              <button
                key={o.cle}
                type="button"
                role="tab"
                aria-selected={actif}
                onClick={() => setOnglet(o.cle)}
                className={`relative flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pt-1 pb-3 text-[13px] whitespace-nowrap transition-colors ${actif ? "border-accent font-semibold text-texte" : "border-transparent font-medium text-texte-2 hover:text-texte"}`}
              >
                {o.libelle}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Contenu de l'onglet ---- */}
      <div role="tabpanel" className="defilement-discret min-h-0 flex-1 px-8 py-6 lg:overflow-y-auto">
        {onglet === "apercu" && <Apercu fiche={fiche} derniersDocuments={derniersDocuments} />}
        {onglet === "caracteristiques" && <Caracteristiques fiche={fiche} />}
        {onglet === "volumes" && <Volumes fiche={fiche} />}
        {onglet === "carburant" && <Carburant fiche={fiche} onAjouter={() => ajouter("plein")} />}
        {onglet === "incidents" && <Incidents fiche={fiche} onAjouter={() => ajouter("incident")} />}
        {onglet === "conformite" && <Conformite documents={derniersDocuments} tous={fiche.documents} aujourdhui={aujourdhui} onAjouter={() => ajouter("document")} />}
        {onglet === "mad" && <MiseADisposition fiche={fiche} />}
        {onglet === "journal" && <Journal fiche={fiche} />}
      </div>
    </div>
  );
}

function MenuAjoutCamion({ onChoix }: { onChoix: (t: TypeTransaction) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const choix: { type: TypeTransaction; libelle: string }[] = [
    { type: "plein", libelle: "Plein de carburant" },
    { type: "incident", libelle: "Incident ou accident" },
    { type: "document", libelle: "Document (assurance, visite…)" },
  ];
  return (
    <div className="relative">
      <button type="button" className="bouton-principal" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
        <Plus className="size-4" strokeWidth={2.2} />
        Ajouter
      </button>
      {ouvert ? (
        <div className="absolute top-full right-0 z-40 mt-1.5 w-[240px] overflow-hidden rounded-[12px] border border-bordure bg-surface py-1 shadow-modale" role="menu">
          {choix.map((x) => (
            <button
              key={x.type}
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-texte hover:bg-surface-3"
              onClick={() => {
                setOuvert(false);
                onChoix(x.type);
              }}
            >
              {x.libelle}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* -- Les onglets ------------------------------------------------------------------ */

function Apercu({ fiche, derniersDocuments }: { fiche: Fiche; derniersDocuments: Fiche["documents"] }) {
  const parMois = useMemo(() => {
    const m = new Map<string, { voyages: number; tonnes: number; litres: number; carburant: number }>();
    const ligne = (mois: string) => m.get(mois) ?? { voyages: 0, tonnes: 0, litres: 0, carburant: 0 };
    for (const v of fiche.voyages) {
      const k = v.date.slice(0, 7);
      const l = ligne(k);
      m.set(k, { ...l, voyages: l.voyages + 1, tonnes: l.tonnes + v.tonnage });
    }
    for (const p of fiche.pleins) {
      const k = p.date.slice(0, 7);
      const l = ligne(k);
      m.set(k, { ...l, litres: l.litres + p.litres, carburant: l.carburant + p.montant });
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  }, [fiche.voyages, fiche.pleins]);
  const destinations = useMemo(() => {
    const m = new Map<string, { voyages: number; tonnes: number }>();
    for (const v of fiche.voyages) {
      const l = m.get(v.destination) ?? { voyages: 0, tonnes: 0 };
      m.set(v.destination, { voyages: l.voyages + 1, tonnes: l.tonnes + v.tonnage });
    }
    return [...m.entries()].sort((a, b) => b[1].tonnes - a[1].tonnes).slice(0, 8);
  }, [fiche.voyages]);
  const prochain = derniersDocuments.filter((d) => d.echeance).sort((a, b) => (a.echeance ?? "").localeCompare(b.echeance ?? ""))[0];
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Carte titre="Mois par mois" precision="Voyages et tonnes au relevé de tonnage, carburant fourni par SEDIMA" sansMarge>
        <TableauSimple
          cle={([mois]) => mois}
          lignes={parMois}
          filtrable={false}
          vide="Aucun voyage ni plein enregistré pour ce camion."
          colonnes={[
            { cle: "mois", libelle: "Mois", rendu: ([mois]) => <span className="code">{mois}</span> },
            { cle: "voyages", libelle: "Voyages", alignee: "droite", rendu: ([, l]) => <span className="code">{l.voyages || "—"}</span> },
            { cle: "tonnes", libelle: "Tonnes", alignee: "droite", rendu: ([, l]) => <span className="code">{l.tonnes ? n1(Math.round(l.tonnes * 10) / 10) : "—"}</span> },
            { cle: "litres", libelle: "Litres", alignee: "droite", rendu: ([, l]) => <span className="code">{l.litres ? n1(Math.round(l.litres)) : "—"}</span> },
            { cle: "carburant", libelle: "Carburant", alignee: "droite", rendu: ([, l]) => <span className="code">{l.carburant ? montantCourt(l.carburant) : "—"}</span> },
          ]}
        />
      </Carte>
      <div className="flex flex-col gap-5">
        <Carte titre="Destinations les plus servies" precision="Sur tout l'historique du relevé" sansMarge>
          <TableauSimple
            cle={([d]) => d}
            lignes={destinations}
            filtrable={false}
            vide="Aucun voyage au relevé."
            colonnes={[
              { cle: "destination", libelle: "Destination", rendu: ([d]) => d },
              { cle: "voyages", libelle: "Voyages", alignee: "droite", rendu: ([, l]) => <span className="code">{l.voyages}</span> },
              { cle: "tonnes", libelle: "Tonnes", alignee: "droite", rendu: ([, l]) => <span className="code">{n1(Math.round(l.tonnes * 10) / 10)}</span> },
            ]}
          />
        </Carte>
        <Carte titre="Conformité">
          {prochain ? (
            <p className="text-[13.5px] text-texte-2">
              Prochaine échéance : <span className="font-medium text-texte">{prochain.libelle}</span> le {formaterDate(prochain.echeance!)} —{" "}
              <Echeance ton={tonEcheance(joursEntre(fiche.aujourdhui, prochain.echeance!))}>{formulerEcheance(joursEntre(fiche.aujourdhui, prochain.echeance!))}</Echeance>
            </p>
          ) : (
            <p className="text-[13.5px] text-attenue">Aucun document enregistré pour ce camion : carte grise, assurance et visite technique se saisissent dans l'onglet Conformité.</p>
          )}
        </Carte>
      </div>
    </div>
  );
}

function Caracteristiques({ fiche }: { fiche: Fiche }) {
  const c = fiche.camion;
  const oui = (b: boolean, num?: string | null) => (b ? (num ? <span className="code">{num}</span> : "Oui") : <span className="text-attenue-2">Non</span>);
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Carte titre="Identification">
        <Definitions
          elements={[
            { libelle: "Immatriculation", valeur: <span className="code">{c.immatriculationAffichee}</span> },
            { libelle: "Marque", valeur: c.marque },
            { libelle: "Modèle", valeur: c.modele },
            { libelle: "Catégorie", valeur: CATEGORIE_VEHICULE[c.categorie] ?? c.categorie },
            { libelle: "Capacité", valeur: c.capaciteTonnes ? `${n1(c.capaciteTonnes)} t` : null },
            { libelle: "N° de châssis", valeur: c.vin ? <span className="code">{c.vin}</span> : null },
            { libelle: "1re mise en circulation", valeur: c.premiereMiseEnCirculation ? formaterDate(c.premiereMiseEnCirculation) : null },
            { libelle: "Entré au référentiel", valeur: c.creeLe ? formaterDate(c.creeLe.slice(0, 10)) : null },
          ]}
        />
      </Carte>
      <Carte titre="Exploitation et contrat">
        <Definitions
          elements={[
            { libelle: "Transporteur", valeur: c.transporteur },
            { libelle: "Business unit servie", valeur: c.businessUnit ? BUSINESS_UNIT[c.businessUnit] : null },
            { libelle: "Chauffeur affecté", valeur: c.chauffeur?.nom ?? null },
            { libelle: "Téléphone du chauffeur", valeur: c.chauffeur?.telephone ? <span className="code">{c.chauffeur.telephone}</span> : null },
            { libelle: "Type de contrat", valeur: TYPE_CONTRAT[c.typeContrat].libelle },
            { libelle: "Carburant", valeur: c.carburantFourni ? "Fourni par SEDIMA (cuve ou station)" : "À la charge du transporteur" },
            { libelle: "Statut", valeur: STATUT_VEHICULE[c.statut]?.libelle ?? c.statut },
            { libelle: "Engagé pour SEDIMA", valeur: c.actif ? "Oui" : "Non" },
          ]}
        />
      </Carte>
      <Carte titre="Équipements">
        <Definitions
          elements={[
            { libelle: "Balise de géolocalisation", valeur: oui(c.balise) },
            { libelle: "Carte péage SECAA", valeur: oui(c.carteSecaa, c.numeroCarteSecaa) },
            { libelle: "Carte péage Agéroute", valeur: oui(c.carteAgeroute, c.numeroCarteAgeroute) },
          ]}
        />
      </Carte>
      <Carte titre="Commentaire">
        <p className="text-[13.5px] whitespace-pre-line text-texte-2">{c.commentaire ?? <span className="text-attenue-2">—</span>}</p>
      </Carte>
    </div>
  );
}

function Volumes({ fiche }: { fiche: Fiche }) {
  const total = fiche.voyages.reduce((s, v) => s + v.tonnage, 0);
  return (
    <div className="flex flex-col gap-5">
      <Carte titre="Voyages au relevé de tonnage" precision={`${fiche.voyages.length} voyages · ${n1(Math.round(total * 10) / 10)} t — le relevé hebdomadaire de la Direction des Opérations`} sansMarge>
        <TableauSimple
          reglages="camion-tiers.voyages"
          cle={(v) => v.numero}
          lignes={fiche.voyages}
          filtrable={fiche.voyages.length > 8}
          vide="Aucun voyage de ce camion au relevé."
          colonnes={[
            { cle: "date", libelle: "Date", rendu: (v) => <span className="code">{formaterDate(v.date)}</span> },
            { cle: "destination", libelle: "Destination", rendu: (v) => v.destination },
            { cle: "tonnage", libelle: "Tonnage", alignee: "droite", rendu: (v) => <span className="code">{n1(v.tonnage)} t</span> },
            { cle: "pese", libelle: "Pesé", alignee: "droite", parDefaut: false, rendu: (v) => (v.tonnagePese === null ? <span className="text-attenue-2">—</span> : <span className="code">{n1(v.tonnagePese)} t</span>) },
            { cle: "chauffeur", libelle: "Chauffeur", rendu: (v) => v.chauffeur ?? <span className="text-attenue-2">—</span> },
            { cle: "produit", libelle: "Produit", parDefaut: false, rendu: (v) => v.produit ?? "—" },
            { cle: "bl", libelle: "BL", parDefaut: false, rendu: (v) => (v.bonLivraison ? <span className="code">{v.bonLivraison}</span> : "—") },
            { cle: "numero", libelle: "N°", parDefaut: false, rendu: (v) => <span className="code text-texte-2">{v.numero}</span> },
          ]}
        />
      </Carte>
      {fiche.livraisons.length > 0 ? (
        <Carte titre="Livraisons des usines (Sage X3)" precision={`${fiche.livraisons.length} bons de livraison portant ce camion`} sansMarge>
          <TableauSimple
            reglages="camion-tiers.livraisons"
            cle={(l) => l.numero}
            lignes={fiche.livraisons}
            filtrable={fiche.livraisons.length > 8}
            colonnes={[
              { cle: "date", libelle: "Date", rendu: (l) => <span className="code">{formaterDate(l.date)}</span> },
              { cle: "numero", libelle: "BL", rendu: (l) => <span className="code">{l.numero}</span> },
              { cle: "site", libelle: "Site", rendu: (l) => l.site ?? "—" },
              { cle: "client", libelle: "Client", rendu: (l) => l.client ?? "—" },
              { cle: "poids", libelle: "Poids", alignee: "droite", rendu: (l) => (l.poidsKg ? <span className="code">{nombre(l.poidsKg)} kg</span> : "—") },
            ]}
          />
        </Carte>
      ) : null}
    </div>
  );
}

function Carburant({ fiche, onAjouter }: { fiche: Fiche; onAjouter: () => void }) {
  const litres = fiche.pleins.reduce((s, p) => s + p.litres, 0);
  const cout = fiche.pleins.reduce((s, p) => s + p.montant, 0);
  return (
    <Carte
      titre="Pleins fournis par SEDIMA"
      precision={fiche.camion.carburantFourni ? `${fiche.pleins.length} pleins · ${n1(Math.round(litres))} L · ${montant(cout)} — chaque plein entre dans le coût de la mise à disposition du mois` : "Le carburant de ce camion est à la charge du transporteur ; un plein fourni à titre exceptionnel se saisit quand même ici."}
      action={
        <button type="button" className="bouton-secondaire h-8" onClick={onAjouter}>
          <Plus className="size-4" strokeWidth={2} />
          Saisir un plein
        </button>
      }
      sansMarge
    >
      <TableauSimple
        reglages="camion-tiers.pleins"
        cle={(p) => p.numero}
        lignes={fiche.pleins}
        filtrable={fiche.pleins.length > 8}
        vide="Aucun plein pour ce camion."
        colonnes={[
          { cle: "date", libelle: "Date", rendu: (p) => <span className="code">{formaterDate(p.date)}</span> },
          { cle: "source", libelle: "Où", rendu: (p) => p.source },
          { cle: "litres", libelle: "Litres", alignee: "droite", rendu: (p) => <span className="code">{n1(p.litres)} L</span> },
          { cle: "prix", libelle: "Prix du litre", alignee: "droite", rendu: (p) => <span className="code">{nombre(p.prixLitre)} F</span> },
          { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (p) => <span className="code">{montant(p.montant)}</span> },
          { cle: "reference", libelle: "Référence", parDefaut: false, rendu: (p) => p.reference ?? "—" },
          { cle: "piece", libelle: "Pièce", rendu: (p) => (p.photo ? <OuvrirPiece fichier={p.photo} /> : <span className="text-attenue-2">—</span>) },
          { cle: "numero", libelle: "N°", parDefaut: false, rendu: (p) => <span className="code text-texte-2">{p.numero}</span> },
        ]}
      />
    </Carte>
  );
}

function Incidents({ fiche, onAjouter }: { fiche: Fiche; onAjouter: () => void }) {
  return (
    <Carte
      titre="Incidents et accidents"
      precision="Ce qui arrive à ce camion pendant qu'il roule pour SEDIMA : panne en route, accident, avarie de marchandise"
      action={
        <button type="button" className="bouton-secondaire h-8" onClick={onAjouter}>
          <Plus className="size-4" strokeWidth={2} />
          Déclarer
        </button>
      }
      sansMarge
    >
      <TableauSimple
        reglages="camion-tiers.incidents"
        cle={(i) => i.numero}
        lignes={fiche.incidents}
        filtrable={fiche.incidents.length > 8}
        vide="Aucun incident ni accident déclaré pour ce camion."
        colonnes={[
          { cle: "date", libelle: "Date", rendu: (i) => <span className="code">{formaterDate(i.dateHeure.slice(0, 10))}</span> },
          { cle: "nature", libelle: "Nature", rendu: (i) => NATURE_INCIDENT[i.nature as keyof typeof NATURE_INCIDENT] ?? i.nature },
          { cle: "type", libelle: "Type", rendu: (i) => TYPE_INCIDENT[i.type as keyof typeof TYPE_INCIDENT] ?? i.type },
          { cle: "lieu", libelle: "Lieu", rendu: (i) => i.lieu ?? "—" },
          { cle: "description", libelle: "Ce qui s'est passé", rendu: (i) => <span className="block truncate text-texte-2">{i.description ?? "—"}</span> },
          { cle: "statut", libelle: "Statut", rendu: (i) => <Echeance ton={i.statut === "clos" ? "favorable" : "vigilance"}>{STATUT_DECLARATION[i.statut as keyof typeof STATUT_DECLARATION] ?? i.statut}</Echeance> },
          { cle: "numero", libelle: "N°", parDefaut: false, rendu: (i) => <span className="code text-texte-2">{i.numero}</span> },
        ]}
      />
    </Carte>
  );
}

function Conformite({ documents, tous, aujourdhui, onAjouter }: { documents: Fiche["documents"]; tous: Fiche["documents"]; aujourdhui: string; onAjouter: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Carte
        titre="Documents en vigueur"
        precision="Le dernier exemplaire de chaque document : carte grise, assurance, visite technique, licence de transport…"
        action={
          <button type="button" className="bouton-secondaire h-8" onClick={onAjouter}>
            <Plus className="size-4" strokeWidth={2} />
            Ajouter un document
          </button>
        }
        sansMarge
      >
        <TableauSimple
          cle={(d) => d.numero}
          lignes={documents}
          filtrable={false}
          vide="Aucun document enregistré : demandez au transporteur la carte grise, l'assurance et la visite technique du camion."
          colonnes={[
            { cle: "document", libelle: "Document", rendu: (d) => <span className="font-medium">{d.libelle}</span> },
            { cle: "piece", libelle: "N°", rendu: (d) => (d.numeroPiece ? <span className="code">{d.numeroPiece}</span> : "—") },
            { cle: "emetteur", libelle: "Émetteur", rendu: (d) => d.emetteur ?? "—" },
            { cle: "echeance", libelle: "Échéance", rendu: (d) => (d.echeance ? <span className="code">{formaterDate(d.echeance)}</span> : <span className="text-attenue-2">sans échéance</span>) },
            {
              cle: "etat",
              libelle: "État",
              rendu: (d) => (d.echeance ? <Echeance ton={tonEcheance(joursEntre(aujourdhui, d.echeance))}>{formulerEcheance(joursEntre(aujourdhui, d.echeance))}</Echeance> : <span className="text-attenue-2">—</span>),
            },
            { cle: "fichier", libelle: "Pièce", rendu: (d) => (d.fichier ? <OuvrirPiece fichier={d.fichier} /> : <span className="text-attenue-2">—</span>) },
          ]}
        />
      </Carte>
      {tous.length > documents.length ? (
        <Carte titre="Historique des documents" sansMarge>
          <TableauSimple
            cle={(d) => d.numero}
            lignes={tous}
            filtrable={false}
            colonnes={[
              { cle: "document", libelle: "Document", rendu: (d) => d.libelle },
              { cle: "effet", libelle: "Effet", rendu: (d) => (d.dateEffet ? formaterDate(d.dateEffet) : "—") },
              { cle: "echeance", libelle: "Échéance", rendu: (d) => (d.echeance ? formaterDate(d.echeance) : "—") },
              { cle: "numero", libelle: "N°", rendu: (d) => <span className="code text-texte-2">{d.numero}</span> },
            ]}
          />
        </Carte>
      ) : null}
    </div>
  );
}

function MiseADisposition({ fiche }: { fiche: Fiche }) {
  return (
    <Carte titre="Mois de mise à disposition" precision="Le carburant du mois se tient seul à partir des pleins saisis (0071)" sansMarge>
      <TableauSimple
        cle={(m) => m.numero}
        lignes={fiche.misesADisposition}
        filtrable={false}
        vide="Aucune fiche de mise à disposition pour ce camion."
        colonnes={[
          { cle: "mois", libelle: "Mois", rendu: (m) => <span className="code">{m.mois}</span> },
          { cle: "jours", libelle: "Jours", alignee: "droite", rendu: (m) => <span className="code">{m.joursCalendaires}</span> },
          { cle: "panne", libelle: "En panne", alignee: "droite", rendu: (m) => <span className="code">{m.joursPanne ?? "—"}</span> },
          { cle: "roules", libelle: "Roulés", alignee: "droite", rendu: (m) => <span className="code">{m.joursRoules ?? "—"}</span> },
          { cle: "prix", libelle: "Prix du jour", alignee: "droite", rendu: (m) => <span className="code">{montant(m.prixJour)}</span> },
          { cle: "litres", libelle: "Carburant", alignee: "droite", rendu: (m) => <span className="code">{m.carburantLitres ? `${n1(m.carburantLitres)} L` : "—"}</span> },
          { cle: "carburant", libelle: "Coût carburant", alignee: "droite", rendu: (m) => <span className="code">{m.carburantMontant ? montant(m.carburantMontant) : "—"}</span> },
          { cle: "tonnes", libelle: "Tonnes", alignee: "droite", rendu: (m) => <span className="code">{m.tonnes ? n1(m.tonnes) : "—"}</span> },
          { cle: "statut", libelle: "Statut", rendu: (m) => m.statut },
        ]}
      />
    </Carte>
  );
}

function Journal({ fiche }: { fiche: Fiche }) {
  return (
    <Carte titre="Journal des modifications" precision="Qui a changé quoi sur la fiche du camion, et pourquoi" sansMarge>
      <TableauSimple
        cle={(t) => `${t.date}-${t.champ}`}
        lignes={fiche.journal}
        filtrable={false}
        vide="Aucune modification de la fiche depuis son entrée au référentiel."
        colonnes={[
          { cle: "date", libelle: "Date", rendu: (t) => <span className="code">{formaterDate(t.date.slice(0, 10))}</span> },
          { cle: "champ", libelle: "Champ", rendu: (t) => t.champ },
          { cle: "avant", libelle: "Avant", rendu: (t) => <span className="block truncate text-texte-2">{t.avant ?? "—"}</span> },
          { cle: "apres", libelle: "Après", rendu: (t) => <span className="block truncate">{t.apres ?? "—"}</span> },
          { cle: "motif", libelle: "Motif", rendu: (t) => <span className="block truncate text-texte-2">{t.motif ?? "—"}</span> },
        ]}
      />
    </Carte>
  );
}
