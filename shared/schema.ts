import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gtin: text("gtin"),
  upc: text("upc"),
  ean: text("ean"),
  asin: text("asin"),
  sku: text("sku"),
  brand: text("brand"),
  title: text("title").notNull(),
  variant: text("variant"),
  price: text("price"),
  currency: text("currency"),
  images: jsonb("images").$type<string[]>().default([]),
  platform: text("platform").notNull(), // amazon, walmart, etc.
  url: text("url").notNull(),
  attributes: jsonb("attributes").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const stores = pgTable("stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  chain: text("chain").notNull(), // bestbuy, target, walmart, etc.
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  phone: text("phone"),
  isActive: boolean("is_active").default(true),
});

export const offers = pgTable("offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id),
  storeId: varchar("store_id").references(() => stores.id),
  price: text("price").notNull(),
  currency: text("currency").default("USD"),
  availabilityType: text("availability_type").notNull(), // pickup, delivery
  eta: text("eta"), // "2 hours", "6:00 PM", etc.
  etaMinutes: integer("eta_minutes"), // for sorting
  distance: text("distance"), // "0.3 mi"
  distanceMiles: integer("distance_miles"), // for sorting
  inStock: boolean("in_stock").default(true),
  stockLevel: integer("stock_level"),
  lastSeen: timestamp("last_seen").defaultNow(),
  deepLink: text("deep_link"),
  margin: integer("margin"), // profit margin for filtering
  trustScore: integer("trust_score").default(100), // reliability score
  isEligible: boolean("is_eligible").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const resolveRequests = pgTable("resolve_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identifiers: jsonb("identifiers").$type<Record<string, string>>().notNull(),
  brand: text("brand"),
  title: text("title"),
  variant: text("variant"),
  price: text("price"),
  currency: text("currency"),
  attributes: jsonb("attributes").$type<Record<string, any>>().default({}),
  platform: text("platform").notNull(),
  url: text("url").notNull(),
  zipCode: text("zip_code"),
  userAgent: text("user_agent"),
  response: jsonb("response").$type<any>(),
  success: boolean("success").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
});

export const insertOfferSchema = createInsertSchema(offers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const resolveRequestSchema = z.object({
  identifiers: z.record(z.string()),
  brand: z.string().optional(),
  title: z.string().optional(),
  variant: z.string().optional(),
  price: z.string().optional(),
  currency: z.string().optional(),
  attributes: z.record(z.any()).optional(),
  platform: z.string(),
  url: z.string(),
  zip: z.string().optional(),
});

export const resolveResponseSchema = z.object({
  eligible: z.boolean(),
  offers: z.array(z.object({
    id: z.string(),
    storeName: z.string(),
    storeChain: z.string(),
    address: z.string(),
    distance: z.string(),
    distanceMiles: z.number(),
    availabilityType: z.string(),
    eta: z.string(),
    etaMinutes: z.number(),
    price: z.string(),
    currency: z.string(),
    lastSeen: z.string(),
    deepLink: z.string().optional(),
    inStock: z.boolean(),
    stockLevel: z.number().optional(),
  })),
  cached: z.boolean(),
  timestamp: z.string(),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;
// Relations
export const productsRelations = relations(products, ({ many }) => ({
  offers: many(offers),
}));

export const storesRelations = relations(stores, ({ many }) => ({
  offers: many(offers),
}));

export const offersRelations = relations(offers, ({ one }) => ({
  product: one(products, {
    fields: [offers.productId],
    references: [products.id],
  }),
  store: one(stores, {
    fields: [offers.storeId],
    references: [stores.id],
  }),
}));

// Types
export type ResolveRequest = z.infer<typeof resolveRequestSchema>;
export type ResolveResponse = z.infer<typeof resolveResponseSchema>;
export type ResolveRequestRecord = typeof resolveRequests.$inferSelect;
