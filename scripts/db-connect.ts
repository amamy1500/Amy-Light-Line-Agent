import { createInterface } from "node:readline/promises";
import pg from "pg";
import { pgSsl } from "@/lib/db/pg";

/**
 * How the database scripts reach a hosted Postgres: DATABASE_URL if set,
 * otherwise a hidden prompt, so the password never shows on screen or lands
 * in the shell's history.
 */

/** Prompts without echoing what is typed or pasted. */
async function askHidden(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = () => {};
  const answer = await rl.question("");
  rl.close();
  process.stdout.write("\n");
  return answer.trim();
}

/** Why a pasted connection string can't work, in words; never repeats the string itself. */
export function connectionProblem(url: string): string | null {
  if (!/^postgres(ql)?:\/\//.test(url)) return "It should start with postgresql://";
  if (/\[|\]|YOUR-PASSWORD/i.test(url)) return "It still has [YOUR-PASSWORD] (or a bracket) in it: put the real password there, with no brackets.";
  if (/\s/.test(url)) return "It has a space in it; copy it again as one line.";
  // The direct host is IPv6-only; Render (and many networks) reach Supabase over IPv4.
  if (/@db\.[a-z0-9]+\.supabase\.co[:/]/.test(url)) return "That's the direct connection. Copy the Session pooler one instead (Connect → Session pooler).";
  return null;
}

/** The connection string, or exits with a plain-words reason it can't work. */
export async function connectionUrl(): Promise<string> {
  const url =
    process.env.DATABASE_URL?.trim() || (await askHidden("Paste the Supabase connection string (it stays hidden), then press Enter: "));
  const problem = connectionProblem(url);
  if (problem) {
    console.error(`That connection string won't work. ${problem}`);
    process.exit(1);
  }
  return url;
}

/** A small pool; anything leaving this computer is encrypted, a local database needs no TLS. */
export function openPool(url: string): pg.Pool {
  return new pg.Pool({ connectionString: url, max: 2, ssl: pgSsl(url) });
}
