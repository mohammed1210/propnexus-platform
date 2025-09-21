// scripts/test-zenrows.ts
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const ZENROWS_API_KEY = process.env.ZENROWS_API_KEY;
if (!ZENROWS_API_KEY) {
  console.error("❌ Missing ZENROWS_API_KEY in .env");
  process.exit(1);
}

const url = "https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=REGION%5E813&maxBedrooms=3&minBedrooms=2";
const target = `https://api.zenrows.com/v1/?apikey=${ZENROWS_API_KEY}&url=${encodeURIComponent(url)}&premium_proxy=true&js_render=true`;

console.log("Fetching via ZenRows…", target);

const res = await fetch(target);
const html = await res.text();

console.log("HTTP status:", res.status);
console.log("Response size:", html.length.toLocaleString(), "bytes");

// ✅ Ensure debug folder exists
const dir = path.resolve(process.cwd(), ".scrape_debug");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Save copy
fs.writeFileSync(path.join(dir, "zenrows-test.html"), html, "utf8");
console.log("Saved .scrape_debug/zenrows-test.html");
