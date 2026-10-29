# Third-party code and patterns

Every outside dependency was checked for a license that allows commercial reuse.
Nothing proprietary, unlicensed, AGPL or source-available was copied
(docs/research/repo-research.md has the full audit).

## Dependencies (used as packages, unmodified)

| Package | License | Used for |
| --- | --- | --- |
| [twilio](https://github.com/twilio/twilio-node) 6.2.0 | MIT | TwiML builders, webhook signature validation, call redirect, alert SMS |
| [next](https://github.com/vercel/next.js) 16.4.2 | MIT | Web app, route handlers |
| [react](https://github.com/facebook/react) / react-dom 19.3.1 | MIT | Console UI (server components) |
| [zod](https://github.com/colinhacks/zod) 4.6.7 | MIT | Validation at every boundary; tool JSON schemas |
| [pg](https://github.com/brianc/node-postgres) 8.23.1 | MIT | Production Postgres (Supabase) |
| [@electric-sql/pglite](https://github.com/electric-sql/pglite) 0.5.10 | Apache-2.0 | Embedded Postgres for development and tests |
| [vitest](https://github.com/vitest-dev/vitest) 5.0.5 | MIT | Tests |
| [fast-check](https://github.com/dubzzz/fast-check) 4.10.2 | MIT | Property tests |
| [tsx](https://github.com/privatenumber/tsx) 4.23.15 | MIT | Scripts |
| [typescript](https://github.com/microsoft/TypeScript) 5.9.3 | Apache-2.0 | Type checking (7.x not adopted until Next.js supports it) |

## Patterns studied (re-implemented, no code copied)

| Source | License | What we took | What we changed |
| --- | --- | --- | --- |
| [elevenlabs/elevenlabs-js](https://github.com/elevenlabs/elevenlabs-js) `wrapper/webhooks.ts` | MIT | Signature format `t=…,v0=HMAC(t.body)` | Constant-time compare; fail closed on missing secret; reject future/old stamps |
| [7XLabs/Aiva](https://github.com/7XLabs/Aiva) `lib/agent/tools.ts` | MIT | Tool descriptions that say when to call; server-side re-validation | Strict schemas, call SID injected by platform, idempotency, audit; its signature check fails open and its JSON-file DB were not copied |
| [twilio-labs/function-templates](https://github.com/twilio-labs/function-templates) | MIT | Hunt/voicemail flow shape | Decide on `DialBridged`, not `DialCallStatus` |

## Reviewed and rejected

morluto/rea (reverse-engineering MCP server, no voice code, IP risk); AGPL receptionists
(kirklandsig/AIReceptionist, DeskRoute); "all rights reserved" callbackcloser;
LangChain/LangGraph (no role in v1, ADR 0004); Pipecat dev runner (no Twilio signature check).
