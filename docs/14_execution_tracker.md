# 📊 BẢNG GIÁM SÁT TIẾN ĐỘ THỰC THI (DETAILED EXECUTION & MONITORING TRACKER)
## DỰ ÁN: AI TRỢ LÝ THIẾT KẾ BÀI GIẢNG & HỌC LIỆU (AI LECTURE ASSISTANT)

> **Mã đề tài:** AI20K-005  
> **Lộ trình:** 6 tuần (6-Week MVP Timeline)  
> **Quy định hoạt động:** Bảng này dùng để theo dõi tiến độ từng khâu. Cần cập nhật trạng thái `[ ]` -> `[x]` sau khi QA đã chạy kiểm định thành công theo cột **Phương pháp Xác minh**.

---

## 1. GIAI ĐOẠN 1: CORE FOUNDATIONS & INGESTION ENGINE (TUẦN 1 & 2)

### 📅 TUẦN 1: Khởi tạo Kiến trúc và Hệ thống Xác thực
*Trọng tâm:* Cài đặt môi trường Backend, Frontend, dựng cơ sở dữ liệu SQLite và tích hợp đăng nhập/đăng ký.

| Khâu | Tác vụ chi tiết | File đích ảnh hưởng | Vai trò | Phương pháp Xác minh & Công cụ | Tiêu chí hoàn thành (DoD) | Trạng thái |
|---|---|---|:---:|---|---|:---:|
| **1.1.1** | Tạo khung FastAPI, cấu hình CORS, xử lý lỗi ngoại lệ toàn cục. | `backend/server.py`<br>`backend/main.py` | Thành viên A | Run command: `uvicorn server:app --reload`<br>Truy cập: `http://localhost:8000/docs` | Swagger UI hiển thị đầy đủ, không báo lỗi khởi tạo. | `[ ]` |
| **1.1.2** | Thiết lập các model Database SQLite và khởi tạo bảng. | `backend/database/models.py`<br>`backend/database/session.py` | Thành viên A | Run DB migration script hoặc Python script chạy thử lệnh SELECT. | Khởi tạo thành công 6 bảng (`users`, `courses`, `clos`, `chapters`, `materials`, `questions`). | `[ ]` |
| **1.1.3** | Xây dựng API Đăng ký & Đăng nhập cấp mã Token bảo mật JWT. | `backend/auth.py`<br>`backend/routers/auth.py` | Thành viên A | Postman POST `/api/auth/register` và `/api/auth/login` với dữ liệu thô. | Nhận về token JWT hợp lệ và lưu password dạng hash vào DB. | `[ ]` |
| **1.2.1** | Khởi tạo React+Vite, cấu hình routing, axios client và state auth. | `frontend/src/App.jsx`<br>`frontend/src/api/client.js` | Thành viên B | Run command: `npm run dev`<br>Mở trình duyệt kiểm tra console log. | Trang web React chạy được trên cổng 5173, không có lỗi JS. | `[ ]` |
| **1.2.2** | Thiết kế giao diện Đăng ký, Đăng nhập và Dashboard môn học. | `frontend/src/pages/Login.jsx`<br>`frontend/src/pages/Dashboard.jsx` | Thành viên B | Manual check: Thực hiện đăng nhập và chuyển hướng sang Dashboard. | UI hiển thị form login sạch sẽ, chuyển trang mượt mà khi thành công. | `[ ]` |
| **1.3.1** | Setup môi trường test, CI/CD GitHub Actions cơ bản. | `.github/workflows/ci.yml`<br>`backend/tests/test_auth.py` | Thành viên C | Đẩy code lên GitHub, kiểm tra status của workflow actions. | GitHub Action báo màu xanh (Success) cho tất cả các build test. | `[ ]` |

---

### 📅 TUẦN 2: Syllabus Ingestion & Phân tách CLO
*Trọng tâm:* Viết parser bóc tách Syllabus và xây dựng giao diện tùy chỉnh CLO thủ công trên Web.

