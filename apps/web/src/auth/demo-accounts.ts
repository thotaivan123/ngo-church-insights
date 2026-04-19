export const DEMO_PASSWORD = "Demo@12345";

export const DEMO_ACCOUNTS = [
  {
    userId: "user-super-admin",
    email: "admin@ngo.demo",
    password: DEMO_PASSWORD,
    label: "National Admin",
    roleLabel: "Super Admin",
    helperText: "Full network visibility across all 300 churches.",
  },
  {
    userId: "user-leader-delhi",
    email: "leader.delhi@ngo.demo",
    password: DEMO_PASSWORD,
    label: "Delhi Church Leader",
    roleLabel: "Church Leader",
    helperText: "Scoped to one church in New Delhi.",
  },
  {
    userId: "user-leader-mumbai",
    email: "leader.mumbai@ngo.demo",
    password: DEMO_PASSWORD,
    label: "Mumbai Church Leader",
    roleLabel: "Church Leader",
    helperText: "Scoped to one church in Mumbai.",
  },
  {
    userId: "user-leader-bengaluru",
    email: "leader.bengaluru@ngo.demo",
    password: DEMO_PASSWORD,
    label: "Bengaluru Church Leader",
    roleLabel: "Church Leader",
    helperText: "Scoped to one church in Bengaluru.",
  },
] as const;
