import { NextResponse } from "next/server";
import { isOperator } from "./auth";
import { readEnv } from "./env";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function field(form: FormData, name: string, max = 200): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** 303 to a path on the public origin, with optional query parameters and hash. */
export function seeOther(path: string, params: Record<string, string> = {}, hash?: string): Response {
  const url = new URL(path, readEnv().publicBaseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (hash) url.hash = hash;
  return NextResponse.redirect(url, 303);
}

/** Returns a 401 response for anyone who is not the signed-in operator, else null. */
export async function operatorOnly(): Promise<Response | null> {
  return (await isOperator()) ? null : new Response("Unauthorized", { status: 401 });
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
