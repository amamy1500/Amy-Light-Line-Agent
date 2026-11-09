/**
 * Emails Amy the leads that came in while email was off (ALERT_MODE=simulate): each
 * chosen lead's newest call email goes back in the queue, and the live server sends it
 * on its next sweep (within a minute), recording attached. A lead already emailed is
 * never sent twice.
 *
 * Run it only after email is live on the server (ALERT_MODE=live and the Gmail app
 * password set); before that, a queued email is just recorded again.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx scripts/email-catch-up.ts                       lists the leads waiting; changes nothing
 *   DATABASE_URL=… npx tsx scripts/email-catch-up.ts --send "Sam Patel" "Dana Mohs"
 */
import { pathToFileURL } from "node:url";
import { requeueLeadEmails, type Queryable } from "@/lib/db";
import { formatUsPhone } from "@/lib/telephony";
import { connectionProblem, openPool } from "./db-connect";

interface Waiting {
  leadId: string;
  name: string | null;
  phone: string | null;
  firstCall: Date;
}

/** Leads whose call email was recorded but never sent. */
export async function leadsWaitingForEmail(db: Queryable): Promise<Waiting[]> {
  const { rows } = await db.query<Waiting>(
    `select l.id as "leadId", l.contact_name as name, l.contact_phone as phone, l.created_at as "firstCall"
       from public.lead l
      where exists (select 1 from public.outbox o where o.lead_id = l.id and o.channel = 'email' and o.kind = 'agent_lead' and o.status = 'simulated')
        and not exists (select 1 from public.outbox o where o.lead_id = l.id and o.channel = 'email' and o.status = 'sent')
      order by l.created_at`,
  );
  return rows;
}

async function main(argv: string[]): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";
  const problem = url ? connectionProblem(url) : "DATABASE_URL is not set.";
  if (problem) throw new Error(problem);
  const send = argv[0] === "--send";
  const names = send ? argv.slice(1) : [];
  if (send && names.length === 0) throw new Error('Name the leads to send, e.g. --send "Sam Patel"');

  const pool = openPool(url);
  try {
    const waiting = await leadsWaitingForEmail(pool);
    if (!send) {
      console.log(waiting.length ? "Leads Amy never got an email for:" : "Every lead has been emailed.");
      for (const w of waiting) {
        console.log(`  ${w.name ?? "(no name)"}  ${formatUsPhone(w.phone).replace(/\d{4}$/, "····")}  first call ${w.firstCall.toISOString().slice(0, 10)}`);
      }
      return;
    }
    const chosen = names.map((name) => {
      const matches = waiting.filter((w) => w.name?.toLowerCase() === name.toLowerCase());
      if (matches.length !== 1) throw new Error(`"${name}" matches ${matches.length} waiting leads; use the exact name from the list`);
      return matches[0]!;
    });
    const queued = await requeueLeadEmails(pool, chosen.map((c) => c.leadId));
    console.log(`Queued ${queued} email(s) for ${chosen.map((c) => c.name).join(", ")}. The server sends them within a minute.`);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
