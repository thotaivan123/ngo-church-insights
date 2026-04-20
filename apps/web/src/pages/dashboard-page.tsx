import { useEffect, useMemo } from "react";

import type { DashboardFilters } from "@ngo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import {
  AppHeader,
  ChartCard,
  ChurchesTable,
  FilterBar,
  InsightSummaryCard,
  KpiGrid,
  MapPanel,
} from "@/components/dashboard";
import { Badge, Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

const DASHBOARD_FILTER_KEYS: Array<keyof DashboardFilters> = ["state", "district", "city", "churchId"];

const readFiltersFromSearchParams = (searchParams: URLSearchParams): DashboardFilters => {
  const nextFilters: DashboardFilters = {};

  DASHBOARD_FILTER_KEYS.forEach((key) => {
    const value = searchParams.get(key);
    if (value) {
      nextFilters[key] = value;
    }
  });

  return nextFilters;
};

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : "Something went wrong while loading the NGO dashboard."
);

const DashboardLoadingState = () => (
  <div className="flex min-h-screen items-center justify-center px-4 py-8">
    <Card className="max-w-xl text-center">
      <p className="section-kicker">Loading Dashboard</p>
      <h1 className="mt-3 text-3xl font-semibold text-ink">Preparing the India-wide mission network view</h1>
      <p className="mt-4 text-sm leading-7 text-slate-600">
        Pulling churches, pastors, member analytics, and the latest role-scoped filters for this session.
      </p>
    </Card>
  </div>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, logout, session } = useAuth();

  const filters = useMemo(() => readFiltersFromSearchParams(searchParams), [searchParams]);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview", session?.userId, filters],
    enabled: Boolean(session?.userId),
    queryFn: () => api.getDashboardOverview(filters, session!),
  });

  const summaryMutation = useMutation({
    mutationFn: () => api.getInsightSummary(filters, session!),
  });
  const resetSummary = summaryMutation.reset;

  useEffect(() => {
    resetSummary();
  }, [filtersKey, resetSummary]);

  if (!currentUser || !session) {
    return null;
  }

  const handleFilterChange = (key: keyof DashboardFilters, value: string) => {
    const nextParams = new URLSearchParams(searchParams);

    if (!value) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }

    if (key === "state") {
      nextParams.delete("district");
      nextParams.delete("city");
      nextParams.delete("churchId");
      if (value) {
        nextParams.set("state", value);
      }
    }

    if (key === "district") {
      nextParams.delete("city");
      nextParams.delete("churchId");
      if (value) {
        nextParams.set("district", value);
      }
    }

    if (key === "city") {
      nextParams.delete("churchId");
      if (value) {
        nextParams.set("city", value);
      }
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleResetFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const handleOpenChurch = (churchId: string) => {
    navigate(`/churches/${churchId}`);
  };

  if (overviewQuery.isLoading) {
    return <DashboardLoadingState />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <div className="min-h-screen px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <AppHeader currentUser={currentUser} onLogout={logout} />
          <Card className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-coral/10 text-coral">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-ink">The dashboard could not be loaded</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{getErrorMessage(overviewQuery.error)}</p>
            <Button className="mt-6 gap-2" onClick={() => void overviewQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const { data: overview } = overviewQuery;

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <AppHeader currentUser={currentUser} onLogout={logout} />

        <Card className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="section-kicker">Week-One Demo Story</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">Track the mission footprint, then narrow quickly to action</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              This national view is designed for fast storytelling: coverage across India, congregation health,
              baptism progress, and the specific churches that need attention next.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone="teal">Role-aware access</Badge>
              <Badge tone="saffron">300 seeded churches</Badge>
              <Badge tone="moss">Aggregated AI summaries only</Badge>
            </div>
          </div>
          <div className="grid gap-4 rounded-xl2 border border-slate-200 bg-mist/70 p-5 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div>
              <div className="text-3xl font-semibold text-ink">{formatNumber(overview.kpis.totalChurches)}</div>
              <div className="mt-1 text-sm text-slate-500">Churches currently in scope</div>
            </div>
            <div>
              <div className="text-3xl font-semibold text-ink">{formatNumber(overview.kpis.totalMembers)}</div>
              <div className="mt-1 text-sm text-slate-500">Members included in this filtered view</div>
            </div>
            <div>
              <div className="text-3xl font-semibold text-ink">{formatNumber(overview.map.markers.length)}</div>
              <div className="mt-1 text-sm text-slate-500">Mapped church locations on screen</div>
            </div>
          </div>
        </Card>

        <FilterBar
          filters={filters}
          options={overview.filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        <KpiGrid overview={overview} />

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <MapPanel
            center={overview.map.center}
            zoom={overview.map.zoom}
            markers={overview.map.markers}
            onSelectChurch={handleOpenChurch}
          />
          <div className="space-y-4">
            <InsightSummaryCard
              summary={summaryMutation.data ?? null}
              isLoading={summaryMutation.isPending}
              onGenerate={() => summaryMutation.mutate()}
            />
            {summaryMutation.isError ? (
              <Card muted className="border border-coral/20 bg-coral/5">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-coral" />
                  <p className="text-sm leading-6 text-slate-700">
                    AI summary generation failed, but the dashboard remains usable. {getErrorMessage(summaryMutation.error)}
                  </p>
                </div>
              </Card>
            ) : null}
            <Card muted>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">What to demo here</p>
              <ul className="mt-3 space-y-2 pl-5 text-sm leading-6 text-slate-700">
                <li>Filter from state to district to city and watch the KPIs, map, and church table stay in sync.</li>
                <li>Open any church from the map or the table to move into the leader-level operating view.</li>
                <li>Generate an AI summary only when needed, using aggregated metrics instead of personal details.</li>
              </ul>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard
            title="Top districts by congregation size"
            type="horizontalBar"
            items={overview.charts.topDistricts}
            color="#0f766e"
          />
          <ChartCard
            title="Baptized vs not baptized"
            type="pie"
            items={overview.charts.baptismBreakdown}
            color="#f29f05"
          />
          <ChartCard
            title="Age-band distribution"
            type="bar"
            items={overview.charts.ageDistribution}
            color="#2f855a"
          />
          <ChartCard
            title="Join-year trend"
            type="line"
            items={overview.charts.joinYearTrend}
            color="#f29f05"
          />
        </div>

        <ChurchesTable churches={overview.churches} onSelectChurch={handleOpenChurch} />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-white/60 bg-white/60 px-4 py-3 text-sm text-slate-600 backdrop-blur">
          <div>
            Showing <span className="font-semibold text-ink">{formatNumber(overview.churches.length)}</span> churches and{" "}
            <span className="font-semibold text-ink">{formatNumber(overview.kpis.totalMembers)}</span> members in the current view.
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={overviewQuery.isFetching ? "saffron" : "teal"}>
              {overviewQuery.isFetching ? "Refreshing filters" : "Live local demo data"}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
