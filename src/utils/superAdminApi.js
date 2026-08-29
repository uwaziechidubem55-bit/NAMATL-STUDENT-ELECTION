// NAMATLS super admin API helper — twin of adminApi.js.
// Sends BOTH locks on every call: the admin session (Authorization header)
// and the super admin session (x-super-token header), so the server can
// verify each one independently.
export async function superAdminApi(action, payload = {}) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || ''),
      'x-super-token': localStorage.getItem('superToken') || '',
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}
