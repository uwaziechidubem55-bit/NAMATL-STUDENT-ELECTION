// Usage: node --import ./tests/helpers/register.mjs --test tests/
// Makes api/*.js talk to the in-memory database instead of the real Firestore.
import { register } from 'node:module';
register('./loader.mjs', import.meta.url);
