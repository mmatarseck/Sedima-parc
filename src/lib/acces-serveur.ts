import { normaliserAcces, profilPourRole, type AccesUtilisateur } from "@/domaine/acces";
import type { Role } from "@/domaine/roles";
import { ACCES_DEMO } from "@/donnees/acces-demo";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";

/* ============================================================================
 * Les accès tels que le serveur les lit : la table `acces_utilisateur`,
 * jointe aux profils — un compte qui a un profil mais pas encore de fiche
 * d'accès apparaît quand même, sous le profil que son rôle historique
 * suggère. En démonstration, la liste vient du navigateur ; la page rend les
 * fiches livrées et l'écran lit son stockage.
 * ==========================================================================*/

interface LigneAcces {
  utilisateur_id: string;
  prenom: string;
  nom: string;
  courriel: string;
  telephone: string | null;
  fonction: string | null;
  matricule: string | null;
  actif: boolean;
  profil: string;
  perimetre: unknown;
  modules: unknown;
  sanctions: boolean | null;
  ecarts_approuves_par: string | null;
  chauffeur_id: string | null;
  attributaire_id: string | null;
  cree_le: string;
  modifie_le: string | null;
}

interface LigneProfil {
  utilisateur_id: string;
  nom: string;
  role: Role;
  actif: boolean;
  cree_le: string;
}

export async function accesServeur(): Promise<AccesUtilisateur[]> {
  if (!authentificationReelle()) return ACCES_DEMO;
  const client = await clientServeur();
  const [acces, profils] = await Promise.all([client.from("acces_utilisateur").select("*").returns<LigneAcces[]>(), client.from("profil").select("utilisateur_id, nom, role, actif, cree_le").returns<LigneProfil[]>()]);
  if (acces.error) throw new Error(`Lecture des accès : ${acces.error.message}`);
  if (profils.error) throw new Error(`Lecture des profils : ${profils.error.message}`);
  const fiches = acces.data
    .map((l) =>
      normaliserAcces({
        id: l.utilisateur_id,
        prenom: l.prenom,
        nom: l.nom,
        courriel: l.courriel,
        telephone: l.telephone,
        fonction: l.fonction,
        matricule: l.matricule,
        actif: l.actif,
        profil: l.profil,
        perimetre: l.perimetre,
        modules: l.modules,
        sanctions: l.sanctions,
        ecartsApprouves: l.ecarts_approuves_par !== null,
        approuvePar: l.ecarts_approuves_par,
        chauffeurId: l.chauffeur_id,
        attributaireId: l.attributaire_id,
        creeLe: l.cree_le,
        modifieLe: l.modifie_le,
      }),
    )
    .filter((a): a is AccesUtilisateur => a !== null);
  const connus = new Set(fiches.map((f) => f.id));
  for (const p of profils.data) {
    if (connus.has(p.utilisateur_id)) continue;
    const [prenom, ...reste] = p.nom.split(" ");
    const fiche = normaliserAcces({ id: p.utilisateur_id, prenom: prenom ?? "", nom: reste.join(" "), courriel: "", actif: p.actif, profil: profilPourRole(p.role), ecartsApprouves: true, creeLe: p.cree_le });
    if (fiche) fiches.push(fiche);
  }
  return fiches.sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr"));
}
