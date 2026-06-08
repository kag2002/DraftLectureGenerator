# 🔧 Spec: Tool Routing Eval — LectureGenerator Chatbot

> **Nguồn tham chiếu:** Day04 — `run_eval.py` (Research Agent Tool Eval)

## 1. Tổng quan

Bổ sung hệ thống **Tool Routing Eval** từ Day04, đánh giá khả năng LLM chọn đúng tool và truyền đúng arguments. Khác với RAG Eval (Day7) đánh giá chất lượng retrieval, Tool Routing Eval đánh giá **quyết định** của LLM.

---

## 2. Hai hệ thống Eval song song

| Aspect | RAG Eval (Day7) | Tool Routing Eval (Day04) |
|--------|-----------------|--------------------------|
| **Đánh giá gì** | Chất lượng retrieval & generation | Chọn đúng tool & arguments |
| **Metrics** | Precision, Recall, MRR, Faithfulness | Routing accuracy, Arg accuracy |
| **Test Cases** | `eval_cases.json` | `eval_base.json`, `eval_group.json` |
| **Runner** | `rag_eval.py` | `run_eval.py` |
| **File** | `rag_eval.py` | `run_eval.py` |

---

## 3. Tool Routing Eval Architecture

### 3.1 Eval Case Format

```json
{
  "dataset_id": "lecture_generator_base",
  "dataset_role": "base_eval",
  "description": "Base evaluation cases for tool routing",
  "cases": [
    {
      "id": "routing_01",
      "phase": "B",
      "query": "Giải thích về deep learning theo bài giảng",
      "failure_type": "wrong_tool",
      "expect": {
        "tool_calls": [
          {"name": "rag_search", "args": {"query": "deep learning"}}
        ]
      },
      "metadata": {
        "what_it_tests": "Agent ưu tiên rag_search cho câu hỏi về nội dung bài giảng"
      }
    },
    {
      "id": "routing_02",
      "phase": "B",
      "query": "Tin tức mới nhất về GPT-5",
      "failure_type": "wrong_tool",
      "expect": {
        "tool_calls": [
          {"name": "lookup", "args": {"topic": "news"}}
        ]
      },
      "metadata": {
        "what_it_tests": "Agent dùng lookup với topic=news cho tin tức"
      }
    },
    {
      "id": "no_tool_01",
      "phase": "B",
      "query": "Xin chào, bạn khỏe không?",
      "failure_type": "unnecessary_tool",
      "expect": {
        "no_tool": true
      },
      "metadata": {
        "what_it_tests": "Agent không gọi tool cho câu hỏi xã giao"
      }
    },
    {
      "id": "multiturn_01",
      "phase": "B",
      "failure_type": "missing_info",
      "turns": [
        {"role": "user", "content": "Tìm paper về topic này"},
        {"role": "assistant", "content": "Bạn muốn tìm paper về topic cụ thể nào?"},
        {"role": "user", "content": "Về transformer architecture"}
      ],
      "expect": {
        "tool_calls": [
          {"name": "papers", "args": {"query": "transformer architecture"}}
        ]
      },
      "metadata": {
        "what_it_tests": "Agent xử lý multi-turn context đúng"
      }
    }
  ]
}
```

### 3.2 Failure Types

| Type | Mô tả | Ví dụ |
|------|--------|-------|
| `wrong_tool` | Chọn sai tool | Dùng `lookup` thay vì `rag_search` |
| `wrong_arg_value` | Đúng tool, sai arg | `lookup(topic="general")` thay vì `topic="news"` |
| `wrong_boundary` | Sai biên tool/no-tool | Gọi tool khi chỉ cần trả lời text |
| `unnecessary_tool` | Gọi tool không cần thiết | Gọi `rag_search` cho "xin chào" |
| `out_of_scope` | Trả lời ngoài scope | Chatbot trả lời câu hỏi y tế |
| `missing_info` | Thiếu clarify | Không hỏi lại khi câu hỏi mơ hồ |

---

## 4. Eval Runner

### 4.1 Core Logic

```python
# run_eval.py
def evaluate_phase_b(case, tool_calls, text) -> dict:
    """
    1. Nếu expect.no_tool → check không có tool_calls
    2. Nếu expect.tool_calls:
       a. Match từng expected call với actual calls (by name)
       b. So sánh arguments (subset match)
       c. Detect extra/missing calls
    """
    
    # Returns:
    {
        "passed": bool,
        "routing_correct": bool,       # Đúng tool?
        "args_correct": bool,           # Đúng arguments?
        "actual_tool_calls": [...],     # LLM thực tế gọi gì
        "actual_text": str,             # LLM text response
        "case_failure_type": str,       # Loại lỗi test case kiểm tra
        "observed_mismatch": str | None, # Lỗi thực tế quan sát được
        "failures": [str],             # Chi tiết failures
    }
```

### 4.2 Argument Matching

```python
def compare_subset(expected, actual) -> tuple[bool, list, int, int]:
    """
    So sánh subset: chỉ check các key có trong expected.
    - String: normalize (strip, lowercase)
    - List: sort rồi compare
    - missing_fields: subset check
    """

def best_arg_match(expected_args, actual_calls):
    """
    Khi có nhiều actual calls cùng tên tool,
    chọn call có arg match tốt nhất.
    """
```

