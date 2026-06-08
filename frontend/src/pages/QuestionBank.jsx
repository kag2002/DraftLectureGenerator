import React, { useState, useEffect } from 'react';
import client from '../api/client';

export default function QuestionBank({ course, onBack, onViewDashboard }) {
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

  // States cho Form Web Search Ingestion
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);

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
      if (cloRes.data.length > 0) {
        setSelectedClo(cloRes.data[0].id);
      }
      
      // 3. Load Chapters
      const capRes = await client.get(`/api/courses/${course.id}/chapters`);
      setChapters(capRes.data);
      if (capRes.data.length > 0) {
        setSelectedChapter(capRes.data[0].id);
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

  // Gọi sinh câu hỏi trắc nghiệm MCQ
  const handleGenerateQuestions = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setGenerating(true);
    setGenLog('Bắt đầu khởi động AI Generator (Pha 1)...');

    try {
      setTimeout(() => setGenLog('AI Generator đã sinh câu hỏi nháp. Bắt đầu chuyển sang AI Solver để kiểm tra (Pha 2 - Self-Correction)...'), 1500);
      setTimeout(() => setGenLog('Đang so sánh chéo đáp án... Phát hiện sự nhất quán hoặc đã sửa đổi tự động hoàn tất. Đang lưu vào hệ thống...'), 3200);
      
      const response = await client.post(`/api/courses/${course.id}/questions/generate`, {
        clo_id: selectedClo ? parseInt(selectedClo) : null,
        chapter_id: selectedChapter ? parseInt(selectedChapter) : null,
        bloom_level: parseInt(bloomLevel),
        count: parseInt(count)
      });
      
      setTimeout(() => {
        setQuestions([...questions, ...response.data.questions]);
        setMessage(`Đã sinh thành công ${response.data.questions.length} câu hỏi MCQ đã được xác thực (Self-Corrected)!`);
        setGenerating(false);
        setGenLog('');
      }, 4000);

    } catch (err) {
      console.error(err);
      setError('Lỗi khi sinh câu hỏi trắc nghiệm AI.');
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

  const handleUpdateQuestion = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    try {
      const response = await client.put(`/api/courses/questions/${editingQuestion.id}`, {
        question_text: editingQuestion.question_text,
        options_json: JSON.stringify(editingQuestion.options),
        correct_answer: editingQuestion.correct_answer,
        bloom_level: parseInt(editingQuestion.bloom_level),
        clo_id: editingQuestion.clo_id ? parseInt(editingQuestion.clo_id) : null
      });
      
      setQuestions(questions.map(q => q.id === editingQuestion.id ? response.data : q));
      setMessage('Cập nhật câu hỏi thành công!');
      setEditingQuestion(null);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi cập nhật câu hỏi.');
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
          <button onClick={onBack} style={styles.backBtn}>← Về Soạn Slide</button>
          <div>
            <span style={styles.badge}>{course.course_code}</span>
            <h2 style={styles.courseTitle}>Ngân Hàng Đề Thi & Câu Hỏi</h2>
          </div>
        </div>
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

      <div style={styles.mainGrid}>
        {/* SIDEBAR TRÁI: ĐIỀU KHIỂN AI & WEB SEARCH */}
        <aside style={styles.sidebar}>
          
          {/* SECTION 1: AI GENERATOR */}
          <section style={styles.card}>
            <h3 style={styles.cardTitle}>Sinh Câu Hỏi MCQ (AI)</h3>
            <form onSubmit={handleGenerateQuestions} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Chuẩn đầu ra (CLO)</label>
                <select 
                  value={selectedClo} 
                  onChange={(e) => setSelectedClo(e.target.value)}
                  style={styles.select}
                  required
                >
                  {clos.map(c => (
                    <option key={c.id} value={c.id}>[{c.clo_code}] {c.description.substring(0, 35)}...</option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Chương học liên quan</label>
                <select 
                  value={selectedChapter} 
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  style={styles.select}
                >
                  <option value="">Không bắt buộc</option>
                  {chapters.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Mức Bloom</label>
                  <select 
                    value={bloomLevel} 
                    onChange={(e) => setBloomLevel(e.target.value)}
                    style={styles.select}
                  >
                    <option value={1}>Nhớ (B1)</option>
                    <option value={2}>Hiểu (B2)</option>
                    <option value={3}>Vận dụng (B3)</option>
                    <option value={4}>Phân tích (B4)</option>
                    <option value={5}>Đánh giá (B5)</option>
                    <option value={6}>Sáng tạo (B6)</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Số lượng</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="5"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>

              <button type="submit" disabled={generating || loading} style={styles.submitBtn}>
                {generating ? 'AI Đang thực thi...' : 'Khởi chạy AI MCQ Generator'}
              </button>

              {generating && (
                <div style={styles.genLogBox}>
                  <div style={styles.pulseDot}></div>
                  <span style={styles.logText}>{genLog}</span>
                </div>
              )}
            </form>
          </section>

          {/* SECTION 2: WEB SEARCH AGENT INGESTION */}
          <section style={styles.card}>
            <h3 style={styles.cardTitle}>Tìm kiếm học thuật & Nạp RAG</h3>
            <form onSubmit={handleWebSearch} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Từ khóa học thuật Internet</label>
                <input
                  type="text"
                  placeholder="Ví dụ: AVL tree balance factor rotation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
              <button type="submit" disabled={searching || loading} style={styles.searchBtn}>
                {searching ? 'Đang duyệt học thuật...' : 'Tìm kiếm & Đánh giá uy tín'}
              </button>
            </form>

            {searchResult && (
              <div style={styles.searchResults}>
                <div style={styles.searchResultHeader}>
                  Kết quả (Chấp nhận {searchResult.ingested.length} | Từ chối {searchResult.rejected.length})
                </div>
                
                {/* INGESTED (XANH) */}
                {searchResult.ingested.map((src, i) => (
                  <div key={`ing-${i}`} style={styles.resultItemGreen}>
                    <div style={styles.resultTitle}>
                      <span style={styles.scoreBadgeGreen}>{(src.score * 100).toFixed(0)}%</span>
                      <strong>{src.title}</strong>
                    </div>
                    <div style={styles.resultUrl}>{src.url}</div>
                    <div style={styles.resultReason}>{src.justification}</div>
                  </div>
                ))}

                {/* REJECTED (ĐỎ) */}
                {searchResult.rejected.map((src, i) => (
                  <div key={`rej-${i}`} style={styles.resultItemRed}>
                    <div style={styles.resultTitle}>
                      <span style={styles.scoreBadgeRed}>{(src.score * 100).toFixed(0)}%</span>
                      <strong>{src.title}</strong>
                    </div>
                    <div style={styles.resultUrl}>{src.url}</div>
                    <div style={styles.resultReason}>{src.justification}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </aside>

        {/* BẢNG CHÍNH BÊN PHẢI: CHI TIẾT CÂU HỎI */}
        <main style={styles.contentArea}>
          
          {editingQuestion ? (
            /* KHUNG SỬA CÂU HỎI INLINE */
            <section style={styles.editorCard}>
              <h3 style={styles.editorTitle}>Chỉnh sửa Câu hỏi</h3>
              <form onSubmit={handleUpdateQuestion} style={styles.form}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Nội dung câu hỏi</label>
                  <textarea
                    value={editingQuestion.question_text}
                    onChange={(e) => setEditingQuestion({...editingQuestion, question_text: e.target.value})}
                    style={styles.textarea}
                    rows={3}
                    required
                  />
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Lựa chọn A</label>
                    <input
                      type="text"
                      value={editingQuestion.options[0]}
                      onChange={(e) => {
                        const newOpts = [...editingQuestion.options];
                        newOpts[0] = e.target.value;
                        setEditingQuestion({...editingQuestion, options: newOpts});
                      }}
                      style={styles.input}
                      required
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Lựa chọn B</label>
                    <input
                      type="text"
                      value={editingQuestion.options[1]}
                      onChange={(e) => {
                        const newOpts = [...editingQuestion.options];
                        newOpts[1] = e.target.value;
                        setEditingQuestion({...editingQuestion, options: newOpts});
                      }}
                      style={styles.input}
                      required
                    />
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Lựa chọn C</label>
                    <input
                      type="text"
                      value={editingQuestion.options[2]}
                      onChange={(e) => {
                        const newOpts = [...editingQuestion.options];
                        newOpts[2] = e.target.value;
                        setEditingQuestion({...editingQuestion, options: newOpts});
                      }}
                      style={styles.input}
                      required
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Lựa chọn D</label>
                    <input
                      type="text"
                      value={editingQuestion.options[3]}
                      onChange={(e) => {
                        const newOpts = [...editingQuestion.options];
                        newOpts[3] = e.target.value;
                        setEditingQuestion({...editingQuestion, options: newOpts});
                      }}
                      style={styles.input}
                      required
                    />
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Đáp án đúng (chọn trùng khớp)</label>
                    <select
                      value={editingQuestion.correct_answer}
                      onChange={(e) => setEditingQuestion({...editingQuestion, correct_answer: e.target.value})}
                      style={styles.select}
                    >
                      {editingQuestion.options.map((opt, i) => (
                        <option key={i} value={opt}>{opt || `Lựa chọn ${String.fromCharCode(65 + i)}`}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Mức Bloom</label>
                    <select
                      value={editingQuestion.bloom_level}
                      onChange={(e) => setEditingQuestion({...editingQuestion, bloom_level: parseInt(e.target.value)})}
                      style={styles.select}
                    >
                      <option value={1}>Nhớ (B1)</option>
                      <option value={2}>Hiểu (B2)</option>
                      <option value={3}>Vận dụng (B3)</option>
                      <option value={4}>Phân tích (B4)</option>
                      <option value={5}>Đánh giá (B5)</option>
                      <option value={6}>Sáng tạo (B6)</option>
                    </select>
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Chuẩn đầu ra (CLO)</label>
                  <select
                    value={editingQuestion.clo_id || ''}
                    onChange={(e) => setEditingQuestion({...editingQuestion, clo_id: e.target.value ? parseInt(e.target.value) : null})}
                    style={styles.select}
                  >
                    <option value="">Không liên kết</option>
                    {clos.map(c => (
                      <option key={c.id} value={c.id}>[{c.clo_code}] {c.description}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.editorActionRow}>
                  <button type="submit" style={styles.saveEditorBtn}>Lưu cập nhật</button>
                  <button type="button" onClick={() => setEditingQuestion(null)} style={styles.cancelEditorBtn}>Hủy</button>
                </div>
              </form>
            </section>
          ) : null}

          {/* DANH SÁCH CÂU HỎI */}
          <div style={styles.questionsList}>
            <div style={styles.listHeader}>
              <h3 style={{margin: 0, fontSize: '15px', fontWeight: '700'}}>Danh sách Câu hỏi Hiện tại ({questions.length} câu)</h3>
            </div>

            {loading ? (
              <div style={styles.loadingState}>Đang đồng bộ dữ liệu ngân hàng đề thi...</div>
            ) : questions.length === 0 ? (
              <div style={styles.emptyState}>
                <p>Chưa có câu hỏi nào trong môn học này.</p>
                <p style={{fontSize: '12px', color: '#64748b'}}>Hãy cấu hình bảng AI Generator ở bên trái để sinh tự động.</p>
              </div>
            ) : (
              questions.map((q, index) => {
                let opts = [];
                try {
                  opts = JSON.parse(q.options_json);
                } catch(e) {
                  opts = [];
                }
                const linkedClo = clos.find(c => c.id === q.clo_id);
                
                return (
                  <div key={q.id || index} style={styles.questionCard}>
                    <div style={styles.questionCardHeader}>
                      <div style={styles.questionCardMeta}>
                        <span style={styles.idxBadge}>Câu {index + 1}</span>
                        <span style={styles.bloomTag}>{getBloomText(q.bloom_level)}</span>
                        {linkedClo && <span style={styles.cloTag}>[{linkedClo.clo_code}] {linkedClo.description.substring(0, 40)}...</span>}
                      </div>
                      <div style={styles.actionButtons}>
                        <button 
                          onClick={() => handleGenerateIsomorphic(q.id)}
                          style={styles.actionBtnIso}
                          title="Sinh câu hỏi tương tự đồng cấu"
                        >
                          Clone Tương tự
                        </button>
                        <button 
                          onClick={() => handleEditClick(q)}
                          style={styles.actionBtnEdit}
                        >
                          Sửa
                        </button>
                        <button 
                          onClick={() => handleDeleteQuestion(q.id)}
                          style={styles.actionBtnDel}
                        >
                          Xóa
                        </button>
                      </div>
                    </div>

                    <div style={styles.questionText}>
                      <strong>{q.question_text}</strong>
                    </div>

                    <div style={styles.optionsGrid}>
                      {opts.map((opt, oIdx) => {
                        const isCorrect = opt === q.correct_answer;
                        return (
                          <div 
                            key={oIdx} 
                            style={isCorrect ? styles.optionItemCorrect : styles.optionItem}
                          >
                            <span style={isCorrect ? styles.optionLabelCorrect : styles.optionLabel}>
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span>{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
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
