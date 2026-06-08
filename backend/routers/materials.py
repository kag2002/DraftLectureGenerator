from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from backend.database.session import get_db
from backend.database.models import Chapter, ChapterMaterial, User, Course
from backend.auth import get_current_user
from backend.database.vector_db import search_rag_isolated
from backend.utils.llm_client import call_llm_json

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
        
    # 4. Gửi Prompt sinh bài giảng cho LLM
    system_prompt = f"""Bạn là trợ lý thiết kế bài giảng AI chuyên nghiệp.
Nhiệm vụ: Hãy sinh nội dung slide bài giảng (Markdown) và kịch bản tương tác (Active Learning) cho chương học sau.

Yêu cầu về Slide bài giảng:
- Viết dưới dạng Markdown thô sạch sẽ.
- Mỗi slide bắt đầu bằng tiêu đề '#' và chứa từ 3-4 gạch đầu dòng giải thích.
- BẮT BUỘC TRÍCH DẪN: Nếu thông tin được lấy từ tài liệu tham khảo, ghi rõ '[Nguồn: Tên_file - Trang: Số_trang]' cuối slide dựa vào thông số trong Context. Không bịa đặt nguồn trang.

Yêu cầu về Kịch bản tương tác (Active Learning):
- Sinh một kịch bản hoạt động ngắn từ 5-10 phút xen kẽ bài giảng.
- RÀNG BUỘC THỰC TẾ: Lớp học có sĩ số là {req.class_size} học sinh, mạng Wifi: {'Có khả dụng' if req.has_wifi else 'Không khả dụng'}, bàn ghế phòng học là dạng '{'di động' if req.furniture_type == 'movable' else 'cố định'}'. Bạn phải điều chỉnh kịch bản phù hợp (ví dụ sĩ số đông, bàn ghế cố định thì chia nhóm nhỏ tại chỗ, không bắt di chuyển bàn ghế).

Đầu ra định dạng JSON:
{{
  "slide_content": "# Slide 1: Tiêu đề\\n* Ý chính 1...\\n* Ý chính 2...\\n[Nguồn: file_name - Trang: page_number]",
  "active_learning_script": "### Hoạt động: Think-Pair-Share\\n- Cách thực hiện: ...\\n- Thời lượng: 5 phút..."
}}
"""
    prompt = f"Chương học cần soạn: {chapter.title}\nMô tả chương: {chapter.description or 'N/A'}\n\nNgữ cảnh tài liệu nguồn (RAG Context):\n{rag_context if rag_context else 'Không có tài liệu nguồn tham chiếu. Hãy sử dụng tri thức phổ thông.'}"
    
    try:
        materials_json = call_llm_json(prompt, system_instruction=system_prompt)
        
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
