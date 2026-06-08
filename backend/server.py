import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.database.session import engine, Base
from backend.routers import auth, courses, outline, materials, questions, export
from backend.services import web_search_agent

# Tự động tạo bảng SQLite khi chạy lần đầu nếu chưa tồn tại
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Lecture Assistant API",
    description="Backend API hỗ trợ sinh bài giảng, câu hỏi thi chuẩn CLO & Bloom (VinUni x Vingroup)",
    version="1.0.0"
)

# Cấu hình CORS để cho phép Frontend React/Vite kết nối API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Trong production sẽ giới hạn đúng domain Vercel của Frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tích hợp các bộ định tuyến API (Routers)
app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(outline.router)
app.include_router(materials.router)
app.include_router(questions.router)
app.include_router(web_search_agent.router)
app.include_router(export.router)

# Root Endpoint
@app.get("/")
def read_root():
    return {
        "status": "active",
        "service": "AI Lecture Assistant API",
        "database": "SQLite (WAL Mode Enabled)"
    }

# Bộ xử lý lỗi toàn cục (Global Exception Handler) - Đảm bảo hệ thống không trả về lỗi crash sập server
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log lỗi chi tiết ở server để phục vụ debug
    print(f"🔥 LỖI HỆ THỐNG TOÀN CỤC: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "Có lỗi hệ thống xảy ra. Hệ thống RAG/API đang tự khôi phục, vui lòng thử lại sau.",
            "details": str(exc)
        }
    )

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
