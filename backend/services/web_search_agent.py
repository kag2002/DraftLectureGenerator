from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import os
import requests
import re
from backend.database.session import get_db
from backend.database.models import Course, User
from backend.auth import get_current_user
from backend.database.vector_db import add_document_vector
from backend.utils.llm_client import call_llm_json

router = APIRouter(prefix="/api/courses", tags=["web_search"])

# Pydantic Schemas
class WebSearchRequest(BaseModel):
    query: str = Field(..., example="Cây nhị phân AVL tự cân bằng")
    max_results: int | None = 10
    threshold: float | None = 0.7

# --- CORE SERVICES: WEB SEARCH & CREDIBILITY EVALUATION ---

def web_search_tavily(query: str, max_results: int = 10) -> list[dict]:
    """
    Gọi Tavily Web Search API. Fallback sang Mock Search nếu không có API Key.
    """
    tavily_key = os.environ.get("TAVILY_API_KEY")
    if tavily_key:
        try:
            url = "https://api.tavily.com/search"
            payload = {
                "api_key": tavily_key,
                "query": query,
                "search_depth": "basic",
                "max_results": max_results
            }
            response = requests.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                results = response.json().get("results", [])
                items = []
                for r in results:
                    items.append({
                        "title": r.get("title", "N/A"),
                        "url": r.get("url", ""),
                        "content": r.get("content", "")
                    })
                return items
            else:
                print(f"[WARNING] Tavily API tra ve code {response.status_code}. Fallback sang Mock.")
        except Exception as e:
            print(f"[WARNING] Loi khi goi Tavily Search ({e}). Fallback sang Mock.")
            
    # Fallback Mock Search
    print("[INFO] Su dung Mock Web Search vi khong co API Key hoac gap loi.")
    query_lower = query.lower()
    
    if "avl" in query_lower:
        return [
            {
                "title": "Lecture Notes on AVL Trees - MIT CSAIL",
                "url": "https://ocw.mit.edu/courses/electrical-engineering/6-006-fall-2011/avl-trees.pdf",
                "content": "MIT Lecture Notes: AVL trees maintain balancing by executing rotation algorithms (left/right rotation) whenever balance factor deviates from {-1, 0, 1}. Proof of depth showing height is strictly logarithmic O(log n) with DOI: 10.1016/j.datade.2023.04."
            },
            {
                "title": "AVL Tree Optimization and Complexity Proof - IEEE Xplore",
                "url": "https://ieeexplore.ieee.org/document/109238",
                "content": "This academic paper details the self-balancing algorithm of AVL trees. We present a formal complexity proof showing insertion, deletion, and search are guaranteed O(log n). ISSN: 1939-1374."
            },
            {
                "title": "Data Structures Syllabus & Lecture slides - Stanford University",
                "url": "https://web.stanford.edu/class/archive/cs/cs106b/avl.html",
                "content": "Stanford CS106B lecture notes on AVL Trees and Binary Search Trees. Covers balance factors, single rotations, double rotations, and student code templates."
            },
            {
                "title": "AVL Trees - GeeksforGeeks Academic DSA",
                "url": "https://www.geeksforgeeks.org/avl-tree-set-1-insertion/",
                "content": "An AVL tree is a self-balancing Binary Search Tree (BST) where the difference between heights of left and right subtrees cannot be more than one for all nodes. Operation time complexity is O(log n)."
            },
            {
                "title": "VinUni DSA Course Materials on Trees - VinUniversity",
                "url": "https://vinuni.edu.vn/courses/dsa/avl-balance",
                "content": "VinUni undergraduate lecture slides for DSA. Discusses active learning exercises on balancing AVL trees, comparing AVL trees with Red-Black trees."
            },
            {
                "title": "Federal Standard on Secure Algorithms - US Government Portal",
                "url": "https://itstandards.gov/algorithms/avl-verification",
                "content": "Government framework detailing verified tree structures for secure database indexing. Recommends self-balancing search trees for strict performance requirements in 2024."
            },
            {
                "title": "Data Structure Implementations - Non-profit Educational Org",
                "url": "https://dsa-visualizer.org/avl-tree",
                "content": "Interactive web app demonstrating AVL rotations. An open-source project hosted by a non-profit organization for CS students globally."
            },
            {
                "title": "Cơ sở dữ liệu AVL - Blog Học thuật cá nhân",
                "url": "http://myblogca-nhan.blogspot.com/cay-avl",
                "content": "Chào các bạn, hôm nay mình chia sẻ về cây AVL. Cây AVL là cây nhị phân tự cân bằng rất hay, mình học được trên mạng. Các bạn nhớ like và subscribe nhé."
            },
            {
                "title": "Chia sẻ thảo luận về cây AVL - DSA Group",
                "url": "https://facebook.com/groups/dsasharing/posts/112",
                "content": "Mọi người ơi đề thi DSA VinUni năm ngoái có câu về cây AVL khó quá, ai giải giúp mình với. Mình thấy đề bắt vẽ các bước xoay cây phức tạp."
            },
            {
                "title": "Hỏi đáp nhanh về BST và AVL - Twitter / X",
                "url": "https://twitter.com/dsa_tips/status/1782",
                "content": "Tip nhanh: Cây AVL cân bằng hơn cây đỏ đen nên tìm kiếm nhanh hơn, nhưng chi phí xoay khi chèn/xóa sẽ cao hơn."
            }
        ]
    else:
        return [
            {
                "title": "Introduction to Binary Search Trees - Stanford University",
                "url": "https://web.stanford.edu/class/archive/cs/cs106b/bst.html",
                "content": "Stanford CS106B: A Binary Search Tree is a node-based binary tree data structure which has the following properties: The left subtree of a node contains only nodes with keys lesser than the node's key. Includes full proof and complexity analysis."
            },
            {
                "title": "Academic Journals on Data Structures - Elsevier ScienceDirect",
                "url": "https://sciencedirect.com/journal/data-structures/vol12",
                "content": "This academic journal proposes optimized algorithms for tree traversal with DOI: 10.1016/j.datade.2025.1012. Traversals in-order, pre-order and post-order are thoroughly evaluated with theorem and proof."
            },
            {
                "title": "Harvard CS50 Lecture Notes on Tree Structures - Harvard SEAS",
                "url": "https://seas.harvard.edu/courses/cs50/trees",
                "content": "Harvard CS50 introduction to data structures. Covers nodes, pointers, binary trees, recursion, and basic complexity analysis for undergraduate students."
            },
            {
                "title": "Algorithm Standards and Guidelines - NIST Government Portal",
                "url": "https://nist.gov/publications/bst-security",
                "content": "NIST publication analyzing binary tree security under adversarial input. Outlines threat models, tree depth validation, and guidelines published in 2023."
            },
            {
                "title": "Binary Tree Visualizations - Open Source Education Org",
                "url": "https://algorithm-visuals.org/bst",
                "content": "A non-profit open source project containing animated visualizers for binary search trees, heap structures, and graph traversals. Published in 2022."
            },
            {
                "title": "IEEE Standard for Floating Point Tree Indexing - IEEE Xplore",
                "url": "https://ieeexplore.ieee.org/document/882190",
                "content": "An engineering draft defining standards for indexing high-frequency floating point data. Discusses BST variations. ISSN: 1049-8907."
            },
            {
                "title": "DSA Lecture notes for freshman - VinUniversity",
                "url": "https://vinuni.edu.vn/dsa-lecture-notes-bst",
                "content": "VinUni lecture notes for Computer Science. Contains code templates, active learning team assignments, and CLO mappings for binary search trees."
            },
            {
                "title": "DSA Sharing Group - Facebook Community",
                "url": "https://facebook.com/groups/dsasharing/posts/990",
                "content": "Xin tài liệu học DSA: Mọi người có slide hay đề thi mẫu môn DSA của các trường đại học không ạ, cho mình xin với."
            },
            {
                "title": "Học DSA siêu dễ - Blogspot Cá nhân",
                "url": "http://dsasnow.blogspot.com/2021/bst-guide",
                "content": "Chào các bạn! Blog này mình viết để hướng dẫn lập trình cây nhị phân tìm kiếm BST bằng ngôn ngữ C++ cực kỳ chi tiết cho người mới bắt đầu."
            },
            {
                "title": "DSA Quick Tips - Twitter / X Short Feed",
                "url": "https://twitter.com/dsa_fast/status/1553",
                "content": "BST traverse in-order always returns sorted elements! Simple but super useful property when writing algorithms."
            }
        ]