| Khâu | Tác vụ chi tiết | File đích ảnh hưởng | Vai trò | Phương pháp Xác minh & Công cụ | Tiêu chí hoàn thành (DoD) | Trạng thái |
|---|---|---|:---:|---|---|:---:|
| **1.2.1** | Viết module parse file PDF/Docx thô và lấy text. | `backend/utils/parser.py` | Thành viên A | Chạy script test: `python test_parser.py` với file syllabus thực tế. | Trích xuất sạch text từ bảng biểu lồng nhau của file PDF/Word. | `[ ]` |
| **1.2.2** | Thiết lập System Prompt và Schema Pydantic bóc tách CLO. | `backend/services/syllabus_analyser.py`<br>`backend/schemas/syllabus.py` | Thành viên A | Gọi API POST `/api/courses/parse-syllabus` bằng Postman. | LLM trả về đúng JSON Schema chứa thông tin: Tên môn, danh sách CLO, Bloom level. | `[ ]` |
| **1.2.3** | Viết các API CRUD cho môn học và danh sách CLO. | `backend/routers/courses.py` | Thành viên A | Kiểm thử API cập nhật CLO: PUT `/api/courses/clos/{id}`. | Giảng viên có thể tự thêm/sửa/xóa các CLO trực tiếp trong SQLite DB. | `[ ]` |
| **1.2.4** | Thiết kế giao diện Upload Syllabus và Form chỉnh sửa CLO. | `frontend/src/pages/CourseConfig.jsx` | Thành viên B | Thực hiện upload file syllabus thực tế trên giao diện Web. | UI hiển thị danh sách các CLO dưới dạng Form cho phép gõ chỉnh sửa và lưu. | `[ ]` |
| **1.2.5** | Tạo bộ tài liệu Syllabus mẫu của 3 môn học tại VinUni. | `backend/tests/data/syllabi/*.pdf` | Thành viên C | Chạy thử nghiệm bóc tách CLO trên 3 bộ mẫu và đo lường độ sai lệch. | 3 bộ mẫu chạy thành công qua API, ghi nhận lỗi sai mức Bloom (nếu có) vào logs. | `[ ]` |

---

## 2. GIAI ĐOẠN 2: VECTOR KB, ISOLATED RAG & SKELETAL DESIGN (TUẦN 3 & 4)

### 📅 TUẦN 3: Xây dựng RAG Engine Cô lập (Multi-tenancy RAG)
*Trọng tâm:* Chunking tài liệu giáo trình, lưu trữ Qdrant/ChromaDB và viết API tìm kiếm cô lập.

| Khâu | Tác vụ chi tiết | File đích ảnh hưởng | Vai trò | Phương pháp Xác minh & Công cụ | Tiêu chí hoàn thành (DoD) | Trạng thái |
|---|---|---|:---:|---|---|:---:|
| **2.1.1** | Thiết lập Vector DB Qdrant (Docker local hoặc Cloud Free Tier). | `backend/database/vector_db.py` | Thành viên A | Chạy script kết nối Vector DB: `python test_vector_conn.py`. | Kết nối thành công, khởi tạo collection `lecture_materials` ổn định. | `[ ]` |
| **2.1.2** | Viết logic chunking đính kèm metadata (`page_number`, `user_id`, `course_id`). | `backend/services/chunker.py` | Thành viên A | Upload file textbook, check database xem dữ liệu lưu trong Vector DB. | Payload của các point trong Qdrant chứa đúng `user_id` và `page_number` thật. | `[ ]` |
| **2.1.3** | Viết API RAG query bắt buộc kèm payload filter cô lập tài khoản. | `backend/routers/rag.py` | Thành viên A | Chạy test script giả lập User 1 query nhưng cố tình lấy tài liệu User 2. | Không xảy ra hiện tượng rò rỉ dữ liệu chéo; kết quả trả về rỗng nếu filter sai ID. | `[ ]` |
| **2.1.4** | Thiết kế UI quản lý tài liệu học liệu (Upload giáo trình/slide cũ). | `frontend/src/pages/DocumentManager.jsx` | Thành viên B | Thực hiện upload file, theo dõi thanh trạng thái tải lên (progress bar). | Hiển thị danh sách file đã nạp, cho phép xóa tài liệu khỏi Vector DB. | `[ ]` |
| **2.1.5** | Viết test suite kiểm thử bảo mật cô lập dữ liệu (100 test cases). | `backend/tests/test_rag_security.py` | Thành viên C | Chạy lệnh: `pytest tests/test_rag_security.py`. | 100/100 test case lọc payload filter hoạt động chính xác và an toàn. | `[ ]` |

---

### 📅 TUẦN 4: Skeletal Design & Split-Screen Editor
*Trọng tâm:* Xây dựng outline chương trình, sinh slide bài giảng Markdown và kịch bản Active Learning.

