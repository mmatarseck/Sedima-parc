import type { CibleTransfert, PersonnesTransfert } from "@/composants/transferts/FicheTransfert";
import type { Parametres } from "@/domaine/parametres";
import type { TypeDocument } from "@/domaine/types";
import { listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { lignesFlotte } from "@/donnees/flotte";
import { parcLegerServeur } from "@/donnees/parc-leger";

/**
 * Ce qu'une fiche de transfert propose : les véhicules du périmètre avec
 * leur détenteur du moment et leur compteur, les chauffeurs et attributaires
 * qui peuvent recevoir — encore ceux de la démonstration, comme le parc
 * léger —, et les documents qu'un véhicule porte à bord.
 */
export async function optionsTransfert(parametres: Parametres): Promise<{ cibles: CibleTransfert[]; personnes: PersonnesTransfert; documents: { id: TypeDocument; libelle: string }[] }> {
  const [lignes, parcLeger] = await Promise.all([lignesFlotte(parametres), parcLegerServeur(parametres)]);
  const attributaires = () => parcLeger.attributaires;
  const parNom = new Map(attributaires().map((a) => [a.nom, a.id]));
  const cibles: CibleTransfert[] = lignes
    .filter((l) => l.vehicule.statut !== "a-recevoir")
    .map((l) => {
      const v = l.vehicule;
      const detenteur = l.chauffeurTitulaire ? { genre: "chauffeur" as const, id: l.chauffeurTitulaire.id, nom: l.chauffeurTitulaire.nom } : l.attributaire && !l.attributaire.pool ? { genre: "attributaire" as const, id: parNom.get(l.attributaire.nom) ?? l.attributaire.nom, nom: l.attributaire.nom } : null;
      return { vehiculeId: v.id, immatriculation: v.immatriculationAffichee, libelle: `${v.marque} ${v.appellation}`, siteId: v.siteId, siteLibelle: l.site?.libelle ?? null, km: l.kilometrage, detenteur };
    });
  return {
    cibles,
    personnes: {
      chauffeurs: listeChauffeurs().map((c) => ({ id: c.id, nom: c.nomComplet, site: c.site?.libelle ?? null })),
      attributaires: attributaires().map((a) => ({ id: a.id, nom: a.nom })),
    },
    documents: parametres.documents.types.filter((t) => t.porteur === "vehicule").map((t) => ({ id: t.id, libelle: t.libelle })),
  };
}
