import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "Voyager — Product Journey Extractor",
    description:
      "Turn manual product exploration into structured Markdown context for competitor analysis, PRDs, and LLM workflows.",
    version: "0.1.0",
    permissions: ["sidePanel", "activeTab", "tabs", "storage", "scripting"],
    side_panel: {
      default_path: "sidepanel.html",
    },
    action: {
      default_title: "Open Voyager",
    },
  },
  webExt: {
    startUrls: ["https://example.com"],
  },
});
