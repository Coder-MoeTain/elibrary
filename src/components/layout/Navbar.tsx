import { LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { getLoginPathForRole } from "../../config/authPaths";
import { useAuth } from "../../context/AuthContext";
import { getAdminTier } from "../../utils/auth";

type NavbarProps = {
  onToggleSidebar: () => void;
};

const Navbar = ({ onToggleSidebar }: NavbarProps) => {
  const { darkMode, toggleTheme, logout, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMemberPanel = location.pathname.startsWith("/member");
  const adminTier = role === "admin" ? getAdminTier() : null;

  const handleLogout = () => {
    const loginPath = getLoginPathForRole(role);
    logout();
    navigate(loginPath, { replace: true });
  };

  return (
    <header className="z-30 flex w-full shrink-0 items-center gap-8 border-b border-white/15 bg-[#333399] px-8 py-6 backdrop-blur-md dark:border-white/15 dark:bg-[#333399]">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 text-white transition hover:bg-white/10"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-white shadow-md">
          <img
            src="/App%20Logo.png"
            alt="MSA Library"
            className="h-full w-full object-contain p-1"
          />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[2rem] font-bold leading-tight text-white sm:text-[2.25rem]">
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

      {/* <div className="hidden max-w-md flex-1 md:block">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
          <Input
            type="search"
            placeholder="Search..."
            className="!border-white/25 !bg-white/10 pl-10 !text-white placeholder:!text-white/50 focus:!border-white/40 dark:!border-white/25 dark:!bg-white/10 dark:!text-white dark:placeholder:!text-white/50"
            aria-label="Global search"
          />
        </div>
      </div> */}

      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 text-amber-200 transition hover:bg-white/10"
        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div
        className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-sm font-bold text-white shadow-md sm:flex"
        title="Profile"
      >
        A
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
