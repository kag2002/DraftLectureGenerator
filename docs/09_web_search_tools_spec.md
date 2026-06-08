# 🌐 Spec: Web Search & External Tools — LectureGenerator Chatbot

> **Nguồn tham chiếu:** Day04 — Research Agent Tool Eval (`starter_v0/tools/`)

## 1. Tổng quan

Ngoài RAG pipeline (tra cứu tài liệu nội bộ), LectureGenerator Chatbot mở rộng khả năng với **web search tools** từ Day04 Research Agent. Điều này cho phép chatbot:

1. **Tra cứu thông tin mới nhất** trên internet (lookup)
2. **Đọc nội dung URL** cụ thể (fetch)
3. **Tìm bài báo khoa học** trên arXiv (papers, paper_text)
4. **Tìm trên mạng xã hội** — tweets/posts liên quan (social_search, timeline)
5. **Tra cứu nội bộ** — company policy/knowledge base (policy)
6. **Format kết quả** — tổng hợp thành markdown (format)
7. **Hành động** — gửi nội dung lên Telegram (send)

---

## 2. Tool Architecture từ Day04

### 2.1 Tool Folder Contract

Mỗi tool nằm trong thư mục riêng, tuân theo contract:

```
tools/<tool_name>/
├── TOOL.md      # Frontmatter + human notes
└── tool.py      # Self-contained implementation
```

**TOOL.md Frontmatter:**
```yaml
---
name: tool_name
track: core | bonus
kind: live_api | local_formatter | local_knowledge | action | control
provider: Provider name if any
requires_env: [ENV_VAR]
inputs: [arg_name]
outputs: [field_name]
side_effect: false | true | local_file_write
requires_confirmation: true   # only for write/action tools
---
```

### 2.2 Tool Registry

```python
# tools/__init__.py
TOOL_FUNCTIONS = {
    # Core tools (Day7 RAG)
    "clarify":        ask_user,
    "rag_search":     rag_search,
    
    # Web Search tools (Day04)
    "lookup":         web_search,          # Tavily web search
    "fetch":          read_url,            # Firecrawl URL scraping
    
    # Academic tools (Day04 bonus)
    "papers":         arxiv_search,        # arXiv paper search
    "paper_text":     get_arxiv_paper_text, # arXiv PDF extraction
    
    # Social tools (Day04)
    "social_search":  search_tweets,       # Twitter search
    "timeline":       get_user_tweets,     # Twitter timeline
    
    # Local knowledge (Day04)
    "policy":         search_company_policy, # Internal docs search
    
    # Formatting (Day04)
    "format":         render_digest,       # Markdown formatter
    
    # Action (Day04 bonus)
    "send":           send_telegram,       # Telegram posting
}
```

### 2.3 Shared Utilities

```python
# tools/_shared.py
ROOT = Path(__file__).resolve().parents[1]
TIMEOUT = 30  # Default timeout for API calls

def err(tool: str, exc: Exception) -> dict[str, Any]:
    """Standardized error response format."""
    return {"tool": tool, "error": type(exc).__name__, "message": str(exc)}

def domain(url: str) -> str:
    """Extract domain from URL."""

def fold_text(text: str) -> str:
    """Unicode normalize + lowercase for matching."""

def terms(text: str) -> set[str]:
    """Extract meaningful search terms, removing stopwords (EN + VN)."""
```

---

## 3. Chi tiết từng Tool

### 3.1 `lookup` — Web Search (Tavily API)

| Field | Value |
|-------|-------|
| **Kind** | `live_api` |
| **Provider** | Tavily |
| **Env** | `TAVILY_API_KEY` |
| **Free Tier** | 1,000 credits/month |

```python
def web_search(
    query: str = "",
    topic: str = "general",      # "general" | "news"
    timeframe: str | None = "week",  # "day" | "week" | "month" | "year"
    max_results: int = 5
) -> dict[str, Any]:
    """
    POST https://api.tavily.com/search
    
    Returns:
    {
        "tool": "web_search",
        "query": "...",
        "topic": "general",
        "timeframe": "week",
        "items": [
            {
                "title": "...",
                "url": "https://...",
                "source": "domain.com",
                "summary": "...",
                "score": 0.95
            }
        ]
    }
    """
```

