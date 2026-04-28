import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChartColumn,
  CircleHelp,
  Clock3,
  Gauge,
  SendHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import { createDrill, reviewAttempt, sendChat } from "./api";
import { average, extractScore, formatElapsed } from "./utils";

const modeOptions = [
  {
    value: "hint",
    label: "Hint",
    description: "Small nudges that keep the student doing the thinking.",
  },
  {
    value: "tutor",
    label: "Tutor",
    description: "Balanced explanation, answer, and efficiency coaching.",
  },
  {
    value: "quiz",
    label: "Quiz",
    description: "Pressure-tested practice that expects an attempt first.",
  },
];

const starterTopics = [
  "Filtering failed sign-ins",
  "Summarizing event counts by user",
  "Joining security alerts with identity data",
  "Time-window analysis for spikes",
];

const emptyChat = [
  {
    role: "assistant",
    content: "Pick a topic, generate a drill, and I'll help you refine both accuracy and speed.",
  },
];

function App() {
  const [mode, setMode] = useState("tutor");
  const [topic, setTopic] = useState(starterTopics[0]);
  const [difficulty, setDifficulty] = useState("beginner");
  const [focus, setFocus] = useState("accuracy and efficient query structure");
  const [drill, setDrill] = useState("");
  const [attempt, setAttempt] = useState("");
  const [review, setReview] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState(emptyChat);
  const [loadingDrill, setLoadingDrill] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState({
    attempts: 0,
    durations: [],
    accuracyScores: [],
    efficiencyScores: [],
    modeCounts: { hint: 0, tutor: 0, quiz: 0 },
  });

  const drillStartedAt = useRef(null);
  const initialized = useRef(false);

  const stats = useMemo(() => {
    const avgAccuracy = average(session.accuracyScores);
    const avgEfficiency = average(session.efficiencyScores);
    const avgDuration = average(session.durations);

    return {
      attempts: session.attempts,
      avgAccuracy: avgAccuracy ? `${avgAccuracy.toFixed(1)}/10` : "No scores yet",
      avgEfficiency: avgEfficiency ? `${avgEfficiency.toFixed(1)}/10` : "No scores yet",
      avgDuration: session.durations.length ? formatElapsed(avgDuration) : "No submissions yet",
      strongestMode:
        Object.entries(session.modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "tutor",
    };
  }, [session]);

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    initialized.current = true;
    generateDrill();
  }, []);

  async function generateDrill() {
    setLoadingDrill(true);
    setError("");

    try {
      const response = await createDrill({ topic, difficulty, focus });
      setDrill(response.drill);
      setAttempt("");
      setReview("");
      setChatHistory(emptyChat);
      drillStartedAt.current = Date.now();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingDrill(false);
    }
  }

  async function handleReview() {
    if (!drill.trim() || !attempt.trim()) {
      setError("Generate a drill and write an answer before requesting feedback.");
      return;
    }

    setLoadingReview(true);
    setError("");

    try {
      const response = await reviewAttempt({
        question: drill,
        student_answer: attempt,
        mode,
      });

      const accuracyScore = extractScore(response.feedback, "Accuracy Score");
      const efficiencyScore = extractScore(response.feedback, "Efficiency Score");
      const elapsed = drillStartedAt.current ? Date.now() - drillStartedAt.current : 0;

      setReview(response.feedback);
      setSession((current) => ({
        attempts: current.attempts + 1,
        durations: elapsed ? [...current.durations, elapsed] : current.durations,
        accuracyScores:
          accuracyScore !== null ? [...current.accuracyScores, accuracyScore] : current.accuracyScores,
        efficiencyScores:
          efficiencyScore !== null
            ? [...current.efficiencyScores, efficiencyScore]
            : current.efficiencyScores,
        modeCounts: {
          ...current.modeCounts,
          [mode]: current.modeCounts[mode] + 1,
        },
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingReview(false);
    }
  }

  async function handleChat() {
    if (!chatInput.trim()) {
      return;
    }

    const nextHistory = [...chatHistory, { role: "user", content: chatInput }];
    setChatHistory(nextHistory);
    setLoadingChat(true);
    setError("");
    const prompt = `Current drill:\n${drill || "No drill yet."}\n\nStudent message:\n${chatInput}`;
    setChatInput("");

    try {
      const response = await sendChat({
        mode,
        prompt,
        history: nextHistory
          .filter((item) => item.role === "user" || item.role === "assistant")
          .slice(0, -1),
      });

      setChatHistory((current) => [...current, { role: "assistant", content: response.reply }]);
    } catch (requestError) {
      setError(requestError.message);
      setChatHistory((current) => current.slice(0, -1));
    } finally {
      setLoadingChat(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">AI-VERDE powered KQL coaching</p>
          <h1>KQL Studio Coach</h1>
          <p className="hero-copy">
            Build cleaner KQL faster with timed drills, targeted feedback, and guided tutoring that
            keeps students practicing instead of guessing.
          </p>
        </div>
        <div className="hero-card">
          <Sparkles size={24} />
          <p>Designed for accuracy first, then speed through repetition and review.</p>
        </div>
      </header>

      <main className="dashboard">
        <section className="panel controls-panel">
          <div className="panel-header">
            <Target size={18} />
            <h2>Practice Setup</h2>
          </div>

          <label>
            <span>Topic</span>
            <input value={topic} onChange={(event) => setTopic(event.target.value)} />
          </label>

          <div className="chips">
            {starterTopics.map((item) => (
              <button key={item} className="chip" type="button" onClick={() => setTopic(item)}>
                {item}
              </button>
            ))}
          </div>

          <label>
            <span>Difficulty</span>
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>

          <label>
            <span>Learning focus</span>
            <input value={focus} onChange={(event) => setFocus(event.target.value)} />
          </label>

          <div className="mode-grid">
            {modeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`mode-card ${mode === option.value ? "mode-card-active" : ""}`}
                onClick={() => setMode(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>

          <button className="primary-button" type="button" onClick={generateDrill} disabled={loadingDrill}>
            {loadingDrill ? "Generating..." : "Generate New Drill"}
          </button>
        </section>

        <section className="panel workspace-panel">
          <div className="panel-header">
            <CircleHelp size={18} />
            <h2>Current Drill</h2>
          </div>

          <article className="prompt-card">
            {drill ? <FormattedMessage content={drill} /> : <p>Generate a drill to begin.</p>}
          </article>

          <label className="attempt-block">
            <span>Your KQL answer</span>
            <textarea
              value={attempt}
              onChange={(event) => setAttempt(event.target.value)}
              placeholder="SecurityEvent | where ..."
            />
          </label>

          <div className="actions">
            <button className="primary-button" type="button" onClick={handleReview} disabled={loadingReview}>
              {loadingReview ? "Reviewing..." : "Review My Answer"}
            </button>
            <span className="microcopy">Timed from drill generation to submission.</span>
          </div>

          <div className="review-card">
            <div className="panel-header">
              <Gauge size={18} />
              <h2>Coach Feedback</h2>
            </div>
            {review ? (
              <FormattedMessage content={review} />
            ) : (
              <p>Feedback will appear here after you submit an attempt.</p>
            )}
          </div>
        </section>

        <aside className="panel sidebar-panel">
          <div className="stats-grid">
            <StatCard icon={<ChartColumn size={18} />} label="Attempts" value={String(stats.attempts)} />
            <StatCard icon={<Target size={18} />} label="Avg accuracy" value={stats.avgAccuracy} />
            <StatCard icon={<Gauge size={18} />} label="Avg efficiency" value={stats.avgEfficiency} />
            <StatCard icon={<Clock3 size={18} />} label="Avg review time" value={stats.avgDuration} />
          </div>

          <div className="sidebar-note">
            <strong>Mode trend</strong>
            <p>
              Most-used mode this session: <span>{stats.strongestMode}</span>
            </p>
          </div>

          <div className="chat-card">
            <div className="panel-header">
              <Bot size={18} />
              <h2>Tutor Chat</h2>
            </div>
            <div className="chat-feed">
              {chatHistory.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`chat-bubble ${message.role === "user" ? "chat-user" : "chat-assistant"}`}
                >
                  <FormattedMessage content={message.content} />
                </div>
              ))}
            </div>
            <div className="chat-compose">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask for a hint, an explanation, or a faster approach..."
              />
              <button type="button" className="icon-button" onClick={handleChat} disabled={loadingChat}>
                <SendHorizontal size={18} />
              </button>
            </div>
          </div>

          {error ? <p className="error-banner">{error}</p> : null}
        </aside>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FormattedMessage({ content }) {
  const blocks = parseMessage(content);

  return (
    <div className="message-content">
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <pre key={index} className="message-code">
              <code>{block.content}</code>
            </pre>
          );
        }

        if (block.type === "ordered") {
          return (
            <ol key={index} className="message-list">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "unordered") {
          return (
            <ul key={index} className="message-list">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="message-paragraph">
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
}

function parseMessage(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const segments = normalized.split(/```(?:[\w-]+)?\n?|\n```/);
  const blocks = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment.trim()) {
      continue;
    }

    if (index % 2 === 1) {
      blocks.push({ type: "code", content: segment.trim() });
      continue;
    }

    const paragraphs = segment
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    paragraphs.forEach((paragraph) => {
      const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
      let currentParagraph = [];
      let currentList = null;

      function flushParagraph() {
        if (!currentParagraph.length) {
          return;
        }

        blocks.push({ type: "paragraph", content: currentParagraph.join(" ") });
        currentParagraph = [];
      }

      function flushList() {
        if (!currentList || !currentList.items.length) {
          return;
        }

        blocks.push(currentList);
        currentList = null;
      }

      lines.forEach((line) => {
        const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
        const unorderedMatch = line.match(/^[-*]\s+(.*)$/);

        if (orderedMatch) {
          flushParagraph();
          if (!currentList || currentList.type !== "ordered") {
            flushList();
            currentList = { type: "ordered", items: [] };
          }
          currentList.items.push(orderedMatch[2]);
          return;
        }

        if (unorderedMatch) {
          flushParagraph();
          if (!currentList || currentList.type !== "unordered") {
            flushList();
            currentList = { type: "unordered", items: [] };
          }
          currentList.items.push(unorderedMatch[1]);
          return;
        }

        flushList();
        currentParagraph.push(line);
      });

      flushList();
      flushParagraph();
    });
  }

  return blocks;
}

function renderInline(text) {
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    return <span key={index}>{part}</span>;
  });
}

export default App;
