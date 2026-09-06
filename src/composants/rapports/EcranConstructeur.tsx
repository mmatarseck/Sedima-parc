"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Trash2 } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { PERIMETRE, type Perimetre } from "@/domaine/couts";
import { resoudrePeriode, type Periode } from "@/domaine/periodes";
import { FAMILLE_RAPPORT, rapportParId, texteDe, type ColonneRapport, type LigneRapport } from "@/domaine/rapports";
import { nombre } from "@/lib/format";
import { lireRole } from "@/lib/session-demo";
import { ALIGNEE_DROITE, CelluleRapport, MONOSPACE } from "./cellules";
import { ChoixPeriode } from "./ChoixPeriode";
import { ColonnesRapport } from "./ColonnesRapport";
import { FiltresRapport, appliquerFacettes } from "./FiltresRapport";
import { enregistrerPersonnalise, personnaliseParId, supprimerPersonnalise } from "./personnalises";
import { colonnesInitiales, type Facettes } from "./reglages";

/* ============================================================================
 * Constructeur de rapport personnalisé.
 *
 * Demande du métier du 4 septembre 2026 : « pouvoir faire des custom reports,
 * où on sélectionne les variables souhaitées ». On part d'une **base** — le
 * rapport standard qui décide de ce qu'une ligne compte et fournit le vivier
 * de colonnes —, puis on choisit ses variables, ses filtres et sa période.
 *
 * L'**aperçu est vivant** : il montre les vraies lignes, avec les colonnes du
 * moment. Composer un rapport à l'aveugle, sur des noms de colonnes, produit
 * des rapports qu'on n'ouvre jamais deux fois ; le voir se former pendant
 * qu'on le compose est la moitié du travail.
 *
 * La période sert ici de **réglage d'ouverture** : elle est enregistrée avec
 * le rapport, et l'aperçu la respecte en rechargeant la page — c'est le
 * serveur qui construit les lignes.
 * ==========================================================================*/

const APERCU = 8;

