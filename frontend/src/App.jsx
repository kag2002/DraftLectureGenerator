import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CourseConfig from './pages/CourseConfig';
import LessonPlanner from './pages/LessonPlanner';
import QuestionBank from './pages/QuestionBank';
import MatrixDashboard from './pages/MatrixDashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState('login'); // 'login' | 'dashboard' | 'course_config' | 'lesson_planner' | 'question_bank' | 'matrix_dashboard'
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tự động đăng nhập nếu có token và user trong localStorage
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      setUser(JSON.parse(savedUser));
      setActiveView('dashboard');
    } else {
      setActiveView('login');
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setActiveView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setSelectedCourse(null);
    setActiveView('login');
  };

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    setActiveView('course_config');
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div>Đang tải ứng dụng...</div>
      </div>
    );
  }

  return (
    <>
      {activeView === 'login' && (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
      {activeView === 'dashboard' && (
        <Dashboard
          user={user}
          onLogout={handleLogout}
          onSelectCourse={handleSelectCourse}
        />
      )}
      {activeView === 'course_config' && (
        <CourseConfig
          course={selectedCourse}
          onBack={() => setActiveView('dashboard')}
          onStartPlanning={() => setActiveView('lesson_planner')}
        />
      )}
      {activeView === 'lesson_planner' && (
        <LessonPlanner
          course={selectedCourse}
          onBack={() => setActiveView('course_config')}
          onLogout={handleLogout}
          onGoToQuestionBank={() => setActiveView('question_bank')}
        />
      )}
      {activeView === 'question_bank' && (
        <QuestionBank
          course={selectedCourse}
          onBack={() => setActiveView('lesson_planner')}
          onViewDashboard={() => setActiveView('matrix_dashboard')}
        />
      )}
      {activeView === 'matrix_dashboard' && (
        <MatrixDashboard
          course={selectedCourse}
          onBack={() => setActiveView('question_bank')}
        />
      )}
    </>
  );
}

const styles = {
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'radial-gradient(circle at 10% 20%, rgb(15, 23, 42) 0%, rgb(9, 13, 26) 90%)',
    color: '#94a3b8',
    fontFamily: '"Outfit", "Inter", sans-serif',
  }
};
