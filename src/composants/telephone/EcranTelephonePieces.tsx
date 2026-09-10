"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Check, Package, Search, X } from "lucide-react";
import { champsMouvement, usePieces } from "@/composants/pieces/EcranPieces";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import type { AccesCourant } from "@/domaine/acces";
import type { LigneOrdre } from "@/domaine/maintenance";
import { ETAT_STOCK, NATURE_MOUVEMENT, UNITE_PIECE, variation, type NatureMouvement, type Piece, type StockPiece } from "@/domaine/pieces";
import type { SourcePieces } from "@/donnees/pieces";
import { lireAccesCourant } from "@/lib/acces-courant";
import { enregistrerCreation } from "@/lib/clotures-demo";
import { montant as formaterMontant, nombre } from "@/lib/format";
import { Bloc, Chiffre, EnTeteTelephone, Ligne } from "./Telephone";

/* ============================================================================
 * Téléphone › Pièces — depuis la fosse : sortir une pièce pour le véhicule
 * qu'on répare, recevoir une livraison au magasin. Les mêmes mouvements que
 * le bureau (sujet « pieces », même stock déduit), en trois gestes : la
 * pièce, la quantité, le véhicule ou le bon. Étape « téléphone » de la
 * proposition du 8 septembre 2026, sur les décisions du 9.
 * ==========================================================================*/

export interface VehiculeChoix {
  id: string;
  immatriculationAffichee: string;
  libelle: string;
}

interface Props {
  source: SourcePieces;
  vehicules: VehiculeChoix[];
  ordres: LigneOrdre[];
  gesteInitial?: string;
}

export function EcranTelephonePieces(props: Props) {
  return (
    <FournisseurEdition sujet="pieces" href="/telephone/pieces">
      <Interieur {...props} />
    </FournisseurEdition>
  );
}

