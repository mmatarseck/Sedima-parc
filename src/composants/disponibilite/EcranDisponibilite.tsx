"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { BandeauKpi } from "@/composants/interface/BandeauKpi";
import { Pastille, PastilleStatut } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { ETAT_DISPONIBILITE, capaciteParCategorie, etatDisponibilite, type CapaciteCategorie, type LigneDisponibilite } from "@/domaine/disponibilite";
import { lireToutesCreations } from "@/lib/clotures-demo";
import type { StatutVehicule } from "@/domaine/types";
import { BUSINESS_UNIT, CATEGORIE_FLOTTE, CATEGORIE_VEHICULE, STATUT_VEHICULE, TYPE_DOCUMENT, USAGE_VEHICULE } from "@/domaine/libelles";
import type { BusinessUnit } from "@/domaine/types";
import { date, nombre, pourcentage } from "@/lib/format";

/* ============================================================================
 * Disponibilité du jour.
 *
 * Un bandeau — c'est un écran de pilotage, pas une liste de référentiel —,
 * la capacité par catégorie, puis la liste véhicule par véhicule avec ce qui
 * manque pour être prêt. Le filet porte l'état de disponibilité, pas le statut :
 * un véhicule en service sans chauffeur n'est pas prêt.
 *
 * Le serveur calcule la liste sur le jeu de démonstration ; **un changement de
 * statut déclaré dans l'application** — mise en réparation après un incident,
 * remise en service — ne lui est pas connu. L'écran le reprend donc au montage,
 * et l'état de disponibilité se recalcule avec : déclarer qu'un véhicule est en
 * réparation doit le sortir des prêts à charger le matin même, sinon la
 * déclaration ne sert à rien.
 * ==========================================================================*/

/* La capacité se lit par catégorie de véhicule, par catégorie de flotte ou par type
   d'usage (vrac, frigorifique, plateau…) — « combien de vracs prêts ce matin ? ». */
type Maille = "categorie" | "flotte" | "usage";

const FILTRES: FiltreListe<LigneDisponibilite>[] = [
  { cle: "tous", libelle: "Tous", retient: () => true },
  { cle: "prets", libelle: "Prêts à charger", retient: (l) => l.etat === "pret" },
  { cle: "manque", libelle: "Opérationnels non prêts", retient: (l) => l.etat === "sans-conducteur" || l.etat === "conducteur-empeche" },
  { cle: "immobilises", libelle: "Immobilisés", retient: (l) => l.etat === "immobilise" },
  { cle: "hors", libelle: "Hors périmètre", retient: (l) => l.etat === "hors-perimetre" },
];

const IDENTIFIANT = { cle: "immat", libelle: "Immat.", largeur: 108, rendu: (l: LigneDisponibilite) => <span className="code">{l.immatriculationAffichee}</span> };

