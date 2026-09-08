# Rendu d'un composant client hors de Next

`hook.mjs` s'enregistre auprès de Node (`node --import tsx --import ./scripts/rendu/hook.mjs …`)
et fait servir `navigation-mock.mjs` à la place de `next/navigation` : `useRouter`,
`useSearchParams`, `usePathname` deviennent inertes, et un composant client se rend
en HTML par `react-dom/server` avec ses vraies données. Sert à `tester-fiche-rendu.mts`,
qui rejoue la fiche véhicule comme en production, depuis PGlite.
