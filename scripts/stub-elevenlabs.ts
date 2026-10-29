/**
 * Local stand-in for ElevenLabs' register-call endpoint, for load tests only.
 * Returns <Connect><Stream> TwiML after a configurable delay (default 150 ms).
 *   STUB_PORT=3199 STUB_DELAY_MS=150 npx tsx scripts/stub-elevenlabs.ts
 */
import { createServer } from "node:http";

const port = Number(process.env.STUB_PORT ?? 3199);
const delay = Number(process.env.STUB_DELAY_MS ?? 150);
let served = 0;
createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/v1/convai/twilio/register-call" || !req.headers["xi-api-key"]) {
    res.writeHead(404).end();
    return;
  }
  req.resume();
  req.on("end", () => {
    served += 1;
    setTimeout(() => {
      res.writeHead(200, { "content-type": "application/xml" });
      res.end('<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://stub.invalid/agent"/></Connect></Response>');
    }, delay);
  });
}).listen(port, () => console.log(`stub register-call on :${port} (delay ${delay} ms)`));
process.on("SIGINT", () => {
  console.log(`served ${served}`);
  process.exit(0);
});
