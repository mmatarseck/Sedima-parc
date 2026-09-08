import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { type NextRequest } from "next/server";
import { normaliser } from "@/domaine/immatriculation";
import { lignesFlotte } from "@/donnees/flotte";
import { parametresServeur } from "@/lib/parametres-serveur";
import { matriceQr, urlVehicule } from "@/lib/qr";

/**
 * Les étiquettes QR en PDF, prêtes à imprimer et à coller : `?immat=AA032EA,AB565KP`
 * pour quelques véhicules, `?tous=1` pour tout le périmètre. Une page A4 porte
 * huit étiquettes (deux colonnes, quatre rangées) : le code, l'immatriculation
 * en gros dessous, le nom de l'application en petit. Les plaques demandées
 * hors du périmètre de la personne sont ignorées, comme la liste les ignore.
 */
export async function GET(requete: NextRequest) {
  const parametres = await parametresServeur();
  const lignes = (await lignesFlotte(parametres)).filter((l) => l.vehicule.statut !== "a-recevoir" && l.vehicule.immatriculation);
  const demandees = (requete.nextUrl.searchParams.get("immat") ?? "")
    .split(",")
    .map((x) => normaliser(x))
    .filter(Boolean);
  const tous = requete.nextUrl.searchParams.get("tous") === "1";
  const retenues = tous ? lignes : lignes.filter((l) => demandees.includes(l.vehicule.immatriculation));
  if (retenues.length === 0) return new Response("Aucun véhicule à étiqueter.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });

  const origine = process.env.NEXT_PUBLIC_URL_APPLICATION?.replace(/\/$/, "") || requete.nextUrl.origin;
  const doc = await PDFDocument.create();
  doc.setTitle(`Étiquettes QR — ${retenues.length} véhicule${retenues.length > 1 ? "s" : ""}`);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const encre = rgb(0.133, 0.153, 0.169);
  const gris = rgb(0.55, 0.58, 0.6);

  /* A4 en points : 595 × 842. Deux colonnes de 262 pt, quatre rangées de 190 pt, marges de 24 pt. */
  const largeurPage = 595;
  const hauteurPage = 842;
  const marge = 24;
  const colonnes = 2;
  const rangees = 4;
  const largeurCase = (largeurPage - marge * 2) / colonnes;
  const hauteurCase = (hauteurPage - marge * 2) / rangees;
  const coteQr = 104;

  retenues.forEach((l, i) => {
    const page = i % (colonnes * rangees) === 0 ? doc.addPage([largeurPage, hauteurPage]) : doc.getPage(doc.getPageCount() - 1);
    const k = i % (colonnes * rangees);
    const col = k % colonnes;
    const rang = Math.floor(k / colonnes);
    const x0 = marge + col * largeurCase;
    const y0 = hauteurPage - marge - (rang + 1) * hauteurCase;
    /* Le cadre de découpe, en pointillé léger. */
    page.drawRectangle({ x: x0 + 6, y: y0 + 6, width: largeurCase - 12, height: hauteurCase - 12, borderColor: gris, borderWidth: 0.5, borderDashArray: [3, 3] });

    const v = l.vehicule;
    const matrice = matriceQr(urlVehicule(origine, v.immatriculation));
    const module = coteQr / matrice.length;
    const qx = x0 + (largeurCase - coteQr) / 2;
    const qy = y0 + hauteurCase - 16 - coteQr;
    matrice.forEach((ligne, r) => {
      ligne.forEach((sombre, c) => {
        if (sombre) page.drawRectangle({ x: qx + c * module, y: qy + coteQr - (r + 1) * module, width: module + 0.2, height: module + 0.2, color: encre });
      });
    });

    const plaque = v.immatriculationAffichee;
    const taillePlaque = 22;
    const largeurPlaque = gras.widthOfTextAtSize(plaque, taillePlaque);
    page.drawText(plaque, { x: x0 + (largeurCase - largeurPlaque) / 2, y: qy - 28, size: taillePlaque, font: gras, color: encre });
    const sousTitre = `${v.marque} ${v.appellation}`.slice(0, 40);
    const largeurSous = normal.widthOfTextAtSize(sousTitre, 9);
    page.drawText(sousTitre, { x: x0 + (largeurCase - largeurSous) / 2, y: qy - 42, size: 9, font: normal, color: gris });
    const pied = "SEDIMA Parc · scanner pour ouvrir le véhicule";
    const largeurPied = normal.widthOfTextAtSize(pied, 7);
    page.drawText(pied, { x: x0 + (largeurCase - largeurPied) / 2, y: y0 + 13, size: 7, font: normal, color: gris });
  });

  const octets = await doc.save();
  const nom = retenues.length === 1 ? `qr-${retenues[0]!.vehicule.immatriculation}.pdf` : `qr-${retenues.length}-vehicules.pdf`;
  return new Response(new Uint8Array(octets), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${nom}"`, "cache-control": "private, no-store" } });
}