export function EcranConstructeur({
  baseId,
  lignes,
  aujourdhui,
  persoId,
  periodeCourante,
  perimetreCourant,
}: {
  baseId: string;
  lignes: LigneRapport[];
  aujourdhui: string;
  /** Non nul quand on retouche un rapport déjà enregistré. */
  persoId?: string;
  periodeCourante: Periode;
  perimetreCourant: Perimetre;
}) {
  const base = rapportParId(baseId)!;
  const identifiant = base.identifiant ?? base.colonnes[0]!.cle;
  const router = useRouter();

  const [compte, setCompte] = useState("invite");
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [visibles, setVisibles] = useState<string[]>(() => colonnesInitiales(base.colonnes, identifiant));
  const [facettes, setFacettes] = useState<Facettes>({});
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    const role = lireRole() ?? "invite";
    setCompte(role);
    if (!persoId) return;
    const r = personnaliseParId(role, persoId);
    if (!r) return;
    setNom(r.nom);
    setDescription(r.description);
    setVisibles([identifiant, ...r.colonnes.filter((c) => c !== identifiant)]);
    setFacettes(r.facettes);
  }, [persoId, identifiant]);

  const colonnes = visibles.map((cle) => base.colonnes.find((c) => c.cle === cle)).filter((c): c is ColonneRapport => Boolean(c));
  const filtrees = useMemo(() => appliquerFacettes(lignes, facettes), [lignes, facettes]);
  const resolue = resoudrePeriode(periodeCourante, aujourdhui);

  /* Changer la période reconstruit les lignes : c'est le serveur qui les
     produit, donc on navigue — l'aperçu reste vrai. */
  function poserPeriode(p: Periode, perimetre: Perimetre = perimetreCourant) {
    const q = new URLSearchParams({ base: baseId });
    if (persoId) q.set("perso", persoId);
    if (p.preset !== "12-mois") q.set("periode", p.preset);
    if (p.preset === "personnalisee" && p.debut && p.fin) {
      q.set("du", p.debut);
      q.set("au", p.fin);
    }
    if (perimetre === "complet") q.set("perimetre", "complet");
    router.push(`/rapports/nouveau?${q.toString()}`);
  }

  function enregistrer() {
    const titre = nom.trim();
    if (!titre) return;
    const r = enregistrerPersonnalise(compte, {
      id: persoId,
      nom: titre,
      description: description.trim(),
      base: baseId,
      colonnes: visibles,
      facettes,
      periode: periodeCourante,
      perimetre: perimetreCourant,
      tri: null,
    });
    setEnregistre(true);
    router.push(`/rapports/${baseId}?perso=${r.id}`);
  }

  function supprimer() {
    if (!persoId) return;
    supprimerPersonnalise(compte, persoId);
    router.push("/rapports");
  }

  const champ = "h-9 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none placeholder:text-attenue focus:border-accent";

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran
        titre={persoId ? "Modifier le rapport" : "Nouveau rapport"}
        sousTitre={`Une ligne par ${base.unite.replace(/s$/, "")}, d'après « ${base.libelle} » — choisissez vos colonnes, vos filtres et votre période.`}
        actions={
          <div className="flex items-center gap-2">
            {persoId ? (
              <button type="button" onClick={supprimer} className="bouton-secondaire h-8 text-defavorable">
                <Trash2 className="size-4" strokeWidth={1.8} />
                Supprimer
              </button>
            ) : null}
            <Link href="/rapports" className="bouton-secondaire h-8">
              <ArrowLeft className="size-4" strokeWidth={1.8} />
              Annuler
            </Link>
            <button type="button" onClick={enregistrer} disabled={!nom.trim() || enregistre} className="bouton-principal h-8 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-attenue-2">
              <Check className="size-4" strokeWidth={2.2} />
              {enregistre ? "Enregistré" : "Enregistrer"}
            </button>
          </div>
        }
      />

      {/* ---- Identité du rapport ---- */}
      <div className="rounded-[14px] border border-bordure bg-surface p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <label className="flex flex-col gap-1.5">
            <span className="label-champ">
              Nom du rapport <span className="text-defavorable">●</span>
            </span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Camions Aliment à surveiller" className={champ} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-champ">À quelle question il répond</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Les camions de l'UAB dont le coût au kilomètre dépasse la médiane de leur catégorie."
              className={champ}
            />
          </label>
        </div>
        <p className="meta mt-3">
          Base : <span className="font-medium text-texte-2">{base.libelle}</span> · {FAMILLE_RAPPORT[base.famille].libelle} · {base.colonnes.length} colonnes disponibles. Une ligne
          compte une seule chose — pour croiser deux dimensions, il faudra une base de plus.
        </p>
      </div>

      {/* ---- Période et périmètre ---- */}
      {base.periode || base.perimetre ? (
        <div className="flex flex-wrap items-center gap-3">
          {base.periode ? (
            <>
              <ChoixPeriode valeur={periodeCourante} aujourdhui={aujourdhui} onChange={(p) => poserPeriode(p)} />
              <p className="meta">
                {resolue.libelle} — enregistré avec le rapport, et rejoué à chaque ouverture.
              </p>
            </>
          ) : null}
          {base.perimetre ? (
            <div className="sans-barre flex h-8 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Périmètre du coût">
              {(["exploitation", "complet"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  title={PERIMETRE[p].precision}
                  aria-pressed={perimetreCourant === p}
                  onClick={() => poserPeriode(periodeCourante, p)}
                  className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${perimetreCourant === p ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}
                >
                  {PERIMETRE[p].libelle}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ---- Filtres ---- */}
      <FiltresRapport colonnes={base.colonnes} lignes={lignes} facettes={facettes} onChanger={setFacettes} />

      {/* ---- Colonnes et aperçu ---- */}
      <div className="flex flex-wrap items-center gap-3">
        <ColonnesRapport
          colonnes={base.colonnes}
          visibles={visibles}
          identifiant={identifiant}
          onChanger={setVisibles}
          onRetablir={() => setVisibles(colonnesInitiales(base.colonnes, identifiant))}
        />
        <p className="meta">
          {nombre(filtrees.length)} {base.unite} · {colonnes.length} colonne{colonnes.length > 1 ? "s" : ""} retenue{colonnes.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-bordure bg-surface">
        <p className="micro-sur-titre border-b border-bordure px-4 py-2.5">
          Aperçu — {Math.min(APERCU, filtrees.length)} première{Math.min(APERCU, filtrees.length) > 1 ? "s" : ""} ligne{Math.min(APERCU, filtrees.length) > 1 ? "s" : ""} sur {nombre(filtrees.length)}
        </p>
        <div className="defilement-discret overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr>
                {colonnes.map((c) => (
                  <th
                    key={c.cle}
                    scope="col"
                    style={{ width: c.largeur, minWidth: c.largeur }}
                    className={`border-b border-bordure px-3 py-2.5 align-bottom text-[12px] font-medium text-texte-2 ${ALIGNEE_DROITE.includes(c.type) ? "text-right" : "text-left"}`}
                  >
                    <span className="block truncate">{c.libelle}</span>
                    {c.precision ? <span className="meta mt-0.5 block truncate font-normal">{c.precision}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrees.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(1, colonnes.length)} className="px-6 py-12 text-center text-[13px] text-attenue">
                    Aucune ligne — élargissez la période ou retirez un filtre.
                  </td>
                </tr>
              ) : (
                filtrees.slice(0, APERCU).map((l, i) => (
                  <tr key={`${texteDe(l[identifiant] ?? null)}-${i}`} className="border-b border-bordure last:border-b-0">
                    {colonnes.map((c) => (
                      <td key={c.cle} style={{ width: c.largeur, minWidth: c.largeur }} className={`px-3 py-2 ${ALIGNEE_DROITE.includes(c.type) ? "text-right" : ""} ${MONOSPACE.includes(c.type) ? "code" : ""}`}>
                        <span className="block truncate">
                          <CelluleRapport valeur={l[c.cle] ?? null} colonne={c} />
                        </span>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
