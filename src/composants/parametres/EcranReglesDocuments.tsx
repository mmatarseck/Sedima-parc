"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Plus, RotateCcw, Trash2 } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { Pastille } from "@/composants/interface/Pastille";
import { peutCloturer } from "@/domaine/cloture";
import {
  APPLICABILITE_DOCUMENT,
  PARAMETRES_DEFAUT,
  PORTEUR_DOCUMENT,
  nouvelIdDocument,
  type ApplicabiliteDocument,
  type DefinitionDocument,
  type Parametres,
  type PorteurDocument,
} from "@/domaine/parametres";
import { trouverRole } from "@/domaine/roles";
import { ecrireParametres, lireParametres, reinitialiserParametres } from "@/lib/parametres-demo";
import { lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Paramètres › Règles des documents.
 *
 * Ce que le métier règle sans développeur : la liste des documents elle-même
 * (ajout, renommage, retrait — standard compris), qui les porte, à qui ils
 * s'appliquent, leur durée de validité et leur caractère critique. Tout est
 * appliqué partout dès l'enregistrement — fiches, échéancier, disponibilité,
 * formulaires — parce que ces écrans relisent les paramètres à chaque rendu.
 * ==========================================================================*/

const CHAMP = "h-8 rounded-[8px] border border-bordure-champ bg-surface px-2 text-[13px] text-texte outline-none focus:border-accent disabled:border-transparent disabled:bg-transparent disabled:px-0";
const CELLULE = "border-b border-bordure px-3 py-2 align-middle";

export function EcranReglesDocuments() {
  const router = useRouter();
  const [p, setP] = useState<Parametres>(PARAMETRES_DEFAUT);
  const [habilite, setHabilite] = useState(false);
  const [nomRole, setNomRole] = useState("");
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aFocaliser, setAFocaliser] = useState<string | null>(null);
  const champs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setP(lireParametres());
    const r = trouverRole(lireRole());
    setHabilite(peutCloturer(r.role));
    setNomRole(r.libelle);
  }, []);

  useEffect(() => {
    if (aFocaliser) {
      champs.current[aFocaliser]?.focus();
      setAFocaliser(null);
    }
  }, [aFocaliser]);

  const types = p.documents.types;
  const modifie = JSON.stringify(p) !== JSON.stringify(PARAMETRES_DEFAUT);
  const sansLibelle = types.filter((t) => !t.libelle.trim());
  const valide = sansLibelle.length === 0;
  const retires = PARAMETRES_DEFAUT.documents.types.filter((d) => !types.some((t) => t.id === d.id));

  function regler(suite: Parametres) {
    setP(suite);
    setEnregistre(false);
  }
  function reglerTypes(suite: DefinitionDocument[]) {
    regler({ ...p, documents: { ...p.documents, types: suite } });
  }
  function reglerType(id: string, champ: Partial<DefinitionDocument>) {
    reglerTypes(types.map((t) => (t.id === id ? { ...t, ...champ } : t)));
  }

  function ajouter() {
    const id = nouvelIdDocument("nouveau", types);
    /* Un ajout naît non critique : critique et exigé, il immobiliserait tout véhicule qui ne l'a pas. */
    reglerTypes([...types, { id, libelle: "", porteur: "vehicule", applicabilite: "tous", validiteMois: 12, critique: false, standard: false }]);
    setAFocaliser(id);
  }

  /* Retirer une ligne, standard comprise : le document n'est plus exigé ni calculé,
     les pièces déjà enregistrées restent lisibles. Un standard retiré se remet d'un clic. */
  function retirer(t: DefinitionDocument) {
    reglerTypes(types.filter((x) => x.id !== t.id));
  }
  function remettre(d: DefinitionDocument) {
    reglerTypes([...types, { ...d }]);
  }

  function enregistrer() {
    if (!valide) return;
    /* L'identifiant d'un ajout suit son libellé au premier enregistrement ; il est ensuite stable. */
    const suite = {
      ...p,
      documents: {
        ...p.documents,
        types: types.map((t) => (t.standard || !t.id.startsWith("doc-nouveau") ? t : { ...t, id: nouvelIdDocument(t.libelle, types.filter((x) => x.id !== t.id)) })),
      },
    };
    setP(suite);
    setErreur(null);
    void ecrireParametres(suite).then((refus) => {
      if (refus) {
        setErreur(refus);
        return;
      }
      setEnregistre(true);
      /* Les pages rendues par le serveur relisent les paramètres : on les rafraîchit. */
      router.refresh();
      setTimeout(() => setEnregistre(false), 1800);
    });
  }

  function reinitialiser() {
    setErreur(null);
    void reinitialiserParametres().then(({ parametres, erreur: refus }) => {
      if (refus) {
        setErreur(refus);
        return;
      }
      setP(parametres);
      router.refresh();
    });
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
        titre="Règles des documents"
        sousTitre={habilite ? `${types.length} document${types.length > 1 ? "s" : ""} — liste, validité et criticité, appliquées partout dès l'enregistrement` : `Lecture seule — le réglage relève de la direction et de l'administrateur (vous êtes ${nomRole.toLowerCase()})`}
        actions={
          habilite ? (
            <>
              {erreur ? <span className="max-w-[360px] text-[12.5px] leading-[1.4] text-defavorable">{erreur}</span> : null}
              <button type="button" onClick={reinitialiser} disabled={!modifie} className="bouton-secondaire disabled:cursor-not-allowed disabled:opacity-50">
                <RotateCcw className="size-4 text-texte-2" strokeWidth={1.7} />
                Valeurs par défaut
              </button>
              <button type="button" onClick={enregistrer} disabled={!valide} className="bouton-principal disabled:cursor-not-allowed disabled:opacity-50" title={valide ? undefined : "Un document sans nom"}>
                <Check className="size-4" strokeWidth={2.2} />
                {enregistre ? "Enregistré" : "Enregistrer"}
              </button>
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Carte
          titre="Documents"
          precision="Qui le porte, à qui il s'applique, sa validité en mois (vide : permanent), s'il immobilise"
          action={
            habilite ? (
              <button type="button" onClick={ajouter} className="bouton-secondaire h-8">
                <Plus className="size-4" strokeWidth={2} />
                Ajouter un document
              </button>
            ) : null
          }
          sansMarge
        >
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-5 text-left">Document</th>
                  <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-3 text-left">Porteur</th>
                  <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-3 text-left">S&apos;applique à</th>
                  <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-3 text-right whitespace-nowrap">Validité (mois)</th>
                  <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-3 text-left">Critique</th>
                  <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-3 text-left" />
                </tr>
              </thead>
              <tbody>
                {types.map((t) => {
                  const defaut = PARAMETRES_DEFAUT.documents.types.find((d) => d.id === t.id);
                  const chauffeur = t.porteur === "chauffeur";
                  return (
                    <tr key={t.id} className="hover:bg-surface-2">
                      <td className={`${CELLULE} px-5`}>
                        <div className="flex flex-col gap-0.5">
                          <input
                            ref={(el) => {
                              champs.current[t.id] = el;
                            }}
                            type="text"
                            value={t.libelle}
                            placeholder="Nom du document"
                            disabled={!habilite}
                            onChange={(e) => reglerType(t.id, { libelle: e.target.value })}
                            className={`${CHAMP} w-[200px] font-medium ${t.libelle.trim() ? "" : "border-defavorable"}`}
                          />
                          <span className="code text-[10.5px] text-attenue">{t.standard ? `${t.id} · standard` : t.id.startsWith("doc-nouveau") ? "identifiant donné à l'enregistrement" : t.id}</span>
                        </div>
                      </td>
                      <td className={CELLULE}>
                        <select value={t.porteur} disabled={!habilite || t.standard} onChange={(e) => reglerType(t.id, { porteur: e.target.value as PorteurDocument, ...(e.target.value === "chauffeur" ? { applicabilite: "tous" as const } : {}) })} className={`${CHAMP} w-[110px]`}>
                          {(Object.keys(PORTEUR_DOCUMENT) as PorteurDocument[]).map((k) => (
                            <option key={k} value={k}>
                              {PORTEUR_DOCUMENT[k]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={CELLULE}>
                        {chauffeur ? (
                          <span className="text-[12.5px] text-texte-2">Tous les chauffeurs</span>
                        ) : (
                          <select value={t.applicabilite} disabled={!habilite} onChange={(e) => reglerType(t.id, { applicabilite: e.target.value as ApplicabiliteDocument })} className={`${CHAMP} w-[210px]`}>
                            {(Object.keys(APPLICABILITE_DOCUMENT) as ApplicabiliteDocument[]).map((k) => (
                              <option key={k} value={k}>
                                {APPLICABILITE_DOCUMENT[k]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className={`${CELLULE} text-right`}>
                        <span className="inline-flex items-center justify-end gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={t.validiteMois ?? ""}
                            placeholder="permanent"
                            disabled={!habilite}
                            onChange={(e) => {
                              const brut = e.target.value.trim();
                              if (brut !== "" && !/^\d+$/.test(brut)) return;
                              reglerType(t.id, { validiteMois: brut === "" ? null : Number(brut) });
                            }}
                            className={`code ${CHAMP} w-[84px] text-right disabled:text-right`}
                          />
                          {defaut && t.validiteMois !== defaut.validiteMois ? <span className="meta text-[11px] whitespace-nowrap" title="Valeur par défaut">≠ {defaut.validiteMois ?? "permanent"}</span> : null}
                        </span>
                      </td>
                      <td className={CELLULE}>
                        <Interrupteur actif={t.critique} disabled={!habilite} onChange={(v) => reglerType(t.id, { critique: v })} libelle={t.critique ? (chauffeur ? "Interdit de conduire" : "Immobilise") : "Alerte seule"} />
                      </td>
                      <td className={`${CELLULE} text-right`}>
                        {habilite ? (
                          <button type="button" onClick={() => retirer(t)} className="bouton-discret text-attenue hover:text-defavorable" title={t.standard ? "Retirer ce document — il ne sera plus exigé ni suivi" : "Retirer ce document"} aria-label={`Retirer ${t.libelle || "ce document"}`}>
                            <Trash2 className="size-4" strokeWidth={1.7} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {retires.length ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-bordure px-5 py-3">
              <span className="meta">Retirés :</span>
              {retires.map((d) => (
                <button key={d.id} type="button" disabled={!habilite} onClick={() => remettre(d)} className="champ-pilule h-7 text-[12px]" title="Remettre ce document">
                  {d.libelle}
                  {habilite ? <span className="ml-1 text-attenue">· remettre</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </Carte>

        <div className="flex flex-col gap-5">
          <Carte titre="Où ces règles s'appliquent">
            <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-texte-2">
              <li>
                <span className="font-medium text-texte">Formulaires</span> : les documents proposés à l&apos;ajout sur une fiche véhicule ou chauffeur sont ceux de cette liste, selon le porteur.
              </li>
              <li>
                <span className="font-medium text-texte">Échéance calculée</span> à la création ou au renouvellement d&apos;un document sans échéance saisie : date d&apos;effet plus la validité.
              </li>
              <li>
                <span className="font-medium text-texte">Alertes</span> J-60, J-30, J-7 et échu dans l&apos;échéancier Conformité, l&apos;Aperçu des fiches et la liste Flotte.
              </li>
              <li>
                <span className="font-medium text-texte">Immobilisation administrative</span> : un document critique, exigé du véhicule, manquant ou échu, le passe hors service jusqu&apos;au renouvellement. Un document ajouté et marqué critique immobilise donc tout véhicule concerné qui ne l&apos;a pas encore.
              </li>
              <li>
                <span className="font-medium text-texte">Véhicule léger neuf</span> : pas de règle d&apos;exemption ici — à la création du véhicule, l&apos;agent saisit la date de la première visite technique, et l&apos;échéancier part de là.
              </li>
              <li>
                <span className="font-medium text-texte">Retirer une ligne</span> : le document n&apos;est plus exigé, plus calculé, plus proposé ; les pièces déjà enregistrées restent lisibles. Un document standard retiré se remet d&apos;un clic.
              </li>
            </ul>
            <p className="mt-3 flex items-center gap-2">
              <Pastille ton={modifie ? "vigilance" : "neutre"}>{modifie ? "Valeurs modifiées" : "Valeurs par défaut"}</Pastille>
              {sansLibelle.length ? <Pastille ton="defavorable">Un document sans nom</Pastille> : null}
            </p>
          </Carte>
        </div>
      </div>
    </div>
  );
}

function Interrupteur({ actif, disabled, onChange, libelle }: { actif: boolean; disabled: boolean; onChange: (v: boolean) => void; libelle: string }) {
  return (
    <button type="button" role="switch" aria-checked={actif} disabled={disabled} onClick={() => onChange(!actif)} className="flex items-center gap-2 text-[12.5px] whitespace-nowrap text-texte disabled:cursor-default">
      <span className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${actif ? "bg-accent" : "bg-bordure-champ"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${actif ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {libelle}
    </button>
  );
}
