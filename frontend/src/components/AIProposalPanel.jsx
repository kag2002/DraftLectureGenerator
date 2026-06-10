import React from 'react';
import SlideProposalPreview from './SlideProposalPreview';
import { renderMarkdown } from '../utils/markdown';

export default function AIProposalPanel({
  selectedChapter,
  activeWorkTab,
  aiSlideProposal,
  aiActiveLearningProposal,
  apiStatus,
  genLog,
  slideContent,
  setSlideContent,
  activeLearningScript,
  setActiveLearningScript,
  selectedTheme,
  slideProposalViewMode,
  setSlideProposalViewMode,
  handleCitationClick,
  setShowConfigModal,
  currentStage,
  parseActiveLearningScript,
  styles
}) {
  
  const renderStepper = () => {
    const steps = [
      { id: 1, name: "Truy xuất RAG", desc: "Tìm các đoạn trích từ tài liệu nguồn" },
      { id: 2, name: "Dàn ý Slide", desc: "AI thiết kế nội dung các slide bài giảng" },
      { id: 3, name: "Kịch bản Tương tác", desc: "Thiết kế hoạt động Active Learning lớp học" },
      { id: 4, name: "Lưu trữ & Đồng bộ", desc: "Đồng bộ hóa học liệu vào Vector DB" }
    ];

    return (
      <div style={{
        background: 'rgba(30, 41, 59, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8', animation: 'pulse 1.5s infinite' }} />
          TIẾN TRÌNH AI SOẠN BÀI GIẢNG:
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginTop: '5px' }}>
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '30px',
            right: '30px',
            height: '2px',
            background: 'rgba(255, 255, 255, 0.08)',
            zIndex: 1
          }} />
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '30px',
            width: `${((currentStage - 1) / 3) * 100}%`,
            height: '2px',
            background: 'linear-gradient(90deg, #6366f1, #00d2ff)',
            zIndex: 1,
            transition: 'width 0.3s ease'
          }} />

          {steps.map((step) => {
            const isActive = currentStage === step.id;
            const isCompleted = currentStage > step.id;
            
            let circleBg = 'rgba(15, 23, 42, 0.8)';
            let circleBorder = '1px solid rgba(255, 255, 255, 0.08)';
            let iconColor = '#64748b';
            let icon = step.id;

            if (isActive) {
              circleBg = 'rgba(99, 102, 241, 0.15)';
              circleBorder = '2px solid #6366f1';
              iconColor = '#a5b4fc';
            } else if (isCompleted) {
              circleBg = 'rgba(16, 185, 129, 0.15)';
              circleBorder = '1px solid #10b981';
              iconColor = '#34d399';
              icon = '✓';
            }

            return (
              <div key={step.id} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '80px',
                textAlign: 'center',
                zIndex: 2
              }}>
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: circleBg,
                  border: circleBorder,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: iconColor,
                  transition: 'all 0.3s ease',
                  boxShadow: isActive ? '0 0 10px rgba(99, 102, 241, 0.3)' : 'none'
                }}>
                  {icon}
                </div>
                <span style={{
                  fontSize: '9px',
                  fontWeight: '700',
                  color: isActive ? '#f8fafc' : isCompleted ? '#34d399' : '#64748b',
                  marginTop: '6px',
                  transition: 'color 0.3s ease'
                }}>
                  {step.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section style={styles.aiProposalPanel}>
      <div style={styles.panelHeader}>
        <h3 style={styles.sectionTitle}>AI Đề xuất nội dung</h3>
        {selectedChapter && (
          <button onClick={() => setShowConfigModal(true)} style={styles.generateBtn}>
            ✨ {aiSlideProposal ? 'Tạo lại Bài giảng' : 'Tạo Bài giảng'}
          </button>
        )}
      </div>

      <div style={styles.proposalScroll}>
        {apiStatus === 'generating' && genLog && (
          <div style={styles.genLogBox}>
            <div style={styles.pulseDot}></div>
            <span style={styles.logText}>{genLog}</span>
          </div>
        )}
        
        {selectedChapter ? (
          (!aiSlideProposal && !aiActiveLearningProposal && apiStatus !== 'generating') ? (
            <div style={styles.emptyState}>
              <p>Chọn một chương ở cột bên trái và bấm <strong>Tạo bài giảng & Giáo án</strong> để AI trích xuất nội dung đề xuất.</p>
            </div>
          ) : (
            <>
              {apiStatus === 'generating' && renderStepper()}
              <div style={styles.proposalBlocks}>
                {activeWorkTab === 'slides' ? (
                  <div style={styles.proposalBlock}>
                    <div style={styles.blockHeader}>
                      <span style={styles.blockTitle}>🖼️ Đề xuất Slide Bài giảng</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={styles.tabToggleContainer}>
                          <button 
                            onClick={() => setSlideProposalViewMode('visual')} 
                            style={slideProposalViewMode === 'visual' ? styles.tabToggleActive : styles.tabToggleInactive}
                          >
                            Trực quan
                          </button>
                          <button 
                            onClick={() => setSlideProposalViewMode('code')} 
                            style={slideProposalViewMode === 'code' ? styles.tabToggleActive : styles.tabToggleInactive}
                          >
                            Mã nguồn
                          </button>
                        </div>
                        <button 
                          onClick={() => setSlideContent(slideContent + '\n\n' + aiSlideProposal)}
                          disabled={apiStatus === 'generating'}
                          style={styles.insertBtn}
                        >
                          Chèn vào Bản soạn thảo →
                        </button>
                      </div>
                    </div>
                    {slideProposalViewMode === 'code' ? (
                      <pre style={styles.proposalCode}>{aiSlideProposal || (apiStatus === 'generating' ? '⏳ Đang thiết kế slide...' : '')}</pre>
                    ) : (
                      <SlideProposalPreview mdContent={aiSlideProposal} apiStatus={apiStatus} themeName={selectedTheme} onCitationClick={handleCitationClick} />
                    )}
                  </div>
                ) : (
                  <div style={styles.proposalBlock}>
                    <div style={styles.blockHeader}>
                      <span style={styles.blockTitle}>🏃 Kịch bản tương tác (Active Learning)</span>
                      <button 
                        onClick={() => setActiveLearningScript(activeLearningScript + '\n\n' + aiActiveLearningProposal)}
                        disabled={apiStatus === 'generating'}
                        style={styles.insertBtn}
                      >
                        Chèn vào Bản soạn thảo →
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div 
                        style={{ 
                          ...styles.proposalText, 
                          borderBottom: parseActiveLearningScript(aiActiveLearningProposal).rationale ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          whiteSpace: 'pre-wrap'
                        }}
                        dangerouslySetInnerHTML={{ 
                          __html: parseActiveLearningScript(aiActiveLearningProposal).mainScript 
                            ? renderMarkdown(parseActiveLearningScript(aiActiveLearningProposal).mainScript) 
                            : (apiStatus === 'generating' ? '⏳ Đang thiết kế kịch bản hoạt động...' : '') 
                        }}
                      />
                      {parseActiveLearningScript(aiActiveLearningProposal).rationale && (
                        <div style={{
                          padding: '15px',
                          background: 'rgba(99, 102, 241, 0.05)',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#a5b4fc', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>💡 Giải trình Sư phạm của Trợ lý AI:</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '145%', fontStyle: 'italic' }}>
                            {parseActiveLearningScript(aiActiveLearningProposal).rationale}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )
        ) : (
          <div style={styles.emptyState}>Vui lòng chọn một môn học hoặc chương học.</div>
        )}
      </div>
    </section>
  );
}
