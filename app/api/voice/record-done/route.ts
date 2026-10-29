import { twimlRoute } from "@/lib/server/route";
import { handleRecordDone } from "@/lib/server/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = twimlRoute(handleRecordDone);
