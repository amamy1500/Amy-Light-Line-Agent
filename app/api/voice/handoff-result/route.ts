import { twimlRoute } from "@/lib/server/route";
import { handleHandoffResult } from "@/lib/server/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = twimlRoute(handleHandoffResult);