def evaluate_source_credibility(title: str, url: str, content: str) -> dict:
    """
    Đánh giá độ uy tín học thuật của nguồn web (Academic Credibility Score).
    Trả về dict gồm: score (0.0 -> 1.0) và justification (lập luận).
    """
    url_lower = url.lower()
    content_lower = content.lower()
    title_lower = title.lower()
    
    score = 0.0
    reasons = []
    
    # 1. Domain & Publisher (Tối đa 0.5)
    high_academic_domains = ["ieee.org", "springer.com", "sciencedirect.com", "cambridge.org", "harvard.edu", "vinuni.edu.vn", "mit.edu", "nature.com", "stanford.edu"]
    
    is_high_domain = False
    for d in high_academic_domains:
        if d in url_lower:
            score += 0.5
            reasons.append(f"Domain thuoc whitelist hoc thuat cao: {d} (+0.50)")
            is_high_domain = True
            break
            
    if not is_high_domain:
        if ".edu" in url_lower:
            score += 0.4
            reasons.append("Ten mien to chuc giao duc (.edu) (+0.40)")
        elif ".gov" in url_lower:
            score += 0.35
            reasons.append("Ten mien co quan chinh phu (.gov) (+0.35)")
        elif ".org" in url_lower:
            score += 0.2
            reasons.append("Ten mien to chuc phi loi nhuan (.org) (+0.20)")
        elif "blogspot" in url_lower or "facebook" in url_lower or "twitter" in url_lower:
            score -= 0.3
            reasons.append("Nguon tin blog ca nhan hoac mang xa hoi kem uy tin (-0.30)")
            
    # 2. DOI / ISSN Identification (Tối đa 0.2)
    # DOI pattern: e.g., 10.1016/j.datade...
    if re.search(r"\b10\.\d{4,9}/[-._;()/:A-Z0-9]+\b", content_lower, re.IGNORECASE) or "doi:" in content_lower:
        score += 0.2
        reasons.append("Phat hien ma chi so nghien cuu DOI hop le (+0.20)")
    elif "issn" in content_lower:
        score += 0.15
        reasons.append("Phat hien ma so chuan quoc te ISSN (+0.15)")
        
    # 3. Consensus & Academic keywords (Tối đa 0.15)
    academic_keywords = ["lecture notes", "course syllabus", "theorem", "lemma", "proof", "complexity analysis", "complexity proof", "citation", "bibliography"]
    keyword_count = sum(1 for kw in academic_keywords if kw in content_lower or kw in title_lower)
    if keyword_count >= 2:
        score += 0.15
        reasons.append(f"Chua {keyword_count} tu khoa hoc thuat dac trung (+0.15)")
    elif keyword_count == 1:
        score += 0.08
        reasons.append("Chua 1 tu khoa hoc thuat dac trung (+0.08)")
        
    # 4. Recency (Tối đa 0.15)
    # Tìm kiếm các năm xuất bản gần đây (2020 đến 2026)
    years = re.findall(r"\b(202[0-6])\b", content_lower)
    if years:
        score += 0.15
        reasons.append(f"Xuat ban/cap nhat gan day: {years[0]} (+0.15)")
    else:
        score += 0.05
        reasons.append("Khong ro nam xuat ban gan day, mac dinh he so thap (+0.05)")
        
    # Chuẩn hóa score trong khoảng [0.0, 1.0]
    final_score = max(0.0, min(1.0, round(score, 2)))
    justification = "; ".join(reasons) if reasons else "Nguon tin pho thong, khong co dac diem hoc thuat."
    
    return {
        "score": final_score,
        "justification": justification
    }

