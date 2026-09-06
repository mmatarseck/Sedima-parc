"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Gauge, Pencil, Plus, Truck } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Numero } from "@/composants/interface/Numero";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { CHAMPS, champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerLigneCuve, fabriquerPlein } from "@/composants/transactions/fabriques";
import {
  avecStock,
  consolider,
  COULEUR_ETAT_CONSOMMATION,
  COULEUR_ETAT_PLEIN,
  COULEUR_SENS_CUVE,
  estCuve,
  etatPlein,
  LIBELLE_ETAT_CONSOMMATION,
  LIBELLE_ETAT_PLEIN,
  PRECISION_ETAT_CONSOMMATION,
  PRECISION_ETAT_PLEIN,
  PRECISION_SENS_CUVE,
  SENS_CUVE,
  stockBas,
  TON_ETAT_CONSOMMATION,
  TON_SENS_CUVE,
  type ConsommationMensuelleFlotte,
  type ConsommationVehicule,
  type LigneCuve,
  type LignePlein,
} from "@/domaine/carburant";
import { BUSINESS_UNIT } from "@/domaine/libelles";
import type { BusinessUnit } from "@/domaine/types";
import { sortieDePlein } from "@/donnees/carburant-demo";
import { FLOTTE } from "@/donnees/parc-demo";
import { PARAMETRES_DEFAUT, prixCuve, prixEnergie, type Parametres } from "@/domaine/parametres";
import { lireCreations, lireToutesCreations } from "@/lib/clotures-demo";
import { lireParametres } from "@/lib/parametres-demo";
import { date, dateCourte, kilometrage, montant, nombre } from "@/lib/format";

/* ============================================================================
 * Carburant — une entrée du rail, trois vues.
 *
 * **Pleins** : tous les pleins de la flotte, avec leur source et le compteur
 * relevé. **Cuve** : le journal de la cuve interne — livraisons, sorties (qui
 * sont les pleins pris à la cuve, même numéro), relevés de jauge — et le stock
 * recalculé sur chaque ligne. **Consommation** : par véhicule sur la période,
 * litres, kilomètres, L/100 km contre la référence de la catégorie. Pas de
 * bandeau de KPI : le stock et les compteurs sont dans le sous-titre.
 * ==========================================================================*/

export type VueCarburant = "pleins" | "cuve" | "consommation";

type Periode = "30" | "90" | "365" | "tout";
const PERIODES: { cle: Periode; libelle: string }[] = [
  { cle: "30", libelle: "30 j" },
  { cle: "90", libelle: "90 j" },
  { cle: "365", libelle: "12 mois" },
  { cle: "tout", libelle: "Tout" },
];

const FILTRES_PLEINS: FiltreListe<LignePlein>[] = [
  { cle: "tous", libelle: "Tous", retient: () => true },
  { cle: "cuve", libelle: "Cuve interne", retient: (p) => estCuve(p.source) },
  { cle: "station", libelle: "Station", retient: (p) => !estCuve(p.source) },
  { cle: "ecartes", libelle: "Relevé écarté", retient: (p) => p.kmMotifRejet !== null },
];

const FILTRES_CUVE: FiltreListe<LigneCuve>[] = [
  { cle: "tous", libelle: "Tous", retient: () => true },
  { cle: "livraisons", libelle: "Livraisons", retient: (m) => m.sens === "livraison" },
  { cle: "sorties", libelle: "Sorties", retient: (m) => m.sens === "sortie" },
  { cle: "jauges", libelle: "Relevés de jauge", retient: (m) => m.sens === "jauge" },
];

const FILTRES_CONSO: FiltreListe<ConsommationVehicule>[] = [
  { cle: "tous", libelle: "Tous", retient: () => true },
  { cle: "derive", libelle: "En dérive", retient: (c) => c.etat === "derive" || c.etat === "derive-forte" },
  { cle: "conformes", libelle: "Conformes", retient: (c) => c.etat === "conforme" },
];

