"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, RotateCcw } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { peutCloturer } from "@/domaine/cloture";
import { CAISSE_DEFAUT, CUVE_DEFAUT, PARAMETRES_DEFAUT, type Parametres } from "@/domaine/parametres";
import { trouverRole } from "@/domaine/roles";
import { nombre } from "@/lib/format";
import { ecrireParametres, lireParametres } from "@/lib/parametres-demo";
import { lireRole } from "@/lib/session-demo";

interface Props {
  /** Ce que la situation du jour dit, aux paramètres en vigueur : pour voir ce qu'un réglage produit. */
  soldeDuJour: number | null;
  stockDuJour: number | null;
  capaciteCuve: number;
}

type Cle = "soldeInitial" | "seuil" | "stockInitial";

const CHAMPS: { cle: Cle; libelle: string; precision: string; unite: string }[] = [
  { cle: "soldeInitial", libelle: "Solde reporté de la caisse parc", precision: "Le solde à l'ouverture du journal, avant le premier mouvement enregistré : le report de l'exercice précédent", unite: "F" },
  { cle: "seuil", libelle: "Seuil de réapprovisionnement", precision: "Sous ce solde, la pastille « Solde de caisse » passe au rouge", unite: "F" },
  { cle: "stockInitial", libelle: "Stock reporté de la cuve interne", precision: "Le stock à l'ouverture du journal, avant la première livraison enregistrée ; un relevé de jauge recale ensuite le stock", unite: "L" },
];

/**
 * Paramètres › Caisse et cuve — les deux points de départ dont le solde et le
 * stock se déduisent, et le seuil de la caisse. Le solde et le stock du jour
 * sont montrés, recalculés à la valeur saisie, pour voir ce qu'un réglage
 * produit avant de l'enregistrer.
 */
