import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function fontPreloadPlugin() {
  return {
    name: "font-preload",
    enforce: "post",
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      const fontFile = Object.keys(ctx.bundle).find(
        (f) => f.includes("inter-latin-wght-normal") && f.endsWith(".woff2")
      );
      if (!fontFile) return html;
      return html.replace(
        "</head>",
        `  <link rel="preload" as="font" type="font/woff2" crossorigin href="/${fontFile}">\n  </head>`
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), fontPreloadPlugin()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/__tests__/**", "src/main.jsx"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react:  ["react", "react-dom"],
          router: ["react-router-dom"],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": "http://192.168.1.68:8080", //backend port
    },
  },
});
