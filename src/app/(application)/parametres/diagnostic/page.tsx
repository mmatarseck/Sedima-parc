import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { assemblerFiche, FAITS_VIDES } from "@/domaine/assembler-fiche";
import { titrePage } from "@/domaine/marque";
import { normaliser } from "@/domaine/immatriculation";
import { lignesChauffeurs } from "@/donnees/chauffeurs";
import { demandesServeur } from "@/donnees/demandes";
import { passagesReleves, planDuVehicule, programmeParDefaut } from "@/donnees/entretien-demo";
import { faitsDepuisJson, type FicheJson } from "@/donnees/fiche";
import { lignesFlotte, parcServeur } from "@/donnees/flotte";
import { ordresServeur } from "@/donnees/ordres";
import { situationsServeur } from "@/donnees/situations";
import { transfertsServeur } from "@/donnees/transferts";
import { parametresServeur } from "@/lib/parametres-serveur";
import { authentificationReelle } from "@/lib/session-demo";
import { sessionCourante } from "@/lib/session-serveur";
import { clientServeur, utilisateurCourant } from "@/lib/supabase";

export const metadata = { title: titrePage("Diagnostic — paramètres") };
export const dynamic = "force-dynamic";

interface Etape {
  nom: string;
  ms: number;
  resultat: string | null;
  erreur: string | null;
}

/**
 * Paramètres › Diagnostic — pour l'administrateur et la direction, quand une
 * page est lente ou casse en production : chaque lecture de la base est
 * chronométrée ici, dans l'ordre où les pages les font, et une lecture qui
 * lève montre son message et sa pile. C'est ce que le journal de l'hébergeur
 * dirait, sans avoir à l'ouvrir. `?immat=AA032EA` vise un véhicule.
 */
