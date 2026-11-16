// Kiểm tra các ngày bị thiếu dữ liệu thu thập trước mỗi lượt chạy hằng ngày.
// Một ngày coi là THIẾU khi chưa có public/data/collection-runs/<ngày>.json (chưa có lượt thu thập nào cho ngày đó)
// hoặc không có phản hồi nào có ngày đăng trong public/data/daily/<ngày>.json.
// In danh sách ngày cần chạy bù (cũ → mới), kết thúc bằng ngày mục tiêu D = hôm qua theo giờ Bangkok.
// Usage: node scripts/check-gaps.mjs [số ngày nhìn lại, mặc định 14] [--json]
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const lookback = Number(process.argv.find((arg) => /^\d+$/.test(arg)) || 14);
const asJson = process.argv.includes("--json");
const bangkokToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const addDays = (date, days) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const target = addDays(bangkokToday, -1);
const runs = new Set((await readdir(join(root, "public/data/collection-runs"))).map((name) => name.slice(0, 10)));
const dailyFiles = new Set(await readdir(join(root, "public/data/daily")));
const rows = [];
for (let offset = lookback - 1; offset >= 0; offset--) {
  const date = addDays(target, -offset);
  let dated = 0;
  if (dailyFiles.has(`${date}.json`)) {
    const payload = JSON.parse(await readFile(join(root, "public/data/daily", `${date}.json`), "utf8"));
    dated = (payload.items || []).filter((item) => item.date_basis !== "observed_at" && !/^(Google Play|App Store)$/.test(item.source)).length;
  }
  const hasRun = runs.has(date);
  const reasons = [!hasRun && "chưa có collection-runs", !dated && "không có phản hồi cộng đồng"].filter(Boolean);
  rows.push({ date, has_run: hasRun, community_feedback: dated, missing: date === target || reasons.length > 0, reasons: date === target && !reasons.length ? ["ngày mục tiêu"] : reasons });
}
const todo = rows.filter((row) => row.missing).map((row) => row.date);
if (asJson) console.log(JSON.stringify({ today_bangkok: bangkokToday, target, todo, rows }, null, 2));
else {
  for (const row of rows) console.log(`${row.date}  ${row.has_run ? "run ✓" : "run ✗"}  ${String(row.community_feedback).padStart(4)} phản hồi${row.missing ? `  → CẦN CHẠY (${row.reasons.join(", ")})` : ""}`);
  console.log(`\nNgày cần thu thập (cũ → mới): ${todo.join(", ")}`);
}
