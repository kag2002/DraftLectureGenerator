# 🛡️ Spec: Guardrails — LectureGenerator Chatbot

## 1. Tổng quan

Guardrails là các cơ chế bảo vệ đảm bảo chatbot hoạt động an toàn, chính xác, và trong phạm vi cho phép. Hệ thống sử dụng **3 lớp guardrails**:

```
┌─────────────────────────────────────────┐
│  Layer 1: System Prompt Guardrails      │  ← Prompt-based constraints
│  (artifacts/system_prompt.md)           │
├─────────────────────────────────────────┤
│  Layer 2: Tool-Level Guardrails         │  ← RAG grounding + clarify
│  (tools/rag_search.py, clarify.py)      │
├─────────────────────────────────────────┤
│  Layer 3: Application-Level Guardrails  │  ← Server-side controls
│  (server.py — max rounds, validation)   │
└─────────────────────────────────────────┘
```

---

## 2. Layer 1: System Prompt Guardrails

### 2.1 Cấu trúc System Prompt

**File:** `artifacts/system_prompt.md`

System prompt phải bao gồm các phần sau:

```markdown
# Hướng dẫn Hệ thống: [Tên Chatbot]

Mô tả vai trò, nhiệm vụ chính.

---

## 🛡️ NGUYÊN TẮC AN TOÀN & GIỚI HẠN

1. **Scope limitation** — Chỉ trả lời trong phạm vi chủ đề
2. **Source grounding** — Bắt buộc dựa trên tài liệu (RAG)
3. **Disclaimer** — Tuyên bố giới hạn AI
4. **Critical warnings** — Cảnh báo sai lầm phổ biến (nếu có)

---

## 🛠️ HƯỚNG DẪN SỬ DỤNG CÔNG CỤ

1. **rag_search** — Khi nào và cách gọi
2. **clarify** — Khi nào cần hỏi thêm thông tin

---

## ✍️ PHONG CÁCH & ĐỊNH DẠNG PHẢN HỒI

- Ngôn ngữ
- Cấu trúc câu trả lời
- Formatting rules
```

### 2.2 Guardrails Rules mẫu

| Rule                         | Mô tả                                                    |
|------------------------------|-----------------------------------------------------------|
| **Topic Boundary**           | Chỉ trả lời câu hỏi liên quan đến chủ đề bài giảng      |
| **RAG-First**                | BẮT BUỘC gọi `rag_search` trước khi trả lời              |
| **No Hallucination**         | Không tự bịa thông tin ngoài tài liệu                    |
| **Fallback Response**        | Nếu không tìm thấy → thông báo lịch sự + hướng dẫn khác |
| **Clarify When Ambiguous**   | Nếu câu hỏi mơ hồ → gọi `clarify` để hỏi rõ           |
| **AI Disclaimer**            | Tuyên bố thông tin chỉ mang tính tham khảo               |
| **Language Consistency**     | Trả lời bằng tiếng Việt                                  |

### 2.3 Prompt Versioning

System prompt được quản lý qua **Langfuse Prompt Registry**:

- Mỗi thay đổi → tạo version mới
- Label `production` cho version đang active
- Có thể rollback bất kỳ lúc nào
- Mỗi trace ghi lại prompt version đã sử dụng

---

## 3. Layer 2: Tool-Level Guardrails

### 3.1 RAG Search Tool — Grounding Mechanism

```python
# tools/rag_search.py
def rag_search(query: str, top_k: int = 3) -> dict:
    """
    Guardrail: Buộc LLM phải dựa trên tài liệu thực tế.
    
    - LLM PHẢI gọi tool này trước khi trả lời
    - Kết quả trả về chứa content + metadata (trích dẫn nguồn)
    - Nếu không có kết quả → LLM nên thông báo "không tìm thấy"
    """
```

**Cách hoạt động:**
```
User: "Giải thích về [topic]"
  ↓
LLM gọi rag_search(query="[topic]")
  ↓
RAG Engine trả về top-K chunks với score
  ↓
LLM tổng hợp câu trả lời DỰA TRÊN chunks
  ↓
Câu trả lời có grounding từ tài liệu ✓
```

### 3.2 Clarify Tool — Input Validation

```python
# tools/clarify.py
def ask_user(question: str, response_type: str, options: list[str] | None = None) -> dict:
    """
    Guardrail: Đảm bảo đủ thông tin trước khi trả lời.
    
    - Tránh trả lời sai do thiếu context
    - Hỗ trợ response_type: "text" hoặc "yes_no"
    - Có thể cung cấp options cho người dùng chọn
    - Trả về awaiting_user=True → dừng tool loop
    """
```

