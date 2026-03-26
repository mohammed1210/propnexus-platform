import { defineConfig } from "cypress";

export default defineConfig({
  numTestsKeptInMemory: 0,
  experimentalMemoryManagement: true,
  e2e: {
    baseUrl: "http://127.0.0.1:3000",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: false,
  },
  video: false,
});
