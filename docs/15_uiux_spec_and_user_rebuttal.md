# 🎨 ĐẶC TẢ UI/UX TƯƠNG TÁC & PHẢN BIỆN NGƯỜI DÙNG KHÓ TÍNH
## DỰ ÁN: AI TRỢ LÝ THIẾT KẾ BÀI GIẢNG & HỌC LIỆU (AI LECTURE ASSISTANT)

> **Mã đề tài:** AI20K-005  
> **Tài liệu:** UI/UX Specification & Edge-case Rebuttals  
> **Mục tiêu:** Đảm bảo trải nghiệm giảng viên mượt mà, minh bạch thông tin nguồn, giám sát hệ thống thời gian thực và thu thập feedback liên tục.

---

## PHẦN 1: THIẾT KẾ CHI TIẾT THÀNH PHẦN UI/UX CỐT LÕI

Để hỗ trợ giảng viên kiểm soát tối đa nội dung (Human-in-the-loop) mà không bị choáng ngợp bởi thông tin, hệ thống thiết kế 5 phân hệ tương tác đặc thù sau:

### 1. Bảng Duyệt Đề xuất (AI Proposal Review Panel)
Thiết kế dạng thanh trượt bên trái (Collapsible Sidebar) có thể đóng mở linh hoạt. Cho phép giảng viên duyệt từng block nội dung hoặc sửa đổi nhanh.

```
+-----------------------------------------------------------------------------+
| [<< Đóng đề xuất]                   | BẢN SOẠN THẢO CHÍNH (Rich Text)       |
|-------------------------------------|---------------------------------------|
| 📂 Slide 1: Khái niệm Cây BST       | # Chương 3: Cây Tìm Kiếm Nhị Phân     |
| [Duyệt tất cả]                      |                                       |
|-------------------------------------| [Nội dung sau khi duyệt sẽ tự động    |
| * Cây nhị phân có tính chất sắp xếp |  được chèn vào vị trí con trỏ chuột   |
|   thứ tự nhánh trái < gốc < phải.   |  ở đây...]                            |
|   [Duyệt] [Bỏ qua] [Sửa nhanh]      |                                       |
|                                     |                                       |
| 📝 Hoạt động Active Learning        |                                       |
| * Thảo luận cặp đôi vẽ cây BST      |                                       |
|   Sĩ số: 40 | Wifi: Có | Bàn ghế: Cố định                                   |
|   [Duyệt] [Bỏ qua] [Sửa nhanh]      |                                       |
+-----------------------------------------------------------------------------+
```

*   **Micro-interactions (Tương tác nhỏ):**
    - Bấm nút `[<< Đóng đề xuất]` sẽ ẩn bảng bên trái bằng hiệu ứng trượt 200ms, dành toàn bộ màn hình cho khung soạn thảo chính.
    - Bấm nút `[Duyệt]` sẽ thực hiện hiệu ứng fade-out nhẹ ở bảng đề xuất và tự động chèn khối text tương ứng vào cursor của Rich Text Editor bên phải.
    - Nút `[Sửa nhanh]` sẽ biến khối text đề xuất thành một textarea nội bộ ngay tại sidebar để giảng viên chỉnh sửa nhanh trước khi chèn sang editor chính.

---

### 2. Hộp thoại Soi nguồn Trích dẫn (Citation Inspector Popover)
Mỗi đoạn văn do AI sinh ra dựa trên RAG bắt buộc đính kèm nhãn nguồn (Ví dụ: `[Tài liệu A - Trang 12]`). Khi người dùng di chuột qua nhãn này, hệ thống hiển thị popover thông tin chi tiết.

```
+-----------------------------------------------------------------------------+
| * Cây nhị phân có tính chất sắp xếp thứ tự. [Tài liệu A - Trang 12] 🔍      |
+------------------------------------------------------------│----------------+
                                                             ▼
                                      +──────────────────────────────────────+
                                      | 🏷️ CHI TIẾT TRÍCH DẪN NGUỒN         |
                                      | Môn học: Cấu trúc dữ liệu            |
                                      | Tên File: `Giao_trinh_BST_Ver2.pdf`  |
                                      | Trang tài liệu: Trang 12             |
                                      | Độ tương đồng RAG: 94.2%             |
                                      |--------------------------------------|
                                      | "Cây nhị phân tìm kiếm là cây nhị    |
                                      |  phân mà khóa của nút gốc lớn hơn    |
                                      |  mọi khóa ở cây con bên trái..."     |
                                      +──────────────────────────────────────+
```

