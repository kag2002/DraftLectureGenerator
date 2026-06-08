# 📝 Spec: Logging & Transcript System — LectureGenerator Chatbot

## 1. Tổng quan

Hệ thống logging ghi lại toàn bộ hoạt động của chatbot dưới dạng JSON files, phục vụ cho:
- **Debug** — Xem lại chi tiết mỗi cuộc hội thoại
- **Audit** — Kiểm tra chatbot đã trả lời đúng chưa
- **Analytics** — Phân tích usage patterns
- **Reproducibility** — Replay lại sessions với cùng config

---

## 2. Transcript System

### 2.1 Transcript Structure

**Lưu trữ:** `transcripts/web_{session_id}.json`

```json
{
  "transcript_id": "web_abc123",
  "version": "v1",
  "artifact_version": "v1+p1a2b3c4d5e6+t7f8g9h0i1j2",
  "prompt_hash": "sha256...",
  "tools_hash": "sha256...",
  "provider": "openrouter",
  "model": "google/gemini-2.0-flash-exp:free",
  "system_prompt": "artifacts/system_prompt.md",
  "tools": "artifacts/tools.yaml",
  "history_window": 5,
  "max_tool_rounds": 4,
  "created_at": "2026-06-05T10:30:00",
  "updated_at": "2026-06-05T10:35:22",
  "turns": [
    {
      "turn_index": 1,
      "started_at": "2026-06-05T10:30:05",
      "user": "Giải thích về [chủ đề X]",
      "status": "answered",
      "assistant_text": "Theo tài liệu bài giảng...",
      "rounds": [
        {
          "round": 1,
          "assistant_text": null,
          "tool_calls": [
            {"name": "rag_search", "args": {"query": "chủ đề X"}}
          ],
          "tool_results": [
            {
              "tool": "rag_search",
              "args": {"query": "chủ đề X"},
              "result": {"query": "...", "results": [...], "status": "success"}
            }
          ]
        },
        {
          "round": 2,
          "assistant_text": "Theo tài liệu bài giảng...",
          "tool_calls": [],
          "tool_results": []
        }
      ],
      "tool_events": [...],
      "ended_at": "2026-06-05T10:30:12",
      "latency_ms": 7200.5,
      "prompt_tokens": 450,
      "completion_tokens": 280,
      "total_tokens": 730
    }
  ]
}
```

### 2.2 Turn Status Values

| Status             | Mô tả                                        |
|--------------------|-----------------------------------------------|
| `answered`         | LLM trả lời thành công                        |
| `waiting_for_user` | Đang chờ user trả lời clarify question        |
| `max_tool_rounds`  | Đạt giới hạn vòng tool loop                   |
| `provider_error`   | Lỗi từ LLM provider                           |

### 2.3 Round Record

Mỗi turn có thể có nhiều rounds (mỗi round = 1 lần gọi LLM):

```python
round_record = {
    "round": 1,                    # Số thứ tự round
    "assistant_text": str | None,  # Text response từ LLM
    "tool_calls": [                # Tools LLM muốn gọi
        {"name": "rag_search", "args": {"query": "..."}}
    ],
    "tool_results": [              # Kết quả thực thi tools
        {"tool": "rag_search", "args": {...}, "result": {...}}
    ]
}
```

---

## 3. Eval Run Logs

### 3.1 Structure

**Lưu trữ:** `runs/rag_eval_{timestamp}.json`

```json
{
  "run_id": "rag_eval_20260605T173208",
  "generated_at": "2026-06-05T17:32:08",
  "config": {
    "chunking_strategy": "recursive",
    "chunk_size": 500,
    "chunk_overlap": 50,
    "max_sentences_per_chunk": 3,
    "embedding_provider": "mock",
    "top_k": 3
  },
  "summary": {
    "avg_precision": 0.85,
    "avg_recall": 1.0,
    "avg_mrr": 0.90,
    "avg_latency_ms": 4.5,
    "avg_faithfulness": 4.2,
    "avg_relevance": 4.5
  },
  "retrieval_details": [
    {
      "case_id": "case_1",
      "question": "...",
      "expected_doc_id": "topic_01",
      "precision": 0.33,
      "recall": 1.0,
      "mrr": 1.0,
      "latency_ms": 3.8,
      "retrieved_docs": ["topic_01", "topic_02", "topic_03"]
    }
  ],
  "generation_details": [
    {
      "case_id": "case_1",
      "question": "...",
      "answer": "...",
      "faithfulness": 4.0,
      "relevance": 5.0
    }
  ]
}
```

