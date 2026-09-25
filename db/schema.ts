import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authId: text("auth_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("uq_users_auth_id").on(t.authId), uniqueIndex("uq_users_email").on(t.email)]);

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const locations = sqliteTable("locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const equipment = sqliteTable("equipment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetCode: text("asset_code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  brandModel: text("brand_model").notNull().default(""),
  serialNumber: text("serial_number").notNull().default(""),
  location: text("location").notNull(),
  status: text("status", { enum: ["available", "borrowed", "pending", "maintenance", "damaged", "lost"] }).notNull().default("available"),
  imageUrl: text("image_url"),
  notes: text("notes").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("uq_equipment_asset_code").on(t.assetCode), index("idx_equipment_filters").on(t.status, t.category, t.location)]);

export const loanRequests = sqliteTable("loan_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestCode: text("request_code").notNull().unique(),
  borrowerAuthId: text("borrower_auth_id").notNull(),
  borrowerName: text("borrower_name").notNull(),
  startAt: text("start_at").notNull(),
  dueAt: text("due_at").notNull(),
  purpose: text("purpose").notNull(),
  notes: text("notes").notNull().default(""),
  status: text("status", { enum: ["pending", "approved", "rejected", "borrowed", "returned", "overdue"] }).notNull().default("pending"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_requests_borrower_status").on(t.borrowerAuthId, t.status), index("idx_requests_dates").on(t.startAt, t.dueAt)]);

export const loanItems = sqliteTable("loan_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: integer("request_id").notNull().references(() => loanRequests.id, { onDelete: "cascade" }),
  equipmentId: integer("equipment_id").notNull().references(() => equipment.id),
  conditionBefore: text("condition_before").notNull().default("ปกติ"),
}, (t) => [uniqueIndex("uq_loan_item_request_equipment").on(t.requestId, t.equipmentId), index("idx_loan_items_equipment").on(t.equipmentId)]);

export const returns = sqliteTable("returns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: integer("request_id").notNull().references(() => loanRequests.id),
  equipmentId: integer("equipment_id").notNull().references(() => equipment.id),
  conditionAfter: text("condition_after", { enum: ["normal", "minor", "damaged"] }).notNull(),
  damageDetails: text("damage_details").notNull().default(""),
  damagePhotoKey: text("damage_photo_key"),
  fineAmount: integer("fine_amount").notNull().default(0),
  notes: text("notes").notNull().default(""),
  receivedBy: text("received_by").notNull(),
  returnedAt: text("returned_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("uq_returns_request_equipment").on(t.requestId, t.equipmentId), index("idx_returns_returned_at").on(t.returnedAt)]);

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