**Áp dụng cho LectureGenerator:**
- Tìm thông tin bổ sung mới nhất về chủ đề bài giảng
- Tìm tin tức liên quan (`topic="news"`)
- Hỗ trợ filter theo khoảng thời gian

---

### 3.2 `fetch` — URL Content Reader (Firecrawl API)

| Field | Value |
|-------|-------|
| **Kind** | `live_api` |
| **Provider** | Firecrawl |
| **Env** | `FIRECRAWL_API_KEY` |
| **Free Tier** | 1,000 credits/month |

```python
def read_url(url: str = "") -> dict[str, Any]:
    """
    POST https://api.firecrawl.dev/v1/scrape
    Body: {"url": url, "formats": ["markdown"]}
    
    Returns markdown content (truncated to 4000 chars).
    
    Returns:
    {
        "tool": "read_url",
        "url": "...",
        "items": [{
            "title": "Page Title",
            "url": "...",
            "source": "domain.com",
            "summary": "<markdown content>"
        }]
    }
    """
```

**Áp dụng cho LectureGenerator:**
- Đọc nội dung từ URL tài liệu tham khảo
- Scrape nội dung bài viết, blog, wiki cho bài giảng
- Parse nội dung web thành markdown sạch

---

### 3.3 `papers` — arXiv Paper Search

| Field | Value |
|-------|-------|
| **Kind** | `live_api` |
| **Provider** | arXiv (free) |
| **Env** | `ARXIV_USER_AGENT` (optional) |
| **Rate Limit** | 3 seconds between requests |

```python
def arxiv_search(
    query: str = "",
    max_results: int = 5,
    sort_by: str = "relevance"  # "relevance" | "lastUpdatedDate" | "submittedDate"
) -> dict[str, Any]:
    """
    GET https://export.arxiv.org/api/query
    
    Features:
    - Auto query building: "AI agent" → "all:AI AND all:agent"
    - Rate limiting (3s between requests)
    - Retry on HTTP 429
    
    Returns:
    {
        "tool": "arxiv_search",
        "query": "...",
        "items": [{
            "arxiv_id": "2301.12345",
            "title": "Paper Title",
            "summary": "Abstract...",
            "authors": ["Author 1", "Author 2"],
            "published": "2023-01-15T...",
            "url": "https://arxiv.org/abs/...",
            "pdf_url": "https://arxiv.org/pdf/...",
            "source": "arxiv.org",
            "primary_category": "cs.AI",
            "categories": ["cs.AI", "cs.CL"]
        }]
    }
    """
```

**Áp dụng cho LectureGenerator:**
- Tìm bài báo khoa học liên quan đến chủ đề bài giảng
- Bổ sung nguồn tham khảo academic
- Sort theo thời gian để lấy nghiên cứu mới nhất

---

### 3.4 `paper_text` — arXiv PDF Text Extraction

| Field | Value |
|-------|-------|
| **Kind** | `live_api` + `local_file_write` |
| **Provider** | arXiv (free) |
| **Dependency** | `pypdf` |

```python
def get_arxiv_paper_text(
    arxiv_url: str = "",
    max_pages: int = 5,
    max_chars: int = 8000
) -> dict[str, Any]:
    """
    1. Download PDF from arXiv
    2. Extract text using pypdf
    3. Save PDF + TXT locally (arxiv_papers/)
    4. Return truncated text
    
    Returns:
    {
        "tool": "get_arxiv_paper_text",
        "arxiv_id": "2301.12345",
        "page_count": 12,
        "pages_read": 5,
        "chars_returned": 8000,
        "items": [{
            "title": "arXiv paper 2301.12345",
            "url": "https://arxiv.org/abs/...",
            "source": "arxiv.org",
            "summary": "<extracted text>"
        }]
    }
    """
```

---

### 3.5 `social_search` — Twitter/X Search

| Field | Value |
|-------|-------|
| **Kind** | `live_api` |
| **Provider** | RapidAPI (Twitter API45) |
| **Env** | `RAPIDAPI_KEY`, `RAPIDAPI_TWITTER_HOST` |

```python
def search_tweets(
    query: str = "",
    search_type: str = "Latest",  # "Latest" | "Top"
    limit: int = 5
) -> dict[str, Any]:
    """
    GET https://{host}/search.php?query=...
    
    Returns:
    {
        "tool": "search_tweets",
        "query": "...",
        "items": [{
            "title": "Tweet text (120 chars)...",
            "summary": "Full tweet text",
            "url": "https://x.com/user/status/...",
            "source": "@username",
            "date": "2026-06-05...",
            "metrics": {"favorites": 100, "retweets": 20, "views": 5000}
        }]
    }
    """
```

