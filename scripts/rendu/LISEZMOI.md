# Rendu d'un composant client hors de Next

`hook.mjs` s'enregistre auprès de Node (`node --import tsx --import ./scripts/rendu/hook.mjs …`)
et fait servir `navigation-mock.mjs` à la place de `next/navigation` : `useRouter`,
`useSearchParams`, `usePathname` deviennent inertes, et un composant client se rend
en HTML par `react-dom/server` avec ses vraies données. Sert à `tester-fiche-rendu.mts`,
qui rejoue la fiche véhicule comme en production, depuis PGlite.

## Deux façades, pas une

`navigation-mock.mjs` sert les modules ES, `navigation-mock.cjs` le CommonJS, et
`hook.mjs` branche les deux. Ce n'est pas une redondance : tsx sert les `.mts` en
modules ES mais compile les `.tsx` de `src/` en CommonJS, et les crochets de Node
ne couvrent que le chargeur ES. Sans la seconde façade, la fiche véhicule reçoit
le vrai `next/navigation`, tombe sur « invariant expected app router to be
mounted », et le banc échoue sur les 173 véhicules d'un coup — ce qui ressemble à
une fiche cassée alors que c'est l'échafaudage qui manque.

Ce qu'on ajoute à l'une, on l'ajoute à l'autre.
