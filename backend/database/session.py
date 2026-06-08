from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = "sqlite:///./lecture_generator.db"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False}
)

# Kích hoạt chế độ WAL (Write-Ahead Logging) cho SQLite để tránh Write-Locks khi chạy đa luồng
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency cung cấp session DB cho các routers FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
