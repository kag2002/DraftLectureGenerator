import React from 'react';

export default function LessonPlannerSidebar({
  chapters,
  selectedChapter,
  activeLeftTab,
  setActiveLeftTab,
  clos,
  documents,
  uploadFile,
  setUploadFile,
  loading,
  handleSelectChapter,
  handleGenerateOutline,
  handleUploadDocument,
  handleDeleteDocument,
  handleWebSearch,
  searchQuery,
  setSearchQuery,
  searching,
  showAdvancedSearch,
  setShowAdvancedSearch,
  maxResults,
  setMaxResults,
  credibilityThreshold,
  setCredibilityThreshold,
  suggestedQueries,
  searchResult,
  expandedSearch,
  toggleSearchDetail,
  handleSummarizeContent,
  summarizing,
  summaries,
  selectedRejected,
  setSelectedRejected,
  handleForceIngest,
  isCloCovered,
  renderJustifications,
  styles
}) {
  return (
    <aside style={styles.sidebar}>
      <div style={{
        display: 'flex',
        background: 'rgba(15, 23, 42, 0.45)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '4px',
        gap: '4px'
      }}>
        <button 
          onClick={() => setActiveLeftTab('outline')}
          style={{
            flex: 1,
            background: activeLeftTab === 'outline' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            border: 'none',
            color: activeLeftTab === 'outline' ? '#a5b4fc' : '#64748b',
            padding: '8px 4px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          📚 Dàn ý
        </button>
        <button 
          onClick={() => setActiveLeftTab('documents')}
          style={{
            flex: 1,
            background: activeLeftTab === 'documents' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            border: 'none',
            color: activeLeftTab === 'documents' ? '#a5b4fc' : '#64748b',
            padding: '8px 4px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          📄 Tài liệu RAG
        </button>
        <button 
          onClick={() => setActiveLeftTab('compliance')}
          style={{
            flex: 1,
            background: activeLeftTab === 'compliance' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            border: 'none',
            color: activeLeftTab === 'compliance' ? '#a5b4fc' : '#64748b',
            padding: '8px 4px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          ⚖️ Checklist CLO
        </button>
      </div>
      
      <div style={styles.sidebarContent}>
        {activeLeftTab === 'outline' && (
          <>
            <div style={styles.outlineActions}>
              <button 
                onClick={handleGenerateOutline} 
                style={styles.aiOutlineBtn}
                disabled={loading}
              >
                {loading ? '⏳ Đang sinh dàn ý...' : '🪄 Gợi ý Dàn ý chương học'}
              </button>
            </div>
            {loading && (
              <div style={{
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                color: '#a5b4fc',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12px',
                textAlign: 'center',
                margin: '10px 15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <span style={styles.pulseDot || {
                  width: '8px',
                  height: '8px',
                  background: '#818cf8',
                  borderRadius: '50%',
                  display: 'inline-block'
                }} />
                AI đang sinh cấu trúc chương học...
              </div>
            )}
            {chapters.length === 0 && !loading ? (
              <div style={styles.emptyState}>Chưa có dàn ý chương học. Bấm nút phía trên để AI gợi ý.</div>
            ) : (
              <div style={{ ...styles.chapterList, opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
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
          </>
        )}


        {activeLeftTab === 'documents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h4 style={{ ...styles.subTitle, margin: '0 0 10px 0' }}>📁 Nạp giáo trình / tài liệu nguồn (RAG)</h4>
              <form onSubmit={handleUploadDocument} style={styles.uploadForm}>
                <input 
                  type="file" 
                  onChange={(e) => setUploadFile(e.target.files[0])} 
                  style={styles.fileInput}
                  accept=".pdf,.docx,.txt"
                />
                <button type="submit" style={styles.uploadBtn} disabled={loading || !uploadFile}>
                  {loading ? 'Đang tải lên...' : 'Nạp tài liệu lên Vector DB'}
                </button>
              </form>
              <div style={{ ...styles.docList, borderTop: 'none', paddingTop: '0' }}>
                {documents.length === 0 ? (
                  <div style={styles.emptyState}>Chưa có tài liệu nguồn.</div>
                ) : (
                  documents.map((doc, idx) => (
                    <div key={idx} style={styles.docItem}>
                      <span style={styles.docName} title={doc}>📄 {doc}</span>
                      <button onClick={() => handleDeleteDocument(doc)} style={styles.deleteDocBtn} title="Xóa tài liệu">❌</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}        {activeLeftTab === 'compliance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <h4 style={{ ...styles.subTitle, margin: '0 0 4px 0' }}>⚖️ Syllabus Compliance Checklist</h4>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 15px 0', lineHeight: '1.4' }}>
                Hệ thống tự động quét các tag chuẩn đầu ra <code>[CLO: CLO_CODE]</code> trong slide bài giảng để kiểm tra độ phủ.
              </p>
            </div>
            
            {clos.length === 0 ? (
              <div style={styles.emptyState}>Môn học này chưa có danh sách chuẩn đầu ra CLO.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {clos.map((clo) => {
                  const covered = isCloCovered(clo.clo_code);
                  return (
                    <div 
                      key={clo.id}
                      style={{
                        background: covered ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                        border: covered ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: '700', 
                          color: covered ? '#34d399' : '#a5b4fc',
                          background: covered ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {clo.clo_code}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: covered ? '#34d399' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {covered ? '✓ Đã phủ' : '✗ Chưa phủ'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: '1.4' }}>
                        {clo.description}
                      </div>
                      <div style={{ 
                        fontSize: '10px', 
                        color: '#94a3b8', 
                        borderTop: '1px solid rgba(255,255,255,0.03)', 
                        paddingTop: '4px',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>Thang Bloom mục tiêu: Mức {clo.bloom_level}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
