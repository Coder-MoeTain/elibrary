import { motion } from "framer-motion";
import { Lock, Moon, Sun, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useAuth, AuthRole } from "../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { getApiErrorMessage, loginAdmin, loginUser } from "../../services/api";
import { getRole } from "../../utils/auth";
import AuthBanner from "./AuthBanner";

const LOGO_SRC = "/App%20Logo.png";

const inputClass =
  "border-gray-300 bg-white pl-10 text-gray-800 transition-colors duration-300 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400";

type LoginPageProps = {
  role: AuthRole;
  showRegisterLink?: boolean;
};

const LoginPage = ({ role, showRegisterLink = false }: LoginPageProps) => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as { flashMessage?: string } | null;
    const msg = state?.flashMessage;
    if (msg) {
      setFlash(msg);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const trimmed = userName.trim();
      if (role === "admin") {
        const res = await loginAdmin(trimmed, password);
        const token = res.data?.token;
        if (token) localStorage.setItem("token", token);
      } else {
        const res = await loginUser(trimmed, password);
        const token = res.data?.token;
        if (token) localStorage.setItem("token", token);
      }
      login();
      const resolvedRole = getRole();
      if (resolvedRole === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else if (resolvedRole === "member") {
        navigate("/member/home", { replace: true });
      } else {
        throw new Error("Invalid auth token role");
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#F5F1E8] px-4 py-12 transition-colors duration-300 dark:bg-gray-900">
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed right-4 top-4 z-[100] flex h-11 w-11 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 shadow-sm transition-colors duration-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-amber-200 dark:hover:bg-gray-600"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <img
              src={LOGO_SRC}
              alt="Library logo"
              className="h-auto max-h-24 w-full max-w-[200px] object-contain sm:max-h-28 sm:max-w-[220px]"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 transition-colors duration-300 dark:text-gray-100">
            Welcome
          </h1>
          <p className="mt-1 text-sm text-gray-600 transition-colors duration-300 dark:text-gray-300">
            Sign in to Myanmar Space Agency Library
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-card transition-colors duration-300 dark:border-gray-600 dark:bg-gray-800 sm:p-8">
          {flash && (
            <AuthBanner
              kind="success"
              message={flash}
              onDismiss={() => setFlash(null)}
            />
          )}
          {error && (
            <AuthBanner kind="error" message={error} onDismiss={() => setError(null)} />
          )}

          <motion.form
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="user_name"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 transition-colors duration-300 dark:text-gray-400"
              >
                User Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-400" />
                <Input
                  id="user_name"
                  name="user_name"
                  type="text"
                  autoComplete="username"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your username"
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 transition-colors duration-300 dark:text-gray-400"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-400" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="mt-2 w-full py-2.5 transition-colors duration-300 hover:bg-[#26408a] dark:hover:brightness-110"
              disabled={submitting}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </motion.form>

          {showRegisterLink && (
            <p className="mt-6 text-center text-sm text-gray-600 transition-colors duration-300 dark:text-gray-300">
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                state={{ memberRegister: true }}
                className="font-semibold text-primary transition-colors duration-300 hover:underline dark:text-blue-300"
              >
                Register
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
