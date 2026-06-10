from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import json
from backend.database.session import get_db, SessionLocal
from backend.database.models import Chapter, ChapterMaterial, User, Course, CLO
from backend.auth import get_current_user
from backend.database.vector_db import search_rag_isolated
from backend.utils.llm_client import call_llm_json, call_llm_stream, langfuse
from backend.prompts.materials import (
    build_material_system_prompt_json,
    build_material_system_prompt_stream,
    build_material_user_prompt,
    LANGUAGE_MAP,
)

router = APIRouter(prefix="/api/courses", tags=["materials"])

# Pydantic schemas
class MaterialSave(BaseModel):
    slide_content: str = Field(..., description="Slide outline dạng Markdown")
    active_learning_script: str = Field(..., description="Kịch bản hoạt động active learning")

class MaterialResponse(BaseModel):
    id: int
    chapter_id: int
    slide_content: str | None
    active_learning_script: str | None
    
    class Config:
        from_attributes = True

class MaterialGenerateRequest(BaseModel):
    class_size: int = Field(40, description="Sĩ số lớp học để thiết kế nhóm")
    has_wifi: bool = Field(True, description="Wifi lớp học có khả dụng không")
    furniture_type: str = Field("movable", description="Bàn ghế: 'movable' (di chuyển) hoặc 'fixed' (cố định)")
    language: str = Field("vi", description="Ngôn ngữ bài giảng: 'vi' (Tiếng Việt) hoặc 'en' (Tiếng Anh) hoặc 'bilingual' (Song ngữ)")

# --- API CHAPTER MATERIALS ---

@router.get("/chapters/{chapter_id}/materials", response_model=MaterialResponse)
def get_chapter_materials(chapter_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Xác thực quyền sở hữu
    chapter = db.query(Chapter).join(Course).filter(Chapter.id == chapter_id, Course.user_id == current_user.id).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chương học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    material = db.query(ChapterMaterial).filter(ChapterMaterial.chapter_id == chapter_id).first()
    if not material:
        # Trả về đối tượng trống nếu chưa có
        return {
            "id": 0,
            "chapter_id": chapter_id,
            "slide_content": "",
            "active_learning_script": ""
        }
    return material

@router.put("/chapters/{chapter_id}/materials", response_model=MaterialResponse)
def save_chapter_materials(chapter_id: int, material_data: MaterialSave, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chapter = db.query(Chapter).join(Course).filter(Chapter.id == chapter_id, Course.user_id == current_user.id).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chương học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    material = db.query(ChapterMaterial).filter(ChapterMaterial.chapter_id == chapter_id).first()
    if not material:
        material = ChapterMaterial(
            chapter_id=chapter_id,
            slide_content=material_data.slide_content,
            active_learning_script=material_data.active_learning_script
        )
        db.add(material)
    else:
        material.slide_content = material_data.slide_content
        material.active_learning_script = material_data.active_learning_script
        
    db.commit()
    db.refresh(material)
    return material

# --- API AI DEEP GENERATION (SLIDE & ACTIVE LEARNING) ---

@router.post("/chapters/{chapter_id}/generate-materials")
def generate_chapter_materials(
    chapter_id: int, 
    req: MaterialGenerateRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 1. Xác thực quyền sở hữu môn học
    chapter = db.query(Chapter).join(Course).filter(Chapter.id == chapter_id, Course.user_id == current_user.id).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chương học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    # 2. Truy vấn RAG cô lập từ ChromaDB
    query = f"{chapter.title} {chapter.description or ''}"
    rag_hits = search_rag_isolated(query, user_id=current_user.id, course_id=chapter.course_id, top_k=4)
    
    # 3. Định dạng ngữ cảnh RAG kèm tiền tố số trang thật
    rag_context = ""
    if rag_hits:
        for idx, hit in enumerate(rag_hits):
            rag_context += f"[Tài liệu: {hit['file_name']} - Trang: {hit['page_number']}]: {hit['text']}\n\n"
    else:
        print("⚠️ ChromaDB RAG: Không tìm thấy ngữ cảnh tài liệu cho truy vấn này.")
        
    # Lấy danh sách CLO của môn học
    clos = db.query(CLO).filter(CLO.course_id == chapter.course_id).all()
    clos_context = ""
    if clos:
        clos_context = "Danh sách Chuẩn đầu ra (CLOs) của môn học:\n"
        for c in clos:
            clos_context += f"- [{c.clo_code}] {c.description} (Thang Bloom mục tiêu: {c.bloom_level})\n"

    # 4. Gửi Prompt sinh bài giảng cho LLM
    target_lang = LANGUAGE_MAP.get(req.language, "Tiếng Việt (Vietnamese)")

    system_prompt = build_material_system_prompt_json(
        target_lang=target_lang,
        class_size=req.class_size,
        has_wifi=req.has_wifi,
        furniture_type=req.furniture_type,
    )
    prompt = build_material_user_prompt(
        chapter_title=chapter.title,
        chapter_description=chapter.description or 'N/A',
        clos_context=clos_context,
        rag_context=rag_context,
    )
    
    # --- Langfuse: Parent Trace ---
    mat_trace = None
    if langfuse:
        mat_trace = langfuse.trace(
            name="chapter_materials_generation",
            metadata={"chapter_id": chapter_id, "chapter_title": chapter.title, "language": req.language}
        )
    
    try:
        materials_json = call_llm_json(
            prompt, system_instruction=system_prompt,
            trace_or_span=mat_trace,
            prompt_name="material_generation_json", prompt_version="v1",
            metadata={"chapter_id": chapter_id}
        )
        
        # 5. Lưu kết quả vào DB để giảng viên có thể load lại
        material = db.query(ChapterMaterial).filter(ChapterMaterial.chapter_id == chapter_id).first()
        if not material:
            material = ChapterMaterial(
                chapter_id=chapter_id,
                slide_content=materials_json.get("slide_content", ""),
                active_learning_script=materials_json.get("active_learning_script", "")
            )
            db.add(material)
        else:
            material.slide_content = materials_json.get("slide_content", "")
            material.active_learning_script = materials_json.get("active_learning_script", "")
            
        db.commit()
        
        return {
            "message": "AI sinh học liệu thành công.",
            "slide_content": material.slide_content,
            "active_learning_script": material.active_learning_script
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi AI sinh bài giảng: {str(e)}"
        )


@router.post("/chapters/{chapter_id}/generate-materials-stream")
def generate_chapter_materials_stream(
    chapter_id: int, 
    req: MaterialGenerateRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Sinh học liệu (slide + active learning) và stream tiến độ kèm token văn bản qua SSE."""
    # 1. Xác thực quyền sở hữu môn học
    chapter = db.query(Chapter).join(Course).filter(Chapter.id == chapter_id, Course.user_id == current_user.id).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chương học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    course_name = chapter.course.course_name
    chapter_title = chapter.title
    chapter_description = chapter.description or ""
    course_id = chapter.course_id
    user_id = current_user.id
    
    def event_stream():
        def send(event: str, data: dict):
            return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
            
        yield send("stage", {"stage": 1, "message": "🔍 Đang truy vấn tài liệu tham chiếu (RAG Context)..."})
        
        # 2. Truy vấn RAG cô lập từ ChromaDB
        query = f"{chapter_title} {chapter_description}"
        rag_hits = search_rag_isolated(query, user_id=user_id, course_id=course_id, top_k=4)
        
        # 3. Định dạng ngữ cảnh RAG kèm tiền tố số trang thật
        rag_context = ""
        if rag_hits:
            for hit in rag_hits:
                rag_context += f"[Tài liệu: {hit['file_name']} - Trang: {hit['page_number']}]: {hit['text']}\n\n"
                
        yield send("stage", {"stage": 2, "message": f"🧠 Đang gọi AI để thiết kế bài giảng (RAG có {len(rag_hits)} đoạn tham chiếu)..."})
        
        # Lấy danh sách CLO của môn học
        new_db_for_clos = SessionLocal()
        clos_context = ""
        try:
            clos = new_db_for_clos.query(CLO).filter(CLO.course_id == course_id).all()
            if clos:
                clos_context = "Danh sách Chuẩn đầu ra (CLOs) của môn học:\n"
                for c in clos:
                    clos_context += f"- [{c.clo_code}] {c.description} (Thang Bloom mục tiêu: {c.bloom_level})\n"
        finally:
            new_db_for_clos.close()

        # 4. Gửi Prompt sinh bài giảng cho LLM
        target_lang = LANGUAGE_MAP.get(req.language, "Tiếng Việt (Vietnamese)")
        
        system_prompt = build_material_system_prompt_stream(
            target_lang=target_lang,
            class_size=req.class_size,
            has_wifi=req.has_wifi,
            furniture_type=req.furniture_type,
        )
        prompt = build_material_user_prompt(
            chapter_title=chapter_title,
            chapter_description=chapter_description or 'N/A',
            clos_context=clos_context,
            rag_context=rag_context,
        )
        
        # --- Langfuse: Parent Trace cho stream ---
        mat_stream_trace = None
        if langfuse:
            mat_stream_trace = langfuse.trace(
                name="chapter_materials_generation_stream",
                metadata={"chapter_id": chapter_id, "chapter_title": chapter_title, "language": req.language}
            )
        
        full_text = ""
        try:
            for chunk in call_llm_stream(
                prompt, system_instruction=system_prompt,
                trace_or_span=mat_stream_trace,
                prompt_name="material_generation_stream", prompt_version="v1",
                metadata={"chapter_id": chapter_id}
            ):
                full_text += chunk
                yield send("token", {"token": chunk})
        except Exception as e:
            yield send("error", {"message": f"Lỗi trong quá trình AI sinh bài giảng: {str(e)}"})
            return
            
        # Parse full_text to slide_content and active_learning_script
        slide_content = ""
        active_learning_script = ""
        
        if "---SLIDES---" in full_text:
            parts = full_text.split("---SLIDES---", 1)[1]
            if "---ACTIVE_LEARNING---" in parts:
                slide_content, active_learning_script = parts.split("---ACTIVE_LEARNING---", 1)
            else:
                slide_content = parts
        else:
            if "---ACTIVE_LEARNING---" in full_text:
                slide_content, active_learning_script = full_text.split("---ACTIVE_LEARNING---", 1)
            else:
                slide_content = full_text
                
        slide_content = slide_content.strip()
        active_learning_script = active_learning_script.strip()
        
        # 5. Lưu kết quả vào DB
        yield send("stage", {"stage": 3, "message": "💾 Đang lưu trữ học liệu vào cơ sở dữ liệu..."})
        
        new_db = SessionLocal()
        try:
            material = new_db.query(ChapterMaterial).filter(ChapterMaterial.chapter_id == chapter_id).first()
            if not material:
                material = ChapterMaterial(
                    chapter_id=chapter_id,
                    slide_content=slide_content,
                    active_learning_script=active_learning_script
                )
                new_db.add(material)
            else:
                material.slide_content = slide_content
                material.active_learning_script = active_learning_script
            new_db.commit()
        except Exception as e:
            new_db.rollback()
            yield send("error", {"message": f"Lỗi lưu cơ sở dữ liệu: {str(e)}"})
            return
        finally:
            new_db.close()
            
        yield send("done", {
            "message": "✅ AI đã thiết kế xong và lưu trữ bài giảng thành công!",
            "slide_content": slide_content,
            "active_learning_script": active_learning_script
        })
        
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/chapters/{chapter_id}/rag-references")
def get_chapter_rag_references(
    chapter_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lấy danh sách các đoạn trích RAG gốc phục vụ tính năng click-to-source."""
    chapter = db.query(Chapter).join(Course).filter(Chapter.id == chapter_id, Course.user_id == current_user.id).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chương học không tồn tại hoặc bạn không có quyền truy cập."
        )
    query = f"{chapter.title} {chapter.description or ''}"
    rag_hits = search_rag_isolated(query, user_id=current_user.id, course_id=chapter.course_id, top_k=6)
    return {"references": rag_hits}


@router.delete("/chapters/{chapter_id}/materials")
def delete_chapter_materials(
    chapter_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Xác thực quyền sở hữu môn học của chương học
    chapter = db.query(Chapter).join(Course).filter(Chapter.id == chapter_id, Course.user_id == current_user.id).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chương học không tồn tại hoặc bạn không có quyền truy cập."
        )

    # 2. Tìm bản ghi học liệu và xóa
    material = db.query(ChapterMaterial).filter(ChapterMaterial.chapter_id == chapter_id).first()
    if material:
        db.delete(material)
        db.commit()
    return {"message": "Đã reset/xóa học liệu chương thành công."}


class AppendSlideRequest(BaseModel):
    clo_id: int = Field(..., description="ID của CLO mục tiêu")
    bloom_level: int = Field(..., ge=1, le=6, description="Mức Bloom")


@router.post("/chapters/{chapter_id}/append-slide-for-clo")
def append_slide_for_clo(
    chapter_id: int,
    req: AppendSlideRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Xác thực chương học
    chapter = db.query(Chapter).join(Course).filter(Chapter.id == chapter_id, Course.user_id == current_user.id).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chương học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    # 2. Xác thực CLO
    clo = db.query(CLO).filter(CLO.id == req.clo_id, CLO.course_id == chapter.course_id).first()
    if not clo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CLO không tồn tại trong môn học này."
        )

    # 3. Lấy RAG context
    query = f"{clo.clo_code} {clo.description} {chapter.title}"
    rag_hits = search_rag_isolated(query, user_id=current_user.id, course_id=chapter.course_id, top_k=3)
    rag_context = ""
    if rag_hits:
        for hit in rag_hits:
            rag_context += f"[Tài liệu: {hit['file_name']} - Trang: {hit['page_number']}]: {hit['text']}\n\n"

    # 4. Gửi prompt cho LLM để tạo duy nhất 1 slide
    system_prompt = f"""Bạn là chuyên gia sư phạm thiết kế slide bài giảng. Nhiệm vụ của bạn là soạn thảo duy nhất MỘT slide bài giảng dạng Markdown để bao phủ chuẩn đầu ra [{clo.clo_code}] và mức Bloom B{req.bloom_level}.
Quy tắc định dạng Slide:
- Slide phải bắt đầu bằng '#' theo cấu trúc:
  # [Tiêu đề slide]
- Nội dung slide gồm các gạch đầu dòng ngắn gọn '*'.
- Bắt buộc phải gắn thẻ chuẩn đầu ra và mức Bloom ở dòng cuối của slide dưới dạng: `[CLO: {clo.clo_code}] [Bloom: B{req.bloom_level}]`.
- Trích dẫn nguồn tài liệu tham chiếu từ RAG dưới dạng: `[Nguồn: tên_file - Trang: số_trang]` nếu có.
- Trả về kết quả trực tiếp dưới dạng JSON chứa khoá "slide_markdown". Không bao gồm giải thích bên ngoài JSON.
  {{
    "slide_markdown": "# Tiêu đề Slide\\n* Ý chính 1...\\n* Ý chính 2...\\n[CLO: {clo.clo_code}] [Bloom: B{req.bloom_level}]"
  }}
"""
    prompt = f"""Chuẩn đầu ra cần bao phủ: [{clo.clo_code}] {clo.description}
Mức độ Bloom: B{req.bloom_level}
Ngữ cảnh chương học: {chapter.title} - {chapter.description or ''}
Tài liệu tham khảo (RAG):
{rag_context}

Hãy soạn thảo duy nhất 1 slide Markdown hoàn chỉnh."""

    try:
        res = call_llm_json(prompt, system_instruction=system_prompt, temperature=0.3)
        slide_markdown = res.get("slide_markdown", "").strip()
        if not slide_markdown:
            raise ValueError("Mô hình không trả về slide_markdown hợp lệ.")

        # 5. Lưu hoặc bổ sung vào ChapterMaterial
        material = db.query(ChapterMaterial).filter(ChapterMaterial.chapter_id == chapter_id).first()
        if not material:
            material = ChapterMaterial(
                chapter_id=chapter_id,
                slide_content=slide_markdown,
                active_learning_script=""
            )
            db.add(material)
        else:
            existing = material.slide_content or ""
            if existing.strip():
                material.slide_content = existing.strip() + "\n\n" + slide_markdown
            else:
                material.slide_content = slide_markdown
                
        db.commit()
        db.refresh(material)
        
        return {
            "message": f"Đã bổ sung thành công slide cho {clo.clo_code} - Bloom B{req.bloom_level} vào chương {chapter.title}",
            "chapter_title": chapter.title,
            "slide_content": material.slide_content
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi AI bổ sung slide: {str(e)}"
        )


@router.post("/chapters/{chapter_id}/append-slide-for-clo-stream")
def append_slide_for_clo_stream(
    chapter_id: int,
    req: AppendSlideRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Bổ sung slide bài giảng cho CLO và Bloom và stream tiến trình xử lý qua SSE.
    """
    # 1. Xác thực chương học
    chapter = db.query(Chapter).join(Course).filter(Chapter.id == chapter_id, Course.user_id == current_user.id).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chương học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    # 2. Xác thực CLO
    clo = db.query(CLO).filter(CLO.id == req.clo_id, CLO.course_id == chapter.course_id).first()
    if not clo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CLO không tồn tại trong môn học này."
        )

    # Trích xuất dữ liệu ra ngoài để tránh giữ SQLAlchemy object qua luồng generator
    course_id = chapter.course_id
    chapter_title = chapter.title
    chapter_desc = chapter.description or ""
    clo_code = clo.clo_code
    clo_desc = clo.description
    bloom_level = req.bloom_level
    user_id = current_user.id

    def event_stream():
        def send(event: str, data: dict):
            return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

        try:
            yield send("stage", {"stage": 1, "message": "🔍 Đang tìm kiếm ngữ cảnh tài liệu (RAG)..."})
            
            # 3. Lấy RAG context
            query = f"{clo_code} {clo_desc} {chapter_title}"
            rag_hits = search_rag_isolated(query, user_id=user_id, course_id=course_id, top_k=3)
            rag_context = ""
            if rag_hits:
                for hit in rag_hits:
                    rag_context += f"[Tài liệu: {hit['file_name']} - Trang: {hit['page_number']}]: {hit['text']}\n\n"

            yield send("stage", {"stage": 2, "message": "⏳ Đang gọi AI Qwen soạn slide bài giảng..."})

            system_prompt = f"""Bạn là chuyên gia sư phạm thiết kế slide bài giảng. Nhiệm vụ của bạn là soạn thảo duy nhất MỘT slide bài giảng dạng Markdown để bao phủ chuẩn đầu ra [{clo_code}] và mức Bloom B{bloom_level}.
Quy tắc định dạng Slide:
- Slide phải bắt đầu bằng '#' theo cấu trúc:
  # [Tiêu đề slide]
- Nội dung slide gồm các gạch đầu dòng ngắn gọn '*'.
- Bắt buộc phải gắn thẻ chuẩn đầu ra và mức Bloom ở dòng cuối của slide dưới dạng: `[CLO: {clo_code}] [Bloom: B{bloom_level}]`.
- Trích dẫn nguồn tài liệu tham chiếu từ RAG dưới dạng: `[Nguồn: tên_file - Trang: số_trang]` nếu có.
- Trả về kết quả trực tiếp dưới dạng JSON chứa khoá "slide_markdown". Không bao gồm giải thích bên ngoài JSON.
  {{
    "slide_markdown": "# Tiêu đề Slide\\n* Ý chính 1...\\n* Ý chính 2...\\n[CLO: {clo_code}] [Bloom: B{bloom_level}]"
  }}
"""
            prompt = f"""Chuẩn đầu ra cần bao phủ: [{clo_code}] {clo_desc}
Mức độ Bloom: B{bloom_level}
Ngữ cảnh chương học: {chapter_title} - {chapter_desc}
Tài liệu tham khảo (RAG):
{rag_context}

Hãy soạn thảo duy nhất 1 slide Markdown hoàn chỉnh."""

            res = call_llm_json(prompt, system_instruction=system_prompt, temperature=0.3)
            slide_markdown = res.get("slide_markdown", "").strip()
            if not slide_markdown:
                raise ValueError("Mô hình không trả về slide_markdown hợp lệ.")

            yield send("stage", {"stage": 3, "message": "💾 Đang lưu slide bài giảng vào cơ sở dữ liệu..."})

            new_db = SessionLocal()
            try:
                material = new_db.query(ChapterMaterial).filter(ChapterMaterial.chapter_id == chapter_id).first()
                if not material:
                    material = ChapterMaterial(
                        chapter_id=chapter_id,
                        slide_content=slide_markdown,
                        active_learning_script=""
                    )
                    new_db.add(material)
                else:
                    existing = material.slide_content or ""
                    if existing.strip():
                        material.slide_content = existing.strip() + "\n\n" + slide_markdown
                    else:
                        material.slide_content = slide_markdown
                
                new_db.commit()
                new_db.refresh(material)
            finally:
                new_db.close()

            yield send("done", {
                "message": f"✅ Đã bổ sung thành công slide cho {clo_code} - Bloom B{bloom_level}",
                "chapter_title": chapter_title
            })
        except Exception as e:
            yield send("error", {"message": f"Soạn slide thất bại: {str(e)}"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )



