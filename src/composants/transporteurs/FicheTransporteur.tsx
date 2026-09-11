"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, FileWarning, Info, Pencil, Phone, Truck, Users } from "lucide-react";
import { Carte, Definitions, TableauSimple } from "@/composants/interface/Carte";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { FORME_TRANSPORTEUR, MODE_REMUNERATION, type CamionTiers, type ChauffeurTiers } from "@/domaine/flotte-tierce";
import { DIMENSION, NIVEAU_TRANSPORTEUR, niveauDuScore } from "@/domaine/notation-transporteur";
import { CATEGORIE_VEHICULE } from "@/domaine/libelles";
import { REGIME_FISCAL, SOURCE_TARIF, STATUT_AFFRETEMENT, TAUX_BRS, TON_STATUT_AFFRETEMENT, UNITE_TARIF, coutAffretement, coutMiseADisposition, ecartFacturation, tonEcart, ventiler, type LigneTarif } from "@/domaine/transporteurs";
import type { FicheTransporteur as Fiche } from "@/donnees/fiche-transporteur-demo";
import { date as formaterDate, montant, montantCourt, nombre, pourcentage } from "@/lib/format";
import { Plus } from "lucide-react";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { CHAMPS } from "@/composants/transactions/champs";
import { PRODUIT_TRANSPORTE, SEUIL_ECART_PESEE, ecartPesee, semaineDe, type LigneReleve } from "@/domaine/releve-transport";
import type { ChampEdition, Creation } from "@/domaine/cloture";

/** Une livraison saisie depuis la fiche, mise à la forme du relevé. */
function fabriquerLivraison(c: Creation): LigneReleve | null {
  const v = c.valeurs as Record<string, string | undefined>;
  const date = v.date ?? "";
  if (!date) return null;
  const tonnage = Number(v.tonnage ?? 0);
  return {
    numero: c.numero,
    date,
    semaine: semaineDe(date),
    mode: "transporteur",
    transporteurNumero: null,
    transporteur: null,
    vehiculeId: null,
    /* Le camion choisi dans la flotte du transporteur : la ligne est alors
       « suivie » — elle renvoie à une immatriculation du référentiel, et non à
       une plaque notée à la volée. */
    camionTiersImmatriculation: v.camion || null,
    immatriculationLibre: null,
    chauffeurLibre: null,
    chauffeur: v.chauffeur ?? null,
    origine: "UAB",
    destination: v.destination ?? "",
    destinationTarifaire: null,
    produit: "aliment",
    tonnage: Number.isFinite(tonnage) ? tonnage : 0,
    tonnagePese: v.tonnagePese ? Number(v.tonnagePese) : null,
    bonLivraison: v.bonLivraison ?? null,
    affretementNumero: null,
  };
}

/** Une ligne de grille créée depuis la fiche — le plus souvent, une exception promue. */
function fabriquerTarif(c: Creation): LigneTarif | null {
  const v = c.valeurs as Record<string, string | undefined>;
  if (!v.destination) return null;
  const prix = Number(v.prix ?? 0);
  return {
    numero: c.numero,
    transporteurNumero: String(v.transporteurNumero ?? ""),
    transporteur: String(v.transporteur ?? ""),
    origine: v.origine ?? "UAB",
    destination: v.destination,
    categorie: null,
    unite: (v.unite as LigneTarif["unite"]) ?? "tonne",
    prix: Number.isFinite(prix) ? prix : 0,
    minimum: v.minimum ? Number(v.minimum) : null,
    debut: v.debut ?? c.date.slice(0, 10),
    fin: v.fin || null,
    source: (v.source as LigneTarif["source"]) ?? "accord-verbal",
    commentaire: v.commentaire ?? null,
  };
}

/* ============================================================================
 * La fiche d'un transporteur.
 *
 * Cinq onglets, dans l'ordre où l'on se pose les questions : qui est-il, avec
 * quoi roule-t-il, qu'a-t-il fait, à quel prix, et que lui doit-on.
 *
 * Ce que la fiche met en avant dès l'en-tête, parce que c'est ce qui décide de
 * la conversation qu'on aura avec lui : **est-il sous contrat**. Un écart de
 * facturation se conteste quand il y a un écrit, il se discute quand il n'y en
 * a pas — la question 42 en fait un sujet ouvert pour presque tout le monde.
 * ==========================================================================*/

const ONGLETS = [
  { cle: "identite", libelle: "Identité" },
  { cle: "flotte", libelle: "Flotte" },
  { cle: "livraisons", libelle: "Livraisons" },
  { cle: "activite", libelle: "Facturation" },
  { cle: "grille", libelle: "Grille tarifaire" },
  { cle: "notation", libelle: "Notation" },
] as const;

