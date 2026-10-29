/**
 * Writes the ElevenLabs tool and agent requests for tenant #1 to agent/christmas-light-guys.json
 * for review. scripts/live/setup.ts sends the same requests to the API.
 * Usage: npx tsx scripts/export-agent.ts [publicBaseUrl]
 */
import { writeFileSync } from "node:fs";
import { christmasLightGuysConfig } from "@/lib/business-rules/tenants/christmas-light-guys";
import { buildAgentRequest, buildToolRequests } from "@/lib/elevenlabs/agent-spec";

const options = {
  publicBaseUrl: process.argv[2] ?? process.env.PUBLIC_BASE_URL ?? "https://lightline.example.com",
  toolSecretId: process.env.ELEVENLABS_TOOL_SECRET_ID ?? "REPLACE_WITH_WORKSPACE_SECRET_ID",
  voiceId: process.env.ELEVENLABS_VOICE_ID ?? "REPLACE_WITH_APPROVED_STOCK_VOICE_ID",
  llm: "claude-haiku-5-5" as const,
};
const tools = buildToolRequests(options);
const agent = buildAgentRequest(christmasLightGuysConfig({ aiMode: "after_hours_only" }), options, tools.map((t) => `<id of ${t.name}>`));
writeFileSync("agent/christmas-light-guys.json", `${JSON.stringify({ tools, agent }, null, 2)}\n`);
console.log(`wrote agent/christmas-light-guys.json (${tools.length} tools)`);
