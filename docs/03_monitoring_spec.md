# 📊 Spec: Monitoring & Observability — LectureGenerator Chatbot

## 1. Tổng quan

Hệ thống monitoring theo dõi toàn bộ lifecycle của chatbot: từ prompt management, tool execution, đến performance metrics. Dựa trên mô hình observability của first-aid-chatbot với **Langfuse** làm trung tâm.

---

## 2. Langfuse Integration

### 2.1 Khởi tạo Client

```python
# chat.py
from langfuse import Langfuse

langfuse_client = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
    host=os.getenv("LANGFUSE_HOST", "http://localhost:3090")
)
```

**Biến môi trường cần thiết:**
```env
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_HOST=http://localhost:3090
```

### 2.2 Trace Structure

Mỗi cuộc hội thoại tạo ra một **Trace** chứa nhiều **Generations** và **Spans**:

```
Trace (name="lecture-generator-chatbot")
├── session_id: frontend session ID
├── input: user query
├── metadata: {provider, model, prompt_version, artifact_version}
│
├── Generation (name="round-1-completion")
│   ├── model: LLM model name
│   ├── input: messages array
│   ├── output: {text, tool_calls}
│   ├── usage: {prompt_tokens, completion_tokens, total_tokens}
│   └── prompt: linked Langfuse prompt object
│
├── Span (name="tool-rag_search")
│   ├── input: tool arguments
│   └── output: tool results
│
├── Generation (name="round-2-completion") 
│   └── ...
│
└── output: final assistant response
```

### 2.3 Prompt Registry

System prompt được quản lý qua Langfuse Prompt Registry:

```python
# Seed prompt on startup
def seed_langfuse_prompt(local_path: Path) -> None:
    """
    1. Đọc system prompt local
    2. So sánh với version hiện tại trên Langfuse
    3. Tạo version mới nếu content thay đổi
    4. Gắn label "production"
    """

# Get prompt at runtime
def get_system_prompt(local_path: Path) -> tuple[str, str, str, Any]:
    """
    1. Thử fetch từ Langfuse (cache 60s)
    2. Fallback sang local file
    Returns: (prompt_text, version_label, prompt_hash, prompt_obj)
    """
```

**Lợi ích:**
- Version control cho system prompt
- A/B testing giữa các prompt versions
- Rollback nhanh khi prompt mới gây lỗi
- Liên kết trace ↔ prompt version để đánh giá

---

## 3. Monitoring API Endpoints

### 3.1 Tools Monitoring

```
GET /api/monitoring/tools
```
Trả về danh sách tools đã khai báo trong `artifacts/tools.yaml`.

**Response:**
```json
[
  {
    "name": "rag_search",
    "description": "Tra cứu tài liệu bài giảng...",
    "parameters": { ... }
  },
  {
    "name": "clarify",
    "description": "Yêu cầu người dùng cung cấp thêm thông tin...",
    "parameters": { ... }
  }
]
```

### 3.2 Guardrails Monitoring

```
GET /api/monitoring/guardrails
```
Trả về nội dung system prompt (đóng vai trò guardrails).

**Response:**
```json
{
  "guardrails": "# System Prompt...",
  "system_prompt": "# System Prompt..."
}
```

### 3.3 Test Cases Monitoring

```
GET /api/monitoring/test-cases
```
Trả về danh sách eval test cases từ `data/eval_cases.json`.

---

## 4. Metrics được theo dõi

### 4.1 Performance Metrics

| Metric                | Nguồn                  | Mô tả                                |
|-----------------------|------------------------|---------------------------------------|
| `latency_ms`          | Chat endpoint          | Thời gian xử lý toàn bộ request      |
| `search_latency_ms`   | RAG Engine             | Thời gian tìm kiếm vector store      |
| `indexing_time_ms`     | RAG Engine             | Thời gian rebuild index               |
| `prompt_tokens`       | Chat / Langfuse        | Số tokens đầu vào                     |
| `completion_tokens`   | Chat / Langfuse        | Số tokens đầu ra                      |
| `total_tokens`        | Chat / Langfuse        | Tổng tokens sử dụng                   |

### 4.2 Quality Metrics (từ Eval)

| Metric               | Range  | Mô tả                                              |
|----------------------|--------|-----------------------------------------------------|
| `avg_precision`      | 0-1    | Precision@K — tỉ lệ chunks đúng / tổng chunks      |
| `avg_recall`         | 0-1    | Recall@K — có tìm đúng document không               |
| `avg_mrr`            | 0-1    | Mean Reciprocal Rank — rank kết quả đúng đầu tiên  |
| `avg_faithfulness`   | 0-5    | LLM-as-judge: câu trả lời trung thực với tài liệu  |
| `avg_relevance`      | 0-5    | LLM-as-judge: câu trả lời liên quan đến câu hỏi    |

### 4.3 System Metrics

| Metric               | Nguồn           | Mô tả                            |
|----------------------|-----------------|-----------------------------------|
| `collection_size`    | RAG Status      | Tổng chunks trong vector store    |
| `document_count`     | RAG Status      | Số tài liệu nguồn                |
| `use_chroma`         | RAG Status      | ChromaDB hay in-memory            |
| `embedding_model`    | RAG Status      | Model embedding đang sử dụng     |

---

## 5. Dashboard Monitoring (Frontend)

### 5.1 Các panel cần hiển thị

```
┌─────────────────────────────────────────────────┐
│                MONITORING DASHBOARD              │
├───────────────┬─────────────────────────────────┤
│  System       │  ● Provider: OpenRouter         │
│  Status       │  ● Model: gemini-2.0-flash      │
│               │  ● Status: 🟢 Healthy           │
│               │  ● Vector DB: ChromaDB (45 docs)│
├───────────────┼─────────────────────────────────┤
│  RAG Config   │  ● Strategy: recursive          │
│               │  ● Chunk Size: 500              │
│               │  ● Embedding: mock              │
│               │  ● Top-K: 3                     │
├───────────────┼─────────────────────────────────┤
│  Latest Eval  │  ● Precision: 0.85              │
│  Results      │  ● Recall: 1.00                 │
│               │  ● MRR: 0.90                    │
│               │  ● Faithfulness: 4.2/5          │
│               │  ● Relevance: 4.5/5             │
├───────────────┼─────────────────────────────────┤
│  Guardrails   │  ● System Prompt (view/edit)    │
│               │  ● Tools Declaration (view)     │
│               │  ● Prompt Version: langfuse:v3  │
├───────────────┼─────────────────────────────────┤
│  Activity     │  ● Recent Transcripts (list)    │
│  Logs         │  ● Eval Run History (list)      │
│               │  ● Tool Call Events (timeline)  │
└───────────────┴─────────────────────────────────┘
```

---

## 6. Langfuse Dashboard Views

Sau khi tích hợp Langfuse, bạn có thể theo dõi:

1. **Traces** — Mỗi câu hỏi từ user = 1 trace
2. **Generations** — Chi tiết mỗi lần gọi LLM (model, tokens, latency)
3. **Spans** — Tool calls (rag_search, clarify) với input/output
4. **Prompt Registry** — Version history của system prompt
5. **Sessions** — Group traces theo session_id (1 cuộc hội thoại)
6. **Metrics** — Token usage trends, latency trends, cost estimation