# --- API ENDPOINTS ---

@router.post("/{course_id}/web-search-ingest")
def web_search_and_ingest(
    course_id: int,
    req: WebSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Xác thực quyền sở hữu môn học
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )
        
    # 2. Tìm kiếm trên web
    max_res = req.max_results if req.max_results is not None else 5
    search_results = web_search_tavily(req.query, max_results=max_res)
    
    # 3. Đánh giá độ uy tín học thuật của từng nguồn
    ingested_sources = []
    rejected_sources = []
    
    threshold = req.threshold if req.threshold is not None else 0.7
    
    for item in search_results:
        eval_res = evaluate_source_credibility(item["title"], item["url"], item["content"])
        score = eval_res["score"]
        justification = eval_res["justification"]
        
        source_data = {
            "title": item["title"],
            "url": item["url"],
            "score": score,
            "justification": justification,
            "content": item["content"]
        }
        
        # 4. Lọc độ uy tín học thuật >= threshold để nạp vào RAG
        if score >= threshold:
            # Giả lập nạp tài liệu vào ChromaDB
            # Nạp text content của nguồn vào trang 1 (coi như tài liệu 1 trang)
            try:
                # Định nghĩa tên file giả lập dựa vào title/domain
                domain_match = re.search(r"https?://(?:www\.)?([^/]+)", item["url"])
                domain_name = domain_match.group(1) if domain_match else "web_source"
                file_name = f"Web_{domain_name}_{score}.txt"
                
                # Nạp vector chunks
                add_document_vector(
                    file_name=file_name,
                    text_by_pages=[item["content"]],
                    user_id=current_user.id,
                    course_id=course_id
                )
                ingested_sources.append(source_data)
            except Exception as e:
                print(f"[ERROR] Loi khi nap vector tu web source: {e}")
                # Vẫn ghi nhận nhưng báo lỗi log
                rejected_sources.append({**source_data, "error": str(e)})
        else:
            rejected_sources.append(source_data)
            
    return {
        "message": f"Khao sat hoan tat. Da nap {len(ingested_sources)} nguon tin hoc thuat va tu choi {len(rejected_sources)} nguon kem tin cay.",
        "ingested": ingested_sources,
        "rejected": rejected_sources
    }

