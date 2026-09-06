"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Pencil, Plus, Wallet } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { ModaleDecision } from "@/composants/caisse/ModaleDecision";
import { Numero } from "@/composants/interface/Numero";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { CHAMPS, champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerLigneAchat, fabriquerLigneMouvement } from "@/composants/transactions/fabriques";
import {
  attenteDe,
  avecSolde,
  COULEUR_ETAPE_ACHAT,
  COULEUR_ETAT_MOUVEMENT,
  coutDe,
  ETAPE_ACHAT,
  etatMouvement,
  estEnCoursAchat,
  LIBELLE_ETAT_MOUVEMENT,
  NATURE_COUT,
  peutDecider,
  phaseDe,
  PRECISION_ETAPE_ACHAT,
  PRECISION_ETAT_MOUVEMENT,
  SENS_CAISSE,
  soldeDe,
  TON_ETAPE_ACHAT,
  TON_URGENCE,
  URGENCE_ACHAT,
  type LigneAchat,
  type LigneMouvement,
} from "@/domaine/caisse";
import { BUSINESS_UNIT, POSTE_DEPENSE } from "@/domaine/libelles";
import type { Prestataire } from "@/domaine/prestataires";
import { trouverRole, type Role } from "@/domaine/roles";
import type { BusinessUnit } from "@/domaine/types";
import { libelleDepense, type DepenseCaisse } from "@/donnees/caisse-demo";
import { fabriquerPrestataire } from "@/donnees/prestataires-demo";
import { lireCreations } from "@/lib/clotures-demo";
import { date, dateCourte, montant } from "@/lib/format";
import { lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Caisse & achats — une entrée du rail, deux journaux.
 *
 * À gauche des actions, un bouton à segments : le **journal de caisse**, où
 * chaque sortie cite la dépense qu'elle règle, et les **demandes d'achat**, qui
 * citent la transaction qui les motive, franchissent leur circuit de
 * validation, puis sont **suivies dans Sage X3** — commandée, livrée,
 * facturée, réglée. L'application ne refait pas l'achat : elle sait à quelle
 * étape en est chaque demande, ce qu'elle coûte, et à quoi elle se rattache.
 * Les deux sont des listes comme les autres — filet d'état, colonnes
 * réglables, recherche, tri, pagination — et chaque ligne se modifie par la
 * modale tracée.
 *
 * Pas de bandeau de KPI : le solde et les compteurs tiennent dans le
 * sous-titre, et ce qui appelle une action tient dans un bandeau d'une ligne.
 * ==========================================================================*/

export type VueCaisse = "journal" | "achats";

type Periode = "30" | "90" | "365" | "tout";
const PERIODES: { cle: Periode; libelle: string }[] = [
  { cle: "30", libelle: "30 j" },
  { cle: "90", libelle: "90 j" },
  { cle: "365", libelle: "12 mois" },
  { cle: "tout", libelle: "Tout" },
];

const FILTRES_JOURNAL: FiltreListe<LigneMouvement>[] = [
  { cle: "tous", libelle: "Tous", retient: () => true },
  { cle: "sorties", libelle: "Sorties", retient: (m) => m.sens === "sortie" },
  { cle: "entrees", libelle: "Approvisionnements", retient: (m) => m.sens === "entree" },
  { cle: "sans-justificatif", libelle: "Sans justificatif", retient: (m) => m.sens === "sortie" && !m.justificatif },
  { cle: "a-regulariser", libelle: "À régulariser", retient: (m) => m.sens === "sortie" && !m.depenseNumero },
];

/* Une pilule de bouton à segments — la forme retenue partout dans l'application. */
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

interface Props {
  mouvements: LigneMouvement[];
  depensesARegler: DepenseCaisse[];
  achats: LigneAchat[];
  prestataires: Prestataire[];
  soldeInitial: number;
  aujourdhui: string;
  vueInitiale: VueCaisse;
  cible?: string;
}

export function EcranCaisse(props: Props) {
  return (
    <FournisseurEdition sujet="caisse" href="/caisse">
      <Interieur {...props} />
    </FournisseurEdition>
  );
}

function Interieur({ mouvements, depensesARegler, achats, prestataires, soldeInitial, aujourdhui, vueInitiale, cible }: Props) {
  const { demander, creer, surcharger, version, actualiser } = useEdition();
  const [vue, setVue] = useState<VueCaisse>(vueInitiale);
  const [periode, setPeriode] = useState<Periode>("365");
  const [bu, setBu] = useState<BusinessUnit | "toutes">("toutes");
  const [voletRegler, setVoletRegler] = useState(false);
  const [aDecider, setADecider] = useState<LigneAchat | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  /* Les créations vivent dans le navigateur : les lire pendant l'hydratation
     ferait différer le sous-titre du serveur et du client. On attend d'être
     monté, comme sur les autres écrans. */
  const [monte, setMonte] = useState(false);
  useEffect(() => {
    setRole(trouverRole(lireRole()).role);
    setMonte(true);
  }, []);

  /* ---- Ce qui a été créé dans l'application ---- */
  const creations = useMemo(
    () => (monte ? lireCreations("caisse") : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, monte],
  );
  /* Les prestataires créés dans l'application comptent autant que ceux du jeu
     de données : une demande peut citer l'un comme l'autre. */
  const tousPrestataires = useMemo(
    () => (monte ? [...lireCreations("prestataires").filter((c) => c.type === "prestataire").map(fabriquerPrestataire), ...prestataires] : prestataires),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prestataires, version, monte],
  );
  const mouvementsCrees = useMemo(() => creations.filter((c) => c.type === "caisse").map((c) => fabriquerLigneMouvement(c, depensesARegler)), [creations, depensesARegler]);
  const achatsCrees = useMemo(() => creations.filter((c) => c.type === "achat").map((c) => fabriquerLigneAchat(c, tousPrestataires)), [creations, tousPrestataires]);

  /* ---- Journal ---- */
  const journal = useMemo(() => {
    const fusion = [...mouvementsCrees, ...mouvements.filter((m) => !mouvementsCrees.some((c) => c.numero === m.numero))].map((m) => surcharger(m));
    /* Le solde se recalcule sur le journal entier : une sortie saisie
       aujourd'hui déplace le solde de toutes les lignes qui la suivent. */
    return avecSolde(fusion, soldeInitial);
  }, [mouvementsCrees, mouvements, surcharger, soldeInitial]);

  /* ---- Demandes d'achat ---- */
  const demandes = useMemo(() => {
    const fusion = [...achatsCrees, ...achats.filter((a) => !achatsCrees.some((c) => c.numero === a.numero))].map((a) => {
      const s = surcharger(a);
      /* Le fournisseur choisi à la commande est un numéro PRE : son nom se lit
         dans le référentiel, pour que la liste ne montre pas un code. */
      const p = s.prestataireNumero ? tousPrestataires.find((x) => x.numero === s.prestataireNumero) : null;
      return p ? { ...s, fournisseur: p.raisonSociale } : s;
    });
    fusion.sort((a, b) => b.date.localeCompare(a.date));
    if (cible) fusion.sort((a, b) => (a.numero === cible ? -1 : b.numero === cible ? 1 : 0));
    return fusion;
  }, [achatsCrees, achats, surcharger, cible, tousPrestataires]);

  /* ---- Fenêtre commune : période et business unit ---- */
  const depuis = useMemo(() => {
    if (periode === "tout") return "";
    const d = new Date(`${aujourdhui}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - Number(periode));
    return d.toISOString().slice(0, 10);
  }, [periode, aujourdhui]);

  const bus = useMemo(() => (Object.keys(BUSINESS_UNIT) as BusinessUnit[]).filter((b) => journal.some((m) => m.businessUnit === b) || demandes.some((a) => a.businessUnit === b)), [journal, demandes]);

  /* Un approvisionnement n'appartient à aucune business unit : le filtrer par BU
     ferait mentir le solde affiché sur la ligne, il reste donc visible. */
  const mouvementsVisibles = useMemo(
    () => journal.filter((m) => (bu === "toutes" || m.businessUnit === bu || m.sens === "entree") && (!depuis || m.date >= depuis || m.numero === cible)),
    [journal, bu, depuis, cible],
  );
  const demandesVisibles = useMemo(
    () => demandes.filter((a) => (bu === "toutes" || a.businessUnit === bu) && (!depuis || a.date >= depuis || a.numero === cible)),
    [demandes, bu, depuis, cible],
  );

  const solde = useMemo(() => soldeDe(journal, soldeInitial), [journal, soldeInitial]);
  const sansJustificatif = mouvementsVisibles.filter((m) => m.sens === "sortie" && !m.justificatif).length;
  const resteARegler = depensesARegler.filter((d) => !journal.some((m) => m.depenseNumero === d.numero));
  const montantARegler = resteARegler.reduce((s, d) => s + d.montant, 0);
  const aMaDecision = demandesVisibles.filter((a) => peutDecider(role, a)).length;
  const enValidation = demandesVisibles.filter((a) => phaseDe(a.etape) === "validation").length;
  const dansX3 = demandesVisibles.filter((a) => phaseDe(a.etape) === "x3");
  const engageNonRegle = dansX3.reduce((s, a) => s + coutDe(a).montant, 0);

  /* ---- Gestes ---- */
  const optionsDepenses = useMemo(() => resteARegler.map((d) => ({ valeur: d.numero, libelle: libelleDepense(d) })), [resteARegler]);

  function approvisionner() {
    creer({
      type: "caisse",
      titre: "Approvisionnement de la caisse parc",
      champs: champsCreation("caisse", { pour: "caisse", sens: "entree" }),
      valeurs: { date: aujourdhui, libelle: "Approvisionnement de la caisse parc", beneficiaire: "Trésorerie SEDIMA", justificatif: true },
    });
  }

  /* Ce que la dépense choisie remplit d'elle-même. Le montant, le libellé et le
     bénéficiaire sont ceux de la dépense : les retaper serait une occasion de
     se tromper, et un écart entre la sortie et la dépense qu'elle règle n'a pas
     de sens. Ils restent corrigibles — une sortie partielle se saisit à la main. */
  function reprendreDepense(numero: string): Record<string, string | boolean> {
    const d = resteARegler.find((x) => x.numero === numero);
    if (!d) return { libelle: "", montant: "", beneficiaire: "", piece: "" };
    return { libelle: d.libelle, montant: String(d.montant), beneficiaire: d.beneficiaire ?? "", piece: d.reference ?? "", justificatif: d.justificatif };
  }

  function sortie(d?: DepenseCaisse) {
    creer({
      type: "caisse",
      titre: d ? `Régler ${d.numero} · ${d.immatriculationAffichee}` : "Sortie de caisse",
      champs: champsCreation("caisse", { pour: "caisse", sens: "sortie", depenses: optionsDepenses }),
      valeurs: d
        ? { date: aujourdhui, depenseNumero: d.numero, libelle: d.libelle, montant: d.montant, beneficiaire: d.beneficiaire, piece: d.reference, justificatif: d.justificatif }
        : { date: aujourdhui, justificatif: true },
      entraine: (cle, valeur) => (cle === "depenseNumero" ? reprendreDepense(String(valeur)) : null),
    });
  }

  function nouvelleDemande() {
    creer({
      type: "achat",
      titre: "Nouvelle demande d'achat",
      champs: champsCreation("achat", { pour: "caisse" }),
      valeurs: { date: aujourdhui, urgence: "normale" },
    });
  }

  function modifierMouvement(m: LigneMouvement) {
    demander({ type: "caisse", numero: m.numero, titre: `Mouvement ${m.numero} · ${m.libelle}`, valeurs: m as unknown as Record<string, unknown>, champs: CHAMPS.caisse });
  }

  function modifierDemande(a: LigneAchat) {
    demander({ type: "achat", numero: a.numero, titre: `Demande ${a.numero} · ${a.objet}`, valeurs: a as unknown as Record<string, unknown>, champs: CHAMPS.achat });
  }

  /* Le rôle arrive après le montage ; les colonnes, elles, doivent garder la
     même identité d'un rendu à l'autre (sans quoi l'effet qui lit les
     préférences repart en boucle). Une référence mutable donne aux cellules le
     rôle du moment sans les recréer. */
  const roleRef = useMemo(() => ({ courant: null as Role | null }), []);
  roleRef.courant = role;

  /* ---- Colonnes ---- */
  const colonnesJournal = useMemo<ColonneListe<LigneMouvement>[]>(
    () => [
      /* Le sens se lit déjà dans les colonnes Entrée et Sortie : l'afficher en
         plus serait la même information deux fois sur la même vue. Il reste
         au choix des colonnes pour qui veut trier dessus. */
      { cle: "sens", libelle: "Sens", parDefaut: false, largeur: 150, texte: (m) => SENS_CAISSE[m.sens], rendu: (m) => <Pastille ton={m.sens === "entree" ? "favorable" : "neutre"}>{SENS_CAISSE[m.sens]}</Pastille> },
      { cle: "libelle", libelle: "Libellé", parDefaut: true, largeur: 205, rendu: (m) => <span className="block truncate">{m.libelle}</span> },
      {
        cle: "vehicule",
        libelle: "Véhicule",
        parDefaut: true,
        largeur: 120,
        texte: (m) => m.immatriculationAffichee ?? "",
        rendu: (m) =>
          m.immatriculation ? (
            <Link href={`/flotte/${m.immatriculation}`} onClick={(e) => e.stopPropagation()} className="code font-medium text-accent-fonce hover:underline">
              {m.immatriculationAffichee}
            </Link>
          ) : (
            <span className="text-attenue">—</span>
          ),
      },
      {
        cle: "depense",
        libelle: "Dépense réglée",
        parDefaut: true,
        largeur: 145,
        texte: (m) => m.depenseNumero ?? "",
        rendu: (m) => (m.depenseNumero ? <Numero valeur={m.depenseNumero} /> : <span className="text-attenue">—</span>),
      },
      { cle: "poste", libelle: "Poste", parDefaut: false, largeur: 160, texte: (m) => (m.poste ? POSTE_DEPENSE[m.poste] : ""), rendu: (m) => (m.poste ? POSTE_DEPENSE[m.poste] : <span className="text-attenue">—</span>) },
      { cle: "entree", libelle: "Entrée", parDefaut: true, largeur: 110, alignee: "droite", tri: (m) => (m.sens === "entree" ? m.montant : null), rendu: (m) => (m.sens === "entree" ? <span className="code font-medium text-favorable">{montant(m.montant)}</span> : <span className="text-attenue">—</span>) },
      { cle: "sortie", libelle: "Sortie", parDefaut: true, largeur: 110, alignee: "droite", tri: (m) => (m.sens === "sortie" ? m.montant : null), rendu: (m) => (m.sens === "sortie" ? <span className="code font-medium">{montant(m.montant)}</span> : <span className="text-attenue">—</span>) },
      { cle: "solde", libelle: "Solde", parDefaut: true, largeur: 120, alignee: "droite", tri: (m) => m.soldeApres, rendu: (m) => <span className={`code ${m.soldeApres < 0 ? "font-semibold text-defavorable" : "text-texte-2"}`}>{montant(m.soldeApres)}</span> },
      { cle: "justificatif", libelle: "Justificatif", parDefaut: true, largeur: 110, texte: (m) => (m.sens === "entree" ? "—" : m.justificatif ? "Fourni" : "Manquant"), rendu: (m) => (m.sens === "entree" ? <span className="text-attenue">—</span> : m.justificatif ? <Echeance ton="favorable">Fourni</Echeance> : <Echeance ton="vigilance">Manquant</Echeance>) },
      { cle: "beneficiaire", libelle: "Bénéficiaire", parDefaut: false, largeur: 200, rendu: (m) => m.beneficiaire ?? <span className="text-attenue">—</span> },
      { cle: "piece", libelle: "Pièce", parDefaut: false, largeur: 150, rendu: (m) => (m.piece ? <span className="code text-[12px]">{m.piece}</span> : <span className="text-attenue">—</span>) },
      { cle: "site", libelle: "Site", parDefaut: false, largeur: 150, rendu: (m) => m.site ?? <span className="text-attenue">—</span> },
      { cle: "bu", libelle: "BU", parDefaut: false, largeur: 140, rendu: (m) => (m.businessUnit ? BUSINESS_UNIT[m.businessUnit] : <span className="text-attenue">—</span>) },
      { cle: "enregistre", libelle: "Enregistré par", parDefaut: false, largeur: 160, rendu: (m) => m.enregistrePar },
      {
        cle: "action",
        libelle: "Action",
        parDefaut: true,
        largeur: 100,
        texte: () => "Modifier",
        rendu: (m) => (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              modifierMouvement(m);
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

  const colonnesAchats = useMemo<ColonneListe<LigneAchat>[]>(
    () => [
      { cle: "objet", libelle: "Objet", parDefaut: true, largeur: 240, rendu: (a) => <span className="block truncate font-medium">{a.objet}</span> },
      {
        cle: "vehicule",
        libelle: "Véhicule",
        parDefaut: true,
        largeur: 115,
        texte: (a) => a.immatriculationAffichee ?? "",
        rendu: (a) =>
          a.immatriculation ? (
            <Link href={`/flotte/${a.immatriculation}`} onClick={(e) => e.stopPropagation()} className="code font-medium text-accent-fonce hover:underline">
              {a.immatriculationAffichee}
            </Link>
          ) : (
            <span className="text-attenue">—</span>
          ),
      },
      {
        cle: "origine",
        libelle: "Transaction d'origine",
        parDefaut: true,
        largeur: 160,
        texte: (a) => a.origineNumero,
        rendu: (a) => <Numero valeur={a.origineNumero} />,
      },
      { cle: "poste", libelle: "Poste", parDefaut: false, largeur: 170, texte: (a) => POSTE_DEPENSE[a.poste], rendu: (a) => POSTE_DEPENSE[a.poste] },
      {
        cle: "fournisseur",
        libelle: "Fournisseur",
        parDefaut: true,
        largeur: 180,
        texte: (a) => a.fournisseur ?? "",
        rendu: (a) =>
          a.prestataireNumero ? (
            <Link href={`/prestataires/${a.prestataireNumero}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-accent-fonce hover:underline">
              {a.fournisseur}
            </Link>
          ) : (
            <span className="block truncate">{a.fournisseur ?? "—"}</span>
          ),
      },
      /* Le coût, au plus juste de ce que l'on sait : facturé, sinon engagé, sinon
         estimé — la nature se lit dessous, pour ne pas confondre un devis et
         une facture. */
      {
        cle: "cout",
        libelle: "Coût",
        parDefaut: true,
        largeur: 130,
        alignee: "droite",
        tri: (a) => coutDe(a).montant,
        texte: (a) => `${montant(coutDe(a).montant)} ${NATURE_COUT[coutDe(a).nature]}`,
        rendu: (a) => {
          const c = coutDe(a);
          return (
            <span className="flex flex-col items-end leading-tight">
              <span className={`code ${c.nature === "reel" ? "font-semibold" : "font-medium"}`}>{montant(c.montant)}</span>
              <span className="text-[11px] text-attenue">{NATURE_COUT[c.nature]}</span>
            </span>
          );
        },
      },
      { cle: "estime", libelle: "Montant estimé", parDefaut: false, largeur: 130, alignee: "droite", tri: (a) => a.montantEstime, rendu: (a) => <span className="code">{montant(a.montantEstime)}</span> },
      { cle: "urgence", libelle: "Urgence", parDefaut: true, largeur: 140, texte: (a) => URGENCE_ACHAT[a.urgence], rendu: (a) => (a.urgence === "normale" ? <span className="text-attenue">—</span> : <Echeance ton={TON_URGENCE[a.urgence]}>{URGENCE_ACHAT[a.urgence]}</Echeance>) },
      { cle: "etape", libelle: "Étape", parDefaut: true, largeur: 110, texte: (a) => ETAPE_ACHAT[a.etape], rendu: (a) => <Echeance ton={TON_ETAPE_ACHAT[a.etape]}>{ETAPE_ACHAT[a.etape]}</Echeance> },
      { cle: "attente", libelle: "En attente de", parDefaut: false, largeur: 210, rendu: (a) => <span className="block truncate text-texte-2">{attenteDe(a)}</span> },
      { cle: "daX3", libelle: "DA Sage X3", parDefaut: false, largeur: 140, rendu: (a) => (a.numeroDemandeX3 ? <span className="code text-[12px]">{a.numeroDemandeX3}</span> : <span className="text-attenue">—</span>) },
      { cle: "bc", libelle: "Bon Sage X3", parDefaut: true, largeur: 110, rendu: (a) => (a.numeroBonCommande ? <span className="code text-[12px]">{a.numeroBonCommande}</span> : <span className="text-attenue">—</span>) },
      { cle: "demandeur", libelle: "Demandeur", parDefaut: false, largeur: 170, rendu: (a) => a.demandeur },
      { cle: "visa", libelle: "Visa parc", parDefaut: false, largeur: 170, rendu: (a) => (a.visaPar ? `${a.visaPar} · ${dateCourte(a.visaLe)}` : <span className="text-attenue">—</span>) },
      { cle: "validation", libelle: "Validation", parDefaut: false, largeur: 190, rendu: (a) => (a.validePar ? `${a.validePar}${a.valideeLe ? ` · ${dateCourte(a.valideeLe)}` : ""}` : <span className="text-attenue">—</span>) },
      { cle: "livree", libelle: "Livrée le", parDefaut: false, largeur: 100, tri: (a) => a.dateLivraison, rendu: (a) => (a.dateLivraison ? <span className="code">{dateCourte(a.dateLivraison)}</span> : <span className="text-attenue">—</span>) },
      { cle: "facturee", libelle: "Facturée le", parDefaut: false, largeur: 100, tri: (a) => a.dateFacture, rendu: (a) => (a.dateFacture ? <span className="code">{dateCourte(a.dateFacture)}</span> : <span className="text-attenue">—</span>) },
      { cle: "reglee", libelle: "Réglée le", parDefaut: false, largeur: 100, tri: (a) => a.dateReglement, rendu: (a) => (a.dateReglement ? <span className="code">{dateCourte(a.dateReglement)}</span> : <span className="text-attenue">—</span>) },
      { cle: "depense", libelle: "Dépense du véhicule", parDefaut: false, largeur: 150, texte: (a) => a.depenseNumero ?? "", rendu: (a) => (a.depenseNumero ? <Numero valeur={a.depenseNumero} /> : <span className="text-attenue">—</span>) },
      { cle: "commentaire", libelle: "Commentaire", parDefaut: false, largeur: 280, rendu: (a) => <span className="block truncate">{a.commentaireDecision ?? "—"}</span> },
      {
        cle: "action",
        libelle: "Action",
        parDefaut: true,
        largeur: 110,
        texte: (a) => (peutDecider(roleRef.courant, a) ? "Décider" : "Modifier"),
        rendu: (a) => {
          const decisionnaire = peutDecider(roleRef.courant, a);
          return (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (decisionnaire) setADecider(a);
                else modifierDemande(a);
              }}
              className={decisionnaire ? "bouton-principal h-7 px-2.5 text-[12px]" : "bouton-discret h-7 px-2 text-[12px]"}
            >
              {decisionnaire ? null : <Pencil className="size-3.5" strokeWidth={1.8} />}
              {decisionnaire ? "Décider" : "Modifier"}
            </button>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const filtresAchats = useMemo<FiltreListe<LigneAchat>[]>(
    () => [
      { cle: "tous", libelle: "Toutes", retient: () => true },
      { cle: "a-decider", libelle: "À ma décision", retient: (a) => peutDecider(role, a) },
      { cle: "validation", libelle: "En validation", retient: (a) => phaseDe(a.etape) === "validation" },
      { cle: "x3", libelle: "Dans Sage X3", retient: (a) => phaseDe(a.etape) === "x3" },
      { cle: "urgentes", libelle: "Urgentes", retient: (a) => a.urgence !== "normale" && estEnCoursAchat(a.etape) },
      { cle: "reglees", libelle: "Réglées", retient: (a) => a.etape === "reglee" },
      { cle: "refusees", libelle: "Refusées", retient: (a) => a.etape === "refusee" },
    ],
    [role],
  );

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Caisse & achats"
        sousTitre={
          vue === "journal"
            ? `Solde ${montant(solde)} · ${mouvementsVisibles.length} mouvement${mouvementsVisibles.length > 1 ? "s" : ""} · ${sansJustificatif} sans justificatif · au ${date(aujourdhui)}`
            : `${demandesVisibles.length} demande${demandesVisibles.length > 1 ? "s" : ""} · ${enValidation} en validation · ${dansX3.length} dans Sage X3 pour ${montant(engageNonRegle)} · ${aMaDecision} à votre décision · au ${date(aujourdhui)}`
        }
        actions={
          <>
            <Segments
              valeur={vue}
              options={[
                { cle: "journal" as VueCaisse, libelle: "Journal de caisse" },
                { cle: "achats" as VueCaisse, libelle: "Demandes d'achat" },
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
            {vue === "journal" ? (
              <>
                <button type="button" onClick={approvisionner} className="bouton-secondaire">
                  <Wallet className="size-4 text-texte-2" strokeWidth={1.8} />
                  Approvisionner
                </button>
                <button type="button" onClick={() => sortie()} className="bouton-principal">
                  <Plus className="size-4" strokeWidth={2.2} />
                  Sortie de caisse
                </button>
              </>
            ) : (
              <button type="button" onClick={nouvelleDemande} className="bouton-principal">
                <Plus className="size-4" strokeWidth={2.2} />
                Nouvelle demande
              </button>
            )}
          </>
        }
      />

      {/* ---- Ce qui attend le passage en caisse ---- */}
      {vue === "journal" && resteARegler.length > 0 ? (
        <div className="shrink-0">
          <button type="button" onClick={() => setVoletRegler((o) => !o)} aria-expanded={voletRegler} className="carte flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-vigilance-fond text-vigilance">
              <Wallet className="size-4" strokeWidth={1.9} />
            </span>
            <span className="min-w-0 flex-1 text-[13px] text-texte">
              <span className="font-semibold">{resteARegler.length}</span> dépense{resteARegler.length > 1 ? "s" : ""} en attente de règlement — <span className="code font-medium">{montant(montantARegler)}</span>
              <span className="meta ml-2">une sortie de caisse cite toujours la dépense qu&apos;elle règle</span>
            </span>
            <ChevronDown className={`size-4 shrink-0 text-attenue transition-transform ${voletRegler ? "rotate-180" : ""}`} strokeWidth={1.8} />
          </button>

          {voletRegler ? (
            <ul className="carte mt-2.5 max-h-[240px] divide-y divide-bordure overflow-y-auto">
              {resteARegler.map((d) => (
                <li key={d.numero} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                  <Numero valeur={d.numero} />
                  <span className="code text-[12px] text-attenue">{dateCourte(d.date)}</span>
                  <Link href={`/flotte/${d.immatriculation}`} className="code text-[12.5px] font-medium text-accent-fonce hover:underline">
                    {d.immatriculationAffichee}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-texte">{d.libelle}</span>
                  <span className="code text-[13px] font-medium text-texte">{montant(d.montant)}</span>
                  <button type="button" onClick={() => sortie(d)} className="bouton-principal h-7 px-2.5 text-[12px]">
                    Régler
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {vue === "journal" ? (
        <TableListe<LigneMouvement>
          ecran="caisse"
          lignes={mouvementsVisibles}
          cle={(m) => m.numero}
          href={(m) => (m.immatriculation && m.depenseNumero ? `/flotte/${m.immatriculation}?onglet=autres&ref=${m.depenseNumero}` : `/caisse?vue=journal&ref=${m.numero}`)}
          filet={(m) => {
            const etat = etatMouvement(m);
            return { couleur: COULEUR_ETAT_MOUVEMENT[etat], libelle: LIBELLE_ETAT_MOUVEMENT[etat], precision: PRECISION_ETAT_MOUVEMENT[etat] };
          }}
          identifiant={{ cle: "numero", libelle: "Réf.", largeur: 140, rendu: (m) => <Numero valeur={m.numero} /> }}
          fixes={FIXES_JOURNAL}
          colonnes={colonnesJournal}
          filtres={FILTRES_JOURNAL}
          champsRecherche={(m) => [m.numero, m.libelle, m.beneficiaire ?? "", m.piece ?? "", m.depenseNumero ?? "", m.immatriculationAffichee ?? "", m.site ?? "", m.poste ? POSTE_DEPENSE[m.poste] : "", SENS_CAISSE[m.sens]]}
          placeholderRecherche="Référence, libellé, bénéficiaire, dépense réglée…"
          libelleRecherche="Rechercher un mouvement de caisse"
          libelleUnite="mouvements"
          vide="Aucun mouvement ne correspond."
          /* Un clic sur la ligne ouvre la pièce de caisse (demande du métier du
             3 septembre) ; la fiche du véhicule reste à un clic sur l'immatriculation. */
          surLigne={modifierMouvement}
        />
      ) : (
        <TableListe<LigneAchat>
          ecran="achats"
          lignes={demandesVisibles}
          cle={(a) => a.numero}
          href={(a) => a.origineHref ?? `/caisse?vue=achats&ref=${a.numero}`}
          filet={(a) => ({ couleur: COULEUR_ETAPE_ACHAT[a.etape], libelle: ETAPE_ACHAT[a.etape], precision: PRECISION_ETAPE_ACHAT[a.etape] })}
          identifiant={{ cle: "numero", libelle: "Réf.", largeur: 140, rendu: (a) => <Numero valeur={a.numero} /> }}
          fixes={FIXES_ACHATS}
          colonnes={colonnesAchats}
          filtres={filtresAchats}
          champsRecherche={(a) => [a.numero, a.objet, a.origineNumero, a.fournisseur ?? "", a.demandeur, a.immatriculationAffichee ?? "", POSTE_DEPENSE[a.poste], ETAPE_ACHAT[a.etape], a.numeroBonCommande ?? "", a.numeroDemandeX3 ?? ""]}
          placeholderRecherche="Référence, objet, transaction d'origine, fournisseur, bon X3…"
          libelleRecherche="Rechercher une demande d'achat"
          libelleUnite="demandes"
          vide="Aucune demande ne correspond."
          /* Un clic sur la ligne ouvre la demande : la décision si elle vous
             revient, la modification tracée sinon. */
          surLigne={(a) => (peutDecider(role, a) ? setADecider(a) : modifierDemande(a))}
        />
      )}

      {/* La décision se prend hors de la modale de transaction : c'est à
          l'écran de redemander les valeurs modifiées, sinon la ligne resterait
          à l'étape précédente. */}
      {aDecider ? <ModaleDecision ligne={aDecider} aujourdhui={aujourdhui} onFermer={() => setADecider(null)} onEnregistre={actualiser} /> : null}
    </div>
  );
}

/* Constantes de module : les colonnes fixes doivent garder la même identité
   d'un rendu à l'autre, sinon l'effet qui lit les préférences repart en boucle. */
const FIXES_JOURNAL: ColonneListe<LigneMouvement>[] = [
  { cle: "date", libelle: "Date", parDefaut: true, largeur: 95, tri: (m) => m.date, rendu: (m) => <span className="code">{dateCourte(m.date)}</span> },
];

const FIXES_ACHATS: ColonneListe<LigneAchat>[] = [
  { cle: "date", libelle: "Date", parDefaut: true, largeur: 95, tri: (a) => a.date, rendu: (a) => <span className="code">{dateCourte(a.date)}</span> },
];
