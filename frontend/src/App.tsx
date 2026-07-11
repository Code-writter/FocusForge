import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

type ColumnId = "backlog" | "firing" | "forged";
type Priority = "High" | "Medium" | "Low";

interface Task {
  id: string;
  task: string;
  priority: Priority;
  impact: string;
  immediateNextStep: string;
  status: ColumnId;
}

const COLUMNS: { id: ColumnId; label: string; hint: string }[] = [
  { id: "backlog", label: "Backlog", hint: "Raw & waiting" },
  { id: "firing", label: "In the Fire", hint: "Being worked" },
  { id: "forged", label: "Forged", hint: "Done & tempered" },
];

// ⚠️ YOUR EXACT API ENDPOINT
const API_ENDPOINT =
  "https://0ifogwu7dc.execute-api.eu-north-1.amazonaws.com/prioritize";

const STORAGE_KEY = "focusforge.tasks.v2";

const uid = () => Math.random().toString(36).slice(2, 11);

const normalizePriority = (p: unknown): Priority => {
  const s = String(p ?? "").toLowerCase();
  if (s.startsWith("h")) return "High";
  if (s.startsWith("l")) return "Low";
  return "Medium";
};

const DEMO: Omit<Task, "id" | "status">[] = [
  {
    task: "Fix the production deployment bug",
    priority: "High",
    impact: "Unblocks all users",
    immediateNextStep:
      "Reproduce locally, then patch the failing pipeline step",
  },
  {
    task: "Review open-source PR submissions",
    priority: "Medium",
    impact: "Keeps contributors engaged",
    immediateNextStep:
      "Skim diffs, leave review comments on the two oldest PRs",
  },
  {
    task: "Email Sarah about dashboard updates",
    priority: "Medium",
    impact: "Keeps stakeholders aligned",
    immediateNextStep: "Draft a 3-line summary of the new charts and send",
  },
  {
    task: "Buy coffee beans",
    priority: "Low",
    impact: "Personal fuel",
    immediateNextStep: "Add to the grocery order",
  },
];

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

function priorityMeta(p: Priority) {
  if (p === "High")
    return { dot: "#ff5722", glow: "rgba(255,107,53,.35)", label: "High heat" };
  if (p === "Medium")
    return { dot: "#f7a531", glow: "rgba(247,165,49,.28)", label: "Warm" };
  return { dot: "#5aa9e6", glow: "rgba(90,169,230,.22)", label: "Cool" };
}

function TaskCardBody({
  task,
  onDelete,
  dragging,
}: {
  task: Task;
  onDelete?: (id: string) => void;
  dragging?: boolean;
}) {
  const meta = priorityMeta(task.priority);
  return (
    <div
      className={`ff-card ${dragging ? "ff-card--overlay" : ""}`}
      style={{
        ["--heat" as string]: meta.dot,
        ["--heat-glow" as string]: meta.glow,
      }}
    >
      <span className="ff-card__heat" aria-hidden />
      <div className="ff-card__top">
        <span className="ff-badge">
          <span className="ff-badge__dot" />
          {task.priority}
        </span>
        {onDelete && (
          <button
            className="ff-card__del"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(task.id)}
            aria-label="Delete task"
            title="Delete"
          >
            ×
          </button>
        )}
      </div>
      <p className="ff-card__title">{task.task}</p>
      {task.impact && (
        <p className="ff-card__meta">
          <span className="ff-card__key">Impact</span>
          {task.impact}
        </p>
      )}
      {task.immediateNextStep && (
        <p className="ff-card__step">
          <span className="ff-card__key">Next</span>
          {task.immediateNextStep}
        </p>
      )}
    </div>
  );
}

function SortableCard({
  task,
  onDelete,
}: {
  task: Task;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        touchAction: "none",
      }}
    >
      <TaskCardBody task={task} onDelete={onDelete} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Column                                                             */
/* ------------------------------------------------------------------ */

