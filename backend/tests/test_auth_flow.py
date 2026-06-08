import sys
import os
# Thêm backend vào path để import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database.session import engine, Base, SessionLocal
from backend.database.models import User
from backend.auth import get_password_hash, verify_password, create_access_token, jwt, SECRET_KEY, ALGORITHM

def run_test():
    print("🧪 Bắt đầu chạy test suite cho hệ thống Xác thực...")
    
    # 1. Khởi tạo Database bảng biểu
    print("1. Khởi tạo các bảng SQLite...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Clean up test user cũ nếu có
    test_email = "prof.khatkhe@vinuni.edu.vn"
    existing = db.query(User).filter(User.email == test_email).first()
    if existing:
        db.delete(existing)
        db.commit()
        print("   - Đã dọn dẹp tài khoản test cũ.")
        
    # 2. Test Hashing password
    print("2. Kiểm tra mã hóa password...")
    raw_pass = "VinUni2026!#"
    hashed = get_password_hash(raw_pass)
    assert verify_password(raw_pass, hashed) == True
    assert verify_password("wrong_pass", hashed) == False
    print("   - Mật khẩu được mã hóa bcrypt và xác thực chính xác.")

    # 3. Test Tạo User trong Database
    print("3. Thêm tài khoản Giảng viên thử nghiệm...")
    new_user = User(
        email=test_email,
        password_hash=hashed,
        full_name="GS. Nguyễn Khắt Khe"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    assert new_user.id is not None
    print(f"   - Tạo thành công User ID: {new_user.id}, Họ tên: {new_user.full_name}")

    # 4. Test JWT Token
    print("4. Tạo Access Token JWT...")
    token = create_access_token(data={"sub": new_user.email})
    assert token is not None
    print(f"   - JWT Token sinh ra: {token[:30]}...")

    # 5. Decode và verify token
    print("5. Decode JWT Token...")
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload.get("sub") == test_email
    print("   - Token được giải mã và trả về đúng email của User.")

    # Dọn dẹp
    db.delete(new_user)
    db.commit()
    db.close()
    print("🎉 KHÁNH THÀNH: Tất cả các bài kiểm tra hệ thống Xác thực đều THÀNH CÔNG!")

if __name__ == "__main__":
    run_test()