*   **Tương tác & Hành vi (Interactions & Behaviors):**
    - **Trigger:** Hover (di chuột) sau 300ms hoặc Click (chạm trên iPad) vào nhãn trích dẫn.
    - **Nội dung:** Hiển thị tên file gốc, số trang thật, điểm similarity của vector search và đoạn text thô (raw chunk) nằm trong cơ sở dữ liệu để đối chiếu chéo.
    - **Hành động phụ:** Cung cấp nút nhỏ góc popover để mở bản PDF Viewer hiển thị chính xác trang tài liệu đó trên tab mới.

---

### 3. Đồng hồ Đánh giá Độ uy tín Nguồn Web (Academic Credibility Gauge)
Khi sử dụng công cụ tìm kiếm Web Search (khi không có tài liệu nội bộ), hệ thống hiển thị một đồng hồ nhỏ trực quan mô tả độ uy tín học thuật của nội dung tổng hợp được.

```
  +─────────────────────────────────────────────────────────────+
  | 🌐 ĐỘ TIN CẬY HỌC THUẬT: [██████████░░] 78% (Khá uy tín)   |
  | [Xem chi tiết tiêu chí chấm điểm v]                         |
  +─────────────────────────────────────────────────────────────+
    ▼ (Khi bấm mở rộng chi tiết)
    ┌─────────────────────────────────────────────────────────┐
    │ 🔍 Bảng phân rã tiêu chí chấm điểm uy tín nguồn:        │
    │ 1. Nhà xuất bản & Tên miền: 40/50đ (IEEE Explorer)      │
    │ 2. Nhận dạng DOI: 20/20đ (doi.org/10.1109/...)         │
    │ 3. Sự đồng thuận học thuật: 10/15đ (Có 3 nguồn nhắc lại)│
    │ 4. Thời gian xuất bản: 8/15đ (Năm xuất bản: 2020)       │
    └─────────────────────────────────────────────────────────┘
```

*   **Quy tắc hiển thị màu sắc (Visual Color Coding):**
    - **Xanh lá (>= 80%):** Nguồn cực kỳ uy tín (IEEE, Harvard, Cambridge, etc. - Hoàn toàn yên tâm giảng dạy).
    - **Vàng cam (70% - 79%):** Nguồn trung bình (Tài liệu giáo trình nội bộ trường khác, trang .edu/.org phổ thông - Cần đọc lướt qua để kiểm tra).
    - **Đỏ (< 70%):** Nguồn độ tin cậy thấp (Blog cá nhân, Wikipedia, diễn đàn công nghệ - Khuyên giảng viên không sử dụng để soạn slide/ra đề).

---

### 4. Badge Giám sát Hệ thống và Chi phí (Real-time Monitoring Badge)
Một thanh công cụ nhỏ (floating badge) nằm góc dưới màn hình giúp giảng viên (và QA) giám sát tài chính và hiệu suất của API OpenAI/Claude.

```
+─────────────────────────────────────────────────────────────────────────────+
| 📊 Trạng thái API: Sẵn sàng | Trễ: 1.2s | Chi phí: $0.04 | [Xem Traces Langfuse] |
+─────────────────────────────────────────────────────────────────────────────+
```

*   **Các thông số hiển thị:**
    - **Trạng thái API:** Green (Sẵn sàng), Yellow (Đang xử lý / Loading), Red (API Timeout/Lỗi).
    - **Trễ (Latency):** Thời gian phản hồi thực tế của lượt gọi LLM gần nhất.
    - **Chi phí (Cost):** Quy đổi số token In/Out của lượt sinh gần nhất ra USD (giúp giảng viên quản lý ngân sách).
    - **Link Trace:** Bấm nút mở tab mới dẫn đến chính xác trace của câu lệnh đó trên Langfuse dashboard (chỉ khả dụng ở môi trường Development hoặc cho user Admin).

---

### 5. Khung Phản hồi Người dùng (Telemetry & Feedback Capturing)
Để AI liên tục tối ưu hóa chất lượng sinh nội dung và thích ứng phong cách giảng bài của từng giảng viên, hệ thống tích hợp bộ đo lường thụ động kết hợp khảo sát chủ động.

