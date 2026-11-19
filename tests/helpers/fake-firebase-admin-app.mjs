// Stand-in for 'firebase-admin/app' (tests only).
const apps = [];
export const initializeApp = (options = {}) => { const app = { options }; apps.push(app); return app; };
export const cert = (serviceAccount) => ({ serviceAccount });
export const getApps = () => apps;