| Khâu | Tác vụ chi tiết | File đích ảnh hưởng | Vai trò | Phương pháp Xác minh & Công cụ | Tiêu chí hoàn thành (DoD) | Trạng thái |
|---|---|---|:---:|---|---|:---:|
| **2.2.1** | Viết API sinh dàn ý chương học (Outline) dựa trên CLO. | `backend/routers/outline.py`<br>`backend/services/generator.py` | Thành viên A | Gọi API POST `/api/courses/generate-outline` để sinh cấu trúc chương. | Trả về danh sách cây phân cấp các chương học bám sát mục tiêu môn học. | `[ ]` |
| **2.2.2** | Viết API sinh nội dung Slide (Markdown) và kịch bản Active Learning bám RAG. | `backend/services/material_generator.py` | Thành viên A | Gọi API sinh slide cho Chương 1, kiểm tra các tag trích dẫn `[Tài liệu A - Trang 12]`. | Slide sinh ra bám sát tài liệu nguồn và có trích dẫn số trang thực tế. | `[ ]` |
| **2.2.3** | Thiết kế UI Outline Editor dạng danh sách cây kéo thả. | `frontend/src/pages/OutlineEditor.jsx` | Thành viên B | Kéo thả di chuyển thứ tự chương trên giao diện web. | Giao diện cập nhật đúng thứ tự mới và lưu trạng thái xuống DB qua API. | `[ ]` |
| **2.2.4** | Thiết kế giao diện Split-Screen Editor (Human-in-the-loop). | `frontend/src/pages/LessonPlanner.jsx`<br>`frontend/src/components/RichEditor.jsx` | Thành viên B | Chọn "Chương 1", bấm sinh bài giảng và xem nội dung đổ vào màn hình. | Bên trái hiển thị học liệu AI đề xuất, bên phải là Rich Editor có thể chỉnh sửa tự do. | `[ ]` |
| **2.2.5** | Đo lường chi phí tokens và kiểm tra rủi ro "Lost in the Middle". | `backend/tests/test_context_performance.py` | Thành viên C | Chạy kịch bản sinh bài giảng với context dài 10k tokens, đo lường response time. | Response time dưới 30s, không lỗi JSON parse, thông tin phân bổ đều. | `[ ]` |

---

## 3. GIAI ĐOẠN 3: ASSESSMENTS, WEB AGENT & FINAL DELIVERY (TUẦN 5 & 6)

### 📅 TUẦN 5: Assessment Engine & Web Search Credibility Agent
*Trọng tâm:* Sinh câu hỏi đồng cấu qua Self-Correction loop và tích hợp bộ lọc uy tín Web Search.

| Khâu | Tác vụ chi tiết | File đích ảnh hưởng | Vai trò | Phương pháp Xác minh & Công cụ | Tiêu chí hoàn thành (DoD) | Trạng thái |
|---|---|---|:---:|---|---|:---:|
| **3.1.1** | Viết API sinh bộ câu hỏi Bloom gán nhãn CLO. | `backend/routers/questions.py` | Thành viên A | Gọi API POST `/api/questions/generate` kiểm tra cấu trúc JSON trả về. | Câu hỏi sinh ra gán nhãn Bloom 1-6 chuẩn xác và map đúng ID chuẩn đầu ra. | `[ ]` |
| **3.1.2** | Cài đặt luồng Self-Correction Loop kiểm thử đáp án (Generator + Solver). | `backend/services/question_validator.py` | Thành viên A | Chạy script sinh câu hỏi toán/lập trình để xem AI tự sửa lỗi sai đáp án. | Hệ thống phát hiện đáp án sai ở Pha 2 và tự động điều chỉnh trước khi lưu. | `[ ]` |
| **3.1.3** | Tích hợp Tavily Search và xây dựng Agent đánh giá độ uy tín học thuật. | `backend/services/web_search_agent.py` | Thành viên A | Gọi API tìm kiếm chủ đề khó, xem điểm uy tín được chấm trong logs. | Chỉ lưu lại các bài viết có điểm uy tín >= 0.7 (nhà xuất bản IEEE, có DOI, v.v.). | `[ ]` |
| **3.1.4** | Thiết kế UI quản lý Ngân hàng đề thi và nút sinh câu hỏi tương tự. | `frontend/src/pages/QuestionBank.jsx` | Thành viên B | Chọn câu hỏi số 1, bấm "Sinh câu hỏi tương tự", xem đề mới tạo ra. | Đề thi mới sinh ra thay đổi ngữ cảnh, số liệu nhưng giữ nguyên độ khó và CLO. | `[ ]` |
| **3.1.5** | Chạy thử nghiệm đánh giá độ trễ của Web Search Agent và Self-Correction loop. | `backend/tests/test_latency.py` | Thành viên C | Dùng Locust hoặc script Python gửi 10 request đồng thời để đo độ trễ. | Độ trễ trung bình không vượt quá 20s cho luồng sinh câu hỏi kèm sửa lỗi. | `[ ]` |

