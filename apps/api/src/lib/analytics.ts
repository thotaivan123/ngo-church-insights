import type {
  Church,
  ChurchAnalytics,
  ChurchListItem,
  DashboardFilters,
  DashboardOverview,
  Member,
  Pastor,
  UserProfile,
} from "@ngo/shared";

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];

const toPercent = (value: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }
  return Number(((value / total) * 100).toFixed(1));
};

const ageBandFor = (age: number): string => {
  if (age <= 12) return "0-12";
  if (age <= 17) return "13-17";
  if (age <= 25) return "18-25";
  if (age <= 40) return "26-40";
  if (age <= 60) return "41-60";
  return "60+";
};

const toJoinYear = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }
  return String(parsed.getFullYear());
};

const aggregate = (values: string[]): Array<{ label: string; value: number }> => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
};

const sortLabels = (values: Iterable<string>): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const filterChurchesForUser = (churches: Church[], user: UserProfile): Church[] => {
  if (user.role === "super_admin") {
    return churches;
  }
  if (!user.churchId) {
    return [];
  }
  return churches.filter((church) => church.churchId === user.churchId);
};

export const applyDashboardFilters = (churches: Church[], filters: DashboardFilters): Church[] => (
  churches.filter((church) => {
    if (filters.state && church.state !== filters.state) return false;
    if (filters.district && church.district !== filters.district) return false;
    if (filters.city && church.city !== filters.city) return false;
    if (filters.churchId && church.churchId !== filters.churchId) return false;
    return true;
  })
);

export const buildFilterOptions = (churches: Church[], filters: DashboardFilters): DashboardOverview["filters"] => {
  const stateScoped = filters.state ? churches.filter((church) => church.state === filters.state) : churches;
  const districtScoped = filters.district ? stateScoped.filter((church) => church.district === filters.district) : stateScoped;
  const cityScoped = filters.city ? districtScoped.filter((church) => church.city === filters.city) : districtScoped;

  return {
    states: sortLabels(churches.map((church) => church.state)),
    districts: sortLabels(stateScoped.map((church) => church.district)),
    cities: sortLabels(districtScoped.map((church) => church.city)),
    churches: cityScoped
      .map((church) => ({ churchId: church.churchId, name: church.name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
};

export const buildChurchListItems = (churches: Church[], pastors: Pastor[], members: Member[]): ChurchListItem[] => {
  const pastorNameByChurch = new Map<string, string | null>();
  pastors.forEach((pastor) => {
    if (!pastorNameByChurch.has(pastor.churchId)) {
      pastorNameByChurch.set(pastor.churchId, pastor.fullName);
    }
  });

  const membersByChurch = new Map<string, Member[]>();
  members.forEach((member) => {
    const bucket = membersByChurch.get(member.churchId) ?? [];
    bucket.push(member);
    membersByChurch.set(member.churchId, bucket);
  });

  return churches
    .map((church) => {
      const churchMembers = membersByChurch.get(church.churchId) ?? [];
      const baptized = churchMembers.filter((member) => member.baptized).length;
      return {
        churchId: church.churchId,
        name: church.name,
        state: church.state,
        district: church.district,
        city: church.city,
        pastorName: pastorNameByChurch.get(church.churchId) ?? null,
        memberCount: churchMembers.length,
        baptizedPercentage: toPercent(baptized, churchMembers.length),
        status: church.status,
      };
    })
    .sort((left, right) => right.memberCount - left.memberCount || left.name.localeCompare(right.name));
};

export const buildChurchAnalytics = (members: Member[]): ChurchAnalytics => ({
  baptismBreakdown: [
    { label: "Baptized", value: members.filter((member) => member.baptized).length },
    { label: "Not Baptized", value: members.filter((member) => !member.baptized).length },
  ],
  ageDistribution: aggregate(members.map((member) => ageBandFor(member.age))),
  joinYearTrend: aggregate(members.map((member) => toJoinYear(member.joinedAt)))
    .sort((left, right) => left.label.localeCompare(right.label)),
});

export const buildDashboardOverview = (
  filteredChurches: Church[],
  filteredPastors: Pastor[],
  filteredMembers: Member[],
  accessibleChurches: Church[],
  filters: DashboardFilters,
): DashboardOverview => {
  const churchListItems = buildChurchListItems(filteredChurches, filteredPastors, filteredMembers);
  const membersByChurch = new Map<string, Member[]>();
  filteredMembers.forEach((member) => {
    const bucket = membersByChurch.get(member.churchId) ?? [];
    bucket.push(member);
    membersByChurch.set(member.churchId, bucket);
  });

  const districtCounts = new Map<string, number>();
  filteredChurches.forEach((church) => {
    districtCounts.set(
      church.district,
      (districtCounts.get(church.district) ?? 0) + (membersByChurch.get(church.churchId)?.length ?? 0),
    );
  });

  const baptizedCount = filteredMembers.filter((member) => member.baptized).length;

  return {
    filters: buildFilterOptions(accessibleChurches, filters),
    kpis: {
      totalChurches: filteredChurches.length,
      totalPastors: filteredPastors.length,
      totalMembers: filteredMembers.length,
      baptizedPercentage: toPercent(baptizedCount, filteredMembers.length),
      citiesCovered: new Set(filteredChurches.map((church) => church.city)).size,
      districtsCovered: new Set(filteredChurches.map((church) => church.district)).size,
    },
    map: {
      center: INDIA_CENTER,
      zoom: 5,
      markers: filteredChurches.map((church) => {
        const churchSummary = churchListItems.find((item) => item.churchId === church.churchId);
        return {
          churchId: church.churchId,
          name: church.name,
          state: church.state,
          district: church.district,
          city: church.city,
          lat: church.lat,
          lng: church.lng,
          pastorName: churchSummary?.pastorName ?? null,
          memberCount: churchSummary?.memberCount ?? 0,
          baptizedPercentage: churchSummary?.baptizedPercentage ?? 0,
          status: church.status,
        };
      }),
    },
    charts: {
      topDistricts: [...districtCounts.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value)
        .slice(0, 8),
      baptismBreakdown: [
        { label: "Baptized", value: baptizedCount },
        { label: "Not Baptized", value: filteredMembers.length - baptizedCount },
      ],
      ageDistribution: aggregate(filteredMembers.map((member) => ageBandFor(member.age))),
      joinYearTrend: aggregate(filteredMembers.map((member) => toJoinYear(member.joinedAt)))
        .sort((left, right) => left.label.localeCompare(right.label)),
    },
    churches: churchListItems,
  };
};
