import React from 'react';

export default function PedagogicalConfigModal({
  showConfigModal,
  setShowConfigModal,
  classSize,
  setClassSize,
  hasWifi,
  setHasWifi,
  furnitureType,
  setFurnitureType,
  handleGenerateMaterials,
  styles
}) {
  if (!showConfigModal) return null;

  return (
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
  );
}
