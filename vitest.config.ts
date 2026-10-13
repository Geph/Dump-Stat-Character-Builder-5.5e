import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    // Physical artwork integration belongs to the visual consumer. Rules tests remain shared.
    exclude: ["lib/__tests__/sheet-banners.test.ts", "lib/compendium/__tests__/background-card-images-defaults.test.ts", "lib/compendium/__tests__/card-image-gating.test.ts", "lib/compendium/__tests__/class-card-images-defaults.test.ts", "lib/compendium/__tests__/custom-ability-art.test.ts", "lib/compendium/__tests__/species-card-images-defaults.test.ts", "lib/compendium/__tests__/spell-card-images-defaults.test.ts", "lib/compendium/__tests__/subclass-card-images-defaults.test.ts", "lib/import/__tests__/import-card-art.test.ts"],
  },
  resolve: {
    // Prefer TypeScript sources over sibling .mjs copies used by Node scripts.
    extensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"],
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
