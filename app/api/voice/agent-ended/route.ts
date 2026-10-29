import { twimlRoute } from "@/lib/server/route";
import { handleAgentEnded } from "@/lib/server/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = twimlRoute(handleAgentEnded);
