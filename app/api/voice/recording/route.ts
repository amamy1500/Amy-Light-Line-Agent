import { callbackRoute } from "@/lib/server/route";
import { handleRecording } from "@/lib/server/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = callbackRoute(handleRecording);
