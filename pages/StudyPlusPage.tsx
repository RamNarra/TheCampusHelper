import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Clock,
  FileText,
  Binary,
  Cpu,
  FunctionSquare,
  Youtube,
} from 'lucide-react';
import { getSubjects } from '../lib/data';
import type { BranchKey } from '../types';
import { Page } from '../components/ui/Page';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

type StudyPlusToolId =
  | 'branch_subjects'
  | 'semester_reference'
  | 'study_timer'
  | 'focus_youtube'
  | 'quick_notes'
  | 'number_converter'
  | 'logic_gate_sim'
  | 'binary_operations';

const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

const BRANCHES: BranchKey[] = ['CSE', 'IT', 'DS', 'AIML', 'CYS', 'ECE', 'EEE', 'MECH', 'CIVIL'];

const branchLabel = (b: BranchKey): string => {
  if (b === 'CSE') return 'CSE';
  if (b === 'IT') return 'IT';
  if (b === 'DS') return 'DS';
  if (b === 'AIML') return 'AIML';
  if (b === 'CYS') return 'CYS';
  if (b === 'ECE') return 'ECE';
  if (b === 'EEE') return 'EEE';
  if (b === 'MECH') return 'Mechanical';
  return 'Civil';
};

const pad2 = (n: number) => n.toString().padStart(2, '0');

const formatMmSs = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
};

