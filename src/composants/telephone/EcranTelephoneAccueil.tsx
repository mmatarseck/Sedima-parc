"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Fuel, Gauge, Inbox, PenLine, Search, TriangleAlert } from "lucide-react";
import { statutTransfert, type Transfert } from "@/domaine/transferts";
import { lireTransferts } from "@/lib/transferts-demo";
import { mesTransferts } from "./EcranTelephoneTransferts";
import { TYPE_DEMANDE, statutDemande, type Demande } from "@/domaine/demandes";
import { lireDemandes } from "@/lib/demandes-demo";
import { mesDemandes } from "./EcranTelephoneDemandes";
import { lireAccesCourant } from "@/lib/acces-courant";
import { trouverProfil, type AccesCourant } from "@/domaine/acces";
import { TYPE_DOCUMENT } from "@/domaine/libelles";
import type { LigneFlotte } from "@/domaine/types";
import { lireIdentite, lireRole } from "@/lib/session-demo";
import { trouverRole } from "@/domaine/roles";
import { initiales as initialesDe } from "@/lib/session-demo";
import { dansPerimetre } from "./perimetre";
import { Bloc, Chiffre, EnTeteTelephone, Ligne } from "./Telephone";

/* ============================================================================
 * Téléphone › Accueil — réduit au périmètre de la personne : ce qui roule,
 * ce qui est immobilisé, ce qu'il y a à faire aujourd'hui, et les quatre
 * gestes. Un lecteur n'a que les chiffres.
 * ==========================================================================*/

const OPERATIONNELS = new Set(["en-service", "en-backup"]);

