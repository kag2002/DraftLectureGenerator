import os
import json
import re
from openai import OpenAI
from google import genai
from google.genai import types
from langfuse import Langfuse

# Load .env manually
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.env"))
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

# Initialize Langfuse client
langfuse = None
try:
    if os.environ.get("LANGFUSE_SECRET_KEY") and os.environ.get("LANGFUSE_PUBLIC_KEY"):
        langfuse = Langfuse(
            public_key=os.environ.get("LANGFUSE_PUBLIC_KEY"),
            secret_key=os.environ.get("LANGFUSE_SECRET_KEY"),
            host=os.environ.get("LANGFUSE_HOST", "http://localhost:3000")
        )
        print("[INFO] Langfuse initialized successfully.")
except Exception as e:
    print(f"[WARNING] Failed to initialize Langfuse: {e}")

def calculate_cost(model_name: str, input_tokens: int, output_tokens: int) -> dict:
    """Tính toán chi phí sử dụng dựa trên model và số lượng token."""
    pricing = {
        "gemini-2.5-flash": {"input": 0.075, "output": 0.30},
        "gpt-4o-mini": {"input": 0.150, "output": 0.600},
    }
    model_lower = model_name.lower()
    matched = {"input": 0.0, "output": 0.0}
    for k, v in pricing.items():
        if k in model_lower:
            matched = v
            break
            
    input_cost = (input_tokens / 1_000_000.0) * matched["input"]
    output_cost = (output_tokens / 1_000_000.0) * matched["output"]
    return {
        "input_cost": input_cost,
        "output_cost": output_cost,
        "total_cost": input_cost + output_cost
    }

def log_generation_to_langfuse(
    model_name: str,
    prompt,
    system_instruction: str,
    output: str,
    usage_data: dict,
    start_time,
    end_time,
    trace_or_span = None,
    prompt_name: str = None,
    prompt_version: str = None,
    metadata: dict = None,
    temperature: float = 0.2
):
    """Ghi nhận LLM Generation chi tiết lên Langfuse."""
    if not langfuse:
        return
    try:
        # Chuẩn bị dữ liệu input
        input_rep = prompt
        history_count = 0
        if isinstance(prompt, list):
            history_count = len(prompt)
            input_rep = json.dumps(prompt, ensure_ascii=False)
            
        in_tokens = 0
        out_tokens = 0
        if usage_data:
            in_tokens = usage_data.get("input_tokens", 0)
            out_tokens = usage_data.get("output_tokens", 0)
        else:
            in_tokens = len(str(prompt)) // 4
            out_tokens = len(output) // 4
            
        costs = calculate_cost(model_name, in_tokens, out_tokens)
        
        usage_payload = {
            "input_tokens": in_tokens,
            "output_tokens": out_tokens,
            "total_tokens": in_tokens + out_tokens,
            "input_cost": costs["input_cost"],
            "output_cost": costs["output_cost"],
            "total_cost": costs["total_cost"]
        }
        
        meta_payload = {
            **(metadata or {}),
            "system_instruction": system_instruction,
            "temperature": temperature,
            "history_count": history_count
        }
        
        active_target = trace_or_span
        if not active_target:
            active_target = langfuse.trace(
                name=prompt_name or "lecture_generation",
                input=input_rep,
                metadata=meta_payload
            )
            
        generation = active_target.generation(
            name=prompt_name or f"call_{model_name}",
            model=model_name,
            input=input_rep,
            output=output,
            usage=usage_payload,
            start_time=start_time,
            end_time=end_time,
            metadata=meta_payload
        )
        
        if prompt_name:
            try:
                lf_prompt = langfuse.get_prompt(prompt_name, version=prompt_version)
                generation.update(prompt=lf_prompt)
            except Exception:
                pass
    except Exception as e:
        print(f"[WARNING] Langfuse logging error: {e}")

def log_to_langfuse(model_name: str, prompt: str, system_instruction: str, output: str, usage: dict = None):
    import datetime
    now = datetime.datetime.now(datetime.timezone.utc)
    log_generation_to_langfuse(model_name, prompt, system_instruction, output, usage, now, now)


