"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Fuel, Gauge, Search, TriangleAlert } from "lucide-react";
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

export function EcranTelephoneAccueil({ lignes, aujourdhui }: { lignes: LigneFlotte[]; aujourdhui: string }) {
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [nom, setNom] = useState("");
  useEffect(() => {
    setAcces(lireAccesCourant());
    setNom(lireIdentite()?.nom ?? trouverRole(lireRole()).nom);
  }, []);

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
