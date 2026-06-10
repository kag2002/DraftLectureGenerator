import React from 'react';
import SlideProposalPreview from './SlideProposalPreview';
import { MarkdownPreview } from '../utils/markdown';
import { THEMES } from '../utils/slideParser';

export default function EditorPanel({
  selectedChapter,
  activeWorkTab,
  slideContent,
  setSlideContent,
  savedSlideContent,
  activeLearningScript,
  setActiveLearningScript,
  savedScript,
  slideEditMode,
  setSlideEditMode,
  scriptEditMode,
  setScriptEditMode,
  selectedTheme,
  setSelectedTheme,
  exporting,
  saving,
  isFullscreen,
  setIsFullscreen,
  handleExportPPTX,
  handleExportLessonPlan,
  handleSaveMaterials,
  handleResetMaterials,
  handleCitationClick,
  renderSlideCharCheckers,
  parseActiveLearningScript,
  styles
}) {
  return (
    <section style={{
      ...styles.editorPanel,
      ...(isFullscreen ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        background: 'radial-gradient(circle at 10% 20%, rgb(15, 23, 42) 0%, rgb(9, 13, 26) 90%)',
        borderRadius: 0,
        padding: '30px',
        boxSizing: 'border-box',
      } : {})
    }}>
      <div style={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={styles.sectionTitle}>Bản soạn thảo chương học</h3>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)} 
            style={{
              background: isFullscreen ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
              border: isFullscreen ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
              color: isFullscreen ? '#fca5a5' : '#a5b4fc',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title={isFullscreen ? 'Thu nhỏ cửa sổ soạn thảo' : 'Phóng to cửa sổ soạn thảo'}
          >
            {isFullscreen ? '🗗 Thu nhỏ' : '🗖 Toàn màn hình'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectedChapter && slideContent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Theme:</span>
              <select 
                value={selectedTheme} 
                onChange={(e) => setSelectedTheme(e.target.value)} 
                style={{
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  outline: 'none',
                  cursor: 'pointer',
                  marginRight: '8px'
                }}
              >
                {Object.keys(THEMES).map(t => (
                  <option key={t} value={t}>{THEMES[t].name}</option>
                ))}
              </select>
              <button onClick={handleExportPPTX} disabled={exporting} style={styles.exportBtn}>
                {exporting ? 'Đang Xuất...' : '📥 Xuất PPTX'}
              </button>
              {activeLearningScript && (
                <button onClick={handleExportLessonPlan} style={{ ...styles.exportBtn, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', marginLeft: '6px' }}>
                  📋 In Giáo án
                </button>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', marginRight: '10px' }}>
            {saving ? (
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>⏳ Đang lưu...</span>
            ) : (slideContent !== savedSlideContent || activeLearningScript !== savedScript) ? (
              <span style={{ fontSize: '11px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbbf24' }} /> Có thay đổi chưa lưu
              </span>
            ) : selectedChapter ? (
              <span style={{ fontSize: '11px', color: '#10b981' }}>✓ Đã đồng bộ Cloud</span>
            ) : null}
          </div>
          <button onClick={handleSaveMaterials} disabled={saving} style={styles.saveBtn}>
            {saving ? 'Đang Lưu...' : '💾 Lưu Bài Giảng'}
          </button>
          {selectedChapter && (slideContent || activeLearningScript) && (
            <button 
              onClick={handleResetMaterials} 
              disabled={saving}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#fca5a5',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                marginLeft: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s'
              }}
              title="Xóa/Reset toàn bộ học liệu chương này"
            >
              🗑️ Reset
            </button>
          )}
        </div>
      </div>

      {selectedChapter ? (
        <div style={styles.editorContainer}>
          {activeWorkTab === 'slides' ? (
            <div style={styles.editorField}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={styles.fieldLabel}>Slide bài giảng của bạn (Markdown)</label>
                <div style={styles.tabToggleContainer}>
                  <button 
                    onClick={() => setSlideEditMode('edit')} 
                    style={slideEditMode === 'edit' ? styles.tabToggleActive : styles.tabToggleInactive}
                  >
                    Sửa
                  </button>
                  <button 
                    onClick={() => setSlideEditMode('preview')} 
                    style={slideEditMode === 'preview' ? styles.tabToggleActive : styles.tabToggleInactive}
                  >
                    Xem trước
                  </button>
                </div>
              </div>
              {slideEditMode === 'edit' ? (
                <>
                  <textarea
                    value={slideContent}
                    onChange={(e) => setSlideContent(e.target.value)}
                    placeholder="Viết slide của bạn ở đây... (Hoặc chèn đề xuất từ AI bên trái sang)"
                    style={{
                      ...styles.textareaEditor,
                      resize: 'vertical',
                      height: isFullscreen ? 'calc(100vh - 220px)' : 'calc(100vh - 350px)',
                    }}
                  />
                  {renderSlideCharCheckers()}
                </>
              ) : (
                <SlideProposalPreview mdContent={slideContent} apiStatus="idle" themeName={selectedTheme} onCitationClick={handleCitationClick} />
              )}
            </div>
          ) : (
            <div style={styles.editorField}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={styles.fieldLabel}>Kịch bản giảng dạy / Active Learning</label>
                <div style={styles.tabToggleContainer}>
                  <button 
                    onClick={() => setScriptEditMode('edit')} 
                    style={scriptEditMode === 'edit' ? styles.tabToggleActive : styles.tabToggleInactive}
                  >
                    Sửa
                  </button>
                  <button 
                    onClick={() => setScriptEditMode('preview')} 
                    style={scriptEditMode === 'preview' ? styles.tabToggleActive : styles.tabToggleInactive}
                  >
                    Xem trước
                  </button>
                </div>
              </div>
              {scriptEditMode === 'edit' ? (
                <textarea
                  value={activeLearningScript}
                  onChange={(e) => setActiveLearningScript(e.target.value)}
                  placeholder="Lịch trình giảng dạy, câu hỏi tương tác trên lớp..."
                  style={{
                    ...styles.textareaEditor,
                    resize: 'vertical',
                    height: isFullscreen ? 'calc(100vh - 220px)' : 'calc(100vh - 350px)',
                  }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <MarkdownPreview 
                    content={parseActiveLearningScript(activeLearningScript).mainScript} 
                    style={{ minHeight: '350px', maxHeight: '450px', overflowY: 'auto' }} 
                  />
                  {parseActiveLearningScript(activeLearningScript).rationale && (
                    <div style={{
                      padding: '16px',
                      background: 'rgba(16, 185, 129, 0.05)',
                      border: '1px solid rgba(16, 185, 129, 0.15)',
                      borderRadius: '12px'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#34d399', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>💡 Giải trình Sư phạm (Pedagogical Rationale):</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: '145%', fontStyle: 'italic' }}>
                        {parseActiveLearningScript(activeLearningScript).rationale}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.emptyState}>Chọn chương để soạn giáo án.</div>
      )}
    </section>
  );
}
