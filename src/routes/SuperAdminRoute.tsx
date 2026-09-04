import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isSuperAdmin } from "../utils/auth";

/**
 * Wraps a route element so only JWT `adminRole === SUPER_ADMIN` can access.
 */
export default function SuperAdminRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!isSuperAdmin()) {
    return <Navigate to="/admin/dashboard" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
