# Thu thập phản hồi hằng ngày (chạy tự động 6:00 sáng)

Mục tiêu: mỗi sáng thu thập phản hồi của người chơi Play Together Thái Lan **của ngày hôm trước** (theo giờ Asia/Bangkok, UTC+7), cập nhật dữ liệu dashboard, kiểm tra, commit và push lên `main` (GitHub Pages tự deploy).

Repo: `/Users/nhattien/Documents/ChatGPT/PTGTHPlayer` · Production: https://tiennn3.github.io/PTGTHPlayerSentiment/

Đọc trước: `public/how-it-works.md` (quy tắc bắt buộc), `docs/translation-guide.md` (dịch Thái → Việt).

## 0. Phạm vi

- **Ngày mục tiêu** `D` = hôm qua theo giờ Bangkok (chạy lúc 06:00 ngày 15/10 thì `D` = 14/10).
- **Có thu thập**: Facebook group (bài đăng + bình luận), fanpage Thái (chỉ bình luận người dùng), YouTube (video tiếng Thái của creator + bình luận tiếng Thái), TikTok (video tiếng Thái của creator + bình luận tiếng Thái).
- **Bỏ qua**: Sensor Tower (rating và review store). Người dùng tự nhập tay bằng `scripts/import-sensortower-vng.mjs`. Không mở Sensor Tower, không sửa `ratings`.
- Danh sách nguồn và URL: group/fanpage Facebook ở `public/data/sources.json`; kênh YouTube, creator TikTok và từ khoá tìm kiếm ở `docs/collection-targets.json`. Hai danh sách này **không cố định**: mỗi lượt chạy tìm thêm nguồn mới (mục 2b) và bổ sung bằng `scripts/add-source.mjs`. Nguồn `pending` / `not_collected` / `inactive`: chỉ mở kiểm tra nhanh trạng thái (đã được duyệt chưa, có bài mới không) rồi ghi vào `last_check`.

## 1. Trình duyệt

- **Chỉ** dùng trình duyệt tích hợp của Claude Code (`mcp__Claude_Browser__*`), đã đăng nhập Facebook sẵn. **Không** dùng Claude in Chrome (`mcp__claude-in-chrome__*`).
- **Không** đăng nhập, nhập mật khẩu, nhập mã 2FA, giải CAPTCHA, tham gia group, bấm like/comment hay gửi gì. Gặp màn đăng nhập / 2FA / checkpoint / CAPTCHA: ghi nguồn đó `status: "blocked"` kèm lý do, bỏ qua và làm tiếp các nguồn khác.
- Facebook chặn fetch/clipboard bằng CSP. Chuyển dữ liệu ra bằng form POST tới máy nhận cục bộ: chạy nền `node scripts/receive-staging.mjs .staging/daily-D/facebook-raw.json` (cổng 4176), trong trang tạo `<form method="post" action="http://127.0.0.1:4176/">` + `<textarea name="payload">` chứa JSON rồi submit.
- Công cụ `javascript_tool` giới hạn ~45 giây: chạy bộ quét nền trong trang (gán vào `window.__job`) rồi hỏi kết quả nhiều lần.

## 2. Thu thập từng nguồn

### Facebook group (các group `full` / `partial` trong `sources.json`)
- Mở `https://www.facebook.com/groups/<id>/?sorting_setting=CHRONOLOGICAL` (New posts), cuộn đến khi gặp bài cũ hơn ngày `D`.
- Ngày giờ bài: đọc **nhãn thời gian hiển thị** (Facebook làm rối DOM, tooltip có thể sai): lấy chữ hiển thị thật của link thời gian, quy đổi "x giờ trước"/"Yesterday at…"/"October 14 at…" về ngày Bangkok. Lấy permalink bằng focus vào link thời gian (href chỉ xuất hiện sau focus/focusin). Kiểm tra chéo: post ID tăng theo thời gian.
- Lấy bài đăng ngày `D` và bình luận đang hiển thị dưới bài (cả bài cũ có bình luận ngày `D` trong Recent activity). Không cần mở hết mọi chuỗi trả lời; ghi rõ điều này trong `detail`.
- Link hợp lệ: `https://www.facebook.com/groups/<id>/posts/<postId>/` và bình luận `...?comment_id=<id>`.
- Bỏ: bài của admin/quảng cáo không phải người chơi, nội dung chỉ có link, spam.

### Fanpage `@playtogetherthailandofficial`
- Chỉ bình luận của người dùng có ngày `D` dưới các bài gần đây. Không lấy bài đăng chính thức, không lấy fanpage Global.

