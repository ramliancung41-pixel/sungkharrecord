import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import CarelnakSite from "./CarelnakSite.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import { DataProvider } from "./DataContext.jsx";
import { MediaProvider } from "./MediaContext.jsx";
import { ArticlesProvider } from "./ArticlesContext.jsx";
import "./styles.css";

const oldArticleLink = window.location.hash.match(/^#carelnak(?:\/([\w-]+))?$/);
if (oldArticleLink) {
  window.location.replace(oldArticleLink[1] ? `/carelnak/${oldArticleLink[1]}` : "/carelnak");
}

const onCarelnak = /^\/carelnak(\/|$)/.test(window.location.pathname);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      {onCarelnak ? (
        <ArticlesProvider>
          <CarelnakSite />
        </ArticlesProvider>
      ) : (
        <DataProvider>
          <MediaProvider>
            <App />
          </MediaProvider>
        </DataProvider>
      )}
    </AuthProvider>
  </React.StrictMode>
);
