"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Numero } from "@/composants/interface/Numero";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { CHAMPS, champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import type { StatistiquesPrestataire } from "@/domaine/caisse";
import { COULEUR_ACTIF, TON_TYPE_PRESTATAIRE, TYPE_PRESTATAIRE, type Prestataire } from "@/domaine/prestataires";
import { dateCourte, montant, nombre } from "@/lib/format";
import { NIVEAU_PRESTATAIRE, ageDette, avanceOuverte, noterPrestataire } from "@/domaine/compte-prestataire";
import { activiteTransport, ancienneteMois, avancesDe, dettesDe, evaluationsDe, repriseDe } from "@/donnees/compte-prestataire-demo";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { POSTE_DEPENSE } from "@/domaine/libelles";
import { coutDe } from "@/domaine/caisse";
import { fichePrestataire } from "@/donnees/fiche-prestataire-demo";
import { fabriquerPrestataire } from "@/donnees/prestataires-demo";
import { lireCreations } from "@/lib/clotures-demo";

/* ============================================================================
 * Suivi › Prestataires — le référentiel de ceux avec qui le parc travaille.
 *
 * Une liste comme les autres (filet actif / inactif, colonnes réglables,
 * recherche, tri). Chaque fiche se crée et se modifie par la modale tracée :
 * un prestataire est une fiche, pas une transaction, mais la trace vaut autant.
 * Un prestataire inactif reste lisible sur ce qu'il a fait, et n'est plus
 * proposé au choix (garage d'un ordre de travail, par exemple).
 * ==========================================================================*/

const FILTRES: FiltreListe<Prestataire>[] = [
  { cle: "actifs", libelle: "Actifs", retient: (p) => p.actif },
  { cle: "garages", libelle: "Garages", retient: (p) => p.type === "garage" || p.type === "depanneur" },
  { cle: "fournisseurs", libelle: "Fournisseurs", retient: (p) => p.type === "pieces" || p.type === "pneumatiques" },
  { cle: "carburant", libelle: "Carburant", retient: (p) => p.type === "station" || p.type === "carburant" },
  { cle: "assureurs", libelle: "Assureurs", retient: (p) => p.type === "assureur" },
  { cle: "centres", libelle: "Centres agréés", retient: (p) => p.type === "centre-visite" },
  { cle: "inactifs", libelle: "Inactifs", retient: (p) => !p.actif },
  { cle: "tous", libelle: "Tous", retient: () => true },
];

export function EcranPrestataires({ prestataires, stats, cible }: { prestataires: Prestataire[]; stats: Record<string, StatistiquesPrestataire>; cible?: string }) {
  return (
    <FournisseurEdition sujet="prestataires" href="/prestataires">
      <Interieur prestataires={prestataires} stats={stats} cible={cible} />
    </FournisseurEdition>
  );
}

