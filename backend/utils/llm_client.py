import os
import json
from openai import OpenAI
from google import genai
from google.genai import types

def call_llm_json(prompt: str, system_instruction: str = None) -> dict:
    """Gọi LLM hỗ trợ định dạng JSON trả về, tương thích cả OpenAI và Gemini."""
    
    # 1. Thử gọi OpenAI GPT-4o-mini
    if os.environ.get("OPENAI_API_KEY"):
        try:
            client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            messages.append({"role": "user", "content": prompt})
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.2
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"Lỗi khi gọi OpenAI API: {e}")
            
    # 2. Thử gọi Google Gemini-1.5-Flash
    elif os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        try:
            api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
            client = genai.Client(api_key=api_key)
            
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2
            )
            if system_instruction:
                config.system_instruction = system_instruction
                
            response = client.models.generate_content(
                model='gemini-1.5-flash',
                contents=prompt,
                config=config
            )
            return json.loads(response.text)
        except Exception as e:
            print(f"Lỗi khi gọi Gemini API: {e}")
            
    # 3. Fallback: Mock Data nếu không có API keys hoặc lỗi mạng (Non-crashing strategy)
    print("[WARNING] Khong co API key hop le hoac loi ket noi. Dang su dung Mock Data tuy bien.")
    
    prompt_lower = (prompt or "").lower()
    system_lower = (system_instruction or "").lower()
    combined = prompt_lower + " " + system_lower
    
    # CASE 1: Sinh Outline Chương học
    if "outline" in combined or "chapters" in combined:
        return {
            "chapters": [
                {
                    "title": "Chuong 1: Tong quan ve Cay BST",
                    "description": "Gioi thieu cau truc cay, dinh nghia va tinh chat cua cay nhi phan tim kiem."
                },
                {
                    "title": "Chuong 2: Cac thuat toan tren Cay BST",
                    "description": "Cai dat cac thuat toan chen, xoa, tim kiem va duyet cay BST theo thu tu."
                },
                {
                    "title": "Chuong 3: Cay tu can bang AVL",
                    "description": "Nguyen ly cay tu can bang AVL, cac phep quay cay va so sanh hieu nang."
                },
                {
                    "title": "Chuong 4: Ung dung cua Cay BST trong thuc te",
                    "description": "Cac bai toan thuc te su dung cay BST va phan tich do phuc tap."
                }
            ]
        }
        
    # CASE 2: Sinh Slide & Active Learning
    elif "slide" in combined or "materials" in combined:
        return {
            "slide_content": "# Chuong 1: Tong quan ve Cay BST\n* Cay nhi phan tim kiem la cau truc cay co nhanh trai luon nho hon va nhanh phai luon lon hon nut goc.\n* Thoi gian tim kiem trung binh la O(log n).\n[Nguồn: test_dsa.pdf - Trang: 1]\n\n# Slide 2: Hieu nang cua BST\n* Truong hop xau nhat, cay co the suy bien thanh danh sach lien ket voi do phuc tap O(n).\n[Nguồn: test_dsa.pdf - Trang: 2]",
            "active_learning_script": "### Hoat dong: Think-Pair-Share (5 phut)\n- **Buoc 1:** Giang vien dua ra mot day so va bat hoc vien ve cay BST cua ho (2 phut).\n- **Buoc 2:** Trao doi cheo voi ban ben canh de so sanh ket qua (2 phut).\n- **Buoc 3:** Goi 1 cap len bang ve cay BST dung nhat (1 phut)."
        }
        
    # CASE 3: Sinh Câu hỏi trắc nghiệm (MCQ) với Self-Correction
    elif "question" in combined or "quiz" in combined or "options_json" in combined or "correct_answer" in combined:
        if "isomorphic" in combined or "dong cau" in combined or "tuong tu" in combined:
            return {
                "question_text": "Do phuc tap thoi gian tim kiem trong truong hop xau nhat tren cay BST co n phan tu la gi? (Isomorphic Mock)",
                "options_json": json.dumps(["O(n)", "O(log n)", "O(n log n)", "O(1)"]),
                "correct_answer": "O(n)"
            }
        return {
            "questions": [
                {
                    "question_text": "Do phuc tap thoi gian tim kiem trong truong hop trung binh tren cay BST co n phan tu la gi?",
                    "question_type": "MCQ",
                    "options_json": json.dumps(["O(n)", "O(log n)", "O(n log n)", "O(1)"]),
                    "correct_answer": "O(log n)",
                    "bloom_level": 2,
                    "reasoning_path": "Tren cay BST ly tuong va can bang, moi phep so sanh se loai bo mot nua so luong nut con lai. Do do chieu cao cua cay la log2(n). Thoi gian tim kiem trung binh bieu dien qua O(log n)."
                },
                {
                    "question_text": "Khi chen mot day so da sap xep tang dan vao mot cay BST rong, cay thu duoc se co hieu nang tim kiem o muc nao?",
                    "question_type": "MCQ",
                    "options_json": json.dumps(["O(log n)", "O(n)", "O(1)", "O(n log n)"]),
                    "correct_answer": "O(n)",
                    "bloom_level": 3,
                    "reasoning_path": "Neu chen mot day so da sap xep tang dan, moi phan tu moi luon luon duoc chen vao ben phai cung cua nut hien tai. BST se suy bien thanh mot danh sach lien ket lech phai. Vi the thao tac tim kiem mat thoi gian tuyen tinh O(n)."
                }
            ]
        }
        
    # CASE 4: Danh gia nguon Web Search Credibility
    elif "credibility" in combined or "score" in combined:
        return {
            "score": 0.85,
            "justification": "Nguon tu ten mien .edu uy tin cua Harvard University va bai viet co trich dan khoa hoc ro rang."
        }
        
    # DEFAULT: Mock Syllabus
    return {
        "course_code": "COMP2010",
        "course_name": "Cau truc du lieu va Giai thuat (VinUni Mock)",
        "clos": [
            {
                "clo_code": "CLO1",
                "description": "Giai thich duoc nguyen ly hoat dong va tinh chat sap xep cua cay tim kiem nhi phan (BST).",
                "bloom_level": 2
            },
            {
                "clo_code": "CLO2",
                "description": "Van dung va cai dat duoc cac giai thuat them, xoa va duyet cay nhi phan bang ngon ngu lap trinh Python.",
                "bloom_level": 3
            },
            {
                "clo_code": "CLO3",
                "description": "Phan tich va so sanh duoc hieu nang thoi gian (Time Complexity) cua cay BST thong thuong so voi cay tu can bang (AVL) trong truong hop xau nhat.",
                "bloom_level": 4
            }
        ]
    }