---

## 4. Layer 3: Application-Level Guardrails

### 4.1 Tool Loop Limit

```python
# server.py / chat.py
max_tool_rounds = 4  # Giới hạn số vòng gọi tool

# Nếu vượt quá:
if round_index > max_tool_rounds:
    return {
        "status": "max_tool_rounds",
        "assistant_text": "Dừng lại sau N vòng gọi công cụ."
    }
```

**Mục đích:** Ngăn infinite loop khi LLM liên tục gọi tool.

### 4.2 Input Validation

```python
# server.py — Pydantic models
class ChatRequest(BaseModel):
    messages: List[ChatMessage]           # Required
    temperature: float = Field(0.0, ge=0.0, le=2.0)  # Range check
    max_tokens: Optional[int] = Field(None, gt=0)     # Positive only
    session_id: Optional[str] = None
```

### 4.3 History Window

```python
# chat.py
def trim_history(history, window=5):
    """Giữ tối đa `window` cặp user-assistant gần nhất."""
    return history[-window * 2:]
```

**Mục đích:** Giới hạn context length, ngăn token overflow.

### 4.4 Content Truncation

```python
# chat.py
def json_text(value, max_chars=None):
    """Truncate tool results nếu quá dài."""
    text = json.dumps(value, ...)
    if max_chars and len(text) > max_chars:
        return text[:max_chars] + "\n...<truncated>"
    return text
```

### 4.5 Path Traversal Protection

```python
# server.py — Log detail endpoint
@app.get("/api/logs/detail")
async def log_detail(file: str):
    target = (ROOT / file).resolve()
    if not str(target).startswith(str(ROOT.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
```

---

## 5. Guardrails Configuration File

**File:** `artifacts/guardrails.yaml` (MỚI — đề xuất thêm)

```yaml
# Cấu hình guardrails tập trung
guardrails:
  # Topic scope
  allowed_topics:
    - "[CHỦ ĐỀ SẼ CHỌN SAU]"
  
  # Tool loop
  max_tool_rounds: 4
  
  # History
  history_window: 5
  
  # Content limits
  max_response_length: 4000       # ký tự
  max_tool_result_chars: 24000    # ký tự
  
  # Safety
  require_rag_before_answer: true  # BẮT BUỘC gọi rag_search
  require_disclaimer: true         # Luôn kèm disclaimer
  
  # Blocked patterns (regex)
  blocked_input_patterns:
    - "ignore.*instructions"
    - "forget.*system.*prompt"
    - "pretend.*you.*are"
  
  # Fallback
  fallback_message: >
    Xin lỗi, tôi không tìm thấy thông tin chi tiết về vấn đề này 
    trong tài liệu hiện tại. Bạn có thể tham khảo thêm tại [nguồn khác].
```

---

## 6. Guardrails Monitoring

### 6.1 API

```
GET /api/monitoring/guardrails
```

Trả về nội dung system prompt hiện tại (hoạt động như guardrails viewer).

### 6.2 Tracking

Mỗi trace trên Langfuse ghi lại:
- `prompt_version` — Version guardrails đang active
- `prompt_hash` — Hash nội dung prompt
- `artifact_version` — Kết hợp prompt + tools hash

→ Cho phép audit: **"Tại thời điểm T, chatbot đang dùng guardrails version nào?"**

---

## 7. Tóm tắt Guardrails Checklist

| # | Guardrail                    | Layer    | Status |
|---|------------------------------|----------|--------|
| 1 | Topic boundary trong prompt  | Prompt   | ☐      |
| 2 | RAG-first requirement        | Prompt   | ☐      |
| 3 | No hallucination rule        | Prompt   | ☐      |
| 4 | AI disclaimer                | Prompt   | ☐      |
| 5 | Clarify tool cho ambiguity   | Tool     | ☐      |
| 6 | RAG grounding                | Tool     | ☐      |
| 7 | Max tool rounds = 4          | App      | ☐      |
| 8 | Input validation (Pydantic)  | App      | ☐      |
| 9 | History window = 5           | App      | ☐      |
| 10| Content truncation           | App      | ☐      |
| 11| Path traversal protection    | App      | ☐      |
| 12| Prompt versioning            | Monitor  | ☐      |
