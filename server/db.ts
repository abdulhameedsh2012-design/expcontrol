import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { classifyVariance } from "../shared/variance";
import { getSupabaseClient } from "./supabase";

let _db: ReturnType<typeof drizzle> | null = null;

/** MySQL remains only for Manus OAuth user records during the transition. */
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

type CompanyRow = { id: number; owner_id: number; name: string; currency: string; created_at: string; updated_at: string };
type BudgetRow = { id: number; company_id: number; period: string; department: string; expense_category: string; estimated_amount: string | number; notes: string | null; created_at: string; updated_at: string };
type ExpenseRow = { id: number; company_id: number; transaction_id: string; expense_date: string; period: string; department: string; expense_category: string; description: string | null; actual_amount: string | number; payment_method: string; supporting_document: "Available" | "Pending Review"; created_at: string };
type FollowUpRow = { id: number; company_id: number; period: string; department: string; expense_category: string; estimated_amount: string | number; actual_amount: string | number; variance_amount: string | number; variance_percent: string | number; priority: "High" | "Medium" | "Low"; reason: string | null; recommended_action: string | null; status: "Open" | "In Progress" | "Closed"; created_at: string; updated_at: string };

function supabase() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}
const num = (v: unknown) => Number(v ?? 0);
const key = (period: string, dept: string, cat: string) => `${period}|${dept}|${cat}`;
const date = (value: string) => new Date(value.includes("T") ? value : `${value}T00:00:00Z`);

function mapCompany(row: CompanyRow) {
  return { id: Number(row.id), ownerId: Number(row.owner_id), name: row.name, currency: row.currency, createdAt: date(row.created_at), updatedAt: date(row.updated_at) };
}
function mapBudget(row: BudgetRow) {
  return { id: Number(row.id), companyId: Number(row.company_id), period: row.period, department: row.department, expenseCategory: row.expense_category, estimatedAmount: String(row.estimated_amount), notes: row.notes, createdAt: date(row.created_at), updatedAt: date(row.updated_at) };
}
function mapExpense(row: ExpenseRow) {
  return { id: Number(row.id), companyId: Number(row.company_id), transactionId: row.transaction_id, expenseDate: date(row.expense_date), period: row.period, department: row.department, expenseCategory: row.expense_category, description: row.description, actualAmount: String(row.actual_amount), paymentMethod: row.payment_method, supportingDocument: row.supporting_document, createdAt: date(row.created_at) };
}
function mapFollowUp(row: FollowUpRow) {
  return { id: Number(row.id), companyId: Number(row.company_id), period: row.period, department: row.department, expenseCategory: row.expense_category, estimatedAmount: String(row.estimated_amount), actualAmount: String(row.actual_amount), varianceAmount: String(row.variance_amount), variancePercent: String(row.variance_percent), priority: row.priority, reason: row.reason, recommendedAction: row.recommended_action, status: row.status, createdAt: date(row.created_at), updatedAt: date(row.updated_at) };
}

export async function getOrCreateCompany(ownerId: number, ownerName?: string) {
  const client = supabase();
  const existing = await client.from("companies").select("*").eq("owner_id", ownerId).limit(1);
  if (existing.error) throw existing.error;
  if (existing.data?.[0]) return mapCompany(existing.data[0] as CompanyRow);
  const inserted = await client.from("companies").insert({ owner_id: ownerId, name: ownerName ? `${ownerName} Workspace` : "Company Workspace", currency: "SAR" }).select("*").single();
  if (inserted.error || !inserted.data) throw inserted.error ?? new Error("Could not create company workspace");
  return mapCompany(inserted.data as CompanyRow);
}

