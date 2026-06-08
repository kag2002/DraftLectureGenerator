# 🏗️ Kiến trúc Tổng quan — LectureGenerator Chatbot

## 1. Mô tả dự án

**LectureGenerator** là một RAG-based chatbot hỗ trợ giáo dục, giúp sinh viên/người dùng hỏi đáp, sinh nội dung bài giảng, và tìm kiếm kiến thức theo chủ đề cụ thể. Hệ thống được thiết kế dựa trên kiến trúc tham chiếu từ dự án **first-aid-chatbot** (Day7) với đầy đủ các tính năng: RAG pipeline, monitoring, evaluation, guardrails, và logging.

> **Chủ đề cụ thể**: _Sẽ được chọn sau — hệ thống được thiết kế linh hoạt để hỗ trợ bất kỳ miền kiến thức nào._

---

## 2. Sơ đồ Kiến trúc

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Chat UI  │ │ RAG Mgmt │ │ Eval     │ │ Logs/Monitor│ │
│  │          │ │ Panel    │ │ Dashboard│ │ Dashboard   │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘ │
│       └─────────────┴────────────┴──────────────┘        │
│                         │ REST API                       │
└─────────────────────────┼────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────┐
│                   BACKEND (FastAPI + Python)              │
│                         │                                │
│  ┌──────────────────────▼──────────────────────────┐     │
│  │              API Router (server.py)              │     │
│  │  /api/chat  /api/rag/*  /api/eval  /api/logs/*  │     │
│  └──┬──────────┬──────────┬───────────┬────────────┘     │
│     │          │          │           │                   │
│  ┌──▼──┐  ┌───▼───┐  ┌───▼───┐  ┌───▼────┐             │
│  │Chat │  │ RAG   │  │ Eval  │  │ Log &  │             │
│  │Agent│  │Engine │  │Module │  │Monitor │             │
│  └──┬──┘  └───┬───┘  └───┬───┘  └───┬────┘             │
│     │         │          │           │                   │
│  ┌──▼─────────▼──────────▼───────────▼────┐             │
│  │         Core Services Layer             │             │
│  │  ┌────────┐ ┌──────────┐ ┌───────────┐ │             │
│  │  │Provider│ │Versioning│ │ Langfuse  │ │             │
│  │  │Factory │ │  System  │ │ Client    │ │             │
│  │  └────────┘ └──────────┘ └───────────┘ │             │
│  └────────────────────────────────────────┘             │
│                                                          │
│  ┌────────────────────────────────────────────┐         │
│  │           RAG Pipeline                      │         │
│  │  ┌────────┐ ┌──────────┐ ┌──────────────┐  │         │
│  │  │Chunking│ │Embeddings│ │ Vector Store  │  │         │
│  │  │Strategies│ │Models   │ │ (ChromaDB)   │  │         │
│  │  └────────┘ └──────────┘ └──────────────┘  │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  ┌────────────────────┐  ┌─────────────────────┐        │
│  │  artifacts/        │  │  data/               │        │
│  │  - system_prompt.md│  │  - documents/*.md    │        │
│  │  - tools.yaml      │  │  - chroma_db/        │        │
│  │  - guardrails.yaml │  │  - eval_cases.json   │        │
│  └────────────────────┘  └─────────────────────┘        │
│                                                          │
│  ┌────────────────────┐  ┌─────────────────────┐        │
│  │  transcripts/      │  │  runs/               │        │
│  │  - session_*.json  │  │  - rag_eval_*.json   │        │
│  └────────────────────┘  └─────────────────────┘        │
└──────────────────────────────────────────────────────────┘
                          │
           ┌──────────────┼───────────────┐
           │              │               │
    ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
    │  OpenRouter  │ │  Gemini   │ │  Langfuse   │
    │  / OpenAI    │ │  / Anthro │ │  (Observab.)│
    └─────────────┘ └───────────┘ └─────────────┘
```

---

## 3. Luồng xử lý chính (Main Flow)

```
User Question
     │
     ▼
[System Prompt Injection] ──► Langfuse Prompt Registry (nếu có)
     │
     ▼
[Tool-Augmented LLM Loop]
     │
     ├─ LLM gọi `rag_search(query)` ──► RAG Engine ──► ChromaDB ──► Top-K chunks
     │
     ├─ LLM gọi `clarify(question)` ──► Trả về câu hỏi làm rõ cho user
     │
     └─ LLM trả lời cuối cùng (có trích dẫn nguồn)
     │
     ▼
[Transcript Logging] ──► transcripts/*.json
[Langfuse Tracing] ──► Langfuse Dashboard
```

---

## 4. Tech Stack

| Layer          | Technology                                    |
|----------------|-----------------------------------------------|
| Frontend       | Next.js + TypeScript + TailwindCSS            |
| Backend API    | FastAPI + Uvicorn                              |
| LLM Providers  | OpenRouter, OpenAI, Anthropic, Gemini          |
| RAG Vector DB  | ChromaDB (persistent) + in-memory fallback     |
| Embeddings     | Mock / SentenceTransformers / OpenAI           |
| Observability  | Langfuse (traces, generations, prompt registry)|
| Config         | YAML (tools) + Markdown (system prompt)        |
| Logging        | JSON transcripts + eval run files              |

---

## 5. Các module chính

| Module            | File(s)                     | Mô tả                                                    |
|-------------------|-----------------------------|-----------------------------------------------------------|
| **API Server**    | `server.py`                 | FastAPI app, routing, CORS, startup init                  |
| **Chat Agent**    | `chat.py`                   | Tool-loop, Langfuse tracing, transcript writing           |
| **RAG Engine**    | `rag_engine.py`             | Pipeline lifecycle: load, chunk, embed, index, search     |
| **RAG Eval**      | `rag_eval.py`               | Retrieval metrics + LLM-as-judge generation eval          |
| **Providers**     | `providers/`                | Multi-provider abstraction (OpenAI, Gemini, Anthropic...) |
| **Tools**         | `tools/`                    | Function-calling tools (rag_search, clarify)              |
| **RAG Core**      | `rag/`                      | Chunking, embeddings, vector store, agent                 |
| **Versioning**    | `versioning.py`             | Artifact version tracking (prompt hash + tools hash)      |
| **Artifacts**     | `artifacts/`                | System prompt, tools declaration, guardrails              |
| **Env Loader**    | `env_loader.py`             | .env file loading                                         |
