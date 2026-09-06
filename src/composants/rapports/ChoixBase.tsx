import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { FAMILLE_RAPPORT, RAPPORTS, famillesServies } from "@/domaine/rapports";

/* ============================================================================
 * Première étape d'un rapport personnalisé : **de quoi parle une ligne ?**
 *
 * On ne choisit pas des colonnes dans un sac : on choisit d'abord ce qu'une
 * ligne compte — un véhicule, un plein, une déclaration —, et les colonnes
 * disponibles s'ensuivent. C'est la question que le métier se pose de toute
 * façon en premier, et elle évite les rapports qui mêlent deux dimensions et
 * que personne ne sait lire.
 * ==========================================================================*/

export function ChoixBase() {
  return (
    <div className="defilement-discret flex flex-col gap-6 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran
        titre="Nouveau rapport"
        sousTitre="De quoi parle une ligne ? Choisissez la base : elle décide de ce que le rapport compte, et des colonnes que vous pourrez retenir."
        actions={
          <Link href="/rapports" className="bouton-secondaire h-8">
            <ArrowLeft className="size-4" strokeWidth={1.8} />
            Retour au catalogue
          </Link>
        }
      />

      {famillesServies().map((famille) => (
        <section key={famille} className="flex flex-col gap-3">
          <div>
            <h2 className="titre-bloc">{FAMILLE_RAPPORT[famille].libelle}</h2>
            <p className="meta mt-0.5">{FAMILLE_RAPPORT[famille].precision}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {RAPPORTS.filter((r) => r.famille === famille).map((r) => (
              <Link
                key={r.id}
                href={`/rapports/nouveau?base=${r.id}`}
                className="flex min-w-0 flex-col rounded-[14px] border border-bordure bg-surface p-4 transition-shadow hover:border-accent hover:shadow-carte"
              >
                <p className="text-[13px] font-semibold text-texte">Une ligne par {r.unite.replace(/s$/, "")}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-texte-2">
                  D&apos;après <span className="font-medium">{r.libelle}</span> — {r.description.toLowerCase()}
                </p>
                <p className="meta mt-3">
                  {r.colonnes.length} colonnes disponibles{r.periode ? " · avec période" : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