export async function getCompanySnapshot(companyId: number) {
  const client = supabase();
  const [companyResult, budgetResult, expenseResult, followResult] = await Promise.all([
    client.from("companies").select("*").eq("id", companyId).limit(1),
    client.from("budgets").select("*").eq("company_id", companyId).order("period", { ascending: false }).order("department", { ascending: true }),
    client.from("expenses").select("*").eq("company_id", companyId).order("expense_date", { ascending: false }),
    client.from("follow_ups").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
  ]);
  for (const result of [companyResult, budgetResult, expenseResult, followResult]) if (result.error) throw result.error;
  const companyRow = companyResult.data?.[0] as CompanyRow | undefined;
  if (!companyRow) throw new Error("Company workspace was not found in Supabase");
  const budgetRows = (budgetResult.data ?? []).map(row => mapBudget(row as BudgetRow));
  const expenseRows = (expenseResult.data ?? []).map(row => mapExpense(row as ExpenseRow));
  const followRows = (followResult.data ?? []).map(row => mapFollowUp(row as FollowUpRow));

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
    const inserted = await client.from("follow_ups").insert(missingFollowUps.map(r => ({ company_id: companyId, period: r.period, department: r.department, expense_category: r.expenseCategory, estimated_amount: r.estimatedAmount.toFixed(2), actual_amount: r.actualAmount.toFixed(2), variance_amount: r.varianceAmount.toFixed(2), variance_percent: r.variancePercent.toFixed(2), priority: classifyVariance(r.varianceAmount, r.variancePercent), reason: "Material or percentage variance above the monitoring threshold.", recommended_action: "Obtain explanation, validate forecast assumptions, and document management action.", status: "Open" }))).select("*");
    if (inserted.error) throw inserted.error;
    followRows.push(...(inserted.data ?? []).map(row => mapFollowUp(row as FollowUpRow)));
  }
  return {
    company: mapCompany(companyRow),
    summary: { totalEstimated, totalActual, totalVariance: totalActual-totalEstimated, utilizationPercent: totalEstimated ? (totalActual/totalEstimated)*100 : 0, transactionCount: expenseRows.length, followUpCount: followRows.length, highPriorityCount: followRows.filter(r=>r.priority==='High' && r.status!=='Closed').length },
    budgets: budgetRows, expenses: expenseRows, followUps: followRows, varianceLines: lines,
    byDepartment: Array.from(byDepartment.values()).sort((a,b)=>b.varianceAmount-a.varianceAmount),
    byCategory: Array.from(byCategory.values()).sort((a,b)=>b.varianceAmount-a.varianceAmount),
    byMonth: Array.from(byMonth.values()).sort((a,b)=>a.period.localeCompare(b.period)),
  };
}

export async function listBudgets(companyId: number) { const result = await supabase().from("budgets").select("*").eq("company_id", companyId).order("period", { ascending: false }); if (result.error) throw result.error; return (result.data ?? []).map(row => mapBudget(row as BudgetRow)); }
export async function createBudget(companyId: number, input: { period:string; department:string; expenseCategory:string; estimatedAmount:number; notes?:string }) { const result = await supabase().from("budgets").insert({ company_id:companyId, period:input.period, department:input.department, expense_category:input.expenseCategory, estimated_amount:input.estimatedAmount.toFixed(2), notes:input.notes }); if (result.error) throw result.error; }
export async function bulkCreateBudgets(companyId: number, rows: { period:string; department:string; expenseCategory:string; estimatedAmount:number; notes?:string }[]) { const result = await supabase().from("budgets").insert(rows.map(input => ({ company_id:companyId, period:input.period, department:input.department, expense_category:input.expenseCategory, estimated_amount:input.estimatedAmount.toFixed(2), notes:input.notes }))); if (result.error) throw result.error; }
export async function listExpenses(companyId: number) { const result = await supabase().from("expenses").select("*").eq("company_id", companyId).order("expense_date", { ascending: false }); if (result.error) throw result.error; return (result.data ?? []).map(row => mapExpense(row as ExpenseRow)); }
export async function createExpense(companyId: number, input: { transactionId:string; expenseDate:string; period:string; department:string; expenseCategory:string; description?:string; actualAmount:number; paymentMethod:string; supportingDocument:"Available"|"Pending Review" }) { const result = await supabase().from("expenses").insert({ company_id:companyId, transaction_id:input.transactionId, expense_date:input.expenseDate, period:input.period, department:input.department, expense_category:input.expenseCategory, description:input.description, actual_amount:input.actualAmount.toFixed(2), payment_method:input.paymentMethod, supporting_document:input.supportingDocument }); if (result.error) throw result.error; }
export async function bulkCreateExpenses(companyId: number, rows: { transactionId:string; expenseDate:string; period:string; department:string; expenseCategory:string; description?:string; actualAmount:number; paymentMethod:string; supportingDocument:"Available"|"Pending Review" }[]) { const result = await supabase().from("expenses").insert(rows.map(input => ({ company_id:companyId, transaction_id:input.transactionId, expense_date:input.expenseDate, period:input.period, department:input.department, expense_category:input.expenseCategory, description:input.description, actual_amount:input.actualAmount.toFixed(2), payment_method:input.paymentMethod, supporting_document:input.supportingDocument }))); if (result.error) throw result.error; }
export async function listFollowUps(companyId: number) { const result = await supabase().from("follow_ups").select("*").eq("company_id", companyId).order("created_at", { ascending: false }); if (result.error) throw result.error; return (result.data ?? []).map(row => mapFollowUp(row as FollowUpRow)); }
export async function updateFollowUpStatus(companyId: number, id: number, status: "Open"|"In Progress"|"Closed") { const result = await supabase().from("follow_ups").update({ status }).eq("id", id).eq("company_id", companyId); if (result.error) throw result.error; }

