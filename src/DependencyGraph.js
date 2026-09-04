import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";

const TYPE_COLORS = {
  java:       { node: "#22d3a0", glow: "rgba(34,211,160,0.4)"  },
  javascript: { node: "#f7c948", glow: "rgba(247,201,72,0.4)"  },
  typescript: { node: "#7c6af7", glow: "rgba(124,106,247,0.4)" },
  python:     { node: "#f87171", glow: "rgba(248,113,113,0.4)" },
  other:      { node: "#8888aa", glow: "rgba(136,136,170,0.4)" },
};

export default function DependencyGraph({ repoPath, onFileClick }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const simRef    = useRef({ nodes: [], edges: [], running: true });
  const dragRef   = useRef(null);

  const [graphData, setGraphData]       = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [hoveredNode, setHoveredNode]   = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [stats, setStats]               = useState(null);

  // ── draw (stable — no external deps) ──────────────────────────────────────
  const draw = useCallback((ctx, sim, W, H) => {
    ctx.clearRect(0, 0, W, H);

    for (const e of sim.edges) {
      const src = sim.nodes.find(n => n.id === e.source);
      const tgt = sim.nodes.find(n => n.id === e.target);
      if (!src || !tgt) continue;

      const isHighlighted =
        sim.selectedId &&
        (sim.selectedId === e.source || sim.selectedId === e.target);

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      const mx = (src.x + tgt.x) / 2 + (tgt.y - src.y) * 0.15;
      const my = (src.y + tgt.y) / 2 - (tgt.x - src.x) * 0.15;
      ctx.quadraticCurveTo(mx, my, tgt.x, tgt.y);
      ctx.strokeStyle = isHighlighted ? "rgba(124,106,247,0.9)" : "rgba(255,255,255,0.08)";
      ctx.lineWidth   = isHighlighted ? 2 : 1;
      ctx.stroke();

      if (isHighlighted) {
        const angle = Math.atan2(tgt.y - my, tgt.x - mx);
        const ar = tgt.radius + 4;
        ctx.beginPath();
        ctx.moveTo(tgt.x - ar * Math.cos(angle), tgt.y - ar * Math.sin(angle));
        ctx.lineTo(
          tgt.x - ar * Math.cos(angle) - 8 * Math.cos(angle - 0.4),
          tgt.y - ar * Math.sin(angle) - 8 * Math.sin(angle - 0.4)
        );
        ctx.lineTo(
          tgt.x - ar * Math.cos(angle) - 8 * Math.cos(angle + 0.4),
          tgt.y - ar * Math.sin(angle) - 8 * Math.sin(angle + 0.4)
        );
        ctx.closePath();
        ctx.fillStyle = "rgba(124,106,247,0.9)";
        ctx.fill();
      }
    }

    for (const node of sim.nodes) {
      const colors  = TYPE_COLORS[node.type] || TYPE_COLORS.other;
      const isHover = sim.hoveredId === node.id;
      const isSel   = sim.selectedId === node.id;
      const r       = node.radius + (isHover || isSel ? 4 : 0);

      if (isHover || isSel) {
        const glow = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * 2.5);
        glow.addColorStop(0, colors.glow);
        glow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      const grad = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r);
      grad.addColorStop(0, colors.node + "ff");
      grad.addColorStop(1, colors.node + "88");
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle   = grad;
      ctx.fill();
      ctx.strokeStyle = isSel ? "#fff" : colors.node;
      ctx.lineWidth   = isSel ? 2.5 : 1;
      ctx.stroke();

      const label = node.name.length > 14 ? node.name.slice(0, 12) + "…" : node.name;
      ctx.font      = `${isHover || isSel ? "bold " : ""}11px JetBrains Mono, monospace`;
      ctx.fillStyle = "#e2e2f0";
      ctx.textAlign = "center";
      ctx.fillText(label, node.x, node.y + r + 14);
    }
  }, []);

  // ── simulate ───────────────────────────────────────────────────────────────
  const simulate = useCallback((canvas, W, H) => {
    const ctx = canvas.getContext("2d");
    const sim = simRef.current;

    const tick = () => {
      if (!sim.running) return;

      for (let i = 0; i < sim.nodes.length; i++) {
        const a = sim.nodes[i];
        if (dragRef.current && dragRef.current.id === a.id) continue;

        for (let j = 0; j < sim.nodes.length; j++) {
          if (i === j) continue;
          const b    = sim.nodes[j];
          const dx   = a.x - b.x;
          const dy   = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2800 / (dist * dist);
          a.vx += (dx / dist) * force;
          a.vy += (dy / dist) * force;
        }

        for (const e of sim.edges) {
          let other = null;
          if (e.source === a.id) other = sim.nodes.find(n => n.id === e.target);
          if (e.target === a.id) other = sim.nodes.find(n => n.id === e.source);
          if (!other) continue;
          const dx    = other.x - a.x;
          const dy    = other.y - a.y;
          const dist  = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = dist * 0.018;
          a.vx += (dx / dist) * force;
          a.vy += (dy / dist) * force;
        }

        a.vx += (W / 2 - a.x) * 0.004;
        a.vy += (H / 2 - a.y) * 0.004;
        a.vx *= 0.82;
        a.vy *= 0.82;
        a.x  += a.vx;
        a.y  += a.vy;
        a.x = Math.max(a.radius, Math.min(W - a.radius, a.x));
        a.y = Math.max(a.radius, Math.min(H - a.radius, a.y));
      }

      draw(ctx, sim, W, H);
      animRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, [draw]);

  // ── initSimulation ─────────────────────────────────────────────────────────
  const initSimulation = useCallback((data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width  = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;

    const nodes = data.nodes.map((n, i) => {
      const angle = (i / data.nodes.length) * Math.PI * 2;
      const r = Math.min(W, H) * 0.32;
      return {
        ...n,
        x:  W / 2 + r * Math.cos(angle),
        y:  H / 2 + r * Math.sin(angle),
        vx: 0, vy: 0,
        radius: Math.max(18, Math.min(34, 18 + n.size / 800)),
      };
    });

    simRef.current = {
      nodes,
      edges: data.edges,
      running: true,
      hoveredId: null,
      selectedId: null,
    };
    cancelAnimationFrame(animRef.current);
    simulate(canvas, W, H);
  }, [simulate]);

  // ── fetchGraph ─────────────────────────────────────────────────────────────
  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(
        `https://codelens-backend-production.up.railway.app/api/repo/graph?repoPath=${encodeURIComponent(repoPath)}`
      );
      const data = res.data;
      setGraphData(data);
      setStats({
        nodes: data.nodes.length,
        edges: data.edges.length,
        types: [...new Set(data.nodes.map(n => n.type))],
      });
      initSimulation(data);
    } catch {
      setError("Failed to load dependency graph");
    } finally {
      setLoading(false);
    }
  }, [repoPath, initSimulation]);

  // ── effect ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (repoPath) fetchGraph();
    return () => {
      simRef.current.running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [repoPath, fetchGraph]);

  // ── mouse helpers ──────────────────────────────────────────────────────────
  const getNode = (e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const mx     = e.clientX - rect.left;
    const my     = e.clientY - rect.top;
    return simRef.current.nodes.find(n => {
      const dx = n.x - mx, dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
    });
  };

  const onMouseMove = (e) => {
    const node = getNode(e);
    setHoveredNode(node || null);
    simRef.current.hoveredId = node ? node.id : null;
    canvasRef.current.style.cursor = node ? "pointer" : "default";
    if (dragRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      dragRef.current.x = e.clientX - rect.left;
      dragRef.current.y = e.clientY - rect.top;
    }
  };

  const onMouseDown = (e) => {
    const node = getNode(e);
    if (node) dragRef.current = node;
  };

  const onMouseUp = (e) => {
    const node = getNode(e);
    if (node && dragRef.current?.id === node.id) {
      setSelectedNode(prev => {
        const next = prev?.id === node.id ? null : node;
        simRef.current.selectedId = next ? next.id : null;
        return next;
      });
    }
    dragRef.current = null;
  };

  const onMouseLeave = () => {
    setHoveredNode(null);
    simRef.current.hoveredId = null;
    dragRef.current = null;
  };

  const connectedIds = selectedNode
    ? new Set(
        simRef.current.edges
          .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
          .flatMap(e => [e.source, e.target])
      )
    : new Set();

  return (
    <div className="graph-container">

      {/* ── Top bar ── */}
      <div className="graph-topbar">
        <div className="graph-topbar-left">
          <span className="graph-title">⬡ Dependency Graph</span>
          {stats && (
            <div className="graph-stats">
              <span className="graph-stat">{stats.nodes} files</span>
              <span className="graph-stat">{stats.edges} connections</span>
            </div>
          )}
        </div>
        <div className="graph-legend">
          {Object.entries(TYPE_COLORS).filter(([k]) => k !== "other").map(([type, colors]) => (
            <div key={type} className="legend-item">
              <span className="legend-dot" style={{ background: colors.node }} />
              <span className="legend-label">{type}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="graph-body">
        <div className="graph-canvas-wrap">
          {loading && (
            <div className="graph-overlay">
              <div className="pulse-ring" />
              <p>Building dependency graph...</p>
            </div>
          )}
          {error && (
            <div className="graph-overlay">
              <p style={{ color: "var(--red)" }}>⚠ {error}</p>
            </div>
          )}
          {!loading && !error && !graphData && (
            <div className="graph-overlay">
              <p style={{ color: "var(--text3)" }}>Analyze a repo to see its dependency graph</p>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="graph-canvas"
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
          />
        </div>

        {selectedNode && (
          <div className="graph-side">
            <div className="graph-side-header">
              <span
                className="graph-side-dot"
                style={{ background: TYPE_COLORS[selectedNode.type]?.node }}
              />
              <span className="graph-side-name">{selectedNode.name}</span>
              <button
                className="graph-side-close"
                onClick={() => {
                  setSelectedNode(null);
                  simRef.current.selectedId = null;
                }}
              >✕</button>
            </div>

            <div className="graph-side-body">
              <div className="graph-side-row">
                <span className="graph-side-label">Type</span>
                <span className="graph-side-value">{selectedNode.type}</span>
              </div>
              <div className="graph-side-row">
                <span className="graph-side-label">Size</span>
                <span className="graph-side-value">{(selectedNode.size / 1024).toFixed(1)} KB</span>
              </div>
              <div className="graph-side-row">
                <span className="graph-side-label">Connections</span>
                <span className="graph-side-value">{connectedIds.size - 1}</span>
              </div>

              <div className="graph-side-section">Connected Files</div>
              <div className="graph-connections">
                {[...connectedIds]
                  .filter(id => id !== selectedNode.id)
                  .map(id => {
                    const node = simRef.current.nodes.find(n => n.id === id);
                    if (!node) return null;
                    return (
                      <div key={id} className="graph-connection-item">
                        <span
                          className="graph-connection-dot"
                          style={{ background: TYPE_COLORS[node.type]?.node }}
                        />
                        <span className="graph-connection-name">{node.name}</span>
                      </div>
                    );
                  })}
              </div>

              <button
                className="graph-open-btn"
                onClick={() => onFileClick && onFileClick(selectedNode)}
              >
                📄 Open File & Explain
              </button>
            </div>
          </div>
        )}
      </div>

      {hoveredNode && !selectedNode && (
        <div className="graph-tooltip">
          <strong>{hoveredNode.name}</strong>
          <span>{hoveredNode.type} · {(hoveredNode.size / 1024).toFixed(1)} KB</span>
          <span style={{ color: "var(--text3)", fontSize: "10px" }}>Click to inspect · Drag to move</span>
        </div>
      )}
    </div>
  );
}