const extractYouTubeId = (input: string): string | null => {
  const raw = input.trim();
  if (!raw) return null;

  // Accept direct video id
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const url = new URL(raw);

    // youtu.be/<id>
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.replace('/', '').trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // youtube.com/watch?v=<id>
    if (url.searchParams.has('v')) {
      const id = url.searchParams.get('v') || '';
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // youtube.com/embed/<id>
    const parts = url.pathname.split('/').filter(Boolean);
    const embedIdx = parts.indexOf('embed');
    if (embedIdx >= 0 && parts[embedIdx + 1]) {
      const id = parts[embedIdx + 1];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // youtube.com/shorts/<id>
    const shortsIdx = parts.indexOf('shorts');
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) {
      const id = parts[shortsIdx + 1];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    return null;
  } catch {
    return null;
  }
};

const normalizeBinary = (s: string) => s.trim().replace(/^0b/i, '');
const normalizeHex = (s: string) => s.trim().replace(/^0x/i, '');

const parseUnsignedBigInt = (value: string, base: 2 | 10 | 16): bigint => {
  const raw = value.trim();
  if (!raw) throw new Error('Value is required');

  if (base === 10) {
    if (!/^\d+$/.test(raw)) throw new Error('Decimal must be digits only');
    return BigInt(raw);
  }

  if (base === 2) {
    const b = normalizeBinary(raw);
    if (!/^[01]+$/.test(b)) throw new Error('Binary must contain only 0 or 1');
    return BigInt(`0b${b}`);
  }

  const h = normalizeHex(raw);
  if (!/^[0-9a-fA-F]+$/.test(h)) throw new Error('Hex must contain only 0-9 and A-F');
  return BigInt(`0x${h}`);
};

const toBin = (n: bigint) => n.toString(2);
const toHex = (n: bigint) => n.toString(16).toUpperCase();

const StudyPlusPage: React.FC = () => {
  const [activeTool, setActiveTool] = useState<StudyPlusToolId>('branch_subjects');

  const tools = useMemo(
    () =>
      [
        {
          id: 'branch_subjects' as const,
          title: 'Branch-wise subjects',
          description: 'Browse subjects by branch and semester',
          icon: <BookOpen className="w-5 h-5 text-primary" />,
        },
        {
          id: 'semester_reference' as const,
          title: 'Semester-wise subjects reference',
          description: 'Compare subjects across branch groups for a semester',
          icon: <BookOpen className="w-5 h-5 text-primary" />,
        },
        {
          id: 'study_timer' as const,
          title: 'Study Timer',
          description: 'Pomodoro timer with breaks',
          icon: <Clock className="w-5 h-5 text-primary" />,
        },
        {
          id: 'focus_youtube' as const,
          title: 'Focus YouTube',
          description: 'Distraction-free video learning',
          icon: <Youtube className="w-5 h-5 text-primary" />,
        },
        {
          id: 'quick_notes' as const,
          title: 'Quick Notes',
          description: 'Jot down key points during study sessions',
          icon: <FileText className="w-5 h-5 text-primary" />,
        },
        {
          id: 'number_converter' as const,
          title: 'Number Converter',
          description: 'Binary, Hex, Decimal converter',
          icon: <Binary className="w-5 h-5 text-primary" />,
        },
        {
          id: 'logic_gate_sim' as const,
          title: 'Logic Gate Simulator',
          description: 'Visualize logic gates',
          icon: <Cpu className="w-5 h-5 text-primary" />,
        },
        {
          id: 'binary_operations' as const,
          title: 'Binary Operations',
          description: 'Operate on binary values',
          icon: <FunctionSquare className="w-5 h-5 text-primary" />,
        },
      ],
    []
  );

  return (
    <Page>
      <div className="mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Study+</h1>
        <p className="text-muted-foreground text-base sm:text-lg mt-2">A quiet toolkit for focused study.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
        <Card className="p-2">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tools</div>
          <div className="space-y-1">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTool(t.id)}
                className={
                  activeTool === t.id
                    ? 'w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left bg-muted/60 text-foreground'
                    : 'w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors'
                }
              >
                <div className="mt-0.5">{t.icon}</div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground/90 truncate">{t.description}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardContent>
            {activeTool === 'branch_subjects' && <BranchWiseSubjects />}
            {activeTool === 'semester_reference' && <SemesterWiseReference />}
            {activeTool === 'study_timer' && <PomodoroTimer />}
            {activeTool === 'focus_youtube' && <FocusYouTube />}
            {activeTool === 'quick_notes' && <QuickNotes />}
            {activeTool === 'number_converter' && <NumberConverter />}
            {activeTool === 'logic_gate_sim' && <LogicGateSimulator />}
            {activeTool === 'binary_operations' && <BinaryOperations />}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
};

const BranchWiseSubjects: React.FC = () => {
  const [branch, setBranch] = useState<BranchKey>('CSE');
  const [semester, setSemester] = useState<(typeof SEMESTERS)[number]>('1');

  const subjects = useMemo(() => getSubjects(branch, semester), [branch, semester]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Branch-wise subjects</h2>
      <p className="text-muted-foreground mb-4">Pick a branch and semester to view subjects.</p>

      <div className="flex flex-wrap gap-2 mb-4 bg-background p-2 rounded-lg border border-border">
        {BRANCHES.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBranch(b)}
            className={
              branch === b
                ? 'px-4 py-2 rounded-lg text-sm font-medium bg-card shadow-sm'
                : 'px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground'
            }
          >
            {branchLabel(b)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
        {SEMESTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSemester(s)}
            className={
              semester === s
                ? 'px-3 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground'
                : 'px-3 py-2 rounded-lg text-sm font-medium bg-background border border-border hover:border-primary/40'
            }
          >
            Sem {s}
          </button>
        ))}
      </div>

      {subjects.length === 0 ? (
        <div className="text-muted-foreground">No subjects found for this selection.</div>
      ) : (
        <ul className="space-y-2">
          {subjects.map((sub) => (
            <li key={sub} className="flex items-start gap-2">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary/70" />
              <span>{sub}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SemesterWiseReference: React.FC = () => {
  const [semester, setSemester] = useState<(typeof SEMESTERS)[number]>('1');

  const groupA = useMemo(() => getSubjects('CSE', semester), [semester]);
  const groupB = useMemo(() => getSubjects('AIML', semester), [semester]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Semester-wise subjects reference</h2>
      <p className="text-muted-foreground mb-4">Select a semester to compare subject lists.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
        {SEMESTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSemester(s)}
            className={
              semester === s
                ? 'px-3 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground'
                : 'px-3 py-2 rounded-lg text-sm font-medium bg-background border border-border hover:border-primary/40'
            }
          >
            Sem {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-background border border-border rounded-xl p-4">
          <div className="font-semibold mb-3">{branchLabel('CSE')}</div>
          {groupA.length === 0 ? (
            <div className="text-muted-foreground">No subjects found.</div>
          ) : (
            <ul className="space-y-2">
              {groupA.map((s) => (
                <li key={s} className="text-sm">{s}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-background border border-border rounded-xl p-4">
          <div className="font-semibold mb-3">{branchLabel('AIML')}</div>
          {groupB.length === 0 ? (
            <div className="text-muted-foreground">No subjects found.</div>
          ) : (
            <ul className="space-y-2">
              {groupB.map((s) => (
                <li key={s} className="text-sm">{s}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const PomodoroTimer: React.FC = () => {
  const FOCUS_SECONDS = 25 * 60;
  const BREAK_SECONDS = 5 * 60;

  const [phase, setPhase] = useState<'focus' | 'break'>('focus');
  const [secondsLeft, setSecondsLeft] = useState<number>(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    if (secondsLeft !== 0) return;

    if (phase === 'focus') {
      setPhase('break');
      setSecondsLeft(BREAK_SECONDS);
    } else {
      setPhase('focus');
      setSecondsLeft(FOCUS_SECONDS);
    }
  }, [secondsLeft, running, phase]);

  const toggle = () => setRunning((r) => !r);

  const reset = () => {
    setRunning(false);
    setPhase('focus');
    setSecondsLeft(FOCUS_SECONDS);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Study Timer</h2>
      <p className="text-muted-foreground mb-6">Pomodoro timer with breaks (25/5).</p>

      <div className="flex flex-col items-center justify-center bg-background border border-border rounded-xl p-6">
        <div className="text-sm text-muted-foreground mb-2">
          {phase === 'focus' ? 'Focus time' : 'Break time'}
        </div>
        <div className="text-5xl font-bold tracking-tight mb-6">{formatMmSs(secondsLeft)}</div>

        <div className="flex gap-3">
          <Button type="button" onClick={toggle} className="px-5">
            {running ? 'Pause' : 'Start'}
          </Button>
          <Button type="button" onClick={reset} variant="secondary" className="px-5">
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
};

const FocusYouTube: React.FC = () => {
  const [input, setInput] = useState('');
  const videoId = useMemo(() => extractYouTubeId(input), [input]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Focus YouTube</h2>
      <p className="text-muted-foreground mb-4">
        Paste a YouTube link or video ID to watch in a distraction-free view.
      </p>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">YouTube URL / Video ID</label>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., https://youtu.be/dQw4w9WgXcQ"
          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {!videoId && input.trim() !== '' && (
          <div className="text-sm text-muted-foreground mt-2">Could not detect a valid video ID.</div>
        )}
      </div>

      {videoId && (
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="aspect-video">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0&iv_load_policy=3&playsinline=1`}
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
};

const QuickNotes: React.FC = () => {
  const storageKey = 'studyPlus.quickNotes';
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setNotes(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, notes);
  }, [notes]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Quick Notes</h2>
      <p className="text-muted-foreground mb-4">Notes are saved on this device.</p>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={10}
        placeholder="Write key points here…"
        className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
};

const NumberConverter: React.FC = () => {
  const [dec, setDec] = useState('');
  const [bin, setBin] = useState('');
  const [hex, setHex] = useState('');
  const [error, setError] = useState<string | null>(null);

  const syncFrom = (field: 'dec' | 'bin' | 'hex', value: string) => {
    try {
      setError(null);
      if (value.trim() === '') {
        setDec('');
        setBin('');
        setHex('');
        return;
      }

      const n =
        field === 'dec'
          ? parseUnsignedBigInt(value, 10)
          : field === 'bin'
            ? parseUnsignedBigInt(value, 2)
            : parseUnsignedBigInt(value, 16);

      setDec(n.toString(10));
      setBin(toBin(n));
      setHex(toHex(n));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid input');
      if (field === 'dec') setDec(value);
      if (field === 'bin') setBin(value);
      if (field === 'hex') setHex(value);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Number Converter</h2>
      <p className="text-muted-foreground mb-4">Convert between decimal, binary, and hex.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Decimal</label>
          <input
            value={dec}
            onChange={(e) => syncFrom('dec', e.target.value)}
            placeholder="e.g., 42"
            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Binary</label>
          <input
            value={bin}
            onChange={(e) => syncFrom('bin', e.target.value)}
            placeholder="e.g., 101010"
            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Hex</label>
          <input
            value={hex}
            onChange={(e) => syncFrom('hex', e.target.value)}
            placeholder="e.g., 2A"
            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {error && <div className="text-sm text-muted-foreground mt-3">{error}</div>}
    </div>
  );
};

const LogicGateSimulator: React.FC = () => {
  const [gate, setGate] = useState<'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'XNOR' | 'NOT'>('AND');
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);

  const out = useMemo(() => {
    const A = a;
    const B = b;
    switch (gate) {
      case 'AND':
        return A && B;
      case 'OR':
        return A || B;
      case 'XOR':
        return (A && !B) || (!A && B);
      case 'NAND':
        return !(A && B);
      case 'NOR':
        return !(A || B);
      case 'XNOR':
        return A === B;
      case 'NOT':
        return !A;
      default:
        return false;
    }
  }, [gate, a, b]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Logic Gate Simulator</h2>
      <p className="text-muted-foreground mb-4">Toggle inputs and see the output.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-background border border-border rounded-xl p-4">
          <label htmlFor="logic-gate" className="block text-sm font-medium mb-2">Gate</label>
          <select
            id="logic-gate"
            value={gate}
            onChange={(e) => setGate(e.target.value as any)}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR', 'NOT'].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setA((v) => !v)}
              className={
                a
                  ? 'px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold'
                  : 'px-4 py-2 rounded-lg bg-muted text-foreground font-semibold'
              }
            >
              A: {a ? '1' : '0'}
            </button>

            {gate !== 'NOT' ? (
              <button
                type="button"
                onClick={() => setB((v) => !v)}
                className={
                  b
                    ? 'px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold'
                    : 'px-4 py-2 rounded-lg bg-muted text-foreground font-semibold'
                }
              >
                B: {b ? '1' : '0'}
              </button>
            ) : (
              <div className="px-4 py-2 rounded-lg bg-muted text-muted-foreground font-medium flex items-center justify-center">
                B: n/a
              </div>
            )}
          </div>
        </div>

        <div className="bg-background border border-border rounded-xl p-4 flex flex-col justify-center items-center">
          <div className="text-sm text-muted-foreground mb-2">Output</div>
          <div className={out ? 'text-5xl font-bold text-primary' : 'text-5xl font-bold'}>
            {out ? '1' : '0'}
          </div>
        </div>
      </div>
    </div>
  );
};

const BinaryOperations: React.FC = () => {
  type Op = 'AND' | 'OR' | 'XOR' | 'NOT' | 'ADD' | 'SUB' | 'SHL' | 'SHR';
  const [op, setOp] = useState<Op>('AND');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [shift, setShift] = useState('1');

  const { output, error } = useMemo(() => {
    try {
      const A = normalizeBinary(a);
      const B = normalizeBinary(b);

      if (op === 'NOT') {
        if (!/^[01]+$/.test(A)) throw new Error('A must be a binary string');
        const flipped = A.split('').map((ch) => (ch === '0' ? '1' : '0')).join('');
        return { output: flipped, error: null as string | null };
      }

      if (op === 'SHL' || op === 'SHR') {
        if (!/^[01]+$/.test(A)) throw new Error('A must be a binary string');
        if (!/^\d+$/.test(shift.trim())) throw new Error('Shift must be a non-negative integer');
        const n = BigInt(`0b${A}`);
        const s = BigInt(shift.trim());
        const r = op === 'SHL' ? (n << s) : (n >> s);
        return { output: toBin(r), error: null as string | null };
      }

      if (!/^[01]+$/.test(A)) throw new Error('A must be a binary string');
      if (!/^[01]+$/.test(B)) throw new Error('B must be a binary string');

      const nA = BigInt(`0b${A}`);
      const nB = BigInt(`0b${B}`);

      if (op === 'AND') return { output: toBin(nA & nB), error: null };
      if (op === 'OR') return { output: toBin(nA | nB), error: null };
      if (op === 'XOR') return { output: toBin(nA ^ nB), error: null };
      if (op === 'ADD') return { output: toBin(nA + nB), error: null };
      if (op === 'SUB') {
        const r = nA - nB;
        if (r < 0n) throw new Error('Result is negative');
        return { output: toBin(r), error: null };
      }

      return { output: '', error: null };
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : 'Invalid input' };
    }
  }, [op, a, b, shift]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Binary Operations</h2>
      <p className="text-muted-foreground mb-4">Perform common operations on binary values.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="binary-op" className="block text-sm font-medium mb-2">Operation</label>
          <select
            id="binary-op"
            value={op}
            onChange={(e) => setOp(e.target.value as any)}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {['AND', 'OR', 'XOR', 'NOT', 'ADD', 'SUB', 'SHL', 'SHR'].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2">A (binary)</label>
              <input
                value={a}
                onChange={(e) => setA(e.target.value)}
                placeholder="e.g., 1010"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {op !== 'NOT' && op !== 'SHL' && op !== 'SHR' && (
              <div>
                <label className="block text-sm font-medium mb-2">B (binary)</label>
                <input
                  value={b}
                  onChange={(e) => setB(e.target.value)}
                  placeholder="e.g., 1100"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {(op === 'SHL' || op === 'SHR') && (
              <div>
                <label className="block text-sm font-medium mb-2">Shift amount</label>
                <input
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  placeholder="e.g., 1"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-background border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground mb-2">Result</div>
          {error ? (
            <div className="text-sm text-muted-foreground">{error}</div>
          ) : (
            <div className="font-mono text-lg break-all">{output || '—'}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudyPlusPage;
