import React, { useState, useEffect } from 'react';
import client from '../api/client';

export default function Dashboard({ user, onLogout, onSelectCourse }) {
  const [courses, setCourses] = useState([]);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Lấy danh sách môn học của User từ API
  const fetchCourses = async () => {
    setLoading(true);
    try {
      const response = await client.get('/api/courses');
      setCourses(response.data);
    } catch (err) {
      console.error(err);
      setError('Không thể lấy danh sách môn học. Vui lòng tải lại trang.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await client.post('/api/courses', {
        course_code: courseCode,
        course_name: courseName
      });
      setCourses([response.data, ...courses]);
      setCourseCode('');
      setCourseName('');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi tạo môn học mới.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCourse = async (id, e) => {
    e.stopPropagation(); // Ngăn sự kiện click vào Card kích hoạt select course
    if (!window.confirm('Bạn có chắc chắn muốn xóa môn học này không?')) return;

    try {
      await client.delete(`/api/courses/${id}`);
      setCourses(courses.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
      alert('Không thể xóa môn học này.');
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.appTitle}>LectureGenerator</h1>
          <p style={styles.welcomeText}>Xin chào, <strong>{user?.full_name || 'Giảng viên'}</strong></p>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn}>Đăng Xuất</button>
      </header>

      {error && <div style={styles.errorAlert}>{error}</div>}

      <main style={styles.mainContent}>
        {/* Khung tạo môn học mới bên trái */}
        <section style={styles.formSection}>
          <h3 style={styles.sectionTitle}>Tạo Môn Học Mới</h3>
          <form onSubmit={handleCreateCourse} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Mã môn học</label>
              <input
                type="text"
                placeholder="Ví dụ: COMP2010"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Tên môn học</label>
              <input
                type="text"
                placeholder="Ví dụ: Cấu trúc Dữ liệu"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <button type="submit" disabled={submitting} style={styles.submitBtn}>
              {submitting ? 'Đang tạo...' : 'Tạo Môn Học'}
            </button>
          </form>
        </section>

        {/* Danh sách môn học bên phải */}
        <section style={styles.listSection}>
          <h3 style={styles.sectionTitle}>Danh Sách Môn Học Của Bạn</h3>
          {loading ? (
            <div style={styles.loadingState}>Đang tải danh sách môn học...</div>
          ) : courses.length === 0 ? (
            <div style={styles.emptyState}>
              <p>Chưa có môn học nào được tạo.</p>
              <p style={{fontSize: '13px', color: '#64748b'}}>Hãy nhập mã và tên môn học ở cột bên trái để khởi tạo.</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {courses.map(course => (
                <div 
                  key={course.id} 
                  onClick={() => onSelectCourse(course)}
                  style={styles.card}
                >
                  <div style={styles.cardHeader}>
                    <span style={styles.courseBadge}>{course.course_code}</span>
                    <button 
                      onClick={(e) => handleDeleteCourse(course.id, e)} 
                      style={styles.deleteBtn}
                      title="Xóa môn học"
                    >
                      🗑️
                    </button>
                  </div>
                  <h4 style={styles.courseName}>{course.course_name}</h4>
                  <div style={styles.cardFooter}>
                    <span>CLOs: Đang tải...</span>
                    <span style={styles.enterLink}>Vào thiết lập →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '20px',
    marginBottom: '35px',
  },
  appTitle: {
    fontSize: '24px',
    fontWeight: '800',
    background: 'linear-gradient(to right, #a5b4fc, #c084fc)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '0 0 4px 0',
  },
  welcomeText: {
    margin: 0,
    color: '#94a3b8',
    fontSize: '14px',
  },
  logoutBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#e2e8f0',
    borderRadius: '10px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: '40px',
    alignItems: 'start',
  },
  formSection: {
    background: 'rgba(30, 41, 59, 0.4)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '20px',
    padding: '24px',
  },
  sectionTitle: {
    fontSize: '16px',
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
    gap: '18px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    background: 'rgba(15, 23, 42, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '12px 14px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)',
  },
  listSection: {
    flex: 1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  card: {
    background: 'rgba(30, 41, 59, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '18px',
    padding: '24px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  courseBadge: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    fontSize: '12px',
    fontWeight: '700',
    padding: '4px 10px',
    borderRadius: '8px',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    opacity: 0.5,
    transition: 'opacity 0.2s',
  },
  courseName: {
    fontSize: '18px',
    fontWeight: '700',
    margin: '0 0 20px 0',
    color: '#f8fafc',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: '#64748b',
  },
  enterLink: {
    color: '#818cf8',
    fontWeight: '600',
  },
  loadingState: {
    color: '#94a3b8',
    textAlign: 'center',
    padding: '40px',
  },
  emptyState: {
    background: 'rgba(30, 41, 59, 0.15)',
    border: '1px dashed rgba(255, 255, 255, 0.08)',
    borderRadius: '20px',
    padding: '60px 40px',
    textAlign: 'center',
    color: '#94a3b8',
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '13px',
    marginBottom: '20px',
  }
};
