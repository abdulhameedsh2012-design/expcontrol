import { getSupabaseClient } from "./supabase";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "IMPORT";
export type AuditEntity = "budget" | "expense" | "follow_up";
export type AuditFilters = { search?: string; entityType?: AuditEntity | "all"; dateFrom?: string; dateTo?: string };

function client() {
  const value = getSupabaseClient();
  if (!value) throw new Error("Supabase is not configured");
  return value;
}

export async function recordAudit(input: {
  companyId: number;
  appUserId: number;
  userName: string;
  action: AuditAction;
  entityType: AuditEntity;
  entityId?: number;
  summary: string;
  changes?: Record<string, unknown>;
}) {
  const result = await client().from("audit_logs").insert({
    company_id: input.companyId,
    app_user_id: input.appUserId,
    user_name: input.userName,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary,
    changes: input.changes ?? {},
  });
  if (result.error) throw result.error;
}

export async function listAuditLogs(companyId: number, appUserId: number, filters: AuditFilters = {}) {
  let query = client().from("audit_logs").select("*").eq("company_id", companyId).eq("app_user_id", appUserId).order("created_at", { ascending: false }).limit(200);
  if (filters.entityType && filters.entityType !== "all") query = query.eq("entity_type", filters.entityType);
  if (filters.dateFrom) query = query.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) query = query.lt("created_at", `${filters.dateTo}T23:59:59.999Z`);
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[(),]/g, " ");
    query = query.or(`summary.ilike.%${term}%,user_name.ilike.%${term}%`);
  }
  const result = await query;
  if (result.error) throw result.error;
  return (result.data ?? []).map(row => ({
    id: Number(row.id), companyId: Number(row.company_id), appUserId: Number(row.app_user_id), userName: row.user_name,
    action: row.action, entityType: row.entity_type, entityId: row.entity_id ? Number(row.entity_id) : null,
    summary: row.summary, changes: row.changes ?? {}, createdAt: row.created_at,
  }));
}