---

### 3.6 `timeline` — User Tweet Timeline

```python
def get_user_tweets(
    screenname: str = "",
    limit: int = 5
) -> dict[str, Any]:
    """Lấy bài đăng gần nhất của 1 tài khoản Twitter/X."""
```

---

### 3.7 `policy` — Internal Knowledge Base Search

| Field | Value |
|-------|-------|
| **Kind** | `local_knowledge` |
| **Provider** | Local markdown files |
| **No API key** | Reads from `company_policy/*.md` |

```python
def search_company_policy(
    query: str = "",
    policy_area: str = "all",
    top_k: int = 3
) -> dict[str, Any]:
    """
    Local BM25-like search:
    1. Parse markdown docs with YAML frontmatter
    2. Split into sections (## headings)
    3. Term matching with weighted scores
    4. Trust boundary: filter suspicious/injection content
    
    Features:
    - Frontmatter metadata (tags, policy_area, effective_date)
    - Section-level granularity
    - Untrusted content filtering (prompt injection defense)
    """
```

**Áp dụng cho LectureGenerator:**
- Thay `company_policy/` bằng `lecture_materials/`
- Dùng như **local knowledge search** bổ sung cho ChromaDB RAG
- Hỗ trợ tìm theo category/area

---

### 3.8 `format` — Markdown Digest Formatter

| Field | Value |
|-------|-------|
| **Kind** | `local_formatter` |
| **No API** | Pure local logic |

```python
def render_digest(
    items: list[dict] | None = None,
    template: str = "sections",   # "brief" | "sections" | "bullets" | "thread" | "daily_ai_vn"
    headline: str = ""
) -> dict[str, Any]:
    """
    Format list of items thành markdown đẹp.
    Hỗ trợ nhiều template cho khác nhau use cases.
    """
```

---

### 3.9 `send` — Telegram Action Tool

| Field | Value |
|-------|-------|
| **Kind** | `action` |
| **Provider** | Telegram Bot API |
| **Env** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| **requires_confirmation** | `true` |

```python
def send_telegram(text: str = "", confirmed: bool = False) -> dict[str, Any]:
    """
    GUARDRAIL: Chỉ gửi khi confirmed=True.
    Nếu confirmed=False → return status="needs_confirmation"
    → Agent PHẢI hỏi user trước khi gửi.
    """
```

---

## 4. Standardized Output Format

Tất cả tools từ Day04 đều trả về format thống nhất:

```python
{
    "tool": str,           # Tool name
    "query": str,          # Input query (if applicable)
    "items": [             # List of results
        {
            "title": str,      # Result title
            "url": str,        # Source URL
            "source": str,     # Source domain/name
            "summary": str,    # Content/description
            # ... tool-specific fields
        }
    ],
    # ... tool-specific metadata
}
```

**Error format:**
```python
{
    "tool": str,
    "error": str,           # Exception class name
    "message": str           # Error message
}
```

---

## 5. Tool Routing Strategy cho LectureGenerator

### 5.1 Decision Tree

```
User Question
     │
     ├── Liên quan đến bài giảng/tài liệu nội bộ?
     │   └── YES → rag_search (RAG, Day7)
     │
     ├── Cần thông tin mới nhất / tin tức?
     │   └── YES → lookup (Tavily, Day04)
     │
     ├── User cung cấp URL cụ thể?
     │   └── YES → fetch (Firecrawl, Day04)
     │
     ├── Cần bài báo khoa học?
     │   ├── Tìm papers → papers (arXiv)
     │   └── Đọc nội dung paper → paper_text (arXiv PDF)
     │
     ├── Cần thông tin từ Twitter/X?
     │   ├── Tìm theo keyword → social_search
     │   └── Xem timeline user → timeline
     │
     ├── Hỏi về chính sách/quy định nội bộ?
     │   └── YES → policy (local markdown)
     │
     ├── Cần format/tổng hợp kết quả?
     │   └── YES → format (local formatter)
     │
     ├── Cần gửi/đăng nội dung?
     │   └── YES → send (Telegram, cần confirmation!)
     │
     ├── Câu hỏi quá mơ hồ?
     │   └── YES → clarify (hỏi lại user)
     │
     └── Ngoài scope?
         └── Trả lời: "Ngoài phạm vi hỗ trợ"
```

