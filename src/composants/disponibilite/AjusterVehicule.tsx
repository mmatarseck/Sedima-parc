"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Check, X } from "lucide-react";
import { CHAMPS, champsCamion, champsCreation } from "@/composants/transactions/champs";
import { optionsAffectation, optionsSites } from "@/composants/transactions/options";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import type { ChampEdition } from "@/domaine/cloture";
import type { LigneCamionTiers } from "@/domaine/camions-tiers";
import type { LigneDisponibilite } from "@/domaine/disponibilite";
import { BUSINESS_UNIT, STATUT_VEHICULE } from "@/domaine/libelles";
import { jourCourant } from "@/domaine/temps";
import type { StatutVehicule } from "@/domaine/types";
import { enregistrerCreation, enregistrerModification } from "@/lib/clotures-demo";

/* ============================================================================
 * Ajuster un véhicule depuis le point du matin (métier, 3 octobre 2026) :
 * « j'aurais cliqué sur la pastille d'un véhicule, et une petite fenêtre
 * s'ouvre pour ajuster ces infos (chauffeur affecté, statut, BU affectée…).
 * À la validation, le véhicule est mis à jour. »
 *
 * Chaque changement passe par son écriture ordinaire, tracée comme ailleurs :
 *  - le statut, par un changement de statut daté du jour ;
 *  - le chauffeur, par une affectation (au quart, le cas échéant) qui clôt la
 *    précédente du même quart ;
 *  - la BU et le site, par une modification de la fiche.
 * Pour un camion de transporteur : statut, chauffeur et téléphone, BU — une
 * modification de sa fiche.
 * ==========================================================================*/

export type CibleAjustement = { genre: "parc"; ligne: LigneDisponibilite } | { genre: "tiers"; camion: LigneCamionTiers };

/* La sortie du parc est un acte à part (date, motif) : elle se fait de la fiche. */
const STATUTS = (Object.keys(STATUT_VEHICULE) as StatutVehicule[]).filter((s) => s !== "sorti" && s !== "a-recevoir");

const champ = "h-9 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent";

function Ligne({ libelle, children, precision }: { libelle: string; children: React.ReactNode; precision?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-champ">{libelle}</span>
      {children}
      {precision ? <span className="meta">{precision}</span> : null}
    </label>
  );
}

export function AjusterVehicule({ cible, onFermer }: { cible: CibleAjustement; onFermer: () => void }) {
  return cible.genre === "parc" ? <AjusterParc ligne={cible.ligne} onFermer={onFermer} /> : <AjusterTiers camion={cible.camion} onFermer={onFermer} />;
}

