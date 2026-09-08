export async function resolve(specifier, context, next) {
  if (specifier === "next/navigation") return { url: new URL("./navigation-mock.mjs", import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
