"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Check, ChevronLeft, ClipboardList, FileText, RefreshCw, Settings, Wrench } from "lucide-react";
import { ChampSaisie } from "@/composants/transactions/ChampSaisie";
import { champsDesSections, sectionsNouveauVehicule, type ContexteNouveauVehicule, type SectionFormulaire } from "@/composants/flotte/sections-vehicule";
import { Numero } from "@/composants/interface/Numero";
import { enregistrerCreation } from "@/lib/clotures-demo";
import { apprendreVehicule } from "@/lib/parametres-demo";

/* ============================================================================
 * Nouveau véhicule — une page, six sections, sur le modèle de Fleetio
 * (demande du métier du 7 septembre 2026).
 *
 * Un rail à gauche pour passer d'une section à l'autre, des cartes à droite,
 * les actions en haut et en bas. Le rail dit quelle section manque encore
 * d'une valeur obligatoire. « Enregistrer et ajouter un autre » garde la
 * main pour une série de véhicules — les cinquante lourds du dossier.
 * ==========================================================================*/

const ICONES: Record<string, typeof FileText> = {
  details: FileText,
  entretien: Wrench,
  cycle: RefreshCw,
  finances: BarChart3,
  caracteristiques: ClipboardList,
  reglages: Settings,
};

const VALEURS_INITIALES: Record<string, string | boolean> = {
  categorie: "camion",
  statut: "en-service",
  regime: "exploitation",
  categorieFlotte: "interne",
  usage: "fourgon",
  energie: "gasoil",
  programmeEntretien: "famille",
  transportSpecial: false,
  engage: true,
  gpsActif: false,
};

