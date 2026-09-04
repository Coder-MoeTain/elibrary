import { motion } from "framer-motion";
import { Building2, Lock, Mail, User } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import DatePicker from "../../components/ui/DatePicker";
import Input from "../../components/ui/Input";
import {
  DepartmentOption,
  fetchDepartmentsForRegister,
  getApiErrorMessage,
  registerUser
} from "../../services/api";
import AuthBanner from "./AuthBanner";

const LOGO_SRC = "/App%20Logo.png";

const selectClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white";

const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const Register = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDepts(true);
      try {
        const list = await fetchDepartmentsForRegister();
        if (!cancelled) setDepartments(list);
      } finally {
        if (!cancelled) setLoadingDepts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!userName.trim()) next.user_name = "User name is required";
    if (!email.trim()) next.email = "Email is required";
    else if (!emailValid(email)) next.email = "Enter a valid email";
    if (!password) next.password = "Password is required";
    else if (password.length < 8) next.password = "Password must be at least 8 characters";
    if (!departmentId) next.department_id = "Please select a department";
    else {
      const n = Number.parseInt(departmentId, 10);
      if (!Number.isInteger(n) || n < 1) next.department_id = "Please select a valid department";
    }
    if (!dateOfBirth) next.date_of_birth = "Date of birth is required";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!validate()) return;

    setSubmitting(true);
    try {
      const numericDeptId = Number.parseInt(departmentId, 10);
      const formData = {
        user_name: userName.trim(),
        email: email.trim(),
        password,
        date_of_birth: dateOfBirth,
        department_id: numericDeptId
      };
      const res = await registerUser(formData);
      const flashMessage =
        typeof res.message === "string" && res.message.trim()
          ? res.message
          : "📩 Please wait for admin approval. You will receive a confirmation email once approved.";
      navigate("/login", {
        replace: true,
        state: { flashMessage, memberRegister: true }
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const fe = (key: string) => fieldErrors[key];

  return (
    <div className="flex min-h-screen items-center justify-center bg-appbg px-4 py-12 dark:bg-slate-950">
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Member registration</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Create your library account — pending admin approval.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900 sm:p-8">
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
                htmlFor="reg_user_name"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                User Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="reg_user_name"
                  name="user_name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Choose a username"
                  className="pl-10"
                  autoComplete="username"
                />
              </div>
              {fe("user_name") && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fe("user_name")}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg_email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="reg_email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="pl-10"
                  autoComplete="email"
                />
              </div>
              {fe("email") && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fe("email")}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg_password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="reg_password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="pl-10"
                  autoComplete="new-password"
                />
              </div>
              {fe("password") && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fe("password")}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="date_of_birth"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Date of birth
              </label>
              <DatePicker value={dateOfBirth} onChange={setDateOfBirth} placeholder="Select date of birth" />
              {fe("date_of_birth") && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fe("date_of_birth")}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="department_id"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Department
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  id="department_id"
                  name="department_id"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className={`${selectClassName} appearance-none pl-10 pr-10`}
                  disabled={loadingDepts}
                >
                  <option value="">
                    {loadingDepts
                      ? "Loading departments…"
                      : departments.length === 0
                        ? "No departments available"
                        : "Select department"}
                  </option>
                  {departments.map((d) => (
                    <option key={d.department_id} value={d.department_id}>
                      {d.department_name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                  ▾
                </span>
              </div>
              {fe("department_id") && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fe("department_id")}</p>
              )}
            </div>

            <Button type="submit" className="mt-2 w-full py-2.5" disabled={submitting}>
              {submitting ? "Submitting…" : "Register"}
            </Button>
          </motion.form>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
