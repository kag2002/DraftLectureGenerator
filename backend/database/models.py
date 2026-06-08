from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from backend.database.session import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    
    # Quan hệ
    courses = relationship("Course", back_populates="user", cascade="all, delete-orphan")

class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_code = Column(String(50), nullable=False)
    course_name = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    # Quan hệ
    user = relationship("User", back_populates="courses")
    clos = relationship("CLO", back_populates="course", cascade="all, delete-orphan")
    chapters = relationship("Chapter", back_populates="course", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="course", cascade="all, delete-orphan")

class CLO(Base):
    __tablename__ = "clos"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    clo_code = Column(String(20), nullable=False) # ví dụ: CLO1, CLO2
    description = Column(Text, nullable=False)
    bloom_level = Column(Integer, nullable=False) # 1 đến 6
    
    # Quan hệ
    course = relationship("Course", back_populates="clos")
    questions = relationship("Question", back_populates="clo")

class Chapter(Base):
    __tablename__ = "chapters"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    sort_order = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    
    # Quan hệ
    course = relationship("Course", back_populates="chapters")
    materials = relationship("ChapterMaterial", back_populates="chapter", uselist=False, cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="chapter")

class ChapterMaterial(Base):
    __tablename__ = "chapter_materials"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    slide_content = Column(Text, nullable=True) # Markdown text
    active_learning_script = Column(Text, nullable=True) # Text guide
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Quan hệ
    chapter = relationship("Chapter", back_populates="materials")

class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(20), default="MCQ") # MCQ | Short Answer
    options_json = Column(Text, nullable=True) # JSON array of options for MCQ
    correct_answer = Column(String(50), nullable=False)
    bloom_level = Column(Integer, nullable=False)
    clo_id = Column(Integer, ForeignKey("clos.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    
    # Quan hệ
    course = relationship("Course", back_populates="questions")
    chapter = relationship("Chapter", back_populates="questions")
    clo = relationship("CLO", back_populates="questions")
