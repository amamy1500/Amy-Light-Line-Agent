import { afterEach, describe, expect, it, vi } from "vitest";
import { pgSsl } from "@/lib/db/pg";
import { readEnv } from "@/lib/server/env";
import { startJobSweep } from "@/lib/server/job-sweep";
import { connectionProblem } from "@/scripts/db-connect";

describe("hosting on Render", () => {
  afterEach(() => vi.useRealTimers());

  it("sweeps on its timer and never runs two sweeps at once", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    let runs = 0;
    const stop = startJobSweep(60, () => {
      runs += 1;
      return new Promise<void>((r) => (release = r));
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runs).toBe(1);
    await vi.advanceTimersByTimeAsync(120_000); // still running: skipped
    expect(runs).toBe(1);
    release();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runs).toBe(2);
    stop();
  });

  it("keeps sweeping after a sweep fails", async () => {
    vi.useFakeTimers();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let runs = 0;
    const stop = startJobSweep(60, async () => {
      runs += 1;
      throw new Error("database busy");
    });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(runs).toBe(2);
    expect(errors).toHaveBeenCalledWith("job sweep failed: database busy");
    stop();
    errors.mockRestore();
  });

  it("takes its public URL from Render when PUBLIC_BASE_URL is unset", () => {
    expect(readEnv({ NODE_ENV: "production", RENDER_EXTERNAL_URL: "https://lightline-x.onrender.com" }).publicBaseUrl).toBe(
      "https://lightline-x.onrender.com",
    );
    expect(readEnv({ NODE_ENV: "production", PUBLIC_BASE_URL: "https://calls.example.com", RENDER_EXTERNAL_URL: "https://x.onrender.com" }).publicBaseUrl).toBe(
      "https://calls.example.com",
    );
    expect(() => readEnv({ NODE_ENV: "production" })).toThrow(/PUBLIC_BASE_URL/);
  });

  it("encrypts the link to Supabase, and asks for the pooler string Render can reach", () => {
    expect(pgSsl("postgresql://postgres.ref:pw@aws-0-us-east-2.pooler.supabase.com:5432/postgres")).toEqual({ rejectUnauthorized: false });
    expect(pgSsl("postgres://postgres@127.0.0.1:54331/postgres")).toBeUndefined();
    expect(connectionProblem("postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres")).toMatch(/Session pooler/);
    expect(connectionProblem("postgresql://postgres.ref:pw@aws-0-us-east-2.pooler.supabase.com:5432/postgres")).toBeNull();
  });
});
