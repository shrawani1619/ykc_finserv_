import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from server directory (preferred)
config({ path: path.join(__dirname, "../.env") });

// Fallback to .env.development for backward compatibility
if (!process.env.DB_URI) {
  config({ path: path.join(__dirname, "../.env.development") });
}

// Use MONGODB_URI if DB_URI is not set (for backward compatibility)
const DB_URI_FINAL = process.env.DB_URI

export const { 
  PORT, 
  JWT_SECRET, 
  JWT_EXPIRE,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  NODE_ENV
} = process.env;

export const DB_URI = DB_URI_FINAL;