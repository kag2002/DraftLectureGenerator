import sys
import os
# Thêm backend vào path để import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.utils.parser import parse_document
from backend.services.syllabus_analyser import analyse_syllabus

def run_test():
    print("🧪 Bắt đầu chạy test suite cho hệ thống Phân tích Syllabus...")
    
    sample_file = os.path.abspath(os.path.join(os.path.dirname(__file__), 'data/sample_syllabus.txt'))
    
    # 1. Test trích xuất văn bản thô
    print("1. Kiểm tra trích xuất văn bản từ file...")
    text_content = parse_document(sample_file)
    assert "COMP2010" in text_content
    assert "Course Learning Outcomes" in text_content
    print("   - Trích xuất văn bản thô thành công.")

    # 2. Test LLM bóc tách CLOs (Gọi qua mock-fallback nếu không có API keys)
    print("2. Chạy thử nghiệm bóc tách cấu trúc CLO qua LLM/Mock...")
    result = analyse_syllabus(text_content)
    
    # Kiểm tra cấu trúc trả về
    assert "course_code" in result
    assert "course_name" in result
    assert "clos" in result
    assert len(result["clos"]) > 0
    print(f"   - Bóc tách thành công Môn học: {result['course_code']} - {result['course_name']}")
    
    # Kiểm tra mức Bloom đã chuẩn hóa
    print("3. Kiểm tra việc ánh xạ mức Bloom nhận thức...")
    for idx, clo in enumerate(result["clos"]):
        print(f"   * CLO Code: {clo['clo_code']}, Mô tả: {clo['description']}, Bloom Level: {clo['bloom_level']}")
        assert "clo_code" in clo
        assert "description" in clo
        assert 1 <= clo["bloom_level"] <= 6
        
    print("🎉 KHÁNH THÀNH: Tất cả các bài kiểm tra phân tích Syllabus đều THÀNH CÔNG!")

if __name__ == "__main__":
    run_test()
