"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Fuel, Gauge, TriangleAlert, X } from "lucide-react";
import { champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerPeriodeStatut } from "@/composants/transactions/fabriques";
import { trouverProfil, type AccesCourant } from "@/domaine/acces";
import { MOTIF_IMMOBILISATION, STATUT_VEHICULE, TYPE_DOCUMENT, libelleCategorie } from "@/domaine/libelles";
import type { LigneFlotte, MotifImmobilisation, StatutVehicule } from "@/domaine/types";
import { lireAccesCourant } from "@/lib/acces-courant";
import { enregistrerCreation } from "@/lib/clotures-demo";
import { date as formaterDate, montant, nombre } from "@/lib/format";
import { Bloc, Chiffre, EnTeteTelephone, Ligne, PastilleStatutTelephone } from "./Telephone";

/* ============================================================================
 * Téléphone › Fiche rapide — ce qu'on veut savoir devant le véhicule : qui le
 * conduit, où en est le compteur, ce qui vient à échéance, les derniers
 * faits. Un bouton d'action : changer le statut, dans un panneau qui ne
 * propose que les statuts que le profil a le droit de poser (cadrage du
 * 7 septembre 2026). Relevé, plein et panne passent par la même modale de
 * transaction que le bureau ; la photo obligatoire viendra avec le stockage.
 * ==========================================================================*/

export interface DerniersFaits {
  plein: { date: string; litres: number; montant: number; source: string } | null;
  intervention: { date: string; objet: string; garage: string | null; montant: number | null } | null;
}

export function FicheRapide({ ligne, faits, aujourdhui }: { ligne: LigneFlotte; faits: DerniersFaits; aujourdhui: string }) {
  return (
    <FournisseurEdition sujet={`vehicule:${ligne.vehicule.immatriculation}`} href={`/telephone/vehicules/${ligne.vehicule.id}`}>
      <Interieur ligne={ligne} faits={faits} aujourdhui={aujourdhui} />
    </FournisseurEdition>
  );
}

const STATUTS_POSABLES: StatutVehicule[] = ["en-service", "en-backup", "en-reparation", "en-restauration", "hors-service", "en-mutation", "retrait-en-cours"];

