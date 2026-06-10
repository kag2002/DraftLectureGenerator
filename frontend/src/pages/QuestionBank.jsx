import React, { useState, useEffect } from 'react';
import client from '../api/client';
import FlowSteps from '../components/FlowSteps';
import QuestionConfigForm from '../components/QuestionConfigForm';
import QuestionEditorForm from '../components/QuestionEditorForm';
import QuestionCard from '../components/QuestionCard';

export default function QuestionBank({ course, initialChapterId, initialCloId, initialBloomLevel, onBack, onGoToLessonPlanner, onViewDashboard, onNavigate }) {
  const [questions, setQuestions] = useState([]);
  const [clos, setClos] = useState([]);
  const [chapters, setChapters] = useState([]);
  
  // States cho Form Sinh Câu hỏi
  const [selectedClo, setSelectedClo] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [bloomLevel, setBloomLevel] = useState(3);
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [genLog, setGenLog] = useState('');
  const [isFastMode, setIsFastMode] = useState(false);

  // States cho Form Web Search Ingestion
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [expandedSearch, setExpandedSearch] = useState({});

  // General States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Load ban đầu
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Load questions
      const qRes = await client.get(`/api/courses/${course.id}/questions`);
      setQuestions(qRes.data);
      
      // 2. Load CLOs
      const cloRes = await client.get(`/api/courses/${course.id}/clos`);
      setClos(cloRes.data);
      if (initialCloId) {
        setSelectedClo(initialCloId);
      } else if (cloRes.data.length > 0) {
        setSelectedClo(cloRes.data[0].id);
      }
      
      // 3. Load Chapters
      const capRes = await client.get(`/api/courses/${course.id}/chapters`);
      setChapters(capRes.data);
      if (capRes.data.length > 0) {
        const found = initialChapterId && capRes.data.some(c => c.id === initialChapterId);
        setSelectedChapter(found ? initialChapterId : capRes.data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError('Không thể tải dữ liệu ngân hàng câu hỏi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [course.id]);

  // Đồng bộ hóa chương học được chọn khi prop initialChapterId thay đổi từ Roadmap
  useEffect(() => {
    if (initialChapterId && chapters.length > 0) {
      const found = chapters.some(c => c.id === initialChapterId);
      if (found && selectedChapter !== initialChapterId) {
        setSelectedChapter(initialChapterId);
      }
    }
  }, [initialChapterId, chapters, selectedChapter]);

  // Đồng bộ hóa chuẩn đầu ra và mức Bloom khi được chuyển vùng từ Ma trận
  useEffect(() => {
    if (initialCloId) {
      setSelectedClo(initialCloId);
    }
  }, [initialCloId]);

  useEffect(() => {
    if (initialBloomLevel) {
      setBloomLevel(initialBloomLevel);
    }
  }, [initialBloomLevel]);
  const handleGenerateQuestions = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setGenerating(true);
    setGenLog('🚀 Khởi động AI Generator... đang kết nối OpenRouter...');

    const token = localStorage.getItem('token');

    try {
      const response = await fetch(
        `http://localhost:8000/api/courses/${course.id}/questions/generate-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            clo_id: selectedClo ? parseInt(selectedClo) : null,
            chapter_id: selectedChapter ? parseInt(selectedChapter) : null,
            bloom_level: parseInt(bloomLevel),
            count: parseInt(count),
            fast_mode: isFastMode
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Lỗi server: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const newQuestions = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Giữ lại dòng chưa hoàn chỉnh

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (currentEvent === 'stage') {
                setGenLog(data.message);
              } else if (currentEvent === 'question') {
                newQuestions.push(data.question);
                setQuestions(prev => [...prev, data.question]);
                setGenLog(`✅ Câu ${data.index}/${data.total} đã xác minh và lưu vào CSDL!`);
              } else if (currentEvent === 'done') {
                setMessage(data.message);
                setGenerating(false);
                setGenLog('');
              } else if (currentEvent === 'error') {
                setError(data.message);
                setGenerating(false);
                setGenLog('');
              }
            } catch (_) {}
          }
        }
      }

    } catch (err) {
      console.error(err);
      setError(`Lỗi kết nối stream: ${err.message}`);
      setGenerating(false);
      setGenLog('');
    }
  };


  // Sinh câu hỏi isomorphic
  const handleGenerateIsomorphic = async (qId) => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await client.post(`/api/courses/questions/${qId}/generate-isomorphic`);
      setQuestions([...questions, response.data.question]);
      setMessage('Đã sinh thành công 1 câu hỏi đồng cấu tương tự!');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi sinh câu hỏi đồng cấu.');
    } finally {
      setLoading(false);
    }
  };

  // Chạy Web Search Ingestion
  const handleWebSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setError('');
    setMessage('');
    setSearching(true);
    setSearchResult(null);
    setExpandedSearch({});

    try {
      const response = await client.post(`/api/courses/${course.id}/web-search-ingest`, {
        query: searchQuery
      });
      setSearchResult(response.data);
      setMessage('Đã hoàn thành khảo sát độ uy tín và nạp RAG!');
    } catch (err) {
      console.error(err);
      setError('Lỗi trong quá trình tìm kiếm học thuật.');
    } finally {
      setSearching(false);
    }
  };

  const toggleSearchDetail = (key) => {
    setExpandedSearch(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Sửa câu hỏi
  const handleEditClick = (q) => {
    // parse options_json sang array
    let options = [];
    try {
      options = JSON.parse(q.options_json);
    } catch (e) {
      options = ["", "", "", ""];
    }
    setEditingQuestion({
      ...q,
      options
    });
  };

  const handleCreateManualClick = () => {
    setEditingQuestion({
      id: 'new',
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: '',
      bloom_level: 3,
      clo_id: clos.length > 0 ? clos[0].id : null,
      chapter_id: selectedChapter ? parseInt(selectedChapter) : null
    });
  };

  const handleUpdateQuestion = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    // Đảm bảo đáp án đúng phải trùng khớp với một trong các lựa chọn
    if (!editingQuestion.options.includes(editingQuestion.correct_answer)) {
      setError('Đáp án đúng phải trùng với một trong bốn lựa chọn đã nhập.');
      return;
    }

    try {
      if (editingQuestion.id === 'new') {
        const response = await client.post(`/api/courses/${course.id}/questions`, {
          chapter_id: editingQuestion.chapter_id ? parseInt(editingQuestion.chapter_id) : null,
          question_text: editingQuestion.question_text,
          options_json: JSON.stringify(editingQuestion.options),
          correct_answer: editingQuestion.correct_answer,
          bloom_level: parseInt(editingQuestion.bloom_level),
          clo_id: editingQuestion.clo_id ? parseInt(editingQuestion.clo_id) : null
        });
        setQuestions([...questions, response.data]);
        setMessage('Tạo câu hỏi thủ công thành công!');
      } else {
        const response = await client.put(`/api/courses/questions/${editingQuestion.id}`, {
          question_text: editingQuestion.question_text,
          options_json: JSON.stringify(editingQuestion.options),
          correct_answer: editingQuestion.correct_answer,
          bloom_level: parseInt(editingQuestion.bloom_level),
          clo_id: editingQuestion.clo_id ? parseInt(editingQuestion.clo_id) : null
        });
        setQuestions(questions.map(q => q.id === editingQuestion.id ? response.data : q));
        setMessage('Cập nhật câu hỏi thành công!');
      }
      setEditingQuestion(null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Lỗi khi lưu câu hỏi.');
    }
  };


  // Xóa câu hỏi
  const handleDeleteQuestion = async (qId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;
    setError('');
    setMessage('');
    
    try {
      await client.delete(`/api/courses/questions/${qId}`);
      setQuestions(questions.filter(q => q.id !== qId));
      setMessage('Đã xóa câu hỏi thành công.');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi xóa câu hỏi.');
    }
  };

  // Xuất bản đề thi (tải file Markdown)
  const handleExportExam = () => {
    if (questions.length === 0) {
      setError('Chưa có câu hỏi nào để xuất bản.');
      return;
    }
    
    let content = `# ĐỀ THI TRẮC NGHIỆM MÔN HỌC: ${course.course_name.toUpperCase()}\n`;
    content += `Mã môn học: ${course.course_code}\n`;
    content += `Số lượng câu hỏi: ${questions.length} câu\n`;
    content += `Sinh tự động bởi AI Lecture Assistant (G02-Team023)\n\n`;
    content += `--------------------------------------------------------\n\n`;
    
    questions.forEach((q, idx) => {
      content += `Câu ${idx + 1}: ${q.question_text}\n`;
      let opts = [];
      try {
        opts = JSON.parse(q.options_json);
      } catch(e) {
        opts = [];
      }
      
      const labels = ["A", "B", "C", "D"];
      opts.forEach((opt, oIdx) => {
        content += `${labels[oIdx]}. ${opt}\n`;
      });
      
      content += `\n* Đáp án đúng: ${q.correct_answer}\n`;
      // Tìm CLO Code
      const clo = clos.find(c => c.id === q.clo_id);
      content += `* Phân loại: [${clo ? clo.clo_code : 'N/A'}] - Bloom level: ${q.bloom_level}\n\n`;
      content += `----------------\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `De_thi_${course.course_code}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helpers hiển thị Bloom text
  const getBloomText = (lvl) => {
    const texts = ["Nhớ (B1)", "Hiểu (B2)", "Vận dụng (B3)", "Phân tích (B4)", "Đánh giá (B5)", "Sáng tạo (B6)"];
    return texts[lvl - 1] || `B${lvl}`;
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={onBack} style={styles.backBtn}>← Sơ đồ</button>
          {onGoToLessonPlanner && (
            <button onClick={onGoToLessonPlanner} style={{ ...styles.backBtn, background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.3)', color: '#a5b4fc', marginLeft: '8px' }}>
              📖 Soạn Slide & Giáo án
            </button>
          )}
          <div>
            <span style={styles.badge}>{course.course_code}</span>
            <h2 style={styles.courseTitle}>Ngân Hàng Đề Thi & Câu Hỏi</h2>
          </div>
        </div>

        {onNavigate && <FlowSteps activeStep="questions" onNavigate={onNavigate} />}

        <div style={styles.headerRight}>
          <button onClick={onViewDashboard} style={styles.dashboardBtn}>
            📊 Xem Ma trận Bloom-CLO
          </button>
          <button onClick={handleExportExam} style={styles.exportBtn}>
            📥 Xuất bản Đề thi (.md)
          </button>
        </div>
      </header>

      {error && <div style={styles.errorAlert}>{error}</div>}
      {message && <div style={styles.successAlert}>{message}</div>}

      {initialCloId && initialBloomLevel && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          color: '#a5b4fc',
          padding: '12px 20px',
          borderRadius: '10px',
          fontSize: '13px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <div>
            🎯 <strong>Đang khắc phục điểm mù chất lượng:</strong> AI Generator và Bộ lọc đã được tự động điều chỉnh chọn chuẩn đầu ra và mức Bloom tương ứng. Nhấn <strong>"Sinh câu hỏi qua AI"</strong> ở bảng bên trái hoặc thêm thủ công để bù đắp.
          </div>
        </div>
      )}

      <div style={styles.mainGrid}>
        <QuestionConfigForm
          selectedClo={selectedClo}
          setSelectedClo={setSelectedClo}
          clos={clos}
          selectedChapter={selectedChapter}
          setSelectedChapter={setSelectedChapter}
          chapters={chapters}
          bloomLevel={bloomLevel}
          setBloomLevel={setBloomLevel}
          count={count}
          setCount={setCount}
          generating={generating}
          loading={loading}
          genLog={genLog}
          handleGenerateQuestions={handleGenerateQuestions}
          isFastMode={isFastMode}
          setIsFastMode={setIsFastMode}
          styles={styles}
        />

        {/* BẢNG CHÍNH BÊN PHẢI: CHI TIẾT CÂU HỎI */}
        <main style={styles.contentArea}>
          <QuestionEditorForm
            editingQuestion={editingQuestion}
            setEditingQuestion={setEditingQuestion}
            clos={clos}
            handleUpdateQuestion={handleUpdateQuestion}
            styles={styles}
          />

          {/* DANH SÁCH CÂU HỎI */}
          <div style={styles.questionsList}>
            <div style={{...styles.listHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', boxSizing: 'border-box'}}>
              <h3 style={{margin: 0, fontSize: '15px', fontWeight: '700'}}>Danh sách Câu hỏi Hiện tại ({questions.length} câu)</h3>
              <button 
                onClick={handleCreateManualClick} 
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 5px rgba(16, 185, 129, 0.2)'
                }}
              >
                ➕ Thêm câu hỏi thủ công
              </button>
            </div>

            {loading ? (
              <div style={styles.loadingState}>Đang đồng bộ dữ liệu ngân hàng đề thi...</div>
            ) : questions.length === 0 ? (
              <div style={styles.emptyState}>
                <p>Chưa có câu hỏi nào trong môn học này.</p>
                <p style={{fontSize: '12px', color: '#64748b'}}>Hãy cấu hình bảng AI Generator ở bên trái để sinh tự động.</p>
              </div>
            ) : (
              questions.map((q, index) => (
                <QuestionCard
                  key={q.id || index}
                  q={q}
                  index={index}
                  clos={clos}
                  handleGenerateIsomorphic={handleGenerateIsomorphic}
                  handleEditClick={handleEditClick}
                  handleDeleteQuestion={handleDeleteQuestion}
                  getBloomText={getBloomText}
                  styles={styles}
                />
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at 10% 20%, rgb(15, 23, 42) 0%, rgb(9, 13, 26) 90%)',
    fontFamily: '"Outfit", "Inter", sans-serif',
    color: '#f8fafc',
    padding: '30px 40px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '20px',
    marginBottom: '30px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  headerRight: {
    display: 'flex',
    gap: '12px',
  },
  backBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#cbd5e1',
    borderRadius: '10px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
  },
  badge: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '6px',
    display: 'inline-block',
    marginBottom: '4px',
  },
  courseTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
  },
  dashboardBtn: {
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    borderRadius: '10px',
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  exportBtn: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '13px',
    marginBottom: '20px',
  },
  successAlert: {
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#a7f3d0',
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '13px',
    marginBottom: '20px',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '360px 1fr',
    gap: '30px',
    alignItems: 'start',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  card: {
    background: 'rgba(30, 41, 59, 0.4)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '20px',
    padding: '24px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#f1f5f9',
    margin: '0 0 20px 0',
    borderLeft: '3px solid #6366f1',
    paddingLeft: '10px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
  },
  formRow: {
    display: 'flex',
    gap: '12px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
  },
  select: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '10px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  input: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '10px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
  },
  textarea: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '12px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '5px',
    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)',
  },
  searchBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#f8fafc',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '5px',
  },
  genLogBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(15, 23, 42, 0.5)',
    borderRadius: '8px',
    padding: '10px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    marginTop: '5px',
  },
  pulseDot: {
    width: '8px',
    height: '8px',
    background: '#818cf8',
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite',
  },
  logText: {
    fontSize: '11px',
    color: '#a5b4fc',
    lineHeight: '1.4',
  },
  searchResults: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '15px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  searchResultHeader: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: '5px',
  },
  resultItemGreen: {
    background: 'rgba(16, 185, 129, 0.05)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    borderRadius: '8px',
    padding: '10px',
  },
  resultItemRed: {
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    borderRadius: '8px',
    padding: '10px',
  },
  toggleDetailBtn: {
    background: 'none',
    border: 'none',
    color: '#a5b4fc',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: '700',
    padding: 0,
    textDecoration: 'underline',
    textAlign: 'left',
  },
  scrapedContentBox: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '8px',
    fontSize: '10px',
    fontFamily: 'Consolas, monospace',
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap',
    maxHeight: '150px',
    overflowY: 'auto',
    marginTop: '6px',
    margin: 0,
  },
  resultTitle: {
    fontSize: '12px',
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  scoreBadgeGreen: {
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#34d399',
    fontSize: '10px',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '4px',
  },
  scoreBadgeRed: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    fontSize: '10px',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '4px',
  },
  resultUrl: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  resultReason: {
    fontSize: '10px',
    color: '#94a3b8',
    marginTop: '5px',
    lineHeight: '1.3',
  },
  contentArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  editorCard: {
    background: 'rgba(30, 41, 59, 0.3)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: '20px',
    padding: '24px',
  },
  editorTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#818cf8',
    margin: '0 0 20px 0',
  },
  editorActionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '10px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '15px',
  },
  saveEditorBtn: {
    background: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 18px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  cancelEditorBtn: {
    background: 'none',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#94a3b8',
    borderRadius: '8px',
    padding: '8px 18px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  questionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  listHeader: {
    background: 'rgba(30, 41, 59, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '10px',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
  },
  loadingState: {
    textAlign: 'center',
    padding: '40px',
    color: '#94a3b8',
  },
  emptyState: {
    background: 'rgba(30, 41, 59, 0.1)',
    border: '1px dashed rgba(255, 255, 255, 0.05)',
    borderRadius: '20px',
    padding: '60px 40px',
    textAlign: 'center',
    color: '#94a3b8',
  },
  questionCard: {
    background: 'rgba(30, 41, 59, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '20px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  questionCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionCardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  idxBadge: {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#e2e8f0',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  bloomTag: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  cloTag: {
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
  },
  actionBtnIso: {
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  actionBtnEdit: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#cbd5e1',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  actionBtnDel: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  questionText: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#f1f5f9',
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  optionItem: {
    background: 'rgba(15, 23, 42, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#cbd5e1',
  },
  optionItemCorrect: {
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#a7f3d0',
    fontWeight: '600',
  },
  optionLabel: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#94a3b8',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '700',
  },
  optionLabelCorrect: {
    background: '#10b981',
    color: '#ffffff',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '700',
  }
};
