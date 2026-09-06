import Link from "next/link";
import { EcranRapport } from "@/composants/rapports/EcranRapport";
import { titrePage } from "@/domaine/marque";
import { periodeDeLAdresse } from "@/domaine/periodes";
import { RAPPORTS, rapportParId } from "@/domaine/rapports";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { construireRapport } from "@/donnees/rapports-demo";
import { parametresServeur } from "@/lib/parametres-serveur";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const rapport = rapportParId(id);
  return { title: titrePage(rapport ? rapport.libelle : "Rapport introuvable") };
}

export function generateStaticParams() {
  return RAPPORTS.map((r) => ({ id: r.id }));
}

/**
 * Un rapport, construit sur le serveur avec la période lue dans l'adresse : le
 * lien décrit exactement la fenêtre de temps regardée, et se transmet tel quel.
 * Les filtres, le tri et les colonnes travaillent sur ces lignes, dans le
 * navigateur, et sont conservés par profil.
 */
export default async function PageRapport({ params, searchParams }: Props) {
  const [{ id }, requete, parametres] = await Promise.all([params, searchParams, parametresServeur()]);
  const rapport = rapportParId(id);
  if (!rapport) {
    return (
      <div className="grid flex-1 place-items-center px-6 py-20 text-center">
        <div className="max-w-[400px]">
          <h1 className="titre-bloc">Rapport introuvable</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-texte-2">Aucun rapport ne porte l&apos;identifiant « {id} ».</p>
          <Link href="/rapports" className="bouton-secondaire mt-5">
            Voir le catalogue
          </Link>
        </div>
      </div>
    );
  }
  const un = (cle: string): string | null => {
    const v = requete[cle];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim() : null;
  };
  const lignes = construireRapport(rapport.id, { periode: periodeDeLAdresse(un), perimetre: un("perimetre") === "complet" ? "complet" : "exploitation" }, parametres);
  return <EcranRapport rapportId={rapport.id} lignes={lignes} aujourdhui={DATE_REFERENCE} />;
}
