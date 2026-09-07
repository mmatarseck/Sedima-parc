"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { BUSINESS_UNIT, CLASSES_TON } from "@/domaine/libelles";
import { ETAT_LEGER, REGIME_USAGE, echeancierPlanCar, type Attributaire, type EtatLeger, type ForfaitCarburant, type RegimeUsage, type VehiculeLeger } from "@/domaine/parc-leger";
import type { ParametresParcLeger } from "@/domaine/parametres";
import { lireParametres } from "@/lib/parametres-demo";
import { montant, nombre } from "@/lib/format";

/* ============================================================================
 * Parc léger — véhicules de service, de fonction et plan car.
 *
 * Cadrage du 7 septembre 2026 : ces véhicules ne livrent pas, mais leur
 * maintenance est à la charge du parc et le carburant de leurs attributaires
 * est un forfait mensuel absorbé en charge. L'écran répond à trois questions :
 * qui tient quoi, dans quel état est le parc léger, et ce qu'il coûte chaque
 * mois — forfaits carburant en charge, mensualités du plan car en face.
 *
 * Les données viennent du dossier de la Direction des Opérations (inventaire
 * de mai, plan de cascade d'août 2026). Rien ne s'y saisit encore : c'est la
 * lecture qui vient d'abord, la saisie suivra avec la base.
 * ==========================================================================*/

type FiltreRegime = "tous" | RegimeUsage | "plan-car";
type FiltreEtat = "tous" | EtatLeger;

function Pilule<T extends string>({ etiquette, valeur, options, onChange }: { etiquette: string; valeur: T; options: { cle: T; libelle: string }[]; onChange: (v: T) => void }) {
  const actif = valeur !== "tous";
  const courant = options.find((o) => o.cle === valeur);
  return (
    <label className={`relative inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-3 text-[12.5px] transition-colors ${actif ? "border-accent bg-accent-fond text-accent-tres-fonce" : "border-bordure bg-surface text-texte-2 hover:border-accent hover:text-accent-fonce"}`}>
      <span className="whitespace-nowrap">
        {etiquette} <b className="font-semibold">{courant?.libelle ?? "tous"}</b>
      </span>
      <ChevronDown className="size-3 shrink-0 opacity-60" strokeWidth={2.2} />
      <select value={valeur} onChange={(e) => onChange(e.target.value as T)} aria-label={etiquette} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map((o) => (
          <option key={o.cle} value={o.cle}>
            {o.libelle}
          </option>
        ))}
      </select>
    </label>
  );
}

function Chiffre({ valeur, libelle, ton }: { valeur: string; libelle: string; ton?: "defavorable" | "vigilance" }) {
  return (
    <div className="carte flex min-w-[132px] flex-col gap-0.5 px-4 py-3">
      <span className={`text-[22px] leading-none font-bold tracking-[-0.03em] tabular-nums ${ton === "defavorable" ? "text-defavorable" : ton === "vigilance" ? "text-vigilance" : "text-texte"}`}>{valeur}</span>
      <span className="meta">{libelle}</span>
    </div>
  );
}

