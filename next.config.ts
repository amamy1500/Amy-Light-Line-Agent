import type { NextConfig } from "next";

const config: NextConfig = {
  // Native/WASM and CommonJS server libraries stay out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "twilio"],
  poweredByHeader: false,
};

export default config;
