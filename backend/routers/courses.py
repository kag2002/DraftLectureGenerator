from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from backend.database.session import get_db
from backend.database.models import Course, CLO, User
from backend.auth import get_current_user

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
