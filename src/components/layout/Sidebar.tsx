import { motion } from "framer-motion";
import {
  BookMarked,
  BookOpen,
  Building2,
  ClipboardList,
  FolderTree,
  Heart,
  House,
  LayoutDashboard,
  PenLine,
  Settings,
  Shield,
  Users
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { isSuperAdmin } from "../../utils/auth";

const nav = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/books", label: "Books", icon: BookOpen },
  { to: "/admin/ebooks", label: "e-Books", icon: BookMarked },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/authors", label: "Author", icon: PenLine },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/departments", label: "Department", icon: Building2 },
  { to: "/admin/rent", label: "Rent List", icon: ClipboardList },
  { to: "/admin/settings", label: "Settings", icon: Settings }
];

const memberNav = [
  { to: "/member/home", label: "Home", icon: House },
  { to: "/member/books", label: "Books", icon: BookOpen },
  { to: "/member/ebooks", label: "e-Books", icon: BookMarked },
  { to: "/member/favorites", label: "My Favorites", icon: Heart },
  { to: "/member/settings", label: "Settings", icon: Settings }
];

type SidebarProps = {
  collapsed: boolean;
};

const Sidebar = ({ collapsed }: SidebarProps) => {
  const location = useLocation();
  const isMemberPanel = location.pathname.startsWith("/member");
  const adminNav = isSuperAdmin()
    ? [...nav, { to: "/admin/admins", label: "Admin Management", icon: Shield }]
    : nav;
  const navItems = isMemberPanel ? memberNav : adminNav;
  const panelTitle = isMemberPanel ? "Member Panel" : "Admin Panel";
  const sidebarIconSrc = isMemberPanel ? "/sidebar_member_icon.png" : "/sidebar-admin-icon.png";

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="relative z-10 flex min-h-0 shrink-0 flex-col self-stretch border-r border-slate-200/90 bg-white py-6 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-8 flex items-center gap-3 px-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-md dark:border-slate-600">
          <img
            src={sidebarIconSrc}
            alt=""
            className="h-8 w-8 object-contain"
            aria-hidden
          />
        </div>
        {!collapsed && (
          <motion.div initial={false} animate={{ opacity: 1 }} className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800 dark:text-white">{panelTitle}</p>
          </motion.div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              [
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-active text-slate-800 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-100"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              ].join(" ")
            }
          >
            <Icon className="h-5 w-5 shrink-0 text-primary dark:text-blue-300" aria-hidden />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </motion.aside>
  );
};

export default Sidebar;
