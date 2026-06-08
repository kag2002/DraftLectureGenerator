# 📁 Spec: Project File Structure — LectureGenerator Chatbot

## 1. Cấu trúc thư mục hoàn chỉnh

```
G02-Team023-LectureGenerator/
│
├── docs/                                    # 📚 Tài liệu thiết kế & spec
│   ├── 01_architecture_overview.md          # Kiến trúc tổng quan
│   ├── 02_rag_pipeline_spec.md              # RAG pipeline spec
│   ├── 03_monitoring_spec.md                # Monitoring & observability
│   ├── 04_evaluation_spec.md                # Evaluation system
│   ├── 05_guardrails_spec.md                # Guardrails
│   ├── 06_logging_spec.md                   # Logging & transcripts
│   ├── 07_chat_agent_spec.md                # Chat agent & tool loop
│   └── 08_project_structure.md              # File này
│
├── backend/                                 # 🐍 Python Backend (FastAPI)
│   ├── .env                                 # Environment variables
│   ├── requirements.txt                     # Python dependencies
│   ├── server.py                            # FastAPI app + API routes
│   ├── chat.py                              # Chat agent + tool loop + Langfuse
│   ├── rag_engine.py                        # RAG pipeline orchestrator
│   ├── rag_eval.py                          # Evaluation module
│   ├── versioning.py                        # Artifact version tracking
│   ├── env_loader.py                        # .env file loader
│   │
│   ├── providers/                           # 🔌 LLM Provider Abstraction
│   │   ├── __init__.py                      # make_provider() factory
│   │   ├── base.py                          # Provider protocol + data classes
│   │   ├── openai_provider.py               # OpenAI API
│   │   ├── openrouter_provider.py           # OpenRouter API
│   │   ├── anthropic_provider.py            # Anthropic API
│   │   └── gemini_provider.py               # Google Gemini API
│   │
│   ├── rag/                                 # 📊 RAG Core Components
│   │   ├── __init__.py
│   │   ├── models.py                        # Document dataclass
│   │   ├── chunking.py                      # Chunking strategies
│   │   ├── embeddings.py                    # Embedding models
│   │   ├── store.py                         # Vector store (ChromaDB/in-memory)
│   │   └── agent.py                         # KnowledgeBaseAgent
│   │
│   ├── tools/                               # 🛠️ Agent Tools
│   │   ├── __init__.py                      # Tool registry + YAML loader
│   │   ├── _shared.py                       # Shared utilities (err, domain, terms)
│   │   ├── rag_search.py                    # RAG search tool (Day7)
│   │   ├── clarify.py                       # Clarify/ask_user tool (Day7+04)
│   │   ├── lookup/                          # Web search — Tavily (Day04)
│   │   │   ├── TOOL.md
│   │   │   └── tool.py
│   │   ├── fetch/                           # URL content reader — Firecrawl (Day04)
│   │   │   ├── TOOL.md
│   │   │   └── tool.py
│   │   ├── papers/                          # arXiv paper search (Day04)
│   │   │   ├── TOOL.md
│   │   │   └── tool.py
│   │   ├── paper_text/                      # arXiv PDF extraction (Day04)
│   │   │   ├── TOOL.md
│   │   │   └── tool.py
│   │   ├── social_search/                   # Twitter/X search (Day04)
│   │   │   ├── TOOL.md
│   │   │   └── tool.py
│   │   ├── timeline/                        # User timeline (Day04)
│   │   │   ├── TOOL.md
│   │   │   └── tool.py
│   │   ├── policy/                          # Internal docs search (Day04)
│   │   │   ├── TOOL.md
│   │   │   └── tool.py
│   │   ├── format/                          # Markdown formatter (Day04)
│   │   │   ├── TOOL.md
│   │   │   └── tool.py
│   │   └── send/                            # Telegram sender (Day04)
│   │       ├── TOOL.md
│   │       └── tool.py
│   │
│   ├── artifacts/                           # 📋 Versioned Configurations
│   │   ├── system_prompt.md                 # System prompt (guardrails)
│   │   ├── tools.yaml                       # Tool declarations
│   │   └── guardrails.yaml                  # Guardrails config (optional)
│   │
│   ├── data/                                # 📦 Data & Knowledge Base
│   │   ├── documents/                       # Source documents (.md files)
│   │   │   ├── topic_01.md
│   │   │   ├── topic_02.md
│   │   │   └── ...
│   │   ├── chroma_db/                       # ChromaDB persistent storage
│   │   └── eval_cases.json                  # Evaluation test cases
│   │
│   ├── transcripts/                         # 💬 Chat Session Logs
│   │   ├── web_session1.json
│   │   └── ...
│   │
│   └── runs/                                # 📈 Evaluation Run Results
│       ├── rag_eval_YYYYMMDDTHHMMSS.json
│       └── ...
│
├── frontend/                                # ⚛️ Next.js Frontend
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   │
│   └── src/
│       ├── app/                             # Next.js App Router pages
│       │   ├── layout.tsx                   # Root layout
│       │   ├── page.tsx                     # Home/Chat page
│       │   ├── monitoring/                  # Monitoring dashboard
│       │   ├── evaluation/                  # Eval dashboard
│       │   └── logs/                        # Log viewer
│       │
│       ├── components/                      # React components
│       │   ├── ChatWindow.tsx
│       │   ├── MessageBubble.tsx
│       │   ├── RAGConfigPanel.tsx
│       │   ├── EvalDashboard.tsx
│       │   ├── LogViewer.tsx
│       │   └── ...
│       │
│       ├── services/                        # API client services
│       │   └── api.ts
│       │
│       ├── hooks/                           # Custom React hooks
│       │   └── useChat.ts
│       │
│       ├── store/                           # State management
│       │   └── chatStore.ts
│       │
│       ├── types/                           # TypeScript types
│       │   └── index.ts
│       │
│       └── utils/                           # Utility functions
│           └── helpers.ts
│
└── .gitignore                               # Git ignore rules
```

