# 📘 LectureGenerator Chatbot — Design Spec Index

> **Team:** G02-Team023  
> **Dự án:** AI Trợ Lý Thiết Kế Bài Giảng & Học Liệu Cho Giảng Viên (AI Lecture Assistant)  
> **Chủ đề:** Giáo dục Đại học — Thiết kế Khóa học (Higher Education — Course Design)  
> **Kiến trúc tham chiếu:** [first-aid-chatbot](../Day7/first-aid-chatbot/) + [Day04 Research Agent](../Day4/Day04-C401-Prompt-Engineering-Tool-Calling-Labs-student/)

---

## 📑 Danh sách tài liệu thiết kế

| #  | Tài liệu | Nội dung chính |
|----|-----------|----------------|
| 01 | [Kiến trúc Tổng quan](docs/01_architecture_overview.md) | Sơ đồ hệ thống, tech stack, modules, luồng xử lý chính |
| 02 | [RAG Pipeline Spec](docs/02_rag_pipeline_spec.md) | Document management, chunking, embeddings, vector store, search |
| 03 | [Monitoring Spec](docs/03_monitoring_spec.md) | Langfuse integration, traces, prompt registry, metrics, dashboard |
| 04 | [Evaluation Spec](docs/04_evaluation_spec.md) | Retrieval eval (P/R/MRR), generation eval (LLM-as-Judge), strategy comparison |
| 05 | [Guardrails Spec](docs/05_guardrails_spec.md) | 3-layer guardrails: prompt, tool, application |
| 06 | [Logging Spec](docs/06_logging_spec.md) | Transcripts, eval runs, versioning, log viewer API |
| 07 | [Chat Agent Spec](docs/07_chat_agent_spec.md) | Tool loop, provider abstraction, message protocol, CLI mode |
| 08 | [Project Structure](docs/08_project_structure.md) | File tree, implementation order, env vars, dependencies |
| 09 | [Web Search & External Tools](docs/09_web_search_tools_spec.md) | Tavily, Firecrawl, arXiv, Twitter tools từ Day04 |
| 10 | [Tool Routing Eval](docs/10_tool_routing_eval_spec.md) | Tool routing accuracy, argument matching, multi-turn eval, version log |
| 11 | [Thiết kế Chi tiết MVP](docs/11_mvp_design.md) | Phạm vi MVP 6 tuần, database schema, multi-tenancy RAG, web search agent, self-correction |
| 12 | [Tài liệu Nghiệp vụ BA](docs/12_ba_document.md) | Bối cảnh, stakeholders, epics & user stories, FR & NFR, failure modes & mitigations, KPIs |
| 13 | [Phản biện thiết kế & Kế hoạch Sprint](docs/13_sprint_plan_and_critique.md) | Phản biện kỹ thuật (SQLite, Self-Correction, Web Agent, context), lộ trình 6 tuần, RACI matrix |
| 14 | [Bảng Giám sát Thực thi](docs/14_execution_tracker.md) | Bảng theo dõi tiến độ chi tiết từng khâu (DoD, Task Owner, Verification Methods) |
| 15 | [Đặc tả UI/UX & Phản biện User](docs/15_uiux_spec_and_user_rebuttal.md) | Thiết kế tương tác panel/popover/gauge/telemetry và giải quyết chất vấn của GV |

---

## 🔑 Tính năng chính

### 🤖 RAG Chatbot
- Hỏi đáp dựa trên tài liệu bài giảng
- Tool-augmented LLM (rag_search + clarify + web tools)
- Multi-provider support (OpenAI, Gemini, Anthropic, OpenRouter)

### 📊 RAG Pipeline  
- 3 chunking strategies (fixed, sentence, recursive)
- 3 embedding backends (mock, local, OpenAI)
- ChromaDB vector store với in-memory fallback

### 🌐 Web Search & External Tools (Day04)
- **lookup** — Tavily web search (general/news, timeframe filter)
- **fetch** — Firecrawl URL content reader (markdown output)
- **papers** — arXiv academic paper search
- **paper_text** — arXiv PDF text extraction
- **social_search / timeline** — Twitter/X search & user timeline
- **policy** — Local knowledge base (BM25-like section search)
- **format** — Markdown digest formatter (5 templates)
- **send** — Telegram action tool (with confirmation guardrail)

### 📈 Monitoring & Observability
- Langfuse tracing (traces, generations, spans)
- Prompt Registry với version control
- Real-time metrics dashboard

### ✅ Evaluation (Dual System)
- **RAG Eval (Day7):** Precision@K, Recall@K, MRR, Faithfulness, Relevance
- **Tool Routing Eval (Day04):** Routing accuracy, argument accuracy, multi-turn accuracy
- Strategy comparison across chunking methods
- Evidence-driven optimization loop (version log + hypothesis testing)

### 🛡️ Guardrails
- System prompt constraints (topic boundary, RAG-first)
- Tool-level grounding (no hallucination)
- Application-level controls (max rounds, input validation)
- Action tool confirmation (`send` requires `confirmed=true`)

### 📝 Logging
- JSON transcript per session
- Eval run results with config snapshots
- Artifact versioning (prompt hash + tools hash)

---

## 🚀 Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
python server.py --provider openrouter --port 8001

# Frontend
cd frontend
npm install
npm run dev
```

---

## 📌 Bước tiếp theo

1. **Triển khai Backend** theo kế hoạch 6 tuần trong [Thiết kế Chi tiết MVP](docs/11_mvp_design.md) và [Project Structure](docs/08_project_structure.md):
   - Tạo DB Schema SQLite, cấu hình API FastAPI và JWT Auth.
   - Viết các parser cho Syllabus và tích hợp RAG cô lập (Multi-tenancy).
   - Xây dựng Agent Web Search và thuật toán Credibility Evaluator.
   - Thiết lập luồng Single-Agent Self-Correction cho sinh câu hỏi.

2. **Xây dựng Frontend Web App**:
   - Giao diện Dashboard quản lý môn học, danh sách CLO.
   - Giao diện Split-Screen Editor tích hợp Rich Text Editor.
   - Biểu đồ phân bổ độ phủ ma trận CLO - Bloom.

3. **Tích hợp Monitoring & Evaluation**:
   - Tích hợp Langfuse tracking và RAG Eval/Tool Routing Eval.