---

### 📅 TUẦN 6: Dashboard Bao phủ, Xuất bản và Triển khai Cloud
*Trọng tâm:* Biểu đồ ma trận Bloom-CLO, xuất Markdown/PDF, cấu hình PostgreSQL production và deploy online.

| Khâu | Tác vụ chi tiết | File đích ảnh hưởng | Vai trò | Phương pháp Xác minh & Công cụ | Tiêu chí hoàn thành (DoD) | Trạng thái |
|---|---|---|:---:|---|---|:---:|
| **3.2.1** | Viết API thống kê tỷ lệ bao phủ CLO và cấu hình xuất file PDF/Markdown. | `backend/routers/export.py` | Thành viên A | Gọi API GET `/api/courses/{id}/coverage` và xuất file slide thử nghiệm. | Trả về đúng tỷ lệ phần trăm phân bổ câu hỏi; file xuất ra định dạng chuẩn. | `[ ]` |
| **3.2.2** | Thiết lập PostgreSQL trên Neon DB và viết script migrate dữ liệu. | `backend/database/migration.py` | Thành viên A | Chạy migration script kết nối Neon PostgreSQL DB. | Toàn bộ schema được migrate sang Postgres trơn tru, hoạt động ổn định. | `[ ]` |
| **3.2.3** | Thiết kế UI Dashboard ma trận phủ CLO-Bloom bằng biểu đồ. | `frontend/src/components/CoverageDashboard.jsx` | Thành viên B | Kiểm tra trực quan biểu đồ cột/bảng phân bổ trên giao diện Dashboard. | Biểu đồ cập nhật thời gian thực khi giảng viên thêm hoặc xóa câu hỏi. | `[ ]` |
| **3.2.4** | Triển khai Frontend lên Vercel, Backend lên Render. Cấu hình CORS. | `frontend/vercel.json`<br>`backend/Dockerfile` | Thành viên C | Truy cập trang web qua URL production chính thức: `https://*.vercel.app`. | Ứng dụng chạy online ổn định, không có lỗi kết nối HTTPS. | `[ ]` |
| **3.2.5** | Tiến hành đánh giá UAT với giảng viên thực tế để đo chỉ số Acceptance Rate. | `docs/15_uat_report.md` | Thành viên C | Lấy feedback từ 2 giảng viên VinUni khi dùng thử sản phẩm online. | Ghi nhận ý kiến và tính toán đạt chỉ số Acceptance Rate > 70% nội dung sinh ra. | `[ ]` |

---

## 3. NGUYÊN TẮC GIÁM SÁT TIẾN ĐỘ HÀNG NGÀY (DAILY STANDUP PROTOCOL)

Để đảm bảo không bị trễ hạn 6 tuần, nhóm sẽ tuân thủ quy trình giám sát sau:
1. **Họp nhanh hàng ngày (10 phút):** Mỗi thành viên trả lời 3 câu hỏi:
   - Hôm qua đã hoàn thành khâu nào? (Ví dụ: Đã xong Khâu 1.1.2).
   - Hôm nay sẽ thực hiện khâu nào? (Ví dụ: Sẽ làm Khâu 1.1.3).
   - Có gặp khó khăn/điểm nghẽn (Blockers) nào không?
2. **Quy tắc chuyển trạng thái:** Chỉ có **Thành viên C (QA/BA)** mới có quyền đánh dấu `[x]` vào các tác vụ sau khi đã chạy xác minh độc lập theo cột **Phương pháp Xác minh**.
3. **Quản lý rủi ro Go/No-Go Gate:** Cuối mỗi Sprint (ở cuối tuần 2, tuần 4, và tuần 6), nếu bất kỳ khâu cốt lõi nào của Sprint đó chưa đạt `[x]`, nhóm sẽ kích hoạt cơ chế **Low-code Fallback** hoặc giảm phạm vi chức năng (De-scoping) ngay lập tức để bảo vệ ngày bàn giao.
