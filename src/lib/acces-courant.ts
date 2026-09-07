import { MODULES, NIVEAUX, PROFILS, accesDepuisRole, type AccesCourant, type Module, type Niveau } from "@/domaine/acces";
import { trouverRole } from "@/domaine/roles";
import { lireRole } from "@/lib/session-demo";

/* ============================================================================
 * L'accès de la personne connectée, côté navigateur.
 *
 * Base branchée : `get_me()` rend profil, périmètre, niveaux et sanctions ;
 * `AmorceSession` les pose ici. En démonstration, le rôle choisi donne les
 * défauts de son profil. Ce n'est jamais une autorisation — les politiques
 * décident — ; c'est ce qui permet aux écrans de ne pas promettre ce que le
 * serveur refusera.
 * ==========================================================================*/

const CLE = "sedima.parc.acces-courant";

export function ecrireAccesCourant(acces: AccesCourant | null): void {
  try {
    if (acces) localStorage.setItem(CLE, JSON.stringify(acces));
    else localStorage.removeItem(CLE);
  } catch {
    /* sans stockage, la valeur ne vaut que pour la page courante */
  }
}

export function lireAccesCourant(): AccesCourant {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) {
      const lu = JSON.parse(brut) as Partial<AccesCourant>;
      if (lu && typeof lu === "object" && lu.niveaux && PROFILS.some((p) => p.profil === lu.profil)) {
        const niveaux = Object.fromEntries(MODULES.map((m) => [m.module, NIVEAUX.includes(lu.niveaux![m.module]) ? lu.niveaux![m.module] : "aucun"])) as Record<Module, Niveau>;
        return { profil: lu.profil!, perimetre: lu.perimetre ?? { sites: "tous", businessUnits: "toutes", regimes: "tous" }, niveaux, sanctions: Boolean(lu.sanctions) };
      }
    }
  } catch {
    /* stockage illisible : on retombe sur le rôle */
  }
  return accesDepuisRole(trouverRole(lireRole()).role);
}

export function niveauCourant(module: Module): Niveau {
  return lireAccesCourant().niveaux[module];
}

export function peutCourant(module: Module, minimum: Niveau): boolean {
  const rang = (n: Niveau) => NIVEAUX.indexOf(n);
  return rang(niveauCourant(module)) >= rang(minimum);
}

export function voitSanctionsCourant(): boolean {
  return lireAccesCourant().sanctions;
}
