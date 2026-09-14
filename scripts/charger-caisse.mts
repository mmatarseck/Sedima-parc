/* ============================================================================
 * Fabrique `supabase/caisse-parties/` — la caisse parc réelle, 2025-2026.
 *
 * La caisse de l'application n'avait aucun mouvement : la pastille disait « — »
 * et le registre des contraventions était vide. La gestion du parc tient la
 * caisse par quinzaine, dans `MALICK/Depense CAISSE` : un récapitulatif par
 * période (« CAISSE PARC » en 2025, « RECAP DEPENSES CAISSE PARC » en 2026),
 * de janvier 2025 au 31 août 2026. Les brouillards à côté ne sont pas relus :
 * leur première feuille recopie des lignes d'une quinzaine à l'autre, la seconde
 * est le récapitulatif lui-même.
 *
 * CE QU'EST UNE QUINZAINE. Le récapitulatif s'ouvre sur ses « RECETTES » — le
 * fonds disponible, 1 004 000 F —, liste ses dépenses, chacune avec 1 % de
 * frais de transfert, et se ferme sur son total. Le fonds est reconstitué
 * d'une période à l'autre : août 1A reprend comme recette les 368 205 F restés
 * d'août 1, et août 2 se clôt « SOLDE au 31/08/2026 : 29 653 ». L'argent
 * entré est donc la recette **moins ce qui restait** ; charger chaque recette
 * comme une entrée compterait deux fois le même argent.
 *
 * CE QU'ON CHARGE, par quinzaine :
 *
 *   * **une entrée** : l'approvisionnement réel, recette moins reste précédent ;
 *   * **une dépense et sa sortie par ligne** — la règle du métier veut que la
 *     sortie cite la dépense qu'elle règle —, avec son poste, le véhicule que
 *     le libellé nomme, et « justifié » quand le récapitulatif le dit ;
 *   * **une dépense et sa sortie pour les frais de transfert** de la période.
 *
 * Le solde reporté de la caisse passe à zéro : le journal s'ouvre sur le
 * premier approvisionnement de janvier 2025, et son solde retombe, quinzaine
 * après quinzaine, sur le reste écrit au récapitulatif.
 *
 * LA DATE. Le récapitulatif ne date pas ses lignes, sauf en août 2026. Une
 * ligne sans date prend la date de clôture de sa quinzaine : celle du fichier,
 * qui concorde avec les deux soldes datés (12 et 31 août 2026).
 *
 * Lancer : npx tsx scripts/charger-caisse.mts
 * ==========================================================================*/

import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireClasseur, type Cellule } from "./lire-xlsx.mts";
import { afficher, extraireDepuisLibelle } from "../src/domaine/immatriculation";

const D = "C:/Users/mamadou.seck/OneDrive - SEDIMA S.A/Direction des Operations (DO) - Documents/6. Logistique & Distribution/61. Gestion Parc/MALICK/Depense CAISSE";
const SOURCES = [
  { annee: 2025, dossier: join(D, "SUIVI DEPENSES 2025", "CAISSE PARC") },
  { annee: 2026, dossier: join(D, "SUIVI DEPENSES 2026", "RECAP DEPENSES CAISSE PARC") },
];
const projet = process.cwd();

