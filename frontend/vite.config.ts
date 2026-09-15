import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Vite + TanStack Start config, assembled explicitly. Plugin order matters:
// tailwind and tsconfig-paths first, then tanstackStart, then the React plugin,
// with nitro added only for production builds.
export default defineConfig(({ command, mode }) => {
  // Mirror VITE_* vars into import.meta.env for the SSR/server bundle too, not
  // just the client (Vite only injects them client-side by default).
  const env = loadEnv(mode, "..", "VITE_");
  const envDefine = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  return {
    envDir: "..",
    define: envDefine,
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    server: {
      // true (not "::") so the dev server binds 0.0.0.0 — required for the
      // Vite server to be reachable from outside its own container when run
      // via Docker Compose (see /frontend/Dockerfile + root docker-compose.yml).
      host: true,
      port: 8080,
      proxy: {
        // Everything goes through the API Gateway (architecture §5.1), which is
        // the only component that verifies JWTs and the only port that needs to
        // be exposed. Point these at a service directly and you bypass both the
        // token check and the identity headers it injects.
        //
        // GATEWAY_INTERNAL_URL overrides the target for Docker Compose, where
        // "localhost" would resolve to the frontend container itself rather
        // than the gateway container — compose sets it to http://gateway:8000.
        // Local (non-Docker) `bun run dev` has no such variable and keeps the
        // plain localhost default.
        "/api/v1": {
          target: process.env.GATEWAY_INTERNAL_URL || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        // nitro/vite builds from this.
        server: { entry: "server" },
      }),
      viteReact(),
      // Nitro produces the deployable server build; it only runs at build time.
      ...(command === "build" ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
    ],
  };
});
