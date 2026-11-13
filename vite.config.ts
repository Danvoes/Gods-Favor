import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// "base: './'" makes the built game work from any folder or web address,
// so it can be opened from GitHub Pages or a shared drive with no server setup.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
