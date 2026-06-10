import os
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

import chromadb
from chromadb.utils import embedding_functions
import re

# Khởi tạo ChromaDB persistent storage trong thư mục backend/data/chroma_db
DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/chroma_db"))
os.makedirs(DB_DIR, exist_ok=True)

chroma_client = chromadb.PersistentClient(path=DB_DIR)

class LazySentenceTransformerEmbeddingFunction(chromadb.EmbeddingFunction):
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._func = None

    @staticmethod
    def name() -> str:
        return "sentence_transformer"

    def get_config(self) -> dict:
        return {
            "model_name": self.model_name,
            "device": "cpu",
            "normalize_embeddings": False,
            "kwargs": {},
        }

    @staticmethod
    def build_from_config(config: dict) -> "LazySentenceTransformerEmbeddingFunction":
        return LazySentenceTransformerEmbeddingFunction(
            model_name=config.get("model_name", "all-MiniLM-L6-v2")
        )

    def __call__(self, input: chromadb.Documents) -> chromadb.Embeddings:
        if self._func is None:
            if os.environ.get("TESTING") == "1":
                print("[INFO] Testing mode detected: Using Mock Embedding Function.")
                class MockEmbeddingFunction(chromadb.EmbeddingFunction):
                    def __call__(self, input: chromadb.Documents) -> chromadb.Embeddings:
                        return [[0.1] * 384 for _ in input]
                self._func = MockEmbeddingFunction()
            else:
                try:
                    # Sử dụng SentenceTransformer cục bộ (384 dimensions, rất nhanh và nhẹ)
                    self._func = embedding_functions.SentenceTransformerEmbeddingFunction(
                        model_name=self.model_name
                    )
                    print("[SUCCESS] Da load SentenceTransformer embedding function thanh cong.")
                except Exception as e:
                    # Fallback sang Mock Embedding nếu thiếu torch/Transformers hoặc chạy offline lần đầu
                    print(f"[WARNING] Khong the load SentenceTransformer ({e}). Su dung Mock Embedding Function cho MVP.")
                    class MockEmbeddingFunction(chromadb.EmbeddingFunction):
                        def __call__(self, input: chromadb.Documents) -> chromadb.Embeddings:
                            # Sinh mảng float giả lập kích thước 384
                            return [[0.1] * 384 for _ in input]
                    self._func = MockEmbeddingFunction()
        return self._func(input)

embedding_func = LazySentenceTransformerEmbeddingFunction()

collection = chroma_client.get_or_create_collection(
    name="lecture_materials",
    embedding_function=embedding_func
)

def chunk_text_by_page(text: str, page_number: int, chunk_size: int = 800, overlap: int = 150) -> list[dict]:
    """Chia nhỏ văn bản của một trang tài liệu thành các chunks có overlap."""
    words = text.split()
    chunks = []
    
    if len(words) == 0:
        return chunks
        
    # Tính số từ tương đương chunk_size ký tự (trung bình 1 từ = 6 ký tự)
    word_chunk_size = chunk_size // 6
    word_overlap = overlap // 6
    
    i = 0
    chunk_index = 0
    while i < len(words):
        chunk_words = words[i:i + word_chunk_size]
        chunk_text = " ".join(chunk_words)
        chunks.append({
            "text": chunk_text,
            "page_number": page_number,
            "chunk_index": chunk_index
        })
        chunk_index += 1
        i += (word_chunk_size - word_overlap)
        if i >= len(words) or word_chunk_size >= len(words):
            break
            
    return chunks

def add_document_vector(file_name: str, text_by_pages: list[str], user_id: int, course_id: int):
    """
    Nạp toàn bộ tài liệu đã trích xuất theo trang vào ChromaDB.
    Đính kèm metadata cô lập người dùng.
    """
    all_chunks = []
    
    # 1. Thực hiện chunking từng trang
    for idx, page_text in enumerate(text_by_pages):
        page_num = idx + 1 # Số trang bắt đầu từ 1
        page_chunks = chunk_text_by_page(page_text, page_num)
        all_chunks.extend(page_chunks)
        
    if not all_chunks:
        return
        
    # 2. Chuẩn bị dữ liệu nạp
    ids = [f"usr_{user_id}_crs_{course_id}_file_{file_name}_c{i}" for i in range(len(all_chunks))]
    documents = [c["text"] for c in all_chunks]
    metadatas = [
        {
            "user_id": user_id,
            "course_id": course_id,
            "file_name": file_name,
            "page_number": c["page_number"]
        }
        for c in all_chunks
    ]
    
    # 3. Nạp vào ChromaDB
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    print(f"[INFO] Da nap thanh cong {len(all_chunks)} vector chunks tu file '{file_name}' (Course: {course_id}).")

def search_rag_isolated(query: str, user_id: int, course_id: int, top_k: int = 4) -> list[dict]:
    """
    Truy vấn RAG cô lập tuyệt đối dựa trên Metadata filtering.
    """
    try:
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
            where={
                "$and": [
                    {"user_id": {"$eq": user_id}},
                    {"course_id": {"$eq": course_id}}
                ]
            }
        )
        
        # Format lại kết quả trả về dạng danh sách dict dễ xử lý
        formatted_results = []
        if results and results["documents"] and len(results["documents"]) > 0:
            docs = results["documents"][0]
            metas = results["metadatas"][0]
            distances = results["distances"][0] if "distances" in results else [0.0] * len(docs)
            
            for i in range(len(docs)):
                formatted_results.append({
                    "text": docs[i],
                    "file_name": metas[i].get("file_name", "N/A"),
                    "page_number": metas[i].get("page_number", 0),
                    "score": 1.0 - distances[i] # Similarity Score
                })
        return formatted_results
    except Exception as e:
        print(f"[ERROR] Loi truy van RAG ChromaDB: {e}")
        return []

def delete_course_documents(user_id: int, course_id: int):
    """Xóa sạch toàn bộ tài liệu nguồn của môn học khỏi Vector DB."""
    try:
        collection.delete(
            where={
                "$and": [
                    {"user_id": {"$eq": user_id}},
                    {"course_id": {"$eq": course_id}}
                ]
            }
        )
        print(f"[INFO] Da xoa toan bo tai lieu cua Course {course_id} thuoc User {user_id} khoi ChromaDB.")
    except Exception as e:
        print(f"Loi khi xoa tai lieu ChromaDB: {e}")
