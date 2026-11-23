// Lọc review store MỚI của app Play Together VNG (Thái Lan) từ export Sensor Tower để dịch + gắn nhãn.
// - Chỉ lấy Country = TH và app VNG; bỏ review có PII hoặc rỗng.
// - Bỏ review đã có: trùng id (gplay-vng-/appstore-vng- + sha256 ngày|người viết|nội dung) hoặc trùng nguồn + ngày + nội dung
//   (review ngắn như "ดี" của nhiều người khác nhau vẫn được giữ vì khác ngày/khác id).
// Usage (từ thư mục gốc repo): node scripts/build-store-staging.mjs <outDir> [--google-play <reviews.csv>] [--app-store <reviews.csv>]
// Kết quả: <outDir>/reviews-raw.json (đủ trường) và <outDir>/in.json (gọn, để dịch). Sau khi dịch + gắn nhãn,
// nhập bằng: node scripts/import-sensortower-vng.mjs --reviews <reviews-labeled.json>
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2), outDir = args[0];
const opt = (name) => { const i = args.indexOf(`--${name}`); return i > 0 ? args[i + 1] : null; };
if (!outDir || (!opt("google-play") && !opt("app-store"))) throw new Error("Usage: node scripts/build-store-staging.mjs <outDir> [--google-play <csv>] [--app-store <csv>]");

function parse(raw) {
  const text = raw.toString(raw[0] === 0xff && raw[1] === 0xfe ? "utf16le" : "utf8").replace(/^﻿/, "");
  const rows = []; let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === "\t" && !quoted) { row.push(field); field = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); field = ""; if (row.some((v) => v !== "")) rows.push(row); row = []; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}
const pii = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?66|0)[ -]?\d(?:[ -]?\d){7,}|\b(?:uid|user id|order id|transaction id)\s*[:#]?\s*[A-Z0-9-]{4,}/iu;
const norm = (s) => String(s || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

const ids = new Set(), keys = new Set();
for (const file of (await readdir("public/data/daily")).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))) {
  const payload = JSON.parse(await readFile(`public/data/daily/${file}`, "utf8"));
  for (const item of payload.items || []) { ids.add(item.id); if (/^(Google Play|App Store)$/.test(item.source)) keys.add(`${item.source}|${payload.date}|${norm(item.text_th)}`); }
}
const items = [], stats = {};
for (const [source, prefix, file] of [["Google Play", "gplay-vng", opt("google-play")], ["App Store", "appstore-vng", opt("app-store")]]) {
  if (!file) continue;
  const rows = parse(await readFile(file));
  const s = (stats[source] = { rows: rows.length, th_vng: 0, already: 0, pii: 0, new: 0 });
  for (const r of rows) {
    if (r.Country !== "TH" || !/VNG/.test(r["App Name"])) continue;
    s.th_vng++;
    const text = [r.Title, r.Content].map((x) => (x || "").trim()).filter(Boolean).join(". ");
    if (!text) continue;
    if (pii.test(text)) { s.pii++; continue; }
    const id = `${prefix}-${createHash("sha256").update(`${r.Date}|${r.Username}|${text}`).digest("hex").slice(0, 16)}`;
    const key = `${source}|${r.Date}|${norm(text)}`;
    if (ids.has(id) || keys.has(key)) { s.already++; continue; }
    ids.add(id); keys.add(key); s.new++;
    items.push({ id, source, app_id: r["App ID"], date: r.Date, author: r.Username, rating: Number(r.Rating), st_sentiment: r.Sentiment, st_tags: r.Tags, version: r.Version || null, text_th: text });
  }
}
await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/reviews-raw.json`, `${JSON.stringify(items, null, 1)}\n`);
await writeFile(`${outDir}/in.json`, `${JSON.stringify(items.map(({ id, source, date, rating, st_sentiment, st_tags, text_th }) => ({ id, source, date, rating, st_sentiment, st_tags, text_th })), null, 1)}\n`);
console.log(JSON.stringify(stats));
console.log(`${items.length} new reviews → ${outDir}/in.json`);
