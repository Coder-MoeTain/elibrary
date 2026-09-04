import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { TimezoneProvider } from "./context/TimezoneContext";
import AppRoutes from "./routes/AppRoutes";

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TimezoneProvider>
        <AppRoutes />
      </TimezoneProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