export function FicheTransporteur({ fiche, ongletInitial }: { fiche: Fiche; ongletInitial?: string }) {
  const [onglet, setOnglet] = useState<string>(ONGLETS.some((o) => o.cle === ongletInitial) ? ongletInitial! : "identite");
  const { profil, activite } = fiche;
  const chauffeurParId = new Map(fiche.chauffeurs.map((c) => [c.id, c]));
  const { surcharger, creer, demander, creations } = useEdition();
  /* La fiche prestataire se modifie **d'ici** : le transporteur est un
     prestataire, et l'agent qui corrige un téléphone ou un délai de paiement
     n'a pas à changer d'écran pour cela. La surcharge s'applique aussitôt —
     même modale, même trace que partout ailleurs. */
  const prestataire = surcharger(fiche.prestataire);
  /* Un transporteur en mise à disposition porte plus de quinze cents
     chargements sur l'année : les afficher tous d'un coup rend la table
     inutilisable et le rendu lent. On ouvre sur les trois derniers mois — la
     période qu'on contrôle — et l'historique reste à un clic. */
  const [toutLHistorique, setToutLHistorique] = useState(false);

  /* Les livraisons saisies depuis la fiche s'ajoutent à celles du relevé : la
     fiche montre ce qu'elle sait **et** ce qu'on vient d'y écrire. */
  const toutes = [...creations("transport", fabriquerLivraison), ...fiche.livraisons.map(surcharger)];
  const bornes = (() => {
    const d = new Date(`${fiche.aujourdhui}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 90);
    return d.toISOString().slice(0, 10);
  })();
  const livraisons = toutLHistorique ? toutes : toutes.filter((l) => l.date >= bornes);

  function modifierPrestataire() {
    demander({
      type: "prestataire",
      numero: prestataire.numero,
      titre: `Prestataire ${prestataire.numero} · ${prestataire.raisonSociale}`,
      valeurs: prestataire as unknown as Record<string, unknown>,
      champs: CHAMPS.prestataire,
    });
  }

  /*
   * La saisie d'une livraison choisit **dans la flotte du transporteur** —
   * demande du métier du 5 septembre 2026 : « possibilité d'associer / de
   * sélectionner le chauffeur du prestataire en renseignant une livraison ».
   * Un nom tapé à la main ne renvoie à rien : ni au téléphone qu'on compose
   * quand le camion est en route, ni au camion qu'on suit d'une semaine sur
   * l'autre. Le champ reste libre quand le transporteur n'a encore personne au
   * référentiel — on ne bloque pas une saisie parce qu'une fiche manque.
   */
  function champsLivraison(): ChampEdition[] {
    const chauffeurs = fiche.chauffeurs.filter((c) => c.actif);
    const camions = fiche.camions.filter((c) => c.actif);
    return CHAMPS.transport.map((champ) => {
      if (champ.cle === "chauffeur" && chauffeurs.length > 0) {
        return { ...champ, type: "choix" as const, options: chauffeurs.map((c) => ({ valeur: c.nom, libelle: c.telephone ? `${c.nom} · ${c.telephone}` : c.nom })) };
      }
      return champ;
    }).concat(
      camions.length > 0
        ? [
            {
              cle: "camion",
              libelle: "Camion",
              type: "choix",
              options: camions.map((c) => ({
                valeur: c.immatriculationAffichee,
                libelle: c.capaciteTonnes !== null ? `${c.immatriculationAffichee} · ${nombre(c.capaciteTonnes)} t` : c.immatriculationAffichee,
              })),
            },
          ]
        : [],
    );
  }

  /*
   * **L'exception qui devient la règle.** C'est l'idée du brainstorm du
   * 5 septembre 2026, et celle qui fait vivre une grille : une grille tarifaire
   * ne se construit pas par une négociation qui aurait tout prévu, mais par les
   * cas rencontrés. Une mission facturée hors grille porte son motif ; quand le
   * cas se répète et qu'on le juge bon, il se promeut en ligne de grille et
   * cesse d'être une exception.
   *
   * La promotion est une **création de ligne tarifaire** ordinaire — même
   * modale, même trace — pré-remplie depuis la mission. La ligne créée cite le
   * numéro de la mission dans son commentaire : c'est ce lien qui permet de
   * dire, au retour sur la fiche, quelles exceptions ont déjà été reprises.
   */
  const grilleCreee = creations("tarif", fabriquerTarif);
  const grille = [...grilleCreee, ...fiche.grille];

  const exceptions = fiche.affretements.filter((a) => a.prixExceptionnel !== null || a.complementTarif !== null);
  const promue = (numero: string) => grille.some((g) => (g.commentaire ?? "").includes(numero));

  function promouvoir(a: (typeof exceptions)[number]) {
    /* Le prix retenu : celui qui a effectivement été appliqué à la mission —
       le prix exceptionnel, ou le tarif de grille augmenté du complément. */
    const unitaire = a.prixExceptionnel ?? (a.attendu !== null && a.tonnageLivre ? Math.round(a.attendu / a.tonnageLivre) : null);
    creer({
      type: "tarif",
      titre: `Promouvoir en règle — ${a.origine} → ${a.destination}`,
      champs: [
        { cle: "origine", libelle: "Origine", type: "texte", obligatoire: true },
        { cle: "destination", libelle: "Destination", type: "texte", obligatoire: true },
        { cle: "unite", libelle: "Base", type: "choix", options: Object.entries(UNITE_TARIF).map(([valeur, d]) => ({ valeur, libelle: d.libelle })), obligatoire: true },
        ...CHAMPS.tarif,
      ],
      valeurs: {
        transporteurNumero: prestataire.numero,
        transporteur: prestataire.raisonSociale,
        origine: a.origine,
        destination: a.destination,
        unite: "tonne",
        prix: unitaire ?? "",
        debut: fiche.aujourdhui,
        source: "accord-verbal",
        commentaire: `Promotion de l'exception posée sur ${a.numero}${a.motifTarif ? ` — ${a.motifTarif}` : ""}`,
      },
    });
  }

  function ajouterLivraison() {
    /* Le chauffeur habituel du premier camion actif, s'il y en a un : c'est
       l'attelage le plus probable, et il reste modifiable. */
    const camion = fiche.camions.find((c) => c.actif) ?? null;
    const habituel = camion?.chauffeurHabituelId ? chauffeurParId.get(camion.chauffeurHabituelId) : null;
    creer({
      type: "transport",
      titre: `Nouvelle livraison — ${prestataire.raisonSociale}`,
      champs: champsLivraison(),
      valeurs: {
        date: fiche.aujourdhui,
        produit: "Aliment volaille",
        chauffeur: (habituel ?? fiche.chauffeurs.find((c) => c.actif))?.nom ?? "",
        camion: camion?.immatriculationAffichee ?? "",
      },
    });
  }

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/transporteurs?vue=transporteurs" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Transporteurs
        </Link>
      </nav>

      {/* ---- En-tête ---- */}
      <header className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-bold text-texte">
            {prestataire.raisonSociale}
            {profil.sousContrat ? <Echeance ton="favorable">Sous contrat</Echeance> : <Echeance ton="vigilance">Sans contrat écrit</Echeance>}
            {fiche.notation.niveau ? (
              <span
                className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-white"
                style={{ background: NIVEAU_TRANSPORTEUR[fiche.notation.niveau].couleur }}
                title={`${NIVEAU_TRANSPORTEUR[fiche.notation.niveau].precision} — note calculée sur ${fiche.notation.mesurees} dimensions sur 5`}
              >
                {NIVEAU_TRANSPORTEUR[fiche.notation.niveau].libelle}
                <span className="code font-bold opacity-80">{fiche.notation.score}</span>
              </span>
            ) : null}
            {!prestataire.actif ? <Pastille ton="neutre">Inactif</Pastille> : null}
          </h1>
          <p className="meta mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{FORME_TRANSPORTEUR[profil.forme].libelle}</span>
            {prestataire.ville ? <span>· {prestataire.ville}</span> : null}
            <span>
              ·{" "}
              {profil.modes
                .map((m) => MODE_REMUNERATION[m].libelle.toLowerCase())
                .join(" et ")}
            </span>
            {prestataire.delaiPaiementJours !== null ? <span>· réglé à {prestataire.delaiPaiementJours} jours</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <button type="button" onClick={modifierPrestataire} className="bouton-secondaire h-9">
            <Pencil className="size-4 text-texte-2" strokeWidth={1.7} />
            Modifier
          </button>
          <Link href={`/prestataires/${prestataire.numero}`} className="bouton-secondaire h-9">
            Voir la fiche prestataire
          </Link>
        </div>
      </header>

      {/* ---- Les chiffres qui décident ---- */}
      <div className="grid shrink-0 grid-cols-2 gap-4 xl:grid-cols-5">
        {[
          { libelle: "Missions", valeur: nombre(activite.missions), precision: "sur douze mois" },
          { libelle: "Tonnes livrées", valeur: activite.tonnes > 0 ? nombre(activite.tonnes) : "—", precision: "relevé de tonnage" },
          { libelle: "Coût", valeur: montantCourt(activite.cout), precision: "retenue comprise" },
          {
            libelle: "Coût à la tonne",
            valeur: activite.coutParTonne !== null ? montant(activite.coutParTonne) : "—",
            precision: activite.coutParTonne !== null ? "la comparaison qui compte" : "aucune tonne portée",
          },
          { libelle: "Restant dû", valeur: activite.restantDu > 0 ? montantCourt(activite.restantDu) : "—", precision: "fait, non réglé" },
        ].map((k) => (
          <div key={k.libelle} className="carte px-4 py-3">
            <p className="label-champ">{k.libelle}</p>
            <p className="code mt-1 text-[19px] font-bold text-texte">{k.valeur}</p>
            <p className="meta mt-0.5">{k.precision}</p>
          </div>
        ))}
      </div>

      {/* ---- Onglets ---- */}
      <div className="sans-barre flex shrink-0 flex-wrap items-center gap-1.5" role="tablist">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            type="button"
            role="tab"
            aria-selected={onglet === o.cle}
            onClick={() => setOnglet(o.cle)}
            className={`h-8 rounded-full px-3.5 text-[12.5px] whitespace-nowrap transition-colors ${
              onglet === o.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "bg-surface-3 font-medium text-texte-2 hover:text-texte"
            }`}
          >
            {o.libelle}
            {o.cle === "flotte" && fiche.camions.length > 0 ? <span className="ml-1.5 text-attenue">{fiche.camions.length}</span> : null}
            {o.cle === "grille" && fiche.grille.length > 0 ? <span className="ml-1.5 text-attenue">{fiche.grille.length}</span> : null}
          </button>
        ))}
      </div>

      {onglet === "identite" ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Carte titre="Identité" precision="Ce que le référentiel prestataires porte">
            <Definitions
              elements={[
                { libelle: "Raison sociale", valeur: prestataire.raisonSociale },
                { libelle: "Forme", valeur: FORME_TRANSPORTEUR[profil.forme].libelle },
                { libelle: "Régime fiscal", valeur: profil.regimeFiscal === "a-confirmer" ? <Echeance ton="vigilance">{REGIME_FISCAL[profil.regimeFiscal].libelle}</Echeance> : REGIME_FISCAL[profil.regimeFiscal].libelle },
                { libelle: "Ville", valeur: prestataire.ville ?? "—" },
                { libelle: "Contact", valeur: prestataire.contact ?? "—" },
                { libelle: "Téléphone", valeur: prestataire.telephone ?? "—" },
                { libelle: "NINEA", valeur: prestataire.ninea ?? <span className="text-attenue-2">non renseigné</span> },
              ]}
            />
            <p className="meta mt-3 border-t border-bordure pt-3">
              {FORME_TRANSPORTEUR[profil.forme].precision} {REGIME_FISCAL[profil.regimeFiscal].precision}.
            </p>
          </Carte>

          <Carte titre="Contrat et rémunération" precision="Ce qui décide de ce qu'on peut lui opposer">
            <Definitions
              elements={[
                { libelle: "Sous contrat", valeur: profil.sousContrat ? <Echeance ton="favorable">Oui</Echeance> : <Echeance ton="vigilance">Non — accord verbal</Echeance> },
                { libelle: "Référence", valeur: profil.referenceContrat ?? "—" },
                { libelle: "Depuis", valeur: profil.debutContrat ? formaterDate(profil.debutContrat) : "—" },
                { libelle: "Camions engagés", valeur: profil.camionsEngages !== null ? nombre(profil.camionsEngages) : "—" },
              ]}
            />
            <ul className="mt-3 flex flex-col gap-2 border-t border-bordure pt-3">
              {profil.modes.map((m) => (
                <li key={m} className="flex items-baseline gap-2.5">
                  <Echeance ton={MODE_REMUNERATION[m].ton}>{MODE_REMUNERATION[m].libelle}</Echeance>
                  <span className="meta min-w-0 flex-1">{MODE_REMUNERATION[m].precision}</span>
                </li>
              ))}
            </ul>
            {profil.commentaire ? (
              <p className="mt-3 flex items-start gap-2 rounded-[10px] bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-texte-2">
                <FileWarning className="mt-0.5 size-3.5 shrink-0 text-attenue" strokeWidth={1.9} />
                {profil.commentaire}
              </p>
            ) : null}
          </Carte>
        </div>
      ) : null}

      {onglet === "flotte" ? (
        <div className="flex flex-col gap-5">
          <Carte
            titre="Camions"
            precision={
              fiche.capaciteTonnes !== null
                ? `${fiche.camions.length} camions identifiés · ${nombre(fiche.capaciteTonnes)} tonnes de capacité cumulée — relevé hebdomadaire de la Direction des Opérations`
                : `${fiche.camions.length} camions identifiés — capacités non relevées`
            }
            sansMarge
          >
            <TableauSimple<CamionTiers>
              reglages="transporteur.camions"
              cle={(c) => c.immatriculation}
              lignes={fiche.camions}
              ajustable
              filtrable={fiche.camions.length > 6}
              vide="Aucun camion identifié pour ce transporteur."
              colonnes={[
                { cle: "immat", libelle: "Immatriculation", rendu: (c) => <span className="code font-semibold text-accent-fonce">{c.immatriculationAffichee}</span> },
                { cle: "categorie", libelle: "Type", rendu: (c) => CATEGORIE_VEHICULE[c.categorie] },
                {
                  cle: "capacite",
                  libelle: "Capacité",
                  alignee: "droite",
                  rendu: (c) => (c.capaciteTonnes !== null ? <span className="code">{nombre(c.capaciteTonnes)} t</span> : <span className="text-attenue">—</span>),
                },
                {
                  cle: "chauffeur",
                  libelle: "Chauffeur habituel",
                  rendu: (c) => {
                    const ch = c.chauffeurHabituelId ? chauffeurParId.get(c.chauffeurHabituelId) : null;
                    return ch ? <span className="block truncate">{ch.nom}</span> : <span className="text-attenue">—</span>;
                  },
                },
                {
                  cle: "tel",
                  libelle: "Téléphone",
                  rendu: (c) => {
                    const ch = c.chauffeurHabituelId ? chauffeurParId.get(c.chauffeurHabituelId) : null;
                    return ch?.telephone ? <span className="code">{formaterTelephone(ch.telephone)}</span> : <span className="text-attenue">—</span>;
                  },
                },
                { cle: "etat", libelle: "État", rendu: (c) => (c.actif ? <Echeance ton="favorable">Actif</Echeance> : <Pastille ton="neutre">Retiré</Pastille>) },
                { cle: "commentaire", libelle: "Commentaire", parDefaut: false, rendu: (c) => <span className="block truncate text-texte-2">{c.commentaire ?? "—"}</span> },
              ]}
            />
          </Carte>

          <Carte titre="Chauffeurs" precision="Le téléphone est la donnée la plus utile : c'est par lui que l'exploitation joint le camion en route" sansMarge>
            <TableauSimple<ChauffeurTiers>
              reglages="transporteur.chauffeurs"
              cle={(c) => c.id}
              lignes={fiche.chauffeurs}
              ajustable
              filtrable={fiche.chauffeurs.length > 6}
              vide="Aucun chauffeur identifié."
              colonnes={[
                { cle: "nom", libelle: "Chauffeur", rendu: (c) => <span className="block truncate font-medium text-texte">{c.nom}</span> },
                {
                  cle: "tel",
                  libelle: "Téléphone",
                  rendu: (c) =>
                    c.telephone ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-3.5 shrink-0 text-attenue" strokeWidth={1.8} />
                        <span className="code">{formaterTelephone(c.telephone)}</span>
                      </span>
                    ) : (
                      <span className="text-attenue">—</span>
                    ),
                },
                {
                  cle: "camion",
                  libelle: "Camion habituel",
                  rendu: (c) => {
                    const camion = fiche.camions.find((x) => x.chauffeurHabituelId === c.id);
                    return camion ? <span className="code">{camion.immatriculationAffichee}</span> : <span className="text-attenue">—</span>;
                  },
                },
                { cle: "etat", libelle: "État", rendu: (c) => (c.actif ? <Echeance ton="favorable">Actif</Echeance> : <Pastille ton="neutre">Retiré</Pastille>) },
              ]}
            />
          </Carte>
        </div>
      ) : null}

      {onglet === "livraisons" ? (
        <div className="flex flex-col gap-5">
          <div className="carte flex items-start gap-3 px-4 py-3 text-[13px] leading-relaxed text-texte-2">
            <Info className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.9} />
            <span>
              Le <strong className="font-semibold text-texte">relevé de transport</strong> de ce transporteur : ce qu&apos;il a chargé, avec quel camion, pour quelle destination et combien de tonnes.
              C&apos;est la maille que la Direction des Opérations tient à la semaine, et celle qui donne le coût à la tonne. Les analyses d&apos;ensemble — tonnages, taux d&apos;externalisation,
              comparaison au parc — se lisent dans <Link href="/rapports/transport-releve" className="font-medium text-accent-fonce hover:text-accent">Rapports</Link>.
            </span>
          </div>

          <Carte
            titre="Livraisons"
            precision={
              toutLHistorique
                ? `${toutes.length} chargements sur douze mois · le tonnage retenu est celui du pont bascule quand il existe`
                : `${livraisons.length} chargements sur les trois derniers mois, sur ${toutes.length} au total`
            }
            action={
              <span className="flex items-center gap-2.5">
                {toutes.length > livraisons.length || toutLHistorique ? (
                  <button type="button" onClick={() => setToutLHistorique((o) => !o)} className="bouton-secondaire h-9">
                    {toutLHistorique ? "Trois derniers mois" : "Tout l'historique"}
                  </button>
                ) : null}
                <button type="button" onClick={ajouterLivraison} className="bouton-secondaire h-9">
                  <Plus className="size-4" strokeWidth={2} />
                  Nouvelle livraison
                </button>
              </span>
            }
            sansMarge
          >
            <TableauSimple<LigneReleve>
              reglages="transporteur.livraisons"
              cle={(l) => l.numero}
              lignes={livraisons}
              numero={(l) => l.numero}
              surModifier={(l) => demander({ type: "transport", numero: l.numero, titre: `Livraison ${l.numero}`, valeurs: l as unknown as Record<string, unknown> })}
              ajustable
              vide="Aucune livraison relevée pour ce transporteur."
              colonnes={[
                { cle: "date", libelle: "Date", rendu: (l) => <span className="code">{formaterDate(l.date)}</span> },
                { cle: "semaine", libelle: "Semaine", parDefaut: false, rendu: (l) => <span className="code">{l.semaine}</span> },
                { cle: "camion", libelle: "Camion", rendu: (l) => <span className="code">{l.camionTiersImmatriculation ?? l.immatriculationLibre ?? "—"}</span> },
                { cle: "chauffeur", libelle: "Chauffeur", rendu: (l) => <span className="block truncate">{l.chauffeur ?? "—"}</span> },
                { cle: "destination", libelle: "Destination", rendu: (l) => <span className="block truncate font-medium text-texte">{l.destination}</span> },
                {
                  cle: "tarifaire",
                  libelle: "Destination tarifaire",
                  parDefaut: false,
                  rendu: (l) =>
                    l.destinationTarifaire && l.destinationTarifaire !== l.destination ? <span className="text-texte-2">{l.destinationTarifaire}</span> : <span className="text-attenue">—</span>,
                },
                { cle: "produit", libelle: "Produit", rendu: (l) => PRODUIT_TRANSPORTE[l.produit].libelle },
                { cle: "tonnage", libelle: "Annoncé", alignee: "droite", rendu: (l) => <span className="code">{nombre(l.tonnage)} t</span> },
                { cle: "pese", libelle: "Pesé", alignee: "droite", rendu: (l) => (l.tonnagePese !== null ? <span className="code font-medium">{nombre(l.tonnagePese)} t</span> : <span className="text-attenue">—</span>) },
                {
                  cle: "ecart",
                  libelle: "Écart de pesée",
                  alignee: "droite",
                  rendu: (l) => {
                    const e = ecartPesee(l);
                    if (e === null) return <span className="text-attenue">—</span>;
                    return Math.abs(e) > SEUIL_ECART_PESEE ? (
                      <Echeance ton="vigilance">
                        {e > 0 ? "+" : ""}
                        {pourcentage(e, 1)}
                      </Echeance>
                    ) : (
                      <span className="code text-texte-2">
                        {e > 0 ? "+" : ""}
                        {pourcentage(e, 1)}
                      </span>
                    );
                  },
                },
                { cle: "bl", libelle: "Bon de livraison", parDefaut: false, rendu: (l) => <span className="code">{l.bonLivraison ?? "—"}</span> },
                { cle: "affretement", libelle: "Affrètement", parDefaut: false, rendu: (l) => (l.affretementNumero ? <span className="code text-accent-fonce">{l.affretementNumero}</span> : <Pastille ton="neutre">Non facturable</Pastille>) },
              ]}
            />
          </Carte>
        </div>
      ) : null}

      {onglet === "activite" ? (
        <div className="flex flex-col gap-5">
          {activite.subies > 0 ? (
            <div className="carte flex items-start gap-3 border-l-[3px] border-l-vigilance px-4 py-3 text-[13px] leading-relaxed text-texte-2">
              <Truck className="mt-0.5 size-4 shrink-0 text-vigilance" strokeWidth={1.9} />
              <span>
                <strong className="font-semibold text-texte">{activite.subies} missions subies</strong> — confiées faute de véhicule disponible ou pour cause d&apos;immobilisation. Elles ne se
                corrigent pas en négociant un tarif, mais en réparant le parc.
              </span>
            </div>
          ) : null}

          <Carte titre="Affrètements" precision={`${fiche.affretements.length} missions au voyage · l'écart se mesure sur le net, au regard de la grille`} sansMarge>
            <TableauSimple<(typeof fiche.affretements)[number]>
              reglages="transporteur.affretements"
              cle={(a) => a.numero}
              lignes={fiche.affretements}
              numero={(a) => a.numero}
              ajustable
              vide="Aucun affrètement sur la période."
              colonnes={[
                { cle: "numero", libelle: "Réf.", rendu: (a) => <span className="code text-accent-fonce">{a.numero}</span> },
                { cle: "date", libelle: "Date", rendu: (a) => <span className="code">{formaterDate(a.date)}</span> },
                { cle: "trajet", libelle: "Trajet", rendu: (a) => <span className="block truncate">{a.origine} → {a.destination}</span> },
                { cle: "tonnage", libelle: "Tonnage", alignee: "droite", rendu: (a) => <span className="code">{nombre(a.tonnageLivre ?? a.tonnagePrevu)} t</span> },
                { cle: "du", libelle: "Dû net", alignee: "droite", rendu: (a) => (a.attendu === null ? <span className="text-attenue">—</span> : <span className="code">{montant(a.attendu)}</span>) },
                { cle: "cout", libelle: "Coût HT", alignee: "droite", rendu: (a) => <span className="code font-medium">{montant(coutAffretement(a))}</span> },
                { cle: "ttc", libelle: "TTC", alignee: "droite", rendu: (a) => <span className="code">{montant(ventiler(coutAffretement(a), a.regime).ttc)}</span> },
                {
                  cle: "ecart",
                  libelle: "Écart",
                  alignee: "droite",
                  rendu: (a) => {
                    const e = ecartFacturation(a, a.attendu);
                    if (!e) return <span className="text-attenue">—</span>;
                    return (
                      <Echeance ton={tonEcart(e)}>
                        {e.pct > 0 ? "+" : ""}
                        {pourcentage(e.pct, 1)}
                      </Echeance>
                    );
                  },
                },
                { cle: "statut", libelle: "Étape", rendu: (a) => <Echeance ton={TON_STATUT_AFFRETEMENT[a.statut]}>{STATUT_AFFRETEMENT[a.statut]}</Echeance> },
                { cle: "camion", libelle: "Camion du tiers", parDefaut: false, rendu: (a) => <span className="code">{a.immatriculationExterne ?? "—"}</span> },
                { cle: "chauffeur", libelle: "Chauffeur", parDefaut: false, rendu: (a) => a.chauffeurExterne ?? "—" },
              ]}
            />
          </Carte>

          {fiche.misesADisposition.length > 0 ? (
            <Carte titre="Mises à disposition" precision="Payées à la journée — six jours sur sept, carburant servi à la cuve SEDIMA" sansMarge>
              <TableauSimple<(typeof fiche.misesADisposition)[number]>
                reglages="transporteur.mad"
                cle={(m) => m.numero}
                lignes={fiche.misesADisposition}
                ajustable
                colonnes={[
                  { cle: "mois", libelle: "Mois", rendu: (m) => <span className="code">{m.mois}</span> },
                  { cle: "immat", libelle: "Camion", rendu: (m) => <span className="code">{m.immatriculation}</span> },
                  { cle: "jours", libelle: "Jours dus", alignee: "droite", rendu: (m) => <span className="code">{m.joursCalendaires - m.joursPanne}</span> },
                  { cle: "roules", libelle: "Jours roulés", alignee: "droite", rendu: (m) => <span className="code">{m.joursRoules ?? "—"}</span> },
                  { cle: "tonnes", libelle: "Tonnes", alignee: "droite", rendu: (m) => (m.tonnesTransportees !== null ? <span className="code">{nombre(m.tonnesTransportees)}</span> : <span className="text-attenue">—</span>) },
                  { cle: "cout", libelle: "Location HT", alignee: "droite", rendu: (m) => <span className="code font-medium">{montant(coutMiseADisposition(m).location)}</span> },
                  { cle: "ttc", libelle: "TTC", alignee: "droite", rendu: (m) => <span className="code">{montant(ventiler(coutMiseADisposition(m).location, m.regime).ttc)}</span> },
                ]}
              />
            </Carte>
          ) : null}
        </div>
      ) : null}

      {onglet === "notation" ? (
        <div className="flex flex-col gap-5">
          <div className="carte flex items-start gap-3 px-4 py-3 text-[13px] leading-relaxed text-texte-2">
            <Info className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.9} />
            <span>
              <strong className="font-semibold text-texte">Rien ne se saisit ici.</strong> Les cinq dimensions se calculent sur des faits déjà enregistrés — factures, grilles, relevé de tonnage,
              contrats. Une notation à la main se remplit trois mois puis plus personne ne la tient ; une notation calculée est toujours à jour et, surtout,{" "}
              <strong className="font-semibold text-texte">elle se conteste</strong> : le transporteur à qui l&apos;on dit « vous facturez 7 % au-dessus de la grille » peut vérifier.
              {fiche.notation.mesurees < 5 ? (
                <>
                  {" "}
                  Sur cette fiche, <strong className="font-semibold text-texte">{fiche.notation.mesurees} dimensions sur 5</strong> ont pu être mesurées ; la note ne porte que sur celles-là.
                </>
              ) : null}
            </span>
          </div>

          <Carte
            titre="Notation"
            precision={
              fiche.notation.niveau
                ? `${NIVEAU_TRANSPORTEUR[fiche.notation.niveau].libelle} · ${fiche.notation.score} sur 100 · ${NIVEAU_TRANSPORTEUR[fiche.notation.niveau].precision}`
                : "Aucune dimension mesurable sur la période — on ne note pas au hasard"
            }
            sansMarge
          >
            <ul className="flex flex-col">
              {fiche.notation.dimensions.map((d) => (
                <li key={d.cle} className="flex flex-wrap items-center gap-4 border-b border-bordure px-5 py-3.5 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium text-texte">{DIMENSION[d.cle].libelle}</span>
                      <span className="meta">poids {DIMENSION[d.cle].poids} %</span>
                    </span>
                    <span className="meta mt-0.5 block">{d.constat}</span>
                  </span>
                  <span className="w-[220px] shrink-0">
                    {d.score === null ? (
                      <span className="meta">non mesurée</span>
                    ) : (
                      <span className="flex items-center gap-2.5">
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <span className="block h-full rounded-full" style={{ width: `${Math.max(2, d.score)}%`, background: NIVEAU_TRANSPORTEUR[niveauDuScore(d.score)].couleur }} />
                        </span>
                        <span className="code w-[34px] text-right text-[12.5px] font-semibold text-texte">{d.score}</span>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Carte>

          <Carte titre="Ce que la note ne dit pas" precision="À assumer plutôt qu'à masquer">
            <p className="text-[13px] leading-relaxed text-texte-2">
              La ponctualité, l&apos;état des camions, la tenue des chauffeurs, la souplesse un jour de pointe : ce sont des jugements, ils demanderaient une saisie, et il reste à trancher{" "}
              <strong className="font-semibold text-texte">qui la ferait et à quelle occasion</strong> — au retour de chaque mission, ou une fois par mois en revue. Tant que ce n&apos;est pas décidé,
              la note porte sur ce qui se mesure, et elle le dit.
            </p>
          </Carte>
        </div>
      ) : null}

      {onglet === "grille" ? (
        <div className="flex flex-col gap-5">
        <Carte
          titre="Grille tarifaire"
          precision={
            grille.length > 0
              ? `${grille.length} lignes · les prix sont nets ; la facture les majore de ${pourcentage(TAUX_BRS * 100, 0)} de retenue à la source`
              : "Aucune ligne de grille — les prix se conviennent au coup par coup"
          }
          sansMarge
        >
          <TableauSimple<(typeof grille)[number]>
            reglages="transporteur.grille"
            cle={(g) => g.numero}
            lignes={grille}
            ajustable
            vide="Aucune grille enregistrée pour ce transporteur."
            colonnes={[
              { cle: "trajet", libelle: "Trajet", rendu: (g) => <span className="block truncate">{g.origine} → {g.destination}</span> },
              { cle: "unite", libelle: "Base", rendu: (g) => UNITE_TARIF[g.unite].libelle },
              {
                cle: "prix",
                libelle: "Prix net",
                alignee: "droite",
                rendu: (g) => (
                  <span className="code font-medium">
                    {nombre(g.prix)} <span className="text-attenue">{UNITE_TARIF[g.unite].suffixe}</span>
                  </span>
                ),
              },
              { cle: "source", libelle: "Source", rendu: (g) => <Echeance ton={SOURCE_TARIF[g.source].ton}>{SOURCE_TARIF[g.source].libelle}</Echeance> },
              { cle: "debut", libelle: "En vigueur depuis", rendu: (g) => <span className="code">{formaterDate(g.debut)}</span> },
              { cle: "commentaire", libelle: "Commentaire", parDefaut: false, rendu: (g) => <span className="block truncate text-texte-2">{g.commentaire ?? "—"}</span> },
            ]}
          />
        </Carte>

        {/* ---- Les exceptions posées, et ce qu'on en fait ---- */}
        <Carte
          titre="Les exceptions tarifaires"
          precision="Les missions facturées hors grille. Une exception jugée bonne se promeut en ligne de grille : c'est ainsi qu'une grille se construit — par les cas rencontrés, non par une négociation qui aurait tout prévu."
          sansMarge
        >
          <TableauSimple<(typeof exceptions)[number]>
            reglages="transporteur.exceptions"
            cle={(a) => a.numero}
            lignes={exceptions}
            numero={(a) => a.numero}
            ajustable
            vide="Aucune exception tarifaire sur ce transporteur — la grille et les rattachements ont suffi."
            colonnes={[
              { cle: "date", libelle: "Date", rendu: (a) => <span className="code">{formaterDate(a.date)}</span> },
              { cle: "trajet", libelle: "Trajet", rendu: (a) => <span className="block truncate">{a.origine} → {a.destination}</span> },
              {
                cle: "forme",
                libelle: "Forme",
                rendu: (a) => (a.prixExceptionnel !== null ? <Pastille ton="vigilance">Prix exceptionnel</Pastille> : <Pastille ton="neutre">Complément</Pastille>),
              },
              {
                cle: "montant",
                libelle: "Montant",
                alignee: "droite",
                rendu: (a) =>
                  a.prixExceptionnel !== null ? (
                    <span className="code font-medium">
                      {nombre(a.prixExceptionnel)} <span className="text-attenue">F/t</span>
                    </span>
                  ) : (
                    <span className="code font-medium">+ {montant(a.complementTarif ?? 0)}</span>
                  ),
              },
              { cle: "motif", libelle: "Motif", rendu: (a) => <span className="block truncate">{a.motifTarif ?? <span className="text-attenue-2">non renseigné</span>}</span> },
              {
                cle: "etat",
                libelle: "État",
                rendu: (a) => (promue(a.numero) ? <Echeance ton="favorable">Promue en règle</Echeance> : <Echeance ton="vigilance">Exception</Echeance>),
              },
              {
                cle: "action",
                libelle: "Action",
                rendu: (a) =>
                  promue(a.numero) ? (
                    <span className="text-attenue-2">—</span>
                  ) : (
                    <button type="button" onClick={() => promouvoir(a)} className="bouton-discret h-7 px-2 text-[12px]">
                      <ArrowUpRight className="size-3.5" strokeWidth={1.8} />
                      Promouvoir en règle
                    </button>
                  ),
              },
            ]}
          />
          <p className="meta px-5 py-3">
            La promotion crée une ligne de grille, datée d&apos;aujourd&apos;hui, qui cite la mission d&apos;origine dans son commentaire. Rien n&apos;est réécrit rétroactivement : les missions
            passées gardent le prix qui leur a été appliqué.
          </p>
        </Carte>
        </div>
      ) : null}
    </div>
  );
}

/** « 774566779 » → « 77 456 67 79 » : le format sénégalais, lisible d'un coup. */
function formaterTelephone(brut: string): string {
  const n = brut.replace(/\D/g, "");
  if (n.length !== 9) return brut;
  return `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}

/** Le pictogramme des chauffeurs, exporté pour la liste. */
export const IconeChauffeurs = Users;
