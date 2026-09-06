"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, Plus, RotateCcw, Trash2 } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { Echeance } from "@/composants/interface/Pastille";
import { peutCloturer } from "@/domaine/cloture";
import { BAREMES_DEFAUT, ENERGIE_DEFAUT, PARAMETRES_DEFAUT, baremeALaDate, type BaremeEnergie, type Parametres } from "@/domaine/parametres";
import { trouverRole } from "@/domaine/roles";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { date as formaterDate, montant, nombre } from "@/lib/format";
import { ecrireParametres, lireParametres } from "@/lib/parametres-demo";
import { lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Paramètres › Énergie et carburant.
 *
 * Décision du métier du 3 septembre 2026 : les prix se tiennent ici, pas dans
 * le code. Demande du 4 septembre : ils se tiennent **datés**.
 *
 * Un prix d'hydrocarbure change plusieurs fois par an, et un prix unique
 * appliqué à tout l'historique réécrit le passé — la dépense de carburant de
 * janvier 2025 changerait de montant parce que le gasoil a baissé depuis. Un
 * fait se valorise au prix de son jour.
 *
 * L'écran tient donc une **suite de barèmes** : chacun entre en vigueur à sa
 * date et vaut jusqu'au suivant. Le dernier est celui qu'appliquent les
 * saisies du jour ; les autres restent, parce qu'ils expliquent les montants
 * déjà enregistrés.
 * ==========================================================================*/

const CHAMPS = [
  { cle: "prixLitreGasoil", libelle: "Gasoil station", unite: "F / L" },
  { cle: "prixLitreEssence", libelle: "Essence station", unite: "F / L" },
  { cle: "prixKwh", libelle: "Électricité", unite: "F / kWh" },
  { cle: "prixLitreCuve", libelle: "Gasoil livré en cuve", unite: "F / L" },
] as const;

type ClePrix = (typeof CHAMPS)[number]["cle"];

export function EcranEnergie() {
  const router = useRouter();
  const [p, setP] = useState<Parametres>(PARAMETRES_DEFAUT);
  const [baremes, setBaremes] = useState<BaremeEnergie[]>(BAREMES_DEFAUT);
  const [capacite, setCapacite] = useState(String(ENERGIE_DEFAUT.capaciteCuve));
  const [habilite, setHabilite] = useState(false);
  const [nomRole, setNomRole] = useState("");
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    const lu = lireParametres();
    setP(lu);
    setBaremes(lu.energie.baremes.map((b) => ({ ...b })));
    setCapacite(String(lu.energie.capaciteCuve));
    const r = trouverRole(lireRole());
    setHabilite(peutCloturer(r.role));
    setNomRole(r.libelle);
  }, []);

  const capaciteNombre = Number(capacite.replace(/\s/g, "").replace(",", "."));
  const valide = baremes.every((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.debut) && CHAMPS.every((c) => Number.isFinite(b[c.cle]) && b[c.cle] >= 0)) && Number.isFinite(capaciteNombre) && capaciteNombre > 0;
  const change = JSON.stringify({ baremes, capaciteCuve: capaciteNombre }) !== JSON.stringify({ baremes: p.energie.baremes, capaciteCuve: p.energie.capaciteCuve });
  const modifie = JSON.stringify(baremes) !== JSON.stringify(BAREMES_DEFAUT) || capaciteNombre !== ENERGIE_DEFAUT.capaciteCuve;

  /* Le barème en vigueur aujourd'hui, sur la saisie en cours : c'est lui que
     les formulaires appliqueront après enregistrement. */
  const enVigueur = baremeALaDate(DATE_REFERENCE, { ...p, energie: { baremes: [...baremes].sort((a, b) => a.debut.localeCompare(b.debut)), capaciteCuve: capaciteNombre } });

  function changerBareme(index: number, cle: "debut" | ClePrix | "source", valeur: string) {
    setBaremes((liste) =>
      liste.map((b, i) => {
        if (i !== index) return b;
        if (cle === "debut" || cle === "source") return { ...b, [cle]: valeur };
        const n = Number(valeur.replace(/\s/g, "").replace(",", "."));
        return { ...b, [cle]: Number.isFinite(n) ? n : Number.NaN };
      }),
    );
    setEnregistre(false);
  }

  function ajouter() {
    const dernier = baremes.at(-1);
    setBaremes((liste) => [
      ...liste,
      {
        debut: DATE_REFERENCE,
        prixLitreGasoil: dernier?.prixLitreGasoil ?? 0,
        prixLitreEssence: dernier?.prixLitreEssence ?? 0,
        prixKwh: dernier?.prixKwh ?? 0,
        prixLitreCuve: dernier?.prixLitreCuve ?? 0,
        source: "",
      },
    ]);
    setEnregistre(false);
  }

  function retirer(index: number) {
    setBaremes((liste) => (liste.length > 1 ? liste.filter((_, i) => i !== index) : liste));
    setEnregistre(false);
  }

  function enregistrer() {
    if (!valide) return;
    /* Retriés à l'enregistrement : un barème ajouté pour un mois passé doit se
       ranger à sa place, sinon la recherche par date rendrait le mauvais prix. */
    const suite: Parametres = { ...p, energie: { baremes: [...baremes].sort((a, b) => a.debut.localeCompare(b.debut)), capaciteCuve: capaciteNombre } };
    setP(suite);
    setBaremes(suite.energie.baremes);
    ecrireParametres(suite);
    setEnregistre(true);
    /* Les pages rendues par le serveur relisent le cookie : on les rafraîchit. */
    router.refresh();
    setTimeout(() => setEnregistre(false), 1800);
  }

  function reinitialiser() {
    setBaremes(BAREMES_DEFAUT.map((b) => ({ ...b })));
    setCapacite(String(ENERGIE_DEFAUT.capaciteCuve));
    setEnregistre(false);
  }

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Paramètres
        </Link>
      </nav>
      <TitreEcran
        titre="Énergie et carburant"
        sousTitre={
          habilite
            ? `${baremes.length} barèmes datés · en vigueur depuis le ${formaterDate(enVigueur.debut)} : gasoil ${montant(enVigueur.prixLitreGasoil)}/L · essence ${montant(enVigueur.prixLitreEssence)}/L · kWh ${montant(enVigueur.prixKwh)} · cuve ${montant(enVigueur.prixLitreCuve)}/L`
            : `Lecture seule — le réglage relève de la direction et de l'administrateur (vous êtes ${nomRole.toLowerCase()})`
        }
        actions={
          habilite ? (
            <>
              <button type="button" onClick={reinitialiser} disabled={!modifie} className="bouton-secondaire disabled:cursor-not-allowed disabled:opacity-50">
                <RotateCcw className="size-4 text-texte-2" strokeWidth={1.7} />
                Barèmes par défaut
              </button>
              <button type="button" onClick={enregistrer} disabled={!valide || !change} className="bouton-principal disabled:cursor-not-allowed disabled:opacity-50" title={valide ? undefined : "Une date ou un prix n'est pas valide"}>
                <Check className="size-4" strokeWidth={2.2} />
                {enregistre ? "Enregistré" : "Enregistrer"}
              </button>
            </>
          ) : null
        }
      />

      <Carte
        titre="Historique des prix"
        precision="Chaque barème vaut à partir de sa date d'effet, jusqu'au suivant. Un plein, une livraison, une dotation se valorisent au barème de leur jour."
        action={
          habilite ? (
            <button type="button" onClick={ajouter} className="bouton-secondaire h-9">
              <Plus className="size-4" strokeWidth={2} />
              Nouveau barème
            </button>
          ) : null
        }
        sansMarge
      >
        <div className="defilement-discret overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-5 text-left whitespace-nowrap">En vigueur le</th>
                {CHAMPS.map((c) => (
                  <th key={c.cle} className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-3 text-right whitespace-nowrap">
                    {c.libelle}
                  </th>
                ))}
                <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-5 text-left whitespace-nowrap">Source</th>
                <th className="h-10 w-12 border-y border-bordure bg-surface-2 p-0" aria-label="Retirer" />
              </tr>
            </thead>
            <tbody>
              {baremes.map((b, i) => {
                const courant = b.debut === enVigueur.debut;
                const futur = b.debut > DATE_REFERENCE;
                return (
                  <tr key={`${b.debut}-${i}`} className={`group ${courant ? "bg-accent-fond/40" : "hover:bg-surface-2"}`}>
                    <td className="h-12 border-b border-bordure px-5 last:border-b-0">
                      <span className="flex items-center gap-2">
                        <input
                          type="date"
                          value={b.debut}
                          disabled={!habilite}
                          onChange={(e) => changerBareme(i, "debut", e.target.value)}
                          aria-label={`Date d'effet du barème ${i + 1}`}
                          className="code h-8 rounded-[8px] border border-bordure-champ bg-surface px-2 text-[12.5px] text-texte outline-none focus:border-accent disabled:border-transparent disabled:bg-transparent"
                        />
                        {courant ? <Echeance ton="favorable">en vigueur</Echeance> : futur ? <Echeance ton="vigilance">à venir</Echeance> : null}
                      </span>
                    </td>
                    {CHAMPS.map((c) => (
                      <td key={c.cle} className="h-12 border-b border-bordure px-3 text-right last:border-b-0">
                        <input
                          inputMode="decimal"
                          value={Number.isFinite(b[c.cle]) ? String(b[c.cle]) : ""}
                          disabled={!habilite}
                          onChange={(e) => changerBareme(i, c.cle, e.target.value)}
                          aria-label={`${c.libelle} au ${b.debut}`}
                          className={`code h-8 w-[92px] rounded-[8px] border bg-surface px-2 text-right text-[12.5px] text-texte outline-none focus:border-accent disabled:border-transparent disabled:bg-transparent ${
                            Number.isFinite(b[c.cle]) && b[c.cle] >= 0 ? "border-bordure-champ" : "border-defavorable"
                          }`}
                        />
                      </td>
                    ))}
                    <td className="h-12 border-b border-bordure px-5 last:border-b-0">
                      <input
                        value={b.source}
                        disabled={!habilite}
                        placeholder="Arrêté, facture, relevé…"
                        onChange={(e) => changerBareme(i, "source", e.target.value)}
                        aria-label={`Source du barème du ${b.debut}`}
                        className="h-8 w-full min-w-[180px] rounded-[8px] border border-bordure-champ bg-surface px-2 text-[12.5px] text-texte-2 outline-none focus:border-accent disabled:border-transparent disabled:bg-transparent"
                      />
                    </td>
                    <td className="h-12 border-b border-bordure p-0 text-center last:border-b-0">
                      {habilite && baremes.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => retirer(i)}
                          title="Retirer ce barème"
                          className="grid size-7 place-items-center rounded-full text-attenue opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-3 hover:text-defavorable focus-visible:opacity-100"
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.8} />
                          <span className="sr-only">Retirer</span>
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="meta px-5 py-3">
          L&apos;historique commence le {formaterDate(baremes[0]?.debut ?? DATE_REFERENCE)}. Avant cette date, faute de mieux, c&apos;est le premier barème qui s&apos;applique — et il vaut mieux le
          savoir que de croire à un prix nul.
        </p>
      </Carte>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Carte titre="Cuve interne" precision="La contenance n'est pas un prix : elle ne se date pas" sansMarge>
          <div className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-texte">Contenance de la cuve</span>
              <span className="meta block">Borne le stock du journal ; sous 20 %, la cuve est à réapprovisionner</span>
            </div>
            <label className="flex items-center gap-2">
              <input
                inputMode="decimal"
                value={capacite}
                disabled={!habilite}
                onChange={(e) => {
                  setCapacite(e.target.value);
                  setEnregistre(false);
                }}
                aria-label="Contenance de la cuve interne"
                className={`code h-9 w-[130px] rounded-[10px] border bg-surface px-3 text-right text-[13px] text-texte outline-none focus:border-accent disabled:border-transparent disabled:bg-transparent ${
                  Number.isFinite(capaciteNombre) && capaciteNombre > 0 ? "border-bordure-champ" : "border-defavorable"
                }`}
              />
              <span className="meta w-[56px]">L</span>
            </label>
          </div>
          <p className="meta border-t border-bordure px-5 py-3">Stock plein : {nombre(Number.isFinite(capaciteNombre) ? capaciteNombre : 0)} litres.</p>
        </Carte>

        <Carte titre="Ce que ces barèmes changent" precision="Une seule vérité pour les formulaires et pour l'historique">
          <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-texte-2">
            <li>
              <span className="font-medium text-texte">Plein depuis une fiche véhicule</span> — le prix proposé est celui de l&apos;énergie du véhicule <em>au barème du jour</em> ; pour un électrique, le
              prix du kWh.
            </li>
            <li>
              <span className="font-medium text-texte">Livraison de la cuve</span> — le prix du litre livré en citerne du jour est proposé ; le montant s&apos;en déduit.
            </li>
            <li>
              <span className="font-medium text-texte">Historique de la cuve et dotations ADEX</span> — chaque mouvement passé reste valorisé au barème de sa date. C&apos;est ce qui empêche une baisse
              du gasoil de réécrire deux ans de dépenses.
            </li>
            <li>
              <span className="font-medium text-texte">Journal de la cuve</span> — le stock est rapporté à la contenance ; sous 20 %, la ligne passe en rouge.
            </li>
            <li>
              <span className="font-medium text-texte">Un barème daté d&apos;aujourd&apos;hui ou d&apos;hier</span> ne touche pas aux montants déjà saisis : une transaction porte son prix, et sa
              modification se trace comme toute autre.
            </li>
          </ul>
        </Carte>
      </div>
    </div>
  );
}
