import React, { useState } from 'react';
import client from '../api/client';

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('prof.khatkhe@vinuni.edu.vn');
  const [password, setPassword] = useState('VinUni2026!#');
  const [fullName, setFullName] = useState('GS. Nguyen Khat Khe');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        // Gọi API đăng ký
        const response = await client.post('/api/auth/register', {
          email,
          password,
          full_name: fullName
        });
        const { access_token, user } = response.data;
        localStorage.setItem('token', access_token);
        localStorage.setItem('user', JSON.stringify(user));
        onLoginSuccess(user);
      } else {
        // Gọi API đăng nhập
        const response = await client.post('/api/auth/login', {
          email,
          password
        });
        const { access_token, user } = response.data;
        localStorage.setItem('token', access_token);
        localStorage.setItem('user', JSON.stringify(user));
        onLoginSuccess(user);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        'Có lỗi xảy ra, vui lòng kiểm tra lại thông tin đăng nhập.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Background decoration bubbles */}
      <div style={styles.bubble1}></div>
      <div style={styles.bubble2}></div>

      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>AI Lecture Assistant</h2>
          <p style={styles.subtitle}>
            {isRegister ? 'Tạo tài khoản Giảng viên mới' : 'Hệ thống thiết kế bài giảng & Đề thi'}
          </p>
        </div>

        {error && <div style={styles.errorAlert}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          {isRegister && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Họ và tên</label>
              <input
                type="text"
                placeholder="Nhập họ và tên giảng viên"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Email trường học</label>
            <input
              type="email"
              placeholder="username@vinuni.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Mật khẩu</label>
            <input
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? 'Đang xử lý...' : isRegister ? 'Đăng Ký Thành Viên' : 'Đăng Nhập'}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản giảng viên?'}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              style={styles.switchBtn}
            >
              {isRegister ? 'Đăng nhập ngay' : 'Đăng ký tại đây'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'radial-gradient(circle at 10% 20%, rgb(15, 23, 42) 0%, rgb(9, 13, 26) 90%)',
    fontFamily: '"Outfit", "Inter", sans-serif',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px',
  },
  bubble1: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
    top: '-50px',
    left: '-50px',
    filter: 'blur(50px)',
  },
  bubble2: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
    bottom: '-100px',
    right: '-100px',
    filter: 'blur(60px)',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: 'rgba(30, 41, 59, 0.45)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    padding: '40px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
    zIndex: 10,
    animation: 'fadeIn 0.6s ease-out',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  title: {
    color: '#f8fafc',
    fontSize: '28px',
    fontWeight: '800',
    letterSpacing: '-0.5px',
    margin: '0 0 8px 0',
    background: 'linear-gradient(to right, #a5b4fc, #818cf8, #c084fc)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '14px',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    color: '#cbd5e1',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '14px 16px',
    color: '#f8fafc',
    fontSize: '14px',
    transition: 'all 0.3s ease',
    outline: 'none',
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '13px',
    marginBottom: '20px',
    textAlign: 'center',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
    marginTop: '10px',
  },
  footer: {
    marginTop: '25px',
    textAlign: 'center',
  },
  footerText: {
    color: '#94a3b8',
    fontSize: '13px',
    margin: 0,
  },
  switchBtn: {
    background: 'none',
    border: 'none',
    color: '#818cf8',
    fontWeight: '600',
    cursor: 'pointer',
    marginLeft: '6px',
    padding: 0,
    textDecoration: 'underline',
    transition: 'color 0.2s',
  }
};
