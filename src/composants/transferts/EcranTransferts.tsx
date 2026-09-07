"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Pastille } from "@/composants/interface/Pastille";
import type { AccesCourant } from "@/domaine/acces";
import { STATUT_TRANSFERT, libellePartie, statutTransfert, type StatutTransfert, type Transfert } from "@/domaine/transferts";
import { lireAccesCourant } from "@/lib/acces-courant";
import { nombre } from "@/lib/format";
import { lireTransferts } from "@/lib/transferts-demo";

/* ============================================================================
 * Fiches de transfert — la liste : ce qui attend une signature, ce qui est
 * complet. Une fiche s'ouvre d'un clic ; une nouvelle se dresse sur sa page.
 * ==========================================================================*/

function heure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function EcranTransferts({ initial }: { initial: Transfert[] }) {
  const [liste, setListe] = useState<Transfert[]>(initial);
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [filtre, setFiltre] = useState<"toutes" | "a-signer" | "complete">("toutes");
  useEffect(() => {
    setListe(lireTransferts(initial));
    setAcces(lireAccesCourant());
  }, [initial]);

  const cree = acces !== null && acces.profil !== "detenteur" && (acces.niveaux.transferts === "saisie" || acces.niveaux.transferts === "gestion");
  const enAttente = liste.filter((t) => { const s = statutTransfert(t); return s !== "complete" && s !== "annulee"; }).length;
  const visibles = useMemo(
    () =>
      [...liste]
        .filter((t) => {
          const s = statutTransfert(t);
          return filtre === "toutes" ? true : filtre === "complete" ? s === "complete" : s !== "complete" && s !== "annulee";
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [liste, filtre],
  );

  const filtres: { cle: typeof filtre; libelle: string; n: number }[] = [
    { cle: "toutes", libelle: "Toutes", n: liste.length },
    { cle: "a-signer", libelle: "À signer", n: enAttente },
    { cle: "complete", libelle: "Complètes", n: liste.filter((t) => statutTransfert(t) === "complete").length },
  ];

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran
        titre="Fiches de transfert"
        sousTitre={`${liste.length} fiche${liste.length > 1 ? "s" : ""} · ${enAttente} à signer · une fiche complète ouvre l'affectation qui suit et ferme la précédente`}
        actions={
          cree ? (
            <Link href="/transferts/nouveau" className="bouton-principal">
              <Plus className="size-4" strokeWidth={2.2} />
              Nouvelle fiche
            </Link>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {filtres.map((f) => (
          <button key={f.cle} type="button" onClick={() => setFiltre(f.cle)} aria-pressed={filtre === f.cle} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium ${filtre === f.cle ? "border-accent-bordure bg-accent-fond text-accent-tres-fonce" : "border-bordure bg-surface text-texte-2 hover:bg-surface-2"}`}>
            {f.libelle}
            <span className="code text-[11.5px] text-attenue">{f.n}</span>
          </button>
        ))}
      </div>

      <Carte titre="Les fiches" precision="Compteur, carburant, documents, équipements, réserves et deux signatures. La fiche s'ouvre d'un clic." sansMarge>
        <TableauSimple<Transfert>
          cle={(t) => t.id}
          lignes={visibles}
          vide="Aucune fiche de transfert."
          figerEnTete="page"
          colonnes={[
            { cle: "numero", libelle: "N°", rendu: (t) => <Link href={`/transferts/${t.id}`} className="code text-[12.5px] font-medium text-texte hover:text-accent-fonce">{t.numero}</Link> },
            {
              cle: "vehicule",
              libelle: "Véhicule",
              rendu: (t) => (
                <Link href={`/transferts/${t.id}`} className="flex flex-col hover:text-accent-fonce">
                  <span className="code font-medium text-texte">{t.vehicule.immatriculation}</span>
                  <span className="meta">{t.vehicule.libelle}</span>
                </Link>
              ),
            },
            { cle: "de", libelle: "Remis par", rendu: (t) => <span className="text-texte">{libellePartie(t.remettant)}</span> },
            { cle: "a", libelle: "Reçu par", rendu: (t) => <span className="text-texte">{libellePartie(t.recipiendaire)}</span> },
            { cle: "date", libelle: "Remise", rendu: (t) => <span className="text-texte-2">{heure(t.date)}</span> },
            { cle: "motif", libelle: "Motif", rendu: (t) => <span className="text-texte-2">{t.motif}</span> },
            { cle: "km", libelle: "Compteur", alignee: "droite", rendu: (t) => <span className="code text-texte">{t.km === null ? "—" : nombre(t.km)}</span> },
            { cle: "reserves", libelle: "Réserves", alignee: "droite", rendu: (t) => (t.reserves.length ? <span className="font-medium text-vigilance">{t.reserves.length}</span> : <span className="text-attenue-2">—</span>) },
            {
              cle: "statut",
              libelle: "Statut",
              rendu: (t) => {
                const s: StatutTransfert = statutTransfert(t);
                return <Pastille ton={STATUT_TRANSFERT[s].ton}>{STATUT_TRANSFERT[s].libelle}</Pastille>;
              },
            },
          ]}
        />
      </Carte>
    </div>
  );
}
