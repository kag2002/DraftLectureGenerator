import sys
import os
# Thêm backend vào path để import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database.session import engine, Base, SessionLocal
from backend.database.models import User, Course
from backend.auth import get_password_hash
from backend.database.vector_db import delete_course_documents
from backend.services.web_search_agent import web_search_and_ingest, evaluate_source_credibility, WebSearchRequest

def run_test():
    print("[TEST] Bat dau chay test suite cho he thong Web Search & Credibility Agent...")
    
    # 1. Khoi tao Database
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 2. Tao du lieu Giang vien & Mon hoc gia lap
    print("1. Tao tai khoan va mon hoc gia lap...")
    test_email = "tester.websearch@vinuni.edu.vn"
    existing_user = db.query(User).filter(User.email == test_email).first()
    if existing_user:
        db.delete(existing_user)
        db.commit()
        
    hashed_pass = get_password_hash("Password123!")
    user = User(email=test_email, password_hash=hashed_pass, full_name="Tester Web Search")
    db.add(user)
    db.commit()
    db.refresh(user)
    
    course = Course(user_id=user.id, course_code="TEST4010", course_name="Mon hoc kiem thu Web Search")
    db.add(course)
    db.commit()
    db.refresh(course)

    # 3. Kiem thu bo cham diem uy tin nguon hoc thuat (Credibility Evaluator)
    print("2. Chay thu nghiem Credibility Evaluator cham diem tung nguon...")
    # Nguon uy tin
    res_mit = evaluate_source_credibility(
        title="Lecture Notes on AVL Trees - MIT CSAIL",
        url="https://ocw.mit.edu/courses/electrical-engineering/6-006-fall-2011/avl-trees.pdf",
        content="MIT Lecture Notes: AVL trees maintain balancing by executing rotation algorithms. doi:10.1016/j.datade.2025.1012"
    )
    print(f"   - MIT Score: {res_mit['score']} | Ly do: {res_mit['justification']}")
    assert res_mit["score"] >= 0.7
    
    # Nguon rác/blog ca nhan
    res_blog = evaluate_source_credibility(
        title="Cơ sở dữ liệu AVL - Blog Học thuật cá nhân",
        url="http://myblogca-nhan.blogspot.com/cay-avl",
        content="Chào các bạn, hôm nay mình chia sẻ về cây AVL. Cây AVL là cây nhị phân tự cân bằng rất hay."
    )
    print(f"   - Blog Score: {res_blog['score']} | Ly do: {res_blog['justification']}")
    assert res_blog["score"] < 0.7

    # 4. Kiem thu API sinh Web Search va tu dong nap RAG
    print("3. Chay thu nghiem Web Search Ingestion (Mock mode)...")
    req = WebSearchRequest(query="Cay nhi phan AVL tu can bang")
    
    # Temporarily remove TAVILY_API_KEY to force Mock Search mode for deterministic testing of mock URLs
    tavily_key = os.environ.get("TAVILY_API_KEY")
    if "TAVILY_API_KEY" in os.environ:
        del os.environ["TAVILY_API_KEY"]
        
    try:
        res_ingest = web_search_and_ingest(
            course_id=course.id,
            req=req,
            current_user=user,
            db=db
        )
    finally:
        if tavily_key is not None:
            os.environ["TAVILY_API_KEY"] = tavily_key
    
    assert "ingested" in res_ingest
    assert "rejected" in res_ingest
    
    print(f"   - Da nap thanh cong: {len(res_ingest['ingested'])} nguon hoc thuat.")
    print(f"   - Tu choi kem tin cay: {len(res_ingest['rejected'])} nguon.")
    
    # Kiem tra xem nguon MIT hay GeeksforGeeks co thuoc danh sach ingested khong
    assert any("mit.edu" in s["url"] or "geeksforgeeks.org" in s["url"] for s in res_ingest["ingested"])
    # Kiem tra xem nguon Blog co thuoc rejected khong
    assert any("blogspot.com" in s["url"] for s in res_ingest["rejected"])

    # 5. Don dep du lieu Vector va DB
    print("4. Don dep tai nguyen vector RAG va DB...")
    delete_course_documents(user_id=user.id, course_id=course.id)
    db.delete(course)
    db.delete(user)
    db.commit()
    db.close()
    
    print("[SUCCESS] Tat ca cac bai kiem tra Web Search Flow deu HOAN THANH!")

if __name__ == "__main__":
    run_test()
