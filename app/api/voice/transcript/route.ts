import { callbackRoute } from "@/lib/server/route";
import { handleTranscript } from "@/lib/server/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = callbackRoute(handleTranscript);
