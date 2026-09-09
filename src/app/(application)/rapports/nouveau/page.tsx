import { ChoixBase } from "@/composants/rapports/ChoixBase";
import { EcranConstructeur } from "@/composants/rapports/EcranConstructeur";
import { construireRapportDe } from "@/domaine/assembler-rapports";
import { titrePage } from "@/domaine/marque";
import { periodeDeLAdresse } from "@/domaine/periodes";
import { rapportParId } from "@/domaine/rapports";
import { sourceRapportsServeur } from "@/donnees/rapports";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Nouveau rapport") };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Construction d'un rapport personnalisé, en deux temps : choisir la base —
 * ce qu'une ligne compte —, puis composer les colonnes, les filtres et la
 * période avec un aperçu vivant. Les lignes de l'aperçu sont construites ici,
 * par le serveur, exactement comme celles du rapport final : ce que l'on voit
 * en composant est ce que l'on obtiendra.
 */
export default async function PageNouveauRapport({ searchParams }: Props) {
  const [requete, parametres] = await Promise.all([searchParams, parametresServeur()]);
  const un = (cle: string): string | null => {
    const v = requete[cle];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim() : null;
  };

  const base = rapportParId(un("base") ?? "");
  if (!base) return <ChoixBase />;

  const periode = periodeDeLAdresse(un);
  const perimetre = un("perimetre") === "complet" ? "complet" : "exploitation";
  const source = await sourceRapportsServeur(parametres);
  const lignes = construireRapportDe(source, base.id, { periode, perimetre }, parametres);
  return <EcranConstructeur baseId={base.id} lignes={lignes} aujourdhui={source.aujourdhui} persoId={un("perso") ?? undefined} periodeCourante={periode} perimetreCourant={perimetre} />;
}
