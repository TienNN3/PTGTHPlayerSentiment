// Đọc file .txt xuất từ LINE OpenChat (người dùng tải tay) và tạo staging các tin nhắn cần phân tích.
// - Bỏ tin hệ thống (joined, set/changed, unsent), Stickers/Photos/Videos, chỉ có emoji, lời chào ngắn, link trơn.
// - Gộp các tin liền nhau của cùng một người trong vòng 3 phút thành một mục.
// - Che tên người gửi dạng X***, xoá số điện thoại/email/LINE ID. id ổn định theo ngày|giờ|nội dung (không theo tên,
//   vì LINE có thể hiện "Unknown" ở lần xuất này và tên thật ở lần sau, hoặc người dùng đổi tên).
// - Bỏ các tin đã có trong public/data/daily (so theo ngày + giờ + nội dung), nên file mới chồng ngày với file cũ không tạo trùng.
//   Chạy từ thư mục gốc repo.
// Usage: node scripts/parse-line.mjs <export.txt> <outDir> [--community "LINE OpenChat · Play Together Thailand"]
// Kết quả: <outDir>/line-candidates.json (mảng mục chưa dịch, nhóm theo ngày) để dịch + gắn nhãn,
//          rồi nhập từng ngày bằng scripts/import-daily.mjs (xem docs/daily-collection.md mục "LINE OpenChat").
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const [inputPath, outDir] = process.argv.slice(2);
if (!inputPath || !outDir) throw new Error("Usage: node scripts/parse-line.mjs <export.txt> <outDir>");
const ci = process.argv.indexOf("--community");
const community = ci > 0 ? process.argv[ci + 1] : "LINE OpenChat · Play Together Thailand";
const slug = community.replace(/^LINE OpenChat · /, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const raw = (await readFile(inputPath, "utf8")).replace(/^﻿/, "").replace(/\r/g, "");

const SYSTEM = /^(?:.+ joined the chat\.|.+ left the chat\.|.+ (?:set|changed) the chat's .+|.+ unsent a message\.|.+ removed .+ from the chat\.)$/;
const MEDIA = /^(?:Stickers|Photos|Videos|Files|Albums|Voice messages|Sticker|Photo|Video)$/;
const GREETING = /^(?:สวัสดี(?:ครับ|ค่ะ|คะ|ค่า+|จ้า|ทุกคน|ค่ะทุกคน|ครับทุกคน|ชาว.+)?|ยินดีต้อนรับ.*|hello|hi|haloo|hellu|hii+|ดีครับ|ดีค่ะ|555+|ขอบคุณ(?:ครับ|ค่ะ|ค่า|มาก)?[ๆ]*|ok|โอเค)[\s!.~🙋]*$/iu;
const PII = /(?:\+?66|0)[ -]?\d(?:[ -]?\d){7,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:line\s*id|ไลน์\s*ไอดี|id\s*line)\s*[:：]?\s*\S+/giu;
const mask = (name) => { const clean = String(name || "").trim(); return clean && clean !== "Unknown" ? `${[...clean][0]}***` : "U***"; };

// Tên hiển thị có thể chứa khoảng trắng: lấy danh sách tên từ các dòng "<tên> joined the chat." để tách đúng.
const knownNames = new Set(["Unknown"]);
for (const line of raw.split("\n")) { const joined = line.match(/^\d{2}:\d{2} (.+) joined the chat\.$/); if (joined) knownNames.add(joined[1]); }
// Người đổi tên sau khi vào nhóm (vd "Chi" → "Chi จีเอง"): nếu mọi tin của một tên đều bắt đầu bằng cùng một chữ
// thì chữ đó là phần sau của tên hiện tại.
for (const name of [...knownNames]) {
  if (name === "Unknown") continue;
  const nexts = raw.split("\n").map((line) => line.match(/^\d{2}:\d{2} (.+)$/)?.[1]).filter((rest) => rest?.startsWith(`${name} `) && !SYSTEM.test(rest)).map((rest) => rest.slice(name.length + 1).split(" ")[0]);
  if (nexts.length >= 3 && nexts.every((token) => token === nexts[0]) && !MEDIA.test(nexts[0])) knownNames.add(`${name} ${nexts[0]}`);
}
const namesLongestFirst = [...knownNames].sort((a, b) => b.length - a.length);
// Gom dòng: "HH:MM Tên Nội dung"; dòng không có giờ là phần tiếp theo của tin trước.
const messages = [];
let date = null;
for (const line of raw.split("\n")) {
  const day = line.match(/^(\d{4})\.(\d{2})\.(\d{2}) \w+day$/);
  if (day) { date = `${day[1]}-${day[2]}-${day[3]}`; continue; }
  const msg = line.match(/^(\d{2}):(\d{2}) (.+)$/);
  if (msg && date) {
    const rest = msg[3];
    if (SYSTEM.test(rest)) { messages.push({ date, time: `${msg[1]}:${msg[2]}`, system: true }); continue; }
    const known = namesLongestFirst.find((name) => rest.startsWith(`${name} `));
    const space = rest.indexOf(" ");
    const author = known || (space > 0 ? rest.slice(0, space) : rest);
    const text = known ? rest.slice(known.length + 1) : (space > 0 ? rest.slice(space + 1) : "");
    messages.push({ date, time: `${msg[1]}:${msg[2]}`, author, text });
  } else if (messages.length && line.trim() && !messages.at(-1).system) messages.at(-1).text += `\n${line}`;
}

const skipped = { greeting: 0, link_only: 0, short: 0 };
// Gộp tin liền nhau cùng người trong 3 phút.
const minutes = (m) => Number(m.time.slice(0, 2)) * 60 + Number(m.time.slice(3));
const groups = [];
for (const m of messages) {
  if (m.system) continue;
  const text = m.text.replace(/\(emoji\)|\([a-z ]+\)/gi, " ").trim();
  if (!text || MEDIA.test(text)) continue;
  // Lời chào/cảm ơn đứng riêng bị bỏ trước khi gộp, để không dính vào tin có nội dung.
  if (GREETING.test(text) || (/^(?:สวัสดี|ขอบคุณ|ยินดีต้อนรับ)/u.test(text) && [...text].length <= 30)) { skipped.greeting++; continue; }
  const last = groups.at(-1);
  if (last && last.author === m.author && last.date === m.date && minutes(m) - last.lastMinute <= 3 && m.author !== "Unknown") {
    last.parts.push(text); last.times.push(m.time); last.lastMinute = minutes(m);
  } else groups.push({ date: m.date, time: m.time, author: m.author, parts: [text], times: [m.time], lastMinute: minutes(m) });
}

// Tin LINE đã nhập trước đó: ngày|giờ|nội dung (đếm số lần, vì có thể có hai tin giống nhau cùng phút).
const norm = (value) => String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
const existing = new Map(), existingTexts = [];
try {
  const { readdir } = await import("node:fs/promises");
  for (const file of (await readdir("public/data/daily")).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))) {
    const payload = JSON.parse(await readFile(`public/data/daily/${file}`, "utf8"));
    for (const item of payload.items || []) {
      if (item.source !== "LINE OpenChat" || item.community !== community) continue;
      const time = String(item.link).split("T").pop();
      const key = `${payload.date}|${time}|${norm(item.text_th)}`;
      existing.set(key, (existing.get(key) || 0) + 1);
      existingTexts.push({ date: payload.date, time, text: norm(item.text_th) });
    }
  }
} catch { /* chạy ngoài repo: không lọc tin đã có */ }
const already = { exact: 0, overlap: 0 };
const candidates = [], seenKeys = new Map();
for (const g of groups) {
  // Tên nhân vật: một dòng không khoảng trắng, không có chữ Thái, không phải link/số/mã viết hoa (kể cả chữ kiểu cách như "Bʙᴀꜱᵏᵘᵇ").
  const isGameName = (value) => value.length >= 2 && value.length <= 25 && !/\s/.test(value) && !/[\u0E00-\u0E7F]/.test(value) && !/^https?:/i.test(value)
    && !/^[A-Z0-9_.]+$/.test(value) && !/^[\d\p{P}\p{S}]+$/u.test(value) && /\p{L}/u.test(value) && !/^(?:ok|oke|hi|hello|good|thanks?)$/i.test(value);
  // Link trang cá nhân Facebook (…/user/<id>/, profile.php?id=…) là định danh cá nhân: bỏ phần đó, giữ link group nếu có.
  g.parts = g.parts.map((part) => part.replace(/(https?:\/\/(?:www\.)?facebook\.com\/groups\/[^/\s]+)\/user\/\d+\/?/g, "$1/").replace(/https?:\/\/(?:www\.)?facebook\.com\/profile\.php\?id=\S+/g, "[redacted]"));
  // Tên nhân vật trong game người chơi gửi để kết bạn (một dòng chỉ gồm chữ Latin/Hàn, không viết hoa toàn bộ như mã code) cũng che.
  let text = g.parts.join("\n").replace(PII, "[redacted]").split("\n").map((line) => isGameName(line.trim()) ? "[redacted]" : line).join("\n").trim();
  if (/^(?:\[redacted\]\s*)+$/.test(text)) { skipped.short++; continue; }
  if (GREETING.test(text) || (/^(?:สวัสดี|ขอบคุณ|ยินดีต้อนรับ)/u.test(text) && [...text].length <= 30 && !text.includes("\n"))) { skipped.greeting++; continue; }
  if (/^https?:\/\/\S+$/.test(text)) { skipped.link_only++; continue; }
  if ([...text.replace(/\s/g, "")].length < 2) { skipped.short++; continue; }
  // Đã nhập ở file trước: trùng ngày + giờ + nội dung, hoặc mọi phần của mục này đã có (tin trước đây tách lẻ vì "Unknown").
  const exactKey = `${g.date}|${g.time}|${norm(text)}`;
  if (existing.get(exactKey) > 0) { existing.set(exactKey, existing.get(exactKey) - 1); already.exact++; continue; }
  const lastTime = g.times.at(-1);
  if (g.parts.every((part) => existingTexts.some((e) => e.date === g.date && e.time >= g.time && e.time <= lastTime && (e.text.includes(norm(part)) || norm(part).includes(e.text))))) { already.overlap++; continue; }
  // Hai người cùng gửi một câu trong cùng phút (vd "เป็นค่ะ") vẫn là hai tin: thêm số thứ tự cho lần lặp.
  const baseKey = `${slug}|${g.date}|${g.time}|${text}`, seen = (seenKeys.get(baseKey) || 0);
  seenKeys.set(baseKey, seen + 1);
  const id = `line-${createHash("sha256").update(seen ? `${baseKey}|${seen}` : baseKey).digest("hex").slice(0, 16)}`;
  candidates.push({ id, source: "LINE OpenChat", community, date: g.date, time: g.time, author_masked: mask(g.author),
    link: `line-openchat:${slug}#${g.date}T${g.time}`, content_kind: "message", activity_type: "Tin nhắn LINE",
    date_basis: "published_at", text_th: text });
}
await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/line-candidates.json`, `${JSON.stringify(candidates, null, 1)}\n`);
const byDate = candidates.reduce((acc, c) => ((acc[c.date] = (acc[c.date] || 0) + 1), acc), {});
console.log(`${messages.filter((m) => !m.system).length} messages → ${groups.length} grouped → ${candidates.length} new candidates (skipped ${JSON.stringify(skipped)}; already imported ${JSON.stringify(already)})`);
console.log(JSON.stringify(byDate));