### 5.2 Priority: RAG First, Web Second

```
1. rag_search  ← LUÔN thử RAG trước (tài liệu bài giảng)
2. lookup      ← Nếu RAG không đủ, tra cứu web bổ sung
3. papers      ← Nếu cần nguồn academic
4. fetch       ← Nếu user chỉ URL cụ thể
5. clarify     ← Nếu cần thêm thông tin
```

---

## 6. Tích hợp vào System Prompt

Thêm vào `artifacts/system_prompt.md`:

```markdown
## 🛠️ HƯỚNG DẪN SỬ DỤNG CÔNG CỤ

### Tra cứu nội bộ (ưu tiên cao nhất)
- `rag_search` — Tra cứu tài liệu bài giảng. BẮT BUỘC gọi trước khi trả lời.
- `policy` — Tra cứu tài liệu nội bộ/chính sách.

### Tra cứu bên ngoài (khi nội bộ không đủ)
- `lookup` — Tìm trên web. Dùng topic="news" cho tin tức, topic="general" cho tra cứu chung.
- `fetch` — Đọc nội dung URL cụ thể.
- `papers` — Tìm bài báo khoa học trên arXiv.
- `paper_text` — Đọc nội dung chi tiết paper (cần arxiv_id từ kết quả papers).

### Mạng xã hội
- `social_search` — Tìm bài đăng theo keyword.
- `timeline` — Xem bài đăng gần đây của tài khoản cụ thể.

### Hỗ trợ
- `clarify` — Hỏi lại khi câu hỏi mơ hồ.
- `format` — Tổng hợp kết quả thành markdown đẹp.

### Hành động (CẦN XÁC NHẬN)
- `send` — Gửi nội dung. PHẢI hỏi xác nhận trước (confirmed=false trước).
```

---

## 7. Tích hợp vào tools.yaml

Thêm các tool declarations vào `artifacts/tools.yaml`:

```yaml
tools:
  # === RAG Tools (Day7) ===
  - name: rag_search
    description: "Tra cứu tài liệu bài giảng..."
    # ...

  - name: clarify
    description: "Yêu cầu người dùng cung cấp thêm thông tin..."
    # ...

  # === Web Search Tools (Day04) ===
  - name: lookup
    description: "Tra cứu thông tin trên internet (web search)."
    parameters:
      type: object
      properties:
        query: {type: string, description: "Truy vấn tìm kiếm"}
        topic: {type: string, enum: [general, news], default: "general"}
        timeframe: {type: string, enum: [day, week, month, year], default: "week"}
        max_results: {type: integer, default: 5}
      required: [query]

  - name: fetch
    description: "Đọc nội dung từ một URL cụ thể."
    parameters:
      type: object
      properties:
        url: {type: string, description: "URL cần đọc"}
      required: [url]

  # === Academic Tools ===
  - name: papers
    description: "Tìm bài báo khoa học trên arXiv."
    parameters:
      type: object
      properties:
        query: {type: string, description: "Từ khóa tìm kiếm"}
        max_results: {type: integer, default: 5}
        sort_by: {type: string, enum: [relevance, lastUpdatedDate, submittedDate], default: "relevance"}
      required: [query]

  - name: paper_text
    description: "Đọc nội dung text từ paper arXiv."
    parameters:
      type: object
      properties:
        arxiv_url: {type: string, description: "arXiv ID hoặc URL"}
        max_pages: {type: integer, default: 5}
        max_chars: {type: integer, default: 8000}
      required: [arxiv_url]

  # === Social & Action Tools ===
  - name: social_search
    description: "Tìm bài đăng trên mạng xã hội (Twitter/X)."
    # ...

  - name: format
    description: "Trình bày kết quả thành markdown đẹp."
    # ...

  - name: send
    description: "Gửi nội dung lên Telegram. Chỉ gửi khi confirmed=true."
    # ...
```

---

## 8. Environment Variables bổ sung

