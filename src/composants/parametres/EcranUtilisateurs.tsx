"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, ShieldCheck } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { ALERTES } from "@/domaine/alertes";
import { peutCloturer } from "@/domaine/cloture";
import { ROLES, trouverRole, voitSanctions, type DefinitionRole, type Role } from "@/domaine/roles";
import { authentificationReelle, lireRole, ouvrirSession } from "@/lib/session-demo";

/* ============================================================================
 * Paramètres › Utilisateurs et rôles.
 *
 * Ce que l'écran montre : les huit rôles de l'application, leur périmètre, ce
 * que chacun a le droit de faire, et le compte de démonstration qui permet de
 * s'y mettre.
 *
 * Ce qu'il ne fait pas — et ne fera pas ici : créer un compte, attribuer un
 * rôle à quelqu'un. **Le rôle n'est jamais décidé par le navigateur.** En
 * production il est résolu côté serveur par une fonction `get_me()` en
 * SECURITY DEFINER, comme dans SEDIMA Opérations : une page qui prétendrait
 * l'attribuer donnerait l'illusion d'une autorisation que rien ne garantirait.
 * La création des comptes se fera dans Supabase, et l'écran affichera alors la
 * liste réelle des utilisateurs et leur rôle.
 *
 * Ce qu'il fait, en revanche, et qui est utile tout de suite : **changer de
 * rôle pour la démonstration**. C'est ainsi qu'on vérifie qu'un correspondant
 * de site ne voit pas les sanctions, et qu'un gestionnaire de parc ne clôture
 * pas un mois.
 * ==========================================================================*/

/** Ce que chaque rôle peut faire, en clair — la lecture qui manque au périmètre. */
const DROITS: { cle: string; libelle: string; precision: string; role: (r: Role) => boolean }[] = [
  { cle: "cloture", libelle: "Clôturer un mois", precision: "Fermer un mois, décider des modifications demandées sur un mois clos", role: peutCloturer },
  {
    cle: "parametres",
    libelle: "Régler l'application",
    precision: "Prix de l'énergie, règles des documents, programmes d'entretien, règles d'alerte",
    role: peutCloturer,
  },
  {
    cle: "sanctions",
    libelle: "Voir les sanctions",
    precision: "Les sanctions d'un chauffeur et les indicateurs confidentiels de son barème",
    /* La règle vit dans le domaine — la recopier ici la ferait diverger le
       jour où elle changera. */
    role: voitSanctions,
  },
  {
    cle: "couts",
    libelle: "Lire et exporter tous les coûts",
    precision: "Les rapports de coût sur tout le parc, sans restriction de site",
    role: (r) => r !== "correspondant-site",
  },
];

export function EcranUtilisateurs() {
  const router = useRouter();
  const [role, setRole] = useState<DefinitionRole>(() => trouverRole(null));
  const [reel, setReel] = useState(false);

  useEffect(() => {
    setRole(trouverRole(lireRole()));
    setReel(authentificationReelle());
  }, []);

  function prendre(r: Role) {
    ouvrirSession(r);
    setRole(trouverRole(r));
    /* Toute l'application lit le rôle : on rafraîchit plutôt que de propager
       un état, sans quoi la moitié des écrans garderait l'ancien périmètre. */
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

      <TitreEcran titre="Utilisateurs et rôles" sousTitre={`${ROLES.length} rôles · vous êtes connecté comme ${role.libelle}`} />

      <Carte
        titre="Les rôles"
        precision="Le périmètre de chacun, et ce qu'il a le droit de faire. Un rôle n'est jamais déduit par le navigateur : en production, il est résolu côté serveur."
        sansMarge
      >
        <TableauSimple<DefinitionRole>
          reglages="parametres.roles"
          cle={(r) => r.role}
          lignes={ROLES}
          filtrable={false}
          ajustable
          vide="Aucun rôle."
          colonnes={[
            {
              cle: "libelle",
              libelle: "Rôle",
              rendu: (r) => (
                <span className="flex items-center gap-2">
                  <span className="font-medium text-texte">{r.libelle}</span>
                  {r.role === role.role ? <Pastille ton="favorable">vous</Pastille> : null}
                </span>
              ),
            },
            { cle: "perimetre", libelle: "Périmètre", rendu: (r) => <span className="block truncate text-texte-2">{r.perimetre}</span> },
            ...DROITS.map((d) => ({
              cle: d.cle,
              libelle: d.libelle,
              rendu: (r: DefinitionRole) =>
                d.role(r.role) ? (
                  <span title={d.precision}>
                    <Echeance ton="favorable">Oui</Echeance>
                  </span>
                ) : (
                  <span className="text-attenue-2" title={d.precision}>
                    —
                  </span>
                ),
            })),
            {
              cle: "alertes",
              libelle: "Alertes proposées",
              alignee: "droite" as const,
              rendu: (r: DefinitionRole) => <span className="code">{ALERTES.filter((a) => !a.roles || a.roles.includes(r.role)).length}</span>,
            },
            { cle: "compte", libelle: "Compte de démonstration", parDefaut: false, rendu: (r: DefinitionRole) => <span className="code text-[12px] text-texte-2">{r.compteTest}</span> },
          ]}
        />
      </Carte>

      <Carte
        titre="Prendre un autre rôle"
        precision="Pour la démonstration seulement : cela change ce que l'application vous montre et vous autorise, sans rien changer aux données."
      >
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r.role}
              type="button"
              aria-pressed={r.role === role.role}
              onClick={() => prendre(r.role)}
              title={r.perimetre}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors ${
                r.role === role.role ? "border-accent bg-accent font-medium text-white" : "border-bordure-champ bg-surface text-texte-2 hover:border-accent"
              }`}
            >
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
              : "Aucune authentification n'est branchée : le rôle est celui que vous choisissez ici. En production, il viendra de Supabase et ce sélecteur disparaîtra."}
          </span>
        </p>
      </Carte>

      <Carte titre="Ce qui viendra avec la base" precision="Ce que cet écran fera quand les comptes existeront ailleurs que dans le code">
        <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-texte-2">
          <li>
            <strong className="font-semibold text-texte">La liste des utilisateurs</strong> — nom, courriel, rôle, site de rattachement, dernière connexion. Elle viendra de la table{" "}
            <span className="code">auth.users</span> jointe au profil applicatif.
          </li>
          <li>
            <strong className="font-semibold text-texte">L&apos;attribution d&apos;un rôle</strong> — par un administrateur, tracée comme toute modification. Elle s&apos;écrira côté serveur : le
            navigateur ne décide jamais d&apos;une autorisation.
          </li>
          <li>
            <strong className="font-semibold text-texte">Le périmètre par site</strong> — un correspondant de site ne voit que son site. La règle est déjà écrite dans les rôles ; il lui manque la
            colonne qui dit <em>quel</em> site.
          </li>
          <li>
            <strong className="font-semibold text-texte">L&apos;invitation et la désactivation</strong> — un compte qui part garde ses traces, comme un prestataire inactif garde ses factures.
          </li>
        </ul>
      </Carte>
    </div>
  );
}
