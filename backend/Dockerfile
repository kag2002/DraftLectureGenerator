# Sử dụng python 3.11 slim gọn nhẹ
FROM python:3.11-slim

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Cài đặt các gói hệ thống cần thiết (ví dụ build-essential cho bcrypt/pip)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Sao chép file requirements.txt trước để tận dụng cache Docker layer
COPY requirements.txt .

# Cài đặt các thư viện Python
RUN pip install --no-cache-dir -r requirements.txt

# Sao chép toàn bộ mã nguồn backend vào container
COPY . /app/backend

# Thiết lập cổng mạng lắng nghe
EXPOSE 8000

# Biến môi trường
ENV PYTHONPATH=/app
ENV PORT=8000

# Khởi chạy ứng dụng FastAPI qua Uvicorn server
CMD ["python", "-m", "uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8000"]