function Interieur({ ligne, faits, aujourdhui }: { ligne: LigneFlotte; faits: DerniersFaits; aujourdhui: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { creer, creations, actualiser } = useEdition();
  const v = ligne.vehicule;
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [panneau, setPanneau] = useState(false);
  const [gesteOuvert, setGesteOuvert] = useState(false);
  useEffect(() => setAcces(lireAccesCourant()), []);

  /* Le statut courant : le dernier posé dans l'application, sinon celui de la liste. */
  const statutsCrees = creations("statut", fabriquerPeriodeStatut).sort((a, b) => b.debut.localeCompare(a.debut));
  const statut: StatutVehicule = statutsCrees[0]?.statut ?? ligne.statutEffectif ?? v.statut;
  const profil = acces ? trouverProfil(acces.profil) : null;
  const posables = useMemo(() => (profil ? (profil.statuts === "tous" ? STATUTS_POSABLES : profil.statuts) : []), [profil]);
  const saisit = acces ? acces.niveaux.releves === "saisie" || acces.niveaux.releves === "gestion" : false;
  const signale = acces ? acces.niveaux.incidents !== "aucun" && acces.niveaux.incidents !== "lecture" : false;

  function ouvrir(geste: "releve" | "plein" | "panne") {
    if (geste === "releve") creer({ type: "releve", titre: `Relevé · ${v.immatriculationAffichee}`, champs: champsCreation("releve", { pour: "vehicule" }), valeurs: { date: aujourdhui, source: "Téléphone" } });
    else if (geste === "plein") creer({ type: "plein", titre: `Plein · ${v.immatriculationAffichee}`, champs: champsCreation("plein", { pour: "vehicule" }), valeurs: { date: aujourdhui } });
    else creer({ type: "incident", titre: `Panne · ${v.immatriculationAffichee}`, champs: champsCreation("incident", { pour: "vehicule" }), valeurs: { vehiculeId: v.id, nature: "incident", type: "panne", dateHeure: `${aujourdhui}T08:00`, statut: "declare" } });
  }

  /* Le geste demandé depuis la liste s'ouvre à l'arrivée, une fois. */
  const geste = params.get("geste");
  useEffect(() => {
    if (!geste || gesteOuvert || !acces) return;
    if ((geste === "releve" || geste === "plein") && saisit) ouvrir(geste);
    else if (geste === "panne" && signale) ouvrir("panne");
    setGesteOuvert(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geste, acces]);

  const echeances = [
    ligne.prochaineEcheanceConformite ? { cle: "conf", libelle: TYPE_DOCUMENT[ligne.prochaineEcheanceConformite.type], precision: formaterDate(ligne.prochaineEcheanceConformite.echeance), jours: ligne.prochaineEcheanceConformite.joursRestants } : null,
    ligne.prochaineEcheanceEntretien ? { cle: "ent", libelle: ligne.prochaineEcheanceEntretien.libelle, precision: ligne.prochaineEcheanceEntretien.kmRestants !== null ? `${nombre(ligne.prochaineEcheanceEntretien.kmRestants)} km restants` : "", jours: ligne.prochaineEcheanceEntretien.joursRestants ?? 999 } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-28 pt-1">
      <EnTeteTelephone titre={<span className="code">{v.immatriculationAffichee}</span>} retour="/telephone/vehicules" droite={<PastilleStatutTelephone statut={statut} />} />

      <Bloc>
        <Ligne icone={v.marque.slice(0, 1).toUpperCase()} titre={`${v.marque} ${v.appellation} · ${libelleCategorie(v).toLowerCase()}`} precision={[ligne.site?.libelle, v.businessUnit, ligne.chauffeurTitulaire?.nom ?? ligne.attributaire?.nom].filter(Boolean).join(" · ") || "Sans rattachement"} />
        {ligne.immobilisationAdministrative?.length ? <p className="mt-1 rounded-[8px] bg-defavorable-fond px-2.5 py-1.5 text-[12px] font-medium text-defavorable">Immobilisé administrativement : {ligne.immobilisationAdministrative.map((d) => `${TYPE_DOCUMENT[d.type].toLowerCase()} ${d.etat === "manquant" ? "manquant" : "échu"}`).join(", ")}</p> : null}
      </Bloc>

      <div className="grid grid-cols-2 gap-2">
        <Chiffre valeur={ligne.kilometrage === null ? "—" : nombre(ligne.kilometrage)} libelle={ligne.dateKilometrage ? `km · relevé du ${formaterDate(ligne.dateKilometrage)}` : "km · aucun relevé"} />
        <Chiffre valeur={ligne.prochaineEcheanceEntretien?.kmRestants === null || ligne.prochaineEcheanceEntretien === null ? "—" : nombre(ligne.prochaineEcheanceEntretien.kmRestants)} libelle={ligne.prochaineEcheanceEntretien ? `km avant ${ligne.prochaineEcheanceEntretien.libelle.toLowerCase()}` : "pas de plan d'entretien"} alerte={(ligne.prochaineEcheanceEntretien?.kmRestants ?? 1) <= 0} />
      </div>

      <Bloc titre="Échéances">
        {echeances.length === 0 ? <p className="meta py-1">Aucune échéance connue.</p> : null}
        {echeances.map((e) => (
          <Ligne key={e.cle} icone={e.cle === "conf" ? "VT" : "W"} ton={e.jours < 0 ? "defavorable" : e.jours <= 30 ? "vigilance" : "neutre"} titre={e.libelle} precision={e.precision} valeur={e.jours === 999 ? "" : e.jours < 0 ? `J+${-e.jours}` : `J-${e.jours}`} />
        ))}
      </Bloc>

      <Bloc titre="Derniers faits">
        {faits.plein ? <Ligne icone="⛽" titre={`Plein ${nombre(faits.plein.litres)} l · ${montant(faits.plein.montant)}`} precision={`${formaterDate(faits.plein.date)} · ${faits.plein.source}`} /> : null}
        {faits.intervention ? <Ligne icone="W" titre={faits.intervention.objet} precision={`${formaterDate(faits.intervention.date)}${faits.intervention.garage ? ` · ${faits.intervention.garage}` : ""}${faits.intervention.montant !== null ? ` · ${montant(faits.intervention.montant)}` : ""}`} /> : null}
        {!faits.plein && !faits.intervention ? <p className="meta py-1">Aucun fait récent connu ici.</p> : null}
        {ligne.coutDouzeMois !== null ? <p className="meta mt-1.5">{montant(ligne.coutDouzeMois)} sur douze mois</p> : null}
        <Link href={`/flotte/${v.id}`} className="mt-1.5 inline-block text-[12.5px] font-semibold text-accent-fonce">
          La fiche complète
        </Link>
      </Bloc>

      {saisit || signale ? (
        <div className="grid grid-cols-3 gap-2">
          {saisit ? (
            <>
              <Geste onClick={() => ouvrir("releve")} icone={<Gauge className="size-4" strokeWidth={2} />} libelle="Relevé" />
              <Geste onClick={() => ouvrir("plein")} icone={<Fuel className="size-4" strokeWidth={2} />} libelle="Plein" />
            </>
          ) : null}
          {signale ? <Geste onClick={() => ouvrir("panne")} icone={<TriangleAlert className="size-4" strokeWidth={2} />} libelle="Panne" /> : null}
        </div>
      ) : null}

      {posables.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[60px] z-20 mx-auto max-w-[520px] px-3 lg:bottom-4">
          <button type="button" onClick={() => setPanneau(true)} className="bouton-principal h-11 w-full justify-center rounded-[12px] text-[14px]">
            Changer le statut
          </button>
        </div>
      ) : null}

      {panneau ? (
        <PanneauStatut
          courant={statut}
          posables={posables}
          aujourdhui={aujourdhui}
          onFermer={() => setPanneau(false)}
          onPoser={(nouveau, motif, commentaire) => {
            const r = enregistrerCreation({ sujet: `vehicule:${v.immatriculation}`, type: "statut", champs: champsCreation("statut", { pour: "vehicule" }), valeurs: { statut: nouveau, motif, debut: aujourdhui, commentaire }, motif: "Statut posé depuis le téléphone" });
            if (r.issue === "creee") {
              setPanneau(false);
              actualiser();
              router.refresh();
              return null;
            }
            return r.issue === "mois-clos" ? `Le mois ${r.mois} est clos.` : "Le statut n'a pas pu être posé.";
          }}
        />
      ) : null}
    </div>
  );
}

function Geste({ onClick, icone, libelle }: { onClick: () => void; icone: React.ReactNode; libelle: string }) {
  return (
    <button type="button" onClick={onClick} className="carte flex flex-col items-center gap-1.5 px-2 py-3 text-[12.5px] font-semibold text-texte hover:bg-surface-2">
      <span className="grid size-9 place-items-center rounded-[10px] bg-accent-fond text-accent-fonce">{icone}</span>
      {libelle}
    </button>
  );
}

function PanneauStatut({ courant, posables, aujourdhui, onFermer, onPoser }: { courant: StatutVehicule; posables: StatutVehicule[]; aujourdhui: string; onFermer: () => void; onPoser: (statut: StatutVehicule, motif: MotifImmobilisation | null, commentaire: string | null) => string | null }) {
  const [choix, setChoix] = useState<StatutVehicule>(courant);
  const [motif, setMotif] = useState<MotifImmobilisation | "">("");
  const [commentaire, setCommentaire] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const immobilise = choix !== "en-service" && choix !== "en-backup";
  return (
    <>
      <button type="button" aria-label="Fermer" onClick={onFermer} className="fixed inset-0 z-30 cursor-default bg-encre/35" />
      <div role="dialog" aria-modal="true" aria-label="Nouveau statut" className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px] rounded-t-[22px] bg-surface px-4 pt-2 pb-6 shadow-flottante">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-bordure" />
        <div className="flex items-center gap-2">
          <h2 className="titre-bloc flex-1">Nouveau statut</h2>
          <button type="button" onClick={onFermer} className="grid size-8 place-items-center rounded-full text-attenue hover:bg-surface-3">
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>
        <ul className="mt-2 flex flex-col">
          {posables.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => setChoix(s)} aria-pressed={choix === s} className="flex w-full items-center gap-3 border-t border-bordure py-2.5 text-left text-[14px] text-texte first:border-t-0">
                <i className="size-2.5 rounded-full" style={{ background: STATUT_VEHICULE[s].couleur }} />
                <span className="flex-1">
                  {STATUT_VEHICULE[s].libelle}
                  <span className="meta block">{STATUT_VEHICULE[s].precision}</span>
                </span>
                {choix === s ? <span className="font-bold text-accent-fonce">✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
        {immobilise ? (
          <select value={motif} onChange={(e) => setMotif(e.target.value as MotifImmobilisation | "")} className="mt-2 h-10 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[14px] text-texte">
            <option value="">Motif — panne, entretien, sinistre…</option>
            {Object.entries(MOTIF_IMMOBILISATION).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        ) : null}
        <input type="text" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Commentaire (facultatif)" className="mt-2 h-10 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[14px] text-texte" />
        <p className="meta mt-2">À compter d&apos;aujourd&apos;hui, {formaterDate(aujourdhui)}. Tracé avec votre nom.</p>
        {erreur ? <p className="mt-2 text-[13px] text-defavorable">{erreur}</p> : null}
        <button type="button" disabled={choix === courant} onClick={() => setErreur(onPoser(choix, motif || null, commentaire.trim() || null))} className="bouton-principal mt-3 h-11 w-full justify-center rounded-[12px] text-[14px] disabled:cursor-not-allowed disabled:opacity-50">
          Enregistrer
        </button>
      </div>
    </>
  );
}