### 4.3 Summary Metrics

```python
def summarize(results) -> dict:
    """
    {
        "total_cases": 20,
        "measured_cases": 18,        # Trừ provider errors
        "provider_error_cases": 2,
        "passed_cases": 15,
        "case_accuracy": 0.833,
        "tool_routing_accuracy": 0.889,
        "argument_accuracy": 0.833,
        "multiturn_accuracy": 0.750,  # Chỉ cho multi-turn cases
        "failure_counts": {"wrong_tool": 2, "wrong_arg_value": 1},
        "observed_mismatch_counts": {"missing_tool_call": 1, "wrong_arg_value": 2}
    }
    """
```

---

## 5. Multi-turn Eval

Day04 hỗ trợ đánh giá multi-turn conversations:

```python
def case_messages(case):
    if "turns" in case:
        # Format previous turns as context
        # Only answer latest turn
        return [{
            "role": "user",
            "content": (
                "Conversation context for a multi-turn eval.\n"
                "Use earlier turns only as context.\n"
                f"Earlier turns: ...\n"
                f"Latest user turn to answer now: {latest}"
            )
        }]
    else:
        return [{"role": "user", "content": case["query"]}]
```

---

## 6. Evidence-Driven Optimization Loop

```
   ┌───────────────┐
   │ Run Eval v0   │  ← Baseline
   │ (run_eval.py) │
   └───────┬───────┘
           │
   ┌───────▼───────┐
   │ Read run JSON  │  ← Phân tích failures
   │ - failures     │
   │ - observed_    │
   │   mismatch     │
   │ - actual_calls │
   └───────┬───────┘
           │
   ┌───────▼───────────────┐
   │ Đặt giả thuyết        │  ← "Agent gọi lookup thay vì rag_search
   │                        │     vì prompt thiếu routing rule"
   └───────┬───────────────┘
           │
   ┌───────▼───────────────┐
   │ Sửa MỘT thứ           │  ← system_prompt.md HOẶC tools.yaml
   │ (1 hypothesis/change)  │
   └───────┬───────────────┘
           │
   ┌───────▼───────┐
   │ Run Eval v1   │  ← So sánh metric trước/sau
   └───────┬───────┘
           │
   ┌───────▼───────┐
   │ Ghi version   │  ← version_log.csv
   │ log           │
   └───────┬───────┘
           │
           └──────── Lặp lại (v2, v3, ...)
```

---

## 7. Run Output Format

```json
{
  "run_id": "v1_B_base_openrouter_20260605T103000",
  "version": "v1",
  "artifact_version": "v1+p1a2b3c+t7f8g9h",
  "prompt_hash": "sha256...",
  "tools_hash": "sha256...",
  "phase": "B",
  "suite": "base",
  "provider": "openrouter",
  "model": "gemini-2.0-flash",
  "generated_at": "2026-06-05T10:30:00",
  "summary": {
    "total_cases": 15,
    "case_accuracy": 0.800,
    "tool_routing_accuracy": 0.867,
    "argument_accuracy": 0.800,
    "multiturn_accuracy": 0.750
  },
  "results": [
    {
      "id": "routing_01",
      "phase": "B",
      "input": "Giải thích về deep learning",
      "expect": {"tool_calls": [...]},
      "result": {
        "passed": true,
        "routing_correct": true,
        "args_correct": true,
        "actual_tool_calls": [...]
      },
      "tool_results": [...]
    }
  ]
}
```

---

## 8. CLI Usage

```bash
# Chạy baseline
python run_eval.py \
  --provider openrouter \
  --version v0 \
  --suite base \
  --eval-cases data/eval_base.json

# Chạy group eval (team cases)
python run_eval.py \
  --provider openrouter \
  --version v3 \
  --suite group \
  --eval-cases data/eval_group.json

# Output console:
# routing_01               PASS
# routing_02               FAIL  wrong_tool
# no_tool_01               PASS
# multiturn_01             FAIL  wrong_arg_value
#
# case_accuracy: 0.75
# tool_routing_accuracy: 0.75
# argument_accuracy: 0.50
#
# Artifact version: v0+p1a2b3c4d5e6+t7f8g9h0i1j2
# Saved: runs/v0_B_base_openrouter_20260605T103000.json
```

---

## 9. Tích hợp với RAG Eval Dashboard

Trên frontend, hiển thị cả 2 loại eval:

```
┌─────────────────────────────────────────────────────────┐
│                EVALUATION DASHBOARD                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  📊 RAG Retrieval Eval (Day7)                            │
│  Precision: 0.85 | Recall: 1.00 | MRR: 0.90             │
│                                                          │
│  📊 Tool Routing Eval (Day04)                            │
│  Case Accuracy: 0.80 | Routing: 0.87 | Args: 0.80       │
│  Multi-turn: 0.75                                        │
│                                                          │
│  📊 Generation Eval (Day7)                               │
│  Faithfulness: 4.2/5 | Relevance: 4.5/5                 │
│                                                          │
│  📋 Failure Analysis                                     │
│  ┌─────────────────┬───────┐                             │
│  │ wrong_tool      │   2   │                             │
│  │ wrong_arg_value │   1   │                             │
│  │ missing_info    │   1   │                             │
│  └─────────────────┴───────┘                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```
