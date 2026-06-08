# 📡 Spec: RAG Pipeline — LectureGenerator Chatbot

## 1. Tổng quan

RAG (Retrieval-Augmented Generation) Pipeline là thành phần cốt lõi cho phép chatbot truy vấn kiến thức từ tài liệu bài giảng, trả lời chính xác dựa trên nguồn tài liệu thay vì "bịa" thông tin.

---

## 2. Các thành phần

### 2.1 Document Management

```
data/
├── documents/          # Tài liệu nguồn (.md files)
│   ├── topic_01.md
│   ├── topic_02.md
│   └── ...
├── chroma_db/          # ChromaDB persistent storage
└── eval_cases.json     # Test cases cho RAG evaluation
```

**API Endpoints:**

| Method   | Endpoint                       | Mô tả                                 |
|----------|--------------------------------|----------------------------------------|
| `GET`    | `/api/rag/documents`           | Liệt kê tài liệu đã indexed          |
| `POST`   | `/api/rag/documents`           | Thêm tài liệu mới và index            |
| `DELETE` | `/api/rag/documents/{doc_id}`  | Xoá tài liệu và chunks tương ứng      |
| `POST`   | `/api/rag/reindex`             | Rebuild toàn bộ vector store           |

---

### 2.2 Chunking Strategies

Hỗ trợ 3 chiến lược chia nhỏ văn bản:

| Strategy     | Class             | Mô tả                                              | Parameters                              |
|-------------|-------------------|-----------------------------------------------------|----------------------------------------|
| `fixed`     | `FixedSizeChunker` | Chia theo số ký tự cố định + overlap                | `chunk_size`, `chunk_overlap`          |
| `sentence`  | `SentenceChunker`  | Chia theo câu, gom nhóm N câu liên tiếp            | `max_sentences_per_chunk`              |
| `recursive` | `RecursiveChunker` | Chia đệ quy theo separator priority (`\n\n`, `.`)  | `chunk_size`                           |

**Mặc định:** `recursive` với `chunk_size=500`.

**File:** `rag/chunking.py`

```python
class FixedSizeChunker:
    def __init__(self, chunk_size=500, overlap=50): ...
    def chunk(self, text: str) -> list[str]: ...

class SentenceChunker:
    def __init__(self, max_sentences_per_chunk=3): ...
    def chunk(self, text: str) -> list[str]: ...

class RecursiveChunker:
    DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""]
    def __init__(self, separators=None, chunk_size=500): ...
    def chunk(self, text: str) -> list[str]: ...
```

---

### 2.3 Embedding Models

| Provider       | Class           | Model                      | Đặc điểm                        |
|---------------|-----------------|----------------------------|----------------------------------|
| `mock`        | `MockEmbedder`  | Deterministic hash-based   | Không cần GPU/API, dùng cho dev  |
| `local`       | `LocalEmbedder` | `all-MiniLM-L6-v2`        | SentenceTransformers, chạy local |
| `openai`      | `OpenAIEmbedder`| `text-embedding-3-small`   | API call, chất lượng cao         |

**File:** `rag/embeddings.py`

```python
class MockEmbedder:
    def __call__(self, text: str) -> list[float]: ...

class LocalEmbedder:
    def __call__(self, text: str) -> list[float]: ...

class OpenAIEmbedder:
    def __call__(self, text: str) -> list[float]: ...
```

---

### 2.4 Vector Store

**File:** `rag/store.py`

```python
class EmbeddingStore:
    """
    Dual-backend: ChromaDB (persistent) hoặc in-memory fallback.
    """
    def __init__(self, collection_name, embedding_fn, persist_directory): ...
    def add_documents(self, docs: list[Document]) -> None: ...
    def search(self, query: str, top_k=5) -> list[dict]: ...
    def search_with_filter(self, query, top_k=3, metadata_filter=None) -> list[dict]: ...
    def delete_document(self, doc_id: str) -> bool: ...
    def reset(self) -> None: ...
    def get_collection_size(self) -> int: ...
```

**Tính năng:**
- Auto-fallback sang in-memory nếu ChromaDB không khả dụng
- Hỗ trợ metadata filtering
- Cosine similarity scoring

---

### 2.5 RAG Engine (Orchestrator)

**File:** `rag_engine.py`

```python
class RAGEngine:
    """
    Quản lý toàn bộ lifecycle của RAG pipeline:
    - Load documents → Chunk → Embed → Index
    - Search (query → top-K results)
    - Config management & hot-reload
    - Metrics tracking
    """
    def __init__(self, data_dir, db_dir): ...
    def init_pipeline(self) -> None: ...           # Khởi tạo embedder + store
    def update_config(self, new_config) -> bool: ... # Update config, auto-reindex nếu cần
    def search(self, query, top_k=None): ...        # Tìm kiếm với latency tracking
    def reindex(self) -> dict: ...                   # Rebuild toàn bộ
    def add_document(self, doc_id, filename, content): ...
    def delete_document(self, doc_id) -> bool: ...
    def get_status(self) -> dict: ...                # Collection size, timing metrics
    def get_indexed_documents(self) -> list: ...
```

**Config mặc định:**
```python
config = {
    "chunking_strategy": "recursive",
    "chunk_size": 500,
    "chunk_overlap": 50,
    "max_sentences_per_chunk": 3,
    "embedding_provider": "mock",
    "top_k": 3,
}
```

**API Endpoints:**

| Method | Endpoint            | Mô tả                                |
|--------|---------------------|---------------------------------------|
| `GET`  | `/api/rag/status`   | Trạng thái vector store               |
| `GET`  | `/api/rag/config`   | Cấu hình hiện tại                     |
| `POST` | `/api/rag/config`   | Cập nhật cấu hình (auto-reindex)     |
| `POST` | `/api/rag/search`   | Test search endpoint                  |
| `POST` | `/api/rag/reindex`  | Rebuild database                      |

---

### 2.6 Knowledge Base Agent

**File:** `rag/agent.py`

```python
class KnowledgeBaseAgent:
    """
    RAG pattern: Retrieve → Build prompt → Generate answer
    """
    def __init__(self, store, llm_fn): ...
    def answer(self, question, top_k=3) -> str: ...
    def answer_with_sources(self, question, top_k=3) -> tuple[str, list[dict]]: ...
```

---

## 3. Data Model

```python
@dataclass
class Document:
    id: str          # Unique identifier (e.g. "topic_01")
    content: str     # Raw text
    metadata: dict   # {"doc_id": ..., "filename": ..., "chunk_index": ...}
```

---

## 4. Luồng Indexing

```
Documents (*.md files)
      │
      ▼
  Chunker (fixed/sentence/recursive)
      │
      ▼
  List[Document] with metadata
      │
      ▼
  EmbeddingStore.add_documents()
      │
      ├── ChromaDB: collection.add(ids, documents, embeddings, metadatas)
      └── In-memory: append to self._store
```

---

## 5. Luồng Search

```
User Query
    │
    ▼
EmbeddingStore.search(query, top_k)
    │
    ├── Embed query → query_embedding
    ├── ChromaDB: collection.query(query_embeddings, n_results)
    │   └── Tính cosine similarity → sort
    └── In-memory: dot product với tất cả stored embeddings → sort
    │
    ▼
Top-K results [{id, content, metadata, score}, ...]
```