```env
# Web Search (Tavily)
TAVILY_API_KEY=tvly-...

# URL Scraping (Firecrawl)
FIRECRAWL_API_KEY=fc-...

# Social Media (RapidAPI Twitter)
RAPIDAPI_KEY=...
RAPIDAPI_TWITTER_HOST=twitter-api45.p.rapidapi.com

# Academic (arXiv - optional)
ARXIV_USER_AGENT=LectureGenerator/1.0 (G02-Team023)

# Action (Telegram - optional)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

---

## 9. Eval mở rộng cho Web Tools

### 9.1 Tool Routing Eval (Day04 pattern)

Ngoài RAG eval (Day7), thêm **tool routing eval** từ Day04:

```python
# run_eval.py — đánh giá LLM chọn đúng tool chưa
def evaluate_phase_b(case, tool_calls, text):
    """
    Metrics:
    - routing_correct: LLM gọi đúng tool?
    - args_correct: Arguments đúng?
    - no_tool check: Trường hợp không cần tool?
    """
```

### 9.2 Eval Case Format (Day04)

```json
{
  "cases": [
    {
      "id": "web_search_01",
      "phase": "B",
      "query": "Tin tức mới nhất về AI trong giáo dục",
      "failure_type": "wrong_tool",
      "expect": {
        "tool_calls": [
          {"name": "lookup", "args": {"topic": "news"}}
        ]
      },
      "metadata": {
        "what_it_tests": "Agent dùng lookup với topic=news cho câu hỏi tin tức"
      }
    },
    {
      "id": "rag_first_01",
      "phase": "B",
      "query": "Giải thích khái niệm machine learning",
      "failure_type": "wrong_tool",
      "expect": {
        "tool_calls": [
          {"name": "rag_search", "args": {"query": "machine learning"}}
        ]
      },
      "metadata": {
        "what_it_tests": "Agent ưu tiên rag_search cho câu hỏi về bài giảng"
      }
    }
  ]
}
```

### 9.3 Failure Types

| Type | Mô tả |
|------|--------|
| `wrong_tool` | Gọi sai tool |
| `wrong_arg_value` | Đúng tool nhưng sai arguments |
| `wrong_boundary` | Không biết khi nào cần/không cần tool |
| `unnecessary_tool` | Gọi tool khi không cần |
| `out_of_scope` | Nên từ chối nhưng lại trả lời |
| `missing_info` | Nên hỏi clarify nhưng không hỏi |

---

## 10. Version Log (Evidence-Driven Optimization)

Từ Day04, áp dụng vòng lặp cải thiện liên tục:

```csv
version,author,changed_artifact,artifact_version,prompt_hash,tools_hash,reason,hypothesis,metric_before,metric_after,run_file
v0,team,baseline,v0+p...+t...,sha256...,sha256...,baseline run,N/A,0.45,N/A,runs/v0_base.json
v1,team,system_prompt.md,v1+p...+t...,sha256...,sha256...,routing sai cho web search,thêm routing rules,0.45,0.65,runs/v1_base.json
v2,team,tools.yaml,v2+p...+t...,sha256...,sha256...,args bị miss topic=news,cải thiện description,0.65,0.80,runs/v2_base.json
v3,team,system_prompt.md,v3+p...+t...,sha256...,sha256...,boundary sai rag vs web,thêm priority rules,0.80,0.90,runs/v3_base.json
```

---

## 11. Tóm tắt: Tool Catalog hoàn chỉnh

| # | Tool | Source | Kind | API | Mục đích |
|---|------|--------|------|-----|----------|
| 1 | `rag_search` | Day7 | `local_knowledge` | ChromaDB | Tra cứu tài liệu bài giảng |
| 2 | `clarify` | Day7+04 | `control` | — | Hỏi lại user |
| 3 | `lookup` | Day04 | `live_api` | Tavily | Web search |
| 4 | `fetch` | Day04 | `live_api` | Firecrawl | URL content reader |
| 5 | `papers` | Day04 | `live_api` | arXiv | Academic paper search |
| 6 | `paper_text` | Day04 | `live_api` | arXiv | PDF text extraction |
| 7 | `social_search` | Day04 | `live_api` | RapidAPI | Twitter search |
| 8 | `timeline` | Day04 | `live_api` | RapidAPI | User timeline |
| 9 | `policy` | Day04 | `local_knowledge` | — | Internal docs search |
| 10 | `format` | Day04 | `local_formatter` | — | Markdown formatter |
| 11 | `send` | Day04 | `action` | Telegram | Post to channel |
