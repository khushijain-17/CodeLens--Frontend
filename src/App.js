import { useState } from "react";
import axios from "axios";
import FileTree from "./FileTree";
import "./App.css";

function App() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyzeRepo = async () => {
    if (!url.trim()) {
      setError("Please enter a GitHub URL");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setData(null);
      const res = await axios.post(
        "http://localhost:8081/api/repo/analyze",
        { url },
        { headers: { "Content-Type": "application/json" } }
      );
      setData(res.data);
    } catch (err) {
      const msg = err.response
        ? `Error ${err.response.status}: ${JSON.stringify(err.response.data)}`
        : `Network error: ${err.message}`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") analyzeRepo();
  };

  return (
    <div className="app">
      {/* ✅ grid is now behind everything */}
      <div className="bg-grid" />

      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-bracket">&lt;</span>
            <span className="logo-text">CodeLens</span>
            <span className="logo-bracket">/&gt;</span>
          </div>
          <span className="logo-sub">AI-Powered Code Explainer</span>
        </div>
        {/* ✅ Removed "Powered by Groq" badge */}
      </header>

      <section className="hero">
        <h1 className="hero-title">
          Understand Any<br />
          <span className="hero-accent">Codebase Instantly</span>
        </h1>
        <p className="hero-sub">
          Paste a GitHub repository URL and get AI explanations for every file
        </p>

        <div className="search-bar">
          <span className="search-icon">⌘</span>
          <input
            className="search-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://github.com/username/repository"
          />
          <button
            className={`search-btn ${loading ? "loading" : ""}`}
            onClick={analyzeRepo}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "Analyze →"}
          </button>
        </div>

        {error && <div className="error-msg">⚠ {error}</div>}
        {loading && (
          <div className="loading-msg">
            <span className="dot-anim">Cloning repository</span>
          </div>
        )}
      </section>

      {data && (
        <section className="explorer">
          <FileTree nodes={data} />
        </section>
      )}
    </div>
  );
}

export default App;