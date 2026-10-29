import { twimlRoute } from "@/lib/server/route";
import { handleInbound } from "@/lib/server/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A fresh call always goes through the spam screen (no third argument).
export const POST = twimlRoute((p, deps) => handleInbound(p, deps));
