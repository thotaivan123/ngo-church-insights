import { useEffect, useMemo, useState } from "react";

import type { ChurchListItem, DashboardFilters, DashboardOverview, InsightSummary, UserProfile } from "@ngo/shared";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import ReactECharts from "echarts-for-react";
import L from "leaflet";
import { BarChart3, Church, Download, Expand, LogOut, MapPinned, Sparkles, X } from "lucide-react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

import { Badge, Button, Card, Select } from "@/components/ui";
import { cn, downloadCsv, formatNumber, formatPercent } from "@/lib/utils";

const markerIcon = (status: string) => L.divIcon({
  className: "",
  html: `<div style="height:18px;width:18px;border-radius:9999px;border:2px solid white;background:${status === "support_needed" ? "#f97360" : status === "new" ? "#f29f05" : "#0f766e"};box-shadow:0 10px 20px rgba(16,34,48,0.24)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

type ChartDatum = { label: string; value: number };

const buildBarOption = (
  items: ChartDatum[],
  color: string,
  options: { horizontal?: boolean; expanded?: boolean } = {},
) => ({
  backgroundColor: "transparent",
  animationDuration: 400,
  tooltip: { trigger: "axis", axisPointer: { type: options.horizontal ? "shadow" : "line" } },
  grid: options.horizontal
    ? { top: 12, left: 8, right: 18, bottom: 8, containLabel: true }
    : { top: 18, left: 12, right: 18, bottom: 14, containLabel: true },
  xAxis: options.horizontal
    ? {
      type: "value",
      axisLabel: { color: "#51606c" },
      splitLine: { lineStyle: { color: "#eef2f6" } },
    }
    : {
      type: "category",
      data: items.map((item) => item.label),
      axisLabel: {
        color: "#51606c",
        interval: 0,
        rotate: options.expanded ? 0 : items.length > 5 ? 18 : 0,
      },
      axisLine: { lineStyle: { color: "#d3dbe1" } },
    },
  yAxis: options.horizontal
    ? {
      type: "category",
      data: items.map((item) => item.label),
      axisLabel: {
        color: "#51606c",
        width: options.expanded ? 180 : 90,
        overflow: "truncate",
      },
      axisTick: { show: false },
      axisLine: { show: false },
    }
    : {
      type: "value",
      axisLabel: { color: "#51606c" },
      splitLine: { lineStyle: { color: "#eef2f6" } },
    },
  series: [
    {
      type: "bar",
      data: items.map((item) => item.value),
      barMaxWidth: options.horizontal ? 18 : 32,
      itemStyle: { color, borderRadius: options.horizontal ? [0, 10, 10, 0] : [10, 10, 0, 0] },
    },
  ],
});

const buildPieOption = (items: ChartDatum[]) => ({
  backgroundColor: "transparent",
  tooltip: { trigger: "item" },
  legend: { bottom: 0, textStyle: { color: "#51606c" } },
  series: [
    {
      type: "pie",
      radius: ["52%", "74%"],
      top: 6,
      data: items.map((item) => ({ name: item.label, value: item.value })),
      label: { show: false },
      emphasis: { label: { show: true, formatter: "{b}: {d}%" } },
      itemStyle: {
        color: ({ dataIndex }: { dataIndex: number }) => ["#0f766e", "#f29f05", "#f97360", "#2f855a"][dataIndex % 4],
      },
    },
  ],
});

const buildLineOption = (items: ChartDatum[], color: string) => ({
  backgroundColor: "transparent",
  tooltip: { trigger: "axis" },
  grid: { top: 18, left: 12, right: 18, bottom: 14, containLabel: true },
  xAxis: {
    type: "category",
    data: items.map((item) => item.label),
    axisLabel: { color: "#51606c" },
    axisLine: { lineStyle: { color: "#d3dbe1" } },
  },
  yAxis: {
    type: "value",
    axisLabel: { color: "#51606c" },
    splitLine: { lineStyle: { color: "#eef2f6" } },
  },
  series: [
    {
      type: "line",
      smooth: true,
      symbolSize: 8,
      lineStyle: { color, width: 3 },
      itemStyle: { color },
      areaStyle: { color: `${color}22` },
      data: items.map((item) => item.value),
    },
  ],
});

export const AppHeader = ({ currentUser, onLogout }: { currentUser: UserProfile; onLogout: () => void }) => (
  <Card className="sticky top-4 z-20 flex flex-col gap-4 bg-white backdrop-blur-none md:flex-row md:items-center md:justify-between">
    <div>
      <p className="section-kicker">NGO Church Insights</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-3xl font-semibold text-ink md:text-4xl">Mission network dashboard</h1>
        <Badge tone={currentUser.role === "super_admin" ? "saffron" : "teal"}>
          {currentUser.role === "super_admin" ? "Super Admin" : "Church Leader"}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Signed in as <span className="font-medium text-ink">{currentUser.displayName}</span> ({currentUser.email})
      </p>
    </div>
    <Button variant="secondary" className="gap-2 self-start md:self-center" onClick={onLogout}>
      <LogOut className="h-4 w-4" />
      Sign Out
    </Button>
  </Card>
);

export const FilterBar = ({
  filters,
  options,
  onChange,
  onReset,
}: {
  filters: DashboardFilters;
  options: DashboardOverview["filters"];
  onChange: (key: keyof DashboardFilters, value: string) => void;
  onReset: () => void;
}) => (
  <Card className="grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">State</p>
      <Select value={filters.state ?? ""} onChange={(event) => onChange("state", event.target.value)}>
        <option value="">All states</option>
        {options.states.map((state) => <option key={state} value={state}>{state}</option>)}
      </Select>
    </div>
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">District</p>
      <Select value={filters.district ?? ""} onChange={(event) => onChange("district", event.target.value)}>
        <option value="">All districts</option>
        {options.districts.map((district) => <option key={district} value={district}>{district}</option>)}
      </Select>
    </div>
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">City</p>
      <Select value={filters.city ?? ""} onChange={(event) => onChange("city", event.target.value)}>
        <option value="">All cities</option>
        {options.cities.map((city) => <option key={city} value={city}>{city}</option>)}
      </Select>
    </div>
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Church</p>
      <Select value={filters.churchId ?? ""} onChange={(event) => onChange("churchId", event.target.value)}>
        <option value="">All churches</option>
        {options.churches.map((church) => <option key={church.churchId} value={church.churchId}>{church.name}</option>)}
      </Select>
    </div>
    <div className="flex items-end">
      <Button variant="secondary" className="w-full" onClick={onReset}>Reset filters</Button>
    </div>
  </Card>
);

export const KpiGrid = ({ overview }: { overview: DashboardOverview }) => {
  const items = [
    { label: "Churches", value: formatNumber(overview.kpis.totalChurches), tone: "saffron" as const, icon: Church },
    { label: "Pastors", value: formatNumber(overview.kpis.totalPastors), tone: "teal" as const, icon: Church },
    { label: "Members", value: formatNumber(overview.kpis.totalMembers), tone: "moss" as const, icon: BarChart3 },
    { label: "Baptized", value: formatPercent(overview.kpis.baptizedPercentage), tone: "teal" as const, icon: Sparkles },
    { label: "Cities Covered", value: formatNumber(overview.kpis.citiesCovered), tone: "slate" as const, icon: MapPinned },
    { label: "Districts Covered", value: formatNumber(overview.kpis.districtsCovered), tone: "slate" as const, icon: MapPinned },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="metric-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
            <Badge tone={item.tone}>{item.label}</Badge>
          </div>
          <div className="mt-6 flex items-end justify-between gap-4">
            <div className="text-3xl font-semibold text-ink">{item.value}</div>
            <item.icon className="h-6 w-6 text-teal" />
          </div>
        </div>
      ))}
    </div>
  );
};

const ChartDataTable = ({
  items,
}: {
  items: ChartDatum[];
}) => (
  <div className="table-shell overflow-x-auto rounded-2xl border border-slate-200 bg-white">
    <table>
      <thead>
        <tr>
          <th>Label</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.label}>
            <td>{item.label}</td>
            <td>{formatNumber(item.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const ChartCard = ({
  title,
  type,
  items,
  color,
}: {
  title: string;
  type: "bar" | "horizontalBar" | "pie" | "line";
  items: ChartDatum[];
  color: string;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded]);

  if (!items.length) {
    return (
      <Card className="flex h-full min-h-[300px] items-center justify-center bg-white text-center backdrop-blur-none">
        <div className="max-w-sm">
          <p className="section-kicker">Chart</p>
          <h3 className="mt-2 text-xl font-semibold text-ink">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            No chartable data is available for the current filter scope yet.
          </p>
        </div>
      </Card>
    );
  }

  const buildOption = (expanded = false) => {
    if (type === "pie") {
      return buildPieOption(items);
    }
    if (type === "line") {
      return buildLineOption(items, color);
    }
    return buildBarOption(items, color, { horizontal: type === "horizontalBar", expanded });
  };

  return (
    <>
      <Card className="h-full overflow-hidden bg-white p-0 backdrop-blur-none">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="section-kicker">Chart View</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="slate">{formatNumber(items.length)} points</Badge>
            <Button variant="secondary" className="gap-2" onClick={() => setIsExpanded(true)}>
              <Expand className="h-4 w-4" />
              Expand
            </Button>
          </div>
        </div>
        <div className="p-4">
          <ReactECharts option={buildOption()} style={{ height: 290, width: "100%" }} notMerge lazyUpdate />
        </div>
      </Card>

      {isExpanded ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm md:p-8">
          <div className="mx-auto max-w-6xl">
            <Card className="overflow-hidden bg-white p-0 backdrop-blur-none">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <p className="section-kicker">Expanded Chart</p>
                  <h3 className="mt-2 text-2xl font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Inspect the chart at full size and review the exact values underneath.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={() => downloadCsv(
                      `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`,
                      ["Label", "Value"],
                      items.map((item) => [item.label, item.value]),
                    )}
                  >
                    <Download className="h-4 w-4" />
                    Export data
                  </Button>
                  <Button variant="secondary" className="gap-2" onClick={() => setIsExpanded(false)}>
                    <X className="h-4 w-4" />
                    Close
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 px-6 py-6 xl:grid-cols-[1.4fr_0.6fr]">
                <Card muted className="bg-white">
                  <ReactECharts option={buildOption(true)} style={{ height: 460, width: "100%" }} notMerge lazyUpdate />
                </Card>
                <div className="space-y-4">
                  <Card muted className="bg-white">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Data summary</p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-200 px-4 py-3">
                        <div className="text-2xl font-semibold text-ink">{formatNumber(items.length)}</div>
                        <div className="mt-1 text-sm text-slate-500">Visible points</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 px-4 py-3">
                        <div className="text-2xl font-semibold text-ink">{formatNumber(items.reduce((sum, item) => sum + item.value, 0))}</div>
                        <div className="mt-1 text-sm text-slate-500">Total value</div>
                      </div>
                    </div>
                  </Card>
                  <div>
                    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Underlying data</p>
                    <ChartDataTable items={items} />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
};

export const MapPanel = ({
  center,
  zoom,
  markers,
  onSelectChurch,
}: {
  center: [number, number];
  zoom: number;
  markers: DashboardOverview["map"]["markers"];
  onSelectChurch: (churchId: string) => void;
}) => (
  <Card className="overflow-hidden p-0">
    <div className="border-b border-slate-200 px-5 py-4">
      <p className="section-kicker">Coverage Map</p>
      <h2 className="mt-2 text-2xl font-semibold text-ink">Church footprint across India</h2>
    </div>
    <div className="p-5">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-[440px] w-full rounded-[1.4rem]">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup chunkedLoading>
          {markers.map((marker) => (
            <Marker key={marker.churchId} position={[marker.lat, marker.lng]} icon={markerIcon(marker.status)}>
              <Popup>
                <div className="space-y-2">
                  <div className="font-semibold text-ink">{marker.name}</div>
                  <div className="text-sm text-slate-600">{marker.city}, {marker.district}</div>
                  <div className="text-sm text-slate-600">{formatNumber(marker.memberCount)} members</div>
                  <div className="text-sm text-slate-600">{formatPercent(marker.baptizedPercentage)} baptized</div>
                  <button className="button-secondary mt-2 w-full" onClick={() => onSelectChurch(marker.churchId)}>
                    Open church detail
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  </Card>
);

export const ChurchesTable = ({
  churches,
  onSelectChurch,
}: {
  churches: ChurchListItem[];
  onSelectChurch: (churchId: string) => void;
}) => {
  const columns = useMemo<ColumnDef<ChurchListItem>[]>(() => [
    {
      header: "Church",
      accessorKey: "name",
      cell: ({ row }) => (
        <button className="text-left font-medium text-ink transition hover:text-teal" onClick={() => onSelectChurch(row.original.churchId)}>
          {row.original.name}
        </button>
      ),
    },
    { header: "Location", cell: ({ row }) => `${row.original.city}, ${row.original.district}` },
    { header: "Pastor", accessorKey: "pastorName" },
    { header: "Members", cell: ({ row }) => formatNumber(row.original.memberCount) },
    { header: "Baptized", cell: ({ row }) => formatPercent(row.original.baptizedPercentage) },
    {
      header: "Status",
      cell: ({ row }) => (
        <Badge tone={row.original.status === "support_needed" ? "coral" : row.original.status === "new" ? "saffron" : "teal"}>
          {row.original.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
  ], [onSelectChurch]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: churches,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="section-kicker">Church List</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Visible churches</h2>
        </div>
        <Badge tone="slate">{formatNumber(churches.length)} rows</Badge>
      </div>
      <div className="table-shell overflow-x-auto">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/80">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length} className="text-center text-slate-500">
                  No churches match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export const InsightSummaryCard = ({
  summary,
  isLoading,
  onGenerate,
  compact = false,
}: {
  summary: InsightSummary | null;
  isLoading: boolean;
  onGenerate: () => void;
  compact?: boolean;
}) => (
  <Card className={cn("h-full", compact && "p-4")}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="section-kicker">AI Summary</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Narrative insight layer</h2>
      </div>
      <Button variant="accent" onClick={onGenerate} disabled={isLoading}>
        {isLoading ? "Generating..." : "Generate AI Summary"}
      </Button>
    </div>
    {summary ? (
      <div className="mt-5 grid gap-4">
        <Card muted>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">Headline</p>
          <p className="mt-2 text-base leading-7 text-slate-700">{summary.headline}</p>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Card muted>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-moss">Highlights</p>
            <ul className="mt-3 space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {summary.highlights.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </Card>
          <Card muted>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-coral">Risks</p>
            <ul className="mt-3 space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {summary.risks.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </Card>
        </div>
        <Card muted>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-saffron">Recommended Action</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{summary.recommendedAction}</p>
        </Card>
      </div>
    ) : (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-600">
        Generate a summary to turn the current filtered metrics into a grounded executive narrative.
      </div>
    )}
  </Card>
);
