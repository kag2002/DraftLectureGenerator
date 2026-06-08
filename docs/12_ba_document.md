# 📑 TÀI LIỆU PHÂN TÍCH NGHIỆP VỤ (BUSINESS ANALYSIS DOCUMENT)
## DỰ ÁN: AI TRỢ LÝ THIẾT KẾ BÀI GIẢNG & HỌC LIỆU (AI LECTURE ASSISTANT)

> **Mã đề tài:** AI20K-005  
> **Lĩnh vực:** Giáo dục Đại học — Thiết kế Khóa học (Higher Education — Course Design)  
> **Đối tác:** VinUni × Vingroup (Gen AI Engineer Training Program)

---

## 1. BỐI CẢNH, VẤN ĐỀ VÀ MỤC TIÊU DỰ ÁN

### 1.1. Bối cảnh
Tại các trường Đại học và Cao đẳng hiện nay, đặc biệt là các trường hướng tới tiêu chuẩn quốc tế như **VinUni**, việc thiết kế chương trình học và đề thi chịu sự kiểm định vô cùng nghiêm ngặt của các tổ chức kiểm định chất lượng giáo dục (như **AUN-QA**, **ABET**). Giảng viên bắt buộc phải chứng minh được mối liên kết chặt chẽ (Constructive Alignment) giữa:
- **Chuẩn đầu ra môn học (CLO - Course Learning Outcomes)**.
- **Thang đo nhận thức Bloom (Bloom's Taxonomy)**.
- **Học liệu giảng dạy & Bộ câu hỏi kiểm tra đánh giá**.

### 1.2. Các Pain Points cốt lõi của Giảng viên
1. **Gánh nặng thủ tục hành chính:** Việc lập ma trận đối chiếu câu hỏi thi với CLO và thang Bloom để nộp cho phòng Khảo thí/Đảm bảo chất lượng cực kỳ tốn thời gian. Giảng viên bị biến thành "công nhân nhập liệu văn bản văn phòng" (nhập bảng Excel, gán nhãn thủ công) thay vì tập trung vào chuyên môn giảng dạy và nghiên cứu khoa học.
2. **Nỗi sợ AI ảo tưởng (Hallucination):** Giảng viên có học vị cao và rất khắt khe về tri thức. Họ không dám dùng ChatGPT thông thường vì sợ AI bịa ra kiến thức, số liệu sai lệch hoặc trích dẫn các bài báo nghiên cứu không tồn tại. Nếu dạy sai một kiến thức cơ bản, uy tín học thuật tích lũy cả đời của giảng viên sẽ bị hủy hoại trước sinh viên và hội đồng khoa học.
3. **Sinh viên thụ động trên lớp:** Giảng viên muốn áp dụng các phương pháp giảng dạy hiện đại (như *Active Learning* - Học tập chủ động, *Flipped Classroom* - Lớp học đảo ngược) nhưng thiếu thời gian hoặc kỹ năng sư phạm hiện đại để thiết kế các kịch bản tương tác ngắn 5-10 phút tại lớp.
4. **Vấn nạn sinh viên dùng ChatGPT gian lận:** Các đề thi/bài tập cũ dễ dàng bị giải bởi AI đại trà. Giảng viên luôn phải chịu áp lực đổi mới đề thi liên tục, tạo ra nhiều mã đề đồng cấu nhưng cạn kiệt ý tưởng ra đề.

### 1.3. Mục tiêu dự án
Xây dựng một hệ thống **AI Lecture Assistant** toàn diện giúp giảm thời gian soạn giáo án và làm thủ tục kiểm định từ **3 ngày làm việc xuống dưới 30 phút**, đồng thời đảm bảo:
- Sự chính xác tuyệt đối của tài liệu tham khảo (Strict RAG với trích dẫn số trang thật).
- Khả năng ánh xạ chuẩn xác câu hỏi vào ma trận CLO - Bloom.
- Cải tiến tính tương tác lớp học qua các kịch bản Active Learning.

---

## 2. PHÂN TÍCH STAKEHOLDERS & PERSONAS

### 2.1. Phân tích các bên liên quan (Stakeholder Analysis)
- **Giảng viên Đại học (Target User):** Trực tiếp sử dụng hệ thống để soạn bài giảng, thiết kế đề cương và sinh ngân hàng đề thi. Mong muốn: Tối giản thao tác, chính xác tuyệt đối, dễ dàng chỉnh sửa.
- **Sinh viên (End User):** Người tiếp nhận bài giảng và làm các bài thi/bài tập do hệ thống sinh ra. Mong muốn: Đề thi thực tế, không rập khuôn, bài học sinh động.
- **Phòng Khảo thí & Đảm bảo Chất lượng (Auditor):** Đơn vị kiểm duyệt ma trận đề thi và đề cương trước khi cho phép giảng dạy. Mong muốn: Báo cáo ma trận Bloom - CLO minh bạch, bám sát Syllabus.

### 2.2. Chân dung người dùng (User Persona)
- **Họ và tên:** TS. Nguyễn Văn A  
- **Vai trò:** Giảng viên Viện Kỹ thuật và Khoa học Máy tính tại VinUni.  
- **Hành vi sử dụng công nghệ:** Đã từng thử dùng ChatGPT, NotebookLM và Perplexity nhưng cảm thấy chưa hài lòng vì thông tin trích dẫn không đáng tin cậy và cấu trúc trả về không đúng ma trận của nhà trường.  
- **Nhu cầu:** Cần một trợ lý chuẩn hóa, có thể upload giáo trình riêng của mình lên để AI chỉ truy xuất trên đó, tự động gán nhãn Bloom và xuất ma trận chuẩn xác để nộp phòng Đảm bảo chất lượng mà không cần chỉnh sửa Excel thủ công.

---

## 3. DANH SÁCH EPICS & USER STORIES

### Epic 1: Syllabus Ingestion & Course Configuration (Thiết lập môn học)
- **User Story 1.1:** Là một Giảng viên, tôi muốn upload file Syllabus (PDF/Docx) hoặc copy-paste văn bản thô vào hệ thống để AI tự động trích xuất mã môn, tên môn và danh sách các Chuẩn đầu ra (CLO) kèm mức Bloom tương ứng.
- **User Story 1.2:** Là một Giảng viên, tôi muốn có giao diện Form để tự thêm, sửa hoặc xóa các CLO do AI bóc tách thiếu chính xác, để đảm bảo thông tin môn học khớp 100% với đề cương chính thức.

### Epic 2: Source Knowledge Management (Quản lý tài liệu nguồn)
- **User Story 2.1:** Là một Giảng viên, tôi muốn tải lên tài liệu nguồn (giáo trình, slide bài giảng cũ, bài báo nghiên cứu) cho từng môn học để AI chỉ sử dụng các thông tin này làm cơ sở tri thức (RAG), tránh hiện tượng bịa đặt số liệu.
- **User Story 2.2:** Là một Giảng viên, tôi muốn tài liệu của tôi được cô lập hoàn toàn, không bị rò rỉ hay bị truy cập chéo bởi các giảng viên khác trên hệ thống để bảo mật đề thi và tài liệu nội bộ.

### Epic 3: Material Generation & Skeletal Editor (Sinh học liệu & Biên tập)
- **User Story 3.1:** Là một Giảng viên, tôi muốn AI gợi ý bộ khung Outline chương học từ Syllabus, cho phép tôi thêm, xóa, sửa thứ tự các chương bằng giao diện kéo thả trực quan.
- **User Story 3.2:** Là một Giảng viên, tôi muốn chọn một chương để AI sinh slide bài giảng thô (dạng Markdown) kèm chú thích số trang trích dẫn chính xác trong tài liệu nguồn.
- **User Story 3.3:** Là một Giảng viên, tôi muốn AI sinh kịch bản Active Learning (như Think-Pair-Share) dựa trên sĩ số lớp học và cơ sở vật chất thực tế để tăng tính tương tác trên lớp.
- **User Story 3.4:** Là một Giảng viên, tôi muốn sử dụng giao diện Split-Screen Editor để xem học liệu đề xuất ở bên trái và bấm nút chèn nhanh sang khung soạn thảo bên phải để tự do biên tập lại.

### Epic 4: Isomorphic & Bloom Assessment (Thiết kế Đề thi & Câu hỏi)
- **User Story 4.1:** Là một Giảng viên, tôi muốn chọn một chương học và yêu cầu AI sinh bộ câu hỏi trắc nghiệm tương ứng, bắt buộc gán nhãn mức Bloom và liên kết với một CLO cụ thể.
- **User Story 4.2:** Là một Giảng viên, tôi muốn chọn một câu hỏi mẫu và yêu cầu AI tạo ra các câu hỏi đồng cấu (Isomorphic) - cùng độ khó, cùng mức Bloom nhưng đổi số liệu hoặc ngữ cảnh để tránh sinh viên chép bài nhau.
- **User Story 4.3:** Là một Giảng viên, tôi muốn hệ thống chạy kiểm thử đáp án tự động (Self-Correction) để đảm bảo câu hỏi sinh ra hợp lý về logic toán học/lập trình trước khi hiển thị cho tôi duyệt.

### Epic 5: Exporting & Compliance Dashboard (Xuất bản & Thống kê)
- **User Story 5.1:** Là một Giảng viên, tôi muốn xem biểu đồ Dashboard thống kê tỷ lệ bao phủ (%) của các câu hỏi đối với các chuẩn CLO của môn học để kiểm tra xem đã phân bổ đều chưa.
- **User Story 5.2:** Là một Giảng viên, tôi muốn xuất toàn bộ nội dung slide, kịch bản, câu hỏi và ma trận Bloom đã duyệt ra định dạng Markdown hoặc PDF để sử dụng giảng dạy và nộp phòng Khảo thí.

---

## 4. YÊU CẦU CHỨC NĂNG (FR) & PHI CHỨC NĂNG (NFR)

### 4.1. Yêu cầu chức năng (Functional Requirements)
- **FR-01 (Đăng nhập & Phân quyền):** Đăng ký, đăng nhập người dùng bằng email và mật khẩu. Phân quyền dữ liệu theo cấp tài khoản: Giảng viên chỉ được xem và sửa môn học của chính họ.
- **FR-02 (Xử lý Syllabus):** Trích xuất văn bản từ PDF/Docx. Sử dụng LLM bóc tách các thực thể: Mã môn, Tên môn, Danh sách CLO, Mô tả CLO, Phân loại Bloom.
- **FR-03 (Tìm kiếm RAG cô lập):** Tải tài liệu nguồn lên. Phân mảnh (chunking) kết hợp số trang vật lý. Lưu trữ vào Vector DB kèm filter `user_id` và `course_id`.
- **FR-04 (Web Search & Đánh giá Uy tín):** Tìm kiếm thông tin học thuật qua Internet. Sử dụng Agent tính điểm uy tín dựa trên tên miền, DOI, mức độ đồng thuận và năm xuất bản. Chỉ giữ lại nguồn có điểm uy tín >= 0.7.
- **FR-05 (Thiết kế bài giảng):** Sinh slide Markdown và kịch bản Active Learning. Hỗ trợ giao diện Split-Screen Editor để giảng viên chỉnh sửa trực tiếp.
- **FR-06 (Sinh ngân hàng câu hỏi):** Sinh câu hỏi trắc nghiệm gán thẻ Bloom (1-6) và CLO ID. Hỗ trợ chức năng sinh câu hỏi đồng cấu kèm bước Self-Correction (Generator + Solver).
- **FR-07 (Dashboard & Xuất bản):** Thống kê và hiển thị ma trận phủ CLO - Bloom dưới dạng bảng phân bổ và biểu đồ cột. Xuất file Markdown/PDF.

### 4.2. Yêu cầu phi chức năng (Non-Functional Requirements)
- **NFR-01 (Bảo mật & Cô lập dữ liệu):** Bảo vệ dữ liệu tuyệt đối giữa các tài khoản. 100% các câu lệnh truy vấn Vector DB bắt buộc phải đi kèm metadata filter ID giảng viên.
- **NFR-02 (Tối ưu hóa Chi phí API):** Chi phí API token cho mỗi lần biên soạn xong 1 chương học liệu (Slide + Hoạt động + 5 câu hỏi) không vượt quá **0.5 USD**. Sử dụng cache kết quả với các câu hỏi tương tự.
- **NFR-03 (Thời gian phản hồi & Độ trễ):** Thời gian sinh slide/câu hỏi không quá 30 giây. Sử dụng UI Loading Spinner sinh động, không khóa trình duyệt của người dùng trong lúc chờ xử lý.
- **NFR-04 (Tính ổn định & Fallback):** Hệ thống không được crash màn hình trắng khi API OpenAI/Claude bị sập hoặc gặp lỗi kết nối. Chuyển sang chế độ Fallback thông báo lỗi rõ ràng hoặc dùng kiến thức chung kèm cảnh báo.

---

## 5. KHUNG QUẢN TRỊ RỦI RO & PHÂN TÍCH THẤT BẠI (FAILURES & UX MITIGATIONS)

Dự án áp dụng khung quản trị rủi ro dựa trên cấu trúc:  
`Nếu User [Trigger] -> AI có thể [Failure] -> Hậu quả là [Impact] -> Giải pháp xử lý [Mitigation]`.

| STT | Trình kích hoạt (Trigger) | Lỗi hệ thống có thể xảy ra (Failure) | Hậu quả thực tế (Impact) | Phương án xử lý & Khắc phục của MVP (UX Mitigation / Fallback) |
|---|---|---|---|---|
| **1** | GV upload Syllabus dạng file scan PDF lỗi font hoặc định dạng bảng phức tạp. | Parser không bóc tách được văn bản, LLM bỏ sót hoặc nhận diện sai các CLO. | Nghẽn toàn bộ luồng thiết kế bài giảng phía sau. | **UI Textarea Copy-Paste:** Cung cấp khung nhập liệu thô. Nếu upload file lỗi, giảng viên chỉ cần dán văn bản Syllabus vào để AI phân tích. Cung cấp nút thêm/sửa CLO thủ công trên Form. |
| **2** | GV thực hiện RAG query để sinh nội dung slide. | LLM bị hiện tượng ảo tưởng trích dẫn (Fake Citation), bịa ra số trang không có thật. | Làm mất uy tín học thuật của giảng viên trước hội đồng. | **Strict Metadata Mapping:** Gán cứng số trang thật vào metadata của Chunk khi nạp tài liệu. LLM bắt buộc phải trích dẫn theo định dạng JSON chứa chunk_id, backend tự động lấy số trang thật từ DB để hiển thị. |
| **3** | RAG truy xuất được 2 tài liệu nguồn uy tín nhưng nội dung mâu thuẫn trực tiếp. | LLM tự ý "trung hòa" 2 kiến thức này thành một kiến thức thứ ba bịa đặt (Ảo tưởng logic). | Bài giảng đầu ra bị hỗn loạn về mặt khoa học. | **Contextual Boundary Warning:** Reranker phát hiện sự khác biệt lớn. Prompt ép LLM không được trộn lẫn mà phải hiển thị rõ 2 tùy chọn học thuyết mâu thuẫn kèm cảnh báo trên UI cho giảng viên tự chọn. |
| **4** | Hệ thống cần giải bài toán Multi-Hop Retrieval (ví dụ: hình ảnh Sơ đồ ở chương 3 và Bảng dữ liệu ở phụ lục B). | RAG thông thường chỉ lấy các đoạn văn bản rời rạc, làm đứt gãy chuỗi suy luận (Reasoning Path). | AI sinh bài tập lớn bị sai lệch logic và thiếu thông tin. | **Textualization & VLM Parser:** MVP sử dụng Visual Language Model (VLM) để chuyển đổi sơ đồ ảnh/bảng biểu thành định dạng Markdown thô ngay khi tải lên, sau đó lưu RAG dạng văn bản kèm liên kết chéo. |
| **5** | GV yêu cầu sinh hoạt động Active Learning cho lớp học. | AI đề xuất kịch bản phi thực tế (ví dụ: thảo luận nhóm 20 phút cho giảng đường lớn 100 sinh viên). | Giáo án của giảng viên bị phá sản khi lên lớp thực tế. | **Hard-coded Context Input:** Ép giảng viên nhập sĩ số lớp (<30, 30-60, >60) và cơ sở vật chất qua giao diện trước khi sinh. Sử dụng các tham số này làm ràng buộc hệ thống cứng (System Prompt constraints). |
| **6** | GV bấm nút sinh bộ câu hỏi Bloom hoặc slide bài giảng. | API bên thứ ba (OpenAI/Claude) bị timeout (>30s) hoặc quá giới hạn lượt gọi (Rate limit). | Hệ thống bị treo, giao diện bị crash trắng hoặc báo lỗi lập trình khó hiểu. | **Resilience UI & Local Cache:** Hiển thị màn hình Loading động, cho phép chạy ngầm (polling). Nếu lỗi kết nối, hiển thị popup thông báo thân thiện và tự động khôi phục bản lưu nháp cũ gần nhất từ SQLite/Local Storage. |

---

## 6. HỆ THỐNG KPI ĐO LƯỜNG THỰC TẾ (REAL KPI SYSTEM)

Để đánh giá mức độ thành công của dự án sau khi hoàn thành MVP 6 tuần, nhóm áp dụng 4 nhóm chỉ số cụ thể:

### 1. Chỉ số Năng suất (Productivity KPI)
- **Chỉ số:** Time-to-Syllabus & Time-to-Lesson-plan.
- **Cách đo:** Đo thời gian từ khi giảng viên upload Syllabus và tài liệu nguồn đến khi hoàn thành xong 1 slide bài giảng kèm 5 câu hỏi đã duyệt.
- **Mục tiêu kỳ vọng (Target):** **Giảm từ 3 ngày làm việc (truyền thống) xuống dưới 30 phút**.

### 2. Chỉ số Chất lượng & Bảo mật (Quality KPI)
- **Chỉ số 1 (Hallucination Rate):** Tỷ lệ thông tin trích dẫn bịa đặt.
- **Target:** **0%** nhờ cơ chế khóa vùng dữ liệu RAG (chỉ sử dụng tài liệu nguồn giảng viên cung cấp).
- **Chỉ số 2 (Security Leakage):** Tỷ lệ rò rỉ thông tin chéo giữa các tài khoản giảng viên.
- **Target:** **0%** (kiểm chứng qua 100 truy vấn kiểm thử bắt buộc kèm payload filtering).

### 3. Chỉ số Hài lòng & Ứng dụng (Adoption KPI)
- **Chỉ số:** Syllabus & Content Acceptance Rate.
- **Cách đo:** Tỷ lệ số từ/nội dung slide do AI sinh ra được giảng viên giữ nguyên hoặc chỉ sửa nhẹ trên Rich Text Editor (không bị xóa đi viết lại hoàn toàn).
- **Target:** **> 70%** lượng nội dung đầu ra được chấp nhận.

### 4. Chỉ số Trải nghiệm & Chi phí (Usability & Cost KPI)
- **Chỉ số 1 (Edit-Click Count):** Số thao tác nhấp chuột trung bình giảng viên phải bỏ ra để tinh chỉnh lại một khối nội dung.
- **Target:** **Dưới 3 click** nhờ thiết kế block kéo thả và giao diện Split-Screen tiện lợi.
- **Chỉ số 2 (API Token Cost):** Chi phí API trung bình cho mỗi chương bài giảng.
- **Target:** **< 0.5 USD/chương**.
