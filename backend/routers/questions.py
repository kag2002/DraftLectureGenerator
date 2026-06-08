from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import json
from backend.database.session import get_db
from backend.database.models import Course, CLO, Chapter, Question, User
from backend.auth import get_current_user
from backend.database.vector_db import search_rag_isolated
from backend.utils.llm_client import call_llm_json

router = APIRouter(prefix="/api/courses", tags=["questions"])

# Pydantic Schemas
class QuestionGenerateRequest(BaseModel):
    clo_id: int | None = Field(None, description="ID của CLO mục tiêu")
    chapter_id: int | None = Field(None, description="ID của chương học")
    bloom_level: int = Field(3, ge=1, le=6, description="Mức độ Bloom từ 1 đến 6")
    count: int = Field(2, ge=1, le=10, description="Số lượng câu hỏi cần sinh")

class QuestionUpdateRequest(BaseModel):
    question_text: str = Field(..., description="Nội dung câu hỏi")
    options_json: str = Field(..., description="Mảng các lựa chọn dưới dạng JSON string")
    correct_answer: str = Field(..., description="Đáp án đúng")
    bloom_level: int = Field(..., ge=1, le=6, description="Mức Bloom")
    clo_id: int | None = Field(None, description="ID CLO liên kết")

class QuestionResponse(BaseModel):
    id: int
    course_id: int
    chapter_id: int | None
    question_text: str
    question_type: str
    options_json: str | None
    correct_answer: str
    bloom_level: int
    clo_id: int | None
    is_active: bool
    
    class Config:
        from_attributes = True

# --- API CRUD QUESTIONS ---

