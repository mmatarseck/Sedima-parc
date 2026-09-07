"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, RotateCcw } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { peutCloturer } from "@/domaine/cloture";
import { PARAMETRES_DEFAUT, PARC_LEGER_DEFAUT, type Parametres, type ParametresParcLeger } from "@/domaine/parametres";
import { trouverRole } from "@/domaine/roles";
import { montant } from "@/lib/format";
import { ecrireParametres, lireParametres } from "@/lib/parametres-demo";
import { lireRole } from "@/lib/session-demo";

/**
 * Paramètres › Parc léger — les valeurs par défaut du plan car et du forfait
 * carburant, données par le métier le 7 septembre 2026 : cinq ans, 150 000 F
 * par mois. Chaque dossier peut s'en écarter ; ce qui se règle ici vaut pour
 * tous ceux qui ne disent rien.
 */
export function EcranParametresParcLeger() {
  const router = useRouter();
  const [p, setP] = useState<Parametres>(PARAMETRES_DEFAUT);
  const [valeurs, setValeurs] = useState<Record<keyof ParametresParcLeger, string>>({ planCarDureeMois: "", planCarMensualite: "", forfaitCarburantMensuel: "" });
  const [habilite, setHabilite] = useState(false);
  const [nomRole, setNomRole] = useState("");
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const lu = lireParametres();
    setP(lu);
    setValeurs({ planCarDureeMois: String(lu.parcLeger.planCarDureeMois), planCarMensualite: String(lu.parcLeger.planCarMensualite), forfaitCarburantMensuel: String(lu.parcLeger.forfaitCarburantMensuel) });
    const r = trouverRole(lireRole());
    setHabilite(peutCloturer(r.role));
    setNomRole(r.libelle);
  }, []);

  const nombres = {
    planCarDureeMois: Number(valeurs.planCarDureeMois.replace(/\s/g, "")),
    planCarMensualite: Number(valeurs.planCarMensualite.replace(/\s/g, "")),
    forfaitCarburantMensuel: Number(valeurs.forfaitCarburantMensuel.replace(/\s/g, "")),
  };
  const valide = Object.values(nombres).every((n) => Number.isFinite(n) && n > 0);
  const change = valide && (nombres.planCarDureeMois !== p.parcLeger.planCarDureeMois || nombres.planCarMensualite !== p.parcLeger.planCarMensualite || nombres.forfaitCarburantMensuel !== p.parcLeger.forfaitCarburantMensuel);
  const modifie = nombres.planCarDureeMois !== PARC_LEGER_DEFAUT.planCarDureeMois || nombres.planCarMensualite !== PARC_LEGER_DEFAUT.planCarMensualite || nombres.forfaitCarburantMensuel !== PARC_LEGER_DEFAUT.forfaitCarburantMensuel;

  function enregistrer() {
    if (!valide) return;
    const suite: Parametres = { ...p, parcLeger: { planCarDureeMois: Math.round(nombres.planCarDureeMois), planCarMensualite: Math.round(nombres.planCarMensualite), forfaitCarburantMensuel: Math.round(nombres.forfaitCarburantMensuel) } };
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
    setValeurs({ planCarDureeMois: String(PARC_LEGER_DEFAUT.planCarDureeMois), planCarMensualite: String(PARC_LEGER_DEFAUT.planCarMensualite), forfaitCarburantMensuel: String(PARC_LEGER_DEFAUT.forfaitCarburantMensuel) });
    setEnregistre(false);
  }

  const champ = "h-9 w-[180px] rounded-[8px] border border-bordure-champ bg-surface px-3 text-right text-[13px] tabular-nums outline-none focus:border-accent disabled:bg-surface-2 disabled:text-texte-2";
  const lignes: { cle: keyof ParametresParcLeger; libelle: string; precision: string; unite: string }[] = [
    { cle: "planCarDureeMois", libelle: "Durée du plan car", precision: "Au terme, le véhicule est cédé à l'attributaire", unite: "mois" },
    { cle: "planCarMensualite", libelle: "Mensualité du plan car", precision: "Ce que l'attributaire paie chaque mois — une trace, la retenue est une donnée de paie", unite: "F par mois" },
    { cle: "forfaitCarburantMensuel", libelle: "Forfait carburant des véhicules de fonction", precision: "Versé sur la carte carburant de l'attributaire, absorbé en charge sur la BU de l'agent", unite: "F par mois" },
  ];

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={2} />
          Paramètres
        </Link>
      </nav>
      <TitreEcran
        titre="Parc léger"
        sousTitre={habilite ? "Les valeurs par défaut du plan car et du forfait carburant — chaque dossier peut préciser les siennes" : `Lecture seule — le réglage relève de la direction et de l'administrateur (vous êtes ${nomRole.toLowerCase()})`}
        actions={
          habilite ? (
            <>
              {erreur ? <span className="max-w-[360px] text-[12.5px] leading-[1.4] text-defavorable">{erreur}</span> : null}
              <button type="button" onClick={reinitialiser} disabled={!modifie} className="bouton-secondaire disabled:cursor-not-allowed disabled:opacity-50">
                <RotateCcw className="size-4 text-texte-2" strokeWidth={1.7} />
                Valeurs par défaut
              </button>
              <button type="button" onClick={enregistrer} disabled={!valide || !change} className="bouton-principal disabled:cursor-not-allowed disabled:opacity-50" title={valide ? undefined : "Chaque valeur doit être un nombre positif"}>
                <Check className="size-4" strokeWidth={2.2} />
                {enregistre ? "Enregistré" : "Enregistrer"}
              </button>
            </>
          ) : null
        }
      />

      <Carte titre="Plan car et forfait carburant" precision={`Aujourd'hui : ${p.parcLeger.planCarDureeMois} mois, ${montant(p.parcLeger.planCarMensualite)} par mois, forfait ${montant(p.parcLeger.forfaitCarburantMensuel)} par mois`}>
        <div className="flex flex-col divide-y divide-bordure px-5 pb-2">
          {lignes.map((l) => (
            <label key={l.cle} className="flex flex-wrap items-center gap-4 py-3">
              <span className="min-w-[260px] flex-1">
                <span className="block text-[13px] font-medium text-texte">{l.libelle}</span>
                <span className="meta block">{l.precision}</span>
              </span>
              <span className="flex items-center gap-2">
                <input type="text" inputMode="numeric" value={valeurs[l.cle]} disabled={!habilite} onChange={(e) => { setValeurs((v) => ({ ...v, [l.cle]: e.target.value })); setEnregistre(false); }} className={champ} aria-label={l.libelle} />
                <span className="meta w-[80px]">{l.unite}</span>
              </span>
            </label>
          ))}
        </div>
      </Carte>

      <Carte titre="Ce que ces valeurs produisent" precision="À la règle courante, pour un plan car qui ne précise rien">
        <p className="px-5 pb-4 text-[12.5px] leading-[1.5] text-texte-2">
          Un plan car vaut <b className="font-semibold text-texte">{montant(nombres.planCarMensualite * nombres.planCarDureeMois || 0)}</b> sur {nombres.planCarDureeMois || 0} mois. Le forfait carburant d&apos;un véhicule de fonction pèse{" "}
          <b className="font-semibold text-texte">{montant((nombres.forfaitCarburantMensuel || 0) * 12)}</b> par an sur la BU de l&apos;agent. Ces montants sont des valeurs par défaut : le dossier de chaque véhicule peut porter les siens.
        </p>
      </Carte>
    </div>
  );
}
