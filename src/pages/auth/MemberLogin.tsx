import LoginPage from "./LoginPage";

/** Public member login at `/login` — no admin entry point. */
const MemberLogin = () => <LoginPage role="member" showRegisterLink />;

export default MemberLogin;
