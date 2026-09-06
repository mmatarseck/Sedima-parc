import { Coquille } from "@/composants/coquille/Coquille";
import { AmorceParametres } from "@/composants/parametres/AmorceParametres";

/** Toutes les pages de l'application portent le rail de navigation. La page de
 *  garde, elle, vit hors de ce groupe : elle occupe l'écran entier. */
export default function LayoutApplication({ children }: { children: React.ReactNode }) {
  return (
    <Coquille>
      <AmorceParametres />
      {children}
    </Coquille>
  );
}
