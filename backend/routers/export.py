from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
import json
from backend.database.session import get_db
from backend.database.models import Course, Chapter, ChapterMaterial, Question, CLO, User
from backend.auth import get_current_user

router = APIRouter(prefix="/api/courses", tags=["export"])

@router.get("/{course_id}/export-materials", response_class=PlainTextResponse)
def export_course_materials(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Xác thực môn học
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    # 2. Lấy danh sách chương học sắp xếp theo sort_order
    chapters = db.query(Chapter).filter(Chapter.course_id == course_id).order_by(Chapter.sort_order).all()
    
    # 3. Tạo nội dung file Markdown tổng hợp
    content = f"# GIÁO ÁN HỌC LIỆU MÔN HỌC: {course.course_name.toUpperCase()}\n"
    content += f"Mã môn học: {course.course_code}\n"
    content += f"Giảng viên biên soạn: {current_user.full_name or current_user.email}\n"
    content += "Sinh tự động bởi AI Lecture Assistant (G02-Team023)\n\n"
    content += "========================================================\n\n"
    
    if not chapters:
        content += "* Chưa có nội dung chương học nào được thiết kế cho môn học này.\n"
    else:
        for idx, ch in enumerate(chapters):
            content += f"## CHƯƠNG {idx + 1}: {ch.title.upper()}\n"
            content += f"Mô tả chương: {ch.description or 'N/A'}\n\n"
            
            # Lấy học liệu của chương
            material = db.query(ChapterMaterial).filter(ChapterMaterial.chapter_id == ch.id).first()
            if material:
                content += "### 1. Slide Bài giảng (Markdown)\n"
                if material.slide_content:
                    content += f"{material.slide_content}\n\n"
                else:
                    content += "* Chưa biên soạn slide cho chương này.\n\n"
                    
                content += "### 2. Kịch bản Hoạt động (Active Learning)\n"
                if material.active_learning_script:
                    content += f"{material.active_learning_script}\n\n"
                else:
                    content += "* Chưa biên soạn kịch bản active learning cho chương này.\n\n"
            else:
                content += "* Chương học chưa được thiết kế học liệu.\n\n"
                
            content += "--------------------------------------------------------\n\n"
            
    # Thiết lập headers để trình duyệt nhận diện tải file đính kèm
    headers = {
        "Content-Disposition": f"attachment; filename=Giao_an_{course.course_code}.md"
    }
    return PlainTextResponse(content, headers=headers)

@router.get("/{course_id}/export-questions", response_class=PlainTextResponse)
def export_course_questions(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Xác thực môn học
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    # 2. Lấy danh sách câu hỏi
    questions = db.query(Question).filter(Question.course_id == course_id).all()
    clos = db.query(CLO).filter(CLO.course_id == course_id).all()
    
    # 3. Tạo đề thi
    content = f"# ĐỀ THI TRẮC NGHIỆM MÔN HỌC: {course.course_name.toUpperCase()}\n"
    content += f"Mã môn học: {course.course_code}\n"
    content += f"Số lượng câu hỏi: {len(questions)} câu\n"
    content += "Thời gian làm bài: 45 phút (Đề thi tham khảo)\n"
    content += "========================================================\n\n"
    
    if not questions:
        content += "* Chưa soạn câu hỏi thi trắc nghiệm nào trong ngân hàng đề thi.\n"
    else:
        # Phần 1: Đề thi
        content += "## PHẦN I: ĐỀ THI\n\n"
        for idx, q in enumerate(questions):
            content += f"Câu {idx + 1}: {q.question_text}\n"
            
            opts = []
            try:
                opts = json.loads(q.options_json) if q.options_json else []
            except Exception:
                opts = []
                
            labels = ["A", "B", "C", "D"]
            for o_idx, opt in enumerate(opts):
                if o_idx < len(labels):
                    content += f"  {labels[o_idx]}. {opt}\n"
            content += "\n"
            
        # Phần 2: Đáp án đối chiếu
        content += "========================================================\n\n"
        content += "## PHẦN II: ĐÁP ÁN VÀ MA TRẬN PHÂN LOẠI CHẤT LƯỢNG (CLO - BLOOM)\n\n"
        
        for idx, q in enumerate(questions):
            linked_clo = next((c for c in clos if c.id == q.clo_id), None)
            clo_code = linked_clo.clo_code if linked_clo else "N/A"
            
            content += f"Câu {idx + 1}:\n"
            content += f"  - Đáp án đúng: {q.correct_answer}\n"
            content += f"  - Chuẩn đầu ra: {clo_code}\n"
            content += f"  - Cấp độ Bloom: Mức {q.bloom_level}\n\n"
            
    headers = {
        "Content-Disposition": f"attachment; filename=De_thi_{course.course_code}.md"
    }
    return PlainTextResponse(content, headers=headers)
