import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { budgets, companies, expenses, followUps, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { classifyVariance } from "../shared/variance";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getOrCreateCompany(ownerId: number, ownerName?: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(companies).where(eq(companies.ownerId, ownerId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(companies).values({ ownerId, name: ownerName ? `${ownerName} Workspace` : "Company Workspace", currency: "SAR" });
  const created = await db.select().from(companies).where(eq(companies.ownerId, ownerId)).limit(1);
  if (!created[0]) throw new Error("Could not create company workspace");
  return created[0];
}

const num = (v: unknown) => Number(v ?? 0);
const key = (period: string, dept: string, cat: string) => `${period}|${dept}|${cat}`;

export async function getCompanySnapshot(companyId: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const [budgetRows, expenseRows, followRows] = await Promise.all([
    db.select().from(budgets).where(eq(budgets.companyId, companyId)).orderBy(desc(budgets.period), asc(budgets.department)),
    db.select().from(expenses).where(eq(expenses.companyId, companyId)).orderBy(desc(expenses.expenseDate)),
    db.select().from(followUps).where(eq(followUps.companyId, companyId)).orderBy(desc(followUps.createdAt)),
  ]);
  const budgetMap = new Map<string, number>();
  for (const b of budgetRows) budgetMap.set(key(b.period, b.department, b.expenseCategory), num(b.estimatedAmount));
  const actualMap = new Map<string, number>();
  for (const e of expenseRows) {
    const k = key(e.period, e.department, e.expenseCategory);
    actualMap.set(k, (actualMap.get(k) ?? 0) + num(e.actualAmount));
  }
  const lineMap = new Map<string, { period:string; department:string; expenseCategory:string; estimatedAmount:number; actualAmount:number; varianceAmount:number; variancePercent:number; utilizationPercent:number }>();
  for (const [k, estimatedAmount] of Array.from(budgetMap.entries())) {
    const [period, department, expenseCategory] = k.split("|");
    const actualAmount = actualMap.get(k) ?? 0;
    const varianceAmount = actualAmount - estimatedAmount;
    lineMap.set(k, { period, department, expenseCategory, estimatedAmount, actualAmount, varianceAmount, variancePercent: estimatedAmount ? (varianceAmount / estimatedAmount) * 100 : 0, utilizationPercent: estimatedAmount ? (actualAmount / estimatedAmount) * 100 : 0 });
  }
  const lines = Array.from(lineMap.values()).sort((a,b) => b.varianceAmount - a.varianceAmount);
  const totalEstimated = lines.reduce((s, r) => s + r.estimatedAmount, 0);
  const totalActual = lines.reduce((s, r) => s + r.actualAmount, 0);
  const byDepartment = new Map<string, { department:string; estimatedAmount:number; actualAmount:number; varianceAmount:number }>();
  const byCategory = new Map<string, { expenseCategory:string; estimatedAmount:number; actualAmount:number; varianceAmount:number }>();
  const byMonth = new Map<string, { period:string; estimatedAmount:number; actualAmount:number; varianceAmount:number }>();
  for (const r of lines) {
    const d = byDepartment.get(r.department) ?? { department:r.department, estimatedAmount:0, actualAmount:0, varianceAmount:0 }; d.estimatedAmount += r.estimatedAmount; d.actualAmount += r.actualAmount; d.varianceAmount += r.varianceAmount; byDepartment.set(r.department,d);
    const c = byCategory.get(r.expenseCategory) ?? { expenseCategory:r.expenseCategory, estimatedAmount:0, actualAmount:0, varianceAmount:0 }; c.estimatedAmount += r.estimatedAmount; c.actualAmount += r.actualAmount; c.varianceAmount += r.varianceAmount; byCategory.set(r.expenseCategory,c);
    const m = byMonth.get(r.period) ?? { period:r.period, estimatedAmount:0, actualAmount:0, varianceAmount:0 }; m.estimatedAmount += r.estimatedAmount; m.actualAmount += r.actualAmount; m.varianceAmount += r.varianceAmount; byMonth.set(r.period,m);
  }
  const existingFollowUpKeys = new Set(followRows.map(r => key(r.period, r.department, r.expenseCategory)));
  const materialLines = lines.filter(r => ["High", "Medium"].includes(classifyVariance(r.varianceAmount, r.variancePercent)));
  const missingFollowUps = materialLines.filter(r => !existingFollowUpKeys.has(key(r.period, r.department, r.expenseCategory)));
  if (missingFollowUps.length) {
    await db.insert(followUps).values(missingFollowUps.map(r => ({
      companyId,
      period: r.period,
      department: r.department,
      expenseCategory: r.expenseCategory,
      estimatedAmount: r.estimatedAmount.toFixed(2),
      actualAmount: r.actualAmount.toFixed(2),
      varianceAmount: r.varianceAmount.toFixed(2),
      variancePercent: r.variancePercent.toFixed(2),
      priority: classifyVariance(r.varianceAmount, r.variancePercent) as "High" | "Medium",
      reason: "Material or percentage variance above the monitoring threshold.",
      recommendedAction: "Obtain explanation, validate forecast assumptions, and document management action.",
      status: "Open" as const,
    })));
    followRows.push(...await db.select().from(followUps).where(eq(followUps.companyId, companyId)));
  }
  return {
    company: (await db.select().from(companies).where(eq(companies.id, companyId)).limit(1))[0],
    summary: { totalEstimated, totalActual, totalVariance: totalActual-totalEstimated, utilizationPercent: totalEstimated ? (totalActual/totalEstimated)*100 : 0, transactionCount: expenseRows.length, followUpCount: followRows.length, highPriorityCount: followRows.filter(r=>r.priority==='High' && r.status!=='Closed').length },
    budgets: budgetRows,
    expenses: expenseRows,
    followUps: followRows,
    varianceLines: lines,
    byDepartment: Array.from(byDepartment.values()).sort((a,b)=>b.varianceAmount-a.varianceAmount),
    byCategory: Array.from(byCategory.values()).sort((a,b)=>b.varianceAmount-a.varianceAmount),
    byMonth: Array.from(byMonth.values()).sort((a,b)=>a.period.localeCompare(b.period)),
  };
}

export async function seedCompanyDemo(companyId: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const existing = await db.select({ id: budgets.id }).from(budgets).where(eq(budgets.companyId, companyId)).limit(1);
  if (existing[0]) return false;
  const rows = [
    ['2026-01','Operations','Maintenance',12000],['2026-01','Operations','Utilities',8500],['2026-01','Sales','Travel',14000],['2026-01','IT','Software & Subscriptions',10500],
    ['2026-02','Operations','Maintenance',12000],['2026-02','Operations','Utilities',8500],['2026-02','Sales','Travel',14000],['2026-02','IT','Software & Subscriptions',10500],
    ['2026-03','Operations','Maintenance',12000],['2026-03','Operations','Utilities',8500],['2026-03','Sales','Travel',14000],['2026-03','IT','Software & Subscriptions',10500],
    ['2026-04','Operations','Maintenance',12000],['2026-04','Operations','Utilities',8500],['2026-04','Sales','Travel',14000],['2026-04','IT','Software & Subscriptions',10500],
    ['2026-05','Operations','Maintenance',12000],['2026-05','Operations','Utilities',8500],['2026-05','Sales','Travel',14000],['2026-05','IT','Software & Subscriptions',10500],
    ['2026-06','Operations','Maintenance',12000],['2026-06','Operations','Utilities',8500],['2026-06','Sales','Travel',14000],['2026-06','IT','Software & Subscriptions',10500],
  ] as const;
  await db.insert(budgets).values(rows.map(([period,department,expenseCategory,estimatedAmount]) => ({ companyId, period, department, expenseCategory, estimatedAmount: estimatedAmount.toFixed(2), notes: 'Synthetic demo budget' })));
  const expensesToInsert = rows.map(([period,department,expenseCategory,estimatedAmount], i) => {
    const multiplier = (department === 'Operations' && expenseCategory === 'Maintenance' && ['2026-03','2026-04'].includes(period)) ? 1.55 : (department === 'Sales' && expenseCategory === 'Travel' && ['2026-05','2026-06'].includes(period) ? 1.36 : 0.96 + (i % 4) * 0.025);
    return { companyId, transactionId:`DEMO-${String(i+1).padStart(4,'0')}`, expenseDate:new Date(`${period}-${String(5+(i%20)).padStart(2,'0')}T00:00:00Z`), period, department, expenseCategory, description:`${expenseCategory} - ${department} demo transaction`, actualAmount:(estimatedAmount*multiplier).toFixed(2), paymentMethod:i%3===0?'Bank Transfer':i%3===1?'Corporate Card':'Petty Cash', supportingDocument:i%7===0?'Pending Review':'Available' as 'Available'|'Pending Review' };
  });
  await db.insert(expenses).values(expensesToInsert);
  return true;
}
