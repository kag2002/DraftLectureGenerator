import sys
import os
import json
from unittest.mock import patch, MagicMock

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database.session import engine, Base, SessionLocal
from backend.database.models import User, Course, CLO, Chapter, ChapterMaterial
from backend.auth import get_password_hash
from backend.routers.materials import append_slide_for_clo_stream

def run_stream_test():
    print("[TEST] Bắt đầu chạy test cho append_slide_for_clo_stream...")
    
    # 1. Khởi tạo Database
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 2. Tạo dữ liệu giả lập
    test_email = "tester.materials.stream@vinuni.edu.vn"
    existing_user = db.query(User).filter(User.email == test_email).first()
    if existing_user:
        db.delete(existing_user)
        db.commit()
        
    hashed_pass = get_password_hash("Password123!")
    user = User(email=test_email, password_hash=hashed_pass, full_name="Tester Stream")
    db.add(user)
    db.commit()
    db.refresh(user)
    
    course = Course(user_id=user.id, course_code="TEST5010", course_name="Môn học kiểm thử Slide Stream")
    db.add(course)
    db.commit()
    db.refresh(course)
    
    clo = CLO(course_id=course.id, clo_code="CLO1", description="Phân tích luồng hoạt động", bloom_level=3)
    db.add(clo)
    db.commit()
    db.refresh(clo)
    
    chapter = Chapter(course_id=course.id, title="Chương 1: Kiểm thử Stream", sort_order=1, description="Bài học thử nghiệm")
    db.add(chapter)
    db.commit()
    db.refresh(chapter)

    # 3. Request schema mock
    class RequestMock:
        clo_id = clo.id
        bloom_level = 3

    # Mocks cho RAG và LLM
    mock_rag_return = [{"file_name": "mock.pdf", "page_number": 2, "text": "Đoạn trích RAG"}]
    mock_llm_return = {
        "slide_markdown": "# Slide AVL Test\n* Mocked AVL content\n[CLO: CLO1] [Bloom: B3]"
    }

    # 4. Patch các cuộc gọi RAG và LLM
    with patch('backend.routers.materials.search_rag_isolated', return_value=mock_rag_return), \
         patch('backend.routers.materials.call_llm_json', return_value=mock_llm_return):
        
        # Gọi API stream
        response_stream = append_slide_for_clo_stream(
            chapter_id=chapter.id,
            req=RequestMock(),
            current_user=user,
            db=db
        )
        
        # response_stream là StreamingResponse, ta có thể lặp qua body của nó
        import asyncio
        async def consume_stream(body_iterator):
            chunks = []
            async for chunk in body_iterator:
                chunks.append(chunk)
            return chunks

        events = asyncio.run(consume_stream(response_stream.body_iterator))
        for chunk in events:
            print(f"Chunk received:\n{chunk}\n")

        # 5. Phân tích kết quả stream
        events_str = "".join(events)
        assert "event: stage" in events_str
        assert "event: done" in events_str
        assert "💾 Đang lưu slide bài giảng vào cơ sở dữ liệu..." in events_str
        assert "✅ Đã bổ sung thành công slide cho CLO1 - Bloom B3" in events_str
        
        print("[SUCCESS] Nhận đủ các events stage và done từ Stream SSE!")

        # 6. Kiểm tra CSDL xem slide đã được lưu thực tế chưa
        material = db.query(ChapterMaterial).filter(ChapterMaterial.chapter_id == chapter.id).first()
        assert material is not None
        assert "Slide AVL Test" in material.slide_content
        assert "[CLO: CLO1] [Bloom: B3]" in material.slide_content
        print("[SUCCESS] Slide đã được chèn thành công vào database!")

    # 7. Dọn dẹp dữ liệu
    print("Dọn dẹp dữ liệu test...")
    db.delete(course)
    db.delete(user)
    db.commit()
    db.close()
    
    print("[SUCCESS] Toàn bộ test suite cho append_slide_for_clo_stream đã HOÀN THÀNH!")

if __name__ == "__main__":
    run_stream_test()
