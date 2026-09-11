"use client";

/* ============================================================================
 * Le tableau de bord, gardé dans le navigateur.
 *
 * Demande du métier (11 septembre 2026) : « le tableau de bord est toujours
 * lent à charger. Rafraîchir les données qu'à la connexion ou sur appui d'un
 * bouton, visible si les données ne sont pas à jour ».
 *
 * L'écran s'ouvre donc sur le dernier calcul gardé, sans attendre. Une requête
 * légère dit s'il est dépassé ; une ligne sous le titre le dit à son tour :
 *
 *   * à jour — « Données du jeu. 11 sept. à 08:42 · Actualiser », discrète ;
 *   * nouvelles saisies — un bandeau, « De nouvelles saisies depuis… », avec le
 *     bouton Actualiser ;
 *   * autre jour — le même bandeau, parce que les pastilles disent l'état d'un
 *     jour passé.
 *
 * Rien de gardé, un autre compte, ou une connexion depuis le calcul : on
 * recalcule sans demander. La vérification se refait quand l'onglet redevient
 * visible.
 * ==========================================================================*/

import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { RefreshCw } from "lucide-react";
import { EcranTableauBord } from "./EcranTableauBord";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { etatFraicheur, type CalculGarde, type EtatFraicheur, type Fraicheur } from "@/domaine/fraicheur";
import { ecrireInstantane, lireConnexion, lireInstantane } from "@/lib/instantanes";

type Donnees = Omit<ComponentProps<typeof EcranTableauBord>, "bandeau">;
interface Garde extends CalculGarde {
  donnees: Donnees;
}

const CLE = "tableau-bord";
const HORODATAGE = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function lireFraicheur(): Promise<Fraicheur | null> {
  try {
    const reponse = await fetch("/api/tableau-bord/fraicheur", { cache: "no-store" });
    return reponse.ok ? ((await reponse.json()) as Fraicheur) : null;
  } catch {
    return null;
  }
}

export function TableauBordEnCache() {
  const [garde, setGarde] = useState<Garde | null>(null);
  const [etat, setEtat] = useState<EtatFraicheur | null>(null);
  const [calcul, setCalcul] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const courant = useRef<Garde | null>(null);

  const calculer = useCallback(async () => {
    setCalcul(true);
    setErreur(null);
    try {
      const reponse = await fetch("/api/tableau-bord", { cache: "no-store" });
      if (!reponse.ok) throw new Error(`réponse ${reponse.status}`);
      const nouveau = (await reponse.json()) as Garde;
      courant.current = nouveau;
      setGarde(nouveau);
      setEtat({ etat: "a-jour" });
      await ecrireInstantane(CLE, nouveau);
    } catch (e) {
      setErreur(`Le calcul du tableau de bord a échoué (${e instanceof Error ? e.message : String(e)}). Réessayez.`);
    } finally {
      setCalcul(false);
    }
  }, []);

  const verifier = useCallback(
    async (candidat: Garde | null) => {
      const fraicheur = await lireFraicheur();
      /* Sans réponse — hors ligne —, le calcul gardé vaut mieux que rien. */
      const e: EtatFraicheur = fraicheur ? etatFraicheur(candidat, fraicheur, lireConnexion()) : candidat ? { etat: "a-jour" } : { etat: "a-calculer", motif: "absent" };
      if (e.etat === "a-calculer") {
        if (e.motif === "autre-compte") {
          courant.current = null;
          setGarde(null);
        }
        await calculer();
        return;
      }
      courant.current = candidat;
      setGarde(candidat);
      setEtat(e);
    },
    [calculer],
  );

  useEffect(() => {
    let actif = true;
    void (async () => {
      const lu = await lireInstantane<Garde>(CLE);
      if (actif) await verifier(lu);
    })();
    const auRetour = () => {
      if (document.visibilityState === "visible" && courant.current) void verifier(courant.current);
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      actif = false;
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [verifier]);

  if (!garde) {
    return (
      <div className="flex flex-col gap-2.5 px-8 pt-3.5 pb-3">
        <TitreEcran titre="Tableau de bord" />
        {erreur ? (
          <p className="text-[13px] text-defavorable">
            {erreur}{" "}
            <button type="button" onClick={() => void calculer()} className="font-semibold text-accent-fonce underline">
              Réessayer
            </button>
          </p>
        ) : (
          <p className="meta inline-flex items-center gap-2">
            <RefreshCw className="size-3.5 animate-spin" strokeWidth={2} />
            Calcul du tableau de bord…
          </p>
        )}
      </div>
    );
  }

  const quand = HORODATAGE.format(new Date(garde.calculeLe));
  const bouton = (
    <button type="button" onClick={() => void calculer()} disabled={calcul} className="inline-flex items-center gap-1 font-semibold text-accent-fonce hover:underline disabled:opacity-60">
      <RefreshCw className={`size-3.5 ${calcul ? "animate-spin" : ""}`} strokeWidth={2} />
      {calcul ? "Calcul en cours…" : "Actualiser"}
    </button>
  );
  const depasse = etat?.etat === "nouvelles-saisies" || etat?.etat === "autre-jour";
  const bandeau = depasse ? (
    <div role="status" className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-[8px] border border-accent bg-accent-fond px-3 py-2 text-[12.5px] text-accent-tres-fonce">
      <span>
        {etat?.etat === "autre-jour"
          ? `Données du ${quand} : les pastilles disent l'état de ce jour-là.`
          : `De nouvelles saisies depuis le ${quand} : les chiffres ne les comptent pas encore.`}
      </span>
      {bouton}
    </div>
  ) : (
    <p className="meta flex shrink-0 items-center gap-2 text-[12px]">
      <span>Données du {quand}</span>
      <span aria-hidden>·</span>
      {bouton}
      {erreur ? <span className="text-defavorable">{erreur}</span> : null}
    </p>
  );
  return <EcranTableauBord {...garde.donnees} bandeau={bandeau} />;
}
