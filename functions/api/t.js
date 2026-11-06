// Collects one reader event (view, read or Amazon click) from /t.js. Cloudflare version of netlify/functions/t.mjs.
// Nothing personal is kept: no IP address, no cookie, no user ID.
import { ensureTables } from "./_db.js";

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|monitor|facebookexternalhit|pinterestbot|pinterest\/0\.|embedly|curl|wget|python|axios|node-fetch/i;
const TYPES = new Set(["view", "read", "click"]);
const clip = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

export async function onRequestPost({ request, env }) {
  const ua = request.headers.get("user-agent") || "";
  if (!ua || BOT.test(ua) || !env.DB) return new Response(null, { status: 204 });
  let b;
  try { b = JSON.parse(await request.text()); } catch { return new Response(null, { status: 204 }); }
  if (!b || !TYPES.has(b.t) || typeof b.p !== "string" || !b.p.startsWith("/") || b.p.startsWith("/admin")) {
    return new Response(null, { status: 204 });
  }
  const click = b.t === "click";
  try {
    await ensureTables(env.DB);
    await env.DB.prepare(`INSERT INTO events (day,t,p,ti,s,d,c,h,x,w) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(
      new Date().toISOString().slice(0, 10), b.t, clip(b.p, 200), clip(b.ti, 160), clip(b.s, 40) || "Direct",
      /mobile|android|iphone|ipad/i.test(ua) ? "Mobile" : "Desktop", (request.cf && request.cf.country) || "",
      click ? clip(b.h, 300) : "", click ? clip(b.x, 120) : "", click ? (b.w === "list" ? "list" : "story") : ""
    ).run();
  } catch (e) {
    console.error("stats write failed", e);
  }
  return new Response(null, { status: 204 });
}
