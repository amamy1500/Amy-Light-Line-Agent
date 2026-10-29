import { twimlRoute } from "@/lib/server/route";
import { handleDialResult } from "@/lib/server/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = twimlRoute(handleDialResult);
