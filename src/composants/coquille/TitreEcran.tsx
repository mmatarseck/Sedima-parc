/**
 * Titre d'un écran, dans le contenu et non dans la barre d'application.
 *
 * Il annonce les données qui le suivent, et défile avec elles : ce qui reste à
 * l'écran, c'est l'identité de l'application, pas celle de la page en cours.
 * Le bloc d'actions se place à droite, sur la même ligne.
 */
export function TitreEcran({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="min-w-0">
        <h1 className="titre-page">{titre}</h1>
        {sousTitre ? <p className="meta mt-1 text-[13px]">{sousTitre}</p> : null}
      </div>
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}
