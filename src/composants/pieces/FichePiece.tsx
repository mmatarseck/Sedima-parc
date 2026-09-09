"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, Pencil } from "lucide-react";
import { Carte, Definitions, TableauSimple } from "@/composants/interface/Carte";
import { Numero } from "@/composants/interface/Numero";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { CHAMPS } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { CATEGORIE_PIECE, ETAT_PNEU, ETAT_STOCK, NATURE_MOUVEMENT, UNITE_PIECE, kmParcourus, variation, type MouvementStock, type NatureMouvement, type Pneu } from "@/domaine/pieces";
import type { SourcePieces } from "@/donnees/pieces";
import { dateCourte, montant, montantCourt, nombre } from "@/lib/format";
import { champsMouvement, champsPneu, rattachement, usePieces } from "./EcranPieces";

/* ============================================================================
 * La fiche d'une pièce : ce qu'elle est, ce qu'il en reste, ce qui a bougé.
 *
 * Même sujet d'édition que la liste (« pieces ») : une sortie saisie ici se
 * retrouve dans le journal, et le stock déduit est le même des deux côtés.
 * ==========================================================================*/

const ONGLETS = [
  { cle: "identite", libelle: "Identité" },
  { cle: "mouvements", libelle: "Mouvements" },
  { cle: "pneus", libelle: "Pneus" },
] as const;

interface Props {
  source: SourcePieces;
  numero: string;
  ongletInitial?: string;
  cible?: string;
}

export function FichePiece(props: Props) {
  return (
    <FournisseurEdition sujet="pieces" href={`/pieces/${props.numero}`}>
      <Interieur {...props} />
    </FournisseurEdition>
  );
}

