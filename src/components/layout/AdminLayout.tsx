import { Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

/**
 * Plain outlet + key remount per path. Framer AnimatePresence/motion here caused
 * blank main content on first navigation with React 18 Strict Mode + RR6.
 */
const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-appbg dark:bg-slate-950">
      <Navbar onToggleSidebar={() => setCollapsed((c) => !c)} />
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div key={location.pathname} className="min-h-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
