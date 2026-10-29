import { twimlRoute } from "@/lib/server/route";
import { handleScreen } from "@/lib/server/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = twimlRoute(handleScreen);
