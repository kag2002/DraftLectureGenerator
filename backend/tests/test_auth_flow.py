import sys
import os
# Thêm backend vào path để import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database.session import engine, Base, SessionLocal
from backend.database.models import User
from backend.auth import get_password_hash, verify_password, create_access_token, jwt, SECRET_KEY, ALGORITHM

def run_test():
    print("[TEST] Bat dau chay test suite cho he thong Xac thuc...")
    
    # 1. Khởi tạo Database bảng biểu
    print("1. Khoi tao cac bang SQLite...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Clean up test user cũ nếu có
    test_email = "prof.khatkhe@vinuni.edu.vn"
    existing = db.query(User).filter(User.email == test_email).first()
    if existing:
        db.delete(existing)
        db.commit()
        print("   - Da don dep tai khoan test cu.")
        
    # 2. Test Hashing password
    print("2. Kiem tra ma hoa password...")
    raw_pass = "VinUni2026!#"
    hashed = get_password_hash(raw_pass)
    assert verify_password(raw_pass, hashed) == True
    assert verify_password("wrong_pass", hashed) == False
    print("   - Mat khau duoc ma hoa bcrypt va xac thuc chinh xac.")

    # 3. Test Tạo User trong Database
    print("3. Them tai khoan Giang vien thu nghiem...")
    new_user = User(
        email=test_email,
        password_hash=hashed,
        full_name="GS. Nguyen Khat Khe"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    assert new_user.id is not None
    print(f"   - Tao thanh cong User ID: {new_user.id}, Ho ten: {new_user.full_name}")

    # 4. Test JWT Token
    print("4. Tao Access Token JWT...")
    token = create_access_token(data={"sub": new_user.email})
    assert token is not None
    print(f"   - JWT Token sinh ra: {token[:30]}...")

    # 5. Decode và verify token
    print("5. Decode JWT Token...")
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload.get("sub") == test_email
    print("   - Token duoc giai ma va tra ve dung email cua User.")

    # Dọn dẹp
    db.delete(new_user)
    db.commit()
    db.close()
    print("[SUCCESS] Tat ca cac bai kiem tra he thong Xac thuc deu THANH CONG!")

if __name__ == "__main__":
    run_test()