### YouTube
- Tìm `https://www.youtube.com/results?search_query=<từ khoá>&sp=EgIIAg%3D%3D` (lọc hôm nay/tuần) với các từ khoá: `play together`, `playtogether vng`, `เพลย์ทูเก็ตเตอร์`, `play together ไทย`, `#playtogethervng`, tên sự kiện đang chạy.
- Quét RSS mọi kênh `status: "active"` trong `youtube_channels` của `docs/collection-targets.json`: `https://www.youtube.com/feeds/videos.xml?channel_id=<id>` (DOMParser bị Trusted Types chặn → tách RSS bằng regex).
- Chỉ giữ video có tiêu đề/mô tả chữ Thái, đăng ngày `D`. Mỗi video creator = 1 phản hồi (`content_kind: "video"`); bình luận tiếng Thái ngày `D` dưới video (bình luận cũ chỉ có ngày gần đúng → `date_precision: "approximate"`). Kênh chính thức Play Together VNG TH: chỉ lấy bình luận. Bỏ bình luận của chủ kênh, lời chào, link.

### TikTok
- Quét kênh chính thức trong `tiktok_official` (chỉ bình luận), mọi creator `status: "active"` trong `tiktok_creators`, và tìm kiếm theo `discovery_queries.tiktok` (đều ở `docs/collection-targets.json`).
- Ngày video lấy từ ID (giây = `BigInt(id) >> 32n`). Chỉ giữ video tiếng Thái ngày `D`; bình luận tiếng Thái (bỏ bình luận tiếng Việt, chủ kênh, chỉ emoji). Gặp CAPTCHA: ghi `blocked`, không giải.

## 2b. Tìm nguồn mới (mỗi lượt, tối đa ~15 phút)

Mục tiêu: danh sách nguồn không bị cố định. Khi có group cộng đồng, kênh YouTube hay creator TikTok mới nói về Play Together bằng tiếng Thái thì đưa vào theo dõi.

1. **Facebook group**: tìm `https://www.facebook.com/search/groups/?q=<từ khoá>` với từng từ khoá trong `discovery_queries.facebook_groups`; xem thêm link group được nhắc trong bài của các group đang theo dõi.
2. **YouTube**: trong kết quả tìm kiếm của mục 2, ghi lại các kênh có video tiếng Thái về Play Together mà chưa có trong `youtube_channels`.
3. **TikTok**: tương tự với các creator trong kết quả tìm kiếm/hashtag chưa có trong `tiktok_creators`.
4. Bỏ qua nguồn đã có trong `sources.json`, `collection-targets.json` hoặc trong `rejected`.

Tiêu chí nhận một nguồn mới (phải đủ cả 3):
- Nội dung chính là **Play Together** (không phải game khác), bằng **tiếng Thái** hoặc cộng đồng người chơi Thái (kênh/creator Việt Nam thì loại).
- Có hoạt động trong **30 ngày gần nhất** (bài/video mới nhất ≤ 30 ngày).
- Là cộng đồng/creator thật (không phải trang spam, bán hack, lừa đảo).

Cách thêm (script tự chống trùng và kiểm tra định dạng, không xoá nguồn cũ):
- Group **công khai** đọc được bài: `node scripts/add-source.mjs group <id|slug> --name "<tiêu đề trang>" --status partial --detail "Phát hiện D; theo dõi từ D; ~N thành viên"` rồi thu thập luôn ngày `D` cho group đó như mục 2.
- Group **riêng tư**: `node scripts/add-source.mjs group <id> --name "<tiêu đề>" --status discovered --detail "Riêng tư, ~N thành viên, bài mới nhất …; cần người dùng bấm tham gia"`. **Không** tự bấm tham gia/trả lời câu hỏi; ghi vào báo cáo cuối lượt để người dùng tự tham gia. Khi đã được duyệt, lượt sau đổi `status` sang `partial` và thu thập.
- Kênh YouTube: `node scripts/add-source.mjs youtube <UC…channelId> --name "<tên kênh>" --note "<video bằng chứng, ngày>"` (lấy channel id dạng `UC…` từ trang kênh/RSS, không dùng @handle).
- Creator TikTok: `node scripts/add-source.mjs tiktok <handle> --note "<video bằng chứng, ngày>"`.
- Đã kiểm tra nhưng không phù hợp: `node scripts/add-source.mjs reject <group|youtube|tiktok> <id> --reason "<lý do>"` để lượt sau không kiểm tra lại.
- Nguồn đang theo dõi mà > 30 ngày không có bài/video mới: group đổi `status` sang `inactive`, kênh/creator đổi `status` sang `inactive` (không xoá).
- Không theo dõi/follow, không like, không bình luận. Fanpage: vẫn chỉ fanpage Thái chính thức.
- Ghi kết quả vào `collection-runs/D.json` trường `discovery`: `{ "queries": [...], "added": [{type,id,name,status,evidence}], "rejected": [...], "needs_user_action": ["Tham gia group … (riêng tư)"] }`.

## 3. Làm sạch, dịch, gắn nhãn

Ghi staging `.staging/daily-D/items.json` theo dạng:

```json
{ "collection": { "collected_at": "<ISO>", "target_date": "D" },
  "items": [ { "source": "Facebook Group", "community": "Facebook Group · playtogetherth", "link": "…", "author_masked": "X***",
    "text_th": "…", "text_vn": "…", "text_en": "…", "summary_vn": "…", "summary_en": "…",
    "content_kind": "post|comment|video", "activity_type": "Bài đăng|Bình luận|Video của người chơi",
    "date": "D", "date_basis": "published_at", "published_label": "<nhãn gốc>",
    "sentiment": "Positive|Negative|Neutral|Mixed", "intent": "…", "keywords": ["…"], "theme": "…",
    "engagement": { "reactions": ["Like: 3 people"], "comment_count": 2 } } ] }
```

- Che tên tác giả dạng `X***` (ký tự đầu + `***`). Xoá số điện thoại, LINE ID, email, tên người được tag (thay bằng `[redacted]`).
- `community`: đúng `key` trong `sources.json`, vd `Facebook Group · playtogetherth`, `Facebook Fanpage · @playtogetherthailandofficial`, `YouTube`, `TikTok` (group mới phải được thêm vào `sources.json` trước khi nhập phản hồi của nó).
- Nội dung không xác định được ngày đăng: `date_basis: "observed_at"` (được tách riêng, không tính thống kê).
- `text_vn`: dịch Thái → Việt theo ngữ cảnh game (`docs/translation-guide.md`); **`ค้างคาว` = con dơi**. `text_en` / `summary_en`: tiếng Anh dễ hiểu, không hàn lâm.
- `intent` (1 loại): question, answer, share, event_entry, bug, performance, account, complaint, suggestion, praise, trade, social, chat. `keywords`: 1–4 từ khoá tiếng Việt chữ thường, dùng lại từ vựng có sẵn (xem `terms` trong `public/i18n/en.json`); từ khoá mới thì thêm bản tiếng Anh vào `terms`. `summary_vn`: 1 câu ngắn. `theme`: đúng một nhãn trong `public/data/themes.json`.

## 4. Nhập và kiểm tra

1. Trước khi nhập: `node scripts/import-daily.mjs .staging/daily-D/items.json --dry-run`.
2. Nhập: `node scripts/import-daily.mjs .staging/daily-D/items.json` (chỉ thêm; trùng thì bỏ qua; mục sai định dạng làm cả lượt bị từ chối → sửa staging rồi chạy lại). **Không** dùng `import-facebook.mjs` cho lượt hằng ngày (script đó thay toàn bộ dữ liệu Facebook).
3. Đối chiếu: số mục sau = số mục trước + số mục thêm; không id cũ nào mất; bản dịch cũ không đổi.
4. Cập nhật `public/data/sources.json`: với từng nguồn, ghi `last_check = { target_date: "D", checked_at, status, added_feedback }` và cập nhật `detail` (giữ khoảng ngày đã thu thập, vd "Bài đăng và bình luận hiển thị, 14/09 – D").
5. Ghi `public/data/collection-runs/D.json`: `target_date`, `time_zone`, `checked_at`, `status` (complete/partial/blocked), `added_feedback`, `added_ratings: 0`, `summary_vn` (1–3 câu: thêm bao nhiêu phản hồi từ đâu, nguồn nào bị chặn, Sensor Tower bỏ qua), `sources[]` (key, status, added_feedback, detail), `new_feedback` (theo nguồn, loại, cảm xúc).
6. `npm run check` (= `node scripts/validate-data.mjs && node --test`) phải pass.
7. Mở `http://127.0.0.1:4173/` (`node scripts/serve.mjs`) hoặc kiểm tra bằng trình duyệt: chọn "Hôm qua" → số phản hồi ngày `D` khớp, không lỗi console, cả VI và EN.

## 5. Commit và push

- `git pull --rebase origin main` trước (người dùng có thể đã push từ máy khác).
- Chỉ add file dữ liệu/tài liệu liên quan (`public/data`, `docs/collection-targets.json` nếu có nguồn mới, `public/i18n/en.json` nếu có từ khoá mới). Không add `.staging/`, `public/reports/`, file ảnh lạ.
- Commit: `Update PTG TH feedback for D` (thân commit: số phản hồi thêm theo nguồn, nguồn bị chặn).
- `git push origin main` (nếu sandbox chặn mạng thì chạy lại lệnh push ngoài sandbox), rồi `gh run watch` để chờ GitHub Pages deploy.
- Không có phản hồi mới: vẫn cập nhật `collection-runs/D.json` + `sources.json` (trạng thái kiểm tra) rồi commit.

## 6. Báo cáo cuối lượt

Tóm tắt ngắn bằng tiếng Việt: ngày `D`, số phản hồi thêm theo nguồn và cảm xúc, **nguồn mới phát hiện** (đã thêm / cần người dùng tham gia), nguồn bị chặn và lý do (đăng nhập, 2FA, CAPTCHA, chờ duyệt), commit + trạng thái deploy, việc cần người dùng làm (vd đăng nhập lại Facebook).
