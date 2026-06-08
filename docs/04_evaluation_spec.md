# ✅ Spec: Evaluation System — LectureGenerator Chatbot

## 1. Tổng quan

Hệ thống evaluation đánh giá chất lượng RAG pipeline trên 2 khía cạnh:
1. **Retrieval Evaluation** — Khả năng tìm đúng document
2. **Generation Evaluation** — Chất lượng câu trả lời từ LLM (LLM-as-Judge)

---

## 2. Test Cases Format

**File:** `data/eval_cases.json`

```json
[
  {
    "id": "case_1",
    "question": "Câu hỏi mẫu về chủ đề bài giảng?",
    "expected_doc_id": "topic_01",
    "expected_keywords": ["keyword1", "keyword2", "keyword3"]
  }
]
```

| Field               | Type       | Mô tả                                              |
|---------------------|------------|-----------------------------------------------------|
| `id`                | `string`   | ID duy nhất cho test case                           |
| `question`          | `string`   | Câu hỏi đầu vào                                    |
| `expected_doc_id`   | `string`   | ID tài liệu mong muốn được retrieve                |
| `expected_keywords` | `string[]` | Các từ khoá kỳ vọng xuất hiện trong câu trả lời    |

---

## 3. Retrieval Evaluation

### 3.1 Metrics

| Metric         | Công thức                                          | Ý nghĩa                                    |
|----------------|----------------------------------------------------|--------------------------------------------|
| **Precision@K** | `hits / K`                                        | Tỉ lệ chunks đúng trong top-K             |
| **Recall@K**    | `1.0 if hits > 0 else 0.0`                       | Có tìm đúng document không (binary)        |
| **MRR**         | `1 / (rank_of_first_hit)`                         | Vị trí kết quả đúng đầu tiên              |
| **Latency**     | `end_time - start_time` (ms)                      | Thời gian search                            |

### 3.2 Implementation

```python
class RAGEvaluator:
    def evaluate_retrieval(self, rag_engine, top_k=3) -> dict:
        """
        Với mỗi test case:
        1. Gọi rag_engine.search(question, top_k)
        2. Kiểm tra doc_id trong results có match expected_doc_id
        3. Tính precision, recall, MRR, latency
        4. Trả về trung bình tất cả cases
        """
```

**Document matching logic:**
```python
# Hỗ trợ match cả chunk IDs
is_match = (
    doc_id == expected_doc 
    or doc_id.startswith(f"{expected_doc}_chunk_")
    or doc_id.startswith(f"{expected_doc}_")
)
```

---

## 4. Generation Evaluation (LLM-as-Judge)

### 4.1 Metrics

| Metric            | Scale | Mô tả                                                      |
|-------------------|-------|-------------------------------------------------------------|
| **Faithfulness**  | 0-5   | Câu trả lời có trung thực với tài liệu nguồn không         |
| **Relevance**     | 0-5   | Câu trả lời có đúng trọng tâm câu hỏi không               |

### 4.2 LLM-as-Judge Prompts

**Faithfulness Judge:**
```
Bạn là giám khảo. Hãy chấm điểm mức độ trung thực (Faithfulness) 
của câu trả lời dựa trên tài liệu cung cấp.
Chỉ chấm điểm 0 đến 5.

Tài liệu: {context}
Câu hỏi: {question}
Câu trả lời: {answer}

Hãy trả về duy nhất điểm số dưới dạng số nguyên.
```

**Relevance Judge:**
```
Bạn là giám khảo. Hãy chấm điểm mức độ liên quan (Relevance) 
của câu trả lời đối với câu hỏi.
Chỉ chấm điểm 0 đến 5.

Câu hỏi: {question}
Câu trả lời: {answer}

Hãy trả về duy nhất điểm số dưới dạng số nguyên.
```

### 4.3 Implementation

