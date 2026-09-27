import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import FileTree from "./FileTree";
import DependencyGraph from "./DependencyGraph";
import "./App.css";

const API = "https://codelens-backend-fygx.onrender.com";

const toApiUrl   = (url) => url.trim().endsWith(".git") ? url.trim() : url.trim() + ".git";
const toDisplay  = (url) => url.replace("https://github.com/", "").replace(".git", "");
const toRepoName = (url) => {
  const clean = url.replace(".git", "");
  return clean.substring(clean.lastIndexOf("/") + 1);
};

function App() {
  const [url, setUrl]                 = useState("");
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [savedRepos, setSavedRepos]   = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeRepo, setActiveRepo]   = useState("");
  const [activeTab, setActiveTab]     = useState("explorer");
  const [repoPath, setRepoPath]       = useState("");

  const fetchSavedRepos = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/saved`);
      setSavedRepos(res.data);
    } catch (err) {
      console.error("Failed to load saved repos", err);
    }
  }, []);

  useEffect(() => { fetchSavedRepos(); }, [fetchSavedRepos]);

  const analyzeRepo = async (repoUrl) => {
    const raw = repoUrl || url;
    if (!raw.trim()) { setError("Please enter a GitHub URL"); return; }
    const apiUrl = toApiUrl(raw);

    try {
      setLoading(true);
      setError("");
      setData(null);
      setActiveRepo(apiUrl);
      setActiveTab("explorer");

      const res = await axios.post(
        `${API}/api/repo/analyze`,
        { url: apiUrl },
        { headers: { "Content-Type": "application/json" } }
      );
      setData(res.data);

      if (res.data && res.data.length > 0) {
        const firstPath = res.data[0].path.replace(/\\/g, "/");
        const parts = firstPath.split("/");
        setRepoPath(parts.slice(0, -1).join("/"));
      }

      await axios.post(
        `${API}/api/saved`,
        { url: apiUrl },
        { headers: { "Content-Type": "application/json" } }
      );
      fetchSavedRepos();

    } catch (err) {
      const msg = err.response
        ? `Error ${err.response.status}: ${JSON.stringify(err.response.data)}`
        : `Network error: ${err.message}`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const deleteRepo = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API}/api/saved/${id}`);
      fetchSavedRepos();
    } catch (err) { console.error("Failed to delete", err); }
  };

  const clearAll = async () => {
    try {
      await axios.delete(`${API}/api/saved/all`);
      setSavedRepos([]);
    } catch (err) { console.error("Failed to clear", err); }
  };

  // ── New Search: reset state to show hero page without refreshing ──
  const resetToSearch = () => {
    setData(null);
    setActiveRepo("");
    setUrl("");
    setError("");
    setRepoPath("");
    setActiveTab("explorer");
  };

  return (
    <div className="app">
      <div className="bg-grid" />

      <header className="header">
        <div className="header-left">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <div className="logo">
            <span className="logo-bracket">&lt;</span>
            <span className="logo-text">CodeLens</span>
            <span className="logo-bracket">/&gt;</span>
          </div>
          <span className="logo-sub"></span>
        </div>

        {/* New Search button — only visible when a repo is loaded */}
        {data && (
          <button className="new-search-btn" onClick={resetToSearch}>
            <span className="new-search-plus">+</span>
            New Search
          </button>
        )}
      </header>

      <div className="main-layout">

        <aside className={`sidebar ${sidebarOpen ? "" : "sidebar-closed"}`}>
          <div className="sidebar-header">
            <span className="sidebar-title">Recent Repos</span>
            <span className="sidebar-count">{savedRepos.length}</span>
          </div>
          <div className="sidebar-list">
            {savedRepos.length === 0 ? (
              <div className="sidebar-empty">
                <p>No repos yet</p>
                <p>Analyze a repo to save it</p>
              </div>
            ) : (
              savedRepos.map(repo => (
                <div
                  key={repo.id}
                  className={`sidebar-item ${activeRepo === repo.url ? "sidebar-item-active" : ""}`}
                  onClick={() => analyzeRepo(repo.url)}
                  title={repo.url}
                >
                  <span className="sidebar-item-icon">○</span>
                  <div className="sidebar-item-info">
                    <span className="sidebar-item-name">
                      {repo.name || toRepoName(repo.url)}
                    </span>
                    <span className="sidebar-item-url">
                      {toDisplay(repo.url)}
                    </span>
                  </div>
                  <button className="sidebar-delete" onClick={(e) => deleteRepo(repo.id, e)}>✕</button>
                </div>
              ))
            )}
          </div>
          {savedRepos.length > 0 && (
            <button className="sidebar-clear" onClick={clearAll}>Clear All</button>
          )}
        </aside>

        <div className="main-content">

          {/* Hero search — only shown before any repo is loaded */}
          {!data && (
            <div className="search-section">
              <div className="search-section-inner">

                

                <h1 className="hero-title">
                  <span className="hero-word hero-word-understand">Understand</span>
                  <span className="hero-word hero-word-any">Any</span>
                  <span className="hero-word hero-word-codebase">Codebase</span>
                  <span className="hero-word hero-word-instantly">Instantly</span>
                </h1>

                <p className="hero-sub">
                  Paste a GitHub repository URL and get AI-powered explanations,
                  file trees, and dependency graphs for every file.
                </p>

                <div className="search-bar">
                  <span className="search-icon">⌘</span>
                  <input
                    className="search-input"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && analyzeRepo()}
                    placeholder="https://github.com/username/repository"
                  />
                  <button className="search-btn" onClick={() => analyzeRepo()} disabled={loading}>
                    {loading ? <span className="spinner" /> : "Analyze →"}
                  </button>
                </div>

                {error   && <div className="error-msg">⚠ {error}</div>}
                {loading && <div className="loading-msg"><span className="dot-anim">Cloning repository</span></div>}

                <div className="hero-features">
                  <span className="hero-feature">📁 File Explorer</span>
                  <span className="hero-feature">⬡ Dependency Graph</span>
                </div>

              </div>
            </div>
          )}

          {/* Explorer — shown after repo is loaded */}
          {data && (
            <div className="explorer">
              <div className="explorer-header">
                <div className="explorer-repo-label">
                  <span className="explorer-repo-icon">⬡</span>
                  <span>{toDisplay(activeRepo)}</span>
                </div>
                <div className="tab-bar">
                  <button
                    className={`tab-btn ${activeTab === "explorer" ? "active" : ""}`}
                    onClick={() => setActiveTab("explorer")}
                  >📁 File Explorer</button>
                  <button
                    className={`tab-btn ${activeTab === "graph" ? "active" : ""}`}
                    onClick={() => setActiveTab("graph")}
                  >⬡ Dependency Graph</button>
                </div>
              </div>

              {activeTab === "explorer" && <FileTree nodes={data} />}
              {activeTab === "graph"    && (
                <DependencyGraph
                  repoPath={repoPath}
                  onFileClick={() => setActiveTab("explorer")}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;