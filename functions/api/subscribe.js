// The Sunday letter signup form (Cloudflare version; on Netlify, Netlify Forms handled this).
// Saves the email in D1 and sends the reader to /thanks/.
// To download the list: GET /api/subscribe with the admin password in the x-key header (returns CSV).
import { ensureTables } from "./_db.js";
import { onRequestGet as statsGate } from "./stats.js";

const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/i;

export async function onRequestPost({ request, env }) {
  const back = new URL("/thanks/", request.url);
  try {
    const form = await request.formData();
    if ((form.get("company") || "").toString().trim()) return Response.redirect(back, 303); // honeypot
    const email = (form.get("email") || "").toString().trim().toLowerCase();
    if (!EMAIL.test(email)) return Response.redirect(new URL("/?signup=invalid#letter-h", request.url), 303);
    const page = new URL(request.headers.get("referer") || "/", request.url).pathname.slice(0, 200);
    await ensureTables(env.DB);
    await env.DB.prepare(`INSERT OR IGNORE INTO subscribers (email, created, page) VALUES (?,?,?)`)
      .bind(email, new Date().toISOString(), page).run();
  } catch (e) {
    console.error("signup failed", e);
  }
  return Response.redirect(back, 303);
}

export async function onRequestGet(ctx) {
  const gate = await statsGate(ctx);
  if (gate.status !== 200) return gate;
  const { results } = await ctx.env.DB.prepare(`SELECT email, created, page FROM subscribers ORDER BY created`).all();
  const csv = ["email,signed_up,page", ...results.map((r) => [r.email, r.created, r.page].map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(","))].join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=pretty-little-rituals-subscribers.csv", "cache-control": "no-store" } });
}