function Interieur({ source, numero, ongletInitial, cible }: Props) {
  const { demander, creer } = useEdition();
  const { pieces, mouvements, pneus, stock } = usePieces(source);
  const ligne = stock.find((s) => s.piece.numero === numero) ?? null;
  const [onglet, setOnglet] = useState<string>(ONGLETS.some((o) => o.cle === ongletInitial) ? ongletInitial! : "identite");

  if (!ligne) {
    return (
      <div className="flex flex-col gap-5 px-8 py-7">
        <Link href="/pieces" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Pièces de rechange
        </Link>
        <p className="text-texte-2">Cette pièce n'est pas au référentiel.</p>
      </div>
    );
  }
  const { piece } = ligne;
  const siens = mouvements.filter((m) => m.pieceNumero === piece.numero).sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero));
  const pneusDeLaPiece = pneus.filter((p) => p.pieceNumero === piece.numero);
  const unite = UNITE_PIECE[piece.unite].court;

  function modifier() {
    demander({ type: "piece", numero: piece.numero, titre: `Pièce ${piece.reference} · ${piece.designation}`, valeurs: { ...piece, compatibilites: piece.compatibilites.join("; ") } as unknown as Record<string, unknown>, champs: CHAMPS.piece });
  }
  function mouvement(nature: NatureMouvement) {
    creer({
      type: "mouvement",
      titre: `${NATURE_MOUVEMENT[nature].libelle} — ${piece.reference}`,
      champs: champsMouvement(nature, pieces),
      valeurs: { date: source.aujourdhui, nature, pieceNumero: piece.numero, fournisseur: nature === "entree" ? (piece.fournisseur ?? "") : "", prixUnitaire: nature === "entree" && piece.prixReference !== null ? piece.prixReference : "" },
    });
  }
  function modifierPneu(p: Pneu) {
    demander({ type: "pneu", numero: p.numero, titre: `Pneu ${p.numero} · ${p.dimension}`, valeurs: p as unknown as Record<string, unknown>, champs: champsPneu(pieces) });
  }

  const rien = <span className="text-attenue-2">—</span>;
  const etat = ETAT_STOCK[ligne.etat];

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/pieces" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Pièces de rechange
        </Link>
      </nav>

      <header className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-bold text-texte">
            <span className="code">{piece.reference}</span>
            <span className="font-semibold text-texte-2">{piece.designation}</span>
            {piece.actif ? <Pastille ton={etat.ton}>{etat.libelle}</Pastille> : <Pastille ton="neutre">Inactive</Pastille>}
          </h1>
          <p className="meta mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{CATEGORIE_PIECE[piece.categorie]}</span>
            <span>· compté en {UNITE_PIECE[piece.unite].libelle.toLowerCase()}s</span>
            {piece.fournisseur ? <span>· {piece.fournisseur}</span> : null}
            <Numero valeur={piece.numero} />
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <button type="button" onClick={modifier} className="bouton-secondaire h-9">
            <Pencil className="size-4 text-texte-2" strokeWidth={1.7} />
            Modifier
          </button>
          <button type="button" onClick={() => mouvement("entree")} className="bouton-secondaire h-9">
            <ArrowDownToLine className="size-4 text-texte-2" strokeWidth={1.7} />
            Entrée
          </button>
          <button type="button" onClick={() => mouvement("sortie")} className="bouton-principal h-9">
            <ArrowUpFromLine className="size-4" strokeWidth={2.2} />
            Sortie
          </button>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-4 xl:grid-cols-5">
        {[
          { libelle: "En stock", valeur: `${nombre(ligne.quantite)} ${unite}`, precision: etat.precision, ton: ligne.quantite <= 0 ? "text-defavorable" : ligne.etat === "sous-le-seuil" ? "text-vigilance" : "text-texte" },
          { libelle: "Minimum · maximum", valeur: `${nombre(piece.stockMinimum)}${piece.stockMaximum !== null ? ` · ${nombre(piece.stockMaximum)}` : ""}`, precision: ligne.aCommander > 0 ? `${nombre(ligne.aCommander)} ${unite} à commander` : "au-dessus du seuil", ton: "text-texte" },
          { libelle: "Dernier prix", valeur: ligne.dernierPrix === null ? "—" : montant(ligne.dernierPrix), precision: ligne.dernierPrix === piece.prixReference ? "prix de référence" : "dernière entrée", ton: "text-texte" },
          { libelle: "Valeur indicative", valeur: ligne.valeurIndicative === null ? "—" : montantCourt(ligne.valeurIndicative), precision: "la charge est passée à l'achat", ton: "text-texte" },
          { libelle: "Sorties 12 mois", valeur: `${nombre(ligne.sortiesDouzeMois)} ${unite}`, precision: ligne.dernierMouvement ? `dernier mouvement le ${dateCourte(ligne.dernierMouvement)}` : "aucun mouvement", ton: "text-texte" },
        ].map((k) => (
          <div key={k.libelle} className="carte px-4 py-3">
            <p className="label-champ">{k.libelle}</p>
            <p className={`code mt-1 text-[19px] font-bold ${k.ton}`}>{k.valeur}</p>
            <p className="meta mt-0.5 truncate">{k.precision}</p>
          </div>
        ))}
      </div>

      <div className="sans-barre flex shrink-0 flex-wrap items-center gap-1.5" role="tablist">
        {ONGLETS.filter((o) => o.cle !== "pneus" || piece.categorie === "pneumatique" || pneusDeLaPiece.length > 0).map((o) => (
          <button
            key={o.cle}
            type="button"
            role="tab"
            aria-selected={onglet === o.cle}
            onClick={() => setOnglet(o.cle)}
            className={`h-8 rounded-full px-3.5 text-[12.5px] whitespace-nowrap transition-colors ${onglet === o.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "bg-surface-3 font-medium text-texte-2 hover:text-texte"}`}
          >
            {o.libelle}
            {o.cle === "mouvements" && siens.length > 0 ? <span className="ml-1.5 text-attenue">{siens.length}</span> : null}
            {o.cle === "pneus" && pneusDeLaPiece.length > 0 ? <span className="ml-1.5 text-attenue">{pneusDeLaPiece.length}</span> : null}
          </button>
        ))}
      </div>

      {onglet === "identite" ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Carte titre="Identité" precision="Ce que le référentiel porte">
            <Definitions
              elements={[
                { libelle: "Référence (casier)", valeur: <span className="code">{piece.reference}</span> },
                { libelle: "Désignation", valeur: piece.designation },
                { libelle: "Catégorie", valeur: CATEGORIE_PIECE[piece.categorie] },
                { libelle: "Unité", valeur: UNITE_PIECE[piece.unite].libelle },
                { libelle: "Référence constructeur", valeur: piece.referenceConstructeur ? <span className="code">{piece.referenceConstructeur}</span> : null },
                { libelle: "Compatibilités", valeur: piece.compatibilites.length ? piece.compatibilites.join(", ") : null },
                { libelle: "Statut", valeur: <Echeance ton={piece.actif ? "favorable" : "neutre"}>{piece.actif ? "Active" : "Inactive"}</Echeance> },
                { libelle: "Commentaire", valeur: piece.commentaire },
              ]}
            />
          </Carte>
          <Carte titre="Approvisionnement" precision="Le fournisseur habituel et les seuils qui déclenchent la commande">
            <Definitions
              elements={[
                { libelle: "Fournisseur habituel", valeur: piece.fournisseurNumero ? <Link href={`/prestataires/${piece.fournisseurNumero}`} className="text-accent-fonce hover:underline">{piece.fournisseur}</Link> : piece.fournisseur },
                { libelle: "Prix de référence", valeur: piece.prixReference === null ? null : <span className="code">{montant(piece.prixReference)}</span> },
                { libelle: "Stock minimum", valeur: <span className="code">{nombre(piece.stockMinimum)} {unite}</span> },
                { libelle: "Stock maximum (visé)", valeur: piece.stockMaximum === null ? null : <span className="code">{nombre(piece.stockMaximum)} {unite}</span> },
                { libelle: "À commander aujourd'hui", valeur: ligne.aCommander > 0 ? <span className="code text-vigilance">{nombre(ligne.aCommander)} {unite}</span> : <span className="text-attenue">rien</span> },
                { libelle: "Consommation 12 mois", valeur: <span className="code">{nombre(ligne.sortiesDouzeMois)} {unite}</span> },
              ]}
            />
          </Carte>
        </div>
      ) : null}

      {onglet === "mouvements" ? (
        <Carte titre="Mouvements" precision="Du plus récent au plus ancien ; la quantité en stock est leur somme" sansMarge>
          <TableauSimple<MouvementStock>
            colonnes={[
              { cle: "numero", libelle: "Réf.", largeur: "150px", rendu: (m) => <Numero valeur={m.numero} /> },
              { cle: "date", libelle: "Date", largeur: "110px", rendu: (m) => <span className="code">{dateCourte(m.date)}</span> },
              { cle: "nature", libelle: "Nature", largeur: "140px", rendu: (m) => <Pastille ton={NATURE_MOUVEMENT[m.nature].ton}>{NATURE_MOUVEMENT[m.nature].libelle}</Pastille> },
              {
                cle: "variation",
                libelle: "Quantité",
                alignee: "droite",
                largeur: "110px",
                rendu: (m) => {
                  const v = variation(m);
                  return (
                    <span className={`code ${v < 0 ? "text-vigilance" : v > 0 ? "text-favorable" : ""}`}>
                      {v > 0 ? "+" : ""}
                      {nombre(v)} {unite}
                    </span>
                  );
                },
              },
              { cle: "prix", libelle: "Prix unitaire", alignee: "droite", largeur: "130px", rendu: (m) => (m.prixUnitaire === null ? rien : <span className="code">{montant(m.prixUnitaire)}</span>) },
              { cle: "rattachement", libelle: "Rattaché à", largeur: "170px", rendu: (m) => (rattachement(m) ? <span className="code text-[12.5px]">{rattachement(m)}</span> : rien) },
              { cle: "motif", libelle: "Motif", rendu: (m) => <span className="block truncate">{m.motif ?? rien}</span> },
              { cle: "auteur", libelle: "Saisi par", largeur: "160px", rendu: (m) => <span className="block truncate">{m.auteur}</span> },
            ]}
            lignes={siens}
            cle={(m) => m.numero}
            numero={(m) => m.numero}
            cible={cible}
            vide="Aucun mouvement sur cette pièce."
          />
        </Carte>
      ) : null}

      {onglet === "pneus" ? (
        <Carte titre="Pneus de cette dimension" precision="Suivis un par un, de la pose à la dépose" sansMarge>
          <TableauSimple<Pneu>
            colonnes={[
              { cle: "numero", libelle: "Réf.", largeur: "150px", rendu: (p) => <Numero valeur={p.numero} /> },
              { cle: "etat", libelle: "État", largeur: "120px", rendu: (p) => <Pastille ton={ETAT_PNEU[p.etat].ton}>{ETAT_PNEU[p.etat].libelle}</Pastille> },
              { cle: "marque", libelle: "Marque", largeur: "140px", rendu: (p) => <span>{p.marque || rien}</span> },
              { cle: "vehicule", libelle: "Véhicule", largeur: "130px", rendu: (p) => (p.vehiculeId ? <Link href={`/flotte/${p.vehiculeId}?onglet=entretien`} className="code text-[12.5px] text-accent-fonce hover:underline">{p.immatriculationAffichee}</Link> : rien) },
              { cle: "position", libelle: "Position", largeur: "120px", rendu: (p) => <span>{p.position ?? rien}</span> },
              { cle: "pose", libelle: "Posé le", largeur: "110px", rendu: (p) => (p.datePose ? <span className="code">{dateCourte(p.datePose)}</span> : rien) },
              { cle: "km", libelle: "Km parcourus", alignee: "droite", largeur: "130px", rendu: (p) => { const km = kmParcourus(p, null); return km === null ? rien : <span className="code">{nombre(km)} km</span>; } },
              { cle: "serie", libelle: "Série / DOT", rendu: (p) => <span className="code text-[12.5px]">{p.numeroSerie ?? "—"}</span> },
            ]}
            lignes={pneusDeLaPiece}
            cle={(p) => p.numero}
            numero={(p) => p.numero}
            cible={cible}
            surModifier={modifierPneu}
            vide="Aucun pneu rattaché à cette dimension."
          />
        </Carte>
      ) : null}
    </div>
  );
}
