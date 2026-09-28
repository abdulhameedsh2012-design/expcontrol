import { drizzle } from "drizzle-orm/mysql2";
import { budgets, companies, expenses, followUps } from "../drizzle/schema";
import { getSupabaseClient } from "../server/supabase";

const mysql = process.env.DATABASE_URL ? drizzle(process.env.DATABASE_URL) : null;
const supabase = getSupabaseClient();
if (!mysql) throw new Error("DATABASE_URL is not configured");
if (!supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for migration");

const iso = (value: Date | string | null | undefined) => value instanceof Date ? value.toISOString() : value ?? new Date().toISOString();
const day = (value: Date | string) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

async function upsert(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const result = await supabase!.from(table).upsert(rows, { onConflict: "id" });
  if (result.error) throw new Error(`${table}: ${result.error.message}`);
}

async function main() {
  const [companyRows, budgetRows, expenseRows, followRows] = await Promise.all([
    mysql!.select().from(companies),
    mysql!.select().from(budgets),
    mysql!.select().from(expenses),
    mysql!.select().from(followUps),
  ]);
  await upsert("companies", companyRows.map(row => ({ id: row.id, owner_id: row.ownerId, name: row.name, currency: row.currency, created_at: iso(row.createdAt), updated_at: iso(row.updatedAt) })));
  await upsert("budgets", budgetRows.map(row => ({ id: row.id, company_id: row.companyId, period: row.period, department: row.department, expense_category: row.expenseCategory, estimated_amount: String(row.estimatedAmount), notes: row.notes, created_at: iso(row.createdAt), updated_at: iso(row.updatedAt) })));
  await upsert("expenses", expenseRows.map(row => ({ id: row.id, company_id: row.companyId, transaction_id: row.transactionId, expense_date: day(row.expenseDate), period: row.period, department: row.department, expense_category: row.expenseCategory, description: row.description, actual_amount: String(row.actualAmount), payment_method: row.paymentMethod, supporting_document: row.supportingDocument, created_at: iso(row.createdAt) })));
  await upsert("follow_ups", followRows.map(row => ({ id: row.id, company_id: row.companyId, period: row.period, department: row.department, expense_category: row.expenseCategory, estimated_amount: String(row.estimatedAmount), actual_amount: String(row.actualAmount), variance_amount: String(row.varianceAmount), variance_percent: String(row.variancePercent), priority: row.priority, reason: row.reason, recommended_action: row.recommendedAction, status: row.status, created_at: iso(row.createdAt), updated_at: iso(row.updatedAt) })));
  console.log(JSON.stringify({ companies: companyRows.length, budgets: budgetRows.length, expenses: expenseRows.length, followUps: followRows.length }));
  process.exit(0);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