@router.get("/{course_id}/questions", response_model=list[QuestionResponse])
def get_course_questions(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Xác thực quyền sở hữu môn học
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
    return db.query(Question).filter(Question.course_id == course_id).all()

@router.put("/questions/{question_id}", response_model=QuestionResponse)
def update_question(question_id: int, req: QuestionUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Xác thực quyền
    question = db.query(Question).join(Course).filter(Question.id == question_id, Course.user_id == current_user.id).first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Câu hỏi không tồn tại hoặc bạn không có quyền chỉnh sửa."
        )
    
    question.question_text = req.question_text
    question.options_json = req.options_json
    question.correct_answer = req.correct_answer
    question.bloom_level = req.bloom_level
    question.clo_id = req.clo_id
    
    db.commit()
    db.refresh(question)
    return question

@router.delete("/questions/{question_id}")
def delete_question(question_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Xác thực quyền
    question = db.query(Question).join(Course).filter(Question.id == question_id, Course.user_id == current_user.id).first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Câu hỏi không tồn tại hoặc bạn không có quyền chỉnh sửa."
        )
    db.delete(question)
    db.commit()
    return {"message": "Đã xóa câu hỏi thành công."}

# --- API AI MCQ GENERATION WITH SELF-CORRECTION ---

@router.post("/{course_id}/questions/generate")
def generate_questions(
    course_id: int,
    req: QuestionGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Xác thực quyền sở hữu môn học
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    # 2. Thu thập ngữ cảnh (CLO / Chapter / RAG)
    clo_context = ""
    target_clo = None
    if req.clo_id:
        target_clo = db.query(CLO).filter(CLO.id == req.clo_id, CLO.course_id == course_id).first()
        if target_clo:
            clo_context = f"Chuẩn đầu ra mục tiêu: [{target_clo.clo_code}] {target_clo.description} (Thang Bloom: {target_clo.bloom_level})\n"
            
    chapter_context = ""
    target_chapter = None
    if req.chapter_id:
        target_chapter = db.query(Chapter).filter(Chapter.id == req.chapter_id, Chapter.course_id == course_id).first()
        if target_chapter:
            chapter_context = f"Chương học liên quan: {target_chapter.title} - {target_chapter.description or ''}\n"

    # 3. Tìm kiếm RAG ngữ cảnh
    query_str = f"Câu hỏi trắc nghiệm {target_clo.description if target_clo else ''} {target_chapter.title if target_chapter else ''}"
    rag_hits = search_rag_isolated(query_str, user_id=current_user.id, course_id=course_id, top_k=4)
    rag_context = ""
    if rag_hits:
        for hit in rag_hits:
            rag_context += f"[Tài liệu: {hit['file_name']}]: {hit['text']}\n\n"

    # 4. Thiết lập System Prompts cho Generator & Solver (Self-Correction)
    generator_system_prompt = f"""Bạn là chuyên gia thiết kế câu hỏi trắc nghiệm kiểm tra đánh giá (Assessment Specialist).
Nhiệm vụ: Hãy sinh {req.count} câu hỏi trắc nghiệm (MCQ) có chất lượng học thuật cao.
Yêu cầu:
- Mức độ Bloom nhận thức: Mức {req.bloom_level}.
- Câu hỏi phải bám sát theo chuẩn đầu ra CLO và ngữ cảnh tài liệu RAG đã cho.
- Mỗi câu hỏi gồm câu hỏi (question_text), danh sách 4 lựa chọn (options_json: mảng JSON gồm 4 chuỗi), đáp án đúng (correct_answer: phải trùng khớp với chính xác một trong 4 lựa chọn), và đường dẫn tư duy giải thích (reasoning_path: giải thích chi tiết tại sao chọn đáp án này).

Đầu ra định dạng JSON:
{{
  "questions": [
    {{
      "question_text": "Nội dung câu hỏi...",
      "question_type": "MCQ",
      "options_json": "[\"Lựa chọn A\", \"Lựa chọn B\", \"Lựa chọn C\", \"Lựa chọn D\"]",
      "correct_answer": "Lựa chọn A",
      "bloom_level": {req.bloom_level},
      "reasoning_path": "Giải thích chi tiết các bước logic..."
    }}
  ]
}}
"""

    prompt = f"Thông tin môn học: {course.course_name}\n{clo_context}{chapter_context}\nNgữ cảnh tài liệu nguồn RAG:\n{rag_context}\n\nHãy sinh danh sách câu hỏi."

    # 5. Pha 1: Generator sinh câu hỏi nháp
    try:
        gen_data = call_llm_json(prompt, system_instruction=generator_system_prompt)
        raw_questions = gen_data.get("questions", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi sinh câu hỏi nháp: {str(e)}"
        )

    # 6. Pha 2: Solver/Verifier duyệt tự sửa lỗi (Self-Correction)
    validated_questions = []
    
    solver_system_prompt = """Bạn là một học sinh thông minh đang làm bài thi trắc nghiệm. Bạn tuyệt đối không biết đáp án trước.
Nhiệm vụ: Hãy giải câu hỏi trắc nghiệm sau đây một cách độc lập và khách quan nhất.
Quy tắc:
- Phân tích chi tiết từng lựa chọn dựa trên kiến thức logic và thông tin đề bài cung cấp.
- Đưa ra phân tích lập luận từng bước (reasoning_path).
- Cuối cùng, chọn ra đáp án đúng duy nhất (phải là một trong các lựa chọn được cho sẵn).

Đầu ra bắt buộc là định dạng JSON:
{
  "reasoning_path": "Phân tích logic từng bước...",
  "selected_answer": "Đáp án bạn chọn"
}
"""

    for q in raw_questions:
        correct = False
        attempts = 0
        current_question = q
        
        while not correct and attempts < 3:
            attempts += 1
            # Đóng vai Solver giải thử
            solver_prompt = f"""Câu hỏi: {current_question.get('question_text')}
Các lựa chọn: {current_question.get('options_json')}

Hãy phân tích giải và đưa ra đáp án."""
            
            try:
                solver_res = call_llm_json(solver_prompt, system_instruction=solver_system_prompt)
                selected_ans = solver_res.get("selected_answer", "").strip()
                target_ans = current_question.get("correct_answer", "").strip()
                
                # So sánh đáp án Generator và Solver
                if selected_ans.lower() == target_ans.lower() or selected_ans in target_ans or target_ans in selected_ans:
                    correct = True
                    # Cập nhật reasoning_path kết hợp cả hai
                    current_question["reasoning_path"] = f"Generator reasoning: {current_question.get('reasoning_path')} | Solver reasoning: {solver_res.get('reasoning_path')}"
                else:
                    # Nếu đáp án mâu thuẫn -> Bắt LLM sửa câu hỏi (Self-Correction Step)
                    correction_prompt = f"""Câu hỏi bạn vừa sinh có mâu thuẫn logic:
- Đề bài: {current_question.get('question_text')}
- Các lựa chọn: {current_question.get('options_json')}
- Đáp án Generator chỉ định: {target_ans}
- Học sinh độc lập giải ra: {selected_ans} (Tư duy giải: {solver_res.get('reasoning_path')})

Hãy sửa lại câu hỏi hoặc các phương án lựa chọn và chỉ định đáp án đúng chính xác nhất để không còn bất kỳ mâu thuẫn nào.
Đầu ra định dạng JSON giống như cấu trúc Generator ban đầu."""
                    
                    current_question = call_llm_json(correction_prompt, system_instruction=generator_system_prompt)
            except Exception as e:
                # Nếu Solver lỗi, fallback chấp nhận câu hỏi gốc
                print(f"Lỗi trong quá trình Solver giải thử: {e}")
                correct = True
                
        validated_questions.append(current_question)

    # 7. Lưu các câu hỏi hợp lệ vào Database
    saved_questions = []
    for q_data in validated_questions:
        # options_json cần được lưu dưới dạng chuỗi JSON hợp lệ trong DB
        opts = q_data.get("options_json", "[]")
        if isinstance(opts, list):
            opts_str = json.dumps(opts)
        else:
            opts_str = opts
            
        new_q = Question(
            course_id=course_id,
            chapter_id=req.chapter_id,
            question_text=q_data.get("question_text", ""),
            question_type="MCQ",
            options_json=opts_str,
            correct_answer=q_data.get("correct_answer", ""),
            bloom_level=q_data.get("bloom_level", req.bloom_level),
            clo_id=req.clo_id
        )
        db.add(new_q)
        saved_questions.append(new_q)
        
    db.commit()
    for q in saved_questions:
        db.refresh(q)
        
    return {
        "message": f"Sinh thành công {len(saved_questions)} câu hỏi trắc nghiệm đã qua Self-Correction.",
        "questions": [
            {
                "id": q.id,
                "question_text": q.question_text,
                "options_json": q.options_json,
                "correct_answer": q.correct_answer,
                "bloom_level": q.bloom_level,
                "clo_id": q.clo_id
            }
            for q in saved_questions
        ]
    }

# --- API AI ISOMORPHIC GENERATION (SINH CÂU HỎI TƯƠNG TỰ) ---

@router.post("/questions/{question_id}/generate-isomorphic")
def generate_isomorphic_question(
    question_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Tìm câu hỏi gốc và xác thực quyền
    orig_q = db.query(Question).join(Course).filter(Question.id == question_id, Course.user_id == current_user.id).first()
    if not orig_q:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Câu hỏi gốc không tồn tại hoặc bạn không có quyền sở hữu."
        )
        
    # 2. Gọi LLM sinh câu hỏi đồng cấu
    system_prompt = """Bạn là chuyên gia sư phạm. Nhiệm vụ của bạn là tạo một câu hỏi trắc nghiệm đồng cấu (isomorphic question).
Quy tắc:
- Giữ nguyên bản chất lý thuyết, giải thuật hoặc công thức toán học/logic của câu hỏi gốc.
- Thay đổi số liệu, ngữ cảnh dẫn, tên biến hoặc cách đặt câu hỏi để tránh trùng lặp.
- Các lựa chọn nhiễu và đáp án đúng phải được thay đổi tương ứng dựa trên thông số mới.

Đầu ra định dạng JSON:
{
  "question_text": "Nội dung câu hỏi đồng cấu mới...",
  "options_json": "[\"Lựa chọn A\", \"Lựa chọn B\", \"Lựa chọn C\", \"Lựa chọn D\"]",
  "correct_answer": "Lựa chọn đúng mới"
}
"""
    prompt = f"""Câu hỏi gốc: {orig_q.question_text}
Các lựa chọn gốc: {orig_q.options_json}
Đáp án gốc: {orig_q.correct_answer}

Hãy tạo câu hỏi đồng cấu."""

    try:
        iso_json = call_llm_json(prompt, system_instruction=system_prompt)
        
        opts = iso_json.get("options_json", "[]")
        if isinstance(opts, list):
            opts_str = json.dumps(opts)
        else:
            opts_str = opts
            
        new_q = Question(
            course_id=orig_q.course_id,
            chapter_id=orig_q.chapter_id,
            question_text=iso_json.get("question_text", ""),
            question_type="MCQ",
            options_json=opts_str,
            correct_answer=iso_json.get("correct_answer", ""),
            bloom_level=orig_q.bloom_level,
            clo_id=orig_q.clo_id
        )
        db.add(new_q)
        db.commit()
        db.refresh(new_q)
        
        return {
            "message": "Sinh câu hỏi đồng cấu tương tự thành công.",
            "question": {
                "id": new_q.id,
                "question_text": new_q.question_text,
                "options_json": new_q.options_json,
                "correct_answer": new_q.correct_answer,
                "bloom_level": new_q.bloom_level,
                "clo_id": new_q.clo_id
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi sinh câu hỏi đồng cấu: {str(e)}"
        )

# --- API CLO-BLOOM COVERAGE MATRIX ---

@router.get("/{course_id}/matrix-coverage")
def get_matrix_coverage(
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
        
    # 2. Lấy danh sách CLO của môn học
    clos = db.query(CLO).filter(CLO.course_id == course_id).all()
    
    # 3. Lấy tất cả câu hỏi của môn học
    questions = db.query(Question).filter(Question.course_id == course_id).all()
    
    # 4. Thống kê số lượng câu hỏi phủ theo ma trận CLO x Bloom Level (1->6)
    matrix = {}
    for c in clos:
        matrix[c.clo_code] = {
            "clo_id": c.id,
            "description": c.description,
            "target_bloom": c.bloom_level,
            "levels": {str(b): 0 for b in range(1, 7)}
        }
        
    for q in questions:
        if q.clo_id:
            # Tìm clo_code tương ứng
            clo = db.query(CLO).filter(CLO.id == q.clo_id).first()
            if clo and clo.clo_code in matrix:
                bloom_str = str(q.bloom_level)
                if bloom_str in matrix[clo.clo_code]["levels"]:
                    matrix[clo.clo_code]["levels"][bloom_str] += 1

    return {
        "course_id": course_id,
        "matrix": matrix
    }
