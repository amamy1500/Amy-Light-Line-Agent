import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, operatorCookieValue, tokenMatches } from "@/lib/server/auth";
import { readEnv } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const env = readEnv();
  const form = await req.formData();
  const token = form.get("token");
  const inbox = new URL("/dashboard", env.publicBaseUrl);

  if (typeof token !== "string" || !tokenMatches(token) || !env.operatorToken) {
    const login = new URL("/login", env.publicBaseUrl);
    login.searchParams.set("error", "That access code did not match.");
    return NextResponse.redirect(login, 303);
  }

  const response = NextResponse.redirect(inbox, 303);
  response.cookies.set(OPERATOR_COOKIE, operatorCookieValue(env.operatorToken), {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
