   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";

   export default defineConfig({
     plugins: [react()],
     base: "/control-diario/", // el nombre de tu repo, entre barras
   });