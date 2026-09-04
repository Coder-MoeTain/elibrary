import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AdminLayout from "../components/layout/AdminLayout";
import { getAdminLoginPath, MEMBER_LOGIN_PATH } from "../config/authPaths";
import AdminLogin from "../pages/auth/AdminLogin";
import MemberLogin from "../pages/auth/MemberLogin";
import Register from "../pages/auth/Register";
import { getRole } from "../utils/auth";
import Authors from "../pages/authors/Authors";
import BookDetail from "../pages/books/BookDetail";
import Books from "../pages/books/Books";
import Categories from "../pages/categories/Categories";
import Dashboard from "../pages/dashboard/Dashboard";
import Departments from "../pages/departments/Departments";
import AdminManagement from "../pages/admin/AdminManagement";
import Ebooks from "../pages/ebooks/Ebooks";
import MemberBooks from "../pages/member/Books";
import MemberBookDetail from "../pages/member/BookDetail";
import MemberEbookDetail from "../pages/member/EbookDetail";
import MemberEbooks from "../pages/member/Ebooks";
import MemberFavorites from "../pages/member/Favorites";
import MemberHome from "../pages/member/Home";
import MemberSettings from "../pages/member/Settings";
import RentList from "../pages/rent/RentList";
import Settings from "../pages/settings/Settings";
import Users from "../pages/users/Users";
import SuperAdminRoute from "./SuperAdminRoute";

const ProtectedRoute = ({ role }: { role?: "admin" | "member" }) => {
  const location = useLocation();
  const currentRole = getRole();
  if (!currentRole) {
    return <Navigate to={MEMBER_LOGIN_PATH} replace state={{ from: location.pathname }} />;
  }
  if (role && currentRole !== role) {
    return <Navigate to={MEMBER_LOGIN_PATH} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
};

const RootRedirect = () => {
  const role = getRole();
  if (!role) {
    return <Navigate to={MEMBER_LOGIN_PATH} replace />;
  }
  return <Navigate to={role === "admin" ? "/admin/dashboard" : "/member/home"} replace />;
};

const AppRoutes = () => {
  const adminLoginPath = getAdminLoginPath();

  return (
  <Routes>
    <Route path="/" element={<RootRedirect />} />
    <Route path={MEMBER_LOGIN_PATH} element={<MemberLogin />} />
    <Route path={adminLoginPath} element={<AdminLogin />} />
    <Route path="/register" element={<Register />} />

    <Route path="/admin" element={<ProtectedRoute role="admin" />}>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="books" element={<Books />} />
        <Route path="books/:id" element={<BookDetail />} />
        <Route path="ebooks" element={<Ebooks />} />
        <Route path="ebooks/:id" element={<MemberEbookDetail />} />
        <Route path="categories" element={<Categories />} />
        <Route path="authors" element={<Authors />} />
        <Route path="users" element={<Users />} />
        <Route path="departments" element={<Departments />} />
        <Route path="rent" element={<RentList />} />
        <Route path="settings" element={<Settings />} />
        <Route
          path="admins"
          element={
            <SuperAdminRoute>
              <AdminManagement />
            </SuperAdminRoute>
          }
        />
      </Route>
    </Route>

    <Route path="/member" element={<ProtectedRoute role="member" />}>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<MemberHome />} />
        <Route path="books" element={<MemberBooks />} />
        <Route path="books/:id" element={<MemberBookDetail />} />
        <Route path="ebooks" element={<MemberEbooks />} />
        <Route path="ebooks/:id" element={<MemberEbookDetail />} />
        <Route path="favorites" element={<MemberFavorites />} />
        <Route path="settings" element={<MemberSettings />} />
      </Route>
    </Route>

    <Route path="*" element={<RootRedirect />} />
  </Routes>
  );
};

export default AppRoutes;
