import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { listAuditLogs } from "./audit";
import {
  bulkCreateBudgets, bulkCreateExpenses, createBudget, createExpense, getCompanySnapshot, getOrCreateCompany,
  listBudgets, listExpenses, listFollowUps, seedCompanyDemo, updateFollowUpStatus,
} from "./db";
import { getSupabaseClient, getSupabaseConfig } from "./supabase";

const budgetInput = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/), department: z.string().min(2).max(120), expenseCategory: z.string().min(2).max(120), estimatedAmount: z.number().positive(), notes: z.string().max(500).optional() });
const expenseInput = z.object({ expenseDate: z.string().min(10), period: z.string().regex(/^\d{4}-\d{2}$/), department: z.string().min(2).max(120), expenseCategory: z.string().min(2).max(120), description: z.string().max(500).optional(), actualAmount: z.number().positive(), paymentMethod: z.string().min(2).max(60), supportingDocument: z.enum(["Available", "Pending Review"]).default("Available") });
const bulkBudgetInput = z.object({ rows: z.array(budgetInput).min(1).max(5000) });
const bulkExpenseInput = z.object({ rows: z.array(expenseInput).min(1).max(5000) });
const filtersInput = z.object({ search: z.string().max(120).optional(), category: z.string().max(120).optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional();
const auditFiltersInput = z.object({ search: z.string().max(120).optional(), entityType: z.enum(["all", "budget", "expense", "follow_up"]).optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional();

async function companyFor(ctx: { user: { id: number; name?: string | null } }) { return getOrCreateCompany(ctx.user.id, ctx.user.name ?? undefined); }
const userName = (ctx: { user: { name?: string | null; email?: string | null } }) => ctx.user.name ?? ctx.user.email ?? "مستخدم النظام";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success:true } as const; }),
  }),
  company: router({ get: protectedProcedure.query(({ ctx }) => companyFor(ctx)) }),
  integrations: router({
    supabaseStatus: protectedProcedure.query(async () => { const config = getSupabaseConfig(); const client = getSupabaseClient(); if (!config || !client) return { connected:false, projectRef:null }; const { error } = await client.from("companies").select("id").limit(1); return { connected:!error, projectRef:config.projectRef, error:error?.message ?? null }; }),
  }),
  dashboard: router({ get: protectedProcedure.input(filtersInput).query(async ({ ctx, input }) => { const company = await companyFor(ctx); return getCompanySnapshot(company.id, input); }) }),
  audit: router({ list: protectedProcedure.input(auditFiltersInput).query(async ({ ctx, input }) => { const company = await companyFor(ctx); return listAuditLogs(company.id, ctx.user.id, input); }) }),
  budgets: router({
    list: protectedProcedure.query(async ({ ctx }) => { const company = await companyFor(ctx); return listBudgets(company.id); }),
    create: protectedProcedure.input(budgetInput).mutation(async ({ ctx, input }) => { const company = await companyFor(ctx); await createBudget(company.id, ctx.user.id, userName(ctx), input); return { success:true }; }),
    bulkCreate: protectedProcedure.input(bulkBudgetInput).mutation(async ({ ctx, input }) => { const company = await companyFor(ctx); await bulkCreateBudgets(company.id, ctx.user.id, userName(ctx), input.rows); return { success:true, count:input.rows.length }; }),
  }),
  expenses: router({
    list: protectedProcedure.query(async ({ ctx }) => { const company = await companyFor(ctx); return listExpenses(company.id); }),
    create: protectedProcedure.input(expenseInput).mutation(async ({ ctx, input }) => { const company = await companyFor(ctx); const transactionId = `TXN-${Date.now().toString(36).toUpperCase()}`; await createExpense(company.id, ctx.user.id, userName(ctx), { ...input, transactionId }); return { success:true, transactionId }; }),
    bulkCreate: protectedProcedure.input(bulkExpenseInput).mutation(async ({ ctx, input }) => { const company = await companyFor(ctx); const stamp = Date.now().toString(36).toUpperCase(); await bulkCreateExpenses(company.id, ctx.user.id, userName(ctx), input.rows.map((row, index) => ({ ...row, transactionId:`IMP-${stamp}-${String(index+1).padStart(4,'0')}` }))); return { success:true, count:input.rows.length }; }),
  }),
  followUps: router({
    list: protectedProcedure.query(async ({ ctx }) => { const company = await companyFor(ctx); return listFollowUps(company.id); }),
    updateStatus: protectedProcedure.input(z.object({ id:z.number().int().positive(), status:z.enum(["Open","In Progress","Closed"]) })).mutation(async ({ ctx, input }) => { const company = await companyFor(ctx); await updateFollowUpStatus(company.id, ctx.user.id, userName(ctx), input.id, input.status); return { success:true }; }),
  }),
  demo: router({ seed: protectedProcedure.mutation(async ({ ctx }) => { const company = await companyFor(ctx); const inserted = await seedCompanyDemo(company.id); return { inserted }; }) }),
});

export type AppRouter = typeof appRouter;
