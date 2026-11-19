// Module hook: sends the two firebase-admin entry points to the in-memory fakes.
const here = new URL('.', import.meta.url);
const redirects = {
  'firebase-admin/app': new URL('fake-firebase-admin-app.mjs', here).href,
  'firebase-admin/firestore': new URL('fake-firebase-admin-firestore.mjs', here).href,
};
export async function resolve(specifier, context, nextResolve) {
  if (redirects[specifier]) return { url: redirects[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
