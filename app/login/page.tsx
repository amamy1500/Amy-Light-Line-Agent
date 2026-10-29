import { Notice, Orb } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="panel-card">
        <Orb state="live" size="lg" />
        <div>
          <h1>Lightline</h1>
          <p className="sub" style={{ margin: 0 }}>Every caller answered, every lead kept.</p>
        </div>
        {error && <Notice tone="bad">{error}</Notice>}
        <form method="post" action="/api/login" style={{ display: "grid", gap: 10 }}>
        <label htmlFor="token" className="meta">
          Access code
        </label>
        <input id="token" name="token" type="password" autoComplete="current-password" required />
        <button className="btn primary" type="submit">
          Open the console
        </button>
        </form>
      </div>
    </main>
  );
}
