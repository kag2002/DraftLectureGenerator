import sys
import os
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database.session import engine, Base, SessionLocal
from backend.database.models import User, Course, CLO, Chapter, ChapterMaterial, Question
from backend.auth import get_password_hash
from backend.routers.questions import get_matrix_coverage

def run_test():
    print("[TEST] Bat dau chay test suite cho /matrix-coverage Slide parsing...")
    
    # 1. Khoi tao Database
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 2. Tao du lieu Giang vien & Mon hoc gia lap
    test_email = "tester.matrix@vinuni.edu.vn"
    existing_user = db.query(User).filter(User.email == test_email).first()
    if existing_user:
        db.delete(existing_user)
        db.commit()
        
    hashed_pass = get_password_hash("Password123!")
    user = User(email=test_email, password_hash=hashed_pass, full_name="Tester Matrix")
    db.add(user)
    db.commit()
    db.refresh(user)
    
    course = Course(user_id=user.id, course_code="TEST4010", course_name="Mon hoc kiem thu Matrix")
    db.add(course)
    db.commit()
    db.refresh(course)
    
    clo1 = CLO(course_id=course.id, clo_code="CLO1", description="Phan tich thuat toan AVL", bloom_level=3)
    clo2 = CLO(course_id=course.id, clo_code="CLO2", description="Bieu dien do thi", bloom_level=4)
    db.add(clo1)
    db.add(clo2)
    db.commit()
    db.refresh(clo1)
    db.refresh(clo2)
    
    chapter1 = Chapter(course_id=course.id, title="Chuong 1: AVL", sort_order=1, description="Giang day AVL")
    chapter2 = Chapter(course_id=course.id, title="Chuong 2: Do thi", sort_order=2, description="Giang day Do thi")
    db.add(chapter1)
    db.add(chapter2)
    db.commit()
    db.refresh(chapter1)
    db.refresh(chapter2)

    # 3. Tao hoc lieu slide voi CLO/Bloom tags
    slide_content_1 = """# Slide 1: AVL Tree Intro
* AVL tree is self-balancing BST.
[CLO: CLO1] [Bloom: 3]

# Slide 2: AVL Rotations
* Left and Right rotations.
[CLO: CLO1] [Bloom: 3]
"""
    material1 = ChapterMaterial(chapter_id=chapter1.id, slide_content=slide_content_1, active_learning_script="")
    
    slide_content_2 = """# Slide 1: Graph Representation
* Adjacency Matrix and List.
[CLO: CLO2] [Bloom: 4]
"""
    material2 = ChapterMaterial(chapter_id=chapter2.id, slide_content=slide_content_2, active_learning_script="")
    
    db.add(material1)
    db.add(material2)
    db.commit()

    # 4. Goi truc tiep API get_matrix_coverage
    res_matrix = get_matrix_coverage(
        course_id=course.id,
        current_user=user,
        db=db
    )
    
    # 5. Kiem tra ket qua
    assert "matrix" in res_matrix
    matrix = res_matrix["matrix"]
    
    print("Ket qua ma tran bao phu tu slide:")
    print(json.dumps(matrix, indent=2, ensure_ascii=False))
    
    assert "CLO1" in matrix
    assert "CLO2" in matrix
    
    # CLO1 phai co 2 slide o Bloom level 3
    assert matrix["CLO1"]["material_levels"]["3"] == 2
    # CLO2 phai co 1 slide o Bloom level 4
    assert matrix["CLO2"]["material_levels"]["4"] == 1
    
    print("   - Kiem tra: CLO1 material_levels Muc 3 = 2 (PASSED)")
    print("   - Kiem tra: CLO2 material_levels Muc 4 = 1 (PASSED)")

    # 6. Don dep du lieu
    print("Don dep du lieu test...")
    db.delete(course)
    db.delete(user)
    db.commit()
    db.close()
    
    print("[SUCCESS] Unit test cho /matrix-coverage slide parsing da thanh cong!")

if __name__ == "__main__":
    run_test()
