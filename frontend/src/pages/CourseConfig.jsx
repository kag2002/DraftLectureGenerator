import React from 'react';

export default function CourseConfig({ course, onBack }) {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>← Quay lại Dashboard</button>
        <div>
          <span style={styles.badge}>{course.course_code}</span>
          <h2 style={styles.courseTitle}>{course.course_name}</h2>
        </div>
      </header>
      
      <main style={styles.card}>
        <h3>Syllabus Ingestion & CLO Configuration</h3>
        <p style={{color: '#94a3b8', fontSize: '14px'}}>
          Chức năng upload Syllabus và bóc tách Chuẩn đầu ra (CLO) đang được thiết lập theo kế hoạch Tuần 2.
        </p>
      </main>
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
    gap: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '20px',
    marginBottom: '35px',
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
  card: {
    background: 'rgba(30, 41, 59, 0.45)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '20px',
    padding: '40px',
    maxWidth: '600px',
    margin: '0 auto',
    textAlign: 'center',
  }
};
