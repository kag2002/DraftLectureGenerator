import sys
import os

# Ép kiểu mã hóa console sang UTF-8 để không bị crash khi ghi log tiếng Việt trên Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Thêm backend vào path để import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.utils.parser import parse_document
from backend.services.syllabus_analyser import analyse_syllabus

def run_test():
    print("[TEST] Bat dau chay test suite cho he thong Phan tich Syllabus...")
    
    sample_file = os.path.abspath(os.path.join(os.path.dirname(__file__), 'data/sample_syllabus.txt'))
    
    # 1. Test trích xuất văn bản thô
    print("1. Kiem tra trich xuat van ban tu file...")
    text_content = parse_document(sample_file)
    assert "COMP2010" in text_content
    assert "Course Learning Outcomes" in text_content
    print("   - Trich xuat van ban tho thanh cong.")
 
    # 2. Test LLM bóc tách CLOs (Gọi qua mock-fallback nếu không có API keys)
    print("2. Chay thu nghiem boc tach cau truc CLO qua LLM/Mock...")
    result = analyse_syllabus(text_content)
    
    # Kiểm tra cấu trúc trả về
    assert "course_code" in result
    assert "course_name" in result
    assert "clos" in result
    assert len(result["clos"]) > 0
    print(f"   - Boc tach thanh cong Mon hoc: {result['course_code']} - {result['course_name']}")
    
    # Kiểm tra mức Bloom đã chuẩn hóa
    print("3. Kiem tra viec anh xa muc Bloom nhan thuc...")
    for idx, clo in enumerate(result["clos"]):
        print(f"   * CLO Code: {clo['clo_code']}, Mo ta: {clo['description']}, Bloom Level: {clo['bloom_level']}")
        assert "clo_code" in clo
        assert "description" in clo
        assert 1 <= clo["bloom_level"] <= 6
        
    print("[SUCCESS] Tat ca cac bai kiem tra phan tich Syllabus deu THANH CONG!")

if __name__ == "__main__":
    run_test()
