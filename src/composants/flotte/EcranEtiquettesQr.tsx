"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Printer } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { QrCode } from "@/composants/interface/QrCode";
import { urlVehicule } from "@/lib/qr";

/** Un véhicule à étiqueter. */
export interface VehiculeAEtiqueter {
  immatriculation: string;
  immatriculationAffichee: string;
  libelle: string;
  siteId: string | null;
  siteLibelle: string | null;
  detenteur: string | null;
}

/**
 * Flotte › Étiquettes QR — choisir les véhicules, par site ou un à un, et
 * tirer le PDF à imprimer : un code par étiquette, l'immatriculation en gros
 * dessous, huit par page A4. Collé sur le véhicule, le code ouvre sa fiche
 * rapide sur le téléphone.
 */
export function EcranEtiquettesQr({ vehicules, sites }: { vehicules: VehiculeAEtiqueter[]; sites: { id: string; libelle: string }[] }) {
  const [site, setSite] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [origine, setOrigine] = useState("");
  useEffect(() => setOrigine(window.location.origin), []);

  const visibles = useMemo(() => {
    const t = recherche.trim().toUpperCase().replace(/[\s-]/g, "");
    return vehicules.filter((v) => (site === "tous" || v.siteId === site) && (!t || v.immatriculation.includes(t) || v.libelle.toUpperCase().includes(recherche.trim().toUpperCase())));
  }, [vehicules, site, recherche]);
  const toutesCochees = visibles.length > 0 && visibles.every((v) => choisis.has(v.immatriculation));
  const retenus = vehicules.filter((v) => choisis.has(v.immatriculation));
  const apercu = retenus[0] ?? visibles[0] ?? null;

  function basculer(immat: string) {
    setChoisis((s) => {
      const n = new Set(s);
      if (n.has(immat)) n.delete(immat);
      else n.add(immat);
      return n;
    });
  }
  function toutCocher() {
    setChoisis((s) => {
      const n = new Set(s);
      if (toutesCochees) visibles.forEach((v) => n.delete(v.immatriculation));
      else visibles.forEach((v) => n.add(v.immatriculation));
      return n;
    });
  }

  const lienPdf = retenus.length > 0 ? `/flotte/etiquettes/qr.pdf?immat=${retenus.map((v) => v.immatriculation).join(",")}` : null;

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/flotte" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={2} />
          Flotte
        </Link>
      </nav>
      <TitreEcran
        titre="Étiquettes QR"
        sousTitre="Un code par véhicule, l'immatriculation en gros dessous, huit par page A4. Collé sur le véhicule, il ouvre sa fiche rapide sur le téléphone."
        actions={
          <>
            <a href="/flotte/etiquettes/qr.pdf?tous=1" target="_blank" rel="noopener" className="bouton-secondaire">
              <Printer className="size-4 text-texte-2" strokeWidth={1.7} />
              Tout le parc ({vehicules.length})
            </a>
            <a href={lienPdf ?? "#"} target="_blank" rel="noopener" aria-disabled={!lienPdf} className={`bouton-principal ${lienPdf ? "" : "pointer-events-none opacity-50"}`}>
              <Printer className="size-4" strokeWidth={2} />
              PDF des {retenus.length} choisi{retenus.length > 1 ? "s" : ""}
            </a>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Carte titre="Les véhicules" precision="Cochez un à un, ou tout un site." sansMarge>
          <div className="flex flex-wrap items-center gap-2 border-b border-bordure px-5 py-3">
            <select value={site} onChange={(e) => setSite(e.target.value)} className="h-9 rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent" aria-label="Site">
              <option value="tous">Tous les sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.libelle}
                </option>
              ))}
            </select>
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Plaque, marque, modèle" className="h-9 w-[240px] rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent" />
            <label className="ml-auto inline-flex items-center gap-2 text-[12.5px] font-medium text-texte">
              <input type="checkbox" checked={toutesCochees} onChange={toutCocher} className="size-4 accent-accent" />
              Tout cocher ({visibles.length})
            </label>
          </div>
          <div className="defilement-discret max-h-[560px] overflow-y-auto">
            {visibles.length === 0 ? <p className="meta px-5 py-4">Aucun véhicule.</p> : null}
            {visibles.map((v) => (
              <label key={v.immatriculation} className="flex items-center gap-3 border-b border-bordure px-5 py-2 last:border-b-0 hover:bg-surface-2">
                <input type="checkbox" checked={choisis.has(v.immatriculation)} onChange={() => basculer(v.immatriculation)} className="size-4 accent-accent" />
                <span className="code w-[110px] shrink-0 font-medium text-texte">{v.immatriculationAffichee}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-texte-2">
                  {v.libelle}
                  {v.detenteur ? ` · ${v.detenteur}` : ""}
                </span>
                <span className="meta shrink-0">{v.siteLibelle ?? "—"}</span>
              </label>
            ))}
          </div>
        </Carte>

        <Carte titre="Aperçu de l'étiquette" precision={apercu ? `${apercu.immatriculationAffichee} · ${retenus.length} choisi${retenus.length > 1 ? "s" : ""}` : "Cochez un véhicule"}>
          {apercu ? (
            <div className="mx-5 mb-4 flex flex-col items-center gap-2 rounded-[12px] border border-dashed border-bordure-champ bg-white p-5">
              <QrCode texte={urlVehicule(origine || "https://parc.sedima.sn", apercu.immatriculation)} taille={180} libelle={`QR code de ${apercu.immatriculationAffichee}`} />
              <span className="code text-[22px] font-bold tracking-[0.04em] text-encre">{apercu.immatriculationAffichee}</span>
              <span className="text-[11px] text-attenue">{apercu.libelle}</span>
              <span className="text-[9px] text-attenue">SEDIMA Parc · scanner pour ouvrir le véhicule</span>
            </div>
          ) : null}
          <p className="meta px-5 pb-4">Imprimer sur papier autocollant ou plastifier : la correction d&apos;erreur du code tolère une étiquette un peu abîmée.</p>
        </Carte>
      </div>
    </div>
  );
}