# --- FORCE INGEST: Chấp nhận thủ công nguồn bị từ chối ---

class ForceIngestRequest(BaseModel):
    url: str = Field(..., example="https://example.com/article")
    title: str = Field(..., example="Article Title")
    content: str = Field(default="", example="Nội dung đã tải về từ tìm kiếm trước đó.")

@router.post("/{course_id}/force-ingest-url")
def force_ingest_url(
    course_id: int,
    req: ForceIngestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cho phép giảng viên chấp nhận thủ công một nguồn đã bị từ chối
    (override credibility filter) và nạp thẳng vào RAG Vector DB.
    """
    # 1. Xác thực quyền sở hữu môn học
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Môn học không tồn tại hoặc bạn không có quyền truy cập."
        )

    # 2. Dùng content có sẵn từ tìm kiếm (đã trả về trước đó), không cần crawl lại
    content_to_ingest = req.content.strip()
    if not content_to_ingest:
        content_to_ingest = f"[Nguồn thủ công] Tiêu đề: {req.title}\nURL: {req.url}\n(Nội dung không được cung cấp)"

    # 3. Tạo tên file từ domain
    domain_match = re.search(r"https?://(?:www\.)?([^/]+)", req.url)
    domain_name = domain_match.group(1) if domain_match else "manual_source"
    file_name = f"Manual_{domain_name}.txt"

    try:
        add_document_vector(
            file_name=file_name,
            text_by_pages=[content_to_ingest],
            user_id=current_user.id,
            course_id=course_id
        )
        return {
            "message": f"Đã nạp thủ công nguồn '{req.title}' vào RAG thành công.",
            "file_name": file_name
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi nạp thủ công vào RAG: {str(e)}"
        )


class SummarizeRequest(BaseModel):
    content: str
    title: str | None = ""

@router.post("/summarize-content")
def summarize_content(
    req: SummarizeRequest,
    current_user: User = Depends(get_current_user)
):
    """Gọi LLM để tóm tắt nội dung tài liệu tìm kiếm."""
    system_instruction = (
        "Bạn là trợ lý học thuật. Hãy tóm tắt nội dung tài liệu sau đây thành một JSON object "
        "chứa duy nhất một key 'summary' có giá trị là một đoạn văn tóm tắt ngắn gọn, súc tích "
        "(khoảng 3-4 câu, dưới 100 từ) tập trung vào các khái niệm học thuật chính."
    )
    prompt = (
        f"Tiêu đề: {req.title}\nNội dung:\n{req.content}\n\nHãy viết tóm tắt ngắn "
        "và trả về định dạng JSON với key duy nhất là 'summary'. "
        "Ví dụ: {\"summary\": \"Nội dung tóm tắt học thuật...\"}"
    )
    try:
        result = call_llm_json(prompt, system_instruction=system_instruction)
        return {"summary": result.get("summary", "Không thể tạo tóm tắt.")}
    except Exception as e:
        text = req.content[:300] + "..." if len(req.content) > 300 else req.content
        return {"summary": f"[Tóm tắt tự động] {text}"}