function Interieur({ prestataires, stats, cible }: { prestataires: Prestataire[]; stats: Record<string, StatistiquesPrestataire>; cible?: string }) {
  const { demander, creer, surcharger, version } = useEdition();
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  const crees = useMemo(() => (monte ? lireCreations("prestataires").filter((c) => c.type === "prestataire").map(fabriquerPrestataire) : []), [version, monte]); // eslint-disable-line react-hooks/exhaustive-deps
  const tous = useMemo(() => {
    const fusion = [...crees, ...prestataires.filter((p) => !crees.some((c) => c.numero === p.numero))].map((p) => surcharger(p));
    fusion.sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr"));
    if (cible) fusion.sort((a, b) => (a.numero === cible ? -1 : b.numero === cible ? 1 : 0));
    return fusion;
  }, [crees, prestataires, surcharger, cible]);

  const actifs = tous.filter((p) => p.actif).length;
  const parType = Object.keys(TYPE_PRESTATAIRE).filter((t) => tous.some((p) => p.type === t)).length;

  function nouveau() {
    creer({ type: "prestataire", titre: "Nouveau prestataire", champs: champsCreation("prestataire", { pour: "caisse" }), valeurs: { type: "garage" } });
  }
  function modifier(p: Prestataire) {
    demander({ type: "prestataire", numero: p.numero, titre: `Prestataire ${p.numero} · ${p.raisonSociale}`, valeurs: p as unknown as Record<string, unknown>, champs: CHAMPS.prestataire });
  }
  /*
   * Le résumé de chaque prestataire, calculé une fois pour toute la liste :
   * activité, compte, notation. Le refaire par ligne coûterait plusieurs fois
   * le rendu de l'écran — la fiche, les dettes et les évaluations sont trois
   * agrégats à part entière.
   */
  const resume = useMemo(() => {
    const debut = new Date(Date.parse(DATE_REFERENCE) - 365 * 86_400_000).toISOString().slice(0, 10);
    const recent = <T extends { date: string }>(l: T[]) => l.filter((x) => x.date >= debut);
    return new Map(
      prestataires.map((x) => {
        const fiche = fichePrestataire(x.numero);
        const interventions = fiche?.interventions ?? [];
        const demandes = fiche?.demandes ?? [];
        const pleins = fiche?.pleins ?? [];
        const caisse = fiche?.depensesCaisse ?? [];
        const evals = evaluationsDe(x.numero);
        const dettesP = dettesDe(x.numero);
        const avancesP = avancesDe(x.numero);
        const ouvertes = avancesP.filter(avanceOuverte);
        const echues = dettesP.filter((d) => ageDette(d.echeance, DATE_REFERENCE) !== "a-venir");
        const retards = echues.map((d) => Math.round((Date.parse(DATE_REFERENCE) - Date.parse(d.echeance ?? DATE_REFERENCE)) / 86_400_000));
        const reprises = repriseDe(interventions.map((i) => ({ date: i.date, objet: i.objet, vehiculeId: i.vehiculeId })));
        /* Un transporteur ne passe pas par les demandes d'achat : ses missions
           et son montant vivent dans ses affrètements, ses mises à disposition
           et ses prestations. */
        const transport = activiteTransport(x.raisonSociale, debut);
        const transportTout = activiteTransport(x.raisonSociale, "0000-01-01");
        const dates = [...interventions.map((i) => i.date), ...demandes.map((d) => d.date), ...pleins.map((v) => v.date), ...caisse.map((d) => d.date), ...transportTout.dates].sort();
        const du = dettesP.reduce((t, d) => t + d.montant, 0);
        const nonSoldees = ouvertes.reduce((t, a) => t + a.montant, 0);
        const moyenne = (critere: "qualite" | "delai" | "prix") =>
          evals.length ? Math.round((evals.reduce((t, e) => t + e.notes[critere], 0) / evals.length) * 10) / 10 : null;
        return [
          x.numero,
          {
            note: noterPrestataire({
              evaluations: evals,
              interventions: interventions.length,
              reprises,
              ancienneteMois: ancienneteMois(dates),
            }),
            /* L'activité se compte sur douze mois glissants : un garage qui n'a
               rien fait depuis un an n'est pas un garage actif, quoi qu'en dise
               la case « actif » du référentiel. */
            interventions: recent(interventions).length + transport.missions,
            interventionsTotal: interventions.length + transportTout.missions,
            demandes: recent(demandes).length,
            pleins: recent(pleins).length,
            litres: recent(pleins).reduce((t, v) => t + v.litres, 0),
            documents: (fiche?.documents ?? []).length,
            visites: (fiche?.visites ?? []).length,
            vehicules: new Set(interventions.map((i) => i.vehiculeId)).size,
            postes: [...new Set(demandes.map((d) => POSTE_DEPENSE[d.poste]))].sort().join(", "),
            /* Tout ce qu'il a facturé au parc : interventions, achats, caisse.
               Les seules demandes d'achat afficheraient « — » en face de
               dix-sept interventions. */
            montant:
              recent(interventions).reduce((t, i) => t + i.montant, 0) +
              recent(demandes).reduce((t, d) => t + coutDe(d).montant, 0) +
              recent(caisse).reduce((t, d) => t + d.montant, 0) +
              transport.montant,
            premiere: dates[0] ?? null,
            derniere: dates.length ? dates[dates.length - 1]! : null,
            anciennete: ancienneteMois(dates),
            evaluations: evals.length,
            qualite: moyenne("qualite"),
            delai: moyenne("delai"),
            prix: moyenne("prix"),
            reprises,
            du,
            pieces: dettesP.length,
            echu: echues.reduce((t, d) => t + d.montant, 0),
            piecesEchues: echues.length,
            retardMax: retards.length ? Math.max(...retards) : null,
            avances: avancesP.reduce((t, a) => t + a.montant, 0),
            avancesNonSoldees: nonSoldees,
            solde: du - nonSoldees,
          },
        ];
      }),
    );
  }, [prestataires]);

  const de = (p: Prestataire) => resume.get(p.numero) ?? null;
  const rien = <span className="text-attenue-2">—</span>;
  /** Une valeur numérique, ou le tiret quand elle est nulle ou vide. */
  const chiffre = (v: number | null | undefined, formater: (n: number) => string = String) => (v === null || v === undefined || v === 0 ? rien : <span className="code">{formater(v)}</span>);

  /*
   * Les colonnes. Le métier a demandé le 5 septembre 2026 de sortir des
   * colonnes par défaut ce qui relève de la **fiche** — téléphone, courriel,
   * ville, délai convenu — et de garder « le max de colonnes qu'on pourra
   * sélectionner ». Restent affichées d'emblée les six qui répondent aux
   * questions qu'on se pose devant un référentiel : qui est-ce, vaut-il quelque
   * chose, que fait-il pour nous, combien, lui doit-on, travaille-t-il encore.
   */
  const colonnes = useMemo<ColonneListe<Prestataire>[]>(
    () => [
      { cle: "type", libelle: "Type", parDefaut: true, largeur: 175, texte: (p) => TYPE_PRESTATAIRE[p.type], rendu: (p) => <Pastille ton={TON_TYPE_PRESTATAIRE[p.type]}>{TYPE_PRESTATAIRE[p.type]}</Pastille> },
      {
        cle: "notation",
        libelle: "Notation",
        parDefaut: true,
        largeur: 145,
        tri: (p) => de(p)?.note.score ?? null,
        texte: (p) => {
          const n = de(p)?.note;
          return n?.niveau ? NIVEAU_PRESTATAIRE[n.niveau].libelle : "non noté";
        },
        rendu: (p) => {
          const n = de(p)?.note;
          if (!n?.niveau)
            return (
              <span className="text-attenue" title="Moins de trois dimensions mesurées : on ne note pas au hasard">
                non noté
              </span>
            );
          return (
            <span
              className="inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-semibold text-white"
              style={{ background: NIVEAU_PRESTATAIRE[n.niveau].couleur }}
              title={`${NIVEAU_PRESTATAIRE[n.niveau].precision} — ${n.evaluations} évaluation(s), ${n.mesurees} dimensions sur 5`}
            >
              {NIVEAU_PRESTATAIRE[n.niveau].libelle}
              <span className="code opacity-80">{n.score}</span>
            </span>
          );
        },
      },
      {
        cle: "interventions",
        libelle: "Prestations 12 mois",
        parDefaut: true,
        largeur: 165,
        alignee: "droite",
        tri: (p) => de(p)?.interventions ?? 0,
        rendu: (p) => chiffre(de(p)?.interventions),
      },
      {
        cle: "montant",
        libelle: "Facturé 12 mois",
        parDefaut: true,
        largeur: 155,
        alignee: "droite",
        tri: (p) => de(p)?.montant ?? 0,
        rendu: (p) => chiffre(de(p)?.montant, (n) => montant(n)),
      },
      {
        cle: "dette",
        libelle: "Reste dû",
        parDefaut: true,
        largeur: 135,
        alignee: "droite",
        tri: (p) => de(p)?.du ?? 0,
        rendu: (p) => {
          const d = de(p)?.du ?? 0;
          return d > 0 ? <span className="code text-vigilance">{montant(d)}</span> : rien;
        },
      },
      {
        cle: "derniere",
        libelle: "Dernière activité",
        parDefaut: true,
        largeur: 155,
        tri: (p) => de(p)?.derniere ?? null,
        rendu: (p) => {
          const d = de(p)?.derniere;
          return d ? <span className="code">{dateCourte(d)}</span> : rien;
        },
      },
      { cle: "actif", libelle: "Statut", parDefaut: true, largeur: 100, texte: (p) => (p.actif ? "Actif" : "Inactif"), rendu: (p) => <Echeance ton={p.actif ? "favorable" : "neutre"}>{p.actif ? "Actif" : "Inactif"}</Echeance> },

      /* ---- Le compte fournisseur ---- */
      { cle: "pieces", libelle: "Pièces dues", parDefaut: false, largeur: 135, alignee: "droite", tri: (p) => de(p)?.pieces ?? 0, rendu: (p) => chiffre(de(p)?.pieces) },
      { cle: "echu", libelle: "Dont échu", parDefaut: false, largeur: 140, alignee: "droite", tri: (p) => de(p)?.echu ?? 0, rendu: (p) => chiffre(de(p)?.echu, montant) },
      { cle: "piecesEchues", libelle: "Pièces échues", parDefaut: false, largeur: 145, alignee: "droite", tri: (p) => de(p)?.piecesEchues ?? 0, rendu: (p) => chiffre(de(p)?.piecesEchues) },
      { cle: "retardMax", libelle: "Retard le plus ancien", parDefaut: false, largeur: 185, alignee: "droite", tri: (p) => de(p)?.retardMax ?? null, rendu: (p) => chiffre(de(p)?.retardMax, (n) => `${n} j`) },
      { cle: "avances", libelle: "Avances versées", parDefaut: false, largeur: 165, alignee: "droite", tri: (p) => de(p)?.avances ?? 0, rendu: (p) => chiffre(de(p)?.avances, montant) },
      { cle: "avancesNonSoldees", libelle: "Avances non soldées", parDefaut: false, largeur: 185, alignee: "droite", tri: (p) => de(p)?.avancesNonSoldees ?? 0, rendu: (p) => chiffre(de(p)?.avancesNonSoldees, montant) },
      { cle: "solde", libelle: "Solde net", parDefaut: false, largeur: 145, alignee: "droite", tri: (p) => de(p)?.solde ?? 0, rendu: (p) => chiffre(de(p)?.solde, montant) },

      /* ---- Ce qu'il fait pour le parc ---- */
      { cle: "interventionsTotal", libelle: "Prestations (tout l'historique)", parDefaut: false, largeur: 235, alignee: "droite", tri: (p) => de(p)?.interventionsTotal ?? 0, rendu: (p) => chiffre(de(p)?.interventionsTotal) },
      { cle: "vehicules", libelle: "Véhicules servis", parDefaut: false, largeur: 155, alignee: "droite", tri: (p) => de(p)?.vehicules ?? 0, rendu: (p) => chiffre(de(p)?.vehicules) },
      { cle: "postes", libelle: "Postes servis", parDefaut: false, largeur: 240, rendu: (p) => <span className="block truncate">{de(p)?.postes || rien}</span> },
      { cle: "pleins", libelle: "Pleins 12 mois", parDefaut: false, largeur: 145, alignee: "droite", tri: (p) => de(p)?.pleins ?? 0, rendu: (p) => chiffre(de(p)?.pleins) },
      { cle: "litres", libelle: "Litres 12 mois", parDefaut: false, largeur: 145, alignee: "droite", tri: (p) => de(p)?.litres ?? 0, rendu: (p) => chiffre(de(p)?.litres, (n) => `${nombre(Math.round(n))} L`) },
      { cle: "documents", libelle: "Documents émis", parDefaut: false, largeur: 155, alignee: "droite", tri: (p) => de(p)?.documents ?? 0, rendu: (p) => chiffre(de(p)?.documents) },
      { cle: "visites", libelle: "Visites techniques", parDefaut: false, largeur: 165, alignee: "droite", tri: (p) => de(p)?.visites ?? 0, rendu: (p) => chiffre(de(p)?.visites) },
      { cle: "premiere", libelle: "Première activité", parDefaut: false, largeur: 155, tri: (p) => de(p)?.premiere ?? null, rendu: (p) => (de(p)?.premiere ? <span className="code">{dateCourte(de(p)!.premiere!)}</span> : rien) },
      { cle: "anciennete", libelle: "Ancienneté", parDefaut: false, largeur: 135, alignee: "droite", tri: (p) => de(p)?.anciennete ?? null, rendu: (p) => chiffre(de(p)?.anciennete, (n) => `${n} mois`) },

      /* ---- Ce que valent ses services ---- */
      { cle: "evaluations", libelle: "Évaluations", parDefaut: false, largeur: 135, alignee: "droite", tri: (p) => de(p)?.evaluations ?? 0, rendu: (p) => chiffre(de(p)?.evaluations) },
      { cle: "qualite", libelle: "Qualité", parDefaut: false, largeur: 115, alignee: "droite", tri: (p) => de(p)?.qualite ?? null, rendu: (p) => chiffre(de(p)?.qualite, (n) => `${n} / 5`) },
      { cle: "delaiNote", libelle: "Délai tenu", parDefaut: false, largeur: 135, alignee: "droite", tri: (p) => de(p)?.delai ?? null, rendu: (p) => chiffre(de(p)?.delai, (n) => `${n} / 5`) },
      { cle: "prixNote", libelle: "Prix tenu", parDefaut: false, largeur: 130, alignee: "droite", tri: (p) => de(p)?.prix ?? null, rendu: (p) => chiffre(de(p)?.prix, (n) => `${n} / 5`) },
      {
        cle: "reprises",
        libelle: "Reprises",
        parDefaut: false,
        largeur: 130,
        alignee: "droite",
        tri: (p) => de(p)?.reprises ?? 0,
        rendu: (p) => {
          const r = de(p)?.reprises ?? 0;
          return r > 0 ? <Pastille ton="vigilance">{r}</Pastille> : rien;
        },
      },
      { cle: "score", libelle: "Note sur 100", parDefaut: false, largeur: 145, alignee: "droite", tri: (p) => de(p)?.note.score ?? null, rendu: (p) => chiffre(de(p)?.note.score) },

      /* ---- Les achats passés par Sage X3 ---- */
      { cle: "demandes", libelle: "Demandes d'achat 12 mois", parDefaut: false, largeur: 205, alignee: "droite", tri: (p) => stats[p.numero]?.demandes ?? 0, rendu: (p) => chiffre(stats[p.numero]?.demandes, (n) => `${n} DA`) },
      { cle: "montantAchats", libelle: "Achats 12 mois", parDefaut: false, largeur: 155, alignee: "droite", tri: (p) => stats[p.numero]?.montant ?? 0, rendu: (p) => chiffre(stats[p.numero]?.montant, montant) },
      { cle: "enAttente", libelle: "Achats non réglés", parDefaut: false, largeur: 165, alignee: "droite", tri: (p) => stats[p.numero]?.montantEnAttente ?? 0, rendu: (p) => chiffre(stats[p.numero]?.montantEnAttente, montant) },
      { cle: "refusees", libelle: "Demandes refusées", parDefaut: false, largeur: 175, alignee: "droite", tri: (p) => stats[p.numero]?.refusees ?? 0, rendu: (p) => chiffre(stats[p.numero]?.refusees) },
      {
        cle: "delai",
        libelle: "Délai de règlement observé",
        parDefaut: false,
        largeur: 215,
        alignee: "droite",
        tri: (p) => stats[p.numero]?.delaiReglementJours ?? null,
        rendu: (p) => chiffre(stats[p.numero]?.delaiReglementJours, (n) => `${n} j`),
      },

      /* ---- La carte d'identité : elle vit sur la fiche, elle reste au choix ---- */
      { cle: "contact", libelle: "Contact", parDefaut: false, largeur: 170, rendu: (p) => <span className="block truncate">{p.contact ?? rien}</span> },
      { cle: "telephone", libelle: "Téléphone", parDefaut: false, largeur: 160, rendu: (p) => <span className="code text-[12.5px]">{p.telephone ?? "—"}</span> },
      { cle: "courriel", libelle: "Courriel", parDefaut: false, largeur: 220, rendu: (p) => (p.courriel ? <span className="block truncate">{p.courriel}</span> : rien) },
      { cle: "ville", libelle: "Ville", parDefaut: false, largeur: 130, rendu: (p) => <span className="block truncate">{p.ville ?? rien}</span> },
      { cle: "adresse", libelle: "Adresse", parDefaut: false, largeur: 230, rendu: (p) => <span className="block truncate">{p.adresse ?? rien}</span> },
      { cle: "ninea", libelle: "NINEA", parDefaut: false, largeur: 140, rendu: (p) => <span className="code text-[12px]">{p.ninea ?? "—"}</span> },
      {
        cle: "paiement",
        libelle: "Délai convenu",
        parDefaut: false,
        largeur: 145,
        alignee: "droite",
        tri: (p) => p.delaiPaiementJours,
        rendu: (p) => (p.delaiPaiementJours === null ? <span className="text-attenue">à la commande</span> : <span className="code">{p.delaiPaiementJours} j</span>),
      },
      { cle: "note", libelle: "Note", parDefaut: false, largeur: 300, rendu: (p) => <span className="block truncate">{p.note ?? rien}</span> },

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
              modifier(p);
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
    [resume, stats],
  );

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Prestataires"
        sousTitre={`${tous.length} prestataire${tous.length > 1 ? "s" : ""} · ${actifs} actif${actifs > 1 ? "s" : ""} · ${parType} type${parType > 1 ? "s" : ""} — un inactif reste lisible, mais n'est plus proposé au choix`}
        actions={
          <button type="button" onClick={nouveau} className="bouton-principal">
            <Plus className="size-4" strokeWidth={2.2} />
            Nouveau prestataire
          </button>
        }
      />
      <TableListe<Prestataire>
        ecran="prestataires"
        lignes={tous}
        cle={(p) => p.numero}
        href={(p) => `/prestataires/${p.numero}`}
        filet={(p) => ({ couleur: COULEUR_ACTIF[p.actif ? "actif" : "inactif"], libelle: p.actif ? "Actif" : "Inactif", precision: p.actif ? "Proposé au choix dans les formulaires" : "Plus proposé ; ses transactions passées restent lisibles" })}
        /* Le tableau enveloppe déjà cette cellule dans le lien vers la fiche :
           un lien de plus imbriquerait deux ancres. */
        identifiant={{ cle: "raison", libelle: "Raison sociale", largeur: 240, rendu: (p) => <span className="block truncate">{p.raisonSociale}</span> }}
        fixes={FIXES}
        colonnes={colonnes}
        filtres={FILTRES}
        champsRecherche={(p) => [p.numero, p.raisonSociale, p.contact ?? "", p.telephone ?? "", p.courriel ?? "", p.ville ?? "", p.ninea ?? "", TYPE_PRESTATAIRE[p.type], p.note ?? ""]}
        placeholderRecherche="Raison sociale, contact, ville, type…"
        libelleRecherche="Rechercher un prestataire"
        libelleUnite="prestataires"
        vide="Aucun prestataire ne correspond."
      />
    </div>
  );
}

const FIXES: ColonneListe<Prestataire>[] = [{ cle: "numero", libelle: "Réf.", parDefaut: true, largeur: 140, rendu: (p) => <Numero valeur={p.numero} /> }];
