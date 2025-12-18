import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, CalendarDays, CheckCircle2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Habit, TodoItem } from '../types';
import { api } from '../services/firebase';

const pad2 = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const startOfWeekMonday = (d: Date): Date => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // Mon=0
  date.setDate(date.getDate() - diff);
  return date;
};

const addDays = (d: Date, days: number): Date => {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date;
};

const formatDayLabel = (d: Date): string =>
  d.toLocaleDateString(undefined, { weekday: 'long' });

const formatShortDate = (d: Date): string =>
  d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const ProgressRing: React.FC<{ value: number; size?: number; stroke?: number }> = ({
  value,
  size = 72,
  stroke = 8,
}) => {
  const v = clamp01(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * v;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="fill-foreground text-sm font-semibold"
      >
        {Math.round(v * 100)}%
      </text>
    </svg>
  );
};

const ToDoPage: React.FC = () => {
  const { user } = useAuth();

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addingForDate, setAddingForDate] = useState<Record<string, string>>({});
  const [newHabit, setNewHabit] = useState('');

  const weekStart = useMemo(() => startOfWeekMonday(new Date()), []);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekStartISO = useMemo(() => toISODate(weekStart), [weekStart]);
  const weekEndISO = useMemo(() => toISODate(addDays(weekStart, 6)), [weekStart]);

  useEffect(() => {
    if (!user) return;
    setError(null);
    setNotice(null);

    const unsubTodos = api.onTodoItemsChanged(user.uid, weekStartISO, weekEndISO, setTodos, (e: any) => {
      const message = e?.message || String(e);
      setError(message);
    });
    const unsubHabits = api.onHabitsChanged(user.uid, setHabits, (e: any) => {
      const message = e?.message || String(e);
      setError(message);
    });

    return () => {
      unsubTodos?.();
      unsubHabits?.();
    };
  }, [user, weekStartISO, weekEndISO]);

  const todosByDate = useMemo(() => {
    const map: Record<string, TodoItem[]> = {};
    for (const t of todos) {
      map[t.date] = map[t.date] || [];
      map[t.date].push(t);
    }
    // stable ordering: incomplete first, then createdAt
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const am = (a.createdAt as any)?.toMillis?.() ?? 0;
        const bm = (b.createdAt as any)?.toMillis?.() ?? 0;
        return am - bm;
      });
    }
    return map;
  }, [todos]);

  const weekStats = useMemo(() => {
    const byDay = weekDays.map((d) => {
      const iso = toISODate(d);
      const items = todosByDate[iso] || [];
      const total = items.length;
      const done = items.filter((t) => t.completed).length;
      const pct = total > 0 ? done / total : 0;
      return { iso, total, done, pct };
    });
    const total = byDay.reduce((s, x) => s + x.total, 0);
    const done = byDay.reduce((s, x) => s + x.done, 0);
    const pct = total > 0 ? done / total : 0;
    return { byDay, total, done, pct };
  }, [weekDays, todosByDate]);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="relative pt-8 pb-12 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background to-secondary/10" />
      <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="w-4 h-4" />
              Weekly study system
            </div>
            <div className="mt-3 flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-5 h-5" />
              <span className="text-sm font-medium">Personalized To-Do</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mt-1">Mega Calendar</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Week of {formatShortDate(weekStart)} — {formatShortDate(addDays(weekStart, 6))}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              className="rounded-2xl border border-border bg-background/70 px-3 py-2 text-sm hover:bg-accent/60 backdrop-blur"
              onClick={async () => {
                try {
                  setError(null);
                  setNotice(null);
                  const prevStart = toISODate(addDays(weekStart, -7));
                  const prevEnd = toISODate(addDays(weekStart, -1));
                  const created = await api.rolloverIncompleteTodosFromRange(user.uid, prevStart, prevEnd);
                  setNotice(created > 0 ? `Rolled over ${created} unfinished task(s) from last week.` : 'No unfinished tasks to roll over.');
                } catch (e: any) {
                  setError(e?.message || 'Rollover failed');
                }
              }}
              title="Copy last week's unfinished tasks into this week"
            >
              Rollover unfinished
            </button>
            <button
              className="rounded-2xl border border-border bg-background/70 px-3 py-2 text-sm hover:bg-accent/60 backdrop-blur"
              onClick={async () => {
                const ok = window.confirm('Clear ALL your tasks and habits? This cannot be undone.');
                if (!ok) return;
                try {
                  setError(null);
                  setNotice(null);
                  const [deletedTodos, deletedHabits] = await Promise.all([
                    api.clearAllTodos(user.uid),
                    api.clearAllHabits(user.uid),
                  ]);
                  setNotice(`Cleared ${deletedTodos} task(s) and ${deletedHabits} habit(s). Fresh start.`);
                } catch (e: any) {
                  setError(e?.message || 'Clear failed');
                }
              }}
              title="Start fresh"
            >
              Clear everything
            </button>
          </div>
        </div>
      </motion.div>

      {notice && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8 rounded-2xl border border-border bg-card/60 p-4 text-sm backdrop-blur"
        >
          <div className="font-medium text-foreground">{notice}</div>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 w-4 h-4 text-destructive" />
            <div>
              <div className="font-semibold text-foreground">To-Do data error</div>
              <div className="mt-1 text-muted-foreground break-words">{error}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                If you see <span className="font-medium">Missing or insufficient permissions</span>, publish the updated Firestore rules.
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Overall Progress */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="bg-card/70 border border-border rounded-3xl p-6 shadow-sm mb-8 backdrop-blur"
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Overall Progress</h2>
              <div className="text-xs text-muted-foreground">
                {weekStats.done}/{weekStats.total} Completed
              </div>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2 items-end h-24">
              {weekStats.byDay.map((d) => (
                <div key={d.iso} className="flex flex-col items-center gap-2">
                  <div className="w-full h-16 flex items-end">
                    <div
                      className="w-full rounded-lg bg-muted"
                      style={{ height: '100%' }}
                    >
                      <div
                        className="w-full rounded-lg bg-primary/80"
                        style={{ height: `${Math.round(d.pct * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(d.iso).toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ProgressRing value={weekStats.pct} size={88} stroke={10} />
            <div>
              <div className="text-sm text-muted-foreground">This week</div>
              <div className="text-xl font-bold text-foreground">
                {Math.round(weekStats.pct * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">Complete</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Week + Habit Tracker */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {weekDays.map((day) => {
            const iso = toISODate(day);
            const items = todosByDate[iso] || [];
            const done = items.filter((t) => t.completed).length;
            const pct = items.length > 0 ? done / items.length : 0;

            return (
              <motion.div
                key={iso}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.08 }}
                className="bg-card/70 border border-border rounded-3xl p-5 shadow-sm backdrop-blur"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-bold text-foreground">{formatDayLabel(day)}</div>
                    <div className="text-xs text-muted-foreground">{formatShortDate(day)}</div>
                  </div>
                  <ProgressRing value={pct} size={64} stroke={8} />
                </div>

                <div className="mt-4 space-y-2">
                  {items.length === 0 ? (
                    <div className="text-sm text-muted-foreground bg-muted/40 rounded-xl p-4">
                      No tasks yet
                    </div>
                  ) : (
                    items.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 bg-muted/30 rounded-xl px-3 py-2">
                        <button
                          className="shrink-0 text-primary"
                          onClick={() => {
                            setError(null);
                            return api.setTodoCompleted(user.uid, t.id, !t.completed);
                          }}
                          title={t.completed ? 'Mark as incomplete' : 'Mark as complete'}
                        >
                          <CheckCircle2 className={t.completed ? 'w-5 h-5' : 'w-5 h-5 opacity-40'} />
                        </button>
                        <div className={t.completed ? 'text-sm text-muted-foreground line-through flex-1' : 'text-sm text-foreground flex-1'}>
                          {t.title}
                        </div>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setError(null);
                            return api.deleteTodo(user.uid, t.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    value={addingForDate[iso] || ''}
                    onChange={(e) => setAddingForDate((prev) => ({ ...prev, [iso]: e.target.value }))}
                    placeholder="Add a task…"
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    className="px-3 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors"
                    onClick={async () => {
                      const text = (addingForDate[iso] || '').trim();
                      if (!text) return;
                      setError(null);
                      await api.addTodo({ uid: user.uid, date: iso, title: text });
                      setAddingForDate((prev) => ({ ...prev, [iso]: '' }));
                    }}
                    title="Add"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="bg-card/70 border border-border rounded-3xl p-6 shadow-sm backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Habit Tracker</h2>
            <div className="text-xs text-muted-foreground">Last 7 days</div>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
              placeholder="Add a habit…"
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              className="px-3 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors"
              onClick={async () => {
                const name = newHabit.trim();
                if (!name) return;
                setError(null);
                await api.addHabit({ uid: user.uid, name });
                setNewHabit('');
              }}
              title="Add habit"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-8 gap-2 text-xs text-muted-foreground mb-2">
                <div className="col-span-1">Habit</div>
                {weekDays.map((d) => (
                  <div key={toISODate(d)} className="text-center">
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {habits.length === 0 ? (
                  <div className="text-sm text-muted-foreground bg-muted/40 rounded-xl p-4">No habits yet</div>
                ) : (
                  habits.map((h) => (
                    <div key={h.id} className="grid grid-cols-8 gap-2 items-center bg-muted/20 rounded-xl p-2">
                      <div className="col-span-1 text-sm text-foreground font-medium truncate" title={h.name}>
                        {h.name}
                      </div>
                      {weekDays.map((d) => {
                        const iso = toISODate(d);
                        const checked = !!(h.completions && (h.completions as any)[iso]);
                        return (
                          <button
                            key={iso}
                            className={
                              checked
                                ? 'h-9 rounded-lg bg-primary/20 border border-primary/30'
                                : 'h-9 rounded-lg bg-background border border-border hover:bg-muted'
                            }
                            onClick={() => {
                              setError(null);
                              return api.setHabitCompletion(user.uid, h.id, iso, !checked);
                            }}
                            title={checked ? 'Mark incomplete' : 'Mark complete'}
                          />
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ToDoPage;
