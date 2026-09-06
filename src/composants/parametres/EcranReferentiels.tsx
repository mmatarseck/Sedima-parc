"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Pastille } from "@/composants/interface/Pastille";
import { nombre } from "@/lib/format";

/* ============================================================================
 * Paramètres › Référentiels.
 *
 * Ce que l'application **connaît** : les sites, les catégories, les typologies
 * d'incident, les postes de dépense. Un écran d'inventaire, pas de saisie —
 * et c'est délibéré.
 *
 * Pourquoi rien ne s'y modifie encore : ces valeurs ne sont pas des libellés
 * décoratifs, ce sont les **clés** sur lesquelles reposent les enregistrements.
 * Renommer « Camion » est sans risque ; supprimer la catégorie « camion » alors
 * que douze véhicules la portent laisse douze fiches sans catégorie, et aucune
 * migration ne devine ce qu'il fallait mettre à la place. Tant que la base
 * n'est pas là pour porter la contrainte et la reprise, l'écran montre l'état
 * réel et le nombre d'enregistrements qui en dépendent — c'est ce chiffre-là
 * qui dit si une valeur peut disparaître.
 *
 * Les deux référentiels qui se **modifient déjà** ont leur propre écran, parce
 * qu'ils ont leur propre plomberie : les documents et les programmes
 * d'entretien.
 * ==========================================================================*/

export interface EntreeReferentiel {
  cle: string;
  libelle: string;
  precision: string | null;
  /** Nombre d'enregistrements qui portent cette valeur aujourd'hui. */
  usages: number;
}

export interface BlocReferentiel {
  cle: string;
  titre: string;
  precision: string;
  /** Ce qu'on compte dans la colonne « Usages » : « véhicules », « déclarations ». */
  unite: string;
  entrees: EntreeReferentiel[];
  /** Écran où la valeur se lit en situation. */
  href: string | null;
}

export function EcranReferentiels({ blocs }: { blocs: BlocReferentiel[] }) {
  const [ouvert, setOuvert] = useState<string>(blocs[0]?.cle ?? "");
  const bloc = useMemo(() => blocs.find((b) => b.cle === ouvert) ?? blocs[0] ?? null, [blocs, ouvert]);
  const total = blocs.reduce((s, b) => s + b.entrees.length, 0);

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full lg:min-h-0">
      <nav aria-label="Fil d'Ariane" className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Paramètres
        </Link>
      </nav>

      <TitreEcran titre="Référentiels" sousTitre={`${blocs.length} référentiels · ${total} valeurs · le nombre d'usages dit ce qui peut encore disparaître`} />

      <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row">
        <nav aria-label="Référentiels" className="shrink-0 lg:w-[250px]">
          <ul className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap">
            {blocs.map((b) => (
              <li key={b.cle}>
                <button
                  type="button"
                  onClick={() => setOuvert(b.cle)}
                  aria-current={bloc?.cle === b.cle}
                  className={`flex h-9 w-full items-center gap-2 rounded-[10px] px-3 text-left text-[13px] transition-colors ${
                    bloc?.cle === b.cle ? "bg-accent-fond font-semibold text-accent-fonce" : "font-medium text-texte-2 hover:bg-surface-3 hover:text-texte"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{b.titre}</span>
                  <span className="badge-texte shrink-0 text-attenue">{b.entrees.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {bloc ? (
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Carte titre={bloc.titre} precision={bloc.precision} sansMarge>
              <TableauSimple<EntreeReferentiel>
                reglages={`referentiels.${bloc.cle}`}
                cle={(e) => e.cle}
                lignes={bloc.entrees}
                filtrable={false}
                vide="Ce référentiel est vide."
                colonnes={[
                  { cle: "code", libelle: "Clé", rendu: (e) => <span className="code text-[12px] text-texte-2">{e.cle}</span> },
                  { cle: "libelle", libelle: "Libellé", rendu: (e) => <span className="font-medium text-texte">{e.libelle}</span> },
                  { cle: "precision", libelle: "Ce que la valeur dit", rendu: (e) => <span className="block truncate text-texte-2">{e.precision ?? "—"}</span> },
                  {
                    cle: "usages",
                    libelle: `Usages (${bloc.unite})`,
                    alignee: "droite",
                    rendu: (e) =>
                      e.usages > 0 ? (
                        <span className="code">{nombre(e.usages)}</span>
                      ) : (
                        <span title="Aucun enregistrement ne porte cette valeur : elle pourrait disparaître sans rien casser">
                          <Pastille ton="neutre">inutilisée</Pastille>
                        </span>
                      ),
                  },
                ]}
              />
            </Carte>
            {bloc.href ? (
              <p className="meta shrink-0">
                Ces valeurs se lisent en situation sur{" "}
                <Link href={bloc.href} className="font-medium text-accent-fonce hover:text-accent">
                  l&apos;écran correspondant
                </Link>
                .
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="meta shrink-0 rounded-[10px] border-l-[3px] border-l-vigilance bg-surface px-4 py-3 leading-relaxed">
        <strong className="font-semibold text-texte">Pourquoi rien ne se modifie ici.</strong> Ces valeurs sont les clés des enregistrements, pas des libellés décoratifs : supprimer une catégorie que
        douze véhicules portent laisse douze fiches sans catégorie, et aucune migration ne devine ce qu&apos;il fallait mettre à la place. La colonne « usages » dit ce qui pourrait disparaître sans
        rien casser. Les deux référentiels qui se modifient déjà ont leur propre écran, parce qu&apos;ils ont leur propre reprise :{" "}
        <Link href="/parametres/documents" className="font-medium text-accent-fonce hover:text-accent">
          les documents
        </Link>{" "}
        et{" "}
        <Link href="/parametres/entretien" className="font-medium text-accent-fonce hover:text-accent">
          les programmes d&apos;entretien
        </Link>
        .
      </p>
    </div>
  );
}