export async function seedCompanyDemo(companyId: number) {
  const client = supabase();
  const existing = await client.from("budgets").select("id").eq("company_id", companyId).limit(1);
  if (existing.error) throw existing.error;
  if (existing.data?.[0]) return false;
  const rows = [
    ['2026-01','Operations','Maintenance',12000],['2026-01','Operations','Utilities',8500],['2026-01','Sales','Travel',14000],['2026-01','IT','Software & Subscriptions',10500],
    ['2026-02','Operations','Maintenance',12000],['2026-02','Operations','Utilities',8500],['2026-02','Sales','Travel',14000],['2026-02','IT','Software & Subscriptions',10500],
    ['2026-03','Operations','Maintenance',12000],['2026-03','Operations','Utilities',8500],['2026-03','Sales','Travel',14000],['2026-03','IT','Software & Subscriptions',10500],
    ['2026-04','Operations','Maintenance',12000],['2026-04','Operations','Utilities',8500],['2026-04','Sales','Travel',14000],['2026-04','IT','Software & Subscriptions',10500],
    ['2026-05','Operations','Maintenance',12000],['2026-05','Operations','Utilities',8500],['2026-05','Sales','Travel',14000],['2026-05','IT','Software & Subscriptions',10500],
    ['2026-06','Operations','Maintenance',12000],['2026-06','Operations','Utilities',8500],['2026-06','Sales','Travel',14000],['2026-06','IT','Software & Subscriptions',10500],
  ] as const;
  const budgetInsert = await client.from("budgets").insert(rows.map(([period,department,expenseCategory,estimatedAmount]) => ({ company_id:companyId, period, department, expense_category:expenseCategory, estimated_amount:estimatedAmount.toFixed(2), notes:'Synthetic demo budget' })));
  if (budgetInsert.error) throw budgetInsert.error;
  const expenseInsert = await client.from("expenses").insert(rows.map(([period,department,expenseCategory,estimatedAmount], i) => {
    const multiplier = (department === 'Operations' && expenseCategory === 'Maintenance' && ['2026-03','2026-04'].includes(period)) ? 1.55 : (department === 'Sales' && expenseCategory === 'Travel' && ['2026-05','2026-06'].includes(period) ? 1.36 : 0.96 + (i % 4) * 0.025);
    return { company_id:companyId, transaction_id:`DEMO-${String(i+1).padStart(4,'0')}`, expense_date:`${period}-${String(5+(i%20)).padStart(2,'0')}`, period, department, expense_category:expenseCategory, description:`${expenseCategory} - ${department} demo transaction`, actual_amount:(estimatedAmount*multiplier).toFixed(2), payment_method:i%3===0?'Bank Transfer':i%3===1?'Corporate Card':'Petty Cash', supporting_document:i%7===0?'Pending Review':'Available' as 'Available'|'Pending Review' };
  }));
  if (expenseInsert.error) throw expenseInsert.error;
  return true;
}
