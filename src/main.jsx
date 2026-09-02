import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import { DataProvider } from "./DataContext.jsx";
import { MediaProvider } from "./MediaContext.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <DataProvider>
        <MediaProvider>
          <App />
        </MediaProvider>
      </DataProvider>
    </AuthProvider>
  </React.StrictMode>
);
