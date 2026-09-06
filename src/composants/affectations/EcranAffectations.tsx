"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, UserPlus, ZoomIn, ZoomOut } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Pastille, PastilleStatut } from "@/composants/interface/Pastille";
import { PastilleStatutChauffeur } from "@/composants/chauffeurs/PastilleStatutChauffeur";
import { champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { ECHELLES, bornesAffectation, bornesPlanning, conflits, curseurDe, estTiers, position, propositions, pxParJourDe, titulaireLeJour, type VehiculePlanning } from "@/domaine/affectations";
import type { LigneChauffeur } from "@/domaine/chauffeur";
import { STATUT_VEHICULE } from "@/domaine/libelles";
import { lireToutesCreations } from "@/lib/clotures-demo";
import { date } from "@/lib/format";

type Volet = "vehicules" | "chauffeurs" | "conflits";

/** Ce que le planning montre : le parc, les transporteurs, ou les deux. */
type Perimetre = "tous" | "parc" | "tiers";

/** Un chauffeur de transporteur, réduit à ce dont le planning a besoin. */
export interface ChauffeurTiersPlanning {
  id: string;
  nom: string;
  transporteur: string;
}

/* ============================================================================
 * Affectations — l'écran du matin.
 *
 * En haut, ce qui demande une décision : véhicules sans chauffeur, chauffeurs
 * libres, conflits. En bas, le planning — une ligne par véhicule, une barre
 * par affectation, le jour en trait vertical. On affecte d'ici, avec le même
 * formulaire que sur les fiches ; l'affectation est rangée sur le véhicule,
 * et les deux fiches la voient.
 * ==========================================================================*/

function Interieur({ vehicules, chauffeurs, chauffeursTiers, aujourdhui }: { vehicules: VehiculePlanning[]; chauffeurs: LigneChauffeur[]; chauffeursTiers: ChauffeurTiersPlanning[]; aujourdhui: string }) {
  const { creer, demander, version } = useEdition();
  const [creees, setCreees] = useState<Map<string, VehiculePlanning["affectations"]>>(new Map());

  /* Les affectations créées dans l'application, rangées par véhicule. */
  useEffect(() => {
    const parVehicule = new Map<string, VehiculePlanning["affectations"]>();
    for (const c of lireToutesCreations("affectation")) {
      const vehiculeId = c.sujet.startsWith("vehicule:") ? c.sujet.slice("vehicule:".length) : String(c.valeurs.vehiculeId ?? "");
      const cherche = String(c.valeurs.chauffeurId ?? c.sujet.replace(/^chauffeur:/, ""));
      /* Le conducteur peut venir du parc **ou** d un transporteur : une
         affectation programmée sur un camion tiers cite un chauffeur tiers. */
      const duParc = chauffeurs.find((x) => x.id === cherche) ?? null;
      const duTiers = duParc ? null : (chauffeursTiers.find((x) => x.id === cherche) ?? null);
      const chauffeur = duParc ? { id: duParc.id, nomComplet: duParc.nomComplet } : duTiers ? { id: duTiers.id, nomComplet: `${duTiers.nom} · ${duTiers.transporteur}` } : null;
      const a = {
        numero: c.numero,
        chauffeurId: chauffeur?.id ?? null,
        chauffeur: chauffeur?.nomComplet ?? null,
        role: (String(c.valeurs.role ?? "titulaire") as VehiculePlanning["affectations"][number]["role"]) ?? "titulaire",
        debut: String(c.valeurs.debut ?? c.date.slice(0, 10)),
        fin: c.valeurs.fin ? String(c.valeurs.fin) : null,
        motif: String(c.valeurs.motif ?? "Saisie dans l'application"),
      };
      parVehicule.set(vehiculeId, [...(parVehicule.get(vehiculeId) ?? []), a]);
    }
    setCreees(parVehicule);
  }, [version, chauffeurs, chauffeursTiers]);

  const [perimetre, setPerimetre] = useState<Perimetre>("tous");

  const planning = useMemo<VehiculePlanning[]>(() => vehicules.map((v) => ({ ...v, affectations: [...(creees.get(v.id) ?? []), ...v.affectations] })), [vehicules, creees]);
  /* Les compteurs et les conflits ne portent que sur le parc : un camion de
     transporteur sans conducteur n en est pas un que l on doive pourvoir, et
     son chauffeur ne peut pas entrer en conflit avec les nôtres. */
  const duParc = useMemo(() => planning.filter((v) => !estTiers(v)), [planning]);
  const lesTiers = useMemo(() => planning.filter(estTiers), [planning]);
  const affiches = useMemo(() => (perimetre === "parc" ? duParc : perimetre === "tiers" ? lesTiers : planning), [perimetre, duParc, lesTiers, planning]);

  /* Le zoom : un curseur de 0 à 100, en pixels par jour ; les trois repères
     sont des positions du curseur. Mois par défaut. */
  const [curseur, setCurseur] = useState(() => curseurDe(ECHELLES[0]!.pxParJour));
  const pxParJour = pxParJourDe(curseur);
  const bornes = useMemo(() => bornesPlanning(aujourdhui, pxParJour), [aujourdhui, pxParJour]);
  const echelle = bornes.echelle;
  const grille = bornes.colonnes.map((c) => `${c.largeur}px`).join(" ");
  const largeurPiste = bornes.largeur;

  /* Le jour J reste à l'écran : à l'ouverture et à chaque zoom, la zone se
     cale pour que le trait d'aujourd'hui soit au tiers de la partie visible. */
  const zone = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const z = zone.current;
    if (!z) return;
    const xJour = (position(bornes.maintenant, bornes.debut, bornes.fin) / 100) * bornes.largeur;
    const visible = Math.max(0, z.clientWidth - 220);
    z.scrollLeft = Math.max(0, Math.round(xJour - visible / 3));
  }, [bornes]);
  const lesConflits = useMemo(() => conflits(duParc, chauffeurs, aujourdhui), [duParc, chauffeurs, aujourdhui]);
  const sansTitulaire = duParc.filter((v) => v.engage && STATUT_VEHICULE[v.statut].operationnel && !titulaireLeJour(v, aujourdhui));
  const disponibles = chauffeurs.filter((c) => c.statut === "disponible");
  /* Un seul volet ouvert à la fois ; fermé par défaut, le planning a la place. */
  const [volet, setVolet] = useState<Volet | null>(null);

  function affecter(vehiculeId?: string, chauffeurId?: string) {
    creer({
      type: "affectation",
      titre: "Nouvelle affectation",
      champs: champsCreation("affectation", { pour: "planning" }),
      valeurs: { vehiculeId: vehiculeId ?? null, chauffeurId: chauffeurId ?? null, role: "titulaire", debut: aujourdhui },
      sujetDe: (valeurs) => `vehicule:${String(valeurs.vehiculeId ?? "")}`,
    });
  }

  const positionJour = position(bornes.maintenant, bornes.debut, bornes.fin);

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full lg:min-h-0">
      <TitreEcran
        titre="Affectations"
        sousTitre={`${sansTitulaire.length} véhicule${sansTitulaire.length > 1 ? "s" : ""} sans titulaire · ${disponibles.length} chauffeur${disponibles.length > 1 ? "s" : ""} disponible${disponibles.length > 1 ? "s" : ""} · ${lesConflits.filter((c) => c.gravite === "defavorable").length} conflit${lesConflits.filter((c) => c.gravite === "defavorable").length > 1 ? "s" : ""} · au ${date(aujourdhui)}`}
        actions={
          <button type="button" onClick={() => affecter()} className="bouton-principal">
            <Plus className="size-4" strokeWidth={2.2} />
            Nouvelle affectation
          </button>
        }
      />

      {/* ---- Le point du jour : un bandeau, trois compteurs, un volet à la fois.
          Trois cartes prenaient l'écran ; le planning est l'objet de la page. ---- */}
      <section className="carte shrink-0">
        <div className="flex flex-wrap items-stretch divide-x divide-bordure">
          {(
            [
              { cle: "vehicules", nombre: sansTitulaire.length, libelle: sansTitulaire.length > 1 ? "véhicules sans titulaire" : "véhicule sans titulaire", ton: sansTitulaire.length ? "bg-vigilance" : "bg-accent", precision: "opérationnels, engagés, sans conducteur" },
              { cle: "chauffeurs", nombre: disponibles.length, libelle: disponibles.length > 1 ? "chauffeurs disponibles" : "chauffeur disponible", ton: "bg-accent", precision: "actifs, sans affectation en cours" },
              { cle: "conflits", nombre: lesConflits.length, libelle: lesConflits.length > 1 ? "conflits" : "conflit", ton: lesConflits.some((c) => c.gravite === "defavorable") ? "bg-defavorable" : lesConflits.length ? "bg-vigilance" : "bg-accent", precision: lesConflits.length ? "à traiter aujourd'hui" : "rien à signaler" },
            ] as { cle: Volet; nombre: number; libelle: string; ton: string; precision: string }[]
          ).map((v) => (
            <button
              key={v.cle}
              type="button"
              aria-expanded={volet === v.cle}
              onClick={() => setVolet((o) => (o === v.cle ? null : v.cle))}
              className={`flex min-w-[200px] flex-1 items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-surface-2 ${volet === v.cle ? "bg-surface-2" : ""}`}
            >
              <span className={`size-2 shrink-0 rounded-full ${v.ton}`} />
              <span className="text-[20px] leading-none font-semibold tracking-tight text-texte">{v.nombre}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-texte">{v.libelle}</span>
                <span className="meta block truncate">{v.precision}</span>
              </span>
              <ChevronDown className={`ml-auto size-4 shrink-0 text-attenue transition-transform ${volet === v.cle ? "rotate-180" : ""}`} strokeWidth={1.8} />
            </button>
          ))}
        </div>

        {volet === "vehicules" ? (
          <div className="border-t border-bordure px-5 py-3">
            {sansTitulaire.length === 0 ? (
              <p className="meta">Tous les véhicules opérationnels ont un titulaire.</p>
            ) : (
              <ul className="defilement-discret flex max-h-[180px] flex-col overflow-y-auto">
                {sansTitulaire.map((v) => {
                  const props = propositions(v, chauffeurs);
                  return (
                    <li key={v.id} className="border-b border-bordure py-2.5 first:pt-0 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <Link href={`/flotte/${v.immatriculation}`} className="code font-semibold text-accent-fonce hover:underline">
                          {v.immatriculationAffichee}
                        </Link>
                        <span className="meta truncate">
                          {v.marque} {v.appellation}
                          {v.site ? ` · ${v.site}` : ""}
                        </span>
                        <button type="button" onClick={() => affecter(v.id)} className="bouton-discret ml-auto h-7 px-2 text-[12px]">
                          <UserPlus className="size-3.5" strokeWidth={1.8} />
                          Affecter
                        </button>
                      </div>
                      {props.length ? (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {props.map((p) => (
                            <li key={p.chauffeur.id}>
                              <button
                                type="button"
                                onClick={() => affecter(v.id, p.chauffeur.id)}
                                title={`Proposer ${p.chauffeur.nomComplet} — ${p.raison}`}
                                className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent-fond px-2 text-[12px] font-medium text-accent-tres-fonce hover:bg-accent-bordure"
                              >
                                {p.chauffeur.nomComplet}
                                <span className="meta text-[11px] text-accent-tres-fonce/70">{p.raison}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="meta mt-1">Aucun chauffeur disponible apte pour ce véhicule.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {volet === "chauffeurs" ? (
          <div className="border-t border-bordure px-5 py-3">
            {disponibles.length === 0 ? (
              <p className="meta">Personne n&apos;est disponible.</p>
            ) : (
              <ul className="defilement-discret grid max-h-[180px] grid-cols-1 gap-x-6 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
                {disponibles.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 border-b border-bordure py-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-fond text-[10.5px] font-semibold text-accent-tres-fonce">{c.initiales}</span>
                    <span className="min-w-0 flex-1">
                      <Link href={`/chauffeurs/${c.id}`} className="block truncate text-[13px] font-medium text-texte hover:text-accent-fonce hover:underline">
                        {c.nomComplet}
                      </Link>
                      <span className="meta block truncate">
                        {c.chauffeur.permisCategories.join(" · ")}
                        {c.site ? ` · ${c.site.libelle}` : ""}
                        {c.chauffeur.aptitude !== "apte" ? ` · ${c.chauffeur.aptitude === "inapte" ? "inapte" : "avec réserve"}` : ""}
                      </span>
                    </span>
                    <button type="button" onClick={() => affecter(undefined, c.id)} className="bouton-discret h-7 px-2 text-[12px]">
                      Affecter
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {volet === "conflits" ? (
          <div className="border-t border-bordure px-5 py-3">
            {lesConflits.length === 0 ? (
              <p className="text-[13px] text-texte">Chaque véhicule a un conducteur apte, chaque chauffeur un seul véhicule.</p>
            ) : (
              <ul className="defilement-discret flex max-h-[180px] flex-col overflow-y-auto">
                {lesConflits.map((c) => (
                  <li key={c.cle} className="flex items-start gap-3 border-b border-bordure py-2.5 first:pt-0 last:border-b-0 last:pb-0">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${c.gravite === "defavorable" ? "bg-defavorable" : "bg-vigilance"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-texte">{c.titre}</p>
                      <p className="meta mt-0.5">{c.precision}</p>
                    </div>
                    {c.vehiculeId ? (
                      <button type="button" onClick={() => affecter(c.vehiculeId ?? undefined)} className="bouton-discret h-7 px-2 text-[12px]">
                        Affecter
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      {/* ---- Planning ---- */}
      <section className="carte flex min-w-0 flex-col overflow-hidden lg:min-h-0 lg:flex-1">
        <header className="flex shrink-0 flex-wrap items-start gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="titre-bloc">Planning</h2>
            <p className="meta mt-0.5">
              Du {date(bornes.debut)} au {date(bornes.fin)} · titulaire en plein, suppléant en clair, chauffeur habituel d&apos;un transporteur en pointillé ambre · le trait vertical est{" "}
              {echelle === "heure" ? "midi, aujourd'hui" : "aujourd'hui"}
            </p>
          </div>
          {/* Le périmètre : le parc, les transporteurs, ou les deux. On organise
              la même journée d'exploitation, mais on ne la lit pas toujours en
              entier — et les compteurs du bandeau, eux, ne portent que le parc. */}
          <div className="ml-auto flex items-center gap-3">
            <div className="flex h-8 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Périmètre du planning">
              {(
                [
                  { cle: "tous", libelle: "Tous", compte: planning.length },
                  { cle: "parc", libelle: "Parc SEDIMA", compte: duParc.length },
                  { cle: "tiers", libelle: "Transporteurs", compte: lesTiers.length },
                ] as { cle: Perimetre; libelle: string; compte: number }[]
              ).map((p) => (
                <button
                  key={p.cle}
                  type="button"
                  aria-pressed={perimetre === p.cle}
                  onClick={() => setPerimetre(p.cle)}
                  className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${perimetre === p.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}
                >
                  {p.libelle}
                  <span className={`ml-1.5 ${perimetre === p.cle ? "text-attenue" : "text-attenue-2"}`}>{p.compte}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-8 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Repères du zoom">
              {ECHELLES.map((e) => (
                <button
                  key={e.cle}
                  type="button"
                  aria-pressed={echelle === e.cle}
                  onClick={() => setCurseur(curseurDe(e.pxParJour))}
                  title={e.precision}
                  className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${echelle === e.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}
                >
                  {e.libelle}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2" title="Zoom du planning — glisser pour passer du mois à l'heure">
              <ZoomOut className="size-3.5 text-attenue" strokeWidth={1.8} />
              <input
                type="range"
                min={0}
                max={100}
                value={curseur}
                onChange={(e) => setCurseur(Number(e.target.value))}
                aria-label="Zoom du planning"
                className="curseur-zoom w-[160px]"
              />
              <ZoomIn className="size-3.5 text-attenue" strokeWidth={1.8} />
            </label>
          </div>
        </header>
        {/* Une seule zone de défilement, dans les deux sens : c'est la condition
            pour que la ligne des mois reste en haut et la colonne des véhicules à
            gauche (un conteneur qui ne défile qu'en largeur ne fige rien). */}
        <div ref={zone} className="defilement-discret min-h-0 flex-1 overflow-auto">
          <div style={{ width: 220 + largeurPiste }}>
            {/* En-tête de la grille, figé */}
            <div className="sticky top-0 z-30 grid border-y border-bordure bg-surface-2" style={{ gridTemplateColumns: `220px ${largeurPiste}px` }}>
              <div className="en-tete-colonne sticky left-0 z-10 h-10 border-r border-bordure bg-surface-2 px-5 leading-10">Véhicule</div>
              <div className="relative grid h-10" style={{ gridTemplateColumns: grille }}>
                {bornes.colonnes.map((c) => (
                  <div
                    key={c.cle}
                    title={c.cle}
                    className={`en-tete-colonne flex flex-col justify-center overflow-hidden border-l border-bordure leading-none ${echelle === "mois" ? "px-2" : "items-center px-0"} ${c.courante ? "text-accent-tres-fonce" : ""} ${c.weekend ? "bg-surface-3/70" : ""}`}
                  >
                    <span className={c.courante ? "font-semibold" : ""}>{c.libelle}</span>
                    {c.sousLibelle ? <span className="mt-0.5 text-[9.5px] font-medium tracking-normal text-attenue normal-case">{c.sousLibelle}</span> : null}
                  </div>
                ))}
              </div>
            </div>

            {affiches.map((v) => {
              const t = titulaireLeJour(v, aujourdhui);
              const tiers = estTiers(v);
              return (
                <div key={v.id} className="group grid border-b border-bordure" style={{ gridTemplateColumns: `220px ${largeurPiste}px` }}>
                  {/* Un camion de transporteur se reconnaît sans lire : filet
                      d'ambre à gauche, pastille « Tiers », et le nom du
                      transporteur sous la plaque. */}
                  <div className={`sticky left-0 z-10 flex min-w-0 items-center gap-2.5 border-r border-bordure bg-surface px-5 py-2 group-hover:bg-surface-2 ${tiers ? "border-l-[3px] border-l-vigilance pl-[17px]" : ""}`}>
                    {tiers ? <span className="shrink-0 rounded-[5px] bg-vigilance-fond px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-vigilance uppercase">Tiers</span> : <PastilleStatut statut={v.statut} compacte />}
                    <span className="min-w-0">
                      {tiers ? (
                        <Link href={`/transporteurs/${v.tiers!.transporteurNumero}?onglet=flotte`} className="code block truncate text-[13px] font-semibold text-accent-fonce hover:underline">
                          {v.immatriculationAffichee}
                        </Link>
                      ) : (
                        <Link href={`/flotte/${v.immatriculation}?onglet=affectations`} className="code block text-[13px] font-semibold text-accent-fonce hover:underline">
                          {v.immatriculationAffichee}
                        </Link>
                      )}
                      <span className="meta block truncate">{tiers ? v.tiers!.transporteur : t ? t.chauffeur : v.engage && STATUT_VEHICULE[v.statut].operationnel ? "sans titulaire" : v.marque}</span>
                    </span>
                  </div>
                  <div className="relative h-12 group-hover:bg-surface-2">
                    {/* grille des mois */}
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: grille }}>
                      {bornes.colonnes.map((c) => (
                        <div key={c.cle} className={`border-l border-bordure ${c.weekend ? "bg-surface-3/50" : ""}`} />
                      ))}
                    </div>
                    {/* barres */}
                    {v.affectations
                      .filter((a) => a.chauffeurId && (a.fin === null || `${a.fin}T23:59:59Z` >= bornes.debut) && `${a.debut}T00:00:00Z` <= bornes.fin)
                      .map((a) => {
                        const b = bornesAffectation(a, bornes);
                        const gauche = position(b.debut, bornes.debut, bornes.fin);
                        const droite = position(b.fin, bornes.debut, bornes.fin);
                        const suppleant = a.role === "suppleant";
                        /* L'attelage habituel d'un camion tiers est constaté,
                           pas décidé : il n'a pas de transaction derrière lui,
                           donc pas de modale à ouvrir. Il se lit en clair, et
                           une vraie affectation peut se programmer par-dessus. */
                        const habituel = a.numero.startsWith("HAB-");
                        if (habituel)
                          return (
                            <span
                              key={a.numero}
                              title={`${a.chauffeur} · chauffeur habituel du transporteur — constaté au référentiel, non programmé`}
                              className="absolute top-1.5 flex h-5 items-center overflow-hidden rounded-[6px] border border-dashed border-vigilance/70 bg-vigilance-fond px-2 text-left text-[11.5px] font-medium whitespace-nowrap text-vigilance"
                              style={{ left: `${gauche}%`, width: `${Math.max(droite - gauche, 1)}%` }}
                            >
                              <span className="truncate">{a.chauffeur}</span>
                            </span>
                          );
                        return (
                          /* Un clic ouvre l'affectation elle-même — dates, motif, historique —
                             plutôt que la fiche du véhicule (demande du métier du 3 septembre). */
                          <button
                            key={a.numero}
                            type="button"
                            onClick={() =>
                              demander({
                                type: "affectation",
                                numero: a.numero,
                                titre: `Affectation ${a.numero} · ${a.chauffeur}${suppleant ? " (suppléant)" : ""}`,
                                valeurs: a as unknown as Record<string, unknown>,
                              })
                            }
                            title={`${a.chauffeur} · ${suppleant ? "suppléant" : "titulaire"} · du ${date(a.debut)}${a.fin ? ` au ${date(a.fin)}` : ", en cours"} · ${a.motif} — cliquer pour ouvrir`}
                            className={`absolute flex h-5 items-center overflow-hidden rounded-[6px] px-2 text-left text-[11.5px] font-medium whitespace-nowrap hover:brightness-95 ${
                              suppleant ? "top-6 bg-accent-fond text-accent-tres-fonce" : "top-1.5 bg-accent text-white"
                            }`}
                            style={{ left: `${gauche}%`, width: `${Math.max(droite - gauche, (1200 / largeurPiste) * 100 / 100)}%` }}
                          >
                            <span className="truncate">{a.chauffeur}</span>
                          </button>
                        );
                      })}
                    {/* aujourd'hui */}
                    <div className="absolute top-0 bottom-0 w-px bg-defavorable/70" style={{ left: `${positionJour}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export function EcranAffectations(props: { vehicules: VehiculePlanning[]; chauffeurs: LigneChauffeur[]; chauffeursTiers: ChauffeurTiersPlanning[]; aujourdhui: string }) {
  return (
    <FournisseurEdition sujet="affectations" href="/affectations">
      <Interieur {...props} />
    </FournisseurEdition>
  );
}

/* Ré-exports utiles aux tests visuels. */
export { Pastille, PastilleStatutChauffeur };