export default async function PageDiagnostic({ searchParams }: { searchParams: Promise<{ immat?: string }> }) {
  const { immat } = await searchParams;
  const session = await sessionCourante();
  const debutTotal = performance.now();

  if (!authentificationReelle() || session.etat !== "connecte") {
    return (
      <Cadre>
        <Carte titre="Rien à mesurer">
          <p className="px-5 pb-4 text-[13px] text-texte-2">En démonstration, l&apos;application ne lit aucune base : le diagnostic ne dit quelque chose qu&apos;en production, avec un compte.</p>
        </Carte>
      </Cadre>
    );
  }
  if (session.session.role !== "administrateur" && session.session.role !== "direction") {
    return (
      <Cadre>
        <Carte titre="Réservé">
          <p className="px-5 pb-4 text-[13px] text-texte-2">Le diagnostic est réservé à l&apos;administrateur et à la direction.</p>
        </Carte>
      </Cadre>
    );
  }

  const etapes: Etape[] = [];
  async function mesurer<T>(nom: string, f: () => Promise<T>, decrire: (r: T) => string): Promise<T | null> {
    const t0 = performance.now();
    try {
      const r = await f();
      etapes.push({ nom, ms: Math.round(performance.now() - t0), resultat: decrire(r), erreur: null });
      return r;
    } catch (e) {
      const err = e instanceof Error ? `${e.name} : ${e.message}\n${(e.stack ?? "").split("\n").slice(1, 8).join("\n")}` : String(e);
      etapes.push({ nom, ms: Math.round(performance.now() - t0), resultat: null, erreur: err });
      return null;
    }
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const client = await clientServeur();
  await mesurer("Session — get_me()", () => utilisateurCourant(client), (m) => (m ? `rôle ${m.role}, périmètre ${m.acces ? "par fiche d'accès" : "par rôle"}` : "aucun profil"));
  const parametres = await mesurer("Paramètres — parametre + type_document", () => parametresServeur(), (p) => `${p.documents.types.length} types de document, ${p.energie.baremes.length} barèmes`);
  await mesurer("Parc — lire_parc() (douze mois)", () => parcServeur(), (p) => `${p.vehicules.length} véhicules, ${p.releves.length} relevés, ${p.pleins.length} pleins, ${p.depenses.length} dépenses, ${p.interventions.length} interventions, ${p.documents.length} documents`);
  const lignes = parametres ? await mesurer("Lignes de la liste Flotte (calcul)", () => lignesFlotte(parametres), (l) => `${l.length} lignes`) : null;
  await mesurer("Situations journalières — situation_journaliere() (28 jours)", () => situationsServeur(aujourdhui), (s) => `${s.length} jours ; dernier : ${JSON.stringify(s.at(-1)?.flotte ?? null)}`);

  /* La fiche d'un véhicule, étape par étape, sans le filet de ficheServeur() : l'erreur, s'il y en a une, se voit. */
  const canonique = immat ? normaliser(decodeURIComponent(immat)) : (lignes?.find((l) => l.vehicule.regime === "exploitation")?.vehicule.immatriculation ?? null);
  if (canonique && lignes && parametres) {
    const ligne = lignes.find((l) => l.vehicule.immatriculation === canonique) ?? null;
    etapes.push({ nom: `Ligne du véhicule ${canonique}`, ms: 0, resultat: ligne ? `${ligne.vehicule.marque} ${ligne.vehicule.appellation}, régime ${ligne.vehicule.regime}, statut ${ligne.statutEffectif ?? ligne.vehicule.statut}` : null, erreur: ligne ? null : "véhicule absent des lignes de la liste (hors périmètre, ou immatriculation inconnue)" });
    const brut = await mesurer(`Fiche — lire_fiche('${canonique}')`, async () => {
      const lecture = await client.rpc("lire_fiche", { immat: canonique }).maybeSingle<FicheJson | null>();
      if (lecture.error) throw new Error(`${lecture.error.code ?? ""} ${lecture.error.message} ${lecture.error.details ?? ""} ${lecture.error.hint ?? ""}`.trim());
      return lecture.data;
    }, (j) => (j ? `${j.documents.length} documents, ${j.affectations.length} affectations, ${j.releves.length} relevés, ${j.pleins.length} pleins, ${j.depenses.length} dépenses, ${j.interventions.length} interventions, ${j.statuts.length} statuts` : "null (véhicule introuvable pour la fonction)"));
    if (ligne) {
      const v = ligne.vehicule;
      const plan = { programme: programmeParDefaut(v.categorie), plan: planDuVehicule(v.id, v.categorie), passages: passagesReleves };
      await mesurer("Fiche — conversion des faits", async () => (brut ? faitsDepuisJson(brut) : FAITS_VIDES), (f) => `${f.documents.length} documents, ${f.licences.length} licences`);
      await mesurer("Fiche — assemblage (assemblerFiche)", async () => assemblerFiche(ligne, brut ? faitsDepuisJson(brut) : FAITS_VIDES, parametres, aujourdhui, plan), (f) => `${f.documents.length} documents, ${f.interventions.length} interventions, ${f.carburant.length} mois de carburant, ${f.planEntretien.echeances.length} échéances, journal ${f.journal.length}`);
      await mesurer("Fiche — sérialisation (JSON)", async () => JSON.stringify(assemblerFiche(ligne, brut ? faitsDepuisJson(brut) : FAITS_VIDES, parametres, aujourdhui, plan)).length, (n) => `${Math.round(n / 1024)} Ko`);
    }
  }

  await mesurer("Chauffeurs — lire_chauffeurs()", () => lignesChauffeurs(), (l) => `${l.length} chauffeurs`);
  await mesurer("Ordres de travail", () => ordresServeur(), (l) => `${l.length} ordres`);
  await mesurer("Demandes", () => demandesServeur(), (l) => `${l.length} demandes`);
  await mesurer("Transferts", () => transfertsServeur(), (l) => `${l.length} transferts`);
  const total = Math.round(performance.now() - debutTotal);

  const hote = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
    } catch {
      return "—";
    }
  })();

  return (
    <Cadre>
      <TitreEcran titre="Diagnostic" sousTitre={`Chaque lecture chronométrée, dans l'ordre des pages — ${total} ms en tout, ${etapes.filter((e) => e.erreur).length} erreur${etapes.filter((e) => e.erreur).length > 1 ? "s" : ""}`} />
      <Carte titre="Où l'on tourne" precision="Ce que le serveur sait de lui-même">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 px-5 pb-4 text-[12.5px]">
          <dt className="text-attenue">Base</dt>
          <dd className="code text-texte">{hote}</dd>
          <dt className="text-attenue">Région de l&apos;hébergeur</dt>
          <dd className="code text-texte">{process.env.VERCEL_REGION ?? "hors Vercel"}</dd>
          <dt className="text-attenue">Node</dt>
          <dd className="code text-texte">{process.version}</dd>
          <dt className="text-attenue">Jour</dt>
          <dd className="code text-texte">{aujourdhui}</dd>
        </dl>
      </Carte>
      <Carte titre="Les lectures" precision="Durée, résultat ou erreur ; un véhicule se vise par ?immat=">
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-wide text-attenue">
                <th className="py-2 pr-4 font-semibold">Étape</th>
                <th className="py-2 pr-4 text-right font-semibold">Durée</th>
                <th className="py-2 font-semibold">Résultat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {etapes.map((e) => (
                <tr key={e.nom} className="align-top">
                  <td className="py-2 pr-4 font-medium text-texte">{e.nom}</td>
                  <td className={`py-2 pr-4 text-right tabular-nums ${e.ms > 2000 ? "font-semibold text-defavorable" : e.ms > 700 ? "text-vigilance" : "text-texte-2"}`}>{e.ms} ms</td>
                  <td className="py-2">{e.erreur ? <pre className="whitespace-pre-wrap rounded-[8px] border border-defavorable-bordure bg-defavorable-fond p-2 text-[12px] text-defavorable">{e.erreur}</pre> : <span className="text-texte-2">{e.resultat}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Carte>
      <Carte titre="Comment lire" precision="Ce que les durées veulent dire">
        <p className="px-5 pb-4 text-[12.5px] leading-[1.5] text-texte-2">
          Une page Flotte, c&apos;est la session, les paramètres et le parc ; le tableau de bord, la session, les paramètres et les situations journalières ; une fiche véhicule, tout cela plus la fiche. Une lecture au-delà de deux secondes est en rouge. Si une fiche passe ici et casse encore sur sa page, la cause est dans la page elle-même, pas dans la base : le dire suffit pour corriger.
        </p>
      </Carte>
    </Cadre>
  );
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={2} />
          Paramètres
        </Link>
      </nav>
      {children}
    </div>
  );
}
