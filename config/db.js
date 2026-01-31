import mongoose from "mongoose";
import { DB_URI } from "../config/env.js";

export default async function connectDB() {
  try {
    if (!DB_URI) {
      console.error("ERROR: MongoDB URI is not defined!");
      process.exit(1);
    }

    await mongoose.connect(DB_URI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
}