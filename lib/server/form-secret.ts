import type { AppEnv } from "./env";

/**
 * Secret for signing form render stamps. Production requires FORM_SECRET;
 * development uses a fixed value so local forms work without setup.
 */
export function formSecret(env: AppEnv, source: NodeJS.ProcessEnv = process.env): string {
  const value = source.FORM_SECRET?.trim();
  if (value) return value;
  if (env.isProduction) throw new Error("FORM_SECRET is required in production");
  return "development-only-form-secret";
}
