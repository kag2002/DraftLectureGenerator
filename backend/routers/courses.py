from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from backend.database.session import get_db
from backend.database.models import Course, CLO, User
from backend.auth import get_current_user
import shutil
import os

router = APIRouter(prefix="/api/courses", tags=["courses"])

# Pydantic schemas
class CourseCreate(BaseModel):
    course_code: str = Field(..., example="COMP2010")
    course_name: str = Field(..., example="Cấu trúc dữ liệu và Giải thuật")

class CourseResponse(BaseModel):
    id: int
    course_code: str
    course_name: str
    
    class Config:
        from_attributes = True

class CLOCreate(BaseModel):
    clo_code: str = Field(..., example="CLO1")
    description: str = Field(..., example="Giải thích được cơ chế hoạt động của cây BST.")
    bloom_level: int = Field(..., ge=1, le=6, example=2)

class CLOResponse(BaseModel):
    id: int
    course_id: int
    clo_code: str
    description: str
    bloom_level: int
    
    class Config:
        from_attributes = True

# --- API MÔN HỌC (COURSES) ---

@router.get("", response_model=list[CourseResponse])
def get_courses(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Lấy các môn học thuộc về duy nhất giảng viên hiện tại (Isolation)
    courses = db.query(Course).filter(Course.user_id == current_user.id).all()
    return courses

@router.post("", response_model=CourseResponse)
def create_course(course_data: CourseCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_course = Course(
        user_id=current_user.id,
        course_code=course_data.course_code,
        course_name=course_data.course_name
    )
    db.add(new_course)
    db.commit()
    db.refresh(new_course)
    return new_course

@router.get("/{course_id}", response_model=CourseResponse)
def get_course_detail(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
    return course

@router.delete("/{course_id}")
def delete_course(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
    db.delete(course)
    db.commit()
    return {"message": "Đã xóa môn học thành công."}

# --- API CHUẨN ĐẦU RA (CLOs) ---

@router.get("/{course_id}/clos", response_model=list[CLOResponse])
def get_course_clos(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Kiểm tra quyền sở hữu môn học trước
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
    clos = db.query(CLO).filter(CLO.course_id == course_id).all()
    return clos

@router.post("/{course_id}/clos", response_model=CLOResponse)
def create_course_clo(course_id: int, clo_data: CLOCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Kiểm tra quyền sở hữu môn học trước
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
    new_clo = CLO(
        course_id=course_id,
        clo_code=clo_data.clo_code,
        description=clo_data.description,
        bloom_level=clo_data.bloom_level
    )
    db.add(new_clo)
    db.commit()
    db.refresh(new_clo)
    return new_clo

@router.put("/clos/{clo_id}", response_model=CLOResponse)
def update_clo(clo_id: int, clo_data: CLOCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Kiểm tra xem CLO có tồn tại và thuộc môn học của User hiện tại không
    clo = db.query(CLO).join(Course).filter(CLO.id == clo_id, Course.user_id == current_user.id).first()
    if not clo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chuẩn đầu ra không tồn tại hoặc bạn không có quyền chỉnh sửa."
        )
    
    clo.clo_code = clo_data.clo_code
    clo.description = clo_data.description
    clo.bloom_level = clo_data.bloom_level
    
    db.commit()
    db.refresh(clo)
    return clo

@router.delete("/clos/{clo_id}")
def delete_clo(clo_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Kiểm tra xem CLO có tồn tại và thuộc môn học của User hiện tại không
    clo = db.query(CLO).join(Course).filter(CLO.id == clo_id, Course.user_id == current_user.id).first()
    if not clo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chuẩn đầu ra không tồn tại hoặc bạn không có quyền chỉnh sửa."
        )
    
    db.delete(clo)
    db.commit()
    return {"message": "Đã xóa chuẩn đầu ra thành công."}

@router.post("/{course_id}/parse-syllabus")
def upload_and_parse_syllabus(
    course_id: int, 
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 1. Kiểm tra quyền sở hữu môn học
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    # 2. Tạo thư mục tạm lưu file
    temp_dir = "./temp"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = os.path.join(temp_dir, file.filename)
    
    try:
        # Lưu file tạm xuống đĩa
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 3. Trích xuất text từ file đề cương
        from backend.utils.parser import parse_document
        from backend.services.syllabus_analyser import analyse_syllabus
        
        text_content = parse_document(temp_file_path)
        if not text_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể đọc nội dung từ file đề cương tải lên."
            )
            
        # 4. LLM bóc tách thông tin cấu trúc & CLOs
        analysis_result = analyse_syllabus(text_content)
        
        # 5. Cập nhật thông tin mã/tên môn học nếu được trả về
        if "course_code" in analysis_result and analysis_result["course_code"]:
            course.course_code = analysis_result["course_code"]
        if "course_name" in analysis_result and analysis_result["course_name"]:
            course.course_name = analysis_result["course_name"]
            
        # Xóa các CLOs cũ của môn này để tránh trùng lặp ghi đè
        db.query(CLO).filter(CLO.course_id == course_id).delete()
        
        # Thêm các CLOs mới đã bóc tách
        created_clos = []
        for clo_item in analysis_result.get("clos", []):
            new_clo = CLO(
                course_id=course_id,
                clo_code=clo_item.get("clo_code", "CLO"),
                description=clo_item.get("description", ""),
                bloom_level=clo_item.get("bloom_level", 2)
            )
            db.add(new_clo)
            created_clos.append(new_clo)
            
        db.commit()
        
        # Trả về kết quả JSON đã nạp
        return {
            "message": "Phân tích Syllabus thành công.",
            "course": {
                "id": course.id,
                "course_code": course.course_code,
                "course_name": course.course_name
            },
            "clos": [
                {
                    "id": c.id,
                    "clo_code": c.clo_code,
                    "description": c.description,
                    "bloom_level": c.bloom_level
                }
                for c in created_clos
            ]
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi hệ thống khi phân tích Syllabus: {str(e)}"
        )
    finally:
        # Xóa file tạm sau khi hoàn tất
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass
