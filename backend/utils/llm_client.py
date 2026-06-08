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
    print("⚠️ Cảnh báo: Không có API key hợp lệ hoặc lỗi kết nối. Đang sử dụng Mock Syllabus Data.")
    return {
        "course_code": "COMP2010",
        "course_name": "Cấu trúc dữ liệu và Giải thuật (VinUni Mock)",
        "clos": [
            {
                "clo_code": "CLO1",
                "description": "Giải thích được nguyên lý hoạt động và tính chất sắp xếp của cây tìm kiếm nhị phân (BST).",
                "bloom_level": 2
            },
            {
                "clo_code": "CLO2",
                "description": "Vận dụng và cài đặt được các giải thuật thêm, xóa và duyệt cây nhị phân bằng ngôn ngữ lập trình Python.",
                "bloom_level": 3
            },
            {
                "clo_code": "CLO3",
                "description": "Phân tích và so sánh được hiệu năng thời gian (Time Complexity) của cây BST thông thường so với cây tự cân bằng (AVL) trong trường hợp xấu nhất.",
                "bloom_level": 4
            }
        ]
    }
