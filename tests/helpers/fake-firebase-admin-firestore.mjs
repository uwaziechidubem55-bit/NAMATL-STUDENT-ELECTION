// Stand-in for 'firebase-admin/firestore' (tests only).
import { FieldValue, getFakeFirestore } from './fake-firestore.mjs';
export { FieldValue };
export const getFirestore = () => getFakeFirestore();
