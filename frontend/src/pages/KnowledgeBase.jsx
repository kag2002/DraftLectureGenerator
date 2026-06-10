import React, { useState, useEffect } from 'react';
import client from '../api/client';
import FlowSteps from '../components/FlowSteps';

export default function KnowledgeBase({ course, onBack, onLogout, onNavigate, activeView }) {
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'academic_search'
  
  // Data lists
  const [documents, setDocuments] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  
  // RAG upload
  const [uploadFile, setUploadFile] = useState(null);
  
  // Academic Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [expandedSearch, setExpandedSearch] = useState({});
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [maxResults, setMaxResults] = useState(10);
  const [credibilityThreshold, setCredibilityThreshold] = useState(0.7);
  const [suggestedQueries, setSuggestedQueries] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [summaries, setSummaries] = useState({});
  const [summarizing, setSummarizing] = useState({});
  const [showMetricGuide, setShowMetricGuide] = useState(false);
  const [selectedRejected, setSelectedRejected] = useState({});
  
  // Global messages & loading
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Load documents and chapters on mount or when activeView changes to knowledge_base
  useEffect(() => {
    if (!course) return;
    if (activeView === 'knowledge_base') {
      loadDocuments();
      loadChapters();
    }
  }, [course.id, activeView]);

  const loadDocuments = async () => {
    try {
      const docResponse = await client.get(`/api/courses/${course.id}/documents`);
      setDocuments(docResponse.data.documents || []);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi tải danh sách tài liệu RAG.');
    }
  };

  const loadChapters = async () => {
    try {
      const response = await client.get(`/api/courses/${course.id}/chapters`);
      setChapters(response.data || []);
      if (response.data && response.data.length > 0) {
        setSelectedChapterId(response.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch suggested queries when selected chapter changes
  useEffect(() => {
    if (!selectedChapterId) return;
    fetchSuggestedQueries(selectedChapterId);
  }, [selectedChapterId]);

  const fetchSuggestedQueries = async (chapterId) => {
    setLoadingSuggestions(true);
    try {
      const suggestRes = await client.get(`/api/courses/chapters/${chapterId}/suggest-queries`);
      setSuggestedQueries(suggestRes.data.suggestions || []);
    } catch (err) {
      console.error("Error loading suggested queries:", err);
      setSuggestedQueries([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Upload RAG file
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

  // Delete RAG file
  const handleDeleteDocument = async (fileName) => {
    if (!window.confirm(`Bạn muốn xóa tài liệu tham chiếu '${fileName}' khỏi RAG?`)) return;
    setError('');
    setMessage('');
    
    try {
      await client.delete(`/api/courses/${course.id}/documents/${fileName}`);
      setDocuments(documents.filter(d => d !== fileName));
      setMessage('Đã xóa tài liệu khỏi Vector DB.');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi xóa tài liệu.');
    }
  };

  // Academic Search
  const handleWebSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setError('');
    setMessage('');
    setSearching(true);
    setSearchResult(null);
    setExpandedSearch({});
    setSummaries({});

    try {
      const response = await client.post(`/api/courses/${course.id}/web-search-ingest`, {
        query: searchQuery,
        max_results: maxResults,
        threshold: credibilityThreshold
      });
      setSearchResult(response.data);
      setMessage('Đã hoàn thành khảo sát độ uy tín và nạp RAG!');
      loadDocuments(); // Reload documents list to reflect changes
    } catch (err) {
      console.error(err);
      setError('Lỗi trong quá trình tìm kiếm học thuật.');
    } finally {
      setSearching(false);
    }
  };

  // Toggle detail view for scraped content
  const toggleSearchDetail = (key) => {
    setExpandedSearch(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Summarize content
  const handleSummarizeContent = async (key, title, content) => {
    if (summaries[key]) return;
    setSummarizing(prev => ({ ...prev, [key]: true }));
    try {
      const response = await client.post(`/api/courses/summarize-content`, {
        content: content,
        title: title
      });
      setSummaries(prev => ({
        ...prev,
        [key]: response.data.summary
      }));
    } catch (err) {
      console.error(err);
      setSummaries(prev => ({
        ...prev,
        [key]: 'Lỗi khi kết nối với máy chủ AI để tóm tắt.'
      }));
    } finally {
      setSummarizing(prev => ({ ...prev, [key]: false }));
    }
  };

  // Force Ingest of rejected sources
  const handleForceIngest = async () => {
    const selectedUrls = Object.keys(selectedRejected).filter(url => selectedRejected[url]);
    if (selectedUrls.length === 0) return;
    
    setLoading(true);
    setError('');
    setMessage('');
    
    let successCount = 0;
    const ingestedList = [...(searchResult.ingested || [])];
    let rejectedList = [...(searchResult.rejected || [])];
    const targetChapter = chapters.find(c => c.id === selectedChapterId);

    try {
      for (const url of selectedUrls) {
        const item = rejectedList.find(r => r.url === url);
        if (!item) continue;
        
        await client.post(`/api/courses/${course.id}/force-ingest-url`, {
          url: item.url,
          title: item.title,
          content: item.content
        });
        
        successCount++;
        // Add to ingested with a forced flag
        ingestedList.push({
          ...item,
          isForced: true
        });
        // Remove from rejected
        rejectedList = rejectedList.filter(r => r.url !== url);
      }
      
      setSearchResult({
        ...searchResult,
        ingested: ingestedList,
        rejected: rejectedList
      });
      
      loadDocuments();
      setSelectedRejected({});
      setMessage(`⚡ Đã ép nạp thành công ${successCount} tài liệu vào RAG! Các tài liệu này đã được gán làm nguồn tham khảo trực tiếp cho chương học đang chọn: "${targetChapter ? targetChapter.title : 'Chương học tương ứng'}".`);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi nạp thủ công tài liệu vào RAG.');
    } finally {
      setLoading(false);
    }
  };

  // Recommendation builder
  const getRecommendation = (score) => {
    const pct = Math.round(score * 100);
    if (pct >= 80) {
      return {
        label: "Khuyên dùng (Highly Recommended)",
        color: "#10b981",
        bgColor: "rgba(16, 185, 129, 0.15)",
        borderColor: "rgba(16, 185, 129, 0.4)",
        desc: "Nguồn chính thống/độ tin cậy học thuật rất cao. Rất khuyên dùng để nạp vào RAG."
      };
    } else if (pct >= 60) {
      return {
        label: "Đáng tin cậy (Credible)",
        color: "#3b82f6",
        bgColor: "rgba(59, 130, 246, 0.15)",
        borderColor: "rgba(59, 130, 246, 0.4)",
        desc: "Tài liệu học thuật/tổ chức giáo dục hợp lệ. Rất phù hợp làm học liệu bổ trợ."
      };
    } else if (pct >= 40) {
      return {
        label: "Cần cân nhắc (Average)",
        color: "#f59e0b",
        bgColor: "rgba(245, 158, 11, 0.15)",
        borderColor: "rgba(245, 158, 11, 0.4)",
        desc: "Nguồn tin phổ thông phi học thuật (.org, .com). Hãy cân nhắc kiểm duyệt trước khi nạp RAG."
      };
    } else {
      return {
        label: "Không khuyến nghị (Low Credibility)",
        color: "#ef4444",
        bgColor: "rgba(239, 68, 68, 0.15)",
        borderColor: "rgba(239, 68, 68, 0.4)",
        desc: "Blog cá nhân, diễn đàn hoặc mạng xã hội. Độ tin cậy thấp, không khuyến nghị nạp RAG."
      };
    }
  };

  const renderJustifications = (justification) => {
    if (!justification) return null;
    const items = justification.split('; ');
    return (
      <div style={styles.badgeContainer}>
        {items.map((item, idx) => {
          const isPositive = item.includes('+');
          const isNegative = item.includes('-');
          let badgeStyle = styles.badgeNeutral;
          if (isPositive) badgeStyle = styles.badgePositive;
          if (isNegative) badgeStyle = styles.badgeNegative;
          return (
            <span key={idx} style={badgeStyle}>
              {item}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={onBack} style={styles.backBtn}>← Sơ đồ</button>
          <div>
            <span style={styles.badge}>{course.course_code}</span>
            <h2 style={styles.courseTitle}>{course.course_name}</h2>
          </div>
        </div>
        {onNavigate && <FlowSteps activeStep="rag" onNavigate={onNavigate} />}
        <button style={styles.logoutBtn} onClick={onLogout}>Đăng Xuất</button>
      </header>

      {error && <div style={styles.errorAlert}>{error}</div>}
      {message && <div style={styles.successAlert}>{message}</div>}

      <div style={styles.tabSection}>
        <div style={styles.tabHeader}>
          <button 
            onClick={() => setActiveTab('documents')} 
            style={activeTab === 'documents' ? styles.activeTab : styles.inactiveTab}
          >
            📂 Thư viện tài liệu RAG
          </button>
          <button 
            onClick={() => setActiveTab('academic_search')} 
            style={activeTab === 'academic_search' ? styles.activeTab : styles.inactiveTab}
          >
            🌐 Tìm kiếm học thuật trực tuyến
          </button>
        </div>

        <div style={styles.tabContent}>
          {activeTab === 'documents' ? (
            <div style={styles.ragLayout}>
              {/* CỘT TRÁI: Upload form */}
              <div style={styles.ragUploadSection}>
                <h3 style={styles.sectionTitle}>Nạp tài liệu mới vào Vector DB</h3>
                <p style={styles.sectionDesc}>Hệ thống RAG sẽ bóc tách văn bản trong file và băm vector để cung cấp kiến thức thực tế cho AI lúc soạn giáo án.</p>
                <form onSubmit={handleUploadDocument} style={styles.uploadForm}>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    style={styles.fileInput}
                  />
                  <button type="submit" disabled={!uploadFile || loading} style={styles.uploadBtn}>
                    {loading ? 'Đang nạp Vector...' : 'Nạp Vào RAG (Vector DB)'}
                  </button>
                </form>
              </div>

              {/* CỘT PHẢI: Documents list */}
              <div style={styles.ragListSection}>
                <h3 style={styles.sectionTitle}>Danh mục tài liệu RAG đã nạp ({documents.length})</h3>
                {documents.length === 0 ? (
                  <div style={styles.emptyState}>Chưa nạp tài liệu tham khảo nào cho môn học này.</div>
                ) : (
                  <div style={styles.docGrid}>
                    {documents.map((doc, idx) => (
                      <div key={idx} style={styles.docItem}>
                        <span style={styles.docName} title={doc}>📄 {doc}</span>
                        <button onClick={() => handleDeleteDocument(doc)} style={styles.deleteDocBtn} title="Xóa tài liệu">🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={styles.searchLayout}>
              {/* CỘT TRÁI: Tìm kiếm form */}
              <div style={styles.searchFormPanel}>
                <h3 style={styles.sectionTitle}>Tìm kiếm & Thẩm định học thuật</h3>
                
                {/* Metric Guide */}
                <div style={styles.metricGuideBox}>
                  <div style={styles.metricGuideHeader} onClick={() => setShowMetricGuide(!showMetricGuide)}>
                    <span>📊 Cách tính điểm uy tín (%) ℹ️</span>
                    <span style={{ fontSize: '10px' }}>{showMetricGuide ? 'Thu gọn ▲' : 'Chi tiết ▼'}</span>
                  </div>
                  {showMetricGuide && (
                    <div style={styles.metricGuideContent}>
                      <ul style={styles.metricList}>
                        <li><strong>Domain Whitelist (Max 50%):</strong> .edu, .gov, các nhà xuất bản uy tín (IEEE, Springer, ScienceDirect...).</li>
                        <li><strong>DOI/ISSN (Max 20%):</strong> Chứa mã định danh nghiên cứu.</li>
                        <li><strong>Từ khóa học thuật (Max 15%):</strong> Mật độ thuật ngữ khoa học chuyên ngành.</li>
                        <li><strong>Độ mới (Max 15%):</strong> Xuất bản hoặc cập nhật trong giai đoạn 2020-2026.</li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Chapter Context Selector */}
                {chapters.length > 0 ? (
                  <div style={styles.chapterSelectorGroup}>
                    <label style={styles.label}>Lấy gợi ý từ khóa theo chương:</label>
                    <select
                      value={selectedChapterId}
                      onChange={(e) => setSelectedChapterId(e.target.value ? Number(e.target.value) : '')}
                      style={styles.select}
                    >
                      {chapters.map(ch => (
                        <option key={ch.id} value={ch.id}>{ch.title}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={styles.noChaptersWarning}>
                    ⚠️ Môn học này hiện chưa có chương học nào được thiết kế. Vui lòng quay lại <strong>Bản đồ học tập (Course Roadmap)</strong> và nhấn vào nút <strong>Sinh Dàn Ý</strong> để khởi tạo danh sách chương trước khi nhận gợi ý từ khóa học thuật tự động từ AI.
                  </div>
                )}

                <form onSubmit={handleWebSearch} style={styles.searchForm}>
                  <div style={styles.searchFormGroup}>
                    <label style={styles.label}>Từ khóa học thuật cần tìm kiếm</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: binary search tree worst case complexity..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={styles.input}
                      required
                    />
                  </div>
                  
                  <div style={styles.searchActionRow}>
                    <button type="submit" disabled={searching || loading} style={styles.searchSubmitBtn}>
                      {searching ? 'Đang quét học thuật...' : 'Tìm kiếm & Đánh giá'}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowAdvancedSearch(!showAdvancedSearch)} 
                      style={styles.filterToggleBtn}
                    >
                      ⚙️ Cấu hình {showAdvancedSearch ? '▲' : '▼'}
                    </button>
                  </div>

                  {/* Advanced Settings */}
                  {showAdvancedSearch && (
                    <div style={styles.advancedPanel}>
                      <div style={styles.advancedRow}>
                        <label style={styles.advancedLabel}>Số tài liệu tối đa:</label>
                        <select
                          value={maxResults}
                          onChange={(e) => setMaxResults(parseInt(e.target.value))}
                          style={styles.advancedInput}
                        >
                          <option value={5}>5 tài liệu</option>
                          <option value={10}>10 tài liệu</option>
                          <option value={15}>15 tài liệu</option>
                        </select>
                      </div>
                      
                      <div style={styles.advancedRow}>
                        <label style={styles.advancedLabel}>Mức uy tín tối thiểu (Threshold):</label>
                        <div style={styles.advancedSliderContainer}>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(credibilityThreshold * 100)}
                            onChange={(e) => setCredibilityThreshold(parseFloat(e.target.value) / 100)}
                            style={styles.advancedSlider}
                          />
                          <span style={styles.advancedValue}>
                            {Math.round(credibilityThreshold * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Suggested Queries */}
                  {chapters.length > 0 && (
                    <div style={styles.suggestionSection}>
                      <div style={styles.suggestionTitle}>
                        💡 Gợi ý từ khóa AI cho chương đang chọn:
                      </div>
                      {loadingSuggestions ? (
                        <div style={styles.loadingText}>⏳ Đang tải gợi ý từ khóa từ AI...</div>
                      ) : suggestedQueries.length > 0 ? (
                        <div style={styles.suggestionChips}>
                          {suggestedQueries.map((query, idx) => (
                            <button 
                              key={idx} 
                              type="button"
                              onClick={() => setSearchQuery(query)}
                              style={styles.suggestionChip}
                            >
                              {query}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={styles.noSuggestionsText}>❌ Không tải được gợi ý từ khóa cho chương học này.</div>
                      )}
                    </div>
                  )}
                </form>
              </div>

              {/* CỘT PHẢI: Kết quả tìm kiếm */}
              <div style={styles.searchResultsPanel}>
                <h3 style={styles.sectionTitle}>Kết quả khảo sát</h3>
                {searchResult ? (
                  <div style={styles.searchResults}>
                    <div style={styles.searchResultHeader}>
                      Đã lọc: {searchResult.ingested.length} Đã nạp | {searchResult.rejected.length} Bị lọc
                    </div>

                    {/* INGESTED (XANH) */}
                    {searchResult.ingested.map((src, i) => {
                      const key = `ing-${i}`;
                      const isExpanded = !!expandedSearch[key];
                      const isSummarizing = !!summarizing[key];
                      const summary = summaries[key];
                      const rec = getRecommendation(src.score);
                      return (
                        <div key={key} style={styles.resultItemGreen}>
                          <div style={styles.resultTitle}>
                            <span style={styles.scoreBadgeGreen}>{(src.score * 100).toFixed(0)}%</span>
                            <span style={{
                              ...styles.recommendationBadge,
                              color: rec.color,
                              background: rec.bgColor,
                              border: `1px solid ${rec.borderColor}`
                            }}>{rec.label}</span>
                            {src.isForced && (
                              <span style={{
                                ...styles.recommendationBadge,
                                color: '#f59e0b',
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.4)'
                              }}>⚡ Đã ép nạp vào RAG</span>
                            )}
                          </div>
                          <strong style={styles.resultHeadline}>{src.title}</strong>
                          <div style={styles.resultUrl} title={src.url}>{src.url}</div>
                          {renderJustifications(src.justification)}
                          <div style={styles.recDesc}>💡 {rec.desc}</div>
                          
                          <div style={styles.actionBtnRow}>
                            {src.content && (
                              <button
                                type="button"
                                onClick={() => toggleSearchDetail(key)}
                                style={styles.actionMiniBtn}
                              >
                                {isExpanded ? '▲ Thu gọn' : '▼ Đọc nội dung'}
                              </button>
                            )}
                            {src.content && (
                              <button
                                type="button"
                                onClick={() => handleSummarizeContent(key, src.title, src.content)}
                                disabled={isSummarizing || !!summary}
                                style={styles.actionMiniBtn}
                              >
                                ✨ {isSummarizing ? 'Đang tóm tắt...' : summary ? 'Đã tóm tắt' : 'Tóm tắt (AI)'}
                              </button>
                            )}
                          </div>

                          {isExpanded && src.content && (
                            <pre style={styles.scrapedContentBox}>{src.content}</pre>
                          )}

                          {summary && (
                            <div style={styles.summaryBox}>
                              <div style={styles.summaryTitle}>📚 Tóm tắt học thuật (AI):</div>
                              <div>{summary}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* REJECTED (ĐỎ) */}
                    {searchResult.rejected && searchResult.rejected.length > 0 && (
                      <div style={{ marginTop: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#f87171' }}>⚠️ Bị từ chối ({searchResult.rejected.length})</span>
                          {Object.values(selectedRejected).filter(Boolean).length > 0 && (
                            <button
                              type="button"
                              onClick={handleForceIngest}
                              style={styles.forceIngestBtn}
                            >
                              ⚡ Force Nạp ({Object.values(selectedRejected).filter(Boolean).length})
                            </button>
                          )}
                        </div>
                        
                        {searchResult.rejected.map((src, i) => {
                          const key = `rej-${i}`;
                          const isExpanded = !!expandedSearch[key];
                          const isSummarizing = !!summarizing[key];
                          const summary = summaries[key];
                          const rec = getRecommendation(src.score);
                          const isChecked = !!selectedRejected[src.url];
                          return (
                            <div key={key} style={styles.resultItemRed}>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => setSelectedRejected(prev => ({ ...prev, [src.url]: !prev[src.url] }))}
                                  style={{ marginTop: '4px', cursor: 'pointer' }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={styles.resultTitle}>
                                    <span style={styles.scoreBadgeRed}>{(src.score * 100).toFixed(0)}%</span>
                                    <span style={{
                                      ...styles.recommendationBadge,
                                      color: rec.color,
                                      background: rec.bgColor,
                                      border: `1px solid ${rec.borderColor}`
                                    }}>{rec.label}</span>
                                  </div>
                                  <strong style={styles.resultHeadline}>{src.title}</strong>
                                  <div style={styles.resultUrl} title={src.url}>{src.url}</div>
                                  {renderJustifications(src.justification)}
                                  <div style={styles.recDesc}>💡 {rec.desc}</div>

                                  <div style={styles.actionBtnRow}>
                                    {src.content && (
                                      <button
                                        type="button"
                                        onClick={() => toggleSearchDetail(key)}
                                        style={styles.actionMiniBtn}
                                      >
                                        {isExpanded ? '▲ Thu gọn' : '▼ Đọc nội dung'}
                                      </button>
                                    )}
                                    {src.content && (
                                      <button
                                        type="button"
                                        onClick={() => handleSummarizeContent(key, src.title, src.content)}
                                        disabled={isSummarizing || !!summary}
                                        style={styles.actionMiniBtn}
                                      >
                                        ✨ {isSummarizing ? 'Đang tóm tắt...' : summary ? 'Đã tóm tắt' : 'Tóm tắt (AI)'}
                                      </button>
                                    )}
                                  </div>

                                  {isExpanded && src.content && (
                                    <pre style={styles.scrapedContentBox}>{src.content}</pre>
                                  )}

                                  {summary && (
                                    <div style={styles.summaryBox}>
                                      <div style={styles.summaryTitle}>📚 Tóm tắt học thuật (AI):</div>
                                      <div>{summary}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={styles.emptySearchResults}>
                    Chưa thực hiện tìm kiếm học thuật trực tuyến.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
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
    marginBottom: '25px',
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
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
  },
  logoutBtn: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    borderRadius: '8px',
    padding: '8px 16px',
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
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '12px',
    marginBottom: '15px',
  },
  successAlert: {
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#a7f3d0',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '12px',
    marginBottom: '15px',
  },
  tabSection: {
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
    borderBottom: '3px solid #6366f1',
    color: '#f8fafc',
    padding: '15px 10px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  inactiveTab: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#64748b',
    padding: '15px 10px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  tabContent: {
    padding: '25px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: '8px',
    marginTop: 0,
  },
  sectionDesc: {
    fontSize: '12px',
    color: '#64748b',
    margin: '0 0 20px 0',
    lineHeight: '140%',
  },
  ragLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr',
    gap: '40px',
    minHeight: '400px',
  },
  ragUploadSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  ragListSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  uploadForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    background: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '12px',
    padding: '20px',
  },
  fileInput: {
    color: '#94a3b8',
    fontSize: '13px',
  },
  uploadBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  emptyState: {
    color: '#64748b',
    textAlign: 'center',
    padding: '80px 20px',
    fontSize: '13px',
    border: '1px dashed rgba(255, 255, 255, 0.04)',
    borderRadius: '12px',
    background: 'rgba(15, 23, 42, 0.1)',
  },
  docGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '15px',
    maxHeight: '450px',
    overflowY: 'auto',
    paddingRight: '5px',
  },
  docItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(15, 23, 42, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#cbd5e1',
  },
  docName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '200px',
  },
  deleteDocBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    padding: 0,
  },
  searchLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr',
    gap: '40px',
    minHeight: '500px',
  },
  searchFormPanel: {
    display: 'flex',
    flexDirection: 'column',
  },
  searchResultsPanel: {
    display: 'flex',
    flexDirection: 'column',
  },
  chapterSelectorGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '15px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
  },
  select: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '10px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  searchForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  searchFormGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '12px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
  },
  searchActionRow: {
    display: 'flex',
    gap: '12px',
  },
  searchSubmitBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    flex: 2,
    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)',
  },
  filterToggleBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#cbd5e1',
    borderRadius: '8px',
    padding: '10px 15px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    flex: 1,
    textAlign: 'center',
  },
  advancedPanel: {
    background: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '10px',
    padding: '15px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  advancedRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  advancedLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '600',
  },
  advancedInput: {
    background: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#f8fafc',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
  },
  advancedSliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  advancedSlider: {
    flex: 1,
    cursor: 'pointer',
  },
  advancedValue: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#a5b4fc',
    minWidth: '35px',
    textAlign: 'right',
  },
  suggestionSection: {
    marginTop: '10px',
  },
  suggestionTitle: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: '8px',
  },
  suggestionChips: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  suggestionChip: {
    background: 'rgba(99, 102, 241, 0.08)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    color: '#a5b4fc',
    fontSize: '12px',
    fontWeight: '500',
    padding: '10px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'block',
    textAlign: 'left',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'all 0.15s ease',
  },
  metricGuideBox: {
    background: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '15px',
  },
  metricGuideHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    color: '#cbd5e1',
  },
  metricGuideContent: {
    marginTop: '10px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '8px',
  },
  metricList: {
    paddingLeft: '15px',
    margin: 0,
    fontSize: '11px',
    color: '#cbd5e1',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  searchResults: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    maxHeight: '600px',
    overflowY: 'auto',
    paddingRight: '5px',
  },
  searchResultHeader: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: '5px',
  },
  emptySearchResults: {
    color: '#64748b',
    textAlign: 'center',
    padding: '60px 20px',
    fontSize: '13px',
    border: '1px dashed rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    background: 'rgba(15, 23, 42, 0.1)',
  },
  resultItemGreen: {
    background: 'rgba(16, 185, 129, 0.04)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    borderRadius: '8px',
    padding: '15px',
  },
  resultItemRed: {
    background: 'rgba(239, 68, 68, 0.04)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    borderRadius: '8px',
    padding: '15px',
  },
  resultTitle: {
    fontSize: '12px',
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  scoreBadgeGreen: {
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#34d399',
    fontSize: '10px',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '4px',
  },
  scoreBadgeRed: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    fontSize: '10px',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '4px',
  },
  recommendationBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '1px 6px',
    borderRadius: '4px',
    marginLeft: '6px',
  },
  resultHeadline: {
    display: 'block',
    fontSize: '13px',
    marginTop: '6px',
    color: '#f8fafc',
  },
  resultUrl: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '3px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  badgeContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '8px',
  },
  badgePositive: {
    background: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    color: '#34d399',
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '6px',
  },
  badgeNegative: {
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#f87171',
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '6px',
  },
  badgeNeutral: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#cbd5e1',
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '6px',
  },
  recDesc: {
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '8px',
    fontStyle: 'italic',
  },
  actionBtnRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '12px',
  },
  actionMiniBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#cbd5e1',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  scrapedContentBox: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '10px',
    fontSize: '11px',
    fontFamily: 'Consolas, monospace',
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap',
    maxHeight: '200px',
    overflowY: 'auto',
    margin: '10px 0 0 0',
  },
  summaryBox: {
    background: 'rgba(99, 102, 241, 0.04)',
    border: '1px dashed rgba(99, 102, 241, 0.25)',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '10px',
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: '145%',
  },
  summaryTitle: {
    fontWeight: '700',
    color: '#a5b4fc',
    marginBottom: '6px',
    fontSize: '12px',
  },
  forceIngestBtn: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '5px 12px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)',
  },
  noChaptersWarning: {
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: '#f59e0b',
    padding: '12px 15px',
    borderRadius: '8px',
    fontSize: '12px',
    lineHeight: '1.4',
    marginBottom: '15px',
  },
  loadingText: {
    fontSize: '12px',
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: '5px 0',
  },
  noSuggestionsText: {
    fontSize: '12px',
    color: '#ef4444',
    fontStyle: 'italic',
    padding: '5px 0',
  }
};
