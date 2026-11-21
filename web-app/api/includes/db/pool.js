import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from "dotenv";


const { Pool } = pg;

const here = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.join(here, "../../../.env"),
});

const caPath = path.join(here, "../../../certificates/global-bundle.pem");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: fs.readFileSync(caPath, "utf8"),
    rejectUnauthorized: true,
  },
  connectionTimeoutMillis: 5000,
});