import React from 'react';

const STEPS = [
  { id: 'syllabus', label: 'Cấu hình CLOs', view: 'course_config', icon: '📋' },
  { id: 'rag', label: 'Thư viện RAG', view: 'knowledge_base', icon: '📂' },
  { id: 'slides', label: 'Soạn Bài giảng', view: 'lesson_planner', icon: '📑' },
  { id: 'questions', label: 'Ngân hàng MCQ', view: 'question_bank', icon: '❓' },
  { id: 'matrix', label: 'Ma trận Bloom', view: 'matrix_dashboard', icon: '📊' }
];

export default function FlowSteps({ activeStep, onNavigate }) {
  const activeIdx = STEPS.findIndex(s => s.id === activeStep);

  return (
    <div style={styles.container}>
      {STEPS.map((step, idx) => {
        const isActive = step.id === activeStep;
        const isPast = activeIdx > idx;
        
        return (
          <React.Fragment key={step.id}>
            <div 
              onClick={() => onNavigate(step.view)}
              style={{
                ...styles.stepItem,
                color: isActive ? '#00d2ff' : (isPast ? '#10b981' : '#64748b'),
                background: isActive ? 'rgba(0, 210, 255, 0.08)' : 'transparent',
                borderColor: isActive ? 'rgba(0, 210, 255, 0.25)' : 'transparent',
                fontWeight: isActive ? '700' : '500',
              }}
              title={`Chuyển nhanh sang: ${step.label}`}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#cbd5e1';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = isPast ? '#10b981' : '#64748b';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '15px' }}>{step.icon}</span>
              <span style={styles.stepLabel}>{step.label}</span>
              {isPast && (
                <span style={styles.checkIcon}>✓</span>
              )}
            </div>
            {idx < STEPS.length - 1 && (
              <span style={{
                ...styles.arrow,
                color: isPast ? '#10b981' : 'rgba(255, 255, 255, 0.08)'
              }}>➔</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(15, 23, 42, 0.55)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
    padding: '3px 6px',
    gap: '4px',
    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(10px)',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: '10px',
    fontSize: '12px',
    transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
    userSelect: 'none',
    border: '1px solid transparent',
  },
  stepLabel: {
    whiteSpace: 'nowrap',
  },
  checkIcon: {
    fontSize: '11px',
    color: '#10b981',
    fontWeight: '800',
    background: 'rgba(16, 185, 129, 0.12)',
    borderRadius: '50%',
    width: '13px',
    height: '13px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: '11px',
    fontWeight: 'bold',
    userSelect: 'none',
    padding: '0 2px',
  }
};
