# Philosophy Quiz Arena

Website thi trắc nghiệm nhiều người chơi theo thời gian thực, dùng Socket.IO.

## Tính năng
- MC tạo phòng, mã phòng 6 ký tự và QR tham gia.
- Thí sinh vào bằng điện thoại, không cần cài ứng dụng.
- Đồng bộ câu hỏi, đồng hồ đếm ngược 30 giây và bảng xếp hạng trực tiếp.
- Trả lời đúng được 500–1.000 điểm tùy tốc độ.
- MC xem câu hỏi và các lựa chọn trên màn hình, có thể bỏ qua hoặc kết thúc.
- Khi khóa câu, website hiển thị đáp án lấy từ phương án chữ đỏ trong tài liệu.

## Dữ liệu câu hỏi
Tệp nguồn có 49 câu, đánh số từ 1 đến 50 và thiếu câu 18. Website giữ nguyên số thứ tự gốc, không tự tạo câu 18. Mỗi câu có bốn lựa chọn và đáp án được lấy từ phương án chữ đỏ. Câu 3 có đáp án B theo tài liệu.

## Chạy thử
Yêu cầu Node.js 18 trở lên.
```bash
npm install
npm start
```
Mở http://localhost:3000.

## Triển khai
Repository có render.yaml. Trên Render chọn New > Blueprint, kết nối repository và triển khai.

## Giới hạn
- Phòng và điểm lưu trong RAM, nên khởi động lại dịch vụ sẽ xóa phòng đang chơi.
- Chưa có khôi phục phiên người chơi sau khi rời trình duyệt.
- Bản thử nghiệm phù hợp lớp học nhỏ, chưa được kiểm định cho kỳ thi yêu cầu bảo mật cao.
- Gói hosting miễn phí có thể tạm dừng khi không có truy cập.
