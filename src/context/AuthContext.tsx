import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { readTheme, writeTheme } from "../hooks/useTheme";
import { getRole, isSuperAdmin as checkSuperAdmin } from "../utils/auth";

export type AuthRole = "admin" | "member";

type AuthContextType = {
  isAuthenticated: boolean;
  role: AuthRole;
  /** True when logged in as admin with `SUPER_ADMIN` tier (JWT `adminRole`). */
  isSuperAdmin: boolean;
  darkMode: boolean;
  login: () => void;
  logout: () => void;
  toggleTheme: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem("token");
    const role = getRole();
    return Boolean(token) && Boolean(role);
  });
  const [role, setRole] = useState<AuthRole>(() => getRole() ?? "admin");
  const [darkMode, setDarkMode] = useState(() => readTheme() === "dark");

  useEffect(() => {
    const sync = () => setDarkMode(readTheme() === "dark");
    window.addEventListener("theme-changed", sync);
    return () => window.removeEventListener("theme-changed", sync);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      role,
      isSuperAdmin: checkSuperAdmin(),
      darkMode,
      login: () => {
        const resolvedRole = getRole();
        if (!resolvedRole) {
          setIsAuthenticated(false);
          return;
        }
        setRole(resolvedRole);
        setIsAuthenticated(true);
      },
      logout: () => {
        localStorage.removeItem("token");
        setIsAuthenticated(false);
        setRole("admin");
      },
      toggleTheme: () => {
        const next = readTheme() === "light" ? "dark" : "light";
        writeTheme(next);
      }
    }),
    [isAuthenticated, role, darkMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