export function EcranParcLeger({ vehicules, attributaires, forfaits, aujourdhui }: { vehicules: VehiculeLeger[]; attributaires: Attributaire[]; forfaits: ForfaitCarburant[]; aujourdhui: string }) {
  const [regime, setRegime] = useState<FiltreRegime>("tous");
  const [etat, setEtat] = useState<FiltreEtat>("tous");
  const [departement, setDepartement] = useState<string>("tous");
  const [recherche, setRecherche] = useState("");
  const [parametres, setParametres] = useState<ParametresParcLeger | null>(null);
  useEffect(() => {
    setParametres(lireParametres().parcLeger);
  }, []);
  const regles = parametres ?? { planCarDureeMois: 60, planCarMensualite: 150_000, forfaitCarburantMensuel: 150_000 };

  const parId = useMemo(() => new Map(attributaires.map((a) => [a.id, a])), [attributaires]);
  const departements = useMemo(() => [...new Set(vehicules.map((v) => v.departement).filter((d): d is string => d !== null))].sort((a, b) => a.localeCompare(b, "fr")), [vehicules]);

  const retenus = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return vehicules.filter((v) => {
      if (regime === "plan-car" ? !v.planCar : regime !== "tous" && v.regime !== regime) return false;
      if (etat !== "tous" && v.etat !== etat) return false;
      if (departement !== "tous" && v.departement !== departement) return false;
      if (!q) return true;
      const a = v.attributaireId ? parId.get(v.attributaireId) : null;
      return [v.immatriculationAffichee, v.marque, v.modele, a?.nom, a?.fonction, v.departement, v.pool, v.lot].some((x) => x?.toLowerCase().includes(q));
    });
  }, [vehicules, regime, etat, departement, recherche, parId]);

  /* Ce que le parc léger coûte et rapporte chaque mois, à la règle des paramètres. */
  const chargeForfaits = forfaits.reduce((s, f) => s + (f.montantMensuel ?? regles.forfaitCarburantMensuel), 0);
  const planCars = vehicules.filter((v) => v.planCar);
  const mensualites = planCars.reduce((s, v) => s + (v.planCar!.mensualite ?? regles.planCarMensualite), 0);
  const compte = (f: (v: VehiculeLeger) => boolean) => vehicules.filter(f).length;

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran titre="Parc léger" sousTitre={`${vehicules.length} véhicules · ${compte((v) => v.regime === "service")} de service, ${compte((v) => v.regime === "fonction")} de fonction dont ${planCars.length} en plan car · dossier DO au ${aujourdhui.slice(8, 10)}/${aujourdhui.slice(5, 7)}/${aujourdhui.slice(0, 4)}`} />

      <div className="flex flex-wrap gap-3">
        <Chiffre valeur={nombre(compte((v) => v.etat === "actif"))} libelle="attribués et en circulation" />
        <Chiffre valeur={nombre(compte((v) => v.etat === "pool"))} libelle="en pool ou non affectés" />
        <Chiffre valeur={nombre(compte((v) => v.etat === "a-recevoir"))} libelle="neufs à recevoir (lot 2)" />
        <Chiffre valeur={nombre(compte((v) => v.etat === "panne"))} libelle="en panne" ton="vigilance" />
        <Chiffre valeur={nombre(compte((v) => v.etat === "a-reformer"))} libelle="à réformer" ton="defavorable" />
        <Chiffre valeur={`${montant(chargeForfaits)}`} libelle={`forfaits carburant par mois · ${forfaits.length} cartes`} />
        <Chiffre valeur={`${montant(mensualites)}`} libelle={`mensualités plan car par mois · ${planCars.length} véhicules`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Immatriculation, attributaire, fonction, lot…"
          aria-label="Rechercher dans le parc léger"
          className="h-7 w-[280px] rounded-full border border-bordure bg-surface px-3 text-[12.5px] outline-none placeholder:text-attenue focus:border-accent"
        />
        <Pilule
          etiquette="Régime"
          valeur={regime}
          options={[{ cle: "tous" as FiltreRegime, libelle: "tous" }, ...(Object.keys(REGIME_USAGE) as RegimeUsage[]).map((r) => ({ cle: r as FiltreRegime, libelle: REGIME_USAGE[r].libelle })), { cle: "plan-car" as FiltreRegime, libelle: "Plan car" }]}
          onChange={setRegime}
        />
        <Pilule etiquette="État" valeur={etat} options={[{ cle: "tous" as FiltreEtat, libelle: "tous" }, ...(Object.keys(ETAT_LEGER) as EtatLeger[]).map((e) => ({ cle: e as FiltreEtat, libelle: ETAT_LEGER[e].libelle }))]} onChange={setEtat} />
        <Pilule etiquette="Département" valeur={departement} options={[{ cle: "tous", libelle: "tous" }, ...departements.map((d) => ({ cle: d, libelle: d }))]} onChange={setDepartement} />
        <span className="meta ml-auto">
          {retenus.length} sur {vehicules.length}
        </span>
      </div>

      <Carte sansMarge>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] tracking-[0.06em] text-attenue uppercase">
                <th className="px-4 py-2.5 font-semibold">Immat.</th>
                <th className="px-3 py-2.5 font-semibold">Véhicule</th>
                <th className="px-3 py-2.5 font-semibold">Régime</th>
                <th className="px-3 py-2.5 font-semibold">Attributaire ou pool</th>
                <th className="px-3 py-2.5 font-semibold">Fonction</th>
                <th className="px-3 py-2.5 font-semibold">Département · BU</th>
                <th className="px-3 py-2.5 text-right font-semibold">Km</th>
                <th className="px-3 py-2.5 font-semibold">Charge mensuelle</th>
                <th className="px-3 py-2.5 font-semibold">État</th>
                <th className="px-3 py-2.5 font-semibold">Lot · observation</th>
              </tr>
            </thead>
            <tbody>
              {retenus.map((v) => {
                const a = v.attributaireId ? (parId.get(v.attributaireId) ?? null) : null;
                const forfait = a ? forfaits.find((f) => f.attributaireId === a.id) : null;
                const echeancier = v.planCar ? echeancierPlanCar(v.planCar, { mensualite: regles.planCarMensualite, dureeMois: regles.planCarDureeMois }, aujourdhui) : null;
                const definition = ETAT_LEGER[v.etat];
                return (
                  <tr key={v.id} className="border-t border-bordure align-top hover:bg-surface-2">
                    <td className="px-4 py-2">
                      <span className={`code block text-[12px] font-semibold ${v.immatriculation ? "text-accent-tres-fonce" : "text-attenue"}`}>{v.immatriculation ? v.immatriculationAffichee : "à immatriculer"}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="block font-medium text-texte">
                        {v.marque} {v.modele}
                      </span>
                      <span className="meta block">{[v.annee, v.categorie === "moto" ? "moto" : v.categorie === "bus" ? "bus" : null].filter(Boolean).join(" · ") || "—"}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="block text-texte">{REGIME_USAGE[v.regime].libelle}</span>
                      {v.planCar ? <span className="badge-texte mt-0.5 inline-block rounded-full bg-accent-fond px-2 py-px text-accent-tres-fonce">plan car</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`block ${a ? "font-medium text-texte" : "text-texte-2"}`}>{a?.nom ?? v.pool ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2 text-texte-2">{a?.fonction ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="block text-texte">{v.departement ?? "—"}</span>
                      <span className="meta block">{v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : "—"}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-texte-2">{v.kilometrage === null ? "—" : nombre(v.kilometrage)}</td>
                    <td className="px-3 py-2">
                      {forfait ? <span className="block text-texte">{montant(forfait.montantMensuel ?? regles.forfaitCarburantMensuel)} carburant</span> : null}
                      {echeancier ? (
                        <span className="block text-texte-2">
                          {montant(echeancier.mensualite)} plan car · {echeancier.moisPayes === null ? `${echeancier.dureeMois} mois, début à renseigner` : `${echeancier.moisPayes}/${echeancier.dureeMois} mois, cession ${echeancier.cessionPrevue}`}
                        </span>
                      ) : null}
                      {!forfait && !echeancier ? <span className="text-attenue">maintenance seule</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`badge-texte inline-block rounded-full px-2 py-px ${CLASSES_TON[definition.ton]}`} title={definition.precision}>
                        {definition.libelle}
                      </span>
                    </td>
                    <td className="max-w-[260px] px-3 py-2">
                      {v.lot ? <span className="code block text-[11px] text-accent-fonce">{v.lot}</span> : null}
                      <span className="meta block leading-snug">{v.commentaire ?? ""}</span>
                    </td>
                  </tr>
                );
              })}
              {retenus.length === 0 ? (
                <tr>
                  <td colSpan={10} className="meta px-4 py-8 text-center">
                    Aucun véhicule ne répond à ces filtres.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Carte>

      <Carte titre="Ce que le parc léger change aux charges" precision="Cadrage du 7 septembre 2026 — ce qui compte, et où">
        <ul className="flex flex-col gap-2 px-5 pb-4 text-[12.5px] text-texte-2">
          <li>
            <b className="font-semibold text-texte">Hors charges de livraison.</b> Aucun véhicule de service ou de fonction n&apos;entre dans le coût à la tonne ni dans le taux d&apos;externalisation : seul le régime « exploitation » y compte.
          </li>
          <li>
            <b className="font-semibold text-texte">Dans les charges de parc.</b> Leur maintenance et leur carburant comptent dans Coûts &amp; analyses et au budget, sur la BU de l&apos;agent. Le forfait carburant est une dépense mensuelle fixe, sans plein ni kilométrage : il n&apos;entre pas dans la consommation aux 100 km.
          </li>
          <li>
            <b className="font-semibold text-texte">Le plan car est une trace.</b> Mensualité et durée viennent des paramètres ({montant(regles.planCarMensualite)} sur {regles.planCarDureeMois} mois) tant que le dossier ne dit pas autre chose ; la retenue elle-même est une donnée de paie, suivie aux RH. La date de début de chaque plan reste à renseigner pour dater la cession.
          </li>
        </ul>
      </Carte>
    </div>
  );
}