```python
class RAGEvaluator:
    def evaluate_generation(self, rag_engine, llm_fn, top_k=3) -> dict:
        """
        Với mỗi test case (giới hạn 3 cases để tiết kiệm API cost):
        1. Gọi KnowledgeBaseAgent.answer_with_sources(question)
        2. Đánh giá faithfulness qua LLM-as-judge
        3. Đánh giá relevance qua LLM-as-judge
        4. Trả về trung bình
        """
```

---

## 5. Strategy Comparison

So sánh hiệu quả các chunking strategies trên cùng dataset:

```python
def run_strategy_comparison(self, rag_engine) -> dict:
    """
    1. Lưu config hiện tại
    2. Với mỗi strategy in [fixed, sentence, recursive]:
       a. Thay đổi config
       b. Re-init pipeline + reindex
       c. Chạy evaluate_retrieval
       d. Thu thập metrics
    3. Khôi phục config gốc
    4. Trả về comparison results
    """
```

**Output format:**
```json
{
  "fixed": {
    "chunk_count": 25,
    "indexing_time_ms": 120.5,
    "avg_precision": 0.67,
    "avg_recall": 1.0,
    "avg_mrr": 0.80,
    "avg_latency_ms": 5.2
  },
  "sentence": { ... },
  "recursive": { ... }
}
```

---

## 6. Evaluation Run Storage

Mỗi lần chạy eval → lưu kết quả vào `runs/`:

```json
// runs/rag_eval_20260605T173208.json
{
  "run_id": "rag_eval_20260605T173208",
  "generated_at": "2026-06-05T17:32:08",
  "config": {
    "chunking_strategy": "recursive",
    "chunk_size": 500,
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
  "retrieval_details": [ ... ],
  "generation_details": [ ... ]
}
```

---

## 7. API Endpoints

| Method | Endpoint                    | Mô tả                                     |
|--------|-----------------------------|--------------------------------------------|
| `POST` | `/api/rag/eval`             | Chạy full eval (retrieval + generation)    |
| `GET`  | `/api/rag/eval/results`     | Liệt kê lịch sử eval runs                 |
| `POST` | `/api/rag/eval/compare`     | So sánh các chunking strategies            |
| `GET`  | `/api/monitoring/test-cases`| Xem test cases                             |

---

## 8. Eval Dashboard (Frontend)

```
┌─────────────────────────────────────────────────────┐
│                EVALUATION DASHBOARD                  │
├──────────────────────────────────────────────────────┤
│  [Run Evaluation]  [Compare Strategies]              │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📊 Latest Run Summary                               │
│  ┌──────────┬──────────┬──────────┬──────────┐      │
│  │Precision │  Recall  │   MRR    │ Latency  │      │
│  │  0.85    │   1.00   │  0.90    │  4.5ms   │      │
│  └──────────┴──────────┴──────────┴──────────┘      │
│                                                      │
│  📝 Generation Quality                               │
│  ┌──────────────────┬──────────────────┐            │
│  │  Faithfulness     │   Relevance      │            │
│  │  ████████░░ 4.2/5 │  █████████░ 4.5/5│            │
│  └──────────────────┴──────────────────┘            │
│                                                      │
│  📋 Case-by-Case Details (expandable table)          │
│  ┌─────┬────────────────┬─────┬────┬─────┐          │
│  │ ID  │ Question       │ P   │ R  │ MRR │          │
│  ├─────┼────────────────┼─────┼────┼─────┤          │
│  │ c_1 │ Câu hỏi 1...   │0.33 │1.0 │1.0  │          │
│  │ c_2 │ Câu hỏi 2...   │1.0  │1.0 │1.0  │          │
│  └─────┴────────────────┴─────┴────┴─────┘          │
│                                                      │
│  📈 Run History (timeline chart)                     │
│  ┌──────────────────────────────────────────┐       │
│  │  Precision trend across runs             │       │
│  │  ▃▅▆▇█ (improving over time)             │       │
│  └──────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────┘
```
