import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mock sharp so @xenova/transformers can load without native sharp binaries.
      // Feature-extraction pipelines don't use image processing.
      sharp: new URL("./test/__mocks__/sharp.js", import.meta.url).pathname,
    },
  },
});
