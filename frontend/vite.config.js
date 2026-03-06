import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
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
          motion: ["framer-motion"],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": "http://192.168.1.68:3000", //backend port
    },
  },
});
