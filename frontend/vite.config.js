import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "csp-dev-connect-origins",
      transformIndexHtml(html) {
        const developmentOrigins = mode === "development"
          ? "http://localhost:8000 ws://localhost:5173"
          : "";
        return html.replace("__CSP_DEV_CONNECT_ORIGINS__", developmentOrigins);
      },
    },
  ],
}))