```
+─────────────────────────────────────────────────────────────────────────────+
| BÀI GIẢNG ĐÃ ĐƯỢC LƯU NHÁP THÀNH CÔNG                                       |
| Bạn đánh giá thế nào về chất lượng nội dung AI gợi ý cho Chương này?        |
| [⭐] [⭐] [⭐] [⭐] [⭐] (1-5 Sao)     | 👍 Rất hài lòng    👎 Cần cải thiện   |
| [ Nhập ý kiến đóng góp thêm...                                            ] |
| [ Gửi đánh giá ]                                                            |
+─────────────────────────────────────────────────────────────────────────────+
```

*   **Cơ chế đo lường Data thụ động (Passive Telemetry):**
    - **Edit Distance Tracking:** Hệ thống tự động tính toán khoảng cách chỉnh sửa (Levenshtein Distance) giữa nội dung AI đề xuất và nội dung cuối cùng giảng viên lưu trên editor. Nếu khoảng cách gần bằng 0 $\rightarrow$ AI đạt chất lượng cao. Nếu khoảng cách lớn (> 80% văn bản bị viết lại) $\rightarrow$ Hệ thống tự động log lại prompt và tài liệu nguồn để gửi về AI Engineer tinh chỉnh.
    - **Copy-Paste Tracking:** Đếm số lần giảng viên bấm chèn nhanh so với số lần copy văn bản ra ngoài hệ thống.
    - **Time spent:** Đo thời gian giảng viên dừng lại ở màn hình duyệt trước khi bấm Lưu.

---

## PHẦN 2: NHẬT KÝ PHẢN BIỆN CỦA GIẢNG VIÊN KHÓ TÍNH (ROLEPLAY DIARY)

*Nhóm đã giả lập một buổi UAT giả định, đóng vai Giáo sư "Khắt Khe" (Giảng viên ngành Computer Science, VinUni) để phản biện gay gắt về các tính năng của hệ thống.*

---

### Chất vấn 1: Màn hình laptop 13-inch chật chội
> **Giáo sư Khắt Khe:** *"Tôi hay mang Macbook Air 13-inch lên giảng đường. Giao diện chia đôi màn hình (Split-screen) của các anh chiếm hết không gian. Tôi không thể vừa nhìn slide AI sinh, vừa xem kịch bản sư phạm, lại vừa gõ bài giảng chính được. Nó quá rối mắt!"*

*   **Giải pháp UI/UX (Mitigation):**
    - Thiết kế giao diện co giãn Responsive linh hoạt.
    - Bổ sung nút chuyển đổi chế độ xem **View Toggle**:
      - Chế độ **Split-Screen** (Side-by-side) mặc định cho màn hình lớn (>14 inch).
      - Chế độ **Single Tab View** (Tab 1: AI Proposals; Tab 2: Rich Editor) cho màn hình nhỏ, có nút phím tắt nhanh `Tab` để chuyển đổi qua lại.
      - Sidebar đề xuất bên trái có tay cầm kéo giãn (Draggable Resizable Border) để giảng viên tự động thay đổi độ rộng theo ý muốn.

---

### Chất vấn 2: Lỗi format thụt dòng (Indentation) của Code Python trong đề thi
> **Giáo sư Khắt Khe:** *"Tôi là giảng viên lập trình Python. Lớp tôi dạy rất đông và tôi muốn sinh câu hỏi trắc nghiệm đồng cấu về code. Khi AI sinh câu hỏi mới, định dạng thụt lề (Indentation) của Python thường bị lỗi, biến đổi thành text thường mất tab, hoặc thụt đầu dòng sai. Sinh viên của tôi sẽ thi trượt vì lỗi biên dịch do AI làm ẩu chứ không phải vì họ không biết làm bài!"*

*   **Giải pháp UI/UX (Mitigation):**
    - **Monaco Editor Preview:** Đối với câu hỏi dạng lập trình, khung review câu hỏi sẽ không sử dụng text thường mà nhúng một editor code chuyên dụng (Monaco Editor - giống VS Code thu nhỏ) hiển thị syntax highlighting và giữ nguyên tab.
    - **Syntax Parser Backend:** Trước khi lưu câu hỏi code vào cơ sở dữ liệu, Agent Solver (ở Pha 2) bắt buộc phải chạy đoạn code đó qua trình thông dịch Python thô (Python Interpreter API) để kiểm tra xem có lỗi `IndentationError` hay `SyntaxError` không. Nếu có lỗi, kích hoạt chế độ sinh lại lập tức.

