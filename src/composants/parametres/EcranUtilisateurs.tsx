"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, Plus, ShieldCheck } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { MODULES, NIVEAU, PROFILS, ecartsDe, nomComplet, resumerPerimetre, trouverProfil, type AccesUtilisateur, type DefinitionProfil } from "@/domaine/acces";
import { ROLES, trouverRole, type DefinitionRole, type Role } from "@/domaine/roles";
import { lireAcces } from "@/lib/acces-demo";
import { authentificationReelle, lireRole, ouvrirSession } from "@/lib/session-demo";

/* ============================================================================
 * Paramètres › Utilisateurs.
 *
 * Les personnes et leur fiche d'accès — profil, périmètre, écarts approuvés
 * ou en attente — ; les six profils et ce que chacun fait de chaque module ;
 * et, tant que la démonstration dure, le sélecteur de rôle.
 *
 * Le rôle n'est jamais décidé par le navigateur : la fiche s'enregistre par
 * une fonction serveur réservée à l'administrateur, et `get_me()` rend le
 * rôle que le profil porte.
 * ==========================================================================*/

export function EcranUtilisateurs({ initial }: { initial: AccesUtilisateur[] }) {
  const router = useRouter();
  const [liste, setListe] = useState<AccesUtilisateur[]>(initial);
  const [role, setRole] = useState<DefinitionRole>(() => trouverRole(null));
  const [reel, setReel] = useState(false);

  useEffect(() => {
    const r = authentificationReelle();
    setReel(r);
    setRole(trouverRole(lireRole()));
    if (!r) setListe(lireAcces());
  }, [initial]);

  const admin = role.role === "administrateur";
  const enAttente = liste.filter((a) => !a.ecartsApprouves && (ecartsDe(a).length > 0 || a.sanctions !== null)).length;

  function prendre(r: Role) {
    ouvrirSession(r);
    setRole(trouverRole(r));
    router.refresh();
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
        titre="Utilisateurs"
        sousTitre={`${liste.length} personnes · ${PROFILS.length} profils${enAttente ? ` · ${enAttente} fiche${enAttente > 1 ? "s" : ""} avec des écarts à approuver` : ""} · vous êtes ${role.libelle}`}
        actions={
          admin ? (
            <Link href="/parametres/utilisateurs/nouveau" className="bouton-principal">
              <Plus className="size-4" strokeWidth={2.2} />
              Nouvel utilisateur
            </Link>
          ) : null
        }
      />

      <Carte titre="Les personnes" precision="Profil, périmètre, et ce qui s'écarte du profil. La fiche s'ouvre d'un clic." sansMarge>
        <TableauSimple<AccesUtilisateur>
          reglages="parametres.utilisateurs"
          cle={(a) => a.id}
          lignes={liste}
          vide="Aucune personne."
          colonnes={[
            {
              cle: "nom",
              libelle: "Personne",
              rendu: (a) => (
                <Link href={`/parametres/utilisateurs/${a.id}`} className="flex flex-col hover:text-accent-fonce">
                  <span className="font-medium text-texte">{nomComplet(a) || a.courriel}</span>
                  <span className="meta">{a.fonction ?? a.courriel}</span>
                </Link>
              ),
            },
            { cle: "courriel", libelle: "Courriel", parDefaut: false, rendu: (a) => <span className="code text-[12px] text-texte-2">{a.courriel || "—"}</span> },
            { cle: "profil", libelle: "Profil", rendu: (a) => <span className="font-medium text-texte">{trouverProfil(a.profil).libelle}</span> },
            { cle: "perimetre", libelle: "Périmètre", rendu: (a) => <span className="block truncate text-texte-2">{a.profil === "detenteur" ? "Son véhicule" : resumerPerimetre(a.perimetre)}</span> },
            {
              cle: "ecarts",
              libelle: "Écarts au profil",
              rendu: (a) => {
                const n = ecartsDe(a).length + (a.sanctions !== null ? 1 : 0);
                if (n === 0) return <span className="text-attenue-2">—</span>;
                return <Pastille ton={a.ecartsApprouves ? "favorable" : "vigilance"}>{a.ecartsApprouves ? `${n} approuvé${n > 1 ? "s" : ""}` : `${n} à approuver`}</Pastille>;
              },
            },
            { cle: "acces", libelle: "Accès", rendu: (a) => (a.actif ? <Echeance ton="favorable">activé</Echeance> : <Echeance ton="neutre">contact</Echeance>) },
          ]}
        />
      </Carte>

      <Carte titre="Les six profils" precision="Ce que chaque profil fait de chaque module, par défaut. Une fiche peut s'en écarter, avec l'approbation de l'administrateur." sansMarge>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-5 text-left">Module</th>
                {PROFILS.map((p) => (
                  <th key={p.profil} className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-3 text-center" title={p.precision}>
                    {p.libelle}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.module} className="hover:bg-surface-2">
                  <td className="border-b border-bordure px-5 py-2 text-[13px] font-medium text-texte">{m.libelle}</td>
                  {PROFILS.map((p) => (
                    <td key={p.profil} className="border-b border-bordure px-3 py-2 text-center">
                      <Niveau p={p} niveau={p.defauts[m.module]} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="px-5 py-2 text-[13px] font-medium text-texte">Sanctions des chauffeurs</td>
                {PROFILS.map((p) => (
                  <td key={p.profil} className="px-3 py-2 text-center">
                    {p.sanctions ? <Echeance ton="favorable">voit</Echeance> : <span className="text-attenue-2">—</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Carte>

      <Carte titre="Prendre un autre rôle" precision="Pour la démonstration seulement : cela change ce que l'application vous montre et vous autorise, sans rien changer aux données.">
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button key={r.role} type="button" aria-pressed={r.role === role.role} onClick={() => prendre(r.role)} title={r.perimetre} className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors ${r.role === role.role ? "border-accent bg-accent font-medium text-white" : "border-bordure-champ bg-surface text-texte-2 hover:border-accent"}`}>
              {r.role === role.role ? <Check className="size-3.5" strokeWidth={2.4} /> : null}
              {r.libelle}
            </button>
          ))}
        </div>
        <p className="meta mt-3 flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.9} />
          <span>
            {reel
              ? "Une authentification réelle est branchée : ce sélecteur ne remplace pas le rôle du compte connecté, il n'agit que sur l'affichage de démonstration."
              : "Aucune authentification n'est branchée : le rôle est celui que vous choisissez ici. En production, il vient du profil de la personne, résolu par le serveur."}
          </span>
        </p>
      </Carte>
    </div>
  );
}

function Niveau({ p, niveau }: { p: DefinitionProfil; niveau: DefinitionProfil["defauts"][keyof DefinitionProfil["defauts"]] }) {
  if (niveau === "aucun") return <span className="text-attenue-2">—</span>;
  const ton = niveau === "gestion" ? "favorable" : niveau === "saisie" ? "vigilance" : "neutre";
  return (
    <span title={`${p.libelle} · ${NIVEAU[niveau].precision}`}>
      <Echeance ton={ton}>{NIVEAU[niveau].libelle}</Echeance>
    </span>
  );
}
