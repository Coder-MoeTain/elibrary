/** Public member login — always `/login`. */
export const MEMBER_LOGIN_PATH = "/login";

const REGISTER_PATH = "/register";

const HEX_SEGMENT_RE = /[0-9a-f]{24,}/i;

function normalizePath(raw: string): string {
  let path = raw.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  return path.replace(/\/+$/, "") || "/";
}

/**
 * Admin login UI path from `VITE_ADMIN_LOGIN_PATH`.
 * Must include a non-guessable segment (≥24 hex chars) — validated at runtime.
 */
export function getAdminLoginPath(): string {
  const configured = import.meta.env.VITE_ADMIN_LOGIN_PATH;
  if (typeof configured === "string" && configured.trim()) {
    return normalizePath(configured);
  }
  return "/internal/auth/dd472b06fb01e6f0aed2cb77f17649f7/login";
}

function isSecureAdminPath(path: string): boolean {
  return HEX_SEGMENT_RE.test(path) && !/\/admin\/login\/?$/i.test(path);
}

/** True for member login, register, or the configured admin login page. */
export function isAuthPage(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (path === MEMBER_LOGIN_PATH || path === REGISTER_PATH) return true;
  return path === getAdminLoginPath();
}

/** Post-logout / session-expired redirect — never expose admin URL to anonymous users. */
export function getLoginPathForRole(role: "admin" | "member" | null): string {
  if (role === "admin") return getAdminLoginPath();
  return MEMBER_LOGIN_PATH;
}

if (import.meta.env.DEV && !isSecureAdminPath(getAdminLoginPath())) {
  // eslint-disable-next-line no-console
  console.warn(
    "[auth] VITE_ADMIN_LOGIN_PATH should include at least 24 random hex characters and avoid /admin/login."
  );
}
