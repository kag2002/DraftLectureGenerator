from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from backend.database.session import get_db
from backend.database.models import Course, CLO, Chapter, User
from backend.auth import get_current_user
from backend.utils.llm_client import call_llm_json

router = APIRouter(prefix="/api/courses", tags=["outline"])

# Pydantic schemas
class ChapterCreate(BaseModel):
    title: str = Field(..., example="Chương 1: Tổng quan về Cây BST")
    description: str = Field(..., example="Giới thiệu cấu trúc cây, định nghĩa và tính chất của cây nhị phân tìm kiếm.")
    sort_order: int = Field(..., example=1)

class ChapterResponse(BaseModel):
    id: int
    course_id: int
    sort_order: int
    title: str
    description: str | None
    
    class Config:
        from_attributes = True

# --- API CHAPTERS (OUTLINE) ---

@router.get("/{course_id}/chapters", response_model=list[ChapterResponse])
def get_course_chapters(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Xác thực quyền sở hữu môn học
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
    chapters = db.query(Chapter).filter(Chapter.course_id == course_id).order_by(Chapter.sort_order).all()
    return chapters

@router.post("/{course_id}/chapters", response_model=ChapterResponse)
def create_chapter(course_id: int, chapter_data: ChapterCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
    new_chapter = Chapter(
        course_id=course_id,
        sort_order=chapter_data.sort_order,
        title=chapter_data.title,
        description=chapter_data.description
    )
    db.add(new_chapter)
    db.commit()
    db.refresh(new_chapter)
    return new_chapter

@router.put("/chapters/{chapter_id}", response_model=ChapterResponse)
def update_chapter(chapter_id: int, chapter_data: ChapterCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chapter = db.query(Chapter).join(Course).filter(Chapter.id == chapter_id, Course.user_id == current_user.id).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chương học không tồn tại hoặc bạn không có quyền chỉnh sửa."
        )
    
    chapter.title = chapter_data.title
    chapter.description = chapter_data.description
    chapter.sort_order = chapter_data.sort_order
    
    db.commit()
    db.refresh(chapter)
    return chapter

@router.delete("/chapters/{chapter_id}")
def delete_chapter(chapter_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chapter = db.query(Chapter).join(Course).filter(Chapter.id == chapter_id, Course.user_id == current_user.id).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chương học không tồn tại hoặc bạn không có quyền chỉnh sửa."
        )
    db.delete(chapter)
    db.commit()
    return {"message": "Đã xóa chương học thành công."}

# --- API AI GENERATE SKELETAL OUTLINE ---

@router.post("/{course_id}/generate-outline")
def generate_skeletal_outline(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Kiểm tra quyền sở hữu môn học
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    # 2. Lấy danh sách các CLO hiện có của môn học
    clos = db.query(CLO).filter(CLO.course_id == course_id).all()
    if not clos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Môn học chưa cấu hình CLO. Vui lòng nạp Syllabus trước."
        )
        
    # 3. Định dạng danh sách CLO gửi cho LLM
    clos_text = "\n".join([
        f"- [{c.clo_code}] {c.description} (Thang Bloom: {c.bloom_level})"
        for c in clos
    ])
    
    # 4. Gọi LLM sinh Outline dạng JSON
    system_prompt = """Bạn là chuyên gia sư phạm đại học. Thiết kế đề cương học tập (Lesson Outline).
Nhiệm vụ: Dựa vào các Chuẩn đầu ra (CLOs) môn học được cung cấp, hãy thiết kế một cấu trúc chương học logic (từ 5 đến 7 chương).
Đảm bảo:
- Nội dung đi từ cơ bản đến nâng cao.
- Phân bổ đều để phủ toàn bộ các CLOs đã cho.
- Mỗi chương gồm Tên chương (title) và Mô tả ngắn gọn (description) các chủ đề giảng dạy chính.

Đầu ra định dạng JSON:
{
  "chapters": [
    {
      "title": "Chương 1: Tên chương",
      "description": "Mô tả ngắn gọn nội dung chương..."
    }
  ]
}
"""
    prompt = f"Môn học: {course.course_name}\nChuẩn đầu ra môn học (CLOs):\n{clos_text}\n\nHãy sinh cấu trúc chương học phù hợp."
    
    try:
        outline_json = call_llm_json(prompt, system_instruction=system_prompt)
        
        # 5. Xóa outline cũ để ghi đè mới
        db.query(Chapter).filter(Chapter.course_id == course_id).delete()
        
        # 6. Lưu các chương học mới vào database
        created_chapters = []
        for idx, ch in enumerate(outline_json.get("chapters", [])):
            new_chapter = Chapter(
                course_id=course_id,
                sort_order=idx + 1,
                title=ch.get("title", f"Chương {idx+1}"),
                description=ch.get("description", "")
            )
            db.add(new_chapter)
            created_chapters.append(new_chapter)
            
        db.commit()
        
        return {
            "message": "Sinh cấu trúc chương học thành công.",
            "chapters": [
                {
                    "id": c.id,
                    "sort_order": c.sort_order,
                    "title": c.title,
                    "description": c.description
                }
                for c in created_chapters
            ]
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi AI sinh dàn ý: {str(e)}"
        )
