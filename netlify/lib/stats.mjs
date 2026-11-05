// Shared helpers for the private stats.
// Raw events live at e/<day>/<id>. Once an hour they are rolled up into one summary per day at d/<day>
// (counts per page, platform, link, device and country), and the raw events are deleted.
import { getStore } from "@netlify/blobs";

export const store = () => getStore("stats");

export const rowKey = (ev) =>
  JSON.stringify([ev.t, ev.p, ev.s || "Direct", ev.h || "", ev.x || "", ev.w || "", ev.d || "", ev.c || ""]);

export function addEvent(summary, ev) {
  const k = rowKey(ev);
  summary.rows[k] = (summary.rows[k] || 0) + 1;
  if (ev.ti && ev.p) summary.titles[ev.p] = ev.ti;
}

const emptySummary = () => ({ rows: {}, titles: {} });

async function readMany(st, keys, deadline) {
  const out = [];
  for (let i = 0; i < keys.length; i += 40) {
    if (Date.now() > deadline) break;
    const chunk = keys.slice(i, i + 40);
    const vals = await Promise.all(chunk.map((k) => st.get(k, { type: "json" }).catch(() => null)));
    chunk.forEach((k, j) => out.push([k, vals[j]]));
  }
  return out;
}

export async function listRawKeys(st) {
  const byDay = {};
  for await (const page of st.list({ prefix: "e/", paginate: true })) {
    for (const b of page.blobs) {
      const day = b.key.split("/")[1];
      (byDay[day] ||= []).push(b.key);
    }
  }
  return byDay;
}

// Roll raw events into daily summaries. Only the hourly scheduled job calls this, so there is a single writer.
export async function compact(budgetMs = 20000) {
  const st = store();
  const deadline = Date.now() + budgetMs;
  const byDay = await listRawKeys(st);
  let moved = 0;
  for (const day of Object.keys(byDay).sort()) {
    if (Date.now() > deadline) break;
    const keys = byDay[day].slice(0, 2000);
    const pairs = await readMany(st, keys, deadline);
    if (!pairs.length) continue;
    const summary = (await st.get(`d/${day}`, { type: "json" }).catch(() => null)) || emptySummary();
    for (const [, ev] of pairs) if (ev && ev.t) addEvent(summary, ev);
    await st.setJSON(`d/${day}`, summary);
    for (let i = 0; i < pairs.length; i += 40) {
      await Promise.all(pairs.slice(i, i + 40).map(([k]) => st.delete(k).catch(() => null)));
    }
    moved += pairs.length;
  }
  return moved;
}

// Everything for the admin page: all daily summaries plus any events not yet rolled up.
export async function collect(budgetMs = 15000) {
  const st = store();
  const deadline = Date.now() + budgetMs;
  const days = {};
  const summaryKeys = [];
  for await (const page of st.list({ prefix: "d/", paginate: true })) {
    for (const b of page.blobs) summaryKeys.push(b.key);
  }
  for (const [k, v] of await readMany(st, summaryKeys, deadline)) {
    if (v) days[k.slice(2)] = v;
  }
  const byDay = await listRawKeys(st);
  let pending = 0, partial = false;
  for (const day of Object.keys(byDay)) {
    const keys = byDay[day];
    const pairs = await readMany(st, keys, deadline);
    if (pairs.length < keys.length) partial = true;
    const s = (days[day] ||= emptySummary());
    for (const [, ev] of pairs) if (ev && ev.t) { addEvent(s, ev); pending++; }
  }
  return { days, pending, partial };
}
