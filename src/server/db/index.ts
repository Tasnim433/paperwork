import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "../env";
import * as schema from "./schema";

/**
 * Neon over HTTP. No interactive transactions: use `db.batch([...])` for writes that
 * must succeed or fail together (e.g. a change plus its audit log entry).
 */
export const db = drizzle({ client: neon(env.DATABASE_URL), schema, casing: "snake_case" });

export type Db = typeof db;
