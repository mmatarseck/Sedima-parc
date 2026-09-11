/* Profil de l'extraction des livraisons Sage X3 (YLIV) : ce qu'elle couvre et
 * comment elle nomme les transporteurs et les camions. Sert à décider si elle
 * peut alimenter le relevé de transport — rien n'est écrit, rien n'est chargé.
 *
 * Lancer : npx tsx scripts/profil-yliv.mts <classeur.xlsx> */
import { lireClasseur } from "./lire-xlsx.mts";

const [fichier] = process.argv.slice(2);
const feuille = lireClasseur(fichier!)[0]!;
const entete = feuille.lignes[0]!.map((c) => String(c ?? "").trim());
const col = (nom: string) => entete.indexOf(nom);
const texte = (v: unknown) => String(v ?? "").trim();
const [cDate, cSite, cNomSite, cBl, cChauff, cImmat, cUnite, cQte, cManut, cType, cClient] = [
  "Date expédition", "Site expédition", "Nom Site", "No livraison", "Nom Chauff client", "Mat. Véhicule client", "Unité vente", "Quantité livrée US", "Type Manutention", "Type livraison", "Nom client livré",
].map(col);

const lignes = feuille.lignes.slice(1).filter((l) => texte(l[cBl]));
const compte = (cle: (l: (typeof lignes)[number]) => string, poids?: (l: (typeof lignes)[number]) => number) => {
  const m = new Map<string, { n: number; p: number }>();
  for (const l of lignes) {
    const k = cle(l) || "(vide)";
    const x = m.get(k) ?? { n: 0, p: 0 };
    x.n++;
    x.p += poids ? poids(l) : 0;
    m.set(k, x);
  }
  return [...m.entries()].sort((a, b) => b[1].p - a[1].p || b[1].n - a[1].n);
};
const kg = (l: (typeof lignes)[number]) => (texte(l[cUnite]) === "KG" ? Number(l[cQte]) || 0 : 0);
const dates = lignes.map((l) => texte(l[cDate])).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();

console.log(`${lignes.length} lignes, ${new Set(lignes.map((l) => texte(l[cBl]))).size} bons, du ${dates[0]} au ${dates.at(-1)}`);
console.log("colonnes :", entete.join(" | "));
const afficher = (titre: string, rangs: [string, { n: number; p: number }][], n = 25) => {
  console.log(`\n${titre} (${rangs.length} valeurs)`);
  for (const [k, v] of rangs.slice(0, n)) console.log(`  ${k.slice(0, 40).padEnd(40)} ${String(v.n).padStart(7)} lignes ${String(Math.round(v.p / 1000)).padStart(8)} t`);
};
afficher("Unités", compte((l) => texte(l[cUnite]), kg));
afficher("Mois", compte((l) => texte(l[cDate]).slice(0, 7), kg).sort((a, b) => a[0].localeCompare(b[0])), 20);
afficher("Sites d'expédition", compte((l) => `${texte(l[cSite])} ${cNomSite >= 0 ? texte(l[cNomSite]) : ""}`, kg), 20);
afficher("Type de manutention", compte((l) => texte(l[cManut]), kg), 10);
afficher("Type de livraison", compte((l) => texte(l[cType]), kg), 10);
afficher("Préfixe du chauffeur (avant « / »)", compte((l) => (texte(l[cChauff]).includes("/") ? texte(l[cChauff]).split("/")[0]!.trim() : `sans / : ${texte(l[cChauff])}`), kg), 30);
afficher("Immatriculations", compte((l) => texte(l[cImmat]).replace(/[\s-]/g, "").toUpperCase(), kg), 30);
const sansCamion = lignes.filter((l) => !texte(l[cImmat]));
console.log(`\nsans immatriculation : ${sansCamion.length} lignes, ${Math.round(sansCamion.reduce((s, l) => s + kg(l), 0) / 1000)} t`);
const bonsSept = compte((l) => texte(l[cClient]), kg).slice(0, 8);
afficher("Clients livrés (poids)", bonsSept, 8);
