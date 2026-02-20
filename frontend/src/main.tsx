import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";

// Initialise Sentry before anything else renders
// No-ops if VITE_SENTRY_DSN is not set in .env
initSentry();

createRoot(document.getElementById("root")!).render(<App />);