const COLONNES: ColonneListe<LigneDisponibilite>[] = [
  {
    cle: "etat",
    libelle: "Disponibilité",
    parDefaut: true,
    largeur: 170,
    rendu: (l) => <Pastille ton={l.etat === "pret" ? "favorable" : l.etat === "hors-perimetre" ? "neutre" : l.etat === "immobilise" ? "defavorable" : "vigilance"}>{ETAT_DISPONIBILITE[l.etat].libelle}</Pastille>,
    texte: (l) => ETAT_DISPONIBILITE[l.etat].libelle,
  },
  {
    cle: "conducteur",
    libelle: "Conducteur du jour",
    parDefaut: true,
    largeur: 190,
    rendu: (l) =>
      l.conducteur ? (
        /* Le rôle et l'empêchement ne sont pas répétés sous le nom (demande du
           métier du 3 septembre) : « Ce qui manque » porte déjà l'empêchement,
           et la couleur du nom suffit à le signaler. */
        <Link href={`/chauffeurs/${l.conducteur.id}`} onClick={(e) => e.stopPropagation()} title={l.conducteur.role === "suppleant" ? "Suppléant" : "Titulaire"} className={`block truncate font-medium ${l.conducteur.empechement ? "text-vigilance" : "text-texte"} hover:underline`}>
          {l.conducteur.nom}
        </Link>
      ) : (
        <span className="text-attenue-2">—</span>
      ),
  },
  { cle: "motif", libelle: "Ce qui manque", parDefaut: true, largeur: 260, rendu: (l) => (l.motif ? <span className="block truncate text-texte-2">{l.motif}</span> : <span className="text-attenue-2">rien</span>) },
  {
    cle: "statut",
    libelle: "Statut",
    parDefaut: true,
    largeur: 190,
    /* Le motif administratif n'est plus répété sous la pastille (demande du
       métier du 3 septembre) : il est dans « Ce qui manque », et reste lisible
       au survol. */
    rendu: (l) => (
      <span title={l.immobilisation ? `Immobilisation administrative · ${l.immobilisation.documents.map((d) => TYPE_DOCUMENT[d.type].toLowerCase()).join(", ")}` : undefined}>
        <PastilleStatut statut={l.statutEffectif} />
      </span>
    ),
    texte: (l) => STATUT_VEHICULE[l.statutEffectif].libelle,
  },
  { cle: "vehicule", libelle: "Véhicule", parDefaut: true, largeur: 200, rendu: (l) => <span className="block truncate">{l.marque} {l.appellation}</span> },
  { cle: "categorie", libelle: "Catégorie", parDefaut: true, largeur: 128, rendu: (l) => CATEGORIE_VEHICULE[l.categorie] },
  { cle: "flotte", libelle: "Catégorie de flotte", parDefaut: false, largeur: 140, rendu: (l) => CATEGORIE_FLOTTE[l.categorieFlotte] },
  { cle: "charge", libelle: "Charge utile", alignee: "droite", parDefaut: true, largeur: 120, rendu: (l) => (l.chargeUtile ? <span className="code">{nombre(l.chargeUtile / 1000, 1)} t</span> : <span className="text-attenue-2">—</span>) },
  { cle: "site", libelle: "Site", parDefaut: true, largeur: 150, rendu: (l) => l.site ?? "—" },
  {
    cle: "action",
    libelle: "Action",
    parDefaut: true,
    largeur: 120,
    rendu: (l) =>
      l.etat === "sans-conducteur" || l.etat === "conducteur-empeche" ? (
        <Link href="/affectations" onClick={(e) => e.stopPropagation()} className="bouton-discret h-7 px-2 text-[12px]">
          Affecter
        </Link>
      ) : l.etat === "immobilise" ? (
        <Link href={`/flotte/${l.immatriculation}?onglet=${l.immobilisation ? "conformite" : "journal"}`} onClick={(e) => e.stopPropagation()} className="bouton-discret h-7 px-2 text-[12px]">
          {l.immobilisation ? "Régulariser" : "Voir"}
        </Link>
      ) : null,
  },
];

/** Le dernier statut déclaré pour chaque véhicule, à la date du jour. */
function statutsDeclares(jour: string): Map<string, StatutVehicule> {
  const parVehicule = new Map<string, { debut: string; statut: StatutVehicule }>();
  for (const c of lireToutesCreations("statut")) {
    if (!c.sujet.startsWith("vehicule:")) continue;
    const immatriculation = c.sujet.slice("vehicule:".length);
    const debut = String(c.valeurs.debut ?? c.date).slice(0, 10);
    /* Un statut à effet futur ne vaut pas aujourd'hui. */
    if (debut > jour) continue;
    const statut = String(c.valeurs.statut ?? "") as StatutVehicule;
    if (!statut) continue;
    const connu = parVehicule.get(immatriculation);
    if (!connu || debut >= connu.debut) parVehicule.set(immatriculation, { debut, statut });
  }
  return new Map([...parVehicule].map(([immat, x]) => [immat, x.statut]));
}