---

## 4. Artifact Versioning trong Logs

### 4.1 Version Format

```
artifact_version = "{version}+p{prompt_hash[:12]}+t{tools_hash[:12]}"

Ví dụ: "v1+p1a2b3c4d5e6+t7f8g9h0i1j2"
```

### 4.2 Versioning Module

```python
# versioning.py
@dataclass(frozen=True)
class ArtifactVersion:
    version: str             # Label (v1, v2, ...)
    artifact_version: str    # Full version string
    prompt_hash: str         # SHA256 of system_prompt.md
    tools_hash: str          # SHA256 of tools.yaml

def build_artifact_version(version, system_prompt_path, tools_path) -> ArtifactVersion:
    """Tính hash của prompt + tools → tạo artifact version string."""

def artifact_version_dict(version) -> dict:
    """Convert to dict for JSON serialization."""
```

**Mục đích:** Mỗi transcript ghi lại chính xác version nào của prompt và tools đã được sử dụng → cho phép reproduce và audit.

---

## 5. Log Viewer API

### 5.1 Endpoints

| Method | Endpoint                | Mô tả                              |
|--------|-------------------------|-------------------------------------|
| `GET`  | `/api/logs/runs`        | Liệt kê eval runs                  |
| `GET`  | `/api/logs/transcripts` | Liệt kê chat transcripts           |
| `GET`  | `/api/logs/detail?file=`| Xem chi tiết 1 file (runs/transc.) |

### 5.2 Response Formats

**List Runs:**
```json
{
  "runs": [
    {
      "file": "runs/rag_eval_20260605T173208.json",
      "run_id": "rag_eval_20260605T173208",
      "generated_at": "2026-06-05T17:32:08",
      "summary": { ... }
    }
  ]
}
```

**List Transcripts:**
```json
{
  "transcripts": [
    {
      "file": "transcripts/web_abc123.json",
      "transcript_id": "web_abc123",
      "version": "v1",
      "provider": "openrouter",
      "model": "gemini-2.0-flash",
      "created_at": "2026-06-05T10:30:00",
      "turn_count": 5
    }
  ]
}
```

---

## 6. Logging Flow

```
User sends message
       │
       ▼
  Chat Endpoint
       │
       ├── Start Langfuse Trace
       │
       ├── Tool Loop (rounds 1..N)
       │   ├── Langfuse Generation (per round)
       │   ├── Tool Execution → Langfuse Span
       │   └── Console log: [TOOL] name(args)
       │
       ├── Calculate metrics (latency, tokens)
       │
       ├── Write Transcript JSON
       │   └── transcripts/web_{session_id}.json
       │
       └── Langfuse Trace Update (output)
```

---

## 7. Directory Structure

```
backend/
├── transcripts/                    # Chat session logs
│   ├── web_session1.json
│   ├── web_session2.json
│   └── v1_openrouter_*.json       # CLI session logs
│
├── runs/                           # Evaluation run results
│   ├── rag_eval_20260605T173208.json
│   └── rag_eval_20260605T173347.json
│
├── artifacts/                      # Versioned configs
│   ├── system_prompt.md            # Guardrails + instructions
│   └── tools.yaml                  # Tool declarations
│
└── data/
    └── eval_cases.json             # Test cases for eval
```

---

## 8. Console Logging

Ngoài JSON files, hệ thống cũng log ra console:

```
[LANGFUSE] Client initialized successfully.
[LANGFUSE] Prompt 'lecture-generator-prompt' is up-to-date in registry.
Starting LectureGenerator Chatbot Server on port 8001...
Provider: openrouter, Version: v1, Model: default

[TOOL] rag_search({"query": "chủ đề bài giảng"})
Saved web transcript to transcripts/web_abc123.json

[LANGFUSE] Error starting trace: ...  (nếu có lỗi)
```