export function EcranTelephoneAccueil({ lignes, aujourdhui, demandes, transferts, maintenant }: { lignes: LigneFlotte[]; aujourdhui: string; demandes: Demande[]; transferts: Transfert[]; maintenant: string }) {
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [nom, setNom] = useState("");
  const [listeDemandes, setListeDemandes] = useState<Demande[]>(demandes);
  const [listeTransferts, setListeTransferts] = useState<Transfert[]>(transferts);
  useEffect(() => {
    setAcces(lireAccesCourant());
    setNom(lireIdentite()?.nom ?? trouverRole(lireRole()).nom);
    setListeDemandes(lireDemandes(demandes));
    setListeTransferts(lireTransferts(transferts));
  }, [demandes, transferts]);

  /* Les fiches de transfert qui attendent une signature : les miennes pour un détenteur, celles du périmètre sinon. */
  const transfertsASigner = useMemo(() => (acces ? mesTransferts(listeTransferts, acces).filter((t) => { const s = statutTransfert(t); return s !== "complete" && s !== "annulee"; }) : []), [listeTransferts, acces]);

  /* Les demandes qui attendent : les miennes pour un détenteur, celles du périmètre sinon. */
  const demandesOuvertes = useMemo(() => (acces ? mesDemandes(listeDemandes, acces).filter((d) => statutDemande(d, maintenant) === "a-repondre" || statutDemande(d, maintenant) === "en-retard") : []), [listeDemandes, acces, maintenant]);
  const enRetard = demandesOuvertes.filter((d) => statutDemande(d, maintenant) === "en-retard").length;

  const miennes = useMemo(() => (acces ? lignes.filter((l) => dansPerimetre(l, acces)) : lignes), [lignes, acces]);
  const engagees = miennes.filter((l) => l.vehicule.engage && l.vehicule.statut !== "a-recevoir");
  const disponibles = engagees.filter((l) => OPERATIONNELS.has(l.statutEffectif ?? l.vehicule.statut));
  const immobilises = engagees.filter((l) => !OPERATIONNELS.has(l.statutEffectif ?? l.vehicule.statut));
  const echeances = miennes
    .filter((l) => l.prochaineEcheanceConformite && l.prochaineEcheanceConformite.joursRestants <= 30)
    .sort((a, b) => a.prochaineEcheanceConformite!.joursRestants - b.prochaineEcheanceConformite!.joursRestants)
    .slice(0, 4);
  const sansReleve = miennes.filter((l) => l.vehicule.engage && (!l.dateKilometrage || joursEntre(l.dateKilometrage, aujourdhui) > 7)).length;
  const profil = acces ? trouverProfil(acces.profil) : null;
  const saisit = acces ? acces.niveaux.releves !== "aucun" && acces.niveaux.releves !== "lecture" : false;
  const perimetreLibelle = acces && acces.perimetre.sites !== "tous" ? `${acces.perimetre.sites.length} site${acces.perimetre.sites.length > 1 ? "s" : ""}` : "tout le parc";

  /* Le détenteur n'a que son véhicule et ses demandes (cadrage du 7 septembre 2026). */
  if (acces?.profil === "detenteur") {
    const monVehicule = demandesOuvertes[0]?.vehicule ?? mesDemandes(listeDemandes, acces)[0]?.vehicule ?? null;
    return (
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-1">
        <EnTeteTelephone titre="Mon véhicule" droite={<span className="grid size-8 place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-texte-2">{initialesDe(nom || "SP")}</span>} />
        <p className="meta -mt-2 px-4">
          {nom} · {profil?.libelle ?? "Détenteur"}
        </p>
        <Bloc>{monVehicule ? <Ligne icone={monVehicule.immatriculation.slice(0, 2)} titre={monVehicule.immatriculation} precision={monVehicule.libelle} /> : <p className="meta py-1">Aucun véhicule ne vous est encore rattaché dans l&apos;application.</p>}</Bloc>
        <Bloc titre="À répondre" accent={demandesOuvertes.length > 0}>
          {demandesOuvertes.length === 0 ? <p className="meta py-1">Rien à répondre. Le parc vous préviendra.</p> : null}
          {demandesOuvertes.slice(0, 4).map((d) => (
            <Ligne key={d.id} icone={<Inbox className="size-4" strokeWidth={2} />} ton={statutDemande(d, maintenant) === "en-retard" ? "defavorable" : "vigilance"} titre={TYPE_DEMANDE[d.type].libelle} precision={`${d.vehicule.immatriculation} · ${statutDemande(d, maintenant) === "en-retard" ? "en retard" : "à répondre"}`} href="/telephone/demandes" />
          ))}
          {transfertsASigner.map((t) => (
            <Ligne key={t.id} icone={<PenLine className="size-4" strokeWidth={2} />} ton="vigilance" titre={`Fiche de transfert · ${t.motif}`} precision={`${t.vehicule.immatriculation} · à signer`} href={`/transferts/${t.id}`} />
          ))}
        </Bloc>
        <div className="grid grid-cols-2 gap-2">
          <Geste href="/telephone/demandes" icone={<Inbox className="size-4" strokeWidth={2} />} libelle="Mes demandes" />
          <Geste href="/telephone/transferts" icone={<PenLine className="size-4" strokeWidth={2} />} libelle="Mes transferts" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-1">
      <EnTeteTelephone
        titre={perimetreLibelle === "tout le parc" ? "Le parc" : "Mon site"}
        droite={<span className="grid size-8 place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-texte-2">{initialesDe(nom || "SP")}</span>}
      />
      <p className="meta -mt-2 px-4">
        {nom}
        {profil ? ` · ${profil.libelle}` : ""} · {perimetreLibelle}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Chiffre valeur={`${disponibles.length} / ${engagees.length}`} libelle="véhicules disponibles" />
        <Chiffre valeur={immobilises.length} libelle="immobilisés" alerte={immobilises.length > 0} />
      </div>

      <Bloc titre="À faire aujourd'hui">
        {echeances.length === 0 && immobilises.length === 0 && sansReleve === 0 ? <p className="meta py-1">Rien d&apos;urgent sur ce périmètre.</p> : null}
        {echeances.map((l) => {
          const e = l.prochaineEcheanceConformite!;
          return <Ligne key={`e-${l.vehicule.id}`} icone="VT" ton={e.joursRestants < 0 ? "defavorable" : "vigilance"} titre={`${l.vehicule.immatriculationAffichee} · ${TYPE_DOCUMENT[e.type].toLowerCase()}`} precision={e.joursRestants < 0 ? `échue depuis ${-e.joursRestants} j` : `dans ${e.joursRestants} j`} href={`/telephone/vehicules/${l.vehicule.id}`} />;
        })}
        {sansReleve > 0 ? <Ligne icone="km" titre="Relevés de la semaine" precision={`${sansReleve} véhicule${sansReleve > 1 ? "s" : ""} sans relevé depuis 7 jours`} href="/telephone/vehicules?geste=releve" /> : null}
        {demandesOuvertes.length > 0 ? <Ligne icone={<Inbox className="size-4" strokeWidth={2} />} ton={enRetard > 0 ? "defavorable" : "vigilance"} titre="Demandes sans réponse" precision={`${demandesOuvertes.length} en attente${enRetard ? `, dont ${enRetard} en retard` : ""}`} href="/telephone/demandes" /> : null}
        {transfertsASigner.length > 0 ? <Ligne icone={<PenLine className="size-4" strokeWidth={2} />} ton="vigilance" titre="Fiches de transfert à signer" precision={`${transfertsASigner.length} fiche${transfertsASigner.length > 1 ? "s" : ""} en attente d'une signature`} href="/telephone/transferts" /> : null}
        {immobilises.slice(0, 3).map((l) => (
          <Ligne key={`i-${l.vehicule.id}`} icone="!" ton="defavorable" titre={`${l.vehicule.immatriculationAffichee} · ${l.vehicule.marque} ${l.vehicule.appellation}`} precision={l.immobilisationAdministrative?.length ? "immobilisé administrativement" : "immobilisé"} href={`/telephone/vehicules/${l.vehicule.id}`} />
        ))}
      </Bloc>

      <div className="grid grid-cols-2 gap-2">
        {saisit ? (
          <>
            <Geste href="/telephone/vehicules?geste=releve" icone={<Gauge className="size-4" strokeWidth={2} />} libelle="Relevé" />
            <Geste href="/telephone/vehicules?geste=plein" icone={<Fuel className="size-4" strokeWidth={2} />} libelle="Plein" />
            <Geste href="/telephone/vehicules?geste=panne" icone={<TriangleAlert className="size-4" strokeWidth={2} />} libelle="Panne" />
          </>
        ) : null}
        <Geste href="/telephone/vehicules" icone={<Search className="size-4" strokeWidth={2} />} libelle="Chercher" />
      </div>
    </div>
  );
}

function Geste({ href, icone, libelle }: { href: string; icone: React.ReactNode; libelle: string }) {
  return (
    <Link href={href} className="carte flex flex-col items-center gap-1.5 px-2 py-3 text-[12.5px] font-semibold text-texte hover:bg-surface-2">
      <span className="grid size-9 place-items-center rounded-[10px] bg-accent-fond text-accent-fonce">{icone}</span>
      {libelle}
    </Link>
  );
}

function joursEntre(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}
