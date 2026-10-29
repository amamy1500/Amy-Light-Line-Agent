import { registerCall, withConnectAction } from "@/lib/elevenlabs/register-call";
import type { DynamicVariables } from "@/lib/elevenlabs/dynamic-variables";

/**
 * Puts a live Twilio call on the voice agent and returns the TwiML for it.
 * The returned TwiML always routes back to `actionUrl` when the agent leg
 * ends, so our server decides what the caller hears next.
 */
export interface AgentConnector {
  provider: "elevenlabs" | "simulator";
  connect(input: {
    agentId: string;
    from: string;
    to: string;
    dynamicVariables: DynamicVariables;
    actionUrl: string;
  }): Promise<string>;
}

/** Production connector: ElevenLabs register-call. */
export function elevenLabsConnector(apiKey: string, timeoutMs = 4000, baseUrl?: string): AgentConnector {
  return {
    provider: "elevenlabs",
    async connect(input) {
      const twiml = await registerCall({
        apiKey,
        agentId: input.agentId,
        from: input.from,
        to: input.to,
        dynamicVariables: input.dynamicVariables,
        timeoutMs,
        ...(baseUrl ? { baseUrl } : {}),
      });
      return withConnectAction(twiml, input.actionUrl);
    },
  };
}

/**
 * Development and test connector. Clearly a simulation: it streams to an
 * address that cannot resolve, and the simulator script plays the agent's
 * part by calling the tool gateway and the agent-ended webhook itself.
 */
export function simulatorConnector(options: { fail?: () => boolean } = {}): AgentConnector {
  return {
    provider: "simulator",
    async connect(input) {
      if (options.fail?.()) throw new Error("simulated vendor failure");
      const vars = Object.entries(input.dynamicVariables)
        .map(([k, v]) => `<Parameter name="${k}" value="${escapeXml(v)}"/>`)
        .join("");
      return withConnectAction(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://agent-simulator.invalid/stream">${vars}</Stream></Connect></Response>`,
        input.actionUrl,
      );
    },
  };
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
