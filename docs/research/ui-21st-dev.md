# 21st.dev "agents frontend" style for the Lightline console

As of **2026-10-23**. Sources: 21st.dev pages and their `.md` twins, `21st.dev/llms.txt`, `21st.dev/openapi.json`,
`21st.dev/terms`, the 21st.dev site stylesheet, github.com/21st-dev, ui.shadcn.com docs, tailwindcss.com docs, and the npm registry.

Labels:

- **FACT**: seen today on the linked primary source, or observed directly (a curl response, a CSS file).
- **INFERENCE**: my conclusion. Needs a test or a decision.

---

## 0. Verdict

**Option (b): rebuild the 21st look in our own CSS and React. Add no new dependencies now.** Copy code only from
MIT-licensed sources, and only after reading it. Credit each source in `THIRD_PARTY_NOTICES.md`. Move to option (a)
only if we later want more than about three registry components. Section 6 explains why. INFERENCE.

---

## 1. What 21st.dev is in 2026, and what "Agents" and "Magic" mean now

| Claim | Label |
|---|---|
| 21st.dev is a community marketplace of 12,000+ React + Tailwind components, templates and shadcn themes. Anyone can publish. Template authors can sell templates. | FACT. [21st.dev](https://21st.dev), [llms.txt](https://21st.dev/llms.txt) |
| It has two actions: **Find** (browse and install) and **Generate** (21st AI). Both work on the web, through the 21st MCP and through the `21st` CLI. | FACT. [llms.txt](https://21st.dev/llms.txt) |
| **Magic is a legacy name.** Magic MCP is now the **21st MCP**. `@21st-dev/magic` (npm 0.2.3, 2026-09-09) only proxies old configs. Magic Chat is now **21st AI**, a paid generator billed in credits. Old Magic keys were reset. | FACT. [llms.txt](https://21st.dev/llms.txt), [ai.md](https://21st.dev/ai.md), [npm](https://www.npmjs.com/package/@21st-dev/magic) |
| "Magic UI" is a separate community library by Dillion Verma. It is not a 21st product. | FACT. [llms.txt](https://21st.dev/llms.txt) |
| **21st Agents** is the *21st Agents SDK*: you define an agent in TypeScript, deploy it into a sandbox and embed it. Packages: `@21st-sdk/agent`, `@21st-sdk/react` (React chat UI components), `@21st-sdk/nextjs`, `@21st-sdk/node`, `@21st-sdk/cli`. | FACT. [21st-sdk README](https://github.com/21st-dev/21st-sdk), [npm @21st-sdk/react](https://www.npmjs.com/package/@21st-sdk/react) |
| Today `21st.dev/agents` and `21st.dev/agents/docs` redirect (301) to the home page. `@21st-sdk/react` was last published 2026-03-19 and `@21st-sdk/nextjs` 2026-04-07. The SDK repo now ships the "service code" as open source (last push 2026-06-18). The Terms still have a §5 "Agents Platform". | FACT (curl, npm, GitHub, [terms](https://21st.dev/terms)) |
| The hosted Agents product is no longer promoted. Do not build on `@21st-sdk/*`. | INFERENCE |
| **The surviving "agents frontend" is Agent Elements.** It lives at [agent-elements.21st.dev](https://agent-elements.21st.dev), source in [github.com/21st-dev/agent-elements](https://github.com/21st-dev/agent-elements), MIT, © 2026 21st.dev. It is a shadcn-style registry of 25 agent-UI items: `agent-chat`, `message-list`, `user-message`, `markdown`, `input-bar`, `text-shimmer`, `spiral-loader`, tool cards, `question-tool` and more. It is the UI layer of the Agents SDK but works in any React app. Last push was 2026-04-24. | FACT. [README](https://github.com/21st-dev/agent-elements), [r/index.json](https://agent-elements.21st.dev/r/index.json) |
| The marketplace also has an **AI chats** category (286 items on the home page) and tags such as `ai-chat`, `voice`, `orb` and `activity-feed`. | FACT. [21st.dev](https://21st.dev), [s/ai-chat](https://21st.dev/community/components/s/ai-chat) |
| "21st.dev agents frontend style" most likely means the Agent Elements look plus the AI-chats look: neutral grays, one blue accent, 16 px rounded bubbles, 10 px tool cards, shimmering status text, and a dark-first site chrome. | INFERENCE |

## 2. Installing components without the MCP

**Marketplace components** (`21st.dev/@<user>/components/<slug>`):

```bash
# Exact command from each component's .md page, e.g. https://21st.dev/@shadcn/components/button.md
npx shadcn@latest add "https://21st.dev/r/<user>/<slug>?api_key=$API_KEY_21ST"
# Alternative: 21st's own CLI (needs `21st login` or an API key). --print shows the shadcn command it would run.
npx @21st-dev/cli@latest add <user>/<slug>
```

- FACT: today the registry endpoint returns **403 `authentication_required` without a key** (curl on `https://21st.dev/r/shadcn/button`). The `21st-cli-use` skill still says a stock URL with no key works. The component pages and the live endpoint both show it does not. Sources: [component .md](https://21st.dev/@shadcn/components/button.md), [CLI skill](https://21st.dev/.well-known/skills/21st-cli-use/SKILL.md).
- FACT: you create keys at https://21st.dev/mcp. They look like `21st_sk_…`. The free plan allows **2 retrievals, copies or installs per day**, counted across web, MCP and CLI. Builder ($6/mo yearly) is unlimited. Sources: [auth.md](https://21st.dev/auth.md), [pricing.md](https://21st.dev/pricing.md).
- FACT: 21st is **not** in shadcn's public registry index, so there is no built-in `@21st/...` namespace. Source: [registries.json](https://ui.shadcn.com/r/registries.json).
- INFERENCE (untested): you can define your own namespace in `components.json` and keep the key in `.env.local`, as in shadcn's [auth docs](https://ui.shadcn.com/docs/registry/authentication). Config: `"registries": {"@21st": {"url": "https://21st.dev/r/{name}", "params": {"api_key": "${API_KEY_21ST}"}}}`. Never commit the key.

**Agent Elements** is public and needs no key. FACT ([README](https://github.com/21st-dev/agent-elements)):
`npx shadcn@latest add https://agent-elements.21st.dev/r/agent-chat.json`. Files land in `components/agent-elements/`.

**What a registry item pulls in.** Each item lists npm `dependencies`, `registryDependencies` and optional `css`. `shadcn add` installs all of them. FACT, from the item JSON and [shadcn CLI docs](https://ui.shadcn.com/docs/cli).
- Base: a shadcn-initialised project, meaning `components.json`, the `@/*` alias and the `cn()` helper built on `clsx` and `tailwind-merge`. FACT ([Agent Elements llms-full](https://agent-elements.21st.dev/llms-full.txt)). Lightline already has `@/*` → `./*` in `tsconfig.json`. FACT.
- Tailwind: **v4** is required by Agent Elements (React 19+, `@import "tailwindcss"`). FACT, same source. Marketplace items are "React + Tailwind" with no version listed per item. FACT. Most recent items probably assume v4. INFERENCE.
- Typical npm deps seen today, all FACT from the component `.md` pages and registry JSON:
  - Utilities: `clsx`, `tailwind-merge`, `class-variance-authority`.
  - Icons vary by author: `lucide-react`, `@tabler/icons-react`, `@remixicon/react`, `@solar-icons/react`.
  - Motion: `motion` or the older `framer-motion`.
  - Primitives: `@base-ui/react` or `@radix-ui/react-slot`.
- Agent Elements `agent-chat` alone pulls in `@base-ui/react`, `@tabler/icons-react`, `ai`, `clsx` and `tailwind-merge`, plus 21 other registry items. `markdown` adds `streamdown` and `@streamdown/code`. `spiral-loader` adds `lottie-react` and `next-themes`. FACT, from the [agent-chat.json](https://agent-elements.21st.dev/r/agent-chat.json) item.
- `shadcn init` takes `-b base|radix|aria` to choose the primitive library and `-p` for a preset. FACT ([CLI docs](https://ui.shadcn.com/docs/cli)).

## 3. The visual language, at CSS level

FACT unless marked. Sources: the 21st.dev site CSS (`/_next/static/css/*.css`, linked from https://21st.dev, fetched today), Agent Elements [`lib/agent-ui/agent-ui.css`](https://github.com/21st-dev/agent-elements/blob/main/lib/agent-ui/agent-ui.css) and [`app/globals.css`](https://github.com/21st-dev/agent-elements/blob/main/app/globals.css).

| Aspect | 21st.dev site chrome | Agent Elements (agent UI) |
|---|---|---|
| Theme | Dark-first: the home page renders with `<html class="dark">`. `antialiased` everywhere. | Class-based dark mode, `@custom-variant dark (&:is(.dark *))` |
| Type | Font faces: General Sans, Inter, Geist Mono | Geist Sans and Geist Mono through `next/font` |
| Surfaces (dark) | Background `oklch(.141 .004 285.8)` (cool near-black); secondary and border `oklch(.274 .005 286)`; muted text `oklch(.654 .014 286)`; text `oklch(.968 .001 286.4)` | Background `#0a0a0a`; secondary `#242424`; tertiary `#141414`; text `#fafafa`; muted `#8c8c8c`; subtle `#71717a`; border `#2a2a2a` |
| Surfaces (light) | Background white; border `oklch(.92 .004 286.3)`; muted text `oklch(.552 .014 286)` | Background `#fff`; secondary `#f0f0f0`; tertiary `#f8f8f8`; text `#1a1a1a`; muted `#737373`; border `#e4e4e7` |
| Accent | One saturated blue-violet, `--primary: oklch(.485 .291 264.1)`, also used as the ring and the text-selection colour | One blue: `#3b82f6` light, `#60a5fa` dark. Dark mode puts *dark* text on the light-blue button for contrast. |
| Radius | `--radius: .5rem` | Message and input `16px`, tool cards `10px`, inner radius = outer − 4px; shadcn base `0.625rem` |
| Borders | 1 px hairlines. Fade-out border gradient tokens: `#ffffff03 → #00000080 → #ffffff03`. Dark canvas border `#fff3`. | 1 px `--an-border-color`. No heavy outlines. |
| Shadow | Dark card: inset top highlights plus deep soft drops: `0 12px 24px #ffffff08 inset, 0 .5px .5px #ffffff0f inset, 0 .25px .25px #ffffff1f inset, 0 48px 72px -12px #0000003d, 0 32px 44px -12px #00000052`. Light card: `0 48px 72px -12px #00000005, 0 32px 44px -12px #00000008`. | Mostly flat: surfaces are told apart by background steps, not shadows. |
| Motion | Focus: `outline: 2px solid` ring at 70% alpha, `outline-offset: 2px` | "Thinking" text shimmer: gradient text at `background-size: 250%`, subtle→muted→subtle, `2s linear infinite`. Stepped ellipsis animation. Spiral Lottie loader. |
| Data colours | Charts: blue, green, amber, violet, rose in oklch | Diff: green and red at 10–15% alpha backgrounds |

21st's own design rules, from its [`21st-ui-build` skill](https://21st.dev/.well-known/skills/21st-ui-build/SKILL.md), FACT, summarized:
- Prefer project tokens and existing components.
- Avoid decorative gradients, extra cards, glass effects, huge headlines and gratuitous animation.
- Always keep visible focus, reduced motion, and loading, empty and error states.

This matches the Lightline `globals.css` header, "one accent, quiet surfaces". INFERENCE: the "premium" feel comes from restraint, not effects:
- cool near-black neutrals in oklch;
- hairline borders;
- layered soft shadows with a 1 px inner top highlight in dark mode;
- one accent;
- 10–16 px radii;
- tabular numerals;
- short 150–250 ms transitions.

Drop-in layer for our `app/globals.css`, using our token names. The values come from the table above. The pulse and the reduced-motion handling are my own code. INFERENCE.

```css
:root{--bg:#fafafa;--surface:#fff;--surface-2:#f5f5f5;--ink:#1a1a1a;--muted:#737373;--faint:#a3a3a3;
  --line:#e4e4e7;--radius:10px;--radius-lg:16px;--ring:color-mix(in oklch,var(--accent) 70%,transparent);
  --shadow:0 1px 2px rgb(0 0 0/.05);--shadow-card:0 48px 72px -12px #00000005,0 32px 44px -12px #00000008;
  --font:"Inter","Geist",ui-sans-serif,system-ui,sans-serif;--ease:cubic-bezier(.2,.8,.2,1)}
@media (prefers-color-scheme:dark){:root{--bg:oklch(.141 .004 285.8);--surface:oklch(.18 .005 285.8);
  --surface-2:oklch(.21 .006 285.9);--ink:oklch(.968 .001 286.4);--muted:oklch(.654 .014 286);--faint:#71717a;
  --line:oklch(.274 .005 286);--shadow-card:0 12px 24px #ffffff08 inset,0 .5px .5px #ffffff0f inset,
  0 .25px .25px #ffffff1f inset,0 48px 72px -12px #0000003d,0 32px 44px -12px #00000052}}
body{background:var(--bg);color:var(--ink);font-family:var(--font);-webkit-font-smoothing:antialiased}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);box-shadow:var(--shadow-card)}
.num{font-variant-numeric:tabular-nums;letter-spacing:-.02em}
:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
.bubble{border-radius:var(--radius-lg);padding:10px 14px;background:var(--surface-2)}
.shimmer{background:linear-gradient(90deg,var(--faint) 40%,var(--muted) 50%,var(--faint) 60%) no-repeat;
  background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;
  animation:shimmer 2s linear infinite}
@keyframes shimmer{from{background-position:100% center}to{background-position:0% center}}
.live-dot{width:8px;height:8px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 0 var(--ok);animation:pulse 2s var(--ease) infinite}
@keyframes pulse{70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
@media (prefers-reduced-motion:reduce){.shimmer,.live-dot{animation:none}}
```

Keep our green `--accent` (the brand) rather than 21st's blue. 21st's own rule is that project tokens win. INFERENCE.

## 4. Components that fit an AI receptionist console

Every row is FACT from the linked `.md` page: author, the license field shown there, and the npm deps listed there. "—" means none listed.
Install pattern for all: `npx shadcn@latest add "https://21st.dev/r/<user>/<slug>?api_key=$API_KEY_21ST"`.
The "Lightline use" column is INFERENCE.

| # | Component | Author (library) | License | npm deps | Lightline use |
|---|---|---|---|---|---|
| 1 | [Voice Orb](https://21st.dev/@starc007/components/voice-orb) — WebGL shader sphere that reacts to voice | Saurabh (Be UI) | MIT | motion | "AI is live / on a call" hero on the dashboard |
| 2 | [Siri Orb](https://21st.dev/@educalvolpz/components/siri-orb) — CSS conic-gradient orb, honours reduced motion | Edu Calvo (SmoothUI) | 21st shows "unknown". Upstream [smoothui](https://github.com/educlopez/smoothui) is MIT. | — | Light, no-WebGL AI-on indicator; easy to rebuild in plain CSS |
| 3 | [Bar Visualizer](https://21st.dev/@ElevenLabs-crawled/components/bar-visualizer) / [Live Waveform](https://21st.dev/@ElevenLabs-crawled/components/live-waveform) | ElevenLabs UI (crawled copy) | 21st shows "unknown". Upstream [elevenlabs/ui](https://github.com/elevenlabs/ui) is MIT. | — | Call recording playback and live audio. Take it from the upstream source, not the crawl. |
| 4 | [Agent Chat](https://21st.dev/@serafimcloud/components/agent-chat) — chat shell with bubbles, error and empty states | 21st (Agent Elements port) | MIT | clsx, tailwind-merge | Lead transcript view (caller vs. AI bubbles) |
| 5 | [Approval Card](https://21st.dev/@syeddhasnainn/components/approval-card) — human-in-the-loop decision card | Syed Hasnain (Pasta UI) | MIT | @base-ui/react, @solar-icons/react, class-variance-authority | Approvals page: approve or reject facts the AI may say |
| 6 | [Agent Activity](https://21st.dev/@starc007/components/agent-activity) — collapsible animated timeline of agent steps | Saurabh (Be UI) | MIT | motion, lucide-react | What the AI did on a call: greeted, captured, booked, escalated |
| 7 | [Activity Timeline](https://21st.dev/@olewandowski1/components/timeline-3) — day-grouped feed with a connecting rail | Oliver (7Ovr) | MIT-0 | — | Lead history: calls, call-backs, blocks |
| 8 | [Statistics Card 2](https://21st.dev/@sean0205/components/statistics-card-2) | Sean Hello (ReUI) | MIT | — | "Today's numbers" tiles |
| 9 | [Number Ticker — Real-Time Metrics](https://21st.dev/@shadcnspace/components/number-ticker-05) — animated count with a live pulse | ShadcnSpace | MIT | @number-flow/react | Live call and lead counters |
| 10 | [Segmented Control](https://21st.dev/@halaska-studio/components/segmented-control) — iOS-style sliding thumb | halaska-studio | MIT | — | Company tabs; filters on the lead queue |
| 11 | [Switch](https://21st.dev/@serafimcloud/components/switch) — Base UI switch with a spring thumb | Serafim (21st founder) | MIT | @base-ui/react | AI on/off kill switch; settings toggles |
| 12 | [Action Search Bar](https://21st.dev/@kokonutd/components/action-search-bar) — Raycast-style command bar | Kokonut UI | MIT | lucide-react, framer-motion | ⌘K: jump to a lead, call back, block a number |

Also suitable, FACT from their `.md` pages:
- [Sidebar](https://21st.dev/@shadcn/components/sidebar): shadcn, MIT; needs `lucide-react`, `@radix-ui/react-slot` and `class-variance-authority`.
- [Empty](https://21st.dev/@shadcn/components/empty): shadcn; 21st shows the license as "unknown", but upstream shadcn/ui is MIT.
- [Thinking Orbs](https://21st.dev/@yogesharc/components/thinking-orbs): MIT, no dependencies.
- [Badge Delta](https://21st.dev/@serafimcloud/components/badge-delta): MIT.

**Avoid** these, because their license is "no-license" or "unknown" with no MIT upstream:
- [Status Dot](https://21st.dev/@edwinvakayil/components/status-dot): no-license.
- [Audit Log](https://21st.dev/@corr/components/audit-log): no-license.
- [Empty Notifications State](https://21st.dev/@olewandowski1/components/empty-states-1): no-license.
- [Status Badge](https://21st.dev/@arihantcodes_1f7b8c4d/components/status-badge): unknown.
- [Stats cards with links](https://21st.dev/@ephraimduncan/components/stats-cards-with-links): unknown.

FACT for the labels. Treating them as all-rights-reserved is INFERENCE.

"Popular" here means the item sits near the top of its category or tag listing on 21st.dev. Like and install counts are not exposed without auth. INFERENCE.

## 5. Licensing and terms

- **The license is per component, set by each author.** It is not one site-wide license. Values seen today: `MIT`, `mit`, `MIT-0`, `unknown` and `no-license`. FACT (the component `.md` pages above).
- Agent Elements is MIT, © 2026 21st.dev. ElevenLabs UI, SmoothUI, Kokonut UI and shadcn-chat are MIT on GitHub. FACT ([agent-elements LICENSE](https://github.com/21st-dev/agent-elements/blob/main/LICENSE), GitHub API license fields).
- [Terms](https://21st.dev/terms), last updated 2026-07-20. FACT, summarized:
  - **§2.** Marketplace content belongs to its authors and 21st Labs. Users may view and use it "solely through the official 21st.dev platform". 21st owns the demos, previews and media whatever the component's license says.
  - **§3 forbids:**
    - scraping;
    - using Marketplace content to train AI;
    - redistributing or reselling content without authorization;
    - reposting components to other sites without a visible link back to the original page;
    - getting around the technical protections.
  - **§3.1.** Publishers must hold the rights to what they post. 21st removes reported license violations.
- INFERENCE for a commercial app:
  - Installing an MIT component through the platform into a private app does not look like the "redistribution" §3 targets.
  - The MIT license itself requires keeping the copyright notice. Record each one in `THIRD_PARTY_NOTICES.md`.
  - Do **not** use `unknown` or `no-license` items. Without a license the default is all rights reserved.
  - For MIT items, prefer the author's upstream repo. That keeps us out of the §2 "solely through the platform" ambiguity and the daily quota.
  - Get a lawyer's read only if we ever ship 21st code in a product we resell.

## 6. Recommendation: (a) Tailwind v4 + shadcn + registry, or (b) our own CSS and React

| | (a) Tailwind v4 + shadcn base + 21st registry | (b) Rebuild the visual language in our CSS and React |
|---|---|---|
| Pros | Fast access to 12k items and the Agent Elements transcript UI. Accessible primitives (Base UI or Radix). The look matches the source exactly. Easy to pull more items later. | No new runtime deps. No Tailwind migration of 166 lines of working CSS. No API key, quota or per-item license triage. Keeps the "nothing decoration-only" rule. The look is about 40 lines of tokens (§3). Full control over a11y and performance. |
| Cons | Tailwind preflight resets base styles and would shift existing pages. `shadcn init` rewrites `globals.css` and adds `components.json`. Each component brings its own icon or motion library: lucide, tabler, solar, remix, motion, framer-motion. Quality and licenses vary. A key is needed (2 installs/day free). Agent Elements is built on Next 16.1 / React 19.2, untested on our 16.4.2 / 19.3.1. | We rebuild the orb, timeline, switch, segmented control and ⌘K bar by hand (~1–2 days). No one-command upgrades. A WebGL voice orb is not worth it, so use the CSS Siri-orb approach. |
| Risk | Medium: styling regressions across pages, dependency churn | Low |

Sources for the table: preflight behaviour is documented at [tailwindcss.com/docs/preflight](https://tailwindcss.com/docs/preflight). Every other judgement is INFERENCE.

**Recommendation: (b).** INFERENCE. Plan:
1. Add the token layer from §3.
2. Build these by hand: `LiveDot`, `Shimmer`, `Orb` (CSS conic gradient), `StatTile` (tabular numerals), `Timeline`, `Segmented`, `Switch`, `TranscriptBubble`.
3. Where a ready-made piece saves real time, port its MIT source from GitHub and credit it. Candidates: Agent Elements `text-shimmer` and `user-message`, ElevenLabs UI `bar-visualizer`.

Revisit (a) if the console grows past about 10 screens, or if we adopt the AI SDK chat stack.

**If we choose (a)**, pin the latest stable versions published on or before 2026-10-09 (14+ days before today). FACT, from the npm registry `time` field:

| Package | Version | Published | Why |
|---|---|---|---|
| tailwindcss | 4.3.3 | 2026-07-16 | Tailwind v4 core |
| @tailwindcss/postcss | 4.3.3 | 2026-07-16 | Next.js integration ([guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs)) |
| postcss | 8.5.29 | 2026-10-05 | Peer for the plugin. npm latest is 8.5.31, too new. |
| shadcn (CLI, run with npx) | 4.21.4 | 2026-10-07 | `init` / `add`; needs Node ≥20.18.1, and we have ≥22.12. npm latest is 4.22.1, too new. |
| tw-animate-css | 1.4.0 | 2025-09-24 | shadcn animation utilities |
| clsx | 2.1.1 | 2024-04-23 | `cn()` |
| tailwind-merge | 3.7.0 | 2026-09-12 | `cn()` |
| class-variance-authority | 0.7.1 | 2024-11-26 | Variants |
| @base-ui/react | 1.9.0 | 2026-10-09 | Primitives (`-b base`). `date-fns` peers are optional. Alternative: radix-ui 1.7.0 (2026-10-05). |
| lucide-react | 1.54.0 | 2026-10-09 | Icons (shadcn default) |
| motion | 14.1.0 | 2026-10-09 | Orb and activity animations. Kokonut items import `framer-motion`, so rewrite those imports to `motion`. |
| @number-flow/react | 0.6.2 | 2026-07-18 | Only for Number Ticker |
| next-themes | 0.4.6 | 2025-03-11 | Only if we add a manual theme toggle |
| ai / @tabler/icons-react | 7.0.137 / 3.49.0 | 2026-10-09 / 2026-10-05 | Only if we install Agent Elements |

Four picks were published exactly on 2026-10-09: lucide-react, motion, @base-ui/react and ai. If we want more margin, step each back one minor version. FACT (dates), INFERENCE (advice).

Steps for (a), from [shadcn Next.js install](https://ui.shadcn.com/docs/installation/next), the [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs) and the [shadcn CLI docs](https://ui.shadcn.com/docs/cli):
1. `npm i -D tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3 postcss@8.5.29`.
2. Add `postcss.config.mjs` with `"@tailwindcss/postcss": {}`.
3. Put `@import "tailwindcss";` at the top of `app/globals.css`.
4. Run `npx shadcn@4.21.4 init -b base`.
5. Then `npx shadcn@4.21.4 add "<url>"` for each item.
