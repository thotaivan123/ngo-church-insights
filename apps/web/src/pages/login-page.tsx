import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import { DEMO_PASSWORD } from "@/auth/demo-accounts";
import { Badge, Button, Card, Input } from "@/components/ui";

const LoginPage = () => {
  const navigate = useNavigate();
  const { currentUser, isLoading, loginDemo, demoAccounts } = useAuth();
  const [email, setEmail] = useState<string>(demoAccounts[0]?.email ?? "");
  const [password, setPassword] = useState<string>(DEMO_PASSWORD);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && currentUser) {
      navigate("/", { replace: true });
    }
  }, [currentUser, isLoading, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await loginDemo(email, password);
      navigate("/", { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative overflow-hidden bg-ink px-8 py-10 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(242,159,5,0.24),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(15,118,110,0.28),_transparent_32%)]" />
              <div className="relative">
                <p className="section-kicker text-saffron">AWS Fundamentals Prototype</p>
                <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight text-white md:text-5xl">
                  NGO Church Insights across India, built for a sharp week-one demo.
                </h1>
                <p className="mt-5 max-w-xl text-sm leading-7 text-slate-200">
                  Explore 300 synthetic churches, district and city coverage, congregation analytics, leader views,
                  and AI-generated summaries grounded in aggregated data only.
                </p>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-3xl font-semibold">300</div>
                    <div className="mt-1 text-sm text-slate-300">Churches seeded</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-3xl font-semibold">9011</div>
                    <div className="mt-1 text-sm text-slate-300">Members generated</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-3xl font-semibold">2</div>
                    <div className="mt-1 text-sm text-slate-300">Roles supported</div>
                  </div>
                </div>

                <div className="mt-10 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="saffron">Map + Clusters</Badge>
                    <Badge tone="teal">Role-aware Analytics</Badge>
                    <Badge tone="moss">AI Summaries</Badge>
                  </div>
                  <p className="text-sm text-slate-300">
                    Demo password for every account: <span className="font-semibold text-white">{DEMO_PASSWORD}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white px-6 py-8 md:px-8">
              <p className="section-kicker">Demo Sign-In</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Access the prototype</h2>
              <p className="mt-2 text-sm text-slate-600">
                Use one of the prepared demo accounts below, or type the credentials manually.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                  <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@ngo.demo" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                  <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </div>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <Button className="w-full" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing In..." : "Enter Workspace"}
                </Button>
              </form>
            </div>
          </div>
        </Card>

        <Card className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker">Prepared Accounts</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Switch roles fast</h2>
            </div>
            <Badge tone="teal">Invite-only</Badge>
          </div>

          <div className="mt-6 space-y-4">
            {demoAccounts.map((account) => (
              <button
                key={account.userId}
                type="button"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-teal hover:shadow-soft"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-ink">{account.label}</div>
                    <div className="mt-1 text-sm text-slate-500">{account.email}</div>
                    <div className="mt-2 text-sm text-slate-600">{account.helperText}</div>
                  </div>
                  <Badge tone={account.roleLabel === "Super Admin" ? "saffron" : "teal"}>{account.roleLabel}</Badge>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-ink">What this demo proves</p>
            <ul className="mt-3 space-y-2 pl-4">
              <li>Role-based visibility between national and church-level views</li>
              <li>Map, dashboard, and detail pages bound to seeded synthetic data</li>
              <li>On-demand AI summaries that avoid raw personal data</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
