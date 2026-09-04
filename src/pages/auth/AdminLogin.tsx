import LoginPage from "./LoginPage";

/** Admin login — only reachable via `VITE_ADMIN_LOGIN_PATH`. */
const AdminLogin = () => <LoginPage role="admin" />;

export default AdminLogin;