export function EcranDisponibilite({ lignes: toutes, aujourdhui }: { lignes: LigneDisponibilite[]; aujourdhui: string }) {
  const [maille, setMaille] = useState<Maille>("categorie");
  /* Le filtre par BU tient tout l'écran : KPI, capacité et liste parlent de la même
     population — la disponibilité d'une BU est la question du matin de son responsable. */
  const [bu, setBu] = useState<BusinessUnit | "toutes">("toutes");
  const bus = useMemo(() => (Object.keys(BUSINESS_UNIT) as BusinessUnit[]).filter((b) => toutes.some((l) => l.businessUnit === b)), [toutes]);

  /* Les créations vivent dans le navigateur : elles ne peuvent être lues qu'après
     le montage, sinon le rendu du serveur et celui du client divergeraient. */
  const [declares, setDeclares] = useState<Map<string, StatutVehicule>>(() => new Map());
  useEffect(() => setDeclares(statutsDeclares(aujourdhui)), [aujourdhui]);

  const aJour = useMemo(() => {
    if (declares.size === 0) return toutes;
    return toutes.map((l) => {
      const statutEffectif = declares.get(l.immatriculation);
      if (!statutEffectif || statutEffectif === l.statutEffectif) return l;
      /* Un statut déclaré prime sur celui du référentiel, mais pas sur une
         immobilisation administrative : remettre « en service » un véhicule
         dont l'assurance est échue ne le rend pas conforme pour autant. */
      if (l.immobilisation) return l;
      const base = { ...l, statutSaisi: statutEffectif, statutEffectif };
      const { etat, motif } = etatDisponibilite(base);
      return { ...base, etat, motif };
    });
  }, [toutes, declares]);

  const lignes = useMemo(() => (bu === "toutes" ? aJour : aJour.filter((l) => l.businessUnit === bu)), [aJour, bu]);

  const engages = lignes.filter((l) => l.engage && l.etat !== "hors-perimetre");
  const prets = lignes.filter((l) => l.etat === "pret");
  const operationnels = lignes.filter((l) => STATUT_VEHICULE[l.statutEffectif].operationnel && l.engage && l.etat !== "hors-perimetre");
  const nonPrets = lignes.filter((l) => l.etat === "sans-conducteur" || l.etat === "conducteur-empeche");
  const tdpa = engages.length ? (operationnels.length / engages.length) * 100 : null;
  const chargePrete = prets.reduce((s, l) => s + (l.chargeUtile ?? 0), 0);

  const capacites = useMemo<CapaciteCategorie[]>(
    () =>
      maille === "categorie"
        ? capaciteParCategorie(lignes, CATEGORIE_VEHICULE, (l) => l.categorie)
        : maille === "flotte"
          ? capaciteParCategorie(lignes, CATEGORIE_FLOTTE, (l) => l.categorieFlotte)
          : capaciteParCategorie(lignes, USAGE_VEHICULE, (l) => l.usage),
    [lignes, maille],
  );

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full lg:min-h-0">
      <TitreEcran
        titre="Disponibilité du jour"
        sousTitre={`Au ${date(aujourdhui)} · prêt à charger = opérationnel + conducteur affecté, disponible et apte · statut effectif, documents compris`}
        actions={
          <div className="sans-barre flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-surface-3 p-1" role="group" aria-label="Business unit">
            {[{ cle: "toutes" as const, libelle: "Toutes BU" }, ...bus.map((b) => ({ cle: b, libelle: BUSINESS_UNIT[b] }))].map((o) => (
              <button key={o.cle} type="button" aria-pressed={bu === o.cle} onClick={() => setBu(o.cle)} className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${bu === o.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}>
                {o.libelle}
              </button>
            ))}
          </div>
        }
      />

      <div className="shrink-0">
        <BandeauKpi
          kpis={[
            { label: "Prêts à charger", valeur: `${prets.length}`, unite: `/ ${engages.length}`, precision: "véhicules engagés au parc", ton: prets.length >= engages.length * 0.7 ? "favorable" : "vigilance" },
            { label: "Disponibilité du parc", valeur: tdpa === null ? "—" : nombre(tdpa, 0), unite: "%", precision: "D_TDPA du jour — opérationnels sur engagés", ton: tdpa !== null && tdpa < 85 ? "defavorable" : "favorable" },
            { label: "Charge utile prête", valeur: nombre(chargePrete / 1000, 1), unite: "t", precision: "somme des charges utiles des véhicules prêts" },
            { label: "Opérationnels non prêts", valeur: `${nonPrets.length}`, precision: "sans conducteur ou conducteur empêché", ton: nonPrets.length > 0 ? "vigilance" : "favorable" },
          ]}
        />
      </div>

      {/* La capacité par catégorie tient en une bande : une tuile par catégorie,
          prêts sur engagés, part et charge utile prête. Le tableau, lui, prenait la
          place de la liste des véhicules — qui est l'objet de l'écran. */}
      <section className="carte shrink-0 px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="titre-bloc shrink-0">Capacité par catégorie</h2>
          <p className="meta hidden min-w-0 truncate xl:block">prêts sur engagés · charge utile prête</p>
          <div className="ml-auto flex h-7 shrink-0 items-center gap-0.5 rounded-full bg-surface-3 p-0.5" role="group" aria-label="Maille">
            {(
              [
                { cle: "categorie", libelle: "Véhicule" },
                { cle: "flotte", libelle: "Flotte" },
                { cle: "usage", libelle: "Type" },
              ] as { cle: Maille; libelle: string }[]
            ).map((m) => (
              <button key={m.cle} type="button" aria-pressed={maille === m.cle} onClick={() => setMaille(m.cle)} className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${maille === m.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}>
                {m.libelle}
              </button>
            ))}
          </div>
        </div>
        <div className="sans-barre mt-2.5 flex gap-2 overflow-x-auto">
          {capacites.map((c) => {
            const part = c.engages ? (c.prets / c.engages) * 100 : 0;
            return (
              <div key={c.cle} className="flex min-w-[148px] shrink-0 flex-col gap-0.5 rounded-[10px] border border-bordure bg-surface-2 px-3 py-2" title={`${c.libelle} : ${c.engages} engagés, ${c.operationnels} opérationnels, ${c.prets} prêts`}>
                <span className="micro-sur-titre truncate">{c.libelle}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[17px] leading-none font-semibold text-texte">{c.prets}</span>
                  <span className="text-[12px] text-attenue">/ {c.engages} · {pourcentage(part, 0)}</span>
                </span>
                <span className="meta">{nombre(c.chargeUtilePrete / 1000, 1)} t sur {nombre(c.chargeUtileTotale / 1000, 1)} t</span>
              </div>
            );
          })}
        </div>
      </section>

      <TableListe<LigneDisponibilite>
        ecran="disponibilite"
        lignes={lignes}
        cle={(l) => l.vehiculeId}
        href={(l) => `/flotte/${l.immatriculation}`}
        filet={(l) => ({ couleur: ETAT_DISPONIBILITE[l.etat].couleur, libelle: ETAT_DISPONIBILITE[l.etat].libelle, precision: ETAT_DISPONIBILITE[l.etat].precision })}
        identifiant={IDENTIFIANT}
        colonnes={COLONNES}
        filtres={FILTRES}
        champsRecherche={(l) => [l.immatriculationAffichee, l.immatriculation, l.marque, l.appellation, l.conducteur?.nom ?? "", l.site ?? "", l.motif ?? ""]}
        placeholderRecherche="Immatriculation, chauffeur, site, motif…"
        libelleRecherche="Rechercher un véhicule"
        libelleUnite="véhicules"
        vide="Aucun véhicule ne correspond."
      />
    </div>
  );
}