---

### Chất vấn 3: Điểm uy tín học thuật "0.75" mập mờ
> **Giáo sư Khắt Khe:** *"Các anh đưa ra con số 78% uy tín nguồn. Dựa vào đâu tôi tin con số này? AI tự nghĩ ra điểm số này để lừa tôi à? Tôi cần trích dẫn chính xác thuật toán và bằng chứng cụ thể."*

*   **Giải pháp UI/UX (Mitigation):**
    - Cung cấp nút mở rộng chi tiết tính điểm (như hình vẽ tại Mục 3 Phần 1).
    - Khi bấm vào điểm số, hiển thị một **Transparency Modal** phân tích toán học rõ ràng:
      - Tên miền `.edu` thuộc trường đại học nào? (Ví dụ: Harvard University - được cộng 50 điểm).
      - Có mã DOI học thuật nào được trích xuất không? (Hiển thị DOI cụ thể kèm hyperlink dẫn sang thư viện IEEE Xplore).
      - Trưng cầu ý kiến đồng thuận học thuật: Hiển thị danh sách 3 bài viết khác có chung kết luận khoa học đó.

---

### Chất vấn 4: Sợ mất bài soạn do rớt mạng hoặc API Timeout
> **Giáo sư Khắt Khe:** *"Mạng Wifi ở hội trường lớn thỉnh thoảng bị chập chờn. API OpenAI thì thi thoảng bị quá tải và đứng im 30 giây. Nếu tôi đang duyệt dở bài giảng chương 3 mà mạng bị đứt, hoặc hệ thống bị lỗi API thì toàn bộ công sức soạn thảo của tôi từ nãy đến giờ có bị biến mất không? Tôi không rảnh để ngồi làm lại từ đầu."*

*   **Giải pháp UI/UX (Mitigation):**
    - **Autosave & Local Draft Sync:** Tích hợp bộ lưu nháp tự động xuống Local Storage của trình duyệt mỗi khi giảng viên chỉnh sửa (chu kỳ 5 giây/lần).
    - **Status Indicator:** Hiển thị một badge nhỏ cạnh nút Lưu: `[Đang lưu...]` $\rightarrow$ `[Đã lưu nháp trên trình duyệt]` $\rightarrow$ `[Đã đồng bộ lên Cloud]`.
    - **Offline Resilience:** Nếu mất kết nối internet, Rich Editor bên phải sẽ bị khóa tạm thời và hiển thị banner thông báo:
      > 📶 **Mất kết nối mạng.** Bản nháp gần nhất đã được lưu an toàn tại máy của bạn. Hệ thống sẽ tự động đồng bộ lên máy chủ ngay khi có mạng trở lại. Bạn có thể tiếp tục gõ nội dung thô.

---

### Chất vấn 5: Đo lường Telemetry thụ động là "Gián điệp"
> **Giáo sư Khắt Khe:** *"Tại sao hệ thống lại tự ý theo dõi hành vi gõ phím và tính toán khoảng cách chỉnh sửa văn bản của tôi? Đây là vi phạm quyền riêng tư và theo dõi người dùng trái phép!"*

*   **Giải pháp UI/UX (Mitigation):**
    - **Chính sách Quyền riêng tư & Opt-in/Opt-out:** Trong phần cài đặt tài khoản, cung cấp nút bật/tắt (Toggle) cho phép hoặc không cho phép thu thập dữ liệu hành vi.
    - **Giải trình giá trị cho người dùng:** Giải thích rõ dữ liệu edit distance chỉ được tính toán cục bộ trên trình duyệt (local JavaScript) và chỉ gửi thông số số học (Ví dụ: `edit_distance: 0.12`), hoàn toàn không gửi nội dung chữ giảng viên gõ lên server (không leak dữ liệu mật).
    - **Value Return:** Chứng minh cho giảng viên thấy: "Nhờ việc chia sẻ dữ liệu chỉnh sửa, mô hình AI đã học được văn phong của Thầy/Cô và giảm tỷ lệ phải sửa đổi slide từ 30% ở tuần 1 xuống còn dưới 8% ở tuần 4".