export function EcranCaisseCuve({ soldeDuJour, stockDuJour, capaciteCuve }: Props) {
  const router = useRouter();
  const [p, setP] = useState<Parametres>(PARAMETRES_DEFAUT);
  const [valeurs, setValeurs] = useState<Record<Cle, string>>({ soldeInitial: "", seuil: "", stockInitial: "" });
  const [habilite, setHabilite] = useState(false);
  const [nomRole, setNomRole] = useState("");
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const lu = lireParametres();
    setP(lu);
    setValeurs({ soldeInitial: String(lu.caisse.soldeInitial), seuil: String(lu.caisse.seuil), stockInitial: String(lu.cuve.stockInitial) });
    const r = trouverRole(lireRole());
    setHabilite(peutCloturer(r.role));
    setNomRole(r.libelle);
  }, []);

  const lire = (cle: Cle) => Number((valeurs[cle] ?? "").replace(/\s/g, ""));
  const nombres: Record<Cle, number> = { soldeInitial: lire("soldeInitial"), seuil: lire("seuil"), stockInitial: lire("stockInitial") };
  const valide = CHAMPS.every((c) => Number.isFinite(nombres[c.cle]) && nombres[c.cle] >= 0);
  const courant: Record<Cle, number> = { soldeInitial: p.caisse.soldeInitial, seuil: p.caisse.seuil, stockInitial: p.cuve.stockInitial };
  const change = valide && CHAMPS.some((c) => Math.round(nombres[c.cle]) !== courant[c.cle]);
  const defauts: Record<Cle, number> = { soldeInitial: CAISSE_DEFAUT.soldeInitial, seuil: CAISSE_DEFAUT.seuil, stockInitial: CUVE_DEFAUT.stockInitial };
  const modifie = CHAMPS.some((c) => nombres[c.cle] !== defauts[c.cle]);

  /* Le solde du jour aux paramètres en vigueur, déplacé du nouvel écart de report : c'est le même journal. */
  const soldeSimule = soldeDuJour === null || !valide ? null : soldeDuJour - courant.soldeInitial + Math.round(nombres.soldeInitial);
  const stockSimule = stockDuJour === null || !valide ? null : Math.max(0, stockDuJour - courant.stockInitial + Math.round(nombres.stockInitial));
  const rouge = soldeSimule !== null && valide && soldeSimule < Math.round(nombres.seuil);

  function enregistrer() {
    if (!valide) return;
    const suite: Parametres = { ...p, caisse: { soldeInitial: Math.round(nombres.soldeInitial), seuil: Math.round(nombres.seuil) }, cuve: { stockInitial: Math.round(nombres.stockInitial) } };
    setP(suite);
    setErreur(null);
    void ecrireParametres(suite).then((refus) => {
      if (refus) {
        setErreur(refus);
        return;
      }
      setEnregistre(true);
      router.refresh();
      setTimeout(() => setEnregistre(false), 1800);
    });
  }

  function reinitialiser() {
    setValeurs({ soldeInitial: String(defauts.soldeInitial), seuil: String(defauts.seuil), stockInitial: String(defauts.stockInitial) });
    setEnregistre(false);
  }

  const champ = "h-9 w-[140px] rounded-[8px] border border-bordure-champ bg-surface px-3 text-right text-[13px] tabular-nums outline-none focus:border-accent disabled:bg-surface-2 disabled:text-texte-2";

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={2} />
          Paramètres
        </Link>
      </nav>
      <TitreEcran
        titre="Caisse et cuve"
        sousTitre={habilite ? "Les points de départ des deux journaux et le seuil de la caisse — le solde et le stock du jour sont recalculés à côté" : `Lecture seule — le réglage relève de la direction et de l'administrateur (vous êtes ${nomRole.toLowerCase()})`}
        actions={
          habilite ? (
            <>
              {erreur ? <span className="max-w-[360px] text-[12.5px] leading-[1.4] text-defavorable">{erreur}</span> : null}
              <button type="button" onClick={reinitialiser} disabled={!modifie} className="bouton-secondaire disabled:cursor-not-allowed disabled:opacity-50">
                <RotateCcw className="size-4 text-texte-2" strokeWidth={1.7} />
                Valeurs par défaut
              </button>
              <button type="button" onClick={enregistrer} disabled={!valide || !change} className="bouton-principal disabled:cursor-not-allowed disabled:opacity-50" title={valide ? undefined : "Chaque valeur doit être un nombre entier positif ou nul"}>
                <Check className="size-4" strokeWidth={2.2} />
                {enregistre ? "Enregistré" : "Enregistrer"}
              </button>
            </>
          ) : null
        }
      />

      <Carte titre="Caisse parc" precision="Le solde ne se saisit jamais : il se déduit du journal à partir du report">
        <div className="flex flex-col divide-y divide-bordure px-5 pb-2">
          {CHAMPS.filter((c) => c.cle !== "stockInitial").map((c) => (
            <label key={c.cle} className="flex flex-wrap items-center gap-4 py-3">
              <span className="min-w-[260px] flex-1">
                <span className="block text-[13px] font-medium text-texte">{c.libelle}</span>
                <span className="meta block">{c.precision}</span>
              </span>
              <span className="flex items-center gap-2">
                <input type="text" inputMode="numeric" value={valeurs[c.cle]} disabled={!habilite} onChange={(e) => { setValeurs((v) => ({ ...v, [c.cle]: e.target.value })); setEnregistre(false); }} className={champ} aria-label={c.libelle} />
                <span className="meta w-[40px]">{c.unite}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="px-5 pb-4 text-[12.5px] leading-[1.5] text-texte-2">
          {soldeSimule === null ? (
            <>Le solde du jour n&apos;est pas connu.</>
          ) : (
            <>
              Aux valeurs saisies, la caisse tient aujourd&apos;hui <b className={`font-semibold ${rouge ? "text-defavorable" : "text-texte"}`}>{nombre(soldeSimule)} F</b>
              {rouge ? <>, sous le seuil : la pastille serait au rouge.</> : <>, au-dessus du seuil.</>}
            </>
          )}
        </p>
      </Carte>

      <Carte titre="Cuve interne" precision={`Contenance ${nombre(capaciteCuve)} L, réglée dans Énergie et carburant`}>
        <div className="flex flex-col divide-y divide-bordure px-5 pb-2">
          {CHAMPS.filter((c) => c.cle === "stockInitial").map((c) => (
            <label key={c.cle} className="flex flex-wrap items-center gap-4 py-3">
              <span className="min-w-[260px] flex-1">
                <span className="block text-[13px] font-medium text-texte">{c.libelle}</span>
                <span className="meta block">{c.precision}</span>
              </span>
              <span className="flex items-center gap-2">
                <input type="text" inputMode="numeric" value={valeurs[c.cle]} disabled={!habilite} onChange={(e) => { setValeurs((v) => ({ ...v, [c.cle]: e.target.value })); setEnregistre(false); }} className={champ} aria-label={c.libelle} />
                <span className="meta w-[40px]">{c.unite}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="px-5 pb-4 text-[12.5px] leading-[1.5] text-texte-2">
          {stockSimule === null ? (
            <>Le stock du jour n&apos;est pas connu.</>
          ) : (
            <>
              Aux valeurs saisies, la cuve contient aujourd&apos;hui <b className="font-semibold text-texte">{nombre(stockSimule)} L</b> sur {nombre(capaciteCuve)}. Un relevé de jauge postérieur à l&apos;ouverture du journal efface l&apos;effet du report : seul ce qui suit le dernier relevé compte.
            </>
          )}
        </p>
      </Carte>
    </div>
  );
}