const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c).trim());
const lisible = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Œ/g, "OE").replace(/œ/g, "oe").toUpperCase();
const nombre = (c: Cellule) => {
  const n = typeof c === "number" ? c : Number(texte(c).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const MOIS = ["JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE"];
const NOM_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Le poste d'une dépense de caisse, par mots du libellé — la première règle qui s'applique. */
const POSTES: [RegExp, string][] = [
  [/AMENDE|CONTRAVENTION|FOURRIERE/, "contravention"],
  [/VISITE|VISTE|VIGNETTE|ASSURANCE|ATTESTATION|CARTE GRISE|MUTATION|LICENCE|RECETTE FISCAL|PATENTE/, "conformite"],
  [/ESSENCE|GASOIL|GAZOIL|CARBURANT/, "carburant"],
  [/FRAIS DE? ?ROUT|FRAIS DE DEPLACEMENT|MISSION/, "frais-de-route"],
  [/PEAGE|PESAGE|S?TAT?IONNEMENT|RAPIDO/, "peage"],
  [/PNEU|CHAMBRE A AIR|VULCANI|VULGANI|GONFLAGE|PARALLELISME|PARALYSEMENT/, "pneumatiques"],
  [/LAVAGE/, "divers"],
  [/MAIN ?D.?OEUVRE|MAINDOEUVRE|REPARATION|DEPANNAGE|REMORQUAGE|MONTAGE|SOUDURE|TOLIER|ELECTRICIEN|MECANICIEN|DEBOUCHAGE|REGLAGE|CHANGEMENT|DIAGNOSTIC|RECHARGE GAZ/, "maintenance-curative"],
  [/HUILE|VIDANGE|FILTRE|GRAISS|CARTOUCHE/, "maintenance-preventive"],
  [/ACHAT|PIECE|PLAQUETTE|DISQUE|BATTERIE|AMPOULE|RETROVISEUR|CAPTEUR|DEMARREUR|VOLVE|MEMBRANE/, "pieces"],
];
const posteDe = (libelle: string) => POSTES.find(([m]) => m.test(lisible(libelle)))?.[1] ?? "divers";

interface Ligne {
  rang: number;
  libelle: string;
  montant: number;
  frais: number;
  justifie: boolean;
  date: string | null;
  plaque: string | null;
}

interface Quinzaine {
  fichier: string;
  annee: number;
  mois: number;
  libelle: string;
  cloture: string;
  recettes: number;
  lignes: Ligne[];
  totalFichier: number | null;
  resteFichier: number | null;
}

/* -- 1. Les récapitulatifs --------------------------------------------------- */

const quinzaines: Quinzaine[] = [];
const alertes: string[] = [];

for (const s of SOURCES) {
  for (const nom of readdirSync(s.dossier).filter((x) => x.endsWith(".xlsx"))) {
    const m = /^([A-Z]+) (\d)(A?)\.xlsx$/.exec(nom.replace("JULLET", "JUILLET"));
    if (!m) throw new Error(`récapitulatif au nom inattendu : ${nom}`);
    const mois = MOIS.indexOf(m[1]!);
    if (mois < 0) throw new Error(`mois inconnu : ${nom}`);
    const chemin = join(s.dossier, nom);
    /* La clôture : la date du fichier, si elle tombe dans le mois ou les six semaines qui suivent ; sinon la fin de période. */
    const fichierLe = statSync(chemin).mtime.toISOString().slice(0, 10);
    const debutMois = `${s.annee}-${String(mois + 1).padStart(2, "0")}-01`;
    const limite = new Date(Date.UTC(s.annee, mois + 1, 1) + 42 * 86400000).toISOString().slice(0, 10);
    const finPeriode = m[2] === "1" && !m[3] ? `${s.annee}-${String(mois + 1).padStart(2, "0")}-15` : new Date(Date.UTC(s.annee, mois + 1, 0)).toISOString().slice(0, 10);
    const cloture = fichierLe >= debutMois && fichierLe <= limite ? fichierLe : finPeriode;
    if (cloture !== fichierLe) alertes.push(`${nom} ${s.annee} : date du fichier ${fichierLe} hors période, clôture au ${cloture}`);

    const f = lireClasseur(chemin)[0]!;
    const i0 = f.lignes.findIndex((l) => l.map(texte).some((c) => c === "DESIGNATION" || /APPRO DE BASE/i.test(c)));
    if (i0 < 0) throw new Error(`${nom} ${s.annee} : en-tête introuvable`);
    const h = f.lignes[i0]!.map(texte);
    const nouvelle = h.includes("DESIGNATION");
    const iDes = nouvelle ? h.indexOf("DESIGNATION") : h.findIndex((c) => /APPRO DE BASE/i.test(c));
    const iDep = nouvelle ? h.indexOf("DEBIT") : h.findIndex((c) => /^DEPENSES$/i.test(c));
    const iFra = nouvelle ? h.indexOf("CREDIT") : h.findIndex((c) => /^FRAIS$/i.test(c));
    const iDate = nouvelle ? h.indexOf("DATE") : -1;
    const iNum = nouvelle ? -1 : h.findIndex((c) => /^N°$/i.test(c));
    const iObs = h.findIndex((c) => /OBSERVATION/i.test(c));
    if (iDes < 0 || iDep < 0 || iFra < 0 || (!nouvelle && iNum < 0)) throw new Error(`${nom} ${s.annee} : colonnes introuvables (${h.join(" | ")})`);

    const avant = f.lignes.slice(0, i0).flat().map(texte);
    const iRec = avant.findIndex((c) => /RECETTES/i.test(c));
    let recettes = iRec >= 0 ? nombre(avant.slice(iRec + 1).find((c) => /^\d+(\.\d+)?$/.test(c)) ?? "") : 0;
    const lignes: Ligne[] = [];
    let totalFichier: number | null = null;
    let resteFichier: number | null = null;
    for (const l of f.lignes.slice(i0 + 1)) {
      const des = texte(l[iDes]);
      const montant = nombre(l[iDep]);
      const lib = lisible(des);
      if (nouvelle) {
        if (/^APPROVISIONNEMENT/.test(lib)) {
          recettes = montant;
          continue;
        }
        if (/^MONTANT TOTAL DES DEPENSES/.test(lib)) totalFichier = montant;
        if (/^SOLDE AU/.test(lib)) resteFichier = montant;
        if (/^SOLDE INITIAL|^MONTANT TOTAL|^SOLDE AU/.test(lib) || !des || !montant) continue;
      } else {
        /* Le numéro de ligne ne dit rien : des dépenses réelles n'en portent pas. Ce qui n'est pas une dépense,
           c'est le total (posé sans libellé), le reste, et les calculs que certaines feuilles écrivent sous un nom
           à elles — « CAISSE JUIN 2 », « SURPLUS CAISSE JUIN 1 », « SOMME NOUVEAU CAISSE ». */
        if (!des && montant) {
          if (totalFichier === null) totalFichier = montant;
          continue;
        }
        if (/^(MONTANT TOTAL|MONTANT RESTANT|TOTAL|SOLDE|CAISSE |SOMME |SURPLUS |RESTANT|RELIQUAT|RESTE |APPROVISIONNEMENT|RECETTES?$)/.test(lib)) {
          if (/^(CAISSE |MONTANT TOTAL|TOTAL)/.test(lib) && totalFichier === null) totalFichier = montant;
          if (/RESTANT|RELIQUAT|^RESTE /.test(lib)) resteFichier = montant;
          continue;
        }
        if (!des || !montant) continue;
      }
      const statut = iObs >= 0 ? texte(l[iObs]) : l.map(texte).find((c) => /^(JUSTIFI|NJ|NON)/i.test(c)) ?? "";
      const d = iDate >= 0 ? texte(l[iDate]) : "";
      const plaque = extraireDepuisLibelle(des);
      lignes.push({ rang: lignes.length + 1, libelle: des.replace(/\s+/g, " "), montant: Math.round(montant), frais: Math.round(nombre(l[iFra])), justifie: /^JUSTIFI/i.test(statut), date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null, plaque });
    }
    const n = m[2] === "1" ? (m[3] ? "1re quinzaine (suite)" : "1re quinzaine") : m[2] === "2" ? "2e quinzaine" : `${m[2]}e période`;
    quinzaines.push({ fichier: `${nom} ${s.annee}`, annee: s.annee, mois, libelle: `${NOM_MOIS[mois]} ${s.annee}, ${n}`, cloture, recettes: Math.round(recettes), lignes, totalFichier, resteFichier });
  }
}
quinzaines.sort((a, b) => a.cloture.localeCompare(b.cloture) || a.fichier.localeCompare(b.fichier));

/* -- 2. Le journal ------------------------------------------------------------- */

interface Depense { numero: string; plaque: string | null; date: string; poste: string; libelle: string; montant: number; beneficiaire: string | null; reference: string; justificatif: boolean }
interface Mouvement { numero: string; date: string; sens: "entree" | "sortie"; libelle: string; montant: number; beneficiaire: string | null; piece: string; justificatif: boolean; depense: string | null }

const depenses: Depense[] = [];
const mouvements: Mouvement[] = [];
const controles: string[] = [];
let resteAvant = 0;
let n = 0;
const numero = (prefixe: string, i: number) => `${prefixe}-${String(i).padStart(5, "0")}`;

/** Ce que chaque quinzaine a produit, pour couper les fichiers sans couper une période en deux. */
const bornes: { libelle: string; deps: [number, number]; mvts: [number, number] }[] = [];

for (const q of quinzaines) {
  const depDebut = depenses.length;
  const mvtDebut = mouvements.length;
  const depensesQ = q.lignes.reduce((s, l) => s + l.montant, 0);
  const fraisQ = q.lignes.reduce((s, l) => s + l.frais, 0);
  const reste = q.recettes - depensesQ - fraisQ;
  const piece = `Récapitulatif de la caisse parc — ${q.libelle}`;
  const entree = q.recettes - resteAvant;
  if (entree > 0) mouvements.push({ numero: numero("CAI-CP", mouvements.length + 1), date: q.cloture, sens: "entree", libelle: `Approvisionnement de la caisse parc — ${q.libelle}`, montant: entree, beneficiaire: null, piece: `${piece} : fonds disponible ${q.recettes} F, reste précédent ${resteAvant} F`, justificatif: true, depense: null });
  else if (entree < 0) alertes.push(`${q.fichier} : recette ${q.recettes} F inférieure au reste précédent ${resteAvant} F`);
  for (const l of q.lignes) {
    n++;
    const dep = numero("DEP-CP", n);
    const date = l.date ?? q.cloture;
    depenses.push({ numero: dep, plaque: l.plaque, date, poste: posteDe(l.libelle), libelle: l.libelle, montant: l.montant, beneficiaire: null, reference: `${piece}, ligne ${l.rang}${l.date ? "" : " — datée de la clôture : le récapitulatif ne date pas ses lignes"}`, justificatif: l.justifie });
    /* Le journal de caisse suit le rythme des récapitulatifs : un mouvement est daté de la clôture de sa quinzaine,
       et le solde de la base retombe alors, période après période, sur le reste écrit au récapitulatif. La dépense,
       elle, garde la date réelle quand la feuille la donne : c'est elle qui porte le coût du véhicule et son mois. */
    mouvements.push({ numero: numero("CAI-CP", mouvements.length + 1), date: q.cloture, sens: "sortie", libelle: l.libelle, montant: l.montant, beneficiaire: l.plaque ? afficher(l.plaque) : null, piece: `${piece}, ligne ${l.rang}`, justificatif: l.justifie, depense: dep });
  }
  if (fraisQ > 0) {
    n++;
    const dep = numero("DEP-CP", n);
    depenses.push({ numero: dep, plaque: null, date: q.cloture, poste: "divers", libelle: `Frais de transfert des dépenses de la caisse parc — ${q.libelle}`, montant: fraisQ, beneficiaire: "Opérateur de transfert d'argent", reference: `${piece}, colonne des frais`, justificatif: true });
    mouvements.push({ numero: numero("CAI-CP", mouvements.length + 1), date: q.cloture, sens: "sortie", libelle: `Frais de transfert — ${q.libelle}`, montant: fraisQ, beneficiaire: "Opérateur de transfert d'argent", piece: `${piece}, colonne des frais`, justificatif: true, depense: dep });
  }
  const total = depensesQ + fraisQ;
  const accord = q.totalFichier === null ? "pas de total" : Math.abs(q.totalFichier - total) <= 1 ? "total d'accord" : `TOTAL ${q.totalFichier} ≠ ${total}`;
  const accordReste = q.resteFichier === null ? "" : Math.abs(q.resteFichier - reste) <= 1 ? " · reste d'accord" : ` · RESTE ${q.resteFichier} ≠ ${reste}`;
  controles.push(`${q.cloture}  ${q.fichier.padEnd(18)} recettes ${String(q.recettes).padStart(8)}  entrée ${String(entree).padStart(8)}  ${String(q.lignes.length).padStart(3)} dépenses ${String(depensesQ).padStart(8)} + frais ${String(fraisQ).padStart(6)}  reste ${String(reste).padStart(7)}  ${accord}${accordReste}`);
  bornes.push({ libelle: q.libelle, deps: [depDebut, depenses.length], mvts: [mvtDebut, mouvements.length] });
  resteAvant = reste;
}

/* -- 3. Les fichiers -------------------------------------------------------- */

const dossier = join(projet, "supabase/caisse-parties");
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });
const sql = (v: string | number | boolean | null) => (v === null ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${v.replace(/'/g, "''")}'`);

const ligneDepense = (d) => `    (${sql(d.numero)}, ${sql(d.plaque)}, '${d.date}', '${d.poste}', ${sql(d.libelle)}, ${d.montant}, ${sql(d.beneficiaire)}, ${sql(d.reference)}, ${d.justificatif})`;
const ligneMouvement = (m) => `  (${sql(m.numero)}, '${m.date}', '${m.sens}', ${sql(m.libelle)}, ${m.montant}, ${sql(m.beneficiaire)}, ${sql(m.piece)}, ${m.justificatif}, ${sql(m.depense)}, 'Gestion du parc — récapitulatif de quinzaine')`;

/* Le SQL Editor de Supabase refuse une requête trop grosse — il a rendu « Query is too large » sur un fichier
   d'1,3 Mo. Les fichiers sont donc coupés à 400 Ko, et jamais au milieu d'une quinzaine : chacun porte des
   périodes entières, avec leur approvisionnement, leurs dépenses et leurs frais. */
const TAILLE = 400_000;
const paquets = [];
let courant = [];
let taille = 0;
for (const b of bornes) {
  const poids = depenses.slice(b.deps[0], b.deps[1]).reduce((s, d) => s + ligneDepense(d).length, 0) + mouvements.slice(b.mvts[0], b.mvts[1]).reduce((s, m) => s + ligneMouvement(m).length, 0);
  if (taille + poids > TAILLE && courant.length > 0) {
    paquets.push(courant);
    courant = [];
    taille = 0;
  }
  courant.push(b);
  taille += poids;
}
if (courant.length > 0) paquets.push(courant);

paquets.forEach((paquet, i) => {
  const deps = depenses.slice(paquet[0].deps[0], paquet[paquet.length - 1].deps[1]);
  const mvts = mouvements.slice(paquet[0].mvts[0], paquet[paquet.length - 1].mvts[1]);
  const tete = i === 0
    ? `-- Le solde reporté passe à zéro : le journal s'ouvre sur le premier
-- approvisionnement de janvier 2025.
update parametre set valeur = jsonb_set(valeur, '{soldeInitial}', '0'::jsonb), modifie_le = now()
 where cle = 'caisse' and (valeur->>'soldeInitial')::bigint is distinct from 0;

`
    : "";
  writeFileSync(
    join(dossier, `caisse-${String(i + 1).padStart(2, "0")}.sql`),
    `-- ============================================================================
-- SEDIMA Parc — la caisse parc réelle, partie ${i + 1} sur ${paquets.length}.
--
-- **Ce n'est pas une migration.** Source : les récapitulatifs de la caisse parc
-- par quinzaine (MALICK/Depense CAISSE). Voir docs/CAISSE-REELLE.md.
--
-- ${paquet.length} quinzaines, de ${paquet[0].libelle} à ${paquet[paquet.length - 1].libelle}.
-- ${deps.length} dépenses, ${mvts.length} mouvements (${mvts.filter((m) => m.sens === "entree").length} approvisionnements), du ${mvts[0].date} au ${mvts[mvts.length - 1].date}.
--
-- Chaque sortie cite la dépense qu'elle règle. **À jouer dans l'ordre des
-- fichiers** : le solde de chaque quinzaine dépend du reste de la précédente.
-- REJOUABLE : \`on conflict do nothing\`.
-- ============================================================================

begin;

${tete}insert into depense (numero, vehicule_id, date, poste, libelle, montant, beneficiaire, reference, origine, justificatif)
select v.numero, ve.id, v.date::date, v.poste::poste_depense, v.libelle, v.montant::bigint,
       case when ve.id is null then coalesce(v.beneficiaire, 'Caisse parc — bénéficiaire non nommé') else v.beneficiaire end,
       v.reference, 'caisse', v.justificatif
  from (values
${deps.map(ligneDepense).join(",\n")}
  ) as v(numero, immatriculation, date, poste, libelle, montant, beneficiaire, reference, justificatif)
  left join vehicule ve on ve.immatriculation = v.immatriculation
on conflict (numero) do nothing;

insert into mouvement_caisse (numero, date, sens, libelle, montant, beneficiaire, piece, justificatif, depense_numero, enregistre_par) values
${mvts.map(ligneMouvement).join(",\n")}
on conflict (numero) do nothing;

commit;
`,
  );
});

