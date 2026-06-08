# 🤖 Spec: Chat Agent & Tool Loop — LectureGenerator Chatbot

## 1. Tổng quan

Chat Agent là thành phần trung tâm điều phối giữa user, LLM, và tools. Sử dụng mô hình **Tool-Augmented LLM Loop** — cho phép LLM tự quyết định khi nào cần gọi tool.

---

## 2. Tool Loop Architecture

```
                    ┌──────────────┐
                    │   User Input  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Inject System │
                    │    Prompt     │
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │                         │
              │   LLM Call (Round N)    │◄─────────────┐
              │   provider.complete()   │              │
              │                         │              │
              └────────┬───────────────┘              │
                       │                               │
              ┌────────▼───────────┐                  │
              │ Has tool_calls?    │                   │
              ├────────────────────┤                   │
              │  NO → Return text  │                   │
              │  YES ↓             │                   │
              └────────┬──────────┘                   │
                       │                               │
              ┌────────▼───────────┐                  │
              │ Execute each tool  │                   │
              │ ├── rag_search()   │                   │
              │ ├── clarify()      │                   │
              │ └── ...            │                   │
              └────────┬──────────┘                   │
                       │                               │
              ┌────────▼───────────┐                  │
              │ clarify called?    │                   │
              ├────────────────────┤                   │
              │ YES → Return       │                   │
              │   waiting_for_user │                   │
              │ NO ↓               │                   │
              └────────┬──────────┘                   │
                       │                               │
              ┌────────▼───────────┐                  │
              │ Round < max_rounds?│──── YES ──────────┘
              ├────────────────────┤
              │ NO → Return        │
              │   max_tool_rounds  │
              └────────────────────┘
```

---

## 3. Core Function: `run_model_tool_loop()`

```python
def run_model_tool_loop(
    *,
    provider: Provider,           # LLM provider instance
    messages: list[dict],         # Conversation messages
    tools: list[dict],            # OpenAI-format tool declarations
    model: str | None,            # Model name
    max_tool_rounds: int,         # Max iterations (default: 4)
    session_id: str | None,       # For Langfuse session grouping
    metadata: dict | None,        # Additional trace metadata
    prompt_obj: Any | None,       # Langfuse prompt object
) -> dict:
    """
    Returns:
    {
        "status": "answered" | "waiting_for_user" | "max_tool_rounds",
        "assistant_text": str,
        "rounds": list[dict],
        "tool_events": list[dict],
        "trace_id": str  # (if Langfuse enabled)
    }
    """
```

---

## 4. Tool Execution

### 4.1 Tool Registration

```python
# tools/__init__.py
TOOL_FUNCTIONS = {
    "clarify": ask_user,
    "rag_search": rag_search,
}
```

### 4.2 Tool Call Execution

```python
def execute_tool_call(call: ToolCall) -> dict:
    func = TOOL_FUNCTIONS.get(call.name)
    if not func:
        return {"error": "unknown_tool", "message": f"No implementation for {call.name}"}
    try:
        result = func(**call.args)
    except Exception as exc:
        result = {"error": type(exc).__name__, "message": str(exc)}
    return {"tool": call.name, "args": call.args, "result": result}
```

### 4.3 Tool Declarations (YAML)

```yaml
# artifacts/tools.yaml
tools:
  - name: rag_search
    description: "Tra cứu tài liệu bài giảng để tìm thông tin..."
    parameters:
      type: object
      properties:
        query:
          type: string
          description: "Câu hỏi hoặc từ khóa cần tra cứu"
        top_k:
          type: integer
          description: "Số kết quả (mặc định: 3)"
      required:
        - query

  - name: clarify
    description: "Yêu cầu người dùng cung cấp thêm thông tin..."
    parameters:
      type: object
      properties:
        question:
          type: string
          description: "Câu hỏi gửi tới người dùng"
        response_type:
          type: string
          enum: ["text", "yes_no"]
        options:
          type: array
          items:
            type: string
      required:
        - question
        - response_type
```

---

## 5. Message Protocol

### 5.1 Tool Results Message

Sau khi thực thi tools, kết quả được gửi lại cho LLM dưới dạng:

```python
def tool_results_message(events):
    return {
        "role": "user",
        "content": (
            "TOOL_RESULTS_JSON:\n"
            f"{json_text(events, max_chars=24000)}\n\n"
            "Hãy sử dụng kết quả tra cứu này để trả lời người dùng chi tiết, "
            "chính xác. Trả lời bằng tiếng Việt."
        )
    }
```

### 5.2 Assistant Tool Message

Khi LLM gọi tools, response được format:

```python
def assistant_tool_message(response_text, calls):
    return {
        "role": "assistant",
        "content": f"{response_text}\n\nTOOL_CALLS_JSON:\n{json_text(call_summary)}"
    }
```

---

## 6. LLM Provider Abstraction

### 6.1 Base Protocol

```python
# providers/base.py
@dataclass
class ToolCall:
    name: str
    args: dict[str, Any]

@dataclass
class ModelResponse:
    text: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw: Any | None = None

class Provider(Protocol):
    def complete(
        self, messages, tools=None, *, model=None, temperature=0.0, tool_choice=None
    ) -> ModelResponse: ...
```

### 6.2 Supported Providers

| Provider      | Class                | Default Model                              |
|---------------|---------------------|--------------------------------------------|
| `openrouter`  | `OpenRouterProvider` | Dùng OpenAI API format qua OpenRouter      |
| `openai`      | `OpenAIProvider`     | `gpt-4o-mini`                              |
| `anthropic`   | `AnthropicProvider`  | `claude-3-haiku`                           |
| `gemini`      | `GeminiProvider`     | `gemini-2.0-flash`                         |

### 6.3 Provider Factory

```python
# providers/__init__.py
def make_provider(name: str) -> Provider:
    if name == "openai":     return OpenAIProvider()
    if name == "openrouter":  return OpenRouterProvider()
    if name == "anthropic":   return AnthropicProvider()
    if name == "gemini":      return GeminiProvider()
    raise ValueError(f"Unknown provider: {name}")
```

---

## 7. Chat Endpoint (Server)

```python
# server.py
@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Flow:
    1. Load system prompt + tools dynamically
    2. Build provider
    3. Format history, inject system prompt
    4. Execute tool loop (run_model_tool_loop)
    5. Measure latency, estimate tokens
    6. Save transcript
    7. Return response
    """
```

### 7.1 Request/Response Schema

```python
class ChatRequest(BaseModel):
    messages: List[ChatMessage]     # Conversation history
    temperature: float = 0.0       # Sampling temperature [0, 2]
    max_tokens: int | None = None  # Optional token limit
    session_id: str | None = None  # Frontend session ID

class ChatResponse(BaseModel):
    reply: str                      # Assistant response
    model: str                      # Model used
    usage: ChatResponseUsage        # Token counts
    latency_ms: float               # Processing time
```

---

## 8. CLI Mode

Ngoài web server, chatbot cũng hỗ trợ chạy CLI:

```python
# chat.py main()
python chat.py --provider openrouter --version v1

# Interactive loop:
You> [câu hỏi]
[TOOL] rag_search({"query": "..."})
Agent> [câu trả lời]
Transcript saved: transcripts/v1_openrouter_20260605T103000.json
```

**CLI features:**
- Interactive REPL loop
- `/exit` hoặc `/quit` để thoát
- Tự động lưu transcript
- History window management
