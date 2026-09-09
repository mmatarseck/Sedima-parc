"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CircleDot, ClipboardCheck, Pencil, Plus, Scale, ShoppingCart } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { BandeauKpi, type Kpi } from "@/composants/interface/BandeauKpi";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Numero } from "@/composants/interface/Numero";
import { Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { CHAMPS, champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import type { AccesCourant } from "@/domaine/acces";
import type { ChampEdition } from "@/domaine/cloture";
import { afficher } from "@/domaine/immatriculation";
import { COULEUR_TON } from "@/domaine/libelles";
import {
  CATEGORIE_PIECE,
  ETAT_PNEU,
  ETAT_STOCK,
  NATURE_MOUVEMENT,
  UNITE_PIECE,
  commandesAPreparer,
  detailCommande,
  fabriquerMouvement,
  fabriquerPiece,
  fabriquerPneu,
  kmParcourus,
  objetCommande,
  rapprocherInventaire,
  stockDe,
  variation,
  type CommandeAPreparer,
  type LigneInventaire,
  type MouvementStock,
  type NatureMouvement,
  type Piece,
  type Pneu,
  type StockPiece,
} from "@/domaine/pieces";
import type { SourcePieces } from "@/donnees/pieces";
import { lireAccesCourant } from "@/lib/acces-courant";
import { date as formaterDate, dateCourte, montant, montantCourt, nombre } from "@/lib/format";
import { enregistrerCreation, lireCreations } from "@/lib/clotures-demo";

/* ============================================================================
 * Suivi › Pièces de rechange — le magasin de l'atelier central.
 *
 * Trois vues sur la même source : le **stock** (une ligne par référence, la
 * quantité déduite des mouvements, l'état qui en découle), les **mouvements**
 * (le journal, du plus récent au plus ancien) et les **pneus** (suivis un par
 * un). Le stock ne se saisit jamais : on entre, on sort, on retourne, on
 * régularise — et la quantité s'ensuit. Décisions du 9 septembre 2026.
 * ==========================================================================*/

export type VuePieces = "stock" | "mouvements" | "pneus" | "inventaire";

interface Props {
  source: SourcePieces;
  vueInitiale?: string;
  cible?: string;
}

export function EcranPieces({ source, vueInitiale, cible }: Props) {
  return (
    <FournisseurEdition sujet="pieces" href="/pieces">
      <Interieur source={source} vueInitiale={vueInitiale} cible={cible} />
    </FournisseurEdition>
  );
}

/** L'immatriculation affichée d'un véhicule choisi dans le formulaire : l'identifiant **est** la plaque canonique. */
const immatDe = (vehiculeId: string | null) => (vehiculeId ? afficher(vehiculeId) : null);

/**
 * Tout ce que l'écran sait des pièces : la source du serveur, et ce qui a été
 * créé dans le navigateur — depuis la liste comme depuis une fiche, tout se
 * range sous le même sujet « pieces », pour que le stock déduit reste juste.
 */
export function usePieces(source: SourcePieces) {
  const { surcharger, version } = useEdition();
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);
  return useMemo(() => {
    const crees = monte ? lireCreations("pieces") : [];
    const pieces = [...crees.filter((c) => c.type === "piece").map(fabriquerPiece), ...source.pieces].map((p) => surcharger(p));
    const mouvements = [...crees.filter((c) => c.type === "mouvement").map((c) => fabriquerMouvement(c, immatDe)), ...source.mouvements].map((m) => surcharger(m));
    const pneus = [...crees.filter((c) => c.type === "pneu").map((c) => fabriquerPneu(c, immatDe)), ...source.pneus].map((p) => surcharger(p));
    return { pieces, mouvements, pneus, stock: stockDe(pieces, mouvements, source.aujourdhui) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, version, monte]);
}

/** Les champs d'un mouvement selon sa nature : on ne montre pas le bon de commande sur une sortie. */
export function champsMouvement(nature: NatureMouvement, pieces: Piece[]): ChampEdition[] {
  const propres: Record<NatureMouvement, string[]> = {
    entree: ["date", "pieceNumero", "quantite", "prixUnitaire", "demandeNumero", "fournisseur", "motif"],
    sortie: ["date", "pieceNumero", "quantite", "ordreNumero", "interventionNumero", "vehiculeId", "motif"],
    retour: ["date", "pieceNumero", "quantite", "motif"],
    regularisation: ["date", "pieceNumero", "ecart", "motif"],
  };
  const options = pieces.filter((p) => p.actif).map((p) => ({ valeur: p.numero, libelle: `${p.reference} · ${p.designation}` }));
  return CHAMPS.mouvement.filter((c) => propres[nature].includes(c.cle)).map((c) => {
    if (c.cle === "pieceNumero") return { ...c, type: "choix" as const, options };
    if (c.cle === "ecart" && nature === "regularisation") return { ...c, obligatoire: true };
    if (c.cle === "motif" && nature === "regularisation") return { ...c, libelle: "Motif de l'écart", obligatoire: true };
    return c;
  });
}

export function champsPneu(pieces: Piece[]): ChampEdition[] {
  const options = pieces.filter((p) => p.actif && p.categorie === "pneumatique").map((p) => ({ valeur: p.numero, libelle: `${p.reference} · ${p.designation}` }));
  return CHAMPS.pneu.map((c) => (c.cle === "pieceNumero" && options.length > 0 ? { ...c, type: "choix" as const, options } : c));
}

const FILTRES_STOCK: FiltreListe<StockPiece>[] = [
  { cle: "actives", libelle: "Actives", retient: (s) => s.piece.actif },
  { cle: "a-commander", libelle: "À réapprovisionner", retient: (s) => s.piece.actif && (s.etat === "sous-le-seuil" || s.etat === "epuisee") },
  { cle: "epuisees", libelle: "Épuisées", retient: (s) => s.piece.actif && s.etat === "epuisee" },
  { cle: "dormantes", libelle: "Dormantes", retient: (s) => s.piece.actif && s.etat === "dormante" },
  { cle: "pneumatiques", libelle: "Pneumatiques", retient: (s) => s.piece.categorie === "pneumatique" },
  { cle: "inactives", libelle: "Inactives", retient: (s) => !s.piece.actif },
  { cle: "toutes", libelle: "Toutes", retient: () => true },
];

const FILTRES_MOUVEMENTS: FiltreListe<MouvementStock>[] = [
  { cle: "tous", libelle: "Tous", retient: () => true },
  { cle: "entrees", libelle: "Entrées", retient: (m) => m.nature === "entree" },
  { cle: "sorties", libelle: "Sorties", retient: (m) => m.nature === "sortie" },
  { cle: "retours", libelle: "Retours", retient: (m) => m.nature === "retour" },
  { cle: "regularisations", libelle: "Régularisations", retient: (m) => m.nature === "regularisation" },
];

const FILTRES_PNEUS: FiltreListe<Pneu>[] = [
  { cle: "en-service", libelle: "En service", retient: (p) => p.etat === "monte" || p.etat === "en-stock" || p.etat === "depose" },
  { cle: "montes", libelle: "Montés", retient: (p) => p.etat === "monte" },
  { cle: "en-stock", libelle: "En stock", retient: (p) => p.etat === "en-stock" },
  { cle: "deposes", libelle: "Déposés", retient: (p) => p.etat === "depose" },
  { cle: "rebutes", libelle: "Rebutés", retient: (p) => p.etat === "rebute" },
  { cle: "tous", libelle: "Tous", retient: () => true },
];

function Segments<T extends string>({ valeur, options, onChange, etiquette }: { valeur: T; options: { cle: T; libelle: string }[]; onChange: (v: T) => void; etiquette: string }) {
  return (
    <div className="sans-barre flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-surface-3 p-1" role="group" aria-label={etiquette}>
      {options.map((o) => (
        <button
          key={o.cle}
          type="button"
          aria-pressed={valeur === o.cle}
          onClick={() => onChange(o.cle)}
          className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${valeur === o.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

const rien = <span className="text-attenue-2">—</span>;

/** Le rattachement d'un mouvement, en un mot : ce qu'il cite. */
export function rattachement(m: MouvementStock): string {
  if (m.nature === "entree") return m.demandeNumero ?? m.fournisseur ?? "";
  if (m.ordreNumero) return m.ordreNumero;
  if (m.interventionNumero) return m.interventionNumero;
  return m.immatriculationAffichee ?? "";
}

/** Où mène un mouvement : la fiche du véhicule servi, sinon celle de la pièce. */
export function hrefMouvement(m: MouvementStock): string {
  if (m.vehiculeId) return `/flotte/${m.vehiculeId}?onglet=entretien&ref=${m.numero}`;
  return `/pieces/${m.pieceNumero}?onglet=mouvements&ref=${m.numero}`;
}

function Interieur({ source, vueInitiale, cible }: Props) {
  const { demander, creer, actualiser } = useEdition();
  const [vue, setVue] = useState<VuePieces>(vueInitiale === "mouvements" || vueInitiale === "pneus" || vueInitiale === "inventaire" ? vueInitiale : "stock");
  const { pieces, mouvements, pneus, stock } = usePieces(source);
  const pieceParNumero = useMemo(() => new Map(pieces.map((p) => [p.numero, p])), [pieces]);
  /* Régulariser demande le niveau gestion du module : la vue Inventaire se
     montre à tous (compter n'est pas régulariser), l'enregistrement, non. */
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  useEffect(() => setAcces(lireAccesCourant()), []);
  const gere = acces?.niveaux.maintenance === "gestion";
  /* Entrer, sortir, créer une pièce ou un pneu : la saisie. Tant que l'accès
     n'est pas lu (premier rendu), on ne promet rien. */
  const saisit = gere || acces?.niveaux.maintenance === "saisie";

  /* ---- Le réapprovisionnement : une demande d'achat par fournisseur ---- */
  const commandes = useMemo(() => commandesAPreparer(stock), [stock]);
  function preparerCommande(c: CommandeAPreparer) {
    /* La demande d'achat cite d'ordinaire une transaction (observation,
       intervention…) ; ici, c'est la pièce sous le seuil qui la motive : le
       champ garde le numéro PCE, sans passer par l'index des transactions. */
    const champs = champsCreation("achat", { pour: "caisse" }).map((ch) => (ch.cle === "origineNumero" ? { ...ch, type: "texte" as const, libelle: "Pièce qui motive la demande" } : ch));
    creer({
      type: "achat",
      titre: `Demande d'achat — ${c.fournisseur}`,
      champs,
      valeurs: {
        date: source.aujourdhui,
        poste: "pieces",
        urgence: c.lignes.some((l) => l.piece.stockMinimum > 0 && l.quantite >= (l.piece.stockMaximum ?? l.piece.stockMinimum)) ? "urgente" : "normale",
        objet: objetCommande(c),
        montantEstime: c.montantEstime,
        prestataireNumero: c.fournisseurNumero ?? "",
        origineNumero: c.lignes[0]!.piece.numero,
        origineLibelle: `${c.lignes.length} référence${c.lignes.length > 1 ? "s" : ""} sous le seuil`,
        commentaireDecision: detailCommande(c),
      },
      /* La demande vit sur l'écran Caisse & achats, pas sur le magasin. */
      sujetDe: () => "caisse",
    });
  }

  /* ---- L'inventaire : compter, rapprocher, régulariser d'un coup ---- */
  const [comptes, setComptes] = useState<Record<string, string>>({});
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [bilanInventaire, setBilanInventaire] = useState<string | null>(null);
  const inventaire = useMemo(() => rapprocherInventaire(stock, Object.fromEntries(Object.entries(comptes).map(([k, v]) => [k, v.trim() === "" ? null : Number(v.replace(/\s/g, "").replace(",", "."))]))), [stock, comptes]);
  const ecarts = inventaire.filter((l) => l.ecart !== 0);
  const comptees = inventaire.filter((l) => l.compte !== null).length;
  function enregistrerInventaire() {
    if (!gere || ecarts.length === 0) return;
    const champs = champsMouvement("regularisation", pieces);
    const jour = formaterDate(source.aujourdhui);
    let faites = 0;
    let refus: string | null = null;
    for (const l of ecarts) {
      const r = enregistrerCreation({
        sujet: "pieces",
        type: "mouvement",
        champs,
        valeurs: { date: source.aujourdhui, nature: "regularisation", pieceNumero: l.piece.numero, ecart: l.ecart, motif: motifs[l.piece.numero]?.trim() || `Inventaire du ${jour} : ${l.compte} compté${l.compte! > 1 ? "s" : ""}, ${l.deduit} déduit${l.deduit > 1 ? "s" : ""}` },
        motif: `Inventaire du ${jour}`,
      });
      if (r.issue === "creee") faites += 1;
      else refus = r.issue === "mois-clos" ? `le mois ${r.mois} est clos` : "saisie invalide";
    }
    setComptes({});
    setMotifs({});
    actualiser();
    setBilanInventaire(`${faites} régularisation${faites > 1 ? "s" : ""} enregistrée${faites > 1 ? "s" : ""} pour l'inventaire du ${jour}${refus ? ` — ${ecarts.length - faites} refusée${ecarts.length - faites > 1 ? "s" : ""} : ${refus}` : ""}.`);
    setVue("mouvements");
  }
  const colonnesInventaire = useMemo(
    () => [
      { cle: "reference", libelle: "Réf.", largeur: "140px", rendu: (l: LigneInventaire) => <span className="code text-[12.5px]">{l.piece.reference}</span> },
      { cle: "designation", libelle: "Désignation", rendu: (l: LigneInventaire) => <span className="block truncate">{l.piece.designation}</span> },
      { cle: "deduit", libelle: "Déduit", alignee: "droite" as const, largeur: "110px", rendu: (l: LigneInventaire) => <span className="code">{nombre(l.deduit)} {UNITE_PIECE[l.piece.unite].court}</span> },
      {
        cle: "compte",
        libelle: "Compté",
        alignee: "droite" as const,
        largeur: "130px",
        rendu: (l: LigneInventaire) => (
          <input
            type="text"
            inputMode="numeric"
            value={comptes[l.piece.numero] ?? ""}
            onChange={(e) => setComptes((c) => ({ ...c, [l.piece.numero]: e.target.value }))}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Quantité comptée — ${l.piece.reference}`}
            placeholder="—"
            className="code h-8 w-24 rounded-[10px] border border-bordure-champ bg-surface px-2.5 text-right text-[13px] text-texte outline-none focus:border-accent"
          />
        ),
      },
      {
        cle: "ecart",
        libelle: "Écart",
        alignee: "droite" as const,
        largeur: "100px",
        rendu: (l: LigneInventaire) => (l.compte === null ? <span className="text-attenue-2">—</span> : l.ecart === 0 ? <span className="text-favorable">juste</span> : <span className={`code font-semibold ${l.ecart < 0 ? "text-defavorable" : "text-vigilance"}`}>{l.ecart > 0 ? "+" : ""}{nombre(l.ecart)}</span>),
      },
      {
        cle: "motif",
        libelle: "Motif de l'écart",
        largeur: "260px",
        rendu: (l: LigneInventaire) =>
          l.ecart === 0 ? (
            <span className="text-attenue-2">—</span>
          ) : (
            <input
              type="text"
              value={motifs[l.piece.numero] ?? ""}
              onChange={(e) => setMotifs((m) => ({ ...m, [l.piece.numero]: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Motif de l'écart — ${l.piece.reference}`}
              placeholder="Facultatif — casier vide, casse, sortie non tracée…"
              className="h-8 w-full rounded-[10px] border border-bordure-champ bg-surface px-2.5 text-[13px] text-texte outline-none focus:border-accent"
            />
          ),
      },
    ],
    [comptes, motifs],
  );

  /* ---- Les chiffres qui décident ---- */
  const actives = stock.filter((s) => s.piece.actif);
  const aCommander = actives.filter((s) => s.etat === "sous-le-seuil" || s.etat === "epuisee");
  const epuisees = actives.filter((s) => s.etat === "epuisee");
  const valeur = actives.reduce((t, s) => t + (s.valeurIndicative ?? 0), 0);
  const unAn = new Date(`${source.aujourdhui}T00:00:00Z`);
  unAn.setUTCFullYear(unAn.getUTCFullYear() - 1);
  const depuis = unAn.toISOString().slice(0, 10);
  const sortiesAnnee = mouvements.filter((m) => m.nature === "sortie" && m.date >= depuis).length;
  const montes = pneus.filter((p) => p.etat === "monte").length;
  const pneusEnStock = pneus.filter((p) => p.etat === "en-stock").length;
  const kpis: Kpi[] = [
    { label: "Références actives", valeur: nombre(actives.length), precision: `${nombre(pieces.length - actives.length)} inactive${pieces.length - actives.length > 1 ? "s" : ""}` },
    { label: "Valeur indicative", valeur: montantCourt(valeur), precision: "au dernier prix d'entrée" },
    { label: "À réapprovisionner", valeur: nombre(aCommander.length), precision: `${nombre(epuisees.length)} épuisée${epuisees.length > 1 ? "s" : ""}`, ton: epuisees.length > 0 ? "defavorable" : aCommander.length > 0 ? "vigilance" : "favorable" },
    { label: "Sorties 12 mois", valeur: nombre(sortiesAnnee), precision: "lignes de sortie" },
    { label: "Pneus montés", valeur: nombre(montes), precision: `${nombre(pneusEnStock)} en stock` },
  ];

  /* ---- Créations ---- */
  function nouvellePiece() {
    creer({ type: "piece", titre: "Nouvelle pièce", champs: CHAMPS.piece, valeurs: { categorie: "filtration", unite: "piece", stockMinimum: 1 } });
  }
  function nouveauMouvement(nature: NatureMouvement) {
    creer({
      type: "mouvement",
      titre: `${NATURE_MOUVEMENT[nature].libelle} de stock`,
      champs: champsMouvement(nature, pieces),
      valeurs: { date: source.aujourdhui, nature },
    });
  }
  function nouveauPneu() {
    creer({ type: "pneu", titre: "Nouveau pneu", champs: champsPneu(pieces), valeurs: { etat: "en-stock", rechapages: 0 } });
  }
  function modifierPiece(p: Piece) {
    demander({ type: "piece", numero: p.numero, titre: `Pièce ${p.reference} · ${p.designation}`, valeurs: { ...p, compatibilites: p.compatibilites.join("; ") } as unknown as Record<string, unknown>, champs: CHAMPS.piece });
  }
  function modifierPneu(p: Pneu) {
    demander({ type: "pneu", numero: p.numero, titre: `Pneu ${p.numero} · ${p.dimension}`, valeurs: p as unknown as Record<string, unknown>, champs: champsPneu(pieces) });
  }

  /* ---- Vue Stock ---- */
  const lignesStock = useMemo(() => {
    const l = [...stock].sort((a, b) => ETAT_STOCK[a.etat].rang - ETAT_STOCK[b.etat].rang || a.piece.reference.localeCompare(b.piece.reference, "fr"));
    if (cible) l.sort((a, b) => (a.piece.numero === cible ? -1 : b.piece.numero === cible ? 1 : 0));
    return l;
  }, [stock, cible]);
  const quantite = (s: StockPiece) => `${nombre(s.quantite)} ${UNITE_PIECE[s.piece.unite].court}`;
  const colonnesStock = useMemo<ColonneListe<StockPiece>[]>(
    () => [
      { cle: "categorie", libelle: "Catégorie", parDefaut: true, largeur: 135, texte: (s) => CATEGORIE_PIECE[s.piece.categorie], rendu: (s) => <span className="text-texte-2">{CATEGORIE_PIECE[s.piece.categorie]}</span> },
      { cle: "quantite", libelle: "En stock", parDefaut: true, largeur: 115, alignee: "droite", tri: (s) => s.quantite, rendu: (s) => <span className={`code ${s.quantite <= 0 ? "text-defavorable" : ""}`}>{quantite(s)}</span> },
      { cle: "minimum", libelle: "Minimum", parDefaut: true, largeur: 105, alignee: "droite", tri: (s) => s.piece.stockMinimum, rendu: (s) => <span className="code text-texte-2">{nombre(s.piece.stockMinimum)}</span> },
      { cle: "etat", libelle: "État", parDefaut: true, largeur: 135, texte: (s) => ETAT_STOCK[s.etat].libelle, tri: (s) => ETAT_STOCK[s.etat].rang, rendu: (s) => <Pastille ton={ETAT_STOCK[s.etat].ton}>{ETAT_STOCK[s.etat].libelle}</Pastille> },
      { cle: "aCommander", libelle: "À commander", parDefaut: true, largeur: 125, alignee: "droite", tri: (s) => s.aCommander, rendu: (s) => (s.aCommander > 0 ? <span className="code text-vigilance">{nombre(s.aCommander)}</span> : rien) },
      { cle: "prix", libelle: "Dernier prix", parDefaut: true, largeur: 125, alignee: "droite", tri: (s) => s.dernierPrix, rendu: (s) => (s.dernierPrix === null ? rien : <span className="code">{montant(s.dernierPrix)}</span>) },
      { cle: "valeur", libelle: "Valeur indicative", parDefaut: true, largeur: 150, alignee: "droite", tri: (s) => s.valeurIndicative, rendu: (s) => (s.valeurIndicative === null || s.valeurIndicative === 0 ? rien : <span className="code">{montant(s.valeurIndicative)}</span>) },
      { cle: "sorties", libelle: "Sorties 12 mois", parDefaut: true, largeur: 140, alignee: "droite", tri: (s) => s.sortiesDouzeMois, rendu: (s) => (s.sortiesDouzeMois > 0 ? <span className="code">{nombre(s.sortiesDouzeMois)}</span> : rien) },
      { cle: "dernier", libelle: "Dernier mouvement", parDefaut: true, largeur: 160, tri: (s) => s.dernierMouvement, rendu: (s) => (s.dernierMouvement ? <span className="code">{dateCourte(s.dernierMouvement)}</span> : rien) },
      { cle: "fournisseur", libelle: "Fournisseur", parDefaut: false, largeur: 190, rendu: (s) => <span className="block truncate">{s.piece.fournisseur ?? rien}</span> },
      { cle: "maximum", libelle: "Maximum", parDefaut: false, largeur: 105, alignee: "droite", tri: (s) => s.piece.stockMaximum, rendu: (s) => (s.piece.stockMaximum === null ? rien : <span className="code text-texte-2">{nombre(s.piece.stockMaximum)}</span>) },
      { cle: "prixReference", libelle: "Prix de référence", parDefaut: false, largeur: 150, alignee: "droite", tri: (s) => s.piece.prixReference, rendu: (s) => (s.piece.prixReference === null ? rien : <span className="code">{montant(s.piece.prixReference)}</span>) },
      { cle: "constructeur", libelle: "Réf. constructeur", parDefaut: false, largeur: 160, rendu: (s) => <span className="code text-[12.5px]">{s.piece.referenceConstructeur ?? "—"}</span> },
      { cle: "compatibilites", libelle: "Compatibilités", parDefaut: false, largeur: 260, rendu: (s) => <span className="block truncate">{s.piece.compatibilites.join(", ") || rien}</span> },
      { cle: "unite", libelle: "Unité", parDefaut: false, largeur: 90, texte: (s) => UNITE_PIECE[s.piece.unite].libelle, rendu: (s) => <span className="text-texte-2">{UNITE_PIECE[s.piece.unite].libelle}</span> },
      { cle: "numero", libelle: "Numéro", parDefaut: false, largeur: 150, rendu: (s) => <Numero valeur={s.piece.numero} /> },
      { cle: "commentaire", libelle: "Commentaire", parDefaut: false, largeur: 260, rendu: (s) => <span className="block truncate">{s.piece.commentaire ?? rien}</span> },
      {
        cle: "action",
        libelle: "Action",
        parDefaut: true,
        largeur: 100,
        texte: () => "Modifier",
        rendu: (s) => (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              modifierPiece(s.piece);
            }}
            className="bouton-discret h-7 px-2 text-[12px]"
          >
            <Pencil className="size-3.5" strokeWidth={1.8} />
            Modifier
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ---- Vue Mouvements ---- */
  const lignesMouvements = useMemo(() => {
    const l = [...mouvements].sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero));
    if (cible) l.sort((a, b) => (a.numero === cible ? -1 : b.numero === cible ? 1 : 0));
    return l;
  }, [mouvements, cible]);
  const pieceDe = (m: { pieceNumero: string | null }) => (m.pieceNumero ? (pieceParNumero.get(m.pieceNumero) ?? null) : null);
  const colonnesMouvements = useMemo<ColonneListe<MouvementStock>[]>(
    () => [
      { cle: "date", libelle: "Date", parDefaut: true, largeur: 110, tri: (m) => m.date, rendu: (m) => <span className="code">{dateCourte(m.date)}</span> },
      { cle: "nature", libelle: "Nature", parDefaut: true, largeur: 140, texte: (m) => NATURE_MOUVEMENT[m.nature].libelle, rendu: (m) => <Pastille ton={NATURE_MOUVEMENT[m.nature].ton}>{NATURE_MOUVEMENT[m.nature].libelle}</Pastille> },
      {
        cle: "variation",
        libelle: "Quantité",
        parDefaut: true,
        largeur: 110,
        alignee: "droite",
        tri: (m) => variation(m),
        rendu: (m) => {
          const v = variation(m);
          const p = pieceDe(m);
          return (
            <span className={`code ${v < 0 ? "text-vigilance" : v > 0 ? "text-favorable" : ""}`}>
              {v > 0 ? "+" : ""}
              {nombre(v)} {p ? UNITE_PIECE[p.unite].court : ""}
            </span>
          );
        },
      },
      { cle: "rattachement", libelle: "Rattaché à", parDefaut: true, largeur: 170, texte: rattachement, rendu: (m) => (rattachement(m) ? <span className="code text-[12.5px]">{rattachement(m)}</span> : rien) },
      { cle: "prix", libelle: "Prix unitaire", parDefaut: true, largeur: 125, alignee: "droite", tri: (m) => m.prixUnitaire, rendu: (m) => (m.prixUnitaire === null ? rien : <span className="code">{montant(m.prixUnitaire)}</span>) },
      { cle: "motif", libelle: "Motif", parDefaut: true, largeur: 260, rendu: (m) => <span className="block truncate">{m.motif ?? rien}</span> },
      { cle: "auteur", libelle: "Saisi par", parDefaut: false, largeur: 160, rendu: (m) => <span className="block truncate">{m.auteur}</span> },
      { cle: "fournisseur", libelle: "Fournisseur", parDefaut: false, largeur: 180, rendu: (m) => <span className="block truncate">{m.fournisseur ?? rien}</span> },
      { cle: "vehicule", libelle: "Véhicule", parDefaut: false, largeur: 130, rendu: (m) => <span className="code text-[12.5px]">{m.immatriculationAffichee ?? "—"}</span> },
      { cle: "reference", libelle: "Réf. pièce", parDefaut: false, largeur: 140, rendu: (m) => <span className="code text-[12.5px]">{pieceDe(m)?.reference ?? m.pieceNumero}</span> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pieceParNumero],
  );

  /* ---- Vue Pneus ---- */
  const lignesPneus = useMemo(() => {
    const rang: Record<Pneu["etat"], number> = { monte: 0, depose: 1, "en-stock": 2, rebute: 3 };
    const l = [...pneus].sort((a, b) => rang[a.etat] - rang[b.etat] || (a.immatriculationAffichee ?? "").localeCompare(b.immatriculationAffichee ?? "") || a.numero.localeCompare(b.numero));
    if (cible) l.sort((a, b) => (a.numero === cible ? -1 : b.numero === cible ? 1 : 0));
    return l;
  }, [pneus, cible]);
  const colonnesPneus = useMemo<ColonneListe<Pneu>[]>(
    () => [
      { cle: "etat", libelle: "État", parDefaut: true, largeur: 120, texte: (p) => ETAT_PNEU[p.etat].libelle, rendu: (p) => <Pastille ton={ETAT_PNEU[p.etat].ton}>{ETAT_PNEU[p.etat].libelle}</Pastille> },
      { cle: "vehicule", libelle: "Véhicule", parDefaut: true, largeur: 130, rendu: (p) => <span className="code text-[12.5px]">{p.immatriculationAffichee ?? "—"}</span> },
      { cle: "position", libelle: "Position", parDefaut: true, largeur: 120, rendu: (p) => <span>{p.position ?? rien}</span> },
      { cle: "marque", libelle: "Marque", parDefaut: true, largeur: 130, rendu: (p) => <span className="block truncate">{p.marque || rien}</span> },
      { cle: "pose", libelle: "Posé le", parDefaut: true, largeur: 110, tri: (p) => p.datePose, rendu: (p) => (p.datePose ? <span className="code">{dateCourte(p.datePose)}</span> : rien) },
      { cle: "kmPose", libelle: "Compteur à la pose", parDefaut: true, largeur: 160, alignee: "droite", tri: (p) => p.kmPose, rendu: (p) => (p.kmPose === null ? rien : <span className="code">{nombre(p.kmPose)} km</span>) },
      {
        cle: "parcourus",
        libelle: "Km parcourus",
        parDefaut: true,
        largeur: 130,
        alignee: "droite",
        tri: (p) => kmParcourus(p, null),
        rendu: (p) => {
          const km = kmParcourus(p, null);
          return km === null ? (p.etat === "monte" ? <span className="text-attenue">en cours</span> : rien) : <span className="code">{nombre(km)} km</span>;
        },
      },
      { cle: "depose", libelle: "Déposé le", parDefaut: false, largeur: 110, tri: (p) => p.dateDepose, rendu: (p) => (p.dateDepose ? <span className="code">{dateCourte(p.dateDepose)}</span> : rien) },
      { cle: "kmDepose", libelle: "Compteur à la dépose", parDefaut: false, largeur: 170, alignee: "droite", tri: (p) => p.kmDepose, rendu: (p) => (p.kmDepose === null ? rien : <span className="code">{nombre(p.kmDepose)} km</span>) },
      { cle: "rechapages", libelle: "Rechapages", parDefaut: true, largeur: 115, alignee: "droite", tri: (p) => p.rechapages, rendu: (p) => (p.rechapages > 0 ? <span className="code">{p.rechapages}</span> : rien) },
      { cle: "serie", libelle: "Série / DOT", parDefaut: false, largeur: 150, rendu: (p) => <span className="code text-[12.5px]">{p.numeroSerie ?? "—"}</span> },
      { cle: "piece", libelle: "Réf. pièce", parDefaut: false, largeur: 140, rendu: (p) => <span className="code text-[12.5px]">{pieceDe(p)?.reference ?? "—"}</span> },
      { cle: "commentaire", libelle: "Commentaire", parDefaut: false, largeur: 240, rendu: (p) => <span className="block truncate">{p.commentaire ?? rien}</span> },
      {
        cle: "action",
        libelle: "Action",
        parDefaut: true,
        largeur: 100,
        texte: () => "Modifier",
        rendu: (p) => (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              modifierPneu(p);
            }}
            className="bouton-discret h-7 px-2 text-[12px]"
          >
            <Pencil className="size-3.5" strokeWidth={1.8} />
            Modifier
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pieceParNumero],
  );

  const sousTitre =
    vue === "stock"
      ? `${actives.length} référence${actives.length > 1 ? "s" : ""} · ${aCommander.length} à réapprovisionner · ${montantCourt(valeur)} de valeur indicative — le stock se déduit des mouvements, il ne se saisit pas`
      : vue === "mouvements"
        ? `${mouvements.length} mouvement${mouvements.length > 1 ? "s" : ""} · ${sortiesAnnee} sortie${sortiesAnnee > 1 ? "s" : ""} sur douze mois — toute sortie cite l'ordre, l'intervention ou le véhicule qu'elle sert`
        : vue === "pneus"
          ? `${pneus.length} pneu${pneus.length > 1 ? "s" : ""} · ${montes} monté${montes > 1 ? "s" : ""} · ${pneusEnStock} en stock — chaque pneu se suit un par un, de la pose à la dépose`
          : `${comptees} référence${comptees > 1 ? "s" : ""} comptée${comptees > 1 ? "s" : ""} sur ${inventaire.length} · ${ecarts.length} écart${ecarts.length > 1 ? "s" : ""} — un inventaire ne corrige pas le stock à la main : chaque écart devient une régularisation, avec son motif`;

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Pièces de rechange"
        sousTitre={sousTitre}
        actions={
          <>
            <Segments
              valeur={vue}
              options={[
                { cle: "stock" as VuePieces, libelle: "Stock" },
                { cle: "mouvements" as VuePieces, libelle: "Mouvements" },
                { cle: "pneus" as VuePieces, libelle: "Pneus" },
                { cle: "inventaire" as VuePieces, libelle: "Inventaire" },
              ]}
              onChange={setVue}
              etiquette="Vue"
            />
            {vue === "inventaire" ? (
              <>
                <button type="button" onClick={() => { setComptes({}); setMotifs({}); }} className="bouton-secondaire disabled:cursor-not-allowed disabled:text-attenue-2" disabled={comptees === 0}>
                  Vider le comptage
                </button>
                <button
                  type="button"
                  onClick={enregistrerInventaire}
                  className="bouton-principal disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-attenue-2"
                  disabled={!gere || ecarts.length === 0}
                  title={!gere ? "Régulariser demande le niveau gestion du module Maintenance" : ecarts.length === 0 ? "Aucun écart à régulariser" : undefined}
                >
                  <ClipboardCheck className="size-4" strokeWidth={2.2} />
                  Enregistrer l'inventaire{ecarts.length > 0 ? ` (${ecarts.length} écart${ecarts.length > 1 ? "s" : ""})` : ""}
                </button>
              </>
            ) : !saisit ? null : vue === "pneus" ? (
              <button type="button" onClick={nouveauPneu} className="bouton-principal">
                <Plus className="size-4" strokeWidth={2.2} />
                Nouveau pneu
              </button>
            ) : (
              <>
                {vue === "mouvements" ? (
                  <>
                    <button type="button" onClick={() => nouveauMouvement("retour")} className="bouton-secondaire">
                      <CircleDot className="size-4 text-texte-2" strokeWidth={1.7} />
                      Retour
                    </button>
                    <button type="button" onClick={() => nouveauMouvement("regularisation")} className="bouton-secondaire">
                      <Scale className="size-4 text-texte-2" strokeWidth={1.7} />
                      Régularisation
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={nouvellePiece} className="bouton-secondaire">
                    <Plus className="size-4 text-texte-2" strokeWidth={1.7} />
                    Nouvelle pièce
                  </button>
                )}
                <button type="button" onClick={() => nouveauMouvement("entree")} className="bouton-secondaire">
                  <ArrowDownToLine className="size-4 text-texte-2" strokeWidth={1.7} />
                  Entrée
                </button>
                <button type="button" onClick={() => nouveauMouvement("sortie")} className="bouton-principal">
                  <ArrowUpFromLine className="size-4" strokeWidth={2.2} />
                  Sortie
                </button>
              </>
            )}
          </>
        }
      />
      <BandeauKpi kpis={kpis} />

      {vue === "stock" && saisit && commandes.length > 0 ? (
        /* Le réapprovisionnement : ce qui est sous le seuil, groupé par
           fournisseur habituel — une demande d'achat par fournisseur, jamais
           une demande qui mélange deux comptes. La demande s'ouvre pré-remplie
           (objet, montant estimé au dernier prix, détail ligne à ligne) et se
           range sur Caisse & achats, où elle suit son circuit habituel. */
        <div className="carte flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-texte">À réapprovisionner</p>
            <p className="meta">{commandes.reduce((t, c) => t + c.lignes.length, 0)} référence{commandes.reduce((t, c) => t + c.lignes.length, 0) > 1 ? "s" : ""} sous le seuil · une demande d'achat par fournisseur, au dernier prix connu</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {commandes.map((c) => (
              <button key={c.fournisseurNumero ?? c.fournisseur} type="button" onClick={() => preparerCommande(c)} className="bouton-secondaire h-9" title={detailCommande(c)}>
                <ShoppingCart className="size-4 text-texte-2" strokeWidth={1.7} />
                {c.fournisseur}
                <span className="text-attenue">
                  · {c.lignes.length} réf.{c.montantEstime > 0 ? ` · ${montantCourt(c.montantEstime)}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {vue === "mouvements" && bilanInventaire ? (
        <p className="carte shrink-0 px-5 py-3 text-[13px] text-texte">
          <ClipboardCheck className="mr-1.5 inline size-4 text-accent-fonce" strokeWidth={2} />
          {bilanInventaire}
        </p>
      ) : null}

      {vue === "inventaire" ? (
        <Carte titre={`Inventaire du ${formaterDate(source.aujourdhui)}`} precision="Comptez ce que vous voyez au casier ; l'écart se calcule, la régularisation s'écrit à l'enregistrement. Un inventaire peut être partiel : les lignes non comptées restent telles quelles." sansMarge className="min-h-0 flex-1 overflow-y-auto">
          <TableauSimple<LigneInventaire>
            colonnes={colonnesInventaire}
            lignes={inventaire}
            cle={(l) => l.piece.numero}
            filtrable
            vide="Aucune pièce active au référentiel."
          />
        </Carte>
      ) : null}

      {vue === "stock" ? (
        <TableListe<StockPiece>
          ecran="pieces"
          lignes={lignesStock}
          cle={(s) => s.piece.numero}
          href={(s) => `/pieces/${s.piece.numero}`}
          filet={(s) => ({ couleur: s.piece.actif ? COULEUR_TON[ETAT_STOCK[s.etat].ton] : "var(--color-neutre)", libelle: s.piece.actif ? ETAT_STOCK[s.etat].libelle : "Inactive", precision: s.piece.actif ? ETAT_STOCK[s.etat].precision : "Plus proposée au choix ; son historique reste lisible" })}
          libelleFilet="État du stock"
          identifiant={{ cle: "designation", libelle: "Désignation", largeur: 300, rendu: (s) => <span className="block truncate">{s.piece.designation}</span> }}
          fixes={FIXES_STOCK}
          colonnes={colonnesStock}
          filtres={FILTRES_STOCK}
          champsRecherche={(s) => [s.piece.numero, s.piece.reference, s.piece.designation, s.piece.referenceConstructeur ?? "", s.piece.compatibilites.join(" "), s.piece.fournisseur ?? "", CATEGORIE_PIECE[s.piece.categorie]]}
          placeholderRecherche="Référence, désignation, constructeur, modèle…"
          libelleRecherche="Rechercher une pièce"
          libelleUnite="références"
          vide="Aucune pièce ne correspond."
        />
      ) : vue === "mouvements" ? (
        <TableListe<MouvementStock>
          ecran="pieces-mouvements"
          lignes={lignesMouvements}
          cle={(m) => m.numero}
          href={hrefMouvement}
          filet={(m) => ({ couleur: COULEUR_TON[NATURE_MOUVEMENT[m.nature].ton], libelle: NATURE_MOUVEMENT[m.nature].libelle, precision: NATURE_MOUVEMENT[m.nature].precision })}
          libelleFilet="Nature"
          identifiant={{ cle: "piece", libelle: "Pièce", largeur: 300, rendu: (m) => <span className="block truncate">{pieceDe(m)?.designation ?? m.pieceNumero}</span> }}
          fixes={FIXES_MOUVEMENTS}
          colonnes={colonnesMouvements}
          filtres={FILTRES_MOUVEMENTS}
          champsRecherche={(m) => [m.numero, m.pieceNumero, pieceDe(m)?.reference ?? "", pieceDe(m)?.designation ?? "", rattachement(m), m.immatriculationAffichee ?? "", m.motif ?? "", m.fournisseur ?? "", m.auteur]}
          placeholderRecherche="Pièce, ordre, intervention, véhicule, motif…"
          libelleRecherche="Rechercher un mouvement"
          libelleUnite="mouvements"
          vide="Aucun mouvement ne correspond."
        />
      ) : vue === "pneus" ? (
        <TableListe<Pneu>
          ecran="pieces-pneus"
          lignes={lignesPneus}
          cle={(p) => p.numero}
          href={(p) => (p.vehiculeId ? `/flotte/${p.vehiculeId}?onglet=entretien&ref=${p.numero}` : `/pieces?vue=pneus&ref=${p.numero}`)}
          filet={(p) => ({ couleur: COULEUR_TON[ETAT_PNEU[p.etat].ton], libelle: ETAT_PNEU[p.etat].libelle, precision: ETAT_PNEU[p.etat].precision })}
          libelleFilet="État"
          identifiant={{ cle: "dimension", libelle: "Dimension", largeur: 200, rendu: (p) => <span className="block truncate">{p.dimension}</span> }}
          fixes={FIXES_PNEUS}
          colonnes={colonnesPneus}
          filtres={FILTRES_PNEUS}
          champsRecherche={(p) => [p.numero, p.dimension, p.marque, p.numeroSerie ?? "", p.immatriculationAffichee ?? "", p.position ?? "", p.commentaire ?? ""]}
          placeholderRecherche="Dimension, marque, véhicule, série…"
          libelleRecherche="Rechercher un pneu"
          libelleUnite="pneus"
          vide="Aucun pneu ne correspond."
        />
      ) : null}
    </div>
  );
}

const FIXES_STOCK: ColonneListe<StockPiece>[] = [{ cle: "reference", libelle: "Réf.", parDefaut: true, largeur: 140, rendu: (s) => <span className="code text-[12.5px]">{s.piece.reference}</span> }];
const FIXES_MOUVEMENTS: ColonneListe<MouvementStock>[] = [{ cle: "numero", libelle: "Réf.", parDefaut: true, largeur: 150, rendu: (m) => <Numero valeur={m.numero} /> }];
const FIXES_PNEUS: ColonneListe<Pneu>[] = [{ cle: "numero", libelle: "Réf.", parDefaut: true, largeur: 150, rendu: (p) => <Numero valeur={p.numero} /> }];
