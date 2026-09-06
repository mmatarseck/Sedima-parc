"use client";

import { useEffect, useState } from "react";
import { Ban, Check, Lock, X } from "lucide-react";
import { Numero } from "@/composants/interface/Numero";
import { Echeance } from "@/composants/interface/Pastille";
import { champsCreation } from "@/composants/transactions/champs";
import {
  attenteDe,
  ETAPE_ACHAT,
  circuitDe,
  coutDe,
  NATURE_COUT,
  originePorteLeCout,
  prochaineEtape,
  roleAttendu,
  SEUIL_VALIDATION_DIRECTION,
  TON_ETAPE_ACHAT,
  URGENCE_ACHAT,
  type EtapeAchat,
  type LigneAchat,
} from "@/domaine/caisse";
import type { ChampEdition } from "@/domaine/cloture";
import { POSTE_DEPENSE } from "@/domaine/libelles";
import { ROLES, trouverRole } from "@/domaine/roles";
import { fabriquerPrestataire, listePrestataires, optionsPrestatairesParNumero, prestatairePour } from "@/donnees/prestataires-demo";
import { enregistrerCreation, enregistrerModification, lireCreations } from "@/lib/clotures-demo";
import { montant as formaterMontant, date as formaterDate } from "@/lib/format";
import { ajouterNotification } from "@/lib/notifications-demo";
import { lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Décision sur une demande d'achat.
 *
 * Le circuit ne se saisit pas dans un champ « étape » : on vise, on valide, on
 * commande, on constate la livraison, la facture, le règlement — ou l'on
 * refuse — et chaque geste est une modification tracée de la demande, avec
 * son motif, comme toute autre transaction de l'application. La personne
 * attendue à l'étape suivante est prévenue ; à la fin du circuit, ou en cas de
 * refus, c'est le demandeur.
 *
 * Les étapes d'après la validation sont **constatées depuis Sage X3**, où vit
 * le processus d'achat : on ne relève ici qu'une référence, une date ou un
 * montant — jamais le détail que X3 tient déjà.
 * ==========================================================================*/

/** Les champs que la décision touche — ceux que l'historique montrera. */
function champsDecision(): ChampEdition[] {
  return [
    { cle: "etape", libelle: "Étape", type: "choix", options: Object.entries(ETAPE_ACHAT).map(([valeur, libelle]) => ({ valeur, libelle })) },
    { cle: "visaPar", libelle: "Visa du parc", type: "texte" },
    { cle: "visaLe", libelle: "Visé le", type: "date" },
    { cle: "validePar", libelle: "Validée par", type: "texte" },
    { cle: "valideeLe", libelle: "Validée le", type: "date" },
    { cle: "numeroDemandeX3", libelle: "N° de DA Sage X3", type: "texte" },
    { cle: "numeroBonCommande", libelle: "Bon de commande Sage X3", type: "texte" },
    { cle: "prestataireNumero", libelle: "Fournisseur (réf. PRE)", type: "texte" },
    { cle: "fournisseur", libelle: "Fournisseur", type: "texte" },
    { cle: "montantEngage", libelle: "Montant engagé", type: "nombre", unite: "F" },
    { cle: "dateLivraison", libelle: "Livrée le", type: "date" },
    { cle: "dateFacture", libelle: "Facturée le", type: "date" },
    { cle: "montantReel", libelle: "Montant facturé", type: "nombre", unite: "F" },
    { cle: "dateReglement", libelle: "Réglée le", type: "date" },
    { cle: "depenseNumero", libelle: "Dépense du véhicule (réf.)", type: "texte" },
    { cle: "commentaireDecision", libelle: "Commentaire de décision", type: "texte-long" },
  ];
}

const VERBE: Record<EtapeAchat, string> = {
  soumise: "Soumettre",
  visee: "Viser",
  validee: "Valider",
  commandee: "Commander",
  livree: "Constater la livraison",
  facturee: "Enregistrer la facture",
  reglee: "Constater le règlement",
  refusee: "Refuser",
};

function nombreDe(texte: string): number {
  return Number(texte.replace(/\s/g, "").replace(",", ".")) || 0;
}

export function ModaleDecision({ ligne, aujourdhui, onFermer, onEnregistre }: { ligne: LigneAchat; aujourdhui: string; onFermer: () => void; onEnregistre: () => void }) {
  const suivante = prochaineEtape(ligne);
  const [commentaire, setCommentaire] = useState("");
  const [daX3, setDaX3] = useState(ligne.numeroDemandeX3 ?? "");
  const [bonCommande, setBonCommande] = useState(ligne.numeroBonCommande ?? "");
  /* À la commande, le fournisseur se choisit dans le référentiel — le nom
     pressenti de la demande le propose — et le montant du bon remplace
     l'estimation. C'est ce qui rend les statistiques par prestataire possibles. */
  const [prestataire, setPrestataire] = useState(ligne.prestataireNumero ?? "");
  const [montantEngage, setMontantEngage] = useState(String(ligne.montantEngage ?? ligne.montantEstime));
  const [dateEtape, setDateEtape] = useState(aujourdhui);
  const [montantReel, setMontantReel] = useState(String(ligne.montantReel ?? ligne.montantEngage ?? ligne.montantEstime));
  const [optionsFournisseurs, setOptionsFournisseurs] = useState<{ valeur: string; libelle: string }[]>([]);
  const [issue, setIssue] = useState<"faite" | "en-attente" | null>(null);
  const [role, setRole] = useState(trouverRole(null));

  useEffect(() => {
    setRole(trouverRole(lireRole()));
    setOptionsFournisseurs(optionsPrestatairesParNumero(lireCreations));
    if (!ligne.prestataireNumero) {
      const connus = [...lireCreations("prestataires").filter((c) => c.type === "prestataire").map(fabriquerPrestataire), ...listePrestataires()];
      setPrestataire(prestatairePour(ligne.fournisseur, connus)?.numero ?? "");
    }
  }, [ligne.fournisseur, ligne.prestataireNumero]);

  useEffect(() => {
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("keydown", surEchap);
    return () => document.removeEventListener("keydown", surEchap);
  }, [onFermer]);

  const circuit = circuitDe(ligne.montantEstime);
  const motifSuffisant = commentaire.trim().length >= 3;
  const manqueBc = suivante === "commandee" && bonCommande.trim().length < 3;
  const manqueFournisseur = suivante === "commandee" && !prestataire;
  const manqueMontant = (suivante === "commandee" && nombreDe(montantEngage) <= 0) || (suivante === "facturee" && nombreDe(montantReel) <= 0);
  const manqueDate = (suivante === "livree" || suivante === "facturee" || suivante === "reglee") && !dateEtape;
  const bloquee = manqueBc || manqueFournisseur || manqueMontant || manqueDate;
  const cout = coutDe(ligne);

  function decider(cible: EtapeAchat) {
    if (!motifSuffisant || issue !== null) return;
    if (cible !== "refusee" && bloquee) return;
    const apres: Record<string, unknown> = {
      etape: cible,
      visaPar: ligne.visaPar,
      visaLe: ligne.visaLe,
      validePar: ligne.validePar,
      valideeLe: ligne.valideeLe,
      numeroDemandeX3: ligne.numeroDemandeX3,
      numeroBonCommande: ligne.numeroBonCommande,
      prestataireNumero: ligne.prestataireNumero,
      fournisseur: ligne.fournisseur,
      montantEngage: ligne.montantEngage,
      dateLivraison: ligne.dateLivraison,
      dateFacture: ligne.dateFacture,
      montantReel: ligne.montantReel,
      dateReglement: ligne.dateReglement,
      depenseNumero: ligne.depenseNumero,
      commentaireDecision: commentaire.trim(),
    };
    if (cible === "visee") {
      apres.visaPar = role.nom;
      apres.visaLe = aujourdhui;
      if (daX3.trim()) apres.numeroDemandeX3 = daX3.trim();
    }
    if (cible === "validee") {
      apres.validePar = role.nom;
      apres.valideeLe = aujourdhui;
    }
    if (cible === "commandee") {
      apres.numeroBonCommande = bonCommande.trim();
      apres.prestataireNumero = prestataire;
      apres.fournisseur = optionsFournisseurs.find((o) => o.valeur === prestataire)?.libelle.split(" · ")[0] ?? ligne.fournisseur;
      apres.montantEngage = nombreDe(montantEngage);
      /* Sous le seuil, le visa du parc vaut accord : personne n'a « validé »,
         et la trace doit le dire plutôt que de laisser un blanc ambigu. */
      if (!ligne.validePar) apres.validePar = `${role.nom} — sous le seuil`;
    }
    if (cible === "livree") apres.dateLivraison = dateEtape;
    if (cible === "facturee") {
      apres.dateFacture = dateEtape;
      apres.montantReel = nombreDe(montantReel);
    }
    if (cible === "reglee") apres.dateReglement = dateEtape;

    /* Le coût réel doit se retrouver sur le véhicule. Si la transaction
       d'origine porte déjà la dépense (une intervention, un document), c'est
       elle ; sinon — une observation, un incident — la facturation crée la
       dépense DEP sur la fiche, au montant facturé. */
    if (cible === "facturee" && !ligne.depenseNumero) {
      if (originePorteLeCout(ligne.origineNumero)) apres.depenseNumero = ligne.origineNumero;
      else if (ligne.vehiculeId) {
        const champsDepense = champsCreation("depense", { pour: "vehicule" });
        const creation = enregistrerCreation({
          sujet: `vehicule:${ligne.vehiculeId}`,
          type: "depense",
          champs: champsDepense,
          valeurs: { poste: ligne.poste, origine: "bon-de-commande", date: dateEtape, libelle: ligne.objet, montant: nombreDe(montantReel), beneficiaire: apres.fournisseur ?? ligne.fournisseur, reference: ligne.numeroBonCommande, justificatif: true },
          motif: `Facture de la demande d'achat ${ligne.numero}`,
        });
        if (creation.issue === "creee") apres.depenseNumero = creation.creation.numero;
      }
    }

    const champs = champsDecision();
    const resultat = enregistrerModification({
      numero: ligne.numero,
      type: "achat",
      titre: `Demande d'achat ${ligne.numero} · ${ligne.objet}`,
      href: `/caisse?vue=achats&ref=${ligne.numero}`,
      champs,
      avant: ligne as unknown as Record<string, unknown>,
      apres,
      motif: commentaire.trim(),
    });

    if (resultat.issue === "rien") return;
    if (resultat.issue === "en-attente") {
      setIssue("en-attente");
      onEnregistre();
      setTimeout(onFermer, 1600);
      return;
    }

    /* Prévenir : celui qu'on attend ensuite, ou le demandeur quand c'est fini. */
    const destinataire = cible === "refusee" || cible === "reglee" ? ligne.demandeurRole : roleAttendu({ etape: cible, montantEstime: ligne.montantEstime });
    const def = destinataire ? ROLES.find((r) => r.role === destinataire) : null;
    if (def && def.role !== role.role) {
      ajouterNotification(def.role, {
        id: `da-${ligne.numero}-${cible}-${Date.now().toString(36)}`,
        date: new Date().toISOString(),
        auteur: role.nom,
        initiales: role.initiales,
        sujetLibelle: `Demande d'achat ${ligne.numero}`,
        extrait:
          cible === "refusee"
            ? `Refusée — ${commentaire.trim()}`
            : cible === "reglee"
              ? `Réglée le ${formaterDate(dateEtape)} — ${ligne.objet} (${formaterMontant(nombreDe(montantReel) || cout.montant)})`
              : /* Le destinataire ne veut pas savoir l'étape atteinte, mais ce
                   qu'on attend de lui. */
                `${attenteDe({ etape: cible, montantEstime: ligne.montantEstime })} — ${ligne.objet} (${formaterMontant(ligne.montantEstime)})`,
        href: `/caisse?vue=achats&ref=${ligne.numero}`,
      });
    }

    setIssue("faite");
    onEnregistre();
    setTimeout(onFermer, 1400);
  }

  const champDate = (libelle: string) => (
    <label className="mt-5 flex flex-col gap-1.5">
      <span className="label-champ">
        {libelle} <span className="text-defavorable">●</span>
      </span>
      <input type="date" value={dateEtape} max={aujourdhui} onChange={(e) => setDateEtape(e.target.value)} className="code h-9 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent" />
    </label>
  );

  return (
    <>
      <button type="button" aria-label="Fermer" onClick={onFermer} className="fixed inset-0 z-50 cursor-default bg-encre/30" />
      <div role="dialog" aria-modal="true" aria-label={`Décider de la demande ${ligne.numero}`} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="pointer-events-auto flex max-h-[92vh] w-full max-w-[600px] flex-col overflow-hidden rounded-[16px] border border-bordure bg-surface shadow-modale" style={{ animation: "apparition 160ms ease-out" }}>
          <div className="flex items-start gap-3 border-b border-bordure px-6 py-4">
            <div className="min-w-0 flex-1">
              <p className="micro-sur-titre">Demande d&apos;achat · décision</p>
              <h2 className="titre-bloc mt-0.5 truncate">{ligne.objet}</h2>
              <p className="mt-1">
                <Numero valeur={ligne.numero} />
              </p>
            </div>
            <button type="button" onClick={onFermer} className="grid size-8 shrink-0 place-items-center rounded-full text-texte-2 hover:bg-surface-3 hover:text-texte">
              <X className="size-4" strokeWidth={1.8} />
              <span className="sr-only">Fermer</span>
            </button>
          </div>

          <div className="defilement-discret min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {/* ---- Ce sur quoi on décide ---- */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3.5">
              <div>
                <dt className="label-champ">Coût {NATURE_COUT[cout.nature]}</dt>
                <dd className="code mt-0.5 text-[14px] font-semibold text-texte">{formaterMontant(cout.montant)}</dd>
              </div>
              <div>
                <dt className="label-champ">Poste</dt>
                <dd className="mt-0.5 text-[13px] text-texte">{POSTE_DEPENSE[ligne.poste]}</dd>
              </div>
              <div>
                <dt className="label-champ">Véhicule</dt>
                <dd className="code mt-0.5 text-[13px] text-texte">{ligne.immatriculationAffichee ?? "—"}</dd>
              </div>
              <div>
                <dt className="label-champ">Urgence</dt>
                <dd className="mt-0.5 text-[13px] text-texte">{URGENCE_ACHAT[ligne.urgence]}</dd>
              </div>
              <div className="col-span-2">
                <dt className="label-champ">Transaction d&apos;origine</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-texte">
                  <Numero valeur={ligne.origineNumero} />
                  {ligne.origineLibelle ? <span className="text-texte-2">{ligne.origineLibelle}</span> : null}
                </dd>
              </div>
              <div>
                <dt className="label-champ">Demandée par</dt>
                <dd className="mt-0.5 text-[13px] text-texte">
                  {ligne.demandeur} · {formaterDate(ligne.date)}
                </dd>
              </div>
              <div>
                <dt className="label-champ">Dans Sage X3</dt>
                <dd className="code mt-0.5 text-[13px] text-texte">
                  {ligne.numeroDemandeX3 ?? "DA non citée"}
                  {ligne.numeroBonCommande ? ` · ${ligne.numeroBonCommande}` : ""}
                </dd>
              </div>
            </dl>

            {/* ---- Le circuit, et où l'on en est ---- */}
            <div className="mt-5 rounded-[12px] border border-bordure px-4 py-3">
              <p className="micro-sur-titre">Circuit</p>
              <ol className="mt-2 flex flex-wrap items-center gap-1.5">
                {circuit.map((e, i) => {
                  const rang = circuit.indexOf(ligne.etape);
                  const franchie = ligne.etape !== "refusee" && rang >= i;
                  return (
                    <li key={e} className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium ${
                          franchie ? "bg-accent-fond text-accent-fonce" : e === suivante ? "bg-vigilance-fond text-vigilance" : "bg-surface-3 text-attenue"
                        }`}
                      >
                        {ETAPE_ACHAT[e]}
                      </span>
                      {i < circuit.length - 1 ? <span className="text-attenue-2">→</span> : null}
                    </li>
                  );
                })}
              </ol>
              <p className="meta mt-2">
                {ligne.montantEstime >= SEUIL_VALIDATION_DIRECTION
                  ? `Au-delà de ${formaterMontant(SEUIL_VALIDATION_DIRECTION)}, la direction valide après le visa du parc.`
                  : `Sous ${formaterMontant(SEUIL_VALIDATION_DIRECTION)}, le visa du parc vaut accord : les achats commandent ensuite.`}{" "}
                Commande, livraison, facture et règlement se font dans Sage X3 : on les constate ici.
              </p>
              <p className="mt-2">
                <Echeance ton={TON_ETAPE_ACHAT[ligne.etape]}>Étape actuelle : {ETAPE_ACHAT[ligne.etape]}</Echeance>
              </p>
            </div>

            {/* ---- Ce que l'étape suivante demande, et rien de plus ---- */}
            {suivante === "visee" ? (
              <label className="mt-5 flex flex-col gap-1.5">
                <span className="label-champ">N° de DA Sage X3</span>
                <input value={daX3} onChange={(e) => setDaX3(e.target.value)} placeholder="DA200-2609123" className="code h-9 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent" />
                <span className="meta">Facultatif : la DA saisie dans X3, pour retrouver la demande dans l&apos;état de règlement.</span>
              </label>
            ) : null}

            {suivante === "commandee" ? (
              <>
                <label className="mt-5 flex flex-col gap-1.5">
                  <span className="label-champ">
                    Bon de commande Sage X3 <span className="text-defavorable">●</span>
                  </span>
                  <input value={bonCommande} onChange={(e) => setBonCommande(e.target.value)} placeholder="BC17420" className="code h-9 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent" />
                </label>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="label-champ">
                      Fournisseur <span className="text-defavorable">●</span>
                    </span>
                    <select value={prestataire} onChange={(e) => setPrestataire(e.target.value)} className="h-9 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent">
                      <option value="">Choisir dans le référentiel…</option>
                      {optionsFournisseurs.map((o) => (
                        <option key={o.valeur} value={o.valeur}>
                          {o.libelle}
                        </option>
                      ))}
                    </select>
                    <span className="meta">{ligne.fournisseur ? `Pressenti : ${ligne.fournisseur}.` : "Aucun fournisseur pressenti."} Un prestataire absent se crée dans Prestataires.</span>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="label-champ">
                      Montant du bon <span className="text-defavorable">●</span>
                    </span>
                    <div className="flex h-9 items-center rounded-[10px] border border-bordure-champ bg-surface pr-3 focus-within:border-accent">
                      <input inputMode="decimal" value={montantEngage} onChange={(e) => setMontantEngage(e.target.value)} className="code h-full min-w-0 flex-1 bg-transparent px-3 text-[13px] text-texte outline-none" />
                      <span className="text-[12px] text-attenue">F</span>
                    </div>
                    <span className="meta">Estimé à {formaterMontant(ligne.montantEstime)} ; le bon fait foi.</span>
                  </label>
                </div>
              </>
            ) : null}

            {suivante === "livree" ? champDate("Livrée le") : null}

            {suivante === "facturee" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {champDate("Facturée le")}
                <label className="mt-5 flex flex-col gap-1.5">
                  <span className="label-champ">
                    Montant facturé <span className="text-defavorable">●</span>
                  </span>
                  <div className="flex h-9 items-center rounded-[10px] border border-bordure-champ bg-surface pr-3 focus-within:border-accent">
                    <input inputMode="decimal" value={montantReel} onChange={(e) => setMontantReel(e.target.value)} className="code h-full min-w-0 flex-1 bg-transparent px-3 text-[13px] text-texte outline-none" />
                    <span className="text-[12px] text-attenue">F</span>
                  </div>
                  <span className="meta">
                    {ligne.depenseNumero || originePorteLeCout(ligne.origineNumero) ? "Le coût est déjà porté par la transaction d'origine sur la fiche du véhicule." : ligne.vehiculeId ? "Une dépense sera créée sur la fiche du véhicule à ce montant." : "Sans véhicule, le coût reste sur la demande."}
                  </span>
                </label>
              </div>
            ) : null}

            {suivante === "reglee" ? champDate("Réglée le") : null}

            <label className="mt-5 flex flex-col gap-1.5">
              <span className="label-champ">
                Motif de la décision <span className="text-defavorable">●</span>
              </span>
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                rows={3}
                placeholder="Ce qui motive le visa, la validation, le constat ou le refus. Il sera lu dans l'historique de la demande."
                className="w-full resize-none rounded-[10px] border border-bordure-champ bg-surface px-3 py-2 text-[13px] leading-relaxed text-texte outline-none placeholder:text-attenue focus:border-accent"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-bordure px-6 py-4">
            <p className="meta min-w-0 flex-1">
              {issue === "faite" ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-favorable">
                  <Check className="size-4" strokeWidth={2.2} />
                  Décision enregistrée et tracée.
                </span>
              ) : issue === "en-attente" ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-vigilance">
                  <Lock className="size-4" strokeWidth={2} />
                  Mois clos : la décision part en demande d&apos;approbation.
                </span>
              ) : !motifSuffisant ? (
                "Le motif est obligatoire."
              ) : manqueBc ? (
                "Le numéro de bon de commande est obligatoire."
              ) : manqueFournisseur ? (
                "Le fournisseur se choisit dans le référentiel des prestataires."
              ) : manqueMontant ? (
                "Le montant est obligatoire."
              ) : manqueDate ? (
                "La date est obligatoire."
              ) : (
                "La décision sera tracée avec votre nom, la date et le motif."
              )}
            </p>
            {/* Un refus n'a plus de sens une fois la commande passée dans X3. */}
            {ligne.etape === "soumise" || ligne.etape === "visee" || ligne.etape === "validee" ? (
              <button type="button" onClick={() => decider("refusee")} disabled={!motifSuffisant || issue !== null} className="bouton-secondaire disabled:cursor-not-allowed disabled:text-attenue-2">
                <Ban className="size-4" strokeWidth={1.8} />
                Refuser
              </button>
            ) : null}
            {suivante ? (
              <button type="button" onClick={() => decider(suivante)} disabled={!motifSuffisant || bloquee || issue !== null} className="bouton-principal disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-attenue-2">
                <Check className="size-4" strokeWidth={2.2} />
                {VERBE[suivante]}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