function Column({
  col,
  tasks,
  onDelete,
}: {
  col: { id: ColumnId; label: string; hint: string };
  tasks: Task[];
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <section
      className={`ff-col ff-col--${col.id} ${isOver ? "ff-col--over" : ""}`}
    >
      <header className="ff-col__head">
        <div>
          <h3 className="ff-col__title">{col.label}</h3>
          <span className="ff-col__hint">{col.hint}</span>
        </div>
        <span className="ff-col__count">{tasks.length}</span>
      </header>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="ff-col__body">
          {tasks.length === 0 ? (
            <div className="ff-col__empty">
              {col.id === "backlog"
                ? "Forge a strategy above to fill the backlog."
                : "Drag cards here."}
            </div>
          ) : (
            tasks.map((t) => (
              <SortableCard key={t.id} task={t} onDelete={onDelete} />
            ))
          )}
        </div>
      </SortableContext>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

function App() {
  const [input, setInput] = useState("");
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Task[]) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      /* storage full / unavailable — ignore */
    }
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findContainer = (id: string): ColumnId | undefined => {
    if (COLUMNS.some((c) => c.id === id)) return id as ColumnId;
    return tasks.find((t) => t.id === id)?.status;
  };

  const handleDragStart = (e: DragStartEvent) =>
    setActiveId(String(e.active.id));

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const from = findContainer(String(active.id));
    const to = findContainer(String(over.id));
    if (!from || !to || from === to) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === active.id ? { ...t, status: to } : t)),
    );
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const to = findContainer(String(over.id));
    if (!to) return;
    setTasks((prev) => {
      let next = prev.map((t) =>
        t.id === active.id ? { ...t, status: to } : t,
      );
      const overIsColumn = COLUMNS.some((c) => c.id === over.id);
      if (overIsColumn) return next;
      const oldIndex = next.findIndex((t) => t.id === active.id);
      const newIndex = next.findIndex((t) => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1)
        next = arrayMove(next, oldIndex, newIndex);
      return next;
    });
  };

  const ingest = (raw: Omit<Task, "id" | "status">[]) =>
    setTasks((prev) => [
      ...raw.map((r) => ({
        id: uid(),
        task: r.task,
        priority: normalizePriority(r.priority),
        impact: r.impact ?? "",
        immediateNextStep: r.immediateNextStep ?? "",
        status: "backlog" as ColumnId,
      })),
      ...prev,
    ]);

  const handlePrioritize = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setStatusText("Heating the forge — contacting API Gateway…");
    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ rawTasks: input }),
      });
      if (!response.ok) throw new Error("Failed to connect to the AI engine.");
      setStatusText("Analyzing with Amazon Nova Lite…");
      const rawText = await response.text();
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (!jsonMatch)
        throw new Error("The AI did not return a valid JSON array.");
      const parsed = JSON.parse(jsonMatch[0]) as Omit<Task, "id" | "status">[];
      ingest(parsed);
      setInput("");
      setStatusText(
        `Forged ${parsed.length} task${parsed.length === 1 ? "" : "s"} into the backlog.`,
      );
    } catch (err) {
      console.error("Error details:", err);
      setError(
        "Could not reach the forge. Check the browser console, or load the demo below.",
      );
      setStatusText("");
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = (id: string) =>
    setTasks((prev) => prev.filter((t) => t.id !== id));
  const clearAll = () => {
    if (
      tasks.length &&
      confirm("Clear the whole board? This cannot be undone.")
    )
      setTasks([]);
  };
  const loadDemo = () => {
    ingest(DEMO);
    setError(null);
    setStatusText("Loaded a sample batch. Drag cards between stages.");
  };

  const byCol = (c: ColumnId) => tasks.filter((t) => t.status === c);
  const total = tasks.length;
  const done = byCol("forged").length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const activeTask = activeId
    ? (tasks.find((t) => t.id === activeId) ?? null)
    : null;

  return (
    <div className="ff-app">
      <FFStyles />

      {/* HEADER */}
      <header className="ff-header">
        <div className="ff-header__inner">
          <div className="ff-brand">
            <span className="ff-brand__mark" aria-hidden>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
            <span className="ff-brand__name">
              Focus<span>Forge</span>
            </span>
          </div>
          <span className="ff-tag">AWS Builder Challenge</span>
        </div>
      </header>

      <main className="ff-main">
        {/* HERO */}
        <div className="ff-hero">
          <span className="ff-eyebrow">
            Task triage · powered by Amazon Bedrock
          </span>
          <h1 className="ff-title">
            Dump the chaos.
            <br />
            <em>Forge</em> the plan.
          </h1>
          <p className="ff-sub">
            Write your tangled to-dos in plain language. The forge heats them,
            ranks them by priority, and hands back a Kanban you can actually
            execute.
          </p>
        </div>

        {/* FORGE INPUT */}
        <div className="ff-forge">
          <textarea
            className="ff-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            placeholder="e.g. Fix the production deploy bug asap, email Sarah about the dashboard, buy coffee beans, review the open PRs by tonight…"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                handlePrioritize();
            }}
          />
          <div className="ff-forge__row">
            <span className="ff-hint">⌘ / Ctrl + Enter to forge</span>
            <button
              className="ff-btn ff-btn--primary"
              onClick={handlePrioritize}
              disabled={loading || !input.trim()}
            >
              {loading ? (
                <>
                  <svg
                    className="ff-spin"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Forging…
                </>
              ) : (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  Forge my strategy
                </>
              )}
            </button>
          </div>
          {error && <div className="ff-error">{error}</div>}
        </div>

        {/* STATUS + PROGRESS */}
        {(total > 0 || statusText) && (
          <div className="ff-status">
            <div className="ff-status__line">
              <span
                className={`ff-status__dot ${loading ? "is-loading" : ""}`}
              />
              <span className="ff-status__text">{statusText || "Ready."}</span>
            </div>
            {total > 0 && (
              <div className="ff-progress">
                <div className="ff-progress__bar">
                  <div
                    className="ff-progress__fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="ff-progress__label">
                  {done}/{total} forged · {pct}%
                </span>
                <button className="ff-btn ff-btn--ghost" onClick={clearAll}>
                  Clear board
                </button>
              </div>
            )}
          </div>
        )}

        {/* BOARD */}
        {total > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="ff-board" ref={boardRef}>
              {COLUMNS.map((col) => (
                <Column
                  key={col.id}
                  col={col}
                  tasks={byCol(col.id)}
                  onDelete={deleteTask}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {activeTask ? <TaskCardBody task={activeTask} dragging /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          !statusText && (
            <div className="ff-firstrun">
              <p>Nothing on the anvil yet.</p>
              <button className="ff-btn ff-btn--ghost" onClick={loadDemo}>
                Load a sample batch
              </button>
            </div>
          )
        )}

        {error && total === 0 && (
          <div className="ff-firstrun">
            <button className="ff-btn ff-btn--ghost" onClick={loadDemo}>
              Load a sample batch instead
            </button>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="ff-footer">
        <div className="ff-footer__inner">
          <span className="ff-footer__brand">⚡ FocusForge</span>
          <p>
            Architected by Abhishek Tiwari · AWS “Build a Productivity App”
            Weekend Challenge
          </p>
          <div className="ff-footer__stack">
            <span>Amazon Bedrock · Nova Lite</span>
            <span>·</span>
            <span>Lambda + API Gateway</span>
            <span>·</span>
            <span>Hosted on Amazon S3</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

function FFStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

.ff-app{
  --steel-950:#0b0d12; --steel-900:#101319; --steel-850:#141821; --steel-800:#191e29;
  --line:#242b38; --line-soft:#1c2230;
  --text:#f3f1ec; --muted:#9aa4b6; --faint:#657085;
  --ember-1:#ff6a3d; --ember-2:#f7a531;
  min-height:100vh; display:flex; flex-direction:column;
  background:
    radial-gradient(1100px 500px at 50% -8%, rgba(255,106,61,.10), transparent 60%),
    var(--steel-950);
  color:var(--text);
  font-family:'Inter',system-ui,-apple-system,sans-serif;
  -webkit-font-smoothing:antialiased;
}
.ff-app *{box-sizing:border-box;}

/* header */
.ff-header{position:sticky;top:0;z-index:40;backdrop-filter:blur(10px);
  background:rgba(11,13,18,.72);border-bottom:1px solid var(--line-soft);}
.ff-header__inner{max-width:1180px;margin:0 auto;padding:.9rem 1.5rem;
  display:flex;align-items:center;justify-content:space-between;}
.ff-brand{display:flex;align-items:center;gap:.6rem;}
.ff-brand__mark{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;color:#0b0d12;
  background:linear-gradient(135deg,var(--ember-1),var(--ember-2));
  box-shadow:0 6px 18px -6px rgba(255,106,61,.6);}
.ff-brand__name{font-family:'Space Grotesk';font-weight:700;font-size:1.15rem;letter-spacing:-.02em;}
.ff-brand__name span{color:var(--ember-2);}
.ff-tag{font-size:.78rem;color:var(--muted);padding:.35rem .75rem;border-radius:99px;
  background:var(--steel-850);border:1px solid var(--line);}

/* main */
.ff-main{flex:1;width:100%;max-width:1180px;margin:0 auto;padding:3.5rem 1.5rem 4rem;}

/* hero */
.ff-hero{max-width:720px;margin-bottom:2.25rem;animation:ff-rise .6s ease both;}
.ff-eyebrow{font-size:.8rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ember-2);}
.ff-title{font-family:'Space Grotesk';font-weight:700;font-size:clamp(2.4rem,6vw,4rem);
  line-height:1.02;letter-spacing:-.03em;margin:.7rem 0 1rem;}
.ff-title em{font-style:normal;
  background:linear-gradient(120deg,var(--ember-1),var(--ember-2));
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.ff-sub{color:var(--muted);font-size:1.1rem;line-height:1.6;max-width:600px;}

/* forge input */
.ff-forge{background:var(--steel-900);border:1px solid var(--line);border-radius:18px;
  padding:1.25rem;box-shadow:0 30px 60px -30px rgba(0,0,0,.7);animation:ff-rise .6s .06s ease both;}
.ff-textarea{width:100%;padding:1.05rem;border-radius:12px;border:1px solid var(--line);
  background:var(--steel-950);color:var(--text);font:inherit;font-size:1.05rem;line-height:1.55;
  resize:vertical;outline:none;transition:border-color .18s,box-shadow .18s;}
.ff-textarea::placeholder{color:var(--faint);}
.ff-textarea:focus{border-color:var(--ember-1);box-shadow:0 0 0 3px rgba(255,106,61,.16);}
.ff-forge__row{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1rem;flex-wrap:wrap;}
.ff-hint{color:var(--faint);font-size:.85rem;}

/* buttons */
.ff-btn{display:inline-flex;align-items:center;gap:.55rem;border:none;cursor:pointer;
  font:inherit;font-weight:600;border-radius:11px;transition:transform .16s,box-shadow .16s,background .16s,color .16s;}
.ff-btn--primary{padding:.85rem 1.5rem;font-size:1rem;color:#140b06;
  background:linear-gradient(135deg,var(--ember-1),var(--ember-2));
  box-shadow:0 12px 30px -12px rgba(255,106,61,.7);}
.ff-btn--primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 16px 36px -12px rgba(255,106,61,.85);}
.ff-btn--primary:disabled{background:var(--steel-800);color:var(--faint);cursor:not-allowed;box-shadow:none;}
.ff-btn--ghost{padding:.5rem .95rem;font-size:.85rem;color:var(--muted);
  background:var(--steel-850);border:1px solid var(--line);}
.ff-btn--ghost:hover{color:var(--text);border-color:var(--ember-1);}

.ff-error{margin-top:1rem;padding:.85rem 1rem;border-radius:10px;font-size:.92rem;
  background:rgba(255,106,61,.08);border:1px solid rgba(255,106,61,.3);color:#ffb59b;}

/* status + progress */
.ff-status{margin:2.5rem 0 1.25rem;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;}
.ff-status__line{display:flex;align-items:center;gap:.6rem;}
.ff-status__dot{width:9px;height:9px;border-radius:50%;background:var(--ember-2);box-shadow:0 0 10px var(--ember-2);}
.ff-status__dot.is-loading{animation:ff-pulse 1s infinite;}
.ff-status__text{color:var(--muted);font-size:.92rem;font-weight:500;}
.ff-progress{display:flex;align-items:center;gap:.9rem;}
.ff-progress__bar{width:160px;height:7px;border-radius:99px;background:var(--steel-800);overflow:hidden;border:1px solid var(--line);}
.ff-progress__fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--ember-1),var(--ember-2));transition:width .5s ease;}
.ff-progress__label{color:var(--muted);font-size:.85rem;white-space:nowrap;}

/* board */
.ff-board{display:grid;grid-template-columns:repeat(3,1fr);gap:1.1rem;align-items:start;}
.ff-col{background:var(--steel-900);border:1px solid var(--line);border-radius:16px;padding:1rem;
  min-height:180px;transition:border-color .18s,background .18s;}
.ff-col--over{border-color:var(--ember-1);background:var(--steel-850);}
.ff-col__head{display:flex;align-items:flex-start;justify-content:space-between;
  padding:.15rem .35rem .9rem;border-bottom:1px solid var(--line-soft);margin-bottom:.9rem;}
.ff-col__title{margin:0;font-family:'Space Grotesk';font-size:1.02rem;font-weight:600;letter-spacing:-.01em;}
.ff-col__hint{font-size:.76rem;color:var(--faint);}
.ff-col__count{font-size:.82rem;font-weight:600;color:var(--muted);background:var(--steel-800);
  border:1px solid var(--line);border-radius:8px;padding:.15rem .55rem;min-width:28px;text-align:center;}
.ff-col--firing .ff-col__count{color:var(--ember-2);border-color:rgba(247,165,49,.35);}
.ff-col--forged .ff-col__count{color:#7fdca0;border-color:rgba(52,211,153,.3);}
.ff-col__body{display:flex;flex-direction:column;gap:.75rem;min-height:60px;}
.ff-col__empty{color:var(--faint);font-size:.85rem;text-align:center;padding:1.4rem .5rem;
  border:1px dashed var(--line);border-radius:11px;}

/* card */
.ff-card{position:relative;background:var(--steel-850);border:1px solid var(--line);
  border-radius:12px;padding:.9rem .9rem .9rem 1.05rem;overflow:hidden;cursor:grab;
  transition:border-color .16s,transform .12s,box-shadow .16s;}
.ff-card:hover{border-color:#33404f;transform:translateY(-1px);}
.ff-card:active{cursor:grabbing;}
.ff-card--overlay{cursor:grabbing;box-shadow:0 24px 44px -18px rgba(0,0,0,.75);
  transform:rotate(1.5deg) scale(1.02);border-color:var(--heat);}
.ff-card__heat{position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--heat);
  box-shadow:0 0 14px var(--heat-glow);}
.ff-card__top{display:flex;align-items:center;justify-content:space-between;margin-bottom:.55rem;}
.ff-badge{display:inline-flex;align-items:center;gap:.4rem;font-size:.72rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.05em;color:var(--heat);}
.ff-badge__dot{width:7px;height:7px;border-radius:50%;background:var(--heat);box-shadow:0 0 8px var(--heat-glow);}
.ff-card__del{width:24px;height:24px;line-height:1;border-radius:6px;border:1px solid transparent;
  background:transparent;color:var(--faint);font-size:1.15rem;cursor:pointer;transition:all .15s;}
.ff-card__del:hover{background:rgba(255,106,61,.12);color:#ffb59b;border-color:rgba(255,106,61,.3);}
.ff-card__title{margin:0 0 .55rem;font-size:1rem;font-weight:600;line-height:1.4;color:var(--text);}
.ff-card__meta,.ff-card__step{margin:.3rem 0 0;font-size:.86rem;line-height:1.5;color:var(--muted);}
.ff-card__step{color:var(--faint);font-style:italic;}
.ff-card__key{display:inline-block;font-size:.66rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;color:var(--faint);margin-right:.5rem;font-style:normal;}

/* first run */
.ff-firstrun{margin-top:2.5rem;text-align:center;color:var(--muted);
  display:flex;flex-direction:column;align-items:center;gap:.9rem;
  border:1px dashed var(--line);border-radius:16px;padding:2.5rem 1rem;}

/* footer */
.ff-footer{border-top:1px solid var(--line-soft);background:var(--steel-950);margin-top:auto;padding:2.25rem 1.5rem;}
.ff-footer__inner{max-width:1180px;margin:0 auto;text-align:center;color:var(--faint);display:flex;flex-direction:column;gap:.5rem;}
.ff-footer__brand{font-family:'Space Grotesk';font-weight:600;color:var(--text);}
.ff-footer p{margin:0;font-size:.9rem;}
.ff-footer__stack{display:flex;flex-wrap:wrap;justify-content:center;gap:.6rem;font-size:.82rem;margin-top:.35rem;}

/* motion */
@keyframes ff-spin{to{transform:rotate(360deg);}}
.ff-spin{animation:ff-spin 1s linear infinite;}
@keyframes ff-pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
@keyframes ff-rise{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}

/* responsive */
@media (max-width:860px){
  .ff-board{grid-template-columns:1fr;}
  .ff-main{padding:2.5rem 1.1rem 3rem;}
}
@media (prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important;}
}
:focus-visible{outline:2px solid var(--ember-1);outline-offset:2px;}
`}</style>
  );
}

export default App;
