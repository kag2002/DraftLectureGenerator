import React, { useState, useEffect } from 'react';
import client from '../api/client';

export default function LessonPlanner({ course, onBack }) {
  // Navigation & States
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [activeLeftTab, setActiveLeftTab] = useState('outline'); // 'outline' | 'documents'
  
  // Chapter material states
  const [slideContent, setSlideContent] = useState('');
  const [activeLearningScript, setActiveLearningScript] = useState('');
  
  // AI recommendations
  const [aiSlideProposal, setAiSlideProposal] = useState('');
  const [aiActiveLearningProposal, setAiActiveLearningProposal] = useState('');
  
  // Document manager states
  const [documents, setDocuments] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  
  // AI Config modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [classSize, setClassSize] = useState(40);
  const [hasWifi, setHasWifi] = useState(true);
  const [furnitureType, setFurnitureType] = useState('movable');

  // Logs & stats (Monitoring badges)
  const [latency, setLatency] = useState(0);
  const [cost, setCost] = useState(0);
  const [apiStatus, setApiStatus] = useState('idle'); // 'idle' | 'generating' | 'success' | 'error'

  // Messages & Errors
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch chapters & documents list
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const chResponse = await client.get(`/api/courses/${course.id}/chapters`);
      setChapters(chResponse.data);
      if (chResponse.data.length > 0) {
        handleSelectChapter(chResponse.data[0]);
      }
      
      const docResponse = await client.get(`/api/courses/${course.id}/documents`);
      setDocuments(docResponse.data.documents || []);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi tải dữ liệu bài giảng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [course.id]);

  // Chọn chương học và load nội dung hiện có
  const handleSelectChapter = async (chapter) => {
    setSelectedChapter(chapter);
    setError('');
    setMessage('');
    
    try {
      const response = await client.get(`/api/courses/chapters/${chapter.id}/materials`);
      setSlideContent(response.data.slide_content || '');
      setActiveLearningScript(response.data.active_learning_script || '');
      // Clear AI proposals on select
      setAiSlideProposal('');
      setAiActiveLearningProposal('');
    } catch (err) {
      console.error(err);
      setError('Không thể load nội dung chương học.');
    }
  };

  // AI sinh cấu trúc Outline chương học từ CLOs
  const handleGenerateOutline = async () => {
    if (!window.confirm('AI sẽ sinh lại toàn bộ dàn ý chương học dựa trên CLOs. Các chương học cũ sẽ bị ghi đè. Bạn có chắc chắn không?')) return;
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const response = await client.post(`/api/courses/${course.id}/generate-outline`);
      setChapters(response.data.chapters);
      if (response.data.chapters.length > 0) {
        handleSelectChapter(response.data.chapters[0]);
      }
      setMessage('Đã sinh cấu trúc chương học bằng AI thành công!');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Không thể sinh cấu trúc Outline.');
    } finally {
      setLoading(false);
    }
  };

  // AI Sinh slide thô & kịch bản Active Learning bám RAG
  const handleGenerateMaterials = async () => {
    if (!selectedChapter) {
      setError('Vui lòng chọn hoặc sinh một chương học trước.');
      return;
    }
    
    setError('');
    setMessage('');
    setApiStatus('generating');
    setShowConfigModal(false);
    const startTime = Date.now();

    try {
      const response = await client.post(`/api/courses/chapters/${selectedChapter.id}/generate-materials`, {
        class_size: classSize,
        has_wifi: hasWifi,
        furniture_type: furnitureType
      });
      
      setAiSlideProposal(response.data.slide_content);
      setAiActiveLearningProposal(response.data.active_learning_script);
      setLatency(((Date.now() - startTime) / 1000).toFixed(1));
      setCost(0.04); // Giá mock cố định cho 1 lần sinh
      setApiStatus('success');
      setMessage('AI sinh học liệu thành công! Hãy xem và chèn vào khung biên tập bên phải.');
    } catch (err) {
      console.error(err);
      setApiStatus('error');
      setError('Lỗi khi AI sinh học liệu. Vui lòng nạp tài liệu giáo trình và thử lại.');
    }
  };

  // Upload tài liệu giáo trình RAG
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    
    setError('');
    setMessage('');
    setLoading(true);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      await client.post(`/api/courses/${course.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDocuments([uploadFile.name, ...documents]);
      setUploadFile(null);
      setMessage('Nạp tài liệu nguồn thành công! Vector DB đã được cập nhật.');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi tải tài liệu lên Vector DB.');
    } finally {
      setLoading(false);
    }
  };

  // Xóa tài liệu RAG
  const handleDeleteDocument = async (fileName) => {
    if (!window.confirm(`Bạn muốn xóa tài liệu tham chiếu '${fileName}' khỏi RAG?`)) return;
    setError('');
    
    try {
      await client.delete(`/api/courses/${course.id}/documents/${fileName}`);
      setDocuments(documents.filter(d => d !== fileName));
      setMessage('Đã xóa tài liệu khỏi Vector DB.');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi xóa tài liệu.');
    }
  };

  // Lưu bản soạn thảo chính của giảng viên xuống DB
  const handleSaveMaterials = async () => {
    if (!selectedChapter) return;
    setError('');
    setMessage('');
    setSaving(true);

    try {
      await client.put(`/api/courses/chapters/${selectedChapter.id}/materials`, {
        slide_content: slideContent,
        active_learning_script: activeLearningScript
      });
      setMessage('Đã lưu học liệu thành công lên hệ thống Cloud!');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi lưu học liệu.');
    } finally {
      setSaving(false);
    }
  };

  const [saving, setSaving] = useState(false);

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={onBack} style={styles.backBtn}>← Back</button>
          <div>
            <span style={styles.badge}>{course.course_code}</span>
            <h2 style={styles.courseTitle}>{course.course_name}</h2>
          </div>
        </div>

        {/* MONITORING API BADGE */}
        <div style={styles.monitorBadge}>
          <span style={styles.statusIndicator(apiStatus)}>● API Status: {apiStatus.toUpperCase()}</span>
          <span>Latency: {latency}s</span>
          <span>Cost: ${cost}</span>
          <button style={styles.traceBtn} onClick={() => alert('Chỉ xem trace ở môi trường Dev.')}>Trace</button>
        </div>
      </header>

      {error && <div style={styles.errorAlert}>{error}</div>}
      {message && <div style={styles.successAlert}>{message}</div>}

      <div style={styles.layout}>
        {/* CỘT 1: SIDEBAR TABS (OUTLINE & DOCUMENTS) */}
        <aside style={styles.sidebar}>
          <div style={styles.tabHeader}>
            <button 
              onClick={() => setActiveLeftTab('outline')} 
              style={activeLeftTab === 'outline' ? styles.activeTab : styles.inactiveTab}
            >
              📚 Outline
            </button>
            <button 
              onClick={() => setActiveLeftTab('documents')} 
              style={activeLeftTab === 'documents' ? styles.activeTab : styles.inactiveTab}
            >
              📂 Tài Liệu
            </button>
          </div>

          <div style={styles.tabContent}>
            {activeLeftTab === 'outline' ? (
              <div>
                <div style={styles.outlineActions}>
                  <button onClick={handleGenerateOutline} style={styles.aiOutlineBtn}>Sinh Dàn Ý Bằng AI</button>
                </div>
                {chapters.length === 0 ? (
                  <div style={styles.emptyState}>Chưa có dàn ý chương học. Bấm nút phía trên để AI gợi ý.</div>
                ) : (
                  <div style={styles.chapterList}>
                    {chapters.map((ch, idx) => (
                      <div 
                        key={ch.id} 
                        onClick={() => handleSelectChapter(ch)}
                        style={selectedChapter?.id === ch.id ? styles.activeChapterCard : styles.chapterCard}
                      >
                        <span style={styles.chapterOrder}>{idx + 1}</span>
                        <div style={{flex: 1}}>
                          <div style={styles.chapterTitle}>{ch.title}</div>
                          <div style={styles.chapterDesc}>{ch.description || 'Chưa có mô tả.'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Upload File */}
                <form onSubmit={handleUploadDocument} style={styles.uploadForm}>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    style={styles.fileInput}
                  />
                  <button type="submit" disabled={!uploadFile} style={styles.uploadBtn}>
                    Nạp Vào RAG (Vector DB)
                  </button>
                </form>

                {/* Danh sách file đã nạp */}
                <div style={styles.docList}>
                  <h4 style={styles.subTitle}>Tài liệu RAG đã nạp:</h4>
                  {documents.length === 0 ? (
                    <div style={styles.emptyState}>Chưa nạp tài liệu tham khảo nào cho môn này.</div>
                  ) : (
                    documents.map((doc, idx) => (
                      <div key={idx} style={styles.docItem}>
                        <span style={styles.docName} title={doc}>📄 {doc}</span>
                        <button onClick={() => handleDeleteDocument(doc)} style={styles.deleteDocBtn}>🗑️</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* CỘT 2: AI PROPOSALS PANEL (CHÍNH GIỮA) */}
        <section style={styles.aiProposalPanel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.sectionTitle}>AI Đề Xuất Học Liệu</h3>
            {selectedChapter && (
              <button onClick={() => setShowConfigModal(true)} style={styles.generateBtn}>
                ✨ {aiSlideProposal ? 'Sinh Lại Học Liệu' : 'Sinh Học Liệu'}
              </button>
            )}
          </div>

          <div style={styles.proposalScroll}>
            {selectedChapter ? (
              !aiSlideProposal ? (
                <div style={styles.emptyState}>
                  <p>Chọn một chương bên trái và bấm <strong>Sinh Học Liệu</strong> để AI trích xuất giáo trình sinh Slide nháp.</p>
                </div>
              ) : (
                <div style={styles.proposalBlocks}>
                  <div style={styles.proposalBlock}>
                    <div style={styles.blockHeader}>
                      <span style={styles.blockTitle}>📝 Đề xuất Slide (Markdown)</span>
                      <button 
                        onClick={() => setSlideContent(slideContent + '\n\n' + aiSlideProposal)}
                        style={styles.insertBtn}
                      >
                        Chèn vào Editor →
                      </button>
                    </div>
                    <pre style={styles.proposalCode}>{aiSlideProposal}</pre>
                  </div>

                  <div style={styles.proposalBlock}>
                    <div style={styles.blockHeader}>
                      <span style={styles.blockTitle}>🏃 Kịch bản Tương tác (Active Learning)</span>
                      <button 
                        onClick={() => setActiveLearningScript(activeLearningScript + '\n\n' + aiActiveLearningProposal)}
                        style={styles.insertBtn}
                      >
                        Chèn vào Editor →
                      </button>
                    </div>
                    <div style={styles.proposalText}>{aiActiveLearningProposal}</div>
                  </div>
                </div>
              )
            ) : (
              <div style={styles.emptyState}>Vui lòng chọn một môn học hoặc chương học.</div>
            )}
          </div>
        </section>

        {/* CỘT 3: KHUNG BIÊN TẬP CỦA GIẢNG VIÊN (BÊN PHẢI) */}
        <section style={styles.editorPanel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.sectionTitle}>Bản soạn thảo chương học</h3>
            <button onClick={handleSaveMaterials} disabled={saving} style={styles.saveBtn}>
              {saving ? 'Đang Lưu...' : '💾 Lưu Bài Giảng'}
            </button>
          </div>

          {selectedChapter ? (
            <div style={styles.editorContainer}>
              <div style={styles.editorField}>
                <label style={styles.fieldLabel}>Slide bài giảng của bạn (Markdown)</label>
                <textarea
                  value={slideContent}
                  onChange={(e) => setSlideContent(e.target.value)}
                  placeholder="Viết slide của bạn ở đây... (Hoặc chèn đề xuất từ AI bên trái sang)"
                  style={styles.textareaEditor}
                  rows={12}
                />
              </div>

              <div style={styles.editorField}>
                <label style={styles.fieldLabel}>Kịch bản giảng dạy / Active Learning</label>
                <textarea
                  value={activeLearningScript}
                  onChange={(e) => setActiveLearningScript(e.target.value)}
                  placeholder="Lịch trình giảng dạy, câu hỏi tương tác trên lớp..."
                  style={styles.textareaEditor}
                  rows={8}
                />
              </div>
            </div>
          ) : (
            <div style={styles.emptyState}>Chọn chương để soạn giáo án.</div>
          )}
        </section>
      </div>

      {/* MODAL CONFIG SƯ PHẠM (POPUP CẤU HÌNH ACTIVE LEARNING) */}
      {showConfigModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Cấu hình Sư phạm Lớp học</h3>
            
            <div style={styles.modalField}>
              <label style={styles.modalLabel}>Sĩ số lớp (Sinh viên):</label>
              <input
                type="number"
                value={classSize}
                onChange={(e) => setClassSize(parseInt(e.target.value))}
                style={styles.modalInput}
              />
            </div>

            <div style={styles.modalField}>
              <label style={styles.modalLabel}>Mạng Wifi lớp học:</label>
              <select
                value={hasWifi ? 'yes' : 'no'}
                onChange={(e) => setHasWifi(e.target.value === 'yes')}
                style={styles.modalSelect}
              >
                <option value="yes">Có Wifi kết nối</option>
                <option value="no">Không có Wifi</option>
              </select>
            </div>

            <div style={styles.modalField}>
              <label style={styles.modalLabel}>Cách bố trí bàn ghế:</label>
              <select
                value={furnitureType}
                onChange={(e) => setFurnitureType(e.target.value)}
                style={styles.modalSelect}
              >
                <option value="movable">Di động (Movable - dễ xếp nhóm)</option>
                <option value="fixed">Cố định (Fixed - chỉ thảo luận tại chỗ)</option>
              </select>
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowConfigModal(false)} style={styles.modalCancelBtn}>Hủy</button>
              <button onClick={handleGenerateMaterials} style={styles.modalConfirmBtn}>Bắt đầu sinh học liệu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at 10% 20%, rgb(15, 23, 42) 0%, rgb(9, 13, 26) 90%)',
    fontFamily: '"Outfit", "Inter", sans-serif',
    color: '#f8fafc',
    padding: '25px 30px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '15px',
    marginBottom: '20px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  backBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#cbd5e1',
    borderRadius: '8px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
  },
  badge: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
    display: 'inline-block',
  },
  courseTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
  },
  monitorBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '6px 15px',
    fontSize: '11px',
    color: '#94a3b8',
  },
  statusIndicator: (status) => ({
    color: status === 'generating' ? '#f59e0b' : status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : '#64748b',
    fontWeight: '700',
  }),
  traceBtn: {
    background: 'none',
    border: 'none',
    color: '#6366f1',
    cursor: 'pointer',
    fontWeight: '600',
    textDecoration: 'underline',
    padding: 0,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr 1fr',
    gap: '20px',
    height: 'calc(100vh - 120px)',
  },
  sidebar: {
    background: 'rgba(30, 41, 59, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tabHeader: {
    display: 'flex',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    background: 'rgba(15, 23, 42, 0.3)',
  },
  activeTab: {
    flex: 1,
    background: 'none',
    border: 'none',
    borderBottom: '2px solid #6366f1',
    color: '#f8fafc',
    padding: '12px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  inactiveTab: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#64748b',
    padding: '12px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  tabContent: {
    padding: '15px',
    flex: 1,
    overflowY: 'auto',
  },
  outlineActions: {
    marginBottom: '15px',
  },
  aiOutlineBtn: {
    width: '100%',
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  chapterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  chapterCard: {
    display: 'flex',
    gap: '10px',
    padding: '12px',
    borderRadius: '10px',
    background: 'rgba(15, 23, 42, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeChapterCard: {
    display: 'flex',
    gap: '10px',
    padding: '12px',
    borderRadius: '10px',
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    cursor: 'pointer',
    boxShadow: '0 0 10px rgba(99, 102, 241, 0.1)',
  },
  chapterOrder: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#94a3b8',
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: '700',
  },
  chapterTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: '4px',
  },
  chapterDesc: {
    fontSize: '11px',
    color: '#64748b',
    lineHeight: '130%',
  },
  uploadForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
  },
  fileInput: {
    color: '#94a3b8',
    fontSize: '12px',
  },
  uploadBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  docList: {
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '15px',
  },
  subTitle: {
    fontSize: '12px',
    color: '#cbd5e1',
    margin: '0 0 10px 0',
  },
  docItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(15, 23, 42, 0.2)',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '8px',
  },
  docName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '220px',
  },
  deleteDocBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
  },
  aiProposalPanel: {
    background: 'rgba(30, 41, 59, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    background: 'rgba(15, 23, 42, 0.2)',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#e2e8f0',
    margin: 0,
  },
  generateBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  proposalScroll: {
    padding: '20px',
    flex: 1,
    overflowY: 'auto',
  },
  proposalBlocks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  proposalBlock: {
    background: 'rgba(15, 23, 42, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  blockHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.02)',
    padding: '10px 15px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  },
  blockTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#cbd5e1',
  },
  insertBtn: {
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  proposalCode: {
    padding: '15px',
    margin: 0,
    fontSize: '12px',
    fontFamily: 'Consolas, monospace',
    color: '#e2e8f0',
    whiteSpace: 'pre-wrap',
    background: '#090d1a',
  },
  proposalText: {
    padding: '15px',
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: '145%',
    whiteSpace: 'pre-wrap',
  },
  editorPanel: {
    background: 'rgba(30, 41, 59, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  saveBtn: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  editorContainer: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    flex: 1,
    overflowY: 'auto',
  },
  editorField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#cbd5e1',
  },
  textareaEditor: {
    width: '100%',
    background: '#0f172a',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '15px',
    color: '#f8fafc',
    fontSize: '13px',
    fontFamily: 'inherit',
    lineHeight: '145%',
    outline: 'none',
    resize: 'none',
  },
  emptyState: {
    color: '#64748b',
    textAlign: 'center',
    padding: '60px 20px',
    fontSize: '13px',
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '12px',
    marginBottom: '15px',
  },
  successAlert: {
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#a7f3d0',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '12px',
    marginBottom: '15px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalCard: {
    background: '#1e293b',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    padding: '30px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
  },
  modalTitle: {
    margin: '0 0 20px 0',
    fontSize: '18px',
    fontWeight: '700',
    textAlign: 'center',
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '15px',
  },
  modalLabel: {
    fontSize: '12px',
    color: '#cbd5e1',
    fontWeight: '600',
  },
  modalInput: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '10px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
  },
  modalSelect: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '10px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '25px',
  },
  modalCancelBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    padding: '10px 15px',
  },
  modalConfirmBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  }
};
