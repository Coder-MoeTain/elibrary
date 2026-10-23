/**
 * Feature flags from Vite env (`VITE_*`).
 * Change `.env` then restart `npm run dev` / rebuild for values to apply.
 */

function envFlag(name: keyof ImportMetaEnv, defaultOn = false): boolean {
  const raw = import.meta.env[name];
  if (raw == null || String(raw).trim() === "") return defaultOn;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Sidebar + route for Closed Testing dashboard. Default: hidden. */
export const SHOW_CLOSED_TESTING = envFlag("VITE_SHOW_CLOSED_TESTING", false);
