import { NextResponse, type NextRequest } from "next/server";
import { normaliser } from "@/domaine/immatriculation";

/**
 * L'adresse que le QR code d'un véhicule porte : `/v/AA032EA`. Elle mène à la
 * fiche rapide du téléphone — c'est là qu'on prend une action devant le
 * véhicule. Sans session, le proxy passe par la page de garde et revient ici.
 */
export function GET(requete: NextRequest, contexte: { params: Promise<{ immat: string }> }) {
  return contexte.params.then(({ immat }) => {
    const destination = requete.nextUrl.clone();
    destination.pathname = `/telephone/vehicules/${normaliser(decodeURIComponent(immat))}`;
    destination.search = "";
    return NextResponse.redirect(destination);
  });
}