def robust_parse_json(text: str) -> dict:
    """Hàm trích xuất và parse JSON mạnh mẽ từ văn bản phản hồi của LLM."""
    if not text:
        raise ValueError("Empty response text")
    
    text = text.strip()
    
    # 1. Loại bỏ markdown code blocks ```json ... ``` hoặc ``` ... ```
    if text.startswith("```"):
        lines = text.splitlines()
        start_idx = 0
        for i, line in enumerate(lines):
            if line.strip().startswith("```"):
                start_idx = i + 1
                break
        end_idx = len(lines)
        for i in range(len(lines) - 1, start_idx - 1, -1):
            if lines[i].strip().startswith("```"):
                end_idx = i
                break
        text = "\n".join(lines[start_idx:end_idx]).strip()
        
    # 2. Thử parse trực tiếp
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
        
    # 3. Tìm kiếm { đầu tiên và } cuối cùng
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            json_str = text[start:end+1]
            return json.loads(json_str)
    except json.JSONDecodeError:
        pass
        
    # 4. Cleanup các lỗi cú pháp JSON phổ biến (dấu phẩy thừa trước đóng ngoặc)
    try:
        cleaned = re.sub(r',\s*([\]}])', r'\1', text)
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start:end+1])
    except json.JSONDecodeError:
        pass
        
    raise ValueError("Failed to parse JSON content from text")


# Danh sách các model free mạnh mẽ trên OpenRouter sắp xếp theo thứ tự ưu tiên (ưu tiên các model tốc độ nhanh)
FREE_MODELS = [
    "meta-llama/llama-3.2-3b-instruct:free",   # Cực kỳ nhanh, siêu nhẹ (3B parameters)
    "qwen/qwen-2.5-7b-instruct:free",         # Rất nhanh, xuất sắc cho xử lý JSON/Code (7B parameters)
    "meta-llama/llama-3-8b-instruct:free",      # Nhanh, nhẹ, xử lý tiếng Anh tốt (8B parameters)
    "google/gemma-2-9b-it:free",               # Nhanh, thông minh, hỗ trợ tiếng Việt khá (9B parameters)
    "google/gemini-2.5-flash:free",            # Nhanh, tối ưu hội thoại tốt
    "qwen/qwen3-coder:free",                   # Phù hợp sinh code/JSON
    "meta-llama/llama-3.3-70b-instruct:free",  # Rất thông minh nhưng tốc độ chậm hơn (70b parameters)
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "openai/gpt-oss-120b:free",
    "z-ai/glm-4.5-air:free",
    "openrouter/free"
]


