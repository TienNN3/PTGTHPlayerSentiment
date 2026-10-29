// Thêm nguồn mới phát hiện trong lượt chạy hằng ngày, có kiểm tra định dạng và chống trùng. Không xoá hay sửa nguồn cũ.
//   Group Facebook  → public/data/sources.json (hiện trên tab Theo nguồn)
//   Kênh YouTube / creator TikTok / nguồn bị loại → docs/collection-targets.json
// Usage:
//   node scripts/add-source.mjs group <groupId|slug> --name "<tên trang>" --status partial|discovered|pending --detail "<ghi chú>"
//   node scripts/add-source.mjs youtube <UC… channel id> --name "<tên kênh>" --note "<lý do thêm>"
//   node scripts/add-source.mjs tiktok <handle> --note "<lý do thêm>"
//   node scripts/add-source.mjs reject <group|youtube|tiktok> <id> --reason "<lý do không phù hợp>"
//   Thêm --dry-run để chỉ kiểm tra.
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url).pathname;
const sourcesPath = `${root}public/data/sources.json`, targetsPath = `${root}docs/collection-targets.json`;
const argv = process.argv.slice(2), dryRun = argv.includes("--dry-run");
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? String(argv[i + 1] || "").trim() : ""; };
const VALUE_FLAGS = new Set(["--name", "--status", "--detail", "--note", "--reason"]);
const [kind, a, b] = argv.filter((v, i) => !v.startsWith("--") && !VALUE_FLAGS.has(argv[i - 1]));
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const fail = (message) => { console.error(message); process.exit(1); };
const save = async (path, data) => { if (dryRun) return; await writeFile(path, `${JSON.stringify(data, null, 2)}\n`); };
const sources = JSON.parse(await readFile(sourcesPath, "utf8"));
const targets = JSON.parse(await readFile(targetsPath, "utf8"));
const isRejected = (type, id) => targets.rejected.some((r) => r.type === type && String(r.id).toLowerCase() === String(id).toLowerCase());

if (kind === "group") {
  const id = String(a || "").replace(/^https?:\/\/(www\.)?facebook\.com\/groups\//, "").replace(/\/.*$/, "");
  if (!/^[\w.-]{3,}$/.test(id)) fail("Group id/slug không hợp lệ");
  const key = `Facebook Group · ${id}`, status = opt("status") || "discovered", name = opt("name");
  if (!["partial", "discovered", "pending", "not_collected", "inactive"].includes(status)) fail(`Status không hợp lệ: ${status}`);
  if (!sources.statuses[status]) fail(`sources.json chưa có status ${status}`);
  if (!name) fail("Cần --name (tên đúng như tiêu đề trang Facebook; phần tiếng Thái giữ nguyên, có thể thêm mô tả tiếng Việt trong ngoặc)");
  if (sources.sources.some((s) => s.key === key)) { console.log(`Đã có ${key}, bỏ qua.`); process.exit(0); }
  if (isRejected("group", id)) { console.log(`${key} đã bị loại trước đó, bỏ qua.`); process.exit(0); }
  const entry = { key, name, type: "group", status, detail: opt("detail") || `Phát hiện ngày ${today} qua tìm kiếm hằng ngày.`, url: `https://www.facebook.com/groups/${id}/`, discovered_at: today };
  // Chèn sau group cuối cùng để giữ thứ tự Facebook → video → store.
  const lastGroup = sources.sources.map((s) => s.type).lastIndexOf("group");
  sources.sources.splice(lastGroup + 1, 0, entry);
  sources.updated_at = new Date().toISOString();
  await save(sourcesPath, sources);
  console.log(`${dryRun ? "[dry-run] " : ""}Thêm ${key} (${status}).`);
} else if (kind === "youtube" || kind === "tiktok") {
  const list = kind === "youtube" ? targets.youtube_channels : targets.tiktok_creators;
  const id = kind === "youtube" ? String(a || "") : String(a || "").replace(/^@/, "");
  if (kind === "youtube" && !/^UC[\w-]{22}$/.test(id)) fail("Channel id YouTube phải dạng UC + 22 ký tự (lấy từ trang kênh, không dùng @handle)");
  if (kind === "tiktok" && !/^[\w.]{2,24}$/.test(id)) fail("Handle TikTok không hợp lệ");
  const field = kind === "youtube" ? "id" : "handle";
  const official = (kind === "youtube" ? targets.youtube_official : targets.tiktok_official).some((o) => o.handle === id);
  if (official || list.some((c) => String(c[field]).toLowerCase() === id.toLowerCase())) { console.log(`Đã có ${kind} ${id}, bỏ qua.`); process.exit(0); }
  if (isRejected(kind, id)) { console.log(`${kind} ${id} đã bị loại trước đó, bỏ qua.`); process.exit(0); }
  list.push({ [field]: id, ...(kind === "youtube" ? { name: opt("name") } : {}), status: "active", added: today, source: "discovery", note: opt("note") });
  targets.updated_at = today;
  await save(targetsPath, targets);
  console.log(`${dryRun ? "[dry-run] " : ""}Thêm ${kind} ${id}.`);
} else if (kind === "reject") {
  if (!["group", "youtube", "tiktok"].includes(a) || !b) fail("Usage: reject <group|youtube|tiktok> <id> --reason \"…\"");
  if (!opt("reason")) fail("Cần --reason");
  if (isRejected(a, b)) { console.log("Đã có trong danh sách loại."); process.exit(0); }
  targets.rejected.push({ type: a, id: b, reason: opt("reason"), checked: today });
  targets.updated_at = today;
  await save(targetsPath, targets);
  console.log(`${dryRun ? "[dry-run] " : ""}Ghi nhận loại ${a} ${b}.`);
} else fail("Usage: node scripts/add-source.mjs group|youtube|tiktok|reject … (xem đầu file)");