function valeurSortie(type: string, saisie: string | boolean): unknown {
  if (type === "oui-non") return Boolean(saisie);
  const s = String(saisie).trim();
  if (s === "") return null;
  if (type === "nombre") {
    const n = Number(s.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return s;
}

export function EcranNouveauVehicule({ contexte }: { contexte: ContexteNouveauVehicule }) {
  const router = useRouter();
  /* Les sections se construisent au montage : marque, modèle et catégorie
     viennent des paramètres posés dans le navigateur. */
  const [sections, setSections] = useState<SectionFormulaire[]>([]);
  const [courante, setCourante] = useState("details");
  const [saisie, setSaisie] = useState<Record<string, string | boolean>>(VALEURS_INITIALES);
  const [tentative, setTentative] = useState(false);
  const [issue, setIssue] = useState<{ numero: string; suite: "liste" | "autre" } | { erreur: string } | null>(null);

  useEffect(() => {
    setSections(sectionsNouveauVehicule(contexte));
  }, [contexte]);

  const champs = useMemo(() => champsDesSections(sections), [sections]);
  const manquantsPar = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of sections) m.set(s.cle, s.cartes.flatMap((c) => c.champs).filter((c) => c.obligatoire && String(saisie[c.cle] ?? "").trim() === "").map((c) => c.libelle));
    return m;
  }, [sections, saisie]);
  const manquants = [...manquantsPar.values()].flat();
  const section = sections.find((s) => s.cle === courante) ?? sections[0] ?? null;

  function changer(cle: string, valeur: string | boolean) {
    setSaisie((s) => ({ ...s, [cle]: valeur }));
    setIssue(null);
  }

  function enregistrer(suite: "liste" | "autre") {
    setTentative(true);
    if (manquants.length > 0) {
      const premiere = sections.find((s) => (manquantsPar.get(s.cle) ?? []).length > 0);
      if (premiere) setCourante(premiere.cle);
      return;
    }
    const valeurs: Record<string, unknown> = {};
    for (const c of champs) valeurs[c.cle] = valeurSortie(c.type, saisie[c.cle] ?? "");
    const resultat = enregistrerCreation({ sujet: "flotte", type: "vehicule", champs, valeurs, motif: "" });
    if (resultat.issue !== "creee") {
      setIssue({ erreur: resultat.issue === "mois-clos" ? `Le mois ${resultat.mois} est clos : la création attend sa réouverture.` : "La création n'a pas pu être enregistrée." });
      return;
    }
    /* La marque et le modèle saisis entrent au référentiel ; un refus n'annule pas la création. */
    const marque = typeof valeurs.marque === "string" ? valeurs.marque : "";
    const modele = typeof valeurs.appellation === "string" ? valeurs.appellation : null;
    void apprendreVehicule(marque, modele).then((refus) => {
      if (refus) setIssue({ erreur: `Le véhicule est créé sous ${resultat.creation.numero}, mais le référentiel n'a pas retenu sa marque : ${refus}` });
    });
    if (suite === "liste") {
      router.push("/flotte");
      return;
    }
    setIssue({ numero: resultat.creation.numero, suite });
    setSaisie(VALEURS_INITIALES);
    setTentative(false);
    setCourante("details");
    setSections(sectionsNouveauVehicule(contexte));
  }

  const actions = (
    <>
      <Link href="/flotte" className="bouton-discret text-accent-fonce">
        Annuler
      </Link>
      <button type="button" onClick={() => enregistrer("autre")} className="bouton-secondaire">
        Enregistrer et ajouter un autre
      </button>
      <button type="button" onClick={() => enregistrer("liste")} className="bouton-principal">
        <Check className="size-4" strokeWidth={2.2} />
        Enregistrer le véhicule
      </button>
    </>
  );

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/flotte" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={2} />
          Flotte
        </Link>
      </nav>
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0">
          <h1 className="titre-page">Nouveau véhicule</h1>
          <p className="meta mt-1 text-[13px]">Six sections ; seules les valeurs marquées ● sont exigées, le reste se complète sur la fiche</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">{actions}</div>
      </div>

      {issue && "numero" in issue ? (
        <p className="flex items-center gap-2 rounded-[10px] bg-favorable-fond px-4 py-2.5 text-[13px] text-texte">
          <Check className="size-4 text-favorable" strokeWidth={2.2} />
          Véhicule créé sous le numéro <Numero valeur={issue.numero} />. Le formulaire est prêt pour le suivant.
        </p>
      ) : null}
      {issue && "erreur" in issue ? <p className="rounded-[10px] bg-defavorable-fond px-4 py-2.5 text-[13px] text-defavorable">{issue.erreur}</p> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Sections" className="carte h-fit py-2 lg:sticky lg:top-0">
          <ul className="flex flex-col">
            {sections.map((s) => {
              const Icone = ICONES[s.cle] ?? FileText;
              const manque = (manquantsPar.get(s.cle) ?? []).length;
              const active = section?.cle === s.cle;
              return (
                <li key={s.cle}>
                  <button
                    type="button"
                    onClick={() => setCourante(s.cle)}
                    aria-current={active}
                    className={`flex w-full items-center gap-3 border-l-[3px] px-4 py-2.5 text-left text-[13.5px] transition-colors ${active ? "border-l-accent bg-accent-fond font-semibold text-accent-fonce" : "border-l-transparent font-medium text-texte-2 hover:bg-surface-2 hover:text-texte"}`}
                  >
                    <Icone className="size-[18px] shrink-0" strokeWidth={1.7} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{s.libelle}</span>
                      <span className="meta block truncate text-[11.5px]">{s.precision}</span>
                    </span>
                    {manque > 0 ? (
                      <span className={`badge-texte shrink-0 rounded-full px-1.5 py-px ${tentative ? "bg-defavorable-fond text-defavorable" : "bg-surface-3 text-attenue"}`} title={`${manque} valeur${manque > 1 ? "s" : ""} obligatoire${manque > 1 ? "s" : ""} à renseigner`}>
                        {manque}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          {section?.cartes.map((carte) => (
            <section key={carte.titre} className="carte px-6 py-5">
              <h2 className="titre-bloc">{carte.titre}</h2>
              {carte.precision ? <p className="meta mt-0.5">{carte.precision}</p> : null}
              <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
                {carte.champs.map((c) => {
                  const large = c.type === "texte-long";
                  const vide = c.obligatoire && String(saisie[c.cle] ?? "").trim() === "";
                  return (
                    <label key={c.cle} className={`flex flex-col gap-1.5 ${large ? "md:col-span-2" : ""}`}>
                      <span className="label-champ">
                        {c.libelle}
                        {c.obligatoire ? <span className="text-defavorable"> ●</span> : null}
                      </span>
                      <ChampSaisie champ={c} valeur={saisie[c.cle] ?? ""} saisie={saisie} onChange={(v) => changer(c.cle, v)} invalide={tentative && vide} />
                    </label>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="flex flex-wrap items-center gap-2.5 border-t border-bordure pt-4">
            <p className="meta min-w-0 flex-1">
              {tentative && manquants.length ? <span className="font-medium text-defavorable">À renseigner : {manquants.map((m) => m.toLowerCase()).join(", ")}.</span> : "Un numéro unique sera attribué et la création tracée avec votre nom."}
            </p>
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}
