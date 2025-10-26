import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";

export const browser = sqliteTable("browser", {
  id: text("id").primaryKey(), // Nano ID generated server-side
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  lastConnectedAt: integer("last_connected_at", { mode: "timestamp_ms" }),
});

export type Browser = typeof browser.$inferSelect;
export type BrowserInsert = typeof browser.$inferInsert;