/* -- 4. Le compte rendu ----------------------------------------------------- */

const parPoste = new Map<string, { n: number; montant: number }>();
for (const d of depenses) {
  const x = parPoste.get(d.poste) ?? { n: 0, montant: 0 };
  x.n++;
  x.montant += d.montant;
  parPoste.set(d.poste, x);
}
console.log(`${quinzaines.length} quinzaines, ${depenses.length} dépenses, ${mouvements.length} mouvements ; solde final ${resteAvant} F`);
console.log(`avec une plaque dans le libellé : ${depenses.filter((d) => d.plaque).length} ; justifiées : ${depenses.filter((d) => d.justificatif).length}`);
console.log("\nquinzaine par quinzaine :");
for (const c of controles) console.log(`  ${c}`);
console.log("\npar poste :");
for (const [p, x] of [...parPoste].sort((a, b) => b[1].montant - a[1].montant)) console.log(`  ${p.padEnd(24)} ${String(x.n).padStart(5)} ${String(x.montant).padStart(10)} F`);
console.log("\nalertes :", alertes.length ? `\n  ${alertes.join("\n  ")}` : "aucune");
const divers = depenses.filter((d) => d.poste === "divers" && d.beneficiaire === null).slice(0, 25).map((d) => d.libelle.slice(0, 80));
console.log("\n« divers » (25 premiers) :\n  " + divers.join("\n  "));