function Interieur({ source, vehicules, ordres, gesteInitial }: Props) {
  const router = useRouter();
  const { actualiser } = useEdition();
  const { pieces, mouvements, stock } = usePieces(source);
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [geste, setGeste] = useState<NatureMouvement | null>(gesteInitial === "sortie" || gesteInitial === "entree" ? gesteInitial : null);
  const [bilan, setBilan] = useState<string | null>(null);
  useEffect(() => setAcces(lireAccesCourant()), []);
  const agit = acces ? acces.niveaux.maintenance === "saisie" || acces.niveaux.maintenance === "gestion" : false;

  const actives = stock.filter((s) => s.piece.actif);
  const sousLeSeuil = actives.filter((s) => s.etat === "sous-le-seuil" || s.etat === "epuisee").sort((a, b) => ETAT_STOCK[a.etat].rang - ETAT_STOCK[b.etat].rang || b.aCommander - a.aCommander);
  const duJour = mouvements.filter((m) => m.date === source.aujourdhui).sort((a, b) => b.numero.localeCompare(a.numero));
  const pieceParNumero = useMemo(() => new Map(pieces.map((p) => [p.numero, p])), [pieces]);
  const enAtelier = ordres.filter((o) => o.statut === "en-atelier");

  /* Un mouvement, écrit comme au bureau : même sujet, mêmes champs, même
     synchronisation en base. Le refus d'un mois clos remonte tel quel. */
  function enregistrer(nature: NatureMouvement, valeurs: Record<string, unknown>): string | null {
    const r = enregistrerCreation({ sujet: "pieces", type: "mouvement", champs: champsMouvement(nature, pieces), valeurs: { date: source.aujourdhui, nature, ...valeurs }, motif: `${NATURE_MOUVEMENT[nature].libelle} depuis le téléphone` });
    if (r.issue === "mois-clos") return `Le mois ${r.mois} est clos : le mouvement attend le bureau.`;
    if (r.issue !== "creee") return "Le mouvement n'a pas pu être enregistré.";
    const p = pieceParNumero.get(String(valeurs.pieceNumero));
    setBilan(`${NATURE_MOUVEMENT[nature].libelle} enregistrée : ${p?.reference ?? ""} × ${String(valeurs.quantite)} (${r.creation.numero}).`);
    actualiser();
    router.refresh();
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-1">
      <EnTeteTelephone titre="Pièces" retour="/telephone/atelier" />
      {!agit && acces ? <p className="meta -mt-2 px-4">Lecture seule : sortir et recevoir relèvent de la maintenance.</p> : null}
      {bilan ? (
        <p className="flex items-start gap-2 rounded-[8px] bg-accent-fond px-3 py-2 text-[12.5px] text-accent-fonce">
          <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
          {bilan}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <Chiffre valeur={actives.length} libelle="références" />
        <Chiffre valeur={sousLeSeuil.length} libelle="sous le seuil" alerte={sousLeSeuil.some((s) => s.etat === "epuisee")} />
        <Chiffre valeur={duJour.length} libelle="aujourd'hui" />
      </div>

      {agit ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setGeste("sortie")} className="bouton-principal h-14 justify-center rounded-[14px] text-[14px]">
            <ArrowUpFromLine className="size-5" strokeWidth={2.2} />
            Sortir une pièce
          </button>
          <button type="button" onClick={() => setGeste("entree")} className="bouton-secondaire h-14 justify-center rounded-[14px] text-[14px]">
            <ArrowDownToLine className="size-5 text-texte-2" strokeWidth={2} />
            Recevoir
          </button>
        </div>
      ) : null}

      <Bloc titre="Sous le seuil" accent={sousLeSeuil.some((s) => s.etat === "epuisee")}>
        {sousLeSeuil.length === 0 ? <p className="meta py-1">Tout le magasin est au-dessus du minimum.</p> : null}
        {sousLeSeuil.slice(0, 6).map((s) => (
          <Ligne key={s.piece.numero} icone={<Package className="size-4" strokeWidth={2} />} ton={s.etat === "epuisee" ? "defavorable" : "vigilance"} titre={`${s.piece.reference} · ${s.piece.designation}`} precision={`${nombre(s.quantite)} ${UNITE_PIECE[s.piece.unite].court} en stock · minimum ${nombre(s.piece.stockMinimum)} · ${nombre(s.aCommander)} à commander`} href={`/pieces/${s.piece.numero}`} />
        ))}
        {sousLeSeuil.length > 0 ? (
          <Link href="/pieces" className="mt-1.5 inline-block text-[12.5px] font-semibold text-accent-fonce">
            Préparer la demande d&apos;achat au bureau
          </Link>
        ) : null}
      </Bloc>

      <Bloc titre="Aujourd'hui">
        {duJour.length === 0 ? <p className="meta py-1">Aucun mouvement aujourd&apos;hui.</p> : null}
        {duJour.slice(0, 8).map((m) => {
          const p = pieceParNumero.get(m.pieceNumero);
          const v = variation(m);
          return (
            <Ligne
              key={m.numero}
              icone={m.nature === "entree" ? <ArrowDownToLine className="size-4" strokeWidth={2} /> : <ArrowUpFromLine className="size-4" strokeWidth={2} />}
              ton={m.nature === "sortie" ? "vigilance" : "neutre"}
              titre={`${p?.reference ?? m.pieceNumero} · ${p?.designation ?? ""}`}
              precision={`${NATURE_MOUVEMENT[m.nature].libelle}${m.immatriculationAffichee ? ` · ${m.immatriculationAffichee}` : ""}${m.ordreNumero ? ` · ${m.ordreNumero}` : ""}${m.motif ? ` · ${m.motif}` : ""}`}
              valeur={`${v > 0 ? "+" : ""}${nombre(v)} ${p ? UNITE_PIECE[p.unite].court : ""}`}
            />
          );
        })}
      </Bloc>

      {geste ? <PanneauMouvement nature={geste} stock={actives} vehicules={vehicules} ordres={enAtelier} onFermer={() => setGeste(null)} onEnregistrer={(valeurs) => enregistrer(geste, valeurs)} /> : null}
    </div>
  );
}

/* ---- Le panneau : la pièce, la quantité, le rattachement ------------------------------ */

