// Runs every hour: rolls the last hour's reader events into daily totals so the admin page stays fast.
import { compact } from "../lib/stats.mjs";

export default async () => {
  const moved = await compact(20000);
  console.log(`compacted ${moved} event(s)`);
};

export const config = { schedule: "@hourly" };
