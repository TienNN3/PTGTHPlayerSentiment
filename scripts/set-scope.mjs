// Đánh dấu (hoặc bỏ đánh dấu) phản hồi ngoài phạm vi hỗ trợ theo docs/game-context.md. Không đổi nội dung hay bản dịch.
// Usage: node scripts/set-scope.mjs <scope|clear> <item id> [<item id> ...]
//   vd: node scripts/set-scope.mjs unofficial_apk facebook-9d2695fa33bb69c8
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RULES = { unofficial_apk: { note: "Game không phát hành APK; lỗi do tải bản từ nguồn không chính thống, không phải lỗi game.", keyword: "apk không chính thống" } };
const [scope, ...ids] = process.argv.slice(2);
if (!scope || !ids.length || (scope !== "clear" && !RULES[scope])) throw new Error(`Usage: node scripts/set-scope.mjs <${Object.keys(RULES).join("|")}|clear> <id> [...]`);
const dailyDir = new URL("../public/data/daily/", import.meta.url).pathname;
const wanted = new Set(ids);
for (const file of (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))) {
  const path = join(dailyDir, file), payload = JSON.parse(await readFile(path, "utf8"));
  let changed = false;
  for (const item of payload.items || []) {
    if (!wanted.has(item.id)) continue;
    if (scope === "clear") { delete item.out_of_scope; delete item.scope_note; }
    else {
      item.out_of_scope = scope; item.scope_note = RULES[scope].note;
      const keywords = item.keywords || [];
      if (!keywords.includes(RULES[scope].keyword)) item.keywords = [...keywords.slice(0, 3), RULES[scope].keyword];
    }
    wanted.delete(item.id); changed = true;
    console.log(`${scope === "clear" ? "Cleared" : `Marked ${scope}`}: ${item.id} (${payload.date})`);
  }
  if (changed) await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`);
}
if (wanted.size) { console.error(`Not found: ${[...wanted].join(", ")}`); process.exit(1); }
