import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initThemeFromStorage } from "./hooks/useTheme";
import "./index.css";

initThemeFromStorage();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