function decaler(iso: string, jours: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function Segments<T extends string>({ valeur, options, onChange, etiquette }: { valeur: T; options: { cle: T; libelle: string }[]; onChange: (v: T) => void; etiquette: string }) {
  return (
    <div className="sans-barre flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-surface-3 p-1" role="group" aria-label={etiquette}>
      {options.map((o) => (
        <button key={o.cle} type="button" aria-pressed={valeur === o.cle} onClick={() => onChange(o.cle)} className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${valeur === o.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}>
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

const Vehicule = ({ immatriculation, affichee }: { immatriculation: string | null; affichee: string | null }) =>
  immatriculation ? (
    <Link href={`/flotte/${immatriculation}?onglet=carburant`} onClick={(e) => e.stopPropagation()} className="code font-medium text-accent-fonce hover:underline">
      {affichee}
    </Link>
  ) : (
    <span className="text-attenue">—</span>
  );

interface Props {
  pleins: LignePlein[];
  cuve: LigneCuve[];
  stockInitial: number;
  consommations: ConsommationMensuelleFlotte[];
  aujourdhui: string;
  vueInitiale: VueCarburant;
  cible?: string;
}

export function EcranCarburant(props: Props) {
  return (
    <FournisseurEdition sujet="carburant" href="/carburant">
      <Interieur {...props} />
    </FournisseurEdition>
  );
}

function Interieur({ pleins, cuve, stockInitial, consommations, aujourdhui, vueInitiale, cible }: Props) {
  const { demander, creer, surcharger, version } = useEdition();
  const [vue, setVue] = useState<VueCarburant>(vueInitiale);
  const [periode, setPeriode] = useState<Periode>("365");
  const [bu, setBu] = useState<BusinessUnit | "toutes">("toutes");
  const [monte, setMonte] = useState(false);
  /* Les prix et la contenance viennent des paramètres (Énergie et carburant),
     lus après le montage : le serveur rend avec les défauts, le navigateur
     applique ce que le métier a réglé. */
  const [params, setParams] = useState<Parametres>(PARAMETRES_DEFAUT);
  useEffect(() => {
    setMonte(true);
    setParams(lireParametres());
  }, []);
  const capacite = params.energie.capaciteCuve;
  /* Les colonnes sont stables ; la contenance, elle, peut changer : une référence
     mutable la tend à la cellule du stock sans recréer les colonnes. */
  const capaciteRef = useMemo(() => ({ courante: PARAMETRES_DEFAUT.energie.capaciteCuve }), []);
  capaciteRef.courante = capacite;

  /* ---- Ce qui a été créé dans l'application ---- */
  const pleinsCrees = useMemo<LignePlein[]>(
    () =>
      monte
        ? lireToutesCreations("plein")
            .map((c) => {
              const l = FLOTTE.find((x) => `vehicule:${x.vehicule.id}` === c.sujet);
              if (!l) return null;
              return { ...fabriquerPlein(c), vehiculeId: l.vehicule.id, immatriculation: l.vehicule.immatriculation, immatriculationAffichee: l.vehicule.immatriculationAffichee, vehicule: `${l.vehicule.marque} ${l.vehicule.appellation}`, businessUnit: l.vehicule.businessUnit, site: l.site?.libelle ?? null, creee: true };
            })
            .filter((p): p is LignePlein => p !== null)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, monte],
  );
  const cuveCreee = useMemo(() => (monte ? lireCreations("carburant").filter((c) => c.type === "cuve").map(fabriquerLigneCuve) : []), [version, monte]); // eslint-disable-line react-hooks/exhaustive-deps

  const tousPleins = useMemo(() => {
    const fusion = [...pleinsCrees, ...pleins.filter((p) => !pleinsCrees.some((c) => c.numero === p.numero))].map((p) => surcharger(p));
    fusion.sort((a, b) => b.date.localeCompare(a.date));
    if (cible) fusion.sort((a, b) => (a.numero === cible ? -1 : b.numero === cible ? 1 : 0));
    return fusion;
  }, [pleinsCrees, pleins, surcharger, cible]);

  /* Le journal de la cuve : livraisons et jauges (fiches + créées), et les sorties
     reconstruites depuis les pleins tels qu'ils sont — un plein modifié déplace
     le stock de toutes les lignes qui le suivent. */
  const journalCuve = useMemo(() => {
    const propres = [...cuveCreee, ...cuve.filter((m) => !cuveCreee.some((c) => c.numero === m.numero))].map((m) => surcharger(m));
    const sorties = tousPleins.filter((p) => estCuve(p.source)).map(sortieDePlein);
    const journal = avecStock([...propres, ...sorties], stockInitial);
    if (cible) journal.sort((a, b) => (a.numero === cible ? -1 : b.numero === cible ? 1 : 0));
    return journal;
  }, [cuveCreee, cuve, tousPleins, surcharger, stockInitial, cible]);

  /* ---- Fenêtre commune ---- */
  const depuis = useMemo(() => (periode === "tout" ? "" : decaler(aujourdhui, -Number(periode))), [periode, aujourdhui]);
  const bus = useMemo(() => (Object.keys(BUSINESS_UNIT) as BusinessUnit[]).filter((b) => tousPleins.some((p) => p.businessUnit === b)), [tousPleins]);

  const pleinsVisibles = useMemo(() => tousPleins.filter((p) => (bu === "toutes" || p.businessUnit === bu) && (!depuis || p.date >= depuis || p.numero === cible)), [tousPleins, bu, depuis, cible]);
  /* Une livraison ou une jauge n'appartient à aucune BU : filtrer par BU ferait mentir le stock, elle reste visible. */
  const cuveVisible = useMemo(() => journalCuve.filter((m) => (bu === "toutes" || m.businessUnit === bu || m.sens !== "sortie") && (!depuis || m.date >= depuis || m.numero === cible)), [journalCuve, bu, depuis, cible]);
  const consoVisible = useMemo(() => {
    const moisDepuis = depuis ? depuis.slice(0, 7) : "";
    const lignes = consolider(consommations.filter((c) => (bu === "toutes" || c.businessUnit === bu) && (!moisDepuis || c.mois >= moisDepuis)));
    lignes.sort((a, b) => (b.ecartPct ?? -Infinity) - (a.ecartPct ?? -Infinity));
    return lignes;
  }, [consommations, bu, depuis]);

  const litresPleins = pleinsVisibles.reduce((s, p) => s + p.litres, 0);
  const montantPleins = pleinsVisibles.reduce((s, p) => s + p.montant, 0);
  const ecartes = pleinsVisibles.filter((p) => p.kmMotifRejet).length;
  const stock = journalCuve[0]?.stockApres ?? stockInitial;
  const derniereJauge = journalCuve.find((m) => m.sens === "jauge") ?? null;
  const derniereLivraison = journalCuve.find((m) => m.sens === "livraison") ?? null;
  const derives = consoVisible.filter((c) => c.etat === "derive" || c.etat === "derive-forte").length;
  const totalLitres = consoVisible.reduce((s, c) => s + c.litres, 0);
  const totalKm = consoVisible.reduce((s, c) => s + c.kmParcourus, 0);
  const l100Flotte = totalKm > 0 ? Math.round((totalLitres / totalKm) * 1000) / 10 : null;

  /* ---- Gestes ---- */
  function saisirPlein() {
    creer({
      type: "plein",
      titre: "Saisir un plein",
      champs: champsCreation("plein", { pour: "carburant" }),
      /* Le véhicule n'est pas encore choisi : le prix proposé est celui du gasoil,
         l'énergie de presque toute la flotte ; depuis une fiche, c'est celui du véhicule. */
      valeurs: { date: aujourdhui, source: "Cuve interne SEDIMA", prixLitre: prixEnergie("gasoil", aujourdhui, params) },
      /* Le plein est rangé sur le véhicule choisi : la fiche le voit, la cuve aussi. */
      sujetDe: (v) => `vehicule:${String(v.vehiculeId ?? "")}`,
    });
  }
  function livraison() {
    creer({ type: "cuve", titre: "Livraison de la cuve", champs: champsCreation("cuve", { pour: "carburant", sensCuve: "livraison" }), valeurs: { date: aujourdhui, libelle: "Livraison citerne", prixLitre: prixCuve(aujourdhui, params), fournisseur: "TotalEnergies Sénégal" } });
  }
  function jauge() {
    creer({ type: "cuve", titre: "Relevé de jauge", champs: champsCreation("cuve", { pour: "carburant", sensCuve: "jauge" }), valeurs: { date: aujourdhui, litres: stock } });
  }
  function modifierPlein(p: { numero: string; immatriculationAffichee: string | null; source: string }) {
    const plein = tousPleins.find((x) => x.numero === p.numero);
    if (!plein) return;
    demander({ type: "plein", numero: plein.numero, titre: `Plein ${plein.numero} · ${plein.immatriculationAffichee}`, valeurs: plein as unknown as Record<string, unknown>, champs: CHAMPS.plein });
  }
  function modifierCuve(m: LigneCuve) {
    if (m.sens === "sortie") {
      modifierPlein({ numero: m.pleinNumero ?? m.numero, immatriculationAffichee: m.immatriculationAffichee, source: "" });
      return;
    }
    demander({ type: "cuve", numero: m.numero, titre: `${SENS_CUVE[m.sens]} ${m.numero}`, valeurs: m as unknown as Record<string, unknown>, champs: m.sens === "jauge" ? CHAMPS.cuve.filter((c) => ["date", "litres", "commentaire"].includes(c.cle)) : CHAMPS.cuve });
  }

  /* ---- Colonnes ---- */
  const colonnesPleins = useMemo<ColonneListe<LignePlein>[]>(
    () => [
      { cle: "source", libelle: "Source", parDefaut: true, largeur: 170, rendu: (p) => <Pastille ton={estCuve(p.source) ? "favorable" : "neutre"}>{p.source}</Pastille>, texte: (p) => p.source },
      { cle: "bon", libelle: "Bon de sortie", parDefaut: true, largeur: 150, rendu: (p) => <span className="code text-[12px]">{p.reference || "—"}</span> },
      { cle: "litres", libelle: "Litres", parDefaut: true, largeur: 100, alignee: "droite", tri: (p) => p.litres, rendu: (p) => <span className="code font-medium">{nombre(p.litres, 1)}</span> },
      { cle: "prix", libelle: "Prix / L", parDefaut: true, largeur: 100, alignee: "droite", tri: (p) => p.prixLitre, rendu: (p) => <span className="code">{montant(p.prixLitre)}</span> },
      { cle: "montant", libelle: "Montant", parDefaut: true, largeur: 120, alignee: "droite", tri: (p) => p.montant, rendu: (p) => <span className="code font-medium">{montant(p.montant)}</span> },
      { cle: "km", libelle: "Km relevé", parDefaut: true, largeur: 130, alignee: "droite", tri: (p) => p.km, rendu: (p) => (p.kmMotifRejet ? <span className="code text-vigilance line-through" title={p.kmMotifRejet}>{kilometrage(p.km)}</span> : <span className="code">{kilometrage(p.km)}</span>) },
      { cle: "vehiculeLib", libelle: "Modèle", parDefaut: false, largeur: 200, rendu: (p) => <span className="block truncate">{p.vehicule}</span> },
      { cle: "site", libelle: "Site", parDefaut: false, largeur: 150, rendu: (p) => p.site ?? "—" },
      { cle: "bu", libelle: "BU", parDefaut: false, largeur: 140, rendu: (p) => (p.businessUnit ? BUSINESS_UNIT[p.businessUnit] : "—") },
      {
        cle: "action",
        libelle: "Action",
        parDefaut: true,
        largeur: 100,
        texte: () => "Modifier",
        rendu: (p) => (
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); modifierPlein(p); }} className="bouton-discret h-7 px-2 text-[12px]">
            <Pencil className="size-3.5" strokeWidth={1.8} />
            Modifier
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const colonnesCuve = useMemo<ColonneListe<LigneCuve>[]>(
    () => [
      { cle: "sens", libelle: "Mouvement", parDefaut: true, largeur: 140, texte: (m) => SENS_CUVE[m.sens], rendu: (m) => <Pastille ton={TON_SENS_CUVE[m.sens]}>{SENS_CUVE[m.sens]}</Pastille> },
      { cle: "libelle", libelle: "Libellé", parDefaut: true, largeur: 240, rendu: (m) => <span className="block truncate">{m.libelle}</span> },
      { cle: "vehicule", libelle: "Véhicule", parDefaut: true, largeur: 115, texte: (m) => m.immatriculationAffichee ?? "", rendu: (m) => <Vehicule immatriculation={m.immatriculation} affichee={m.immatriculationAffichee} /> },
      { cle: "entree", libelle: "Entrée (L)", parDefaut: true, largeur: 105, alignee: "droite", tri: (m) => (m.sens === "livraison" ? m.litres : null), rendu: (m) => (m.sens === "livraison" ? <span className="code font-medium text-favorable">{nombre(m.litres)}</span> : <span className="text-attenue">—</span>) },
      { cle: "sortie", libelle: "Sortie (L)", parDefaut: true, largeur: 105, alignee: "droite", tri: (m) => (m.sens === "sortie" ? m.litres : null), rendu: (m) => (m.sens === "sortie" ? <span className="code font-medium">{nombre(m.litres, 1)}</span> : <span className="text-attenue">—</span>) },
      { cle: "ecart", libelle: "Écart jauge", parDefaut: true, largeur: 110, alignee: "droite", tri: (m) => m.ecart, rendu: (m) => (m.ecart === null ? <span className="text-attenue">—</span> : <Echeance ton={Math.abs(m.ecart) > 150 ? "defavorable" : Math.abs(m.ecart) > 50 ? "vigilance" : "favorable"}>{m.ecart > 0 ? "+" : ""}{nombre(m.ecart)} L</Echeance>) },
      { cle: "stock", libelle: "Stock (L)", parDefaut: true, largeur: 110, alignee: "droite", tri: (m) => m.stockApres, rendu: (m) => <span className={`code ${stockBas(m.stockApres, capaciteRef.courante) ? "font-semibold text-defavorable" : "text-texte-2"}`}>{nombre(m.stockApres)}</span> },
      { cle: "piece", libelle: "Pièce", parDefaut: false, largeur: 150, rendu: (m) => (m.piece ? <span className="code text-[12px]">{m.piece}</span> : <span className="text-attenue">—</span>) },
      { cle: "prix", libelle: "Prix / L", parDefaut: false, largeur: 100, alignee: "droite", tri: (m) => m.prixLitre, rendu: (m) => <span className="code">{montant(m.prixLitre)}</span> },
      { cle: "montant", libelle: "Montant", parDefaut: false, largeur: 130, alignee: "droite", tri: (m) => m.montant, rendu: (m) => <span className="code">{montant(m.montant)}</span> },
      { cle: "fournisseur", libelle: "Fournisseur", parDefaut: false, largeur: 190, rendu: (m) => m.fournisseur ?? <span className="text-attenue">—</span> },
      { cle: "enregistre", libelle: "Enregistré par", parDefaut: false, largeur: 170, rendu: (m) => m.enregistrePar },
      {
        cle: "action",
        libelle: "Action",
        parDefaut: true,
        largeur: 100,
        texte: () => "Modifier",
        rendu: (m) => (
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); modifierCuve(m); }} className="bouton-discret h-7 px-2 text-[12px]">
            <Pencil className="size-3.5" strokeWidth={1.8} />
            Modifier
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const colonnesConso = useMemo<ColonneListe<ConsommationVehicule>[]>(
    () => [
      { cle: "etat", libelle: "Écart", parDefaut: true, largeur: 130, texte: (c) => LIBELLE_ETAT_CONSOMMATION[c.etat], rendu: (c) => <Echeance ton={TON_ETAT_CONSOMMATION[c.etat]}>{c.ecartPct === null ? "—" : `${c.ecartPct > 0 ? "+" : ""}${nombre(c.ecartPct, 1)} %`}</Echeance> },
      { cle: "l100", libelle: "L/100 km", parDefaut: true, largeur: 110, alignee: "droite", tri: (c) => c.litresAux100, rendu: (c) => <span className="code font-medium">{c.litresAux100 === null ? "—" : nombre(c.litresAux100, 1)}</span> },
      { cle: "ref", libelle: "Référence", parDefaut: true, largeur: 105, alignee: "droite", tri: (c) => c.referenceL100, rendu: (c) => <span className="code text-texte-2">{nombre(c.referenceL100, 1)}</span> },
      { cle: "litres", libelle: "Litres", parDefaut: true, largeur: 110, alignee: "droite", tri: (c) => c.litres, rendu: (c) => <span className="code">{nombre(c.litres)}</span> },
      { cle: "km", libelle: "Km parcourus", parDefaut: true, largeur: 130, alignee: "droite", tri: (c) => c.kmParcourus, rendu: (c) => <span className="code">{kilometrage(c.kmParcourus)}</span> },
      { cle: "cout", libelle: "Coût", parDefaut: true, largeur: 125, alignee: "droite", tri: (c) => c.cout, rendu: (c) => <span className="code">{montant(c.cout)}</span> },
      { cle: "mois", libelle: "Mois", parDefaut: false, largeur: 80, alignee: "droite", tri: (c) => c.mois, rendu: (c) => <span className="code">{c.mois}</span> },
      { cle: "categorie", libelle: "Catégorie", parDefaut: true, largeur: 130, rendu: (c) => c.categorie },
      { cle: "vehiculeLib", libelle: "Modèle", parDefaut: false, largeur: 200, rendu: (c) => <span className="block truncate">{c.vehicule}</span> },
      { cle: "site", libelle: "Site", parDefaut: false, largeur: 150, rendu: (c) => c.site ?? "—" },
      { cle: "bu", libelle: "BU", parDefaut: false, largeur: 140, rendu: (c) => (c.businessUnit ? BUSINESS_UNIT[c.businessUnit] : "—") },
    ],
    [],
  );

  const sousTitre =
    vue === "pleins"
      ? `${pleinsVisibles.length} plein${pleinsVisibles.length > 1 ? "s" : ""} · ${nombre(litresPleins)} L · ${montant(montantPleins)} · ${ecartes} relevé${ecartes > 1 ? "s" : ""} écarté${ecartes > 1 ? "s" : ""} · au ${date(aujourdhui)}`
      : vue === "cuve"
        ? `Stock ${nombre(stock)} L sur ${nombre(capacite)}${stockBas(stock, capacite) ? " · à réapprovisionner" : ""}${derniereLivraison ? ` · dernière livraison le ${date(derniereLivraison.date)}` : ""}${derniereJauge && derniereJauge.ecart !== null ? ` · dernière jauge ${derniereJauge.ecart > 0 ? "+" : ""}${nombre(derniereJauge.ecart)} L` : ""}`
        : `${consoVisible.length} véhicule${consoVisible.length > 1 ? "s" : ""} · flotte ${l100Flotte === null ? "—" : `${nombre(l100Flotte, 1)} L/100 km`} · ${derives} en dérive · au ${date(aujourdhui)}`;

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Carburant"
        sousTitre={sousTitre}
        actions={
          <>
            <Segments
              valeur={vue}
              options={[
                { cle: "pleins" as VueCarburant, libelle: "Pleins" },
                { cle: "cuve" as VueCarburant, libelle: "Cuve interne" },
                { cle: "consommation" as VueCarburant, libelle: "Consommation" },
              ]}
              onChange={setVue}
              etiquette="Vue"
            />
            <Segments valeur={periode} options={PERIODES} onChange={setPeriode} etiquette="Période" />
            <Segments
              valeur={bu}
              options={[{ cle: "toutes" as BusinessUnit | "toutes", libelle: "Toutes BU" }, ...bus.map((b) => ({ cle: b as BusinessUnit | "toutes", libelle: BUSINESS_UNIT[b] }))]}
              onChange={setBu}
              etiquette="Business unit"
            />
            {vue === "cuve" ? (
              <>
                <button type="button" onClick={jauge} className="bouton-secondaire">
                  <Gauge className="size-4 text-texte-2" strokeWidth={1.8} />
                  Relevé de jauge
                </button>
                <button type="button" onClick={livraison} className="bouton-principal">
                  <Truck className="size-4" strokeWidth={2} />
                  Livraison
                </button>
              </>
            ) : vue === "pleins" ? (
              <button type="button" onClick={saisirPlein} className="bouton-principal">
                <Plus className="size-4" strokeWidth={2.2} />
                Saisir un plein
              </button>
            ) : null}
          </>
        }
      />

      {vue === "pleins" ? (
        <TableListe<LignePlein>
          ecran="pleins"
          lignes={pleinsVisibles}
          cle={(p) => p.numero}
          href={(p) => `/flotte/${p.immatriculation}?onglet=carburant&ref=${p.numero}`}
          filet={(p) => { const e = etatPlein(p); return { couleur: COULEUR_ETAT_PLEIN[e], libelle: LIBELLE_ETAT_PLEIN[e], precision: PRECISION_ETAT_PLEIN[e] }; }}
          identifiant={{ cle: "numero", libelle: "Réf.", largeur: 140, rendu: (p) => <Numero valeur={p.numero} /> }}
          fixes={FIXES_PLEINS}
          colonnes={colonnesPleins}
          filtres={FILTRES_PLEINS}
          champsRecherche={(p) => [p.numero, p.immatriculationAffichee, p.vehicule, p.source, p.reference, p.site ?? ""]}
          placeholderRecherche="Référence, immatriculation, bon de sortie, source…"
          libelleRecherche="Rechercher un plein"
          libelleUnite="pleins"
          vide="Aucun plein ne correspond."
          surLigne={modifierPlein}
        />
      ) : vue === "cuve" ? (
        <TableListe<LigneCuve>
          ecran="cuve"
          lignes={cuveVisible}
          cle={(m) => m.numero}
          href={(m) => (m.immatriculation ? `/flotte/${m.immatriculation}?onglet=carburant&ref=${m.numero}` : `/carburant?vue=cuve&ref=${m.numero}`)}
          filet={(m) => ({ couleur: COULEUR_SENS_CUVE[m.sens], libelle: SENS_CUVE[m.sens], precision: PRECISION_SENS_CUVE[m.sens] })}
          identifiant={{ cle: "numero", libelle: "Réf.", largeur: 140, rendu: (m) => <Numero valeur={m.numero} /> }}
          fixes={FIXES_CUVE}
          colonnes={colonnesCuve}
          filtres={FILTRES_CUVE}
          champsRecherche={(m) => [m.numero, m.libelle, m.immatriculationAffichee ?? "", m.piece ?? "", m.fournisseur ?? "", SENS_CUVE[m.sens]]}
          placeholderRecherche="Référence, libellé, immatriculation, bordereau…"
          libelleRecherche="Rechercher un mouvement de cuve"
          libelleUnite="mouvements"
          vide="Aucun mouvement ne correspond."
          surLigne={modifierCuve}
        />
      ) : (
        <TableListe<ConsommationVehicule>
          ecran="consommation"
          lignes={consoVisible}
          cle={(c) => c.vehiculeId}
          href={(c) => `/flotte/${c.immatriculation}?onglet=carburant`}
          filet={(c) => ({ couleur: COULEUR_ETAT_CONSOMMATION[c.etat], libelle: LIBELLE_ETAT_CONSOMMATION[c.etat], precision: PRECISION_ETAT_CONSOMMATION[c.etat] })}
          identifiant={{ cle: "immat", libelle: "Véhicule", largeur: 130, rendu: (c) => <span className="code">{c.immatriculationAffichee}</span> }}
          colonnes={colonnesConso}
          filtres={FILTRES_CONSO}
          champsRecherche={(c) => [c.immatriculationAffichee, c.vehicule, c.categorie, c.site ?? "", LIBELLE_ETAT_CONSOMMATION[c.etat]]}
          placeholderRecherche="Immatriculation, modèle, catégorie, site…"
          libelleRecherche="Rechercher un véhicule"
          libelleUnite="véhicules"
          vide="Aucune consommation sur cette sélection."
        />
      )}
    </div>
  );
}

/* Constantes de module : mêmes colonnes d'un rendu à l'autre, sinon l'effet qui
   lit les préférences repart en boucle. */
const FIXES_PLEINS: ColonneListe<LignePlein>[] = [
  { cle: "date", libelle: "Date", parDefaut: true, largeur: 100, tri: (p) => p.date, rendu: (p) => <span className="code">{dateCourte(p.date)}</span> },
  { cle: "immat", libelle: "Véhicule", parDefaut: true, largeur: 120, rendu: (p) => <Vehicule immatriculation={p.immatriculation} affichee={p.immatriculationAffichee} /> },
];

const FIXES_CUVE: ColonneListe<LigneCuve>[] = [
  { cle: "date", libelle: "Date", parDefaut: true, largeur: 100, tri: (m) => m.date, rendu: (m) => <span className="code">{dateCourte(m.date)}</span> },
];

