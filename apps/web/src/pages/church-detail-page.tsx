import { useEffect, useMemo, useState } from "react";

import type { Member } from "@ngo/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Download, RefreshCw, Save, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "@/auth/auth-context";
import { AppHeader, ChartCard, InsightSummaryCard } from "@/components/dashboard";
import { Badge, Button, Card, Input, Select, TextArea } from "@/components/ui";
import { api } from "@/lib/api";
import { cn, downloadCsv, formatNumber, formatPercent } from "@/lib/utils";

const CHURCH_STATUS_OPTIONS = ["active", "growing", "new", "support_needed"] as const;
const GENDER_OPTIONS = ["", "male", "female", "other"] as const;

const todayDate = (): string => new Date().toISOString().slice(0, 10);

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toDateInputValue = (value: string | undefined): string => {
  if (!value) {
    return todayDate();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
};

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : "Something went wrong while loading this church workspace."
);

const statusTone = (status: string): "teal" | "saffron" | "coral" | "slate" => {
  if (status === "support_needed") {
    return "coral";
  }
  if (status === "new") {
    return "saffron";
  }
  if (status === "growing") {
    return "teal";
  }
  return "slate";
};

const churchFormSchema = z.object({
  name: z.string().min(2, "Church name is required."),
  state: z.string().min(2, "State is required."),
  district: z.string().min(2, "District is required."),
  city: z.string().min(2, "City is required."),
  address: z.string().min(5, "Address is required."),
  lat: z.number().min(0, "Latitude is required."),
  lng: z.number().min(0, "Longitude is required."),
  status: z.enum(CHURCH_STATUS_OPTIONS),
});

const pastorFormSchema = z.object({
  fullName: z.string().min(2, "Pastor name is required."),
  phone: z.string().min(7, "Phone is required."),
  joinedAt: z.string().min(1, "Join date is required."),
  baptized: z.boolean().optional(),
  notes: z.string().optional(),
});

const memberFormSchema = z.object({
  fullName: z.string().min(2, "Member name is required."),
  phone: z.string().min(7, "Phone is required."),
  age: z.number().int().min(0, "Age is required.").max(120, "Age must be realistic."),
  joinedAt: z.string().min(1, "Join date is required."),
  baptized: z.boolean(),
  gender: z.enum(GENDER_OPTIONS).optional(),
});

type ChurchFormValues = z.infer<typeof churchFormSchema>;
type PastorFormValues = z.infer<typeof pastorFormSchema>;
type MemberFormValues = z.infer<typeof memberFormSchema>;

const buildPastorDefaults = (): PastorFormValues => ({
  fullName: "",
  phone: "",
  joinedAt: todayDate(),
  baptized: false,
  notes: "",
});

const buildMemberDefaults = (): MemberFormValues => ({
  fullName: "",
  phone: "",
  age: 28,
  joinedAt: todayDate(),
  baptized: false,
  gender: "",
});

const Field = ({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
    {children}
    {error ? <span className="mt-2 block text-xs text-red-600">{error}</span> : null}
  </label>
);

const DetailStat = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
    <div className="text-2xl font-semibold text-ink">{value}</div>
    <div className="mt-1 text-sm text-slate-500">{label}</div>
  </div>
);

