// Private stats for /admin/. Needs the admin password in the x-key header.
// To change the password, add an environment variable STATS_PASSWORD in the Cloudflare Pages project settings.
// Returns the same shape the Netlify version did, so the admin page works unchanged.
import { ensureTables } from "./_db.js";

const BUILT_IN_HASH = "495aa6b781f1b327b63f93198c6631b4e9a4ca452aba6996a563da1aec778bd8";
async function sha(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function allowed(key, env) {
  if (!key) return false;
  const want = env.STATS_PASSWORD ? await sha(env.STATS_PASSWORD) : BUILT_IN_HASH;
  const got = await sha(key);
  let diff = got.length ^ want.length;
  for (let i = 0; i < Math.min(got.length, want.length); i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

export async function onRequestGet({ request, env }) {
  if (!(await allowed(request.headers.get("x-key") || "", env))) {
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: "wrong password" }, { status: 401 });
  }
  try {
    await ensureTables(env.DB);
    const { results: rows } = await env.DB.prepare(
      `SELECT day,t,p,s,h,x,w,d,c,COUNT(*) AS n FROM events GROUP BY day,t,p,s,h,x,w,d,c`).all();
    const { results: titles } = await env.DB.prepare(
      `SELECT day,p,MAX(ti) AS ti FROM events WHERE ti <> '' GROUP BY day,p`).all();
    const days = {};
    const get = (d) => (days[d] ||= { rows: {}, titles: {} });
    for (const r of rows) {
      const k = JSON.stringify([r.t, r.p, r.s || "Direct", r.h || "", r.x || "", r.w || "", r.d || "", r.c || ""]);
      get(r.day).rows[k] = r.n;
    }
    for (const r of titles) get(r.day).titles[r.p] = r.ti;
    const { results: subs } = await env.DB.prepare(`SELECT COUNT(*) AS n FROM subscribers`).all();
    return Response.json({ days, pending: 0, partial: false, subscribers: subs[0].n }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "could not read stats" }, { status: 500 });
  }
}