function PanneauMouvement({ nature, stock, vehicules, ordres, onFermer, onEnregistrer }: { nature: NatureMouvement; stock: StockPiece[]; vehicules: VehiculeChoix[]; ordres: LigneOrdre[]; onFermer: () => void; onEnregistrer: (valeurs: Record<string, unknown>) => string | null }) {
  const [recherche, setRecherche] = useState("");
  const [piece, setPiece] = useState<Piece | null>(null);
  const [quantite, setQuantite] = useState("1");
  const [vehiculeId, setVehiculeId] = useState("");
  const [ordreNumero, setOrdreNumero] = useState("");
  const [prix, setPrix] = useState("");
  const [bon, setBon] = useState("");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = "h-11 w-full rounded-[12px] border border-bordure-champ bg-surface px-3.5 text-[15px] text-texte outline-none focus:border-accent";
  const sortie = nature === "sortie";

  /* La pièce se cherche, elle ne se déroule pas : quarante références dans un
     menu tiennent mal sous le pouce. Référence, désignation, constructeur,
     modèle compatible — tout ce qui s'écrit sur le casier ou sur la boîte. */
  const terme = recherche.trim().toLowerCase();
  const candidates = terme.length < 2 ? [] : stock.filter((s) => [s.piece.reference, s.piece.designation, s.piece.referenceConstructeur ?? "", s.piece.compatibilites.join(" ")].join(" ").toLowerCase().includes(terme)).slice(0, 8);
  const ligne = piece ? stock.find((s) => s.piece.numero === piece.numero) : null;

  /* L'ordre en atelier fixe le véhicule : c'est lui qu'on répare. */
  const ordre = ordres.find((o) => o.numero === ordreNumero) ?? null;
  const vehiculeRetenu = ordre ? ordre.vehiculeId : vehiculeId;
  const ordresDuVehicule = vehiculeId ? ordres.filter((o) => o.vehiculeId === vehiculeId) : ordres;

  const q = Number(quantite.replace(/\s/g, "").replace(",", "."));
  const px = prix.trim() === "" ? null : Number(prix.replace(/\s/g, ""));
  const valide = piece !== null && Number.isFinite(q) && q > 0 && (!sortie || vehiculeRetenu !== "") && (px === null || (Number.isFinite(px) && px >= 0));
  const depasse = sortie && ligne !== null && ligne !== undefined && Number.isFinite(q) && q > ligne.quantite;

  return (
    <>
      <button type="button" aria-label="Fermer" onClick={onFermer} className="fixed inset-0 z-30 cursor-default bg-encre/40" />
      <div role="dialog" aria-modal="true" aria-labelledby="mouvement-titre" className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[92vh] w-full max-w-[520px] flex-col rounded-t-[18px] bg-surface shadow-flottante">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h2 id="mouvement-titre" className="min-w-0 flex-1 text-[17px] font-bold text-texte">
            {sortie ? "Sortir une pièce" : "Recevoir une livraison"}
          </h2>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="grid size-9 place-items-center rounded-full text-texte-2 hover:bg-surface-3">
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>
        <div className="defilement-discret flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          {piece === null ? (
            <label className="block">
              <span className="label-champ mb-1.5 block">Pièce</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-attenue" strokeWidth={2} />
                <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Référence, désignation, modèle…" className={`${champ} pl-9`} />
              </span>
              {candidates.length > 0 ? (
                <span className="mt-1.5 block overflow-hidden rounded-[12px] border border-bordure">
                  {candidates.map((s) => (
                    <button
                      key={s.piece.numero}
                      type="button"
                      onClick={() => {
                        setPiece(s.piece);
                        setPrix(s.dernierPrix === null ? "" : String(s.dernierPrix));
                      }}
                      className="flex w-full items-center gap-2.5 border-t border-bordure px-3 py-2.5 text-left first:border-t-0 hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-texte">
                          <span className="code">{s.piece.reference}</span> · {s.piece.designation}
                        </span>
                        <span className="block truncate text-[11.5px] text-attenue">{s.piece.compatibilites.join(", ") || "—"}</span>
                      </span>
                      <span className={`code shrink-0 text-[13px] font-semibold ${s.quantite <= 0 ? "text-defavorable" : "text-texte"}`}>
                        {nombre(s.quantite)} {UNITE_PIECE[s.piece.unite].court}
                      </span>
                    </button>
                  ))}
                </span>
              ) : terme.length >= 2 ? (
                <span className="meta mt-1.5 block">Aucune pièce ne correspond — elle se crée au bureau.</span>
              ) : null}
            </label>
          ) : (
            <div className="flex items-center gap-2.5 rounded-[12px] border border-accent-bordure bg-accent-fond px-3.5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-texte">
                  <span className="code">{piece.reference}</span> · {piece.designation}
                </span>
                <span className="block text-[11.5px] text-texte-2">
                  {ligne ? `${nombre(ligne.quantite)} ${UNITE_PIECE[piece.unite].court} en stock` : ""}
                  {ligne?.dernierPrix ? ` · ${formaterMontant(ligne.dernierPrix)} l'unité` : ""}
                </span>
              </span>
              <button type="button" onClick={() => setPiece(null)} className="bouton-discret h-8 px-2 text-[12px]">
                Changer
              </button>
            </div>
          )}

          <label className="block">
            <span className="label-champ mb-1.5 block">Quantité</span>
            <span className="flex items-center gap-2">
              <input type="text" inputMode="decimal" value={quantite} onChange={(e) => setQuantite(e.target.value)} className={`${champ} text-right tabular-nums`} />
              <span className="meta w-8">{piece ? UNITE_PIECE[piece.unite].court : ""}</span>
            </span>
            {depasse ? <span className="mt-1 block text-[12px] text-vigilance">Plus que le stock déduit : le mouvement passera, le stock deviendra négatif — un inventaire dira le vrai.</span> : null}
          </label>

          {sortie ? (
            <>
              {ordres.length > 0 ? (
                <label className="block">
                  <span className="label-champ mb-1.5 block">Ordre de travail en atelier</span>
                  <select value={ordreNumero} onChange={(e) => setOrdreNumero(e.target.value)} className={champ}>
                    <option value="">— aucun, ou pas encore ouvert —</option>
                    {ordresDuVehicule.map((o) => (
                      <option key={o.numero} value={o.numero}>
                        {o.immatriculationAffichee} · {o.objet}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block">
                <span className="label-champ mb-1.5 block">Véhicule servi</span>
                <select value={vehiculeRetenu} onChange={(e) => setVehiculeId(e.target.value)} disabled={ordre !== null} className={`${champ} disabled:text-texte-2`}>
                  <option value="">— choisir —</option>
                  {vehicules.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.immatriculationAffichee} · {v.libelle}
                    </option>
                  ))}
                </select>
                {ordre ? <span className="meta mt-1 block">Fixé par l&apos;ordre {ordre.numero}.</span> : null}
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="label-champ mb-1.5 block">Prix unitaire payé (facultatif)</span>
                <span className="flex items-center gap-2">
                  <input type="text" inputMode="numeric" value={prix} onChange={(e) => setPrix(e.target.value)} className={`${champ} text-right tabular-nums`} />
                  <span className="meta w-8">F</span>
                </span>
              </label>
              <label className="block">
                <span className="label-champ mb-1.5 block">Demande d&apos;achat ou bon livré (facultatif)</span>
                <input type="text" value={bon} onChange={(e) => setBon(e.target.value)} placeholder="DAC-2026-…" className={`${champ} code`} />
              </label>
            </>
          )}

          <label className="block">
            <span className="label-champ mb-1.5 block">Motif (facultatif)</span>
            <input type="text" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={sortie ? "Vidange, plaquettes avant…" : "Livraison SENEMECA du jour"} className={champ} />
          </label>
          {erreur ? <p className="text-[12.5px] text-defavorable">{erreur}</p> : null}
        </div>
        <div className="border-t border-bordure px-4 py-3">
          <button
            type="button"
            onClick={() => {
              if (!valide || !piece) return;
              const refus = onEnregistrer(
                sortie
                  ? { pieceNumero: piece.numero, quantite: q, vehiculeId: vehiculeRetenu, ordreNumero: ordre?.numero ?? "", motif: motif.trim() || (ordre ? ordre.objet : "") }
                  : { pieceNumero: piece.numero, quantite: q, prixUnitaire: px ?? "", demandeNumero: bon.trim(), fournisseur: piece.fournisseur ?? "", motif: motif.trim() },
              );
              if (refus) setErreur(refus);
              else onFermer();
            }}
            disabled={!valide}
            className="bouton-principal h-11 w-full justify-center rounded-[12px] text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="size-4" strokeWidth={2.2} />
            {sortie ? "Sortir" : "Recevoir"}
          </button>
          <p className="meta mt-2 text-center">{sortie ? "La sortie s'inscrit sur la fiche du véhicule, onglet Entretien." : "L'entrée porte le stock ; la charge reste à l'achat."}</p>
        </div>
      </div>
    </>
  );
}
