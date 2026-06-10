# 📋 BRIEF DỰ ÁN: AI TRỢ LÝ THIẾT KẾ BÀI GIẢNG & HỌC LIỆU (AI LECTURE ASSISTANT)

> **Mã đề tài:** AI20K-005  
> **Lĩnh vực:** Giáo dục Đại học — Thiết kế Khóa học (Higher Education — Course Design)  
> **Đối tác:** VinUni × Vingroup (Gen AI Engineer Training Program)  
> **Phiên bản:** MVP 1.0 (6-Week Release)

---

## 1. GIỚI THIỆU TỔNG QUAN (EXECUTIVE SUMMARY)
Hệ thống **AI Lecture Assistant** là giải pháp toàn diện hỗ trợ Giảng viên Đại học (đặc biệt tại các môi trường quốc tế như VinUni) trong việc tối ưu hóa quy trình thiết kế giáo án, bài giảng, kịch bản tương tác và ngân hàng câu hỏi kiểm tra đánh giá. 

Điểm khác biệt cốt lõi của hệ thống là đảm bảo **Constructive Alignment (Tính liên kết chặt chẽ)** giữa Chuẩn đầu ra môn học (CLO), Thang đo Bloom và Học liệu sinh ra, đáp ứng các tiêu chuẩn kiểm định giáo dục quốc tế (AUN-QA, ABET) nhưng chỉ tốn dưới 30 phút soạn thảo thay vì 3 ngày làm việc như trước đây.

---

## 2. BỐI CẢNH VÀ CÁC VẤN ĐỀ CỐT LÕI (PAIN POINTS)
Trong bối cảnh giáo dục đại học chất lượng cao, giảng viên đang phải đối mặt với các vấn đề lớn:
1. **Gánh nặng hành chính kiểm định:** Việc lập ma trận đối chiếu câu hỏi thi với CLO và thang Bloom để nộp cho phòng Khảo thí/Đảm bảo chất lượng cực kỳ tốn thời gian.
2. **Nỗi sợ AI ảo tưởng (Hallucination):** Giảng viên không thể sử dụng các AI đại trà vì nguy cơ bịa đặt kiến thức, trích dẫn tài liệu giả làm ảnh hưởng nghiêm trọng đến uy tín học thuật.
3. **Thụ động trong lớp học:** Khó khăn trong việc thiết kế các kịch bản Active Learning (Học tập chủ động) phù hợp với sĩ số lớp và cơ sở vật chất thực tế.
4. **Vấn nạn gian lận bằng ChatGPT:** Áp lực phải đổi mới đề thi liên tục, tạo ra nhiều mã đề đồng cấu (Isomorphic) cùng độ khó nhưng thay đổi ngữ cảnh/số liệu để chống gian lận.

---

## 3. MỤC TIÊU DỰ ÁN (PROJECT GOALS)
- **Tối ưu năng suất:** Giảm thời gian soạn thảo đề cương môn học, slide bài giảng, hoạt động lớp và bộ câu hỏi đánh giá từ **3 ngày xuống dưới 30 phút**.
- **Đảm bảo tính chính xác học thuật:** Áp dụng cơ chế **Strict RAG** (chỉ truy xuất dữ liệu từ giáo trình giảng viên cung cấp) để đạt **0% tỷ lệ ảo tưởng trích dẫn**.
- **Chuẩn hóa kiểm định:** Tự động hóa việc gắn nhãn Bloom (B1 - B6) và ánh xạ CLO cho từng câu hỏi, kết xuất ma trận độ phủ trực quan để báo cáo.
- **Nâng cao tính tương tác:** Đề xuất kịch bản Active Learning thực tế phù hợp với các ràng buộc về không gian và sĩ số lớp học.

---

## 4. PHẠM VI SẢN PHẨM MVP (MVP SCOPE)
Hệ thống sẽ được triển khai dưới dạng một ứng dụng Web (Single Page Application) tương tác với API backend, tập trung vào 6 tính năng cốt lõi:
1. **Syllabus Ingestion & CLO Mapper:** Tải lên Syllabus (PDF/Docx/Text), tự động bóc tách thông tin môn học và danh sách CLO, cho phép chỉnh sửa thủ công.
2. **Source Knowledge Management (RAG):** Tải tài liệu tham khảo (Giáo trình, Slides, Bài báo) cho từng môn học.
3. **Skeletal Outline Design:** Sinh khung chương trình giảng dạy của môn học và hỗ trợ kéo thả chỉnh sửa.
4. **Split-Screen Editor (Human-in-the-loop):** Giao diện chia đôi màn hình: Bên trái là học liệu/hoạt động do AI đề xuất (Markdown); bên phải là editor của giảng viên để duyệt và tinh chỉnh trực tiếp.
5. **Isomorphic Question & Bloom Tagging:** Sinh bộ câu hỏi trắc nghiệm kèm nhãn Bloom và CLO. Tích hợp quy trình tự giải đề của AI (Self-Correction Pipeline) để loại bỏ câu hỏi lỗi logic trước khi hiển thị cho giảng viên.
6. **Web Search & Credibility Evaluation:** Khi không có tài liệu nguồn, Agent tìm kiếm web và đánh giá độ tin cậy của tài liệu mạng dựa trên DOI, tên miền học thuật và sự đồng thuận khoa học.

---

## 5. ĐỐI TƯỢNG SỬ DỤNG (TARGET AUDIENCE)
- **Giảng viên Đại học (Primary User):** Trực tiếp thiết kế bài giảng, soạn đề cương môn học và sinh ngân hàng câu hỏi.
- **Trợ giảng & Thiết kế chương trình (Secondary User):** Soạn thảo học liệu phụ trợ dưới sự kiểm duyệt của giảng viên.
- **Phòng Khảo thí & Đảm bảo Chất lượng (Auditor/QA):** Giám sát ma trận Bloom - CLO và tính tuân thủ của đề thi so với Syllabus chính thức.

---

## 6. DANH MỤC BÀN GIAO CHI TIẾT (DELIVERABLES)
1. **Tài liệu đặc tả (Documentation):**
   - **Brief dự án:** Tổng quan mục tiêu và định hướng sản phẩm.
   - **Tài liệu PRD:** Đặc tả chi tiết các yêu cầu chức năng (FR) và phi chức năng (NFR).
   - **Tài liệu UI Flow & Wireframe:** Thiết kế sơ đồ luồng đi của người dùng và phác thảo giao diện cấu trúc (ASCII wireframe) của MVP.
2. **Hệ thống phần mềm (Software System):**
   - **Frontend:** Source code React/Vite (định dạng gọn gàng, responsive).
   - **Backend:** Source code FastAPI (hỗ trợ RESTful API, RAG, Web Search, Self-Correction).
   - **Database:** SQLite schema & ChromaDB vector database.
3. **Môi trường vận hành (Deployment):**
   - Link Web App chạy trực tiếp (Vercel).
   - Link API Backend (Render).
   - Trace log hệ thống (Langfuse) phục vụ giám sát và gỡ lỗi.
