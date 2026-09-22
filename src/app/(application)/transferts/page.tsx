import { redirect } from "next/navigation";

/**
 * La liste générale des fiches de transfert n'est plus une page (métier,
 * 22 septembre 2026 : « pas nécessaire ; on l'a par véhicule, et un rapport
 * peut être créé dans ce sens »). L'ancienne adresse mène au rapport.
 */
export default function PageTransferts() {
  redirect("/rapports/flotte-transferts");
}
