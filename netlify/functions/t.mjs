// Collects one reader event (view, read or Amazon click) from /t.js and stores it in Netlify Blobs.
// Nothing personal is kept: no IP address, no cookie, no user ID.
import { getStore } from "@netlify/blobs";

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|monitor|facebookexternalhit|pinterestbot|pinterest\/0\.|embedly|curl|wget|python|axios|node-fetch/i;
const TYPES = new Set(["view", "read", "click"]);
const clip = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

export default async (req, context) => {
  if (req.method !== "POST") return new Response("", { status: 405 });
  const ua = req.headers.get("user-agent") || "";
  if (!ua || BOT.test(ua)) return new Response(null, { status: 204 });

  let b;
  try { b = JSON.parse(await req.text()); } catch { return new Response(null, { status: 204 }); }
  if (!b || !TYPES.has(b.t) || typeof b.p !== "string" || !b.p.startsWith("/")) return new Response(null, { status: 204 });
  if (b.p.startsWith("/admin")) return new Response(null, { status: 204 });

  const now = new Date();
  const ev = {
    t: b.t,
    p: clip(b.p, 200),
    ti: clip(b.ti, 160),
    s: clip(b.s, 40) || "Direct",
    d: /mobile|android|iphone|ipad/i.test(ua) ? "Mobile" : "Desktop",
    c: (context && context.geo && context.geo.country && context.geo.country.code) || "",
  };
  if (b.t === "click") {
    ev.h = clip(b.h, 300);
    ev.x = clip(b.x, 120);
    ev.w = b.w === "list" ? "list" : "story";
  }

  const day = now.toISOString().slice(0, 10);
  const key = `e/${day}/${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await getStore("stats").setJSON(key, ev);
  } catch (e) {
    console.error("stats write failed", e);
  }
  return new Response(null, { status: 204 });
};

export const config = { path: "/api/t" };
