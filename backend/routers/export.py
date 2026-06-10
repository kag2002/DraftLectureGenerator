from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse, FileResponse, HTMLResponse
import re
from sqlalchemy.orm import Session
import json
import os
import subprocess
from backend.database.session import get_db
from backend.database.models import Course, Chapter, ChapterMaterial, Question, CLO, User
from backend.auth import get_current_user
from backend.utils.markdown_to_slidej import convert_markdown_to_slidej

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
    content = f"# GIÁO ÁN HỌC LIỆU MÔN HỌC: {course.course_name.upper()}\n"
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
    content = f"# ĐỀ THI TRẮC NGHIỆM MÔN HỌC: {course.course_name.upper()}\n"
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

@router.get("/chapters/{chapter_id}/export-pptx")
def export_chapter_pptx(
    chapter_id: int,
    theme: str = "deep_space",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Xác thực chương học và quyền sở hữu môn học
    chapter = db.query(Chapter).join(Course).filter(Chapter.id == chapter_id, Course.user_id == current_user.id).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chương học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    # 2. Lấy học liệu chương học
    material = db.query(ChapterMaterial).filter(ChapterMaterial.chapter_id == chapter_id).first()
    if not material or not material.slide_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chương học này chưa có nội dung slide bài giảng thiết kế."
        )
        
    # 3. Chuyển đổi Markdown sang SlideJ JSON
    course_name = chapter.course.course_name
    author_name = current_user.full_name or current_user.email or "Giảng viên"
    
    slidej_json = convert_markdown_to_slidej(
        material.slide_content,
        course_title=course_name,
        author_name=author_name,
        theme_name=theme
    )
    
    # 4. Ghi JSON và gọi SlideJ CLI để tạo file PPTX
    os.makedirs("temp", exist_ok=True)
    json_path = os.path.join("temp", f"slidej_{chapter_id}.json")
    pptx_path = os.path.join("temp", f"slidej_{chapter_id}.pptx")
    
    try:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(slidej_json, f, ensure_ascii=False, indent=2)
            
        cmd = f"slidej generate {json_path} -o {pptx_path}"
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        
        if res.returncode != 0:
            print(f"SlideJ generate error: {res.stderr}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Lỗi SlideJ CLI: {res.stderr or res.stdout}"
            )
            
        return FileResponse(
            pptx_path, 
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            filename=f"Bai_Giang_Chuong_{chapter_id}.pptx"
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi hệ thống khi xuất slide: {str(e)}"
        )


def render_markdown_to_html(md_text: str) -> str:
    # Escape HTML characters safely
    html = md_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Title markers
    html = re.sub(r"^### (.*?)$", r"<h3 class='lp-h3'>\1</h3>", html, flags=re.MULTILINE)
    html = re.sub(r"^## (.*?)$", r"<h2 class='lp-h2'>\1</h2>", html, flags=re.MULTILINE)
    html = re.sub(r"^# (.*?)$", r"<h1 class='lp-h1'>\1</h1>", html, flags=re.MULTILINE)
    # Bold markers
    html = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", html)
    # List parsing
    lines = html.split("\n")
    in_list = False
    new_lines = []
    for line in lines:
        match = re.match(r"^[-*+•]\s*(.*)$", line.strip())
        if match:
            if not in_list:
                new_lines.append("<ul class='lp-ul'>")
                in_list = True
            new_lines.append(f"<li class='lp-li'>{match.group(1)}</li>")
        else:
            if in_list:
                new_lines.append("</ul>")
                in_list = False
            new_lines.append(line)
    if in_list:
        new_lines.append("</ul>")
    html = "\n".join(new_lines)
    # Paragraph mapping
    html = "\n".join(
        f"<p class='lp-p'>{line}</p>" if line.strip() and not line.strip().startswith("<h") and not line.strip().startswith("<u") and not line.strip().startswith("</u") and not line.strip().startswith("<l")
        else line
        for line in html.split("\n")
    )
    return html


