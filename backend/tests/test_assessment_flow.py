import sys
import os
import json
# Thêm backend vào path để import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database.session import engine, Base, SessionLocal
from backend.database.models import User, Course, CLO, Chapter, Question
from backend.auth import get_password_hash
from backend.routers.questions import generate_questions, generate_isomorphic_question, get_matrix_coverage, QuestionGenerateRequest

def run_test():
    print("[TEST] Bat dau chay test suite cho he thong Assessment (Sinh Cau hoi & Matrix)...")
    
    # 1. Khoi tao Database
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 2. Tao du lieu Giang vien & Mon hoc gia lap
    print("1. Tao tai khoan va mon hoc gia lap...")
    test_email = "tester.assessment@vinuni.edu.vn"
    existing_user = db.query(User).filter(User.email == test_email).first()
    if existing_user:
        db.delete(existing_user)
        db.commit()
        
    hashed_pass = get_password_hash("Password123!")
    user = User(email=test_email, password_hash=hashed_pass, full_name="Tester Assessment")
    db.add(user)
    db.commit()
    db.refresh(user)
    
    course = Course(user_id=user.id, course_code="TEST3010", course_name="Mon hoc kiem thu Assessment")
    db.add(course)
    db.commit()
    db.refresh(course)
    
    clo1 = CLO(course_id=course.id, clo_code="CLO1", description="Van dung thuat toan AVL vao bai toan", bloom_level=3)
    clo2 = CLO(course_id=course.id, clo_code="CLO2", description="Phan tich cay do phuc tap do cao", bloom_level=4)
    db.add(clo1)
    db.add(clo2)
    db.commit()
    db.refresh(clo1)
    db.refresh(clo2)
    
    chapter = Chapter(course_id=course.id, title="Chuong 1: Cay tim kiem nhi phan", sort_order=1, description="Giang day BST va AVL")
    db.add(chapter)
    db.commit()
    db.refresh(chapter)

    # 3. Kiem thu API sinh cau hoi MCQ voi Self-Correction (mock mode)
    print("2. Chay thu nghiem AI MCQ Generation voi Self-Correction...")
    req_data = QuestionGenerateRequest(
        clo_id=clo1.id,
        chapter_id=chapter.id,
        bloom_level=3,
        count=2
    )
    
    # Goi truc tiep endpoint function nhu mot service thong thuong
    res = generate_questions(
        course_id=course.id,
        req=req_data,
        current_user=user,
        db=db
    )
    
    assert "questions" in res
    assert len(res["questions"]) == 2
    for q in res["questions"]:
        assert 1 <= q["bloom_level"] <= 6
        assert q["clo_id"] == clo1.id
        assert q["correct_answer"] != ""
        print(f"   - Sinh thanh cong: {q['question_text'][:50]}... | Dap an: {q['correct_answer']}")
        
    # Lay ID cau hoi de test isomorphic
    q_id = res["questions"][0]["id"]

    # 4. Kiem thu sinh cau hoi isomorphic (dong cau)
    print("3. Chay thu nghiem sinh cau hoi tuong tu (Isomorphic)...")
    res_iso = generate_isomorphic_question(
        question_id=q_id,
        current_user=user,
        db=db
    )
    
    assert "question" in res_iso
    iso_q = res_iso["question"]
    assert 1 <= iso_q["bloom_level"] <= 6
    assert iso_q["clo_id"] == clo1.id
    assert iso_q["question_text"] != ""
    print(f"   - Sinh isomorphic: {iso_q['question_text'][:50]}...")

    # 5. Kiem thu lay ma tran bao phu CLO-Bloom
    print("4. Kiem tra tinh toan ma tran do bao phu CLO-Bloom...")
    res_matrix = get_matrix_coverage(
        course_id=course.id,
        current_user=user,
        db=db
    )
    
    assert "matrix" in res_matrix
    matrix = res_matrix["matrix"]
    assert "CLO1" in matrix
    assert "CLO2" in matrix
    # CLO1 phai co 3 cau hoi tong cong (2 cau goc + 1 cau isomorphic)
    total_q_clo1 = sum(matrix["CLO1"]["levels"].values())
    assert total_q_clo1 == 3
    assert matrix["CLO1"]["levels"]["4"] == 0
    print(f"   - Ma tran bao phu chinh xac: CLO1 tong cong co {total_q_clo1} cau hoi.")

    # 6. Don dep du lieu
    print("5. Don dep tai khoan va mon hoc test...")
    db.delete(course) # Cascaded delete se tu dong xoa clos, chapters, questions
    db.delete(user)
    db.commit()
    db.close()
    
    print("[SUCCESS] Tat ca cac bai kiem tra Assessment deu HOAN THANH!")

if __name__ == "__main__":
    run_test()
