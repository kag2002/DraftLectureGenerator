import sys
import os
# Thêm backend vào path để import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database.vector_db import add_document_vector, search_rag_isolated, collection

def run_test():
    print("[TEST] Bat dau chay test suite cho RAG Multi-tenancy (Co lap du lieu)...")
    
    # Dọn dẹp dữ liệu test cũ nếu có
    try:
        collection.delete(ids=[
            "usr_99_crs_901_file_test_dsa_c0",
            "usr_99_crs_901_file_test_dsa_c1",
            "usr_88_crs_802_file_test_oop_c0"
        ])
    except Exception:
        pass

    # Giả lập Tài liệu Môn 1 (DSA - User 99, Course 901)
    dsa_pages = [
        "Trang mot: Cay tim kiem nhi phan BST sap thu tu nhanh trai nho hon goc va nhanh phai lon hon goc.",
        "Trang hai: Thoi gian tim kiem trung binh cua cay BST la O(log n) nhung co the suy bien thanh O(n) neu lech."
    ]
    
    # Giả lập Tài liệu Môn 2 (OOP - User 88, Course 802)
    oop_pages = [
        "Trang mot: Lap trinh huong doi tuong gom bon tinh chat: Dong goi, Ke thua, Da hinh, va Truu tuong."
    ]

    # 1. Nạp tài liệu môn 1
    print("1. Nap tai lieu mon DSA (User 99, Course 901)...")
    add_document_vector("test_dsa.pdf", dsa_pages, user_id=99, course_id=901)
    
    # 2. Nạp tài liệu môn 2
    print("2. Nap tai lieu mon OOP (User 88, Course 802)...")
    add_document_vector("test_oop.pdf", oop_pages, user_id=88, course_id=802)

    # 3. Test query cô lập môn 1
    print("3. Kiem tra truy van co lap mon DSA...")
    dsa_query = search_rag_isolated("cai BST nhi phan", user_id=99, course_id=901, top_k=2)
    assert len(dsa_query) > 0
    for hit in dsa_query:
        assert hit["file_name"] == "test_dsa.pdf"
        assert hit["page_number"] in [1, 2]
        print(f"   - Tim thay: [Trang {hit['page_number']}] {hit['text'][:40]}... (Score: {hit['score']:.4f})")

    # 4. Kiểm tra xem truy vấn DSA có làm rò rỉ sang môn OOP không
    print("4. Kiem tra bao mat (DSA query khong duoc tra ve OOP)...")
    oop_leak_query = search_rag_isolated("huong doi tuong bon tinh chat", user_id=99, course_id=901, top_k=2)
    # Lấy tài liệu của User 99, Course 901 nhưng gõ từ khóa của OOP
    for hit in oop_leak_query:
        assert hit["file_name"] != "test_oop.pdf" # Phải không được bốc trích tài liệu oop
    print("   - Bao mat RAG thanh cong: Khong ro ri tai lieu cheo.")

    # 5. Dọn dẹp dữ liệu test
    print("5. Don dep du lieu vector test...")
    try:
        collection.delete(
            where={
                "$and": [
                    {"user_id": {"$eq": 99}},
                    {"course_id": {"$eq": 901}}
                ]
            }
        )
        collection.delete(
            where={
                "$and": [
                    {"user_id": {"$eq": 88}},
                    {"course_id": {"$eq": 802}}
                ]
            }
        )
    except Exception:
        pass
        
    print("[SUCCESS] Kiem thu co lap RAG Multi-tenancy hoan thanh THANH CONG!")

if __name__ == "__main__":
    run_test()
