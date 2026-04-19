import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Church, Member, Pastor, UserProfile } from "@ngo/shared";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../..");
const generatedDir = path.join(repoRoot, "data", "generated");

const maleNames = ["Aarav", "Rohan", "Samuel", "Daniel", "Joshua", "Nathan", "Joseph", "David", "Arjun", "Isaac", "Noah", "Moses"];
const femaleNames = ["Ananya", "Ruth", "Miriam", "Esther", "Deborah", "Sarah", "Rebecca", "Priya", "Grace", "Naomi", "Hannah", "Lydia"];
const surnames = ["Varghese", "Mathew", "Joseph", "Das", "Nair", "George", "Paul", "D'Souza", "Kumar", "Fernandes", "Singh", "Raj"];
const churchPrefixes = ["Grace", "New Life", "Hope", "Covenant", "Living Waters", "Faith", "Cornerstone", "Restoration", "Harvest", "Redeemer"];

const locations = [
  { state: "Delhi", district: "New Delhi", city: "New Delhi", lat: 28.6139, lng: 77.2090 },
  { state: "Maharashtra", district: "Mumbai", city: "Mumbai", lat: 19.0760, lng: 72.8777 },
  { state: "Karnataka", district: "Bengaluru Urban", city: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { state: "Tamil Nadu", district: "Chennai", city: "Chennai", lat: 13.0827, lng: 80.2707 },
  { state: "West Bengal", district: "Kolkata", city: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { state: "Telangana", district: "Hyderabad", city: "Hyderabad", lat: 17.3850, lng: 78.4867 },
  { state: "Maharashtra", district: "Pune", city: "Pune", lat: 18.5204, lng: 73.8567 },
  { state: "Kerala", district: "Ernakulam", city: "Kochi", lat: 9.9312, lng: 76.2673 },
  { state: "Rajasthan", district: "Jaipur", city: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { state: "Uttar Pradesh", district: "Lucknow", city: "Lucknow", lat: 26.8467, lng: 80.9462 },
  { state: "Assam", district: "Kamrup Metropolitan", city: "Guwahati", lat: 26.1445, lng: 91.7362 },
  { state: "Odisha", district: "Khorda", city: "Bhubaneswar", lat: 20.2961, lng: 85.8245 },
  { state: "Madhya Pradesh", district: "Indore", city: "Indore", lat: 22.7196, lng: 75.8577 },
  { state: "Madhya Pradesh", district: "Bhopal", city: "Bhopal", lat: 23.2599, lng: 77.4126 },
  { state: "Chandigarh", district: "Chandigarh", city: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  { state: "Bihar", district: "Patna", city: "Patna", lat: 25.5941, lng: 85.1376 },
  { state: "Jharkhand", district: "Ranchi", city: "Ranchi", lat: 23.3441, lng: 85.3096 },
  { state: "Maharashtra", district: "Nagpur", city: "Nagpur", lat: 21.1458, lng: 79.0882 },
  { state: "Andhra Pradesh", district: "Visakhapatnam", city: "Visakhapatnam", lat: 17.6868, lng: 83.2185 },
  { state: "Gujarat", district: "Ahmedabad", city: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
] as const;

const mulberry32 = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const random = mulberry32(20260410);

const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];

const randomPhone = (): string => {
  const prefix = ["9", "8", "7"][Math.floor(random() * 3)];
  const remaining = Array.from({ length: 9 }, () => Math.floor(random() * 10)).join("");
  return `${prefix}${remaining}`;
};

const randomDate = (yearStart: number, yearEnd: number): string => {
  const year = yearStart + Math.floor(random() * (yearEnd - yearStart + 1));
  const month = 1 + Math.floor(random() * 12);
  const day = 1 + Math.floor(random() * 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const randomName = (gender: "male" | "female"): string => {
  const first = gender === "male" ? pick(maleNames) : pick(femaleNames);
  return `${first} ${pick(surnames)}`;
};

const escapeCsv = (value: unknown): string => {
  const text = value == null ? "" : String(value);
  return /[,"\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
};

const toCsv = <T extends Record<string, unknown>>(rows: T[]): string => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ];
  return `${lines.join("\n")}\n`;
};

const main = async () => {
  await fs.mkdir(generatedDir, { recursive: true });

  const churches: Church[] = [];
  const pastors: Pastor[] = [];
  const members: Member[] = [];

  let churchCounter = 1;
  let pastorCounter = 1;
  let memberCounter = 1;

  for (const location of locations) {
    for (let index = 0; index < 15; index += 1) {
      const churchId = `church-${String(churchCounter).padStart(3, "0")}`;
      const pastorId = `pastor-${String(pastorCounter).padStart(3, "0")}`;
      const churchName = `${pick(churchPrefixes)} Church ${location.city} ${index + 1}`;
      const createdAt = randomDate(2012, 2024);
      const updatedAt = randomDate(2024, 2026);

      churches.push({
        churchId,
        name: churchName,
        state: location.state,
        district: location.district,
        city: location.city,
        address: `${10 + index}, ${location.city} Community Road`,
        lat: Number((location.lat + ((random() - 0.5) * 0.18)).toFixed(6)),
        lng: Number((location.lng + ((random() - 0.5) * 0.18)).toFixed(6)),
        pastorId,
        status: pick(["active", "growing", "new", "support_needed"]),
        createdAt,
        updatedAt,
      });

      pastors.push({
        pastorId,
        churchId,
        fullName: randomName("male"),
        phone: randomPhone(),
        joinedAt: randomDate(2010, 2025),
        baptized: true,
        notes: index % 4 === 0 ? "Oversees youth and outreach programs." : "Leads weekly services and community care.",
      });

      const memberCount = 20 + Math.floor(random() * 21);
      for (let memberIndex = 0; memberIndex < memberCount; memberIndex += 1) {
        const gender = random() > 0.48 ? "female" : "male";
        const joinedAt = randomDate(2014, 2026);
        members.push({
          memberId: `member-${String(memberCounter).padStart(5, "0")}`,
          churchId,
          fullName: randomName(gender),
          phone: randomPhone(),
          age: 8 + Math.floor(random() * 67),
          joinedAt,
          baptized: random() > 0.35,
          gender,
        });
        memberCounter += 1;
      }

      churchCounter += 1;
      pastorCounter += 1;
    }
  }

  const users: UserProfile[] = [
    {
      userId: "user-super-admin",
      role: "super_admin",
      churchId: null,
      displayName: "National Admin",
      email: "admin@ngo.demo",
    },
    {
      userId: "user-leader-delhi",
      role: "church_leader",
      churchId: churches[0]?.churchId ?? null,
      displayName: "Pastor Samuel Delhi",
      email: "leader.delhi@ngo.demo",
    },
    {
      userId: "user-leader-mumbai",
      role: "church_leader",
      churchId: churches[15]?.churchId ?? null,
      displayName: "Pastor Daniel Mumbai",
      email: "leader.mumbai@ngo.demo",
    },
    {
      userId: "user-leader-bengaluru",
      role: "church_leader",
      churchId: churches[30]?.churchId ?? null,
      displayName: "Pastor Joshua Bengaluru",
      email: "leader.bengaluru@ngo.demo",
    },
  ];

  await fs.writeFile(path.join(generatedDir, "churches.json"), `${JSON.stringify(churches, null, 2)}\n`, "utf-8");
  await fs.writeFile(path.join(generatedDir, "pastors.json"), `${JSON.stringify(pastors, null, 2)}\n`, "utf-8");
  await fs.writeFile(path.join(generatedDir, "members.json"), `${JSON.stringify(members, null, 2)}\n`, "utf-8");
  await fs.writeFile(path.join(generatedDir, "users.json"), `${JSON.stringify(users, null, 2)}\n`, "utf-8");

  await fs.writeFile(path.join(generatedDir, "churches.csv"), toCsv(churches as unknown as Record<string, unknown>[]), "utf-8");
  await fs.writeFile(path.join(generatedDir, "pastors.csv"), toCsv(pastors as unknown as Record<string, unknown>[]), "utf-8");
  await fs.writeFile(path.join(generatedDir, "members.csv"), toCsv(members as unknown as Record<string, unknown>[]), "utf-8");
  await fs.writeFile(path.join(generatedDir, "users.csv"), toCsv(users as unknown as Record<string, unknown>[]), "utf-8");

  console.log(`Generated ${churches.length} churches, ${pastors.length} pastors, ${members.length} members, ${users.length} users.`);
};

await main();