---

## 2. Thứ tự Implementation gợi ý

### Phase 1: Core Backend
1. `env_loader.py` — Load environment
2. `providers/base.py` — Define interfaces
3. `providers/*.py` — Implement providers
4. `rag/models.py` — Data models
5. `rag/chunking.py` — Chunking strategies
6. `rag/embeddings.py` — Embedding models
7. `rag/store.py` — Vector store
8. `rag/agent.py` — KnowledgeBase agent
9. `rag_engine.py` — Pipeline orchestrator
10. `tools/` — Tool implementations

### Phase 2: Chat Agent
11. `versioning.py` — Artifact versioning
12. `artifacts/system_prompt.md` — System prompt
13. `artifacts/tools.yaml` — Tool declarations
14. `chat.py` — Agent loop + Langfuse
15. `server.py` — FastAPI server

### Phase 3: Evaluation
16. `data/eval_cases.json` — Test cases
17. `rag_eval.py` — Evaluation module

### Phase 4: Frontend
18. Initialize Next.js project
19. Build Chat UI
20. Build Monitoring dashboard
21. Build Eval dashboard
22. Build Log viewer

---

## 3. Environment Variables (.env)

```env
# LLM Providers
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AI...

# Langfuse Observability
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_HOST=http://localhost:3090

# Web Search (Day04 tools)
TAVILY_API_KEY=tvly-...       # lookup tool
FIRECRAWL_API_KEY=fc-...      # fetch tool
RAPIDAPI_KEY=...              # social_search, timeline tools
RAPIDAPI_TWITTER_HOST=twitter-api45.p.rapidapi.com

# Academic (optional)
ARXIV_USER_AGENT=LectureGenerator/1.0 (G02-Team023)

# Telegram Action (optional)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Optional
EMBEDDING_PROVIDER=mock       # mock | local | openai
DAY04_ENV_FILE=               # Path to external .env
```

---

## 4. Dependencies (requirements.txt)

```
openai>=1.0.0
anthropic>=0.34.0
google-genai>=0.8.0
requests>=2.31.0
PyYAML>=6.0
pypdf>=4.0.0
fastapi>=0.100.0
uvicorn>=0.22.0
pydantic>=2.0.0
langfuse>=2.0.0,<3.0.0
chromadb>=0.4.0
sentence-transformers>=2.2.0
```

---

## 5. Cách chạy

### Backend
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run server
python server.py --provider openrouter --port 8001

# Hoặc chạy CLI mode
python chat.py --provider openrouter --version v1
```

### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

### Eval
```bash
# Eval chạy qua API endpoint
curl -X POST http://localhost:8001/api/rag/eval
```