function Cadre({ titre, sousTitre, href, erreur, onFermer, onValider, enCours, children }: { titre: string; sousTitre: string; href: string; erreur: string | null; onFermer: () => void; onValider: () => void; enCours: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label={titre} onClick={onFermer}>
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-bordure bg-surface shadow-modale" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start gap-3 border-b border-bordure px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="titre-bloc code">{titre}</h2>
            <p className="meta mt-0.5">{sousTitre}</p>
          </div>
          <Link href={href} className="bouton-discret h-8" title="Ouvrir la fiche complète">
            <ArrowUpRight className="size-4" strokeWidth={2} />
            Fiche
          </Link>
          <button type="button" className="bouton-discret h-8" onClick={onFermer} aria-label="Fermer">
            <X className="size-4" strokeWidth={2} />
          </button>
        </header>
        <form
          className="defilement-discret flex flex-col gap-3 overflow-y-auto px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            onValider();
          }}
        >
          {children}
          {erreur ? <p className="rounded-[10px] bg-defavorable-fond px-3 py-2 text-[12.5px] text-defavorable">{erreur}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="bouton-secondaire h-8" onClick={onFermer}>
              Annuler
            </button>
            <button type="submit" disabled={enCours} className="bouton-principal h-8 disabled:opacity-50">
              <Check className="size-4" strokeWidth={2.2} />
              Valider
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AjusterParc({ ligne: l, onFermer }: { ligne: LigneDisponibilite; onFermer: () => void }) {
  const { actualiser } = useEdition();
  const chauffeurs = useMemo(() => optionsAffectation(), []);
  const sites = useMemo(() => optionsSites(), []);
  const quarts = l.conducteur?.quarts ?? [];
  /* Le chauffeur présent, retrouvé dans la liste par son nom ; « inchangé » sinon. */
  const actuel = chauffeurs.find((o) => o.libelle === (quarts[0]?.nom ?? l.conducteur?.nom))?.valeur ?? "";
  const [statut, setStatut] = useState<StatutVehicule>(l.statutEffectif);
  const [motif, setMotif] = useState("");
  const [chauffeur, setChauffeur] = useState(actuel);
  const [quart, setQuart] = useState<"journee" | "matin" | "soir">(quarts.length ? "matin" : "journee");
  const [heureDebut, setHeureDebut] = useState(quarts[0]?.heures.split(" → ")[0] ?? "06:00");
  const [heureFin, setHeureFin] = useState(quarts[0]?.heures.split(" → ")[1] ?? "18:00");
  const [bu, setBu] = useState(l.businessUnit ?? "");
  const [site, setSite] = useState(l.siteId ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  function choisirQuart(q: "journee" | "matin" | "soir") {
    setQuart(q);
    const deja = quarts.find((x) => x.quart === q);
    if (deja) {
      setChauffeur(chauffeurs.find((o) => o.libelle === deja.nom)?.valeur ?? "");
      setHeureDebut(deja.heures.split(" → ")[0] ?? "");
      setHeureFin(deja.heures.split(" → ")[1] ?? "");
    } else if (q === "matin") {
      setHeureDebut("06:00");
      setHeureFin("18:00");
    } else if (q === "soir") {
      setHeureDebut("18:00");
      setHeureFin("06:00");
    }
  }

  function valider() {
    setErreur(null);
    setEnCours(true);
    const sujet = `vehicule:${l.immatriculation}`;
    const jour = jourCourant();
    const raison = motif.trim() || "Ajusté au point du matin";
    const refus: string[] = [];
    if (statut !== l.statutEffectif) {
      const r = enregistrerCreation({ sujet, type: "statut", champs: CHAMPS.statut, valeurs: { statut, debut: jour, vehiculeId: l.immatriculation, commentaire: motif.trim() || null }, motif: raison });
      if (r.issue !== "creee") refus.push(r.issue === "mois-clos" ? `statut : le mois ${r.mois} est clos` : "statut non enregistré");
    }
    const quartAvant = quarts.find((x) => x.quart === quart);
    const changeChauffeur = chauffeur !== "" && (chauffeur !== actuel || (quart !== "journee" && (!quartAvant || quartAvant.heures !== `${heureDebut} → ${heureFin}`)) || (quart === "journee" && quarts.length > 0));
    if (changeChauffeur) {
      if (quart !== "journee" && (!/^\d{1,2}:\d{2}$/.test(heureDebut) || !/^\d{1,2}:\d{2}$/.test(heureFin))) {
        setErreur("Indiquez les heures de prise et de relève du quart, « 06:00 ».");
        setEnCours(false);
        return;
      }
      const r = enregistrerCreation({
        sujet,
        type: "affectation",
        champs: champsCreation("affectation", { pour: "vehicule" }),
        valeurs: { chauffeurId: chauffeur, role: "titulaire", quart, heureDebut: quart === "journee" ? "" : heureDebut, heureFin: quart === "journee" ? "" : heureFin, debut: jour, motif: raison },
        motif: raison,
      });
      if (r.issue !== "creee") refus.push(r.issue === "mois-clos" ? `affectation : le mois ${r.mois} est clos` : "affectation non enregistrée");
    }
    const champsFiche: ChampEdition[] = [
      { cle: "businessUnit", libelle: "Business unit", type: "choix", options: Object.entries(BUSINESS_UNIT).map(([valeur, libelle]) => ({ valeur, libelle })) },
      { cle: "siteId", libelle: "Site", type: "suggestion", options: sites },
    ];
    enregistrerModification({ numero: `VEH-${l.immatriculation}`, sujet, type: "vehicule", titre: `Fiche ${l.immatriculationAffichee}`, href: `/flotte/${l.immatriculation}`, champs: champsFiche, avant: { businessUnit: l.businessUnit ?? "", siteId: l.siteId ?? "" }, apres: { businessUnit: bu, siteId: site }, motif: raison });
    setEnCours(false);
    if (refus.length) {
      setErreur(`Non enregistré : ${refus.join(" ; ")}.`);
      return;
    }
    actualiser();
    onFermer();
  }

  return (
    <Cadre titre={l.immatriculationAffichee} sousTitre={`${l.marque} ${l.appellation}${l.site ? ` · ${l.site}` : ""}`} href={`/flotte/${l.immatriculation}`} erreur={erreur} onFermer={onFermer} onValider={valider} enCours={enCours}>
      <Ligne libelle="Statut">
        <select value={statut} onChange={(e) => setStatut(e.target.value as StatutVehicule)} className={champ}>
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {STATUT_VEHICULE[s].libelle}
            </option>
          ))}
        </select>
      </Ligne>
      <div className="rounded-[12px] border border-bordure p-3">
        <p className="label-champ mb-2">Chauffeur affecté</p>
        <div className="mb-2 flex h-8 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Quart">
          {(["journee", "matin", "soir"] as const).map((q) => (
            <button key={q} type="button" aria-pressed={quart === q} onClick={() => choisirQuart(q)} className={`h-6 flex-1 rounded-full text-[12px] transition-colors ${quart === q ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}>
              {q === "journee" ? "Journée" : q === "matin" ? "Quart de matin" : "Quart de soir"}
            </button>
          ))}
        </div>
        <select value={chauffeur} onChange={(e) => setChauffeur(e.target.value)} className={champ} aria-label="Chauffeur">
          <option value="">— inchangé —</option>
          {chauffeurs.map((o) => (
            <option key={o.valeur} value={o.valeur}>
              {o.libelle}
            </option>
          ))}
        </select>
        {quart !== "journee" ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Ligne libelle="Prise du quart">
              <input value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} placeholder="06:00" className={champ} />
            </Ligne>
            <Ligne libelle="Relève">
              <input value={heureFin} onChange={(e) => setHeureFin(e.target.value)} placeholder="18:00" className={champ} />
            </Ligne>
          </div>
        ) : null}
        {quarts.length ? <p className="meta mt-2">{quarts.map((q) => `${q.quart === "matin" ? "Matin" : "Soir"} ${q.heures} : ${q.nom}`).join(" · ")}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Ligne libelle="Business unit">
          <select value={bu} onChange={(e) => setBu(e.target.value)} className={champ}>
            <option value="">—</option>
            {Object.entries(BUSINESS_UNIT).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </Ligne>
        <Ligne libelle="Site">
          <select value={site} onChange={(e) => setSite(e.target.value)} className={champ}>
            <option value="">—</option>
            {sites.map((s) => (
              <option key={s.valeur} value={s.valeur}>
                {s.libelle}
              </option>
            ))}
          </select>
        </Ligne>
      </div>
      <Ligne libelle="Motif" precision="Facultatif — gardé au journal du véhicule">
        <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Panne d'embrayage, remplacement du chauffeur…" className={champ} />
      </Ligne>
    </Cadre>
  );
}

function AjusterTiers({ camion: c, onFermer }: { camion: LigneCamionTiers; onFermer: () => void }) {
  const { actualiser } = useEdition();
  const [statut, setStatut] = useState<StatutVehicule>(c.statut);
  const [nom, setNom] = useState(c.chauffeur?.nom ?? "");
  const [telephone, setTelephone] = useState(c.chauffeur?.telephone ?? "");
  const [bu, setBu] = useState(c.businessUnit ?? "");
  const [motif, setMotif] = useState("");

  function valider() {
    const champs = champsCamion("modification").filter((x) => ["statut", "chauffeurNom", "chauffeurTelephone", "businessUnit"].includes(x.cle));
    enregistrerModification({
      numero: `CAM-${c.immatriculation}`,
      sujet: `camion:${c.immatriculation}`,
      type: "camion",
      titre: `Camion ${c.immatriculationAffichee}`,
      href: `/transporteurs/camions/${c.immatriculation}`,
      champs,
      avant: { statut: c.statut, chauffeurNom: c.chauffeur?.nom ?? "", chauffeurTelephone: c.chauffeur?.telephone ?? "", businessUnit: c.businessUnit ?? "" },
      apres: { statut, chauffeurNom: nom.trim(), chauffeurTelephone: telephone.trim(), businessUnit: bu },
      motif: motif.trim() || "Ajusté au point du matin",
    });
    actualiser();
    onFermer();
  }

  return (
    <Cadre titre={c.immatriculationAffichee} sousTitre={`${c.transporteur}${c.capaciteTonnes ? ` · ${c.capaciteTonnes} t` : ""}`} href={`/transporteurs/camions/${c.immatriculation}`} erreur={null} onFermer={onFermer} onValider={valider} enCours={false}>
      <Ligne libelle="Statut">
        <select value={statut} onChange={(e) => setStatut(e.target.value as StatutVehicule)} className={champ}>
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {STATUT_VEHICULE[s].libelle}
            </option>
          ))}
        </select>
      </Ligne>
      <div className="grid grid-cols-2 gap-3">
        <Ligne libelle="Chauffeur">
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={c.chauffeurReleve ?? "Nom du chauffeur"} className={champ} />
        </Ligne>
        <Ligne libelle="Téléphone">
          <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="77 000 00 00" className={champ} />
        </Ligne>
      </div>
      <Ligne libelle="Business unit servie">
        <select value={bu} onChange={(e) => setBu(e.target.value)} className={champ}>
          <option value="">—</option>
          {Object.entries(BUSINESS_UNIT).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
      </Ligne>
      <Ligne libelle="Motif" precision="Facultatif — gardé au journal du camion">
        <input value={motif} onChange={(e) => setMotif(e.target.value)} className={champ} />
      </Ligne>
    </Cadre>
  );
}