const ChurchDetailPage = () => {
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();
  const { currentUser, logout, session } = useAuth();
  const churchId = params.churchId;

  const [selectedPastorId, setSelectedPastorId] = useState<string>("new");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("new");

  const detailQuery = useQuery({
    queryKey: ["church-detail", churchId, session?.userId],
    enabled: Boolean(churchId && session?.userId),
    queryFn: () => api.getChurchDetail(churchId!, session!.userId),
  });

  const churchForm = useForm<ChurchFormValues>({
    resolver: zodResolver(churchFormSchema),
    defaultValues: {
      name: "",
      state: "",
      district: "",
      city: "",
      address: "",
      lat: 0,
      lng: 0,
      status: "active",
    },
  });

  const pastorForm = useForm<PastorFormValues>({
    resolver: zodResolver(pastorFormSchema),
    defaultValues: buildPastorDefaults(),
  });

  const memberForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: buildMemberDefaults(),
  });

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    churchForm.reset({
      name: detailQuery.data.church.name,
      state: detailQuery.data.church.state,
      district: detailQuery.data.church.district,
      city: detailQuery.data.church.city,
      address: detailQuery.data.church.address,
      lat: detailQuery.data.church.lat,
      lng: detailQuery.data.church.lng,
      status: detailQuery.data.church.status,
    });
  }, [churchForm, detailQuery.data]);

  useEffect(() => {
    const pastors = detailQuery.data?.pastors ?? [];
    setSelectedPastorId((current) => {
      if (current !== "new" && pastors.some((pastor) => pastor.pastorId === current)) {
        return current;
      }
      return pastors[0]?.pastorId ?? "new";
    });
  }, [detailQuery.data?.pastors]);

  useEffect(() => {
    const members = detailQuery.data?.members ?? [];
    setSelectedMemberId((current) => {
      if (current !== "new" && members.some((member) => member.memberId === current)) {
        return current;
      }
      return members[0]?.memberId ?? "new";
    });
  }, [detailQuery.data?.members]);

  const selectedPastor = useMemo(
    () => detailQuery.data?.pastors.find((pastor) => pastor.pastorId === selectedPastorId) ?? null,
    [detailQuery.data?.pastors, selectedPastorId],
  );

  const selectedMember = useMemo(
    () => detailQuery.data?.members.find((member) => member.memberId === selectedMemberId) ?? null,
    [detailQuery.data?.members, selectedMemberId],
  );

  useEffect(() => {
    pastorForm.reset(selectedPastor ? {
      fullName: selectedPastor.fullName,
      phone: selectedPastor.phone,
      joinedAt: toDateInputValue(selectedPastor.joinedAt),
      baptized: selectedPastor.baptized ?? false,
      notes: selectedPastor.notes ?? "",
    } : buildPastorDefaults());
  }, [pastorForm, selectedPastor]);

  useEffect(() => {
    memberForm.reset(selectedMember ? {
      fullName: selectedMember.fullName,
      phone: selectedMember.phone,
      age: selectedMember.age,
      joinedAt: toDateInputValue(selectedMember.joinedAt),
      baptized: selectedMember.baptized,
      gender: selectedMember.gender ?? "",
    } : buildMemberDefaults());
  }, [memberForm, selectedMember]);

  const invalidateChurchData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["church-detail", churchId] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
    ]);
  };

  const churchMutation = useMutation({
    mutationFn: (values: ChurchFormValues) => api.updateChurch(churchId!, values, session!.userId),
    onSuccess: async () => {
      await invalidateChurchData();
    },
  });

  const pastorMutation = useMutation({
    mutationFn: (values: PastorFormValues) => {
      const payload = {
        fullName: values.fullName,
        phone: values.phone,
        joinedAt: values.joinedAt,
        baptized: values.baptized,
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
      };

      if (selectedPastor) {
        return api.updatePastor(selectedPastor.pastorId, payload, session!.userId);
      }

      return api.createPastor(churchId!, payload, session!.userId);
    },
    onSuccess: async (pastor) => {
      setSelectedPastorId(pastor.pastorId);
      await invalidateChurchData();
    },
  });

  const memberMutation = useMutation({
    mutationFn: (values: MemberFormValues) => {
      const payload = {
        fullName: values.fullName,
        phone: values.phone,
        age: values.age,
        joinedAt: values.joinedAt,
        baptized: values.baptized,
        gender: values.gender || undefined,
      };

      if (selectedMember) {
        return api.updateMember(selectedMember.memberId, payload, session!.userId);
      }

      return api.createMember(churchId!, payload, session!.userId);
    },
    onSuccess: async (member) => {
      setSelectedMemberId(member.memberId);
      await invalidateChurchData();
    },
  });

  const summaryMutation = useMutation({
    mutationFn: () => api.getInsightSummary({ churchId: churchId! }, session!.userId),
  });

  const detailData = detailQuery.data;
  const baptizedCount = detailData?.analytics.baptismBreakdown.find((item) => item.label === "Baptized")?.value ?? 0;
  const membersSorted = useMemo(
    () => [...(detailData?.members ?? [])].sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [detailData?.members],
  );

  const memberColumns = useMemo<ColumnDef<Member>[]>(() => [
    {
      header: "Member",
      accessorKey: "fullName",
      cell: ({ row }) => (
        <button
          type="button"
          className="text-left font-medium text-ink transition hover:text-teal"
          onClick={() => setSelectedMemberId(row.original.memberId)}
        >
          {row.original.fullName}
        </button>
      ),
    },
    { header: "Phone", accessorKey: "phone" },
    { header: "Age", cell: ({ row }) => formatNumber(row.original.age) },
    { header: "Gender", cell: ({ row }) => row.original.gender ?? "-" },
    { header: "Joined", cell: ({ row }) => formatDate(row.original.joinedAt) },
    {
      header: "Baptized",
      cell: ({ row }) => (
        <Badge tone={row.original.baptized ? "teal" : "saffron"}>
          {row.original.baptized ? "Yes" : "No"}
        </Badge>
      ),
    },
  ], []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const memberTable = useReactTable({
    data: membersSorted,
    columns: memberColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const exportMembers = () => {
    if (!detailData) {
      return;
    }

    downloadCsv(
      `${detailData.church.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-members.csv`,
      ["Full Name", "Phone", "Age", "Gender", "Joined At", "Baptized"],
      membersSorted.map((member) => [
        member.fullName,
        member.phone,
        member.age,
        member.gender ?? "",
        member.joinedAt,
        member.baptized ? "Yes" : "No",
      ]),
    );
  };

  if (!currentUser || !session) {
    return null;
  }

  if (!churchId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <Card className="max-w-lg text-center">
          <h1 className="text-2xl font-semibold text-ink">Church detail route is missing an id</h1>
          <Button className="mt-5" onClick={() => navigate("/")}>Back to dashboard</Button>
        </Card>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <Card className="max-w-xl text-center">
          <p className="section-kicker">Loading Church Detail</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">Preparing the leader workspace</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Pulling church profile, roster data, church-level analytics, and scoped AI summary controls.
          </p>
        </Card>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="min-h-screen px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <AppHeader currentUser={currentUser} onLogout={logout} />
          <Card className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-ink">This church could not be opened</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{getErrorMessage(detailQuery.error)}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button variant="secondary" className="gap-2" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </Button>
              <Button className="gap-2" onClick={() => void detailQuery.refetch()}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const detail = detailQuery.data;

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <AppHeader currentUser={currentUser} onLogout={logout} />

        <Card className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Button variant="secondary" className="gap-2" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
            <p className="section-kicker mt-5">Church Operating View</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-ink md:text-4xl">{detail.church.name}</h1>
              <Badge tone={statusTone(detail.church.status)}>{detail.church.status.replace(/_/g, " ")}</Badge>
              <Badge tone={currentUser.role === "super_admin" ? "saffron" : "teal"}>
                {currentUser.role === "super_admin" ? "Super Admin Access" : "Church Leader Scope"}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {detail.church.city}, {detail.church.district}, {detail.church.state}. Use this workspace to update core
              records, inspect the congregation profile, export member data, and generate a grounded AI narrative.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone="slate">Created {formatDate(detail.church.createdAt)}</Badge>
              <Badge tone="slate">Updated {formatDate(detail.church.updatedAt)}</Badge>
            </div>
          </div>

          <div className="grid gap-4 rounded-xl2 border border-slate-200 bg-mist/70 p-5 md:grid-cols-2 lg:grid-cols-2">
            <DetailStat label="Pastors linked" value={formatNumber(detail.pastors.length)} />
            <DetailStat label="Members in roster" value={formatNumber(detail.members.length)} />
            <DetailStat label="Baptized share" value={formatPercent(detail.members.length ? (baptizedCount / detail.members.length) * 100 : 0)} />
            <DetailStat label="Member records ready for CSV export" value={formatNumber(detail.members.length)} />
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Church Profile</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Edit the core operating record</h2>
              </div>
              <Badge tone="slate">Scope-safe update</Badge>
            </div>

            <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={churchForm.handleSubmit((values) => churchMutation.mutate(values))}>
              <Field label="Church Name" error={churchForm.formState.errors.name?.message}>
                <Input {...churchForm.register("name")} />
              </Field>
              <Field label="Status" error={churchForm.formState.errors.status?.message}>
                <Select {...churchForm.register("status")}>
                  {CHURCH_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
                  ))}
                </Select>
              </Field>
              <Field label="State" error={churchForm.formState.errors.state?.message}>
                <Input {...churchForm.register("state")} />
              </Field>
              <Field label="District" error={churchForm.formState.errors.district?.message}>
                <Input {...churchForm.register("district")} />
              </Field>
              <Field label="City" error={churchForm.formState.errors.city?.message}>
                <Input {...churchForm.register("city")} />
              </Field>
              <Field label="Latitude" error={churchForm.formState.errors.lat?.message}>
                <Input type="number" step="any" {...churchForm.register("lat", { valueAsNumber: true })} />
              </Field>
              <Field label="Longitude" error={churchForm.formState.errors.lng?.message}>
                <Input type="number" step="any" {...churchForm.register("lng", { valueAsNumber: true })} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Address" error={churchForm.formState.errors.address?.message}>
                  <TextArea {...churchForm.register("address")} />
                </Field>
              </div>
              {churchMutation.isError ? (
                <p className="md:col-span-2 text-sm text-red-600">{getErrorMessage(churchMutation.error)}</p>
              ) : null}
              <div className="md:col-span-2 flex justify-end">
                <Button className="gap-2" type="submit" disabled={churchMutation.isPending}>
                  <Save className="h-4 w-4" />
                  {churchMutation.isPending ? "Saving church..." : "Save church profile"}
                </Button>
              </div>
            </form>
          </Card>

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
                    AI summary generation failed, but church analytics and forms are still available. {getErrorMessage(summaryMutation.error)}
                  </p>
                </div>
              </Card>
            ) : null}
            <Card muted>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">How to use this page</p>
              <ul className="mt-3 space-y-2 pl-5 text-sm leading-6 text-slate-700">
                <li>Use the profile form for small metadata updates without touching the seed reset flow.</li>
                <li>Edit the pastor roster and member records directly from this page for demo realism.</li>
                <li>Export the exact member table to CSV and use the AI summary only when you want a short narrative.</li>
              </ul>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <ChartCard
            title="Baptized vs not baptized"
            type="pie"
            items={detail.analytics.baptismBreakdown}
            color="#0f766e"
          />
          <ChartCard
            title="Age-band distribution"
            type="bar"
            items={detail.analytics.ageDistribution}
            color="#2f855a"
          />
          <ChartCard
            title="Join-year trend"
            type="line"
            items={detail.analytics.joinYearTrend}
            color="#f29f05"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="section-kicker">Member Roster</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Church members</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Select a row to edit a person, or create a new member in the side panel.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="gap-2" type="button" onClick={exportMembers} disabled={!membersSorted.length}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="secondary" type="button" onClick={() => setSelectedMemberId("new")}>
                  New member
                </Button>
              </div>
            </div>

            <div className="mt-5 table-shell overflow-x-auto">
              <table>
                <thead>
                  {memberTable.getHeaderGroups().map((headerGroup) => (
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
                  {memberTable.getRowModel().rows.length ? memberTable.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "cursor-pointer transition hover:bg-slate-50/80",
                        row.original.memberId === selectedMemberId && "bg-teal/5",
                      )}
                      onClick={() => setSelectedMemberId(row.original.memberId)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={memberColumns.length} className="text-center text-slate-500">
                        No members are available for this church yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Member Editor</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">
                  {selectedMember ? `Update ${selectedMember.fullName}` : "Create a new member"}
                </h2>
              </div>
              <Badge tone={selectedMember ? "teal" : "saffron"}>{selectedMember ? "Editing" : "New record"}</Badge>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={memberForm.handleSubmit((values) => memberMutation.mutate(values))}>
              <Field label="Full Name" error={memberForm.formState.errors.fullName?.message}>
                <Input {...memberForm.register("fullName")} />
              </Field>
              <Field label="Phone" error={memberForm.formState.errors.phone?.message}>
                <Input {...memberForm.register("phone")} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Age" error={memberForm.formState.errors.age?.message}>
                  <Input type="number" {...memberForm.register("age", { valueAsNumber: true })} />
                </Field>
                <Field label="Joined At" error={memberForm.formState.errors.joinedAt?.message}>
                  <Input type="date" {...memberForm.register("joinedAt")} />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Gender">
                  <Select {...memberForm.register("gender")}>
                    <option value="">Not specified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
                <Field label="Baptized">
                  <Select
                    value={memberForm.watch("baptized") ? "yes" : "no"}
                    onChange={(event) => memberForm.setValue("baptized", event.target.value === "yes")}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </Select>
                </Field>
              </div>
              {memberMutation.isError ? (
                <p className="text-sm text-red-600">{getErrorMessage(memberMutation.error)}</p>
              ) : null}
              <div className="flex flex-wrap justify-between gap-3">
                <Button variant="secondary" type="button" onClick={() => setSelectedMemberId("new")}>
                  Clear form
                </Button>
                <Button className="gap-2" type="submit" disabled={memberMutation.isPending}>
                  <Save className="h-4 w-4" />
                  {memberMutation.isPending ? "Saving member..." : selectedMember ? "Save member" : "Create member"}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-kicker">Pastor Roster</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Pastoral records</h2>
              </div>
              <Button variant="secondary" type="button" onClick={() => setSelectedPastorId("new")}>
                New pastor
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {detail.pastors.length ? detail.pastors.map((pastor) => (
                <button
                  key={pastor.pastorId}
                  type="button"
                  className={cn(
                    "w-full rounded-2xl border px-4 py-4 text-left transition",
                    pastor.pastorId === selectedPastorId
                      ? "border-teal bg-teal/5"
                      : "border-slate-200 bg-white hover:border-teal/60",
                  )}
                  onClick={() => setSelectedPastorId(pastor.pastorId)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-ink">{pastor.fullName}</div>
                      <div className="mt-1 text-sm text-slate-500">{pastor.phone}</div>
                      <div className="mt-2 text-sm text-slate-600">Joined {formatDate(pastor.joinedAt)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {detail.church.pastorId === pastor.pastorId ? <Badge tone="saffron">Primary</Badge> : null}
                      <Badge tone={pastor.baptized ? "teal" : "slate"}>
                        {pastor.baptized ? "Baptized" : "Profile only"}
                      </Badge>
                    </div>
                  </div>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                  No pastor record is saved yet for this church.
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Pastor Editor</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">
                  {selectedPastor ? `Update ${selectedPastor.fullName}` : "Create a pastor record"}
                </h2>
              </div>
              <Badge tone={selectedPastor ? "teal" : "saffron"}>{selectedPastor ? "Editing" : "New record"}</Badge>
            </div>

            <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={pastorForm.handleSubmit((values) => pastorMutation.mutate(values))}>
              <Field label="Full Name" error={pastorForm.formState.errors.fullName?.message}>
                <Input {...pastorForm.register("fullName")} />
              </Field>
              <Field label="Phone" error={pastorForm.formState.errors.phone?.message}>
                <Input {...pastorForm.register("phone")} />
              </Field>
              <Field label="Joined At" error={pastorForm.formState.errors.joinedAt?.message}>
                <Input type="date" {...pastorForm.register("joinedAt")} />
              </Field>
              <Field label="Baptized">
                <Select
                  value={pastorForm.watch("baptized") ? "yes" : "no"}
                  onChange={(event) => pastorForm.setValue("baptized", event.target.value === "yes")}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes">
                  <TextArea {...pastorForm.register("notes")} />
                </Field>
              </div>
              {pastorMutation.isError ? (
                <p className="md:col-span-2 text-sm text-red-600">{getErrorMessage(pastorMutation.error)}</p>
              ) : null}
              <div className="md:col-span-2 flex flex-wrap justify-between gap-3">
                <Button variant="secondary" type="button" onClick={() => setSelectedPastorId("new")}>
                  Clear form
                </Button>
                <Button className="gap-2" type="submit" disabled={pastorMutation.isPending}>
                  <Save className="h-4 w-4" />
                  {pastorMutation.isPending ? "Saving pastor..." : selectedPastor ? "Save pastor" : "Create pastor"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChurchDetailPage;
