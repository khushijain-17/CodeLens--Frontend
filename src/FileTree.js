import React, { useState } from "react";
import axios from "axios";

function FileTree({ nodes }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [code, setCode] = useState("");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileClick = async (node) => {
    if (node.directory) return;
    if (!node.path) {
      setError("File path is missing");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setSelectedFile(node.name);
      setCode("");
      setExplanation("");

      const fileRes = await axios.get(
        `http://localhost:8081/api/repo/file?path=${encodeURIComponent(node.path)}`
      );
      const fileContent = fileRes.data;
      setCode(fileContent);

      const codeSnippet = fileContent.slice(0, 2000);
      const aiRes = await axios.post(
        "http://localhost:8081/api/repo/explain",
        codeSnippet,
        { headers: { "Content-Type": "text/plain" } }
      );
      setExplanation(aiRes.data);
    } catch (err) {
      const msg = err.response
        ? `Server error ${err.response.status}: ${err.response.data}`
        : `Network error: ${err.message}`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="explorer-layout">
      {/* LEFT: File Tree Panel */}
      <div className="tree-panel">
        <div className="panel-header">
          <span className="panel-icon">📁</span>
          <span>Explorer</span>
        </div>
        <div className="tree-scroll">
          <TreeNode nodes={nodes} onFileClick={handleFileClick} selectedFile={selectedFile} />
        </div>
      </div>

      {/* RIGHT: Code + Explanation Panel */}
      <div className="code-panel">
        {loading ? (
          <div className="panel-empty">
            <div className="pulse-ring" />
            <p className="panel-empty-text">Fetching & analyzing file...</p>
          </div>
        ) : error ? (
          <div className="error-block">
            <span className="error-icon">✗</span>
            <pre>{error}</pre>
          </div>
        ) : selectedFile ? (
          <div className="file-view">
            {/* File name tab */}
            <div className="file-tab">
              <span className="file-tab-dot" />
              <span>{selectedFile}</span>
            </div>

            {/* Code block */}
            <div className="code-section">
              <div className="section-label">
                <span className="label-dot code-dot" /> Source Code
              </div>
              <pre className="code-block">{code}</pre>
            </div>

            {/* Explanation block */}
            <div className="explain-section">
              <div className="section-label">
                <span className="label-dot ai-dot" /> AI Explanation
              </div>
              <div className="explain-block">{explanation}</div>
            </div>
          </div>
        ) : (
          <div className="panel-empty">
            <div className="empty-icon">←</div>
            <p className="panel-empty-text">Select a file from the explorer</p>
            <p className="panel-empty-sub">Click any file to view code and AI explanation</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({ nodes, onFileClick, selectedFile }) {
  return (
    <ul className="tree-list">
      {nodes.map((node, index) => (
        <Node key={index} node={node} onFileClick={onFileClick} selectedFile={selectedFile} />
      ))}
    </ul>
  );
}

function Node({ node, onFileClick, selectedFile }) {
  const [open, setOpen] = useState(false);
  const isSelected = selectedFile === node.name;

  return (
    <li className="tree-item">
      <div
        className={`tree-node ${node.directory ? "is-dir" : "is-file"} ${isSelected ? "is-selected" : ""}`}
        onClick={() => node.directory ? setOpen(!open) : onFileClick(node)}
      >
        <span className="node-icon">
          {node.directory ? (open ? "▾" : "▸") : "·"}
        </span>
        <span className="node-name">{node.name}</span>
        {!node.directory && <span className="node-ext">{node.name.split('.').pop()}</span>}
      </div>
      {open && node.children && (
        <div className="tree-children">
          <TreeNode nodes={node.children} onFileClick={onFileClick} selectedFile={selectedFile} />
        </div>
      )}
    </li>
  );
}

export default FileTree;