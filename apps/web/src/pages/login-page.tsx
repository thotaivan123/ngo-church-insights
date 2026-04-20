import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import { DEMO_PASSWORD } from "@/auth/demo-accounts";
import { Badge, Button, Card, Input } from "@/components/ui";

const LoginPage = () => {
  const navigate = useNavigate();
  const {
    authError,
    currentUser,
    demoAccounts,
    isCognitoEnabled,
    isDemoEnabled,
    isLoading,
    loginDemo,
    loginWithCognito,
  } = useAuth();
  const [email, setEmail] = useState<string>(demoAccounts[0]?.email ?? "");
  const [password, setPassword] = useState<string>(DEMO_PASSWORD);
  const [error, setError] = useState<string>("");
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
  const [isSubmittingCognito, setIsSubmittingCognito] = useState(false);

  useEffect(() => {
    if (!isLoading && currentUser) {
      navigate("/", { replace: true });
    }
  }, [currentUser, isLoading, navigate]);

  const handleDemoSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmittingDemo(true);
    try {
      await loginDemo(email, password);
      navigate("/", { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setIsSubmittingDemo(false);
    }
  };

  const handleCognitoSignIn = async () => {
    setError("");
    setIsSubmittingCognito(true);
    try {
      await loginWithCognito();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to start Cognito sign-in.");
      setIsSubmittingCognito(false);
    }
  };

  const combinedError = error || authError;

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
                  {isDemoEnabled ? (
                    <p className="text-sm text-slate-300">
                      Demo password for every local account: <span className="font-semibold text-white">{DEMO_PASSWORD}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-300">
                      This environment is configured for AWS-hosted sign-in first, with backend summaries still running locally.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white px-6 py-8 md:px-8">
              <p className="section-kicker">Workspace Access</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Sign in to the prototype</h2>
              <p className="mt-2 text-sm text-slate-600">
                Use Cognito hosted login for the AWS path, or keep using local demo accounts while the stack is still being wired.
              </p>

              {isCognitoEnabled ? (
                <div className="mt-6 rounded-2xl border border-teal/20 bg-teal/5 p-4">
                  <p className="text-sm font-semibold text-ink">Cognito hosted login</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    This route uses your AWS user pool, groups, and hosted OAuth redirect instead of the local demo header.
                  </p>
                  <Button className="mt-4 w-full" onClick={() => void handleCognitoSignIn()} disabled={isSubmittingCognito}>
                    {isSubmittingCognito ? "Redirecting to Cognito..." : "Continue with Cognito"}
                  </Button>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  Cognito is not configured in this frontend yet. Fill the Cognito env values to enable hosted sign-in here.
                </div>
              )}

              {isDemoEnabled ? (
                <>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Local demo fallback</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <form className="mt-6 space-y-4" onSubmit={handleDemoSubmit}>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                      <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@ngo.demo" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                      <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                    </div>
                    {combinedError ? <p className="text-sm text-red-600">{combinedError}</p> : null}
                    <Button className="w-full" type="submit" disabled={isSubmittingDemo}>
                      {isSubmittingDemo ? "Signing In..." : "Enter Workspace with Demo Account"}
                    </Button>
                  </form>
                </>
              ) : combinedError ? (
                <p className="mt-6 text-sm text-red-600">{combinedError}</p>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker">Prepared Accounts</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                {isDemoEnabled ? "Switch roles fast" : "What this environment proves"}
              </h2>
            </div>
            <Badge tone="teal">Invite-only</Badge>
          </div>

          {isDemoEnabled ? (
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
          ) : (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              This hosted-login path is now ready for your Cognito `super_admin` test user. Church leader scoping will
              work once the Cognito user email matches a seeded local profile, or once we move the user directory into DynamoDB.
            </div>
          )}

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
