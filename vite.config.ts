import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { createServer } from "./server";

// Simplified Vite config to avoid esbuild issues
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: ["./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
    hmr: {
      overlay: false,
      port: 24679, // Use different port to avoid conflicts
    },
  },
  build: {
    outDir: "dist/spa",
    target: "es2020", // More compatible target
    sourcemap: false, // Disable sourcemaps to reduce issues
    minify: false, // Disable minification for debugging
  },
  plugins: [
    react({
      include: "**/*.{jsx,tsx}",
    }),
    expressPlugin()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  define: {
    __DEV__: mode === "development",
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
    exclude: [], // Don't exclude any dependencies
    force: true, // Force re-optimization
  },
  esbuild: {
    target: "es2020",
    logOverride: { 
      'this-is-undefined-in-esm': 'silent' 
    }
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve",
    configureServer(server) {
      const app = createServer();
      server.middlewares.use(app);
    },
  };
}
