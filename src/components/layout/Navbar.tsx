import { Bell, Clock, LogOut, Menu, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import { getLoginPathForRole } from "../../config/authPaths";
import { useAuth } from "../../context/AuthContext";
import { useTimezone } from "../../context/TimezoneContext";
import { getUsers } from "../../services/api";
import { getAdminTier } from "../../utils/auth";

type NavbarProps = {
  onToggleSidebar: () => void;
};

const PENDING_POLL_MS = 30_000;
const SEEN_PENDING_KEY = "admin_seen_pending_user_ids";

function readSeenPendingIds(): Set<number> {
  try {
    const raw = localStorage.getItem(SEEN_PENDING_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    );
  } catch {
    return new Set();
  }
}

function writeSeenPendingIds(ids: Iterable<number>) {
  localStorage.setItem(SEEN_PENDING_KEY, JSON.stringify([...ids]));
}

const Navbar = ({ onToggleSidebar }: NavbarProps) => {
  const { darkMode, toggleTheme, logout, role } = useAuth();
  const { timezone, offset, formatClock } = useTimezone();
  const navigate = useNavigate();
  const location = useLocation();
  const isMemberPanel = location.pathname.startsWith("/member");
  const isAdminPanel = role === "admin" && !isMemberPanel;
  const adminTier = role === "admin" ? getAdminTier() : null;
  const [clock, setClock] = useState(() => formatClock());
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const tick = window.setInterval(() => setClock(formatClock()), 1000);
    return () => window.clearInterval(tick);
  }, [formatClock]);

  const refreshPendingCount = useCallback(async () => {
    if (!isAdminPanel) {
      setPendingIds([]);
      setUnreadCount(0);
      return;
    }
    try {
      const rows = await getUsers(false);
      const ids = rows
        .filter(
          (u) => String(u.status || "").toUpperCase() === "PENDING" && !u.isDeleted,
        )
        .map((u) => u.usersId);
      const seen = readSeenPendingIds();
      // Drop seen ids that are no longer pending (approved/rejected).
      const stillRelevant = new Set(ids.filter((id) => seen.has(id)));
      if (stillRelevant.size !== seen.size) {
        writeSeenPendingIds(stillRelevant);
      }
      const unread = ids.filter((id) => !stillRelevant.has(id)).length;
      setPendingIds(ids);
      setUnreadCount(unread);
    } catch {
      // Keep last known count; avoid noisy toasts in the header.
    }
  }, [isAdminPanel]);

  useEffect(() => {
    if (!isAdminPanel) return;
    void refreshPendingCount();
    const poll = window.setInterval(() => void refreshPendingCount(), PENDING_POLL_MS);
    const onFocus = () => void refreshPendingCount();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [isAdminPanel, refreshPendingCount, location.pathname]);

  const handleLogout = () => {
    const loginPath = getLoginPathForRole(role);
    logout();
    navigate(loginPath, { replace: true });
  };

  const handlePendingNotifications = () => {
    // Mark current pending requests as read so the badge clears.
    writeSeenPendingIds(pendingIds);
    setUnreadCount(0);
    navigate("/admin/users?status=PENDING");
  };

  return (
    <header className="z-30 flex w-full shrink-0 items-center gap-4 border-b border-white/15 bg-[#333399] px-4 py-3 sm:gap-6 sm:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-white shadow-md sm:h-14 sm:w-14">
          <img src="/App%20Logo.png" alt="MSA Library" className="h-full w-full object-contain p-1" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight text-white sm:text-xl lg:text-2xl">
            Myanmar Space Agency Library
          </h1>
          {!isMemberPanel && (
            <p className="hidden items-center gap-2 text-xs text-white/75 sm:flex">
              <span>Admin dashboard</span>
              {adminTier === "SUPER_ADMIN" && (
                <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Super Admin
                </span>
              )}
              {adminTier === "ADMIN" && (
                <span className="rounded-full bg-sky-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Admin
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="hidden min-w-[9.5rem] items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-white md:flex"
          title={`${timezone} ${offset}`}
        >
          <Clock className="h-4 w-4 shrink-0 text-white/80" aria-hidden />
          <div className="min-w-0">
            <p className="truncate font-mono text-xs font-semibold leading-tight">{clock}</p>
            <p className="truncate text-[10px] text-white/70">{timezone.replace(/_/g, " ")}</p>
          </div>
        </div>

        {isAdminPanel && (
          <button
            type="button"
            onClick={handlePendingNotifications}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label={
              unreadCount > 0
                ? `${unreadCount} unread pending request${unreadCount === 1 ? "" : "s"}`
                : "Pending user requests"
            }
            title="Pending user requests"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 text-amber-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div
        className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-sm font-bold text-white shadow-md sm:flex"
        title="Profile"
      >
        {isMemberPanel ? "M" : "A"}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 text-white transition hover:bg-white/10 sm:hidden"
        aria-label="Logout"
      >
        <LogOut className="h-5 w-5" />
      </button>

      <Button
        type="button"
        variant="secondary"
        className="hidden border-white/25 bg-white/15 text-white hover:bg-white/25 hover:text-white sm:inline-flex dark:border-white/25 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4" />
        Logout
      </Button>
    </header>
  );
};

export default Navbar;
