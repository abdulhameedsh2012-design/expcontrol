import { date, decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id),
  name: varchar("name", { length: 160 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("SAR").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const budgets = mysqlTable("budgets", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id),
  period: varchar("period", { length: 7 }).notNull(),
  department: varchar("department", { length: 120 }).notNull(),
  expenseCategory: varchar("expenseCategory", { length: 120 }).notNull(),
  estimatedAmount: decimal("estimatedAmount", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id),
  transactionId: varchar("transactionId", { length: 40 }).notNull(),
  expenseDate: date("expenseDate").notNull(),
  period: varchar("period", { length: 7 }).notNull(),
  department: varchar("department", { length: 120 }).notNull(),
  expenseCategory: varchar("expenseCategory", { length: 120 }).notNull(),
  description: text("description"),
  actualAmount: decimal("actualAmount", { precision: 14, scale: 2 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 60 }).notNull(),
  supportingDocument: mysqlEnum("supportingDocument", ["Available", "Pending Review"]).default("Available").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const followUps = mysqlTable("followUps", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id),
  period: varchar("period", { length: 7 }).notNull(),
  department: varchar("department", { length: 120 }).notNull(),
  expenseCategory: varchar("expenseCategory", { length: 120 }).notNull(),
  estimatedAmount: decimal("estimatedAmount", { precision: 14, scale: 2 }).notNull(),
  actualAmount: decimal("actualAmount", { precision: 14, scale: 2 }).notNull(),
  varianceAmount: decimal("varianceAmount", { precision: 14, scale: 2 }).notNull(),
  variancePercent: decimal("variancePercent", { precision: 8, scale: 2 }).notNull(),
  priority: mysqlEnum("priority", ["High", "Medium", "Low"]).notNull(),
  reason: text("reason"),
  recommendedAction: text("recommendedAction"),
  status: mysqlEnum("status", ["Open", "In Progress", "Closed"]).default("Open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