def call_llm_json(
    prompt,
    system_instruction: str = None,
    temperature: float = 0.2,
    trace_or_span = None,
    prompt_name: str = None,
    prompt_version: str = None,
    metadata: dict = None
) -> dict:
    """Gọi LLM hỗ trợ định dạng JSON trả về, ghi nhận telemetry qua Langfuse."""
    import datetime
    import time
    
    # 0. Thử gọi Local/Tunnel LLM (Qwen2.5-14B-Instruct-Q4_K_M.gguf) làm ưu tiên số 0
    local_api_key = os.environ.get("LOCAL_LLM_API_KEY", "AIVIAL-SECURE-KEY-2026")
    local_model = os.environ.get("LOCAL_LLM_MODEL", "Qwen2.5-14B-Instruct-Q4_K_M.gguf")
    local_urls = []
    
    env_local_url = os.environ.get("LOCAL_LLM_URL")
    env_tunnel_url = os.environ.get("LOCAL_LLM_TUNNEL_URL")
    if env_local_url:
        local_urls.append(env_local_url)
    else:
        local_urls.append("http://127.0.0.1:8081/v1")
        
    if env_tunnel_url:
        local_urls.append(env_tunnel_url)
    else:
        local_urls.append("https://officials-spice-digital-casting.trycloudflare.com/v1")
        
    for base_url in local_urls:
        try:
            print(f"[INFO] Dang thu goi Local/Tunnel LLM: {base_url} voi model {local_model}...")
            client = OpenAI(
                base_url=base_url,
                api_key=local_api_key,
                timeout=20.0
            )
            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            if isinstance(prompt, list):
                for msg in prompt:
                    messages.append({"role": msg.get("role"), "content": msg.get("content")})
            else:
                messages.append({"role": "user", "content": prompt})
                
            start_time = datetime.datetime.now(datetime.timezone.utc)
            
            # Thử gọi với response_format={"type": "json_object"}
            try:
                response = client.chat.completions.create(
                    model=local_model,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=temperature,
                    timeout=20.0
                )
            except Exception as format_err:
                format_err_msg = str(format_err).lower()
                if "400" in format_err_msg or "format" in format_err_msg or "bad request" in format_err_msg:
                    print(f"[INFO] Local LLM khong ho tro JSON mode. Thu lai khong co response_format...")
                    retry_messages = messages.copy()
                    retry_messages.append({
                        "role": "user",
                        "content": "IMPORTANT: Return ONLY a valid JSON object. Do not include markdown formatting or explanation."
                    })
                    response = client.chat.completions.create(
                        model=local_model,
                        messages=retry_messages,
                        temperature=temperature,
                        timeout=20.0
                    )
                else:
                    raise format_err
                    
            end_time = datetime.datetime.now(datetime.timezone.utc)
            content = response.choices[0].message.content
            res_dict = robust_parse_json(content)
            
            usage = None
            if response.usage:
                usage = {
                    "input_tokens": response.usage.prompt_tokens,
                    "output_tokens": response.usage.completion_tokens
                }
            else:
                usage = {
                    "input_tokens": len(str(prompt)) // 4,
                    "output_tokens": len(content) // 4
                }
                
            log_generation_to_langfuse(
                model_name=local_model,
                prompt=prompt,
                system_instruction=system_instruction,
                output=content,
                usage_data=usage,
                start_time=start_time,
                end_time=end_time,
                trace_or_span=trace_or_span,
                prompt_name=prompt_name,
                prompt_version=prompt_version,
                metadata={**(metadata or {}), "local_endpoint": base_url},
                temperature=temperature
            )
            print(f"[SUCCESS] Goi Local/Tunnel LLM thanh cong qua {base_url}!")
            return res_dict
        except Exception as e:
            print(f"[WARNING] Loi khi goi Local/Tunnel LLM ({base_url}): {e}")

    # 1. Thử gọi Google Gemini-2.5-Flash trực tiếp (nếu có key, ưu tiên số 1 vì cực kỳ nhanh và tin cậy)
    if os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        try:
            print("[INFO] Dang thu goi Gemini API truc tiep...")
            api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
            client = genai.Client(api_key=api_key, http_options={'timeout': 8.0})
            
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=temperature
            )
            if system_instruction:
                config.system_instruction = system_instruction
                
            # Xử lý chat history cho Gemini
            gemini_contents = []
            if isinstance(prompt, list):
                for msg in prompt:
                    role = "user" if msg.get("role") == "user" else "model"
                    gemini_contents.append(
                        types.Content(role=role, parts=[types.Part.from_text(text=msg.get("content", ""))])
                    )
            else:
                gemini_contents = prompt
                
            start_time = datetime.datetime.now(datetime.timezone.utc)
            
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=gemini_contents,
                config=config
            )
            
            end_time = datetime.datetime.now(datetime.timezone.utc)
            res_dict = robust_parse_json(response.text)
            
            usage = None
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                usage = {
                    "input_tokens": response.usage_metadata.prompt_token_count,
                    "output_tokens": response.usage_metadata.candidates_token_count
                }
            else:
                usage = {
                    "input_tokens": len(str(prompt)) // 4,
                    "output_tokens": len(response.text) // 4
                }
                
            log_generation_to_langfuse(
                model_name="gemini-2.5-flash",
                prompt=prompt,
                system_instruction=system_instruction,
                output=response.text,
                usage_data=usage,
                start_time=start_time,
                end_time=end_time,
                trace_or_span=trace_or_span,
                prompt_name=prompt_name,
                prompt_version=prompt_version,
                metadata=metadata,
                temperature=temperature
            )
            return res_dict
        except Exception as e:
            print(f"[ERROR] Loi khi goi Gemini API truc tiep: {e}")
            
    # 2. Thử gọi OpenAI GPT-4o-mini trực tiếp (ưu tiên số 2 nếu Gemini thất bại/không có key)
    if os.environ.get("OPENAI_API_KEY"):
        try:
            print("[INFO] Dang thu goi OpenAI API truc tiep...")
            client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            if isinstance(prompt, list):
                for msg in prompt:
                    messages.append({"role": msg.get("role"), "content": msg.get("content")})
            else:
                messages.append({"role": "user", "content": prompt})
                
            start_time = datetime.datetime.now(datetime.timezone.utc)
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                response_format={"type": "json_object"},
                temperature=temperature,
                timeout=8.0
            )
            
            end_time = datetime.datetime.now(datetime.timezone.utc)
            content = response.choices[0].message.content
            res_dict = robust_parse_json(content)
            
            usage = None
            if response.usage:
                usage = {
                    "input_tokens": response.usage.prompt_tokens,
                    "output_tokens": response.usage.completion_tokens
                }
                
            log_generation_to_langfuse(
                model_name="gpt-4o-mini",
                prompt=prompt,
                system_instruction=system_instruction,
                output=content,
                usage_data=usage,
                start_time=start_time,
                end_time=end_time,
                trace_or_span=trace_or_span,
                prompt_name=prompt_name,
                prompt_version=prompt_version,
                metadata=metadata,
                temperature=temperature
            )
            return res_dict
        except Exception as e:
            print(f"[ERROR] Loi khi goi OpenAI API truc tiep: {e}")

    # 3. Thử gọi qua OpenRouter (Xoay phiên các model free làm fallback)
    if os.environ.get("OPENROUTER_API_KEY"):
        for model_name in FREE_MODELS:
            try:
                print(f"[INFO] Thu goi model OpenRouter: {model_name}...")
                client = OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=os.environ.get("OPENROUTER_API_KEY"),
                    timeout=8.0
                )
                messages = []
                if system_instruction:
                    messages.append({"role": "system", "content": system_instruction})
                if isinstance(prompt, list):
                    for msg in prompt:
                        messages.append({"role": msg.get("role"), "content": msg.get("content")})
                else:
                    messages.append({"role": "user", "content": prompt})
                    
                start_time = datetime.datetime.now(datetime.timezone.utc)
                
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=messages,
                        response_format={"type": "json_object"},
                        temperature=temperature,
                        timeout=8.0,
                        extra_headers={
                            "HTTP-Referer": "https://github.com/kag2002/DraftLectureGenerator",
                            "X-Title": "AI Lecture Assistant"
                        }
                    )
                    end_time = datetime.datetime.now(datetime.timezone.utc)
                    content = response.choices[0].message.content
                    res_dict = robust_parse_json(content)
                    
                    usage = None
                    if response.usage:
                        usage = {
                            "input_tokens": response.usage.prompt_tokens,
                            "output_tokens": response.usage.completion_tokens
                        }
                    log_generation_to_langfuse(
                        model_name=model_name,
                        prompt=prompt,
                        system_instruction=system_instruction,
                        output=content,
                        usage_data=usage,
                        start_time=start_time,
                        end_time=end_time,
                        trace_or_span=trace_or_span,
                        prompt_name=prompt_name,
                        prompt_version=prompt_version,
                        metadata=metadata,
                        temperature=temperature
                    )
                    return res_dict
                except Exception as e:
                    error_msg = str(e).lower()
                    status_code = getattr(e, "status_code", None)
                    if hasattr(e, "response") and e.response is not None:
                        status_code = getattr(e.response, "status_code", status_code)
                    
                    if status_code == 429 or "429" in error_msg or "too many requests" in error_msg:
                        print(f"[WARNING] Model {model_name} bi rate limit (429). Dang chuyen sang model tiep theo.")
                        continue
                    elif status_code == 402 or "402" in error_msg or "payment required" in error_msg or "credit" in error_msg:
                        print(f"[WARNING] Model {model_name} out of quota (402). Dang chuyen sang model tiep theo.")
                        continue
                    elif status_code == 401 or "401" in error_msg or "unauthorized" in error_msg:
                        print(f"[ERROR] Sai API Key OpenRouter (401). Huy xoay tua OpenRouter.")
                        break
                    
                    is_bad_request = status_code == 400 or "400" in error_msg or "bad request" in error_msg or "response_format" in error_msg
                    if is_bad_request:
                        print(f"[INFO] Model {model_name} khong ho tro JSON mode. Thu lai khong co response_format...")
                        try:
                            retry_messages = messages.copy()
                            retry_messages.append({
                                "role": "user",
                                "content": "IMPORTANT: Return ONLY a valid JSON object. Do not include markdown formatting or explanation."
                            })
                            
                            start_time = datetime.datetime.now(datetime.timezone.utc)
                            
                            response = client.chat.completions.create(
                                model=model_name,
                                messages=retry_messages,
                                temperature=temperature,
                                timeout=8.0,
                                extra_headers={
                                    "HTTP-Referer": "https://github.com/kag2002/DraftLectureGenerator",
                                    "X-Title": "AI Lecture Assistant"
                                }
                            )
                            end_time = datetime.datetime.now(datetime.timezone.utc)
                            content = response.choices[0].message.content
                            res_dict = robust_parse_json(content)
                            
                            usage = None
                            if response.usage:
                                usage = {
                                    "input_tokens": response.usage.prompt_tokens,
                                    "output_tokens": response.usage.completion_tokens
                                }
                            log_generation_to_langfuse(
                                model_name=model_name,
                                prompt=prompt,
                                system_instruction=system_instruction,
                                output=content,
                                usage_data=usage,
                                start_time=start_time,
                                end_time=end_time,
                                trace_or_span=trace_or_span,
                                prompt_name=prompt_name,
                                prompt_version=prompt_version,
                                metadata=metadata,
                                temperature=temperature
                            )
                            return res_dict
                        except Exception as retry_err:
                            print(f"[ERROR] Thu lai cho {model_name} that bai: {retry_err}. Dang chuyen sang model tiep theo.")
                            continue
                    else:
                        print(f"[ERROR] Loi khong xac dinh voi {model_name}: {e}. Dang chuyen sang model tiep theo.")
                        continue
            except Exception as e:
                print(f"[ERROR] Loi khoi tao hoac ket noi toi {model_name}: {e}")
                continue

    # 4. Fallback: Mock Data nếu tất cả đều thất bại (Non-crashing strategy)
    print("[WARNING] Khong co API key hop le hoac tat ca API deu gap loi. Dang su dung Mock Data.")
    start_time = datetime.datetime.now(datetime.timezone.utc)
    
    prompt_lower = (json.dumps(prompt) if isinstance(prompt, list) else str(prompt)).lower()
    system_lower = (system_instruction or "").lower()
    combined = prompt_lower + " " + system_lower
    
    mock_res = {}
    
    # CASE 1: Sinh Outline Chương học
    if "outline" in combined or "chapters" in combined:
        mock_res = {
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
        mock_res = {
            "slide_content": "# Chuong 1: Tong quan ve Cay BST\n* Cay nhi phan tim kiem la cau truc cay co nhanh trai luon nho hon va nhanh phai luon lon hon nut goc.\n* Thoi gian tim kiem trung binh la O(log n).\n[Nguồn: test_dsa.pdf - Trang: 1]\n\n# Slide 2: Hieu nang cua BST\n* Truong hop xau nhat, cay co the suy bien thanh danh sach lien ket voi do phuc tap O(n).\n[Nguồn: test_dsa.pdf - Trang: 2]",
            "active_learning_script": "### Hoat dong: Think-Pair-Share (5 phut)\n- **Buoc 1:** Giang vien dua ra mot day so va bat hoc vien ve cay BST cua ho (2 phut).\n- **Buoc 2:** Trao doi cheo voi ban ben canh de so sanh ket qua (2 phut).\n- **Buoc 3:** Goi 1 cap len bang ve cay BST dung nhat (1 phut)."
        }
        
    # CASE 3: Sinh Câu hỏi trắc nghiệm (MCQ) với Self-Correction
    elif "selected_answer" in combined or "solver" in combined:
        selected = "O(log n)"
        if "tang dan" in prompt_lower or "suy bien" in prompt_lower or "worst" in prompt_lower or "xau nhat" in prompt_lower:
            selected = "O(n)"
        mock_res = {
            "reasoning_path": "Solver Mock Reasoning: Cay BST can bang co thoi gian O(log n), lech thi O(n).",
            "selected_answer": selected
        }
        
    elif "question" in combined or "quiz" in combined or "options_json" in combined or "correct_answer" in combined:
        if "isomorphic" in combined or "dong cau" in combined or "tuong tu" in combined:
            mock_res = {
                "question_text": "Do phuc tap thoi gian tim kiem trong truong hop xau nhat tren cay BST co n phan tu la gi? (Isomorphic Mock)",
                "options_json": json.dumps(["O(n)", "O(log n)", "O(n log n)", "O(1)"]),
                "correct_answer": "O(n)"
            }
        else:
            mock_res = {
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
                        "reasoning_path": "Neu chen mot day so da sap xep tang dan, moi phan tu moi luon luon duoc chen vao ben phai cung cua nut hien tai. BST se suy biến thanh mot danh sach lien ket lech phai. Vi the thao tac tim kiem mat thoi gian tuyen tinh O(n)."
                    }
                ]
            }
        
    # CASE 4: Danh gia nguon Web Search Credibility
    elif "credibility" in combined or "score" in combined:
        mock_res = {
            "score": 0.85,
            "justification": "Nguon tu ten mien .edu uy tin cua Harvard University va bai viet co trich dan khoa hoc ro rang."
        }
        
    # CASE 5: Tom tat tai lieu hoc thuat
    elif "summary" in combined or "summarize" in combined or "tóm tắt" in combined:
        mock_res = {
            "summary": "Tài liệu học thuật thảo luận về nguyên lý hoạt động, cấu trúc và thời gian tính toán của giải thuật tự cân bằng đang tìm kiếm. Cung cấp các chứng minh độ phức tạp O(log n) trong trường hợp trung bình và cách xoay cây để bảo toàn chiều cao tối ưu."
        }
        
    else:
        # DEFAULT: Mock Syllabus
        mock_res = {
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
        
    end_time = datetime.datetime.now(datetime.timezone.utc)
    mock_out = json.dumps(mock_res, ensure_ascii=False)
    log_generation_to_langfuse(
        model_name="mock-fallback",
        prompt=prompt,
        system_instruction=system_instruction,
        output=mock_out,
        usage_data={"input_tokens": 0, "output_tokens": 0},
        start_time=start_time,
        end_time=end_time,
        trace_or_span=trace_or_span,
        prompt_name=prompt_name,
        prompt_version=prompt_version,
        metadata={**(metadata or {}), "fallback": True},
        temperature=temperature
    )
    return mock_res


def call_llm_stream(
    prompt,
    system_instruction: str = None,
    temperature: float = 0.2,
    trace_or_span = None,
    prompt_name: str = None,
    prompt_version: str = None,
    metadata: dict = None
):
    """Gọi LLM và yield từng token, ghi nhận telemetry qua Langfuse."""
    import datetime
    import time
    
    # 0. Thử gọi Local/Tunnel LLM (Qwen2.5-14B-Instruct-Q4_K_M.gguf) làm ưu tiên số 0
    local_api_key = os.environ.get("LOCAL_LLM_API_KEY", "AIVIAL-SECURE-KEY-2026")
    local_model = os.environ.get("LOCAL_LLM_MODEL", "Qwen2.5-14B-Instruct-Q4_K_M.gguf")
    local_urls = []
    
    env_local_url = os.environ.get("LOCAL_LLM_URL")
    env_tunnel_url = os.environ.get("LOCAL_LLM_TUNNEL_URL")
    if env_local_url:
        local_urls.append(env_local_url)
    else:
        local_urls.append("http://127.0.0.1:8081/v1")
        
    if env_tunnel_url:
        local_urls.append(env_tunnel_url)
    else:
        local_urls.append("https://officials-spice-digital-casting.trycloudflare.com/v1")

    for base_url in local_urls:
        try:
            print(f"[INFO] [Stream] Dang thu goi Local/Tunnel LLM: {base_url}...")
            client = OpenAI(
                base_url=base_url,
                api_key=local_api_key
            )
            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            if isinstance(prompt, list):
                for msg in prompt:
                    messages.append({"role": msg.get("role"), "content": msg.get("content")})
            else:
                messages.append({"role": "user", "content": prompt})
                
            start_time = datetime.datetime.now(datetime.timezone.utc)
            
            response = client.chat.completions.create(
                model=local_model,
                messages=messages,
                stream=True,
                temperature=temperature,
                timeout=20.0
            )
            
            accumulated_text = ""
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    accumulated_text += token
                    yield token
                    
            end_time = datetime.datetime.now(datetime.timezone.utc)
            
            usage = {
                "input_tokens": len(str(prompt)) // 4,
                "output_tokens": len(accumulated_text) // 4
            }
            log_generation_to_langfuse(
                model_name=local_model,
                prompt=prompt,
                system_instruction=system_instruction,
                output=accumulated_text,
                usage_data=usage,
                start_time=start_time,
                end_time=end_time,
                trace_or_span=trace_or_span,
                prompt_name=prompt_name,
                prompt_version=prompt_version,
                metadata={**(metadata or {}), "local_endpoint": base_url},
                temperature=temperature
            )
            print(f"[SUCCESS] [Stream] Goi Local/Tunnel LLM thanh cong qua {base_url}!")
            return
        except Exception as e:
            print(f"[WARNING] [Stream] Loi khi goi Local/Tunnel LLM ({base_url}): {e}")

    # 1. Thử gọi Google Gemini-2.5-Flash trực tiếp
    if os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        try:
            print("[INFO] [Stream] Dang thu goi Gemini API truc tiep...")
            api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
            client = genai.Client(api_key=api_key, http_options={'timeout': 8.0})
            
            config = types.GenerateContentConfig(
                temperature=temperature
            )
            if system_instruction:
                config.system_instruction = system_instruction
                
            gemini_contents = []
            if isinstance(prompt, list):
                for msg in prompt:
                    role = "user" if msg.get("role") == "user" else "model"
                    gemini_contents.append(
                        types.Content(role=role, parts=[types.Part.from_text(text=msg.get("content", ""))])
                    )
            else:
                gemini_contents = prompt
                
            start_time = datetime.datetime.now(datetime.timezone.utc)
            
            response = client.models.generate_content_stream(
                model='gemini-2.5-flash',
                contents=gemini_contents,
                config=config
            )
            
            accumulated_text = ""
            for chunk in response:
                if chunk.text:
                    accumulated_text += chunk.text
                    yield chunk.text
                    
            end_time = datetime.datetime.now(datetime.timezone.utc)
            
            usage = {
                "input_tokens": len(str(prompt)) // 4,
                "output_tokens": len(accumulated_text) // 4
            }
            log_generation_to_langfuse(
                model_name="gemini-2.5-flash",
                prompt=prompt,
                system_instruction=system_instruction,
                output=accumulated_text,
                usage_data=usage,
                start_time=start_time,
                end_time=end_time,
                trace_or_span=trace_or_span,
                prompt_name=prompt_name,
                prompt_version=prompt_version,
                metadata=metadata,
                temperature=temperature
            )
            return
        except Exception as e:
            print(f"[ERROR] [Stream] Loi khi goi Gemini API: {e}")
            
    # 2. Thử gọi OpenAI GPT-4o-mini trực tiếp
    if os.environ.get("OPENAI_API_KEY"):
        try:
            print("[INFO] [Stream] Dang thu goi OpenAI API truc tiep...")
            client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            if isinstance(prompt, list):
                for msg in prompt:
                    messages.append({"role": msg.get("role"), "content": msg.get("content")})
            else:
                messages.append({"role": "user", "content": prompt})
                
            start_time = datetime.datetime.now(datetime.timezone.utc)
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                stream=True,
                temperature=temperature
            )
            
            accumulated_text = ""
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    accumulated_text += token
                    yield token
                    
            end_time = datetime.datetime.now(datetime.timezone.utc)
            
            usage = {
                "input_tokens": len(str(prompt)) // 4,
                "output_tokens": len(accumulated_text) // 4
            }
            log_generation_to_langfuse(
                model_name="gpt-4o-mini",
                prompt=prompt,
                system_instruction=system_instruction,
                output=accumulated_text,
                usage_data=usage,
                start_time=start_time,
                end_time=end_time,
                trace_or_span=trace_or_span,
                prompt_name=prompt_name,
                prompt_version=prompt_version,
                metadata=metadata,
                temperature=temperature
            )
            return
        except Exception as e:
            print(f"[ERROR] [Stream] Loi khi goi OpenAI API: {e}")

    # 3. Thử gọi qua OpenRouter (Sử dụng model free đầu tiên hoạt động ổn định)
    if os.environ.get("OPENROUTER_API_KEY"):
        for model_name in FREE_MODELS:
            try:
                print(f"[INFO] [Stream] Thu goi model OpenRouter: {model_name}...")
                client = OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=os.environ.get("OPENROUTER_API_KEY")
                )
                messages = []
                if system_instruction:
                    messages.append({"role": "system", "content": system_instruction})
                if isinstance(prompt, list):
                    for msg in prompt:
                        messages.append({"role": msg.get("role"), "content": msg.get("content")})
                else:
                    messages.append({"role": "user", "content": prompt})
                    
                start_time = datetime.datetime.now(datetime.timezone.utc)
                
                response = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    stream=True,
                    temperature=temperature,
                    extra_headers={
                        "HTTP-Referer": "https://github.com/kag2002/DraftLectureGenerator",
                        "X-Title": "AI Lecture Assistant"
                    }
                )
                
                accumulated_text = ""
                for chunk in response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        accumulated_text += token
                        yield token
                        
                end_time = datetime.datetime.now(datetime.timezone.utc)
                
                usage = {
                    "input_tokens": len(str(prompt)) // 4,
                    "output_tokens": len(accumulated_text) // 4
                }
                log_generation_to_langfuse(
                    model_name=model_name,
                    prompt=prompt,
                    system_instruction=system_instruction,
                    output=accumulated_text,
                    usage_data=usage,
                    start_time=start_time,
                    end_time=end_time,
                    trace_or_span=trace_or_span,
                    prompt_name=prompt_name,
                    prompt_version=prompt_version,
                    metadata=metadata,
                    temperature=temperature
                )
                return
            except Exception as e:
                print(f"[WARNING] [Stream] Loi model {model_name}: {e}. Chuyen sang model tiep theo.")
                continue

    # 4. Fallback: Mock Data
    print("[WARNING] [Stream] Khong co API key hop le hoac tat ca API deu loi. Dang su dung Mock Stream.")
    start_time = datetime.datetime.now(datetime.timezone.utc)
    mock_slide = "# Chương 1: Tổng quan về Cây BST\n* Cây nhị phân tìm kiếm là cấu trúc cây có nhánh trái luôn nhỏ hơn và nhánh phải luôn lớn hơn nút gốc.\n* Thời gian tìm kiếm trung bình là O(log n).\n[Nguồn: slide_dsa.pdf - Trang: 1]\n\n# Slide 2: Hiệu năng của BST\n* Trường hợp xấu nhất, cây có thể suy biến thành danh sách liên kết với độ phức tạp O(n).\n[Nguồn: slide_dsa.pdf - Trang: 2]"
    mock_act = "### Hoạt động: Think-Pair-Share (5 phút)\n- **Bước 1:** Giảng viên đưa ra một dãy số và bắt học viên vẽ cây BST của họ (2 phút).\n- **Bước 2:** Trao đổi chéo với bạn bên cạnh để so sánh kết quả (2 phút).\n- **Bước 3:** Gọi 1 cặp lên bảng vẽ cây BST đúng nhất (1 phút)."
    
    combined_mock = f"---SLIDES---\n{mock_slide}\n---ACTIVE_LEARNING---\n{mock_act}"
    
    # Stream simulated delay
    import time
    for chunk in [combined_mock[i:i+20] for i in range(0, len(combined_mock), 20)]:
        yield chunk
        time.sleep(0.05)
        
    end_time = datetime.datetime.now(datetime.timezone.utc)
    log_generation_to_langfuse(
        model_name="mock-fallback-stream",
        prompt=prompt,
        system_instruction=system_instruction,
        output=combined_mock,
        usage_data={"input_tokens": 0, "output_tokens": 0},
        start_time=start_time,
        end_time=end_time,
        trace_or_span=trace_or_span,
        prompt_name=prompt_name,
        prompt_version=prompt_version,
        metadata={**(metadata or {}), "fallback": True},
        temperature=temperature
    )