@router.get("/chapters/{chapter_id}/export-lesson-plan", response_class=HTMLResponse)
def export_lesson_plan(
    chapter_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Xác thực chương học và quyền sở hữu môn học
    chapter = db.query(Chapter).join(Course).filter(Chapter.id == chapter_id, Course.user_id == current_user.id).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chương học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    # 2. Lấy học liệu chương học
    material = db.query(ChapterMaterial).filter(ChapterMaterial.chapter_id == chapter_id).first()
    if not material or not material.active_learning_script:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chương học này chưa có nội dung kịch bản giảng dạy Active Learning."
        )
        
    active_learning_script = material.active_learning_script or ""
    marker = "---RATIONALE---"
    rationale_html = ""
    
    if marker in active_learning_script:
        parts = active_learning_script.split(marker, 1)
        main_script = parts[0].strip()
        rationale_text = parts[1].strip()
        script_html = render_markdown_to_html(main_script)
        if rationale_text:
            rationale_html = f"""
            <div class="rationale-panel" style="margin-top: 30px; padding: 20px; background-color: #f0fff4; border-left: 4px solid #38a169; border-radius: 8px; border: 1px solid #c6f6d5;">
                <h3 style="margin-top: 0; color: #276749; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
                    💡 GIẢI TRÌNH SƯ PHẠM (PEDAGOGICAL RATIONALE)
                </h3>
                <div style="font-size: 13.5px; color: #2f855a; font-style: italic; line-height: 1.5;">
                    {render_markdown_to_html(rationale_text)}
                </div>
            </div>
            """
    else:
        script_html = render_markdown_to_html(active_learning_script)
        
    course_name = chapter.course.course_name
    chapter_title = chapter.title
    author_name = current_user.full_name or current_user.email or "Giảng viên"
    
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Giáo án tương tác - Chương: {chapter_title}</title>
    <style>
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #1a202c;
            line-height: 1.6;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            background-color: #ffffff;
        }}
        @media print {{
            body {{
                padding: 0;
                max-width: 100%;
                font-size: 12pt;
            }}
            .no-print {{
                display: none;
            }}
        }}
        .header-panel {{
            border-bottom: 2px solid #1a365d;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .meta-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 15px;
            font-size: 14px;
            background-color: #f7fafc;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #edf2f7;
        }}
        .meta-item {{
            margin-bottom: 5px;
        }}
        .meta-label {{
            font-weight: bold;
            color: #4a5568;
        }}
        .lp-h1 {{
            color: #1a365d;
            font-size: 24px;
            margin-top: 0;
            margin-bottom: 5px;
        }}
        .lp-h2 {{
            color: #2c5282;
            font-size: 18px;
            margin-top: 25px;
            margin-bottom: 12px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 5px;
        }}
        .lp-h3 {{
            color: #4a5568;
            font-size: 15px;
            margin-top: 18px;
            margin-bottom: 8px;
        }}
        .lp-p {{
            margin-bottom: 12px;
            text-align: justify;
        }}
        .lp-ul {{
            margin: 10px 0 15px 20px;
            padding: 0;
        }}
        .lp-li {{
            margin-bottom: 6px;
        }}
        .print-btn {{
            background-color: #1a365d;
            color: #ffffff;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
            margin-bottom: 20px;
        }}
        .print-btn:hover {{
            background-color: #2b6cb0;
        }}
    </style>
</head>
<body>
    <div class="no-print" style="text-align: right;">
        <button class="print-btn" onclick="window.print()">🖨️ In hoặc Lưu file PDF Giáo án</button>
    </div>
    <div class="header-panel">
        <h1 class="lp-h1">GIÁO ÁN HOẠT ĐỘNG SƯ PHẠM (LESSON PLAN)</h1>
        <div style="font-size: 14px; color: #718096; font-style: italic;">AI Lecture Assistant - Đảm bảo Chất lượng Đào tạo</div>
        <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">Môn học:</span> {course_name}</div>
            <div class="meta-item"><span class="meta-label">Chương học:</span> {chapter_title}</div>
            <div class="meta-item"><span class="meta-label">Giảng viên:</span> {author_name}</div>
            <div class="meta-item"><span class="meta-label">Thiết kế Sư phạm:</span> Tương tác chủ động (Active Learning)</div>
        </div>
    </div>
    <div class="content-body">
        {script_html}
        {rationale_html}
    </div>
</body>
</html>"""
    return HTMLResponse(content=html_content, status_code=200)
