import { jwtDecode } from "jwt-decode";

export type StoredRole = "admin" | "member";

/** Admin panel tier from JWT (`adminRole`). Members have no tier. */
export type AdminTier = "SUPER_ADMIN" | "ADMIN";

export const SUPER_ADMIN_ONLY_TOOLTIP = "Only Super Admin can perform this action.";

type TokenPayload = {
  userId?: number;
  sub?: number;
  role?: StoredRole | "user";
  adminRole?: AdminTier;
  exp?: number;
};

function isExpired(exp?: number): boolean {
  if (!exp) return false;
  return Date.now() >= exp * 1000;
}

export function getUserFromToken(): TokenPayload | null {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = jwtDecode<TokenPayload>(token);
    if (isExpired(payload.exp)) {
      localStorage.removeItem("token");
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getRole(): StoredRole | null {
  const role = getUserFromToken()?.role;
  if (role === "admin") return "admin";
  if (role === "member" || role === "user") return "member";
  return null;
}

export function isAdmin(): boolean {
  return getRole() === "admin";
}

export function isMember(): boolean {
  return getRole() === "member";
}

export function getAdminTier(): AdminTier | null {
  if (getRole() !== "admin") return null;
  const ar = getUserFromToken()?.adminRole;
  if (ar === "SUPER_ADMIN" || ar === "ADMIN") return ar;
  return null;
}

export function isSuperAdmin(): boolean {
  return getAdminTier() === "SUPER_ADMIN";
}

