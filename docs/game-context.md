# Bối cảnh game Play Together VNG Thái Lan (dùng khi phân loại phản hồi)

File này ghi các sự thật về game và phạm vi hỗ trợ để AI phân loại phản hồi cho đúng với game. Đội vận hành bổ sung dần mỗi khi thấy AI hiểu sai. Lượt thu thập hằng ngày phải đọc file này trước khi gắn nhãn.

## Cách đánh dấu phản hồi ngoài phạm vi hỗ trợ

- Thêm `out_of_scope: "<mã>"` và `scope_note: "<giải thích ngắn tiếng Việt>"` vào mục đó. Giữ nguyên nội dung, bản dịch, cảm xúc và loại nội dung theo đúng lời người chơi.
- Dashboard **không tính** các mục này vào "Cần xử lý" / "Phản hồi cần xem" / thẻ báo lỗi, và gắn nhãn "Ngoài phạm vi" trên thẻ phản hồi. Mục vẫn được lưu và vẫn đếm vào tổng phản hồi.
- Không xoá phản hồi chỉ vì nó ngoài phạm vi.

## Các quy tắc hiện có

### 1. Game không phát hành APK — mã `unofficial_apk`
- Play Together VNG TH chỉ phát hành qua **Google Play** và **App Store**. VNG không phát hành file APK.
- Bài báo lỗi khi cài/chạy **file APK, XAPK, bản mod/crack, bản tải từ web hoặc store không chính thống** (APKPure, link Drive, link trong group…) là do người chơi tải bản không chính thống. Đây **không phải lỗi của game**, và đội vận hành không hỗ trợ các trường hợp này.
- Gắn `out_of_scope: "unofficial_apk"`, `scope_note: "Game không phát hành APK; lỗi do tải bản từ nguồn không chính thống, không phải lỗi game."`, thêm từ khoá `apk không chính thống`.
- Dấu hiệu tiếng Thái: `apk`, `เอพีเค`, `ไฟล์ apk`, `โหลดนอก`, `โหลดจากเว็บ`, `ลิ้งโหลด`, `ตัวมอด`/`มอด` (bản sửa đổi).
- **Không** áp dụng cho lỗi khi tải hoặc cập nhật từ Google Play / App Store. Đó vẫn là lỗi cần xử lý.
- Người chơi chỉ **hỏi** có APK không, hoặc hỏi link tải: vẫn gắn `unofficial_apk`. Gợi ý trả lời là hướng dẫn tải bản chính thức trên store.

### 2. Các bối cảnh khác đã biết
- Bản VNG thay thế bản Global (HAEGIN) tại Thái Lan. Phàn nàn mất tài khoản, không chuyển được dữ liệu sang VNG là vấn đề **tài khoản** (`account`), vẫn trong phạm vi.
- "ค้างคาว" là **con dơi** (sự kiện, sinh vật), không phải game bị treo.
