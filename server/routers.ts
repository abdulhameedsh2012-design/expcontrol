import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { budgets, expenses, followUps } from "../drizzle/schema";
import { getCompanySnapshot, getDb, getOrCreateCompany, seedCompanyDemo } from "./db";

const budgetInput = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/), department: z.string().min(2).max(120), expenseCategory: z.string().min(2).max(120), estimatedAmount: z.number().positive(), notes: z.string().max(500).optional() });
const expenseInput = z.object({ expenseDate: z.string().min(10), period: z.string().regex(/^\d{4}-\d{2}$/), department: z.string().min(2).max(120), expenseCategory: z.string().min(2).max(120), description: z.string().max(500).optional(), actualAmount: z.number().positive(), paymentMethod: z.string().min(2).max(60), supportingDocument: z.enum(["Available", "Pending Review"]).default("Available") });
const bulkBudgetInput = z.object({ rows: z.array(budgetInput).min(1).max(5000) });
const bulkExpenseInput = z.object({ rows: z.array(expenseInput).min(1).max(5000) });

async function companyFor(ctx: { user: NonNullable<Parameters<typeof getOrCreateCompany>[0]> extends never ? never : any }) {
  return getOrCreateCompany(ctx.user.id, ctx.user.name ?? undefined);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  company: router({
    get: protectedProcedure.query(({ ctx }) => companyFor(ctx)),
  }),
  dashboard: router({
    get: protectedProcedure.query(async ({ ctx }) => { const company = await companyFor(ctx); return getCompanySnapshot(company.id); }),
  }),
  budgets: router({
    list: protectedProcedure.query(async ({ ctx }) => { const company = await companyFor(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code:'INTERNAL_SERVER_ERROR', message:'Database is not available' }); return db.select().from(budgets).where(eq(budgets.companyId, company.id)); }),
    create: protectedProcedure.input(budgetInput).mutation(async ({ ctx, input }) => { const company = await companyFor(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code:'INTERNAL_SERVER_ERROR', message:'Database is not available' }); await db.insert(budgets).values({ companyId:company.id, period:input.period, department:input.department, expenseCategory:input.expenseCategory, estimatedAmount:input.estimatedAmount.toFixed(2), notes:input.notes }); return { success:true }; }),
    bulkCreate: protectedProcedure.input(bulkBudgetInput).mutation(async ({ ctx, input }) => { const company = await companyFor(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code:'INTERNAL_SERVER_ERROR', message:'Database is not available' }); await db.insert(budgets).values(input.rows.map(row => ({ companyId:company.id, period:row.period, department:row.department, expenseCategory:row.expenseCategory, estimatedAmount:row.estimatedAmount.toFixed(2), notes:row.notes }))); return { success:true, count:input.rows.length }; }),
  }),
  expenses: router({
    list: protectedProcedure.query(async ({ ctx }) => { const company = await companyFor(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code:'INTERNAL_SERVER_ERROR', message:'Database is not available' }); return db.select().from(expenses).where(eq(expenses.companyId, company.id)); }),
    create: protectedProcedure.input(expenseInput).mutation(async ({ ctx, input }) => { const company = await companyFor(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code:'INTERNAL_SERVER_ERROR', message:'Database is not available' }); const transactionId = `TXN-${Date.now().toString(36).toUpperCase()}`; await db.insert(expenses).values({ companyId:company.id, transactionId, expenseDate:new Date(`${input.expenseDate}T00:00:00Z`), period:input.period, department:input.department, expenseCategory:input.expenseCategory, description:input.description, actualAmount:input.actualAmount.toFixed(2), paymentMethod:input.paymentMethod, supportingDocument:input.supportingDocument }); return { success:true, transactionId }; }),
    bulkCreate: protectedProcedure.input(bulkExpenseInput).mutation(async ({ ctx, input }) => { const company = await companyFor(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code:'INTERNAL_SERVER_ERROR', message:'Database is not available' }); const stamp = Date.now().toString(36).toUpperCase(); await db.insert(expenses).values(input.rows.map((row, index) => ({ companyId:company.id, transactionId:`IMP-${stamp}-${String(index+1).padStart(4,'0')}`, expenseDate:new Date(`${row.expenseDate}T00:00:00Z`), period:row.period, department:row.department, expenseCategory:row.expenseCategory, description:row.description, actualAmount:row.actualAmount.toFixed(2), paymentMethod:row.paymentMethod, supportingDocument:row.supportingDocument }))); return { success:true, count:input.rows.length }; }),
  }),
  followUps: router({
    list: protectedProcedure.query(async ({ ctx }) => { const company = await companyFor(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code:'INTERNAL_SERVER_ERROR', message:'Database is not available' }); return db.select().from(followUps).where(eq(followUps.companyId, company.id)); }),
    updateStatus: protectedProcedure.input(z.object({ id:z.number().int().positive(), status:z.enum(["Open","In Progress","Closed"]) })).mutation(async ({ ctx, input }) => { const company = await companyFor(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code:'INTERNAL_SERVER_ERROR', message:'Database is not available' }); await db.update(followUps).set({ status:input.status }).where(and(eq(followUps.id,input.id), eq(followUps.companyId,company.id))); return { success:true }; }),
  }),
  demo: router({
    seed: protectedProcedure.mutation(async ({ ctx }) => { const company = await companyFor(ctx); const inserted = await seedCompanyDemo(company.id); return { inserted }; }),
  }),
});

export type AppRouter = typeof appRouter;
