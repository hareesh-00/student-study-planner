import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Activity, ArrowDownUp, ArrowRight, BarChart3, BookOpen, CalendarDays, Check,
  ChevronDown, ChevronLeft, ChevronRight, Clock3, Command, Database, Download,
  Ellipsis, Filter, FlaskConical, Gauge, GraduationCap, LayoutDashboard, ListChecks,
  Menu, Plus, Search, Settings as SettingsIcon, ShieldCheck, Sparkles, Target,
  Trash2, TrendingUp, Trophy, X,
} from 'lucide-react';
import {
  CartesianGrid, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { sampleSessions } from './data/samples.js';
import { checkPlannerAvailability, isPlannerUnavailable, runBothPlanners, runPlanner } from './services/wasmPlanner.js';

const STORAGE_KEY = 'studyplan.sessions.v1';
const MAX_SESSIONS = 10;
const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/sessions/new', label: 'Add study session', icon: Plus },
  { to: '/sessions', label: 'All sessions', icon: CalendarDays },
  { to: '/greedy', label: 'Greedy selection', icon: Target },
  { to: '/weighted', label: 'Weighted scheduling', icon: ListChecks },
  { to: '/comparison', label: 'Compare algorithms', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function readSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.map((session) => {
      const score = Number(session.importance);
      return {
        ...session,
        importance: Number.isFinite(score) ? Math.min(10, Math.max(1, Math.round(score > 10 ? score / 10 : score))) : 1,
        completed: session.completed === true,
      };
    });
  } catch {
    return [];
  }
}

function App() {
  const [sessions, setSessions] = useState(readSessions);
  const [plans, setPlans] = useState({ greedy: null, weighted: null });
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [activity, setActivity] = useState([]);
  const [plannerAvailable, setPlannerAvailable] = useState(null);
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('studyplan.name') || 'Student');
  const location = useLocation();

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)), [sessions]);
  useEffect(() => {
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);
  useEffect(() => {
    let active = true;
    checkPlannerAvailability()
      .then((available) => {
        if (active) setPlannerAvailable(available);
      })
      .catch((error) => {
        if (active) {
          setPlannerAvailable(false);
          setToast({ type: 'error', text: `C / WebAssembly failed to initialize: ${error.message}` });
        }
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function record(message) {
    setActivity((items) => [{ id: `${Date.now()}-${Math.random()}`, message, time: Date.now() }, ...items].slice(0, 5));
  }

  function saveSession(values, id) {
    if (!id && sessions.length >= MAX_SESSIONS) {
      setToast({ type: 'error', text: 'You have reached the maximum limit of 10 study sessions.' });
      return false;
    }
    if (id) {
      setSessions((items) => items.map((item) => item.id === id ? { ...item, ...values } : item));
      record(`Updated ${values.subject}`);
      setToast({ type: 'success', text: 'Study session updated.' });
    } else {
      const session = { ...values, id: crypto.randomUUID(), createdAt: new Date().toISOString(), completed: false };
      setSessions((items) => [...items, session]);
      record(`Added ${values.subject}`);
      setToast({ type: 'success', text: 'Study session added to your plan.' });
    }
    setPlans({ greedy: null, weighted: null });
    return true;
  }

  function deleteSession(session) {
    if (!window.confirm(`Delete the ${session.subject} study session?`)) return;
    setSessions((items) => items.filter((item) => item.id !== session.id));
    record(`Removed ${session.subject}`);
    setToast({ type: 'success', text: `${session.subject} removed.` });
    setPlans({ greedy: null, weighted: null });
  }

  function toggleCompleted(session) {
    const completed = !session.completed;
    setSessions((items) => items.map((item) => item.id === session.id ? { ...item, completed } : item));
    record(`${completed ? 'Completed' : 'Reopened'} ${session.subject}`);
  }

  function clearSessions() {
    setSessions([]);
    setPlans({ greedy: null, weighted: null });
    localStorage.setItem(STORAGE_KEY, '[]');
    record('Cleared all study sessions');
    setToast({ type: 'success', text: 'All study sessions deleted successfully!' });
  }

  async function generate(strategy) {
    if (!sessions.length) {
      setToast({ type: 'error', text: 'Add or load study sessions before generating a schedule.' });
      return;
    }
    if (sessions.length > MAX_SESSIONS) {
      setToast({ type: 'error', text: 'The algorithms support up to 10 input study sessions. Delete extra sessions before generating a schedule.' });
      return;
    }
    try {
      const result = await runPlanner(sessions, strategy);
      setPlans((current) => ({ ...current, [strategy]: result }));
      setPlannerAvailable(true);
      setToast({ type: 'success', text: `${strategy === 'greedy' ? 'Greedy' : 'Weighted'} schedule generated by C / WebAssembly.` });
      return result;
    } catch (error) {
      if (isPlannerUnavailable(error)) setPlannerAvailable(false);
      setToast({ type: 'error', text: error.message });
      return null;
    }
  }

  async function generateBoth() {
    if (!sessions.length) {
      setToast({ type: 'error', text: 'Add or load study sessions before generating a schedule.' });
      return;
    }
    if (sessions.length > MAX_SESSIONS) {
      setToast({ type: 'error', text: 'The algorithms support up to 10 input study sessions. Delete extra sessions before generating a schedule.' });
      return;
    }
    try {
      const results = await runBothPlanners(sessions);
      setPlans(results);
      setPlannerAvailable(true);
      setToast({ type: 'success', text: 'Both schedules generated by C / WebAssembly.' });
    } catch (error) {
      if (isPlannerUnavailable(error)) setPlannerAvailable(false);
      setToast({ type: 'error', text: error.message });
    }
  }

  function loadSamples() {
    const now = new Date().toISOString();
    setSessions(sampleSessions.slice(0, MAX_SESSIONS).map((session, index) => ({ ...session, id: `sample-${index + 1}`, createdAt: now, completed: false })));
    setPlans({ greedy: null, weighted: null });
    record('Reset to the five demonstration sessions');
    setToast({ type: 'success', text: 'Sample data reset. Generate a schedule to run the C algorithms.' });
  }

  const shared = { sessions, plans, activity, toast, setToast, saveSession, deleteSession, toggleCompleted, clearSessions, generate, generateBoth, loadSamples, displayName, setDisplayName, plannerAvailable };
  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} collapsed={collapsed} displayName={displayName} sessions={sessions} onClose={() => setSidebarOpen(false)} onCollapse={() => setCollapsed((value) => !value)} />
      {sidebarOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <main className={`main-area ${collapsed ? 'is-collapsed' : ''}`}>
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{navItems.find((item) => item.to === location.pathname)?.label || 'Study planner'}</strong></div>
          <div className="topbar-right"><span className="today-label"><span className="live-dot" /> Your study space</span><div className="avatar" title={displayName}>{initials(displayName)}</div></div>
        </header>
        <div className="page-wrap">
          <Routes>
            <Route path="/" element={<Dashboard {...shared} />} />
            <Route path="/sessions/new" element={<SessionForm {...shared} />} />
            <Route path="/sessions/edit/:id" element={<SessionForm {...shared} />} />
            <Route path="/sessions" element={<SessionsPage {...shared} />} />
            <Route path="/greedy" element={<AlgorithmPage {...shared} strategy="greedy" />} />
            <Route path="/weighted" element={<AlgorithmPage {...shared} strategy="weighted" />} />
            <Route path="/comparison" element={<ComparisonPage {...shared} />} />
            <Route path="/settings" element={<SettingsPage {...shared} />} />
            <Route path="*" element={<Dashboard {...shared} />} />
          </Routes>
        </div>
      </main>
      {toast && <div className={`toast ${toast.type}`} role="status"><span className="toast-mark">{toast.type === 'success' ? <Check size={16} /> : <X size={16} />}</span>{toast.text}<button className="toast-close" aria-label="Dismiss" onClick={() => setToast(null)}><X size={15} /></button></div>}
    </div>
  );
}

function Sidebar({ open, collapsed, displayName, sessions, onClose, onCollapse }) {
  const atLimit = sessions.length >= MAX_SESSIONS;
  return (
    <aside className={`sidebar ${open ? 'mobile-open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand-row"><div className="brand-mark"><Command size={19} strokeWidth={2.2} /></div>{!collapsed && <div className="brand-name">study<span>plan</span><small>STUDENT WORKSPACE</small></div>}<button className="icon-button collapse-button" onClick={onCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label="Toggle sidebar">{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button><button className="icon-button mobile-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="workspace-switch"><div className="workspace-icon"><GraduationCap size={17} /></div>{!collapsed && <><span>Study workspace</span><ChevronDown size={14} className="muted-icon" /></>}</div>
      <p className="nav-caption">MENU</p>
      <nav className="side-nav">{navItems.map(({ to, label, icon: Icon, end }) => label === 'Add study session' && atLimit ? <span key={to} title="Delete a session to make room" aria-disabled="true" className={`nav-link is-disabled ${collapsed ? 'collapsed-link' : ''}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></span> : <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Add study session' && !collapsed && <span className="nav-plus">+</span>}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="focus-note"><div className="focus-icon"><Sparkles size={16} /></div>{!collapsed && <div><strong>Small steps add up.</strong><span>Keep your focus streak going.</span></div>}</div><div className="profile-row"><div className="profile-avatar">{initials(displayName)}</div>{!collapsed && <div className="profile-copy"><strong>{displayName}</strong><span>Free workspace</span></div>}{!collapsed && <Ellipsis size={18} className="muted-icon" />}</div></div>
    </aside>
  );
}

function PageTitle({ eyebrow, title, subtitle, action }) {
  return <div className="page-title-row"><div><div className="eyebrow"><span />{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

function Dashboard({ sessions, plans, activity, generate, loadSamples }) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const refreshTime = () => setCurrentTime(new Date());
    const timer = window.setInterval(refreshTime, 60_000);
    window.addEventListener('focus', refreshTime);
    document.addEventListener('visibilitychange', refreshTime);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshTime);
      document.removeEventListener('visibilitychange', refreshTime);
    };
  }, []);
  const hours = sessions.reduce((sum, item) => sum + duration(item), 0);
  const completedHours = sessions.filter((item) => item.completed).reduce((sum, item) => sum + duration(item), 0);
  const progress = hours ? Math.round((completedHours / hours) * 100) : 0;
  const average = sessions.length ? Math.round(sessions.reduce((sum, item) => sum + Number(item.importance), 0) / sessions.length) : 0;
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const upcoming = [...sessions]
    .filter((item) => !item.completed && toMinutes(item.start) >= currentMinutes)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 4);
  const week = useMemo(() => weeklyHours(sessions), [sessions]);
  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(currentTime);
  const hour = currentTime.getHours();
  const greeting = hour < 5 || hour >= 21
    ? 'Good Night, Student!'
    : hour < 12
      ? 'Good Morning, Student!'
      : hour < 17
        ? 'Good Afternoon, Student!'
        : 'Good Evening, Student!';
  return <>
    <PageTitle eyebrow={today} title={greeting} subtitle="Plan smarter. Study better. Achieve more." action={<button className="button button-secondary" onClick={loadSamples}><Database size={16} /> Load sample data</button>} />
    <section className="stat-grid">
      <Stat icon={BookOpen} label="Total study sessions" value={`${sessions.length}/${MAX_SESSIONS}`} detail="Your planning capacity" color="indigo" />
      <Stat icon={Clock3} label="Study hours" value={`${hours.toFixed(1)}h`} detail="Total planned time" color="blue" />
      <Stat icon={Gauge} label="Average importance" value={`${average}`} detail="Out of 10 points" color="orange" />
      <Stat icon={ShieldCheck} label="Scheduled sessions" value={(plans.greedy?.count ?? 0) + (plans.weighted?.count ?? 0) > 0 ? Math.max(plans.greedy?.count ?? 0, plans.weighted?.count ?? 0) : '—'} detail="Best generated plan" color="green" />
    </section>
    <div className="dashboard-grid">
      <section className="panel upcoming-panel">
        <div className="panel-heading"><div><h2>Daily study progress</h2><p>Completed study hours today</p></div><span className="progress-percent">{progress}%</span></div>
        <div className="daily-progress" role="progressbar" aria-label="Daily study progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
        <div className="daily-progress-summary"><strong>{completedHours.toFixed(1)}h</strong><span>completed</span><i>/</i><strong>{hours.toFixed(1)}h</strong><span>planned</span></div>
        <div className="panel-heading upcoming-heading"><div><h2>Upcoming sessions</h2><p>Remaining study blocks for today</p></div><Link to="/sessions" className="text-link">View all <ArrowRight size={15} /></Link></div>
        {upcoming.length ? <div className="upcoming-list">{upcoming.map((session) => <div className="upcoming-row" key={session.id}><div className="subject-icon" style={{ '--subject-hue': subjectHue(session.subject) }}><BookOpen size={17} /></div><div className="upcoming-copy"><strong>{session.subject}</strong><span>{session.start} – {session.end}</span></div><span className="importance-pill">{session.importance}<small> pts</small></span></div>)}</div> : <EmptyState icon={CalendarDays} title={sessions.length ? 'No upcoming sessions' : 'Your schedule starts here'} text={sessions.length ? 'All sessions today have already started or been completed.' : 'Add a study session or load the sample plan.'} />}
      </section>
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Weekly study overview</h2><p>Hours added by day</p></div><span className="chart-badge"><TrendingUp size={14} /> This week</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={week} margin={{ top: 8, right: 3, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#eef0f4" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9299a8', fontSize: 11 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9299a8', fontSize: 11 }} /><Tooltip cursor={{ fill: '#f5f6fa' }} contentStyle={{ border: '1px solid #e8eaf0', borderRadius: 10, boxShadow: '0 8px 26px #252a3814' }} formatter={(value) => [`${value} hrs`, 'Planned time']} /><Bar dataKey="hours" fill="#6c4cf1" radius={[7, 7, 0, 0]} maxBarSize={31} /></BarChart></ResponsiveContainer></div></section>
      <section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Make your next move</p></div><Sparkles size={17} className="heading-sparkle" /></div><div className="quick-actions">{sessions.length < MAX_SESSIONS ? <Link to="/sessions/new" className="quick-action primary"><span className="quick-icon"><Plus size={18} /></span><span><strong>Add a session</strong><small>Make room for focused work</small></span><ArrowRight size={16} /></Link> : <div className="quick-action is-disabled" aria-disabled="true"><span className="quick-icon"><Plus size={18} /></span><span><strong>Session limit reached</strong><small>Delete a session to make room</small></span></div>}<button className="quick-action" onClick={() => generate('greedy')}><span className="quick-icon green"><Target size={17} /></span><span><strong>Generate greedy plan</strong><small>Fit the most sessions</small></span><ArrowRight size={16} /></button><button className="quick-action" onClick={() => generate('weighted')}><span className="quick-icon blue"><Trophy size={17} /></span><span><strong>Optimize importance</strong><small>Prioritize what matters</small></span><ArrowRight size={16} /></button></div></section>
      <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Changes to your plan</p></div><Activity size={17} className="muted-icon" /></div>{activity.length ? <div className="activity-list">{activity.slice(0, 4).map((item) => <div className="activity-item" key={item.id}><span className="activity-dot" /><span>{item.message}</span><time>{relativeTime(item.time)}</time></div>)}</div> : <div className="activity-empty"><span className="activity-dot" />Your latest changes will show up here.</div>}</section>
    </div>
    <footer className="page-footer"><span><span className="footer-pulse" />Your plan is saved automatically</span><span>DAA · Activity selection & interval scheduling</span></footer>
  </>;
}

function Stat({ icon: Icon, label, value, detail, color }) {
  return <div className="stat-card"><div className={`stat-icon ${color}`}><Icon size={19} strokeWidth={1.8} /></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div><span className={`stat-trace ${color}`} /></div>;
}

function SessionForm({ sessions, saveSession }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const initial = sessions.find((session) => session.id === id);
  const [subject, setSubject] = useState(initial?.subject || '');
  const [start, setStart] = useState(initial?.start || '09:00');
  const [end, setEnd] = useState(initial?.end || '10:00');
  const [importance, setImportance] = useState(initial?.importance ?? 5);
  const [error, setError] = useState('');
  const atLimit = !initial && sessions.length >= MAX_SESSIONS;
  function submit(event) {
    event.preventDefault();
    if (atLimit) return setError('You have reached the maximum limit of 10 study sessions.');
    if (!subject.trim()) return setError('Enter a subject or topic name.');
    if (!validTime(start) || !validTime(end)) return setError('Choose valid 24-hour times.');
    if (toMinutes(end) <= toMinutes(start)) return setError('End time must be after start time.');
    if (!Number.isInteger(Number(importance)) || importance < 1 || importance > 10) return setError('Importance must be between 1 and 10.');
    if (saveSession({ subject: subject.trim(), start, end, importance: Number(importance) }, id) === false) return;
    navigate('/sessions');
  }
  const importanceLevel = priorityLevel(Number(importance));
  return <>
    <PageTitle eyebrow="YOUR PLANNER / SESSIONS" title={initial ? 'Edit session' : 'Add a study session'} subtitle="Give your next study block a clear place in the plan." />
    <div className="form-layout"><form className="panel session-form" onSubmit={submit} noValidate><div className="form-header"><div className="form-icon"><CalendarDays size={20} /></div><div><h2>Session details</h2><p>Build a focused block for your day.</p></div></div>
      <div className="session-capacity"><span>Sessions used</span><strong>{sessions.length}/{MAX_SESSIONS}</strong></div>
      {atLimit && <div className="limit-message" role="status">You have reached the maximum limit of 10 study sessions.</div>}
      <label className="field-label" htmlFor="subject">Subject name</label><div className="input-with-icon"><BookOpen size={19} /><input id="subject" className="text-input" value={subject} onChange={(event) => { setSubject(event.target.value); setError(''); }} placeholder="e.g. Data Structures" maxLength={48} autoFocus disabled={atLimit} /></div>
      <div className="form-two"><div><label className="field-label" htmlFor="start">Start time</label><div className="input-with-icon"><Clock3 size={19} /><input id="start" className="text-input time-input" type="time" value={start} onChange={(event) => setStart(event.target.value)} required /></div></div><div><label className="field-label" htmlFor="end">End time</label><div className="input-with-icon"><Clock3 size={19} /><input id="end" className="text-input time-input" type="time" value={end} onChange={(event) => setEnd(event.target.value)} required /></div></div></div>
      <div className="importance-heading"><label className="field-label" htmlFor="importance">Importance score</label><span className={`priority-badge ${importanceLevel.className}`}><span />{importanceLevel.label}</span><strong className="score-number">{importance}<small> / 10</small></strong></div><input id="importance" className="range-input" type="range" min="1" max="10" step="1" value={importance} onChange={(event) => setImportance(Number(event.target.value))} style={{ '--range-value': `${((importance - 1) / 9) * 100}%` }} /><div className="range-labels"><span>1 · Low</span><span>10 · Critical</span></div>
      {error && <div className="inline-error" role="alert"><X size={15} />{error}</div>}<div className="form-actions"><button type="button" className="button button-secondary" onClick={() => navigate('/sessions')}>Cancel</button><button className="button button-primary" type="submit" disabled={atLimit}>{initial ? 'Save changes' : 'Add session'}<ArrowRight size={16} /></button></div>
    </form><aside className="form-aside"><span className="aside-orbit"><Clock3 size={22} /></span><p className="eyebrow">A GOOD BLOCK HAS A START</p><h3>Protect time for the work that matters.</h3><p>Your sessions become intervals for the Greedy and Weighted DAA algorithms. They will be passed to the original C implementation when its WebAssembly module is built.</p><div className="aside-rule" /><div className="aside-stat"><strong>10</strong><span>maximum importance score</span></div></aside></div>
  </>;
}

function SessionsPage({ sessions, deleteSession, toggleCompleted, clearSessions, loadSamples }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('start');
  const [filter, setFilter] = useState('all');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  useEffect(() => {
    function handleShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector('input[aria-label="Search by subject"]')?.focus();
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);
  useEffect(() => {
    if (!confirmDeleteAll) return undefined;
    function handleEscape(event) {
      if (event.key === 'Escape') setConfirmDeleteAll(false);
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [confirmDeleteAll]);
  const visible = useMemo(() => sessions.filter((session) => {
    const level = priorityLevel(Number(session.importance)).className;
    return session.subject.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || filter === level);
  }).sort((a, b) => sort === 'importance' ? b.importance - a.importance : a.start.localeCompare(b.start)), [sessions, query, sort, filter]);
  const atLimit = sessions.length >= MAX_SESSIONS;
  return <>
    <PageTitle eyebrow="YOUR PLANNER / LIBRARY" title="All study sessions" subtitle={`${sessions.length}/${MAX_SESSIONS} sessions in your plan.`} action={<div className="page-title-actions">
      <button className="button button-danger delete-all-button" onClick={() => setConfirmDeleteAll(true)} disabled={!sessions.length}><Trash2 size={16} /> Delete All Sessions</button>
      {atLimit ? <button className="button button-primary" disabled title="Delete a session to make room"><Plus size={16} /> Add Session</button> : <Link to="/sessions/new" className="button button-primary"><Plus size={16} /> Add Session</Link>}
    </div>} />
    {confirmDeleteAll && createPortal(<div className="delete-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmDeleteAll(false); }}>
      <section className="delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-all-title" aria-describedby="delete-all-message">
        <div className="delete-modal-icon"><Trash2 size={24} /></div>
        <h2 id="delete-all-title">Delete All Sessions?</h2>
        <p id="delete-all-message">Are you sure you want to delete all your study sessions? This action cannot be undone.</p>
        <div className="delete-modal-actions">
          <button className="button button-secondary" onClick={() => setConfirmDeleteAll(false)} autoFocus>Cancel</button>
          <button className="button button-danger" onClick={() => { clearSessions(); setConfirmDeleteAll(false); }}>Yes, Delete All</button>
        </div>
      </section>
    </div>, document.body)}
    <section className="panel table-panel">
      <div className="table-toolbar">
        <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects..." aria-label="Search by subject" /><kbd>⌘ K</kbd></label>
        <div className="toolbar-controls">
          <label className="select-control"><Filter size={15} /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by importance"><option value="all">All priorities</option><option value="low">Low (1–3)</option><option value="medium">Medium (4–6)</option><option value="high">High (7–8)</option><option value="critical">Critical (9–10)</option></select><ChevronDown size={13} /></label>
          <label className="select-control"><ArrowDownUp size={15} /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort sessions"><option value="start">Start time</option><option value="importance">Importance</option></select><ChevronDown size={13} /></label>
        </div>
      </div>
      {visible.length ? <div className="table-scroll"><table><thead><tr><th>ID</th><th>SUBJECT</th><th>TIME</th><th>DURATION</th><th>IMPORTANCE</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((session, index) => {
        const level = priorityLevel(Number(session.importance));
        return <tr key={session.id}>
          <td className="id-cell">{String(index + 1).padStart(2, '0')}</td>
          <td><span className="table-subject"><i style={{ '--subject-hue': subjectHue(session.subject) }} />{session.subject}</span></td>
          <td className="time-cell">{session.start} <span>to</span> {session.end}</td>
          <td>{duration(session).toFixed(1)}h</td>
          <td><span className={`priority-badge ${level.className}`}><span />{session.importance} · {level.label}</span></td>
          <td><button className={`completion-toggle ${session.completed ? 'is-complete' : ''}`} onClick={() => toggleCompleted(session)} aria-pressed={session.completed}><Check size={14} />{session.completed ? 'Completed' : 'Mark complete'}</button></td>
          <td><div className="row-actions"><Link to={`/sessions/edit/${session.id}`} className="icon-button" aria-label={`Edit ${session.subject}`} title="Edit"><ArrowRight size={15} /></Link><button className="icon-button delete-action" onClick={() => deleteSession(session)} aria-label={`Delete ${session.subject}`} title="Delete"><Trash2 size={15} /></button></div></td>
        </tr>;
      })}</tbody></table></div> : sessions.length ? <EmptyState icon={Search} title="No matching sessions" text="Try a different search or filter." /> : <EmptyState icon={CalendarDays} title="Your planner is clear" text="Add a session or load the sample data to see the schedule table." action={<>{!atLimit && <Link to="/sessions/new" className="button button-primary"><Plus size={15} /> Add first session</Link>}<button className="button button-secondary" onClick={loadSamples}>Load sample data</button></>} />}
      <div className="table-bottom"><span>Showing <strong>{visible.length}</strong> of <strong>{sessions.length}</strong> sessions · Capacity <strong>{sessions.length}/{MAX_SESSIONS}</strong>{atLimit && <span className="limit-inline">You have reached the maximum limit of 10 study sessions.</span>}</span><span><span className="table-dot" /> Synced to this device</span></div>
    </section>
  </>;
}

function AlgorithmPage({ sessions, plans, generate, strategy, plannerAvailable }) {
  const weighted = strategy === 'weighted';
  const key = weighted ? 'weighted' : 'greedy';
  const plan = plans[key];
  const selectedIds = new Set((plan?.selected || []).map((session) => session.id));
  return <>
    <PageTitle eyebrow={`ALGORITHM LAB / ${weighted ? 'DYNAMIC PROGRAMMING' : 'GREEDY METHOD'}`} title={weighted ? 'Weighted interval scheduling' : 'Greedy activity selection'} subtitle={weighted ? 'Maximize your total study importance score.' : 'Maximize the number of compatible study sessions.'} action={<button className="button button-primary" onClick={() => generate(key)} disabled={!sessions.length || sessions.length > MAX_SESSIONS}><Sparkles size={16} />{weighted ? 'Generate optimal schedule' : 'Generate schedule'}</button>} />
    <div className="algorithm-metrics"><div className="metric-card"><span className="metric-icon green"><ListChecks size={17} /></span><div><small>Selected sessions</small><strong>{plan ? plan.count : '—'}</strong></div></div><div className="metric-card"><span className="metric-icon indigo"><Trophy size={17} /></span><div><small>{weighted ? 'Maximum importance' : 'Total importance'}</small><strong>{plan ? plan.importance : '—'}<em> pts</em></strong></div></div><div className="engine-status"><span className={plannerAvailable === true || plan ? 'engine-ready' : 'engine-waiting'} />{plan?.engine || (plannerAvailable === null ? 'Checking C / WebAssembly…' : plannerAvailable ? 'C / WebAssembly ready' : 'Temporary fallback — C / WebAssembly unavailable')}</div></div>
    <div className="algorithm-grid"><section className="panel selected-panel"><div className="panel-heading"><div><h2>{weighted ? 'Optimal study plan' : 'Selected activities'}</h2><p>{plan ? 'In chronological order' : 'Run the algorithm to see selected sessions'}</p></div><span className={`objective-tag ${weighted ? 'blue' : 'green'}`}>{weighted ? 'MAX SCORE' : 'MAX COUNT'}</span></div>{plan?.selected.length ? <div className="selected-list">{plan.selected.map((session, index) => <div className="selected-row" key={session.id}><span className="order-index">{String(index + 1).padStart(2, '0')}</span><span className="selected-name"><strong>{session.subject}</strong><small>{session.start} – {session.end}</small></span><span className="selected-score">{session.importance}<small> pts</small></span><Check size={16} className="selected-check" /></div>)}</div> : <EmptyState icon={weighted ? Trophy : Target} title={sessions.length ? 'Ready when you are' : 'No sessions to schedule'} text={sessions.length ? 'Generate a schedule to call the original C implementation.' : 'Add sessions or load the demo set first.'} action={sessions.length ? null : <Link to="/sessions/new" className="button button-secondary">Add a session</Link>} />}</section>
      <TimelinePanel sessions={sessions} selectedIds={selectedIds} title="Schedule timeline" />
      <section className="panel explanation-panel"><div className="panel-heading"><div><h2>{weighted ? 'Dynamic programming' : 'The greedy strategy'}</h2><p>{weighted ? 'Build the best score one interval at a time.' : 'Choose the next finish time, then keep moving.'}</p></div><FlaskConical size={18} className="heading-sparkle" /></div>{weighted ? <><div className="formula">DP[i] = max(weight[i] + DP[p(i)], DP[i - 1])</div><div className="definition-list"><div><code>weight[i]</code><span>Importance of the current session.</span></div><div><code>p(i)</code><span>Last compatible session before i.</span></div><div><code>DP[i]</code><span>Maximum importance achievable.</span></div></div><p className="explanation-note">Sessions are sorted by finish time. Binary search finds each compatible predecessor, then the DP table is backtracked to recover the optimal set.</p></> : <><ol className="algorithm-steps"><li><span>01</span>Sort sessions by finishing time.</li><li><span>02</span>Select the earliest finishing session.</li><li><span>03</span>Take the next session that starts after it ends.</li><li><span>04</span>Continue until every session is checked.</li></ol><p className="explanation-note">This greedy choice maximizes the count of compatible activities. Importance scores do not affect selection.</p></>}</section>
    </div>
  </>;
}

function ComparisonPage({ sessions, plans, generateBoth, plannerAvailable }) {
  const greedy = plans.greedy;
  const weighted = plans.weighted;
  const chartScores = [{ name: 'Greedy', score: greedy?.importance || 0 }, { name: 'Weighted DP', score: weighted?.importance || 0 }];
  const chartCounts = [{ name: 'Greedy', count: greedy?.count || 0 }, { name: 'Weighted DP', count: weighted?.count || 0 }];
  const sameSchedule = greedy && weighted && greedy.selected.length === weighted.selected.length &&
    greedy.selected.every((item, index) => item.id === weighted.selected[index].id);
  const comparisonNote = greedy && weighted
    ? sameSchedule
      ? 'For this input, both objectives produce the same schedule.'
      : `For this input, greedy selects ${greedy.count} compatible sessions for ${greedy.importance} points, while weighted DP selects ${weighted.count} sessions for ${weighted.importance} points.`
    : 'Greedy maximizes the number of compatible sessions without considering importance. Weighted interval scheduling uses the DP recurrence to maximize the sum of importance scores, so it may prefer fewer, higher-value sessions.';
  return <>
    <PageTitle eyebrow="ALGORITHM LAB / ANALYSIS" title="Algorithm comparison" subtitle="Two objectives. One set of study intervals." action={<button className="button button-primary" onClick={generateBoth} disabled={!sessions.length || sessions.length > MAX_SESSIONS}><Activity size={16} /> Run both algorithms</button>} />
    <div className="compare-cards"><CompareCard plan={greedy} title="Greedy activity selection" subtitle="Maximize the number of sessions" kind="greedy" /><CompareCard plan={weighted} title="Weighted interval scheduling" subtitle="Maximize importance score" kind="weighted" /></div>
    <section className="panel insight-strip"><div className="insight-mark"><Sparkles size={18} /></div><p>{comparisonNote}</p><span>THE TRADE-OFF</span></section>
    <div className="comparison-charts"><ChartPanel title="Importance score" subtitle="Total points in each selected schedule" data={chartScores} dataKey="score" color="#6c4cf1" /><ChartPanel title="Selected sessions" subtitle="Number of compatible activities" data={chartCounts} dataKey="count" color="#22c55e" /></div>
    <section className="panel side-by-side"><div className="panel-heading"><div><h2>Schedule comparison</h2><p>Selected activities at a glance</p></div><span className="engine-status inline"><span className={greedy && weighted ? 'engine-ready' : 'engine-waiting'} />{greedy && weighted ? 'C / WebAssembly' : plannerAvailable === false ? 'Temporary fallback — no algorithm execution' : 'Run both algorithms to compare'}</span></div><div className="schedule-columns"><ScheduleColumn title="Greedy" plan={greedy} color="green" /><ScheduleColumn title="Weighted DP" plan={weighted} color="indigo" /></div><div className="compare-timelines"><Timeline sessions={sessions} selectedIds={new Set((greedy?.selected || []).map((item) => item.id))} label="Greedy" /><Timeline sessions={sessions} selectedIds={new Set((weighted?.selected || []).map((item) => item.id))} label="Weighted" /></div></section>
  </>;
}

function CompareCard({ plan, title, subtitle, kind }) {
  return <div className={`compare-card ${kind}`}><div className="compare-card-top"><div className="compare-symbol">{kind === 'greedy' ? <Target size={20} /> : <Trophy size={20} />}</div><span className={`compare-label ${kind}`}>{kind === 'greedy' ? 'GREEDY' : 'DYNAMIC PROGRAMMING'}</span></div><h2>{title}</h2><p>{subtitle}</p><div className="compare-numbers"><div><strong>{plan?.count ?? '—'}</strong><span>SELECTED SESSIONS</span></div><i /><div><strong>{plan?.importance ?? '—'}</strong><span>TOTAL IMPORTANCE</span></div></div><div className="compare-samples">{plan?.selected.length ? plan.selected.map((item) => <span key={item.id}>{item.subject}</span>) : <span className="not-run">Awaiting C / WebAssembly result</span>}</div></div>;
}

function ChartPanel({ title, subtitle, data, dataKey, color }) {
  return <section className="panel compare-chart"><div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="compare-chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="#eef0f4" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#81889a', fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#9299a8', fontSize: 11 }} /><Tooltip cursor={{ fill: '#f5f6fa' }} contentStyle={{ border: '1px solid #e8eaf0', borderRadius: 9 }} /><Bar dataKey={dataKey} fill={color} radius={[5, 5, 0, 0]} maxBarSize={54} /></BarChart></ResponsiveContainer></div></section>;
}

function ScheduleColumn({ title, plan, color }) {
  return <div className={`schedule-column ${color}`}><div className="schedule-column-head"><span className={`column-dot ${color}`} />{title}<span>{plan?.count ?? '—'} selected · {plan?.importance ?? '—'} pts</span></div>{plan?.selected.length ? plan.selected.map((item) => <div className="schedule-chip" key={item.id}><span>{item.subject}</span><small>{item.start}–{item.end}</small></div>) : <div className="schedule-pending">No result yet</div>}</div>;
}

function TimelinePanel({ sessions, selectedIds, title }) {
  return <section className="panel timeline-panel"><div className="panel-heading"><div><h2>{title}</h2><p>Overlaps and selected intervals</p></div><span className="timeline-legend"><i className="legend-selected" />Selected <i className="legend-other" />Other <i className="legend-conflict" />Overlap</span></div><Timeline sessions={sessions} selectedIds={selectedIds} /></section>;
}

function Timeline({ sessions, selectedIds = new Set(), label }) {
  if (!sessions.length) return <div className="timeline-empty">Add study sessions to populate this timeline.</div>;
  const starts = sessions.map((item) => toMinutes(item.start));
  const ends = sessions.map((item) => toMinutes(item.end));
  const min = Math.max(0, Math.floor(Math.min(...starts) / 60) * 60 - 60);
  const max = Math.min(24 * 60, Math.ceil(Math.max(...ends) / 60) * 60 + 60);
  const span = Math.max(max - min, 60);
  const marks = Array.from({ length: Math.floor(span / 60) + 1 }, (_, index) => min + index * 60);
  const lanes = [];
  const arranged = [...sessions].sort((a, b) => a.start.localeCompare(b.start)).map((item) => {
    let lane = lanes.findIndex((end) => end <= toMinutes(item.start));
    if (lane < 0) lane = lanes.length;
    lanes[lane] = toMinutes(item.end);
    return { ...item, lane };
  });
  const conflicts = new Set();
  sessions.forEach((session, index) => {
    sessions.slice(index + 1).forEach((other) => {
      if (toMinutes(session.start) < toMinutes(other.end) && toMinutes(other.start) < toMinutes(session.end)) {
        conflicts.add(session.id);
        conflicts.add(other.id);
      }
    });
  });
  return (
    <div className="timeline-scroll">
      <div className="timeline-inner">
        <div className="timeline-hours">
          <span className="lane-label">{label || 'TIME'}</span>
          <div className="hour-scale">{marks.map((mark) => <span key={mark} style={{ left: `${((mark - min) / span) * 100}%` }}>{formatTime(mark)}</span>)}</div>
        </div>
        <div className="timeline-track" style={{ minHeight: `${Math.max(lanes.length, 1) * 56 + 12}px` }}>
          <div className="track-grid">{marks.map((mark) => <i key={mark} style={{ left: `${((mark - min) / span) * 100}%` }} />)}</div>
          {arranged.map((session) => {
            const left = ((toMinutes(session.start) - min) / span) * 100;
            const width = ((toMinutes(session.end) - toMinutes(session.start)) / span) * 100;
            const picked = selectedIds.has(session.id);
            const conflict = conflicts.has(session.id);
            return <div className={`timeline-block ${picked ? 'picked' : ''} ${conflict ? 'conflict' : ''} ${!picked && !conflict ? 'other' : ''}`} key={session.id} title={`${session.subject}: ${session.start}–${session.end}${picked ? ' · Selected' : conflict ? ' · Overlaps another session' : ' · Not selected'}`} style={{ left: `${left}%`, width: `${Math.max(width, 3)}%`, top: `${session.lane * 56 + 6}px`, '--subject-hue': subjectHue(session.subject) }}><strong>{session.subject}</strong><span>{session.start}–{session.end}</span></div>;
          })}
        </div>
        <div className="timeline-details">{arranged.map((session) => {
          const picked = selectedIds.has(session.id);
          const conflict = conflicts.has(session.id);
          const state = picked ? 'Selected' : conflict ? 'Overlapping' : 'Not selected';
          return <div className={`timeline-detail ${picked ? 'picked' : ''} ${conflict ? 'conflict' : ''}`} key={session.id}><i /><strong>{session.subject}</strong><time>{session.start} – {session.end}</time><span>{state}</span></div>;
        })}</div>
      </div>
    </div>
  );
}

function SettingsPage({ sessions, loadSamples, clearSessions, setToast, displayName, setDisplayName, plannerAvailable }) {
  const [confirmClear, setConfirmClear] = useState(false);
  function saveName() { localStorage.setItem('studyplan.name', displayName.trim() || 'Student'); setToast({ type: 'success', text: 'Profile name saved.' }); }
  function exportData() { const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'studyplan-sessions.json'; anchor.click(); URL.revokeObjectURL(url); }
  return <>
    <PageTitle eyebrow="WORKSPACE / PREFERENCES" title="Settings" subtitle="Manage your profile and planner data." />
    <div className="settings-layout">
      <section className="panel settings-panel">
        <div className="settings-section">
          <div className="settings-heading"><div className="settings-icon"><GraduationCap size={18} /></div><div><h2>Profile</h2><p>How you appear in this workspace.</p></div></div>
          <label className="field-label" htmlFor="display-name">Display name</label>
          <div className="settings-input-row"><input id="display-name" className="text-input" value={displayName} maxLength={32} onChange={(event) => setDisplayName(event.target.value)} /><button className="button button-secondary" onClick={saveName}>Save</button></div>
        </div>
        <div className="settings-section">
          <div className="settings-heading"><div className="settings-icon blue"><Database size={18} /></div><div><h2>Your data</h2><p>Sessions are stored locally in this browser.</p></div></div>
          <div className="settings-data-row"><div><strong>{sessions.length}/{MAX_SESSIONS} sessions</strong><span>Saved on this device</span></div><button className="button button-secondary" onClick={exportData}><Download size={15} /> Export JSON</button></div>
          <div className="settings-data-row"><div><strong>Reset sample data</strong><span>Replace your sessions with the five demo activities.</span></div><button className="button button-secondary" onClick={loadSamples}><Database size={15} /> Reset samples</button></div>
          <div className="settings-data-row danger-row"><div><strong>Clear all sessions</strong><span>This action cannot be undone.</span></div>{confirmClear ? <div className="confirm-actions"><button className="button button-danger" onClick={() => { clearSessions(); setConfirmClear(false); }}>Confirm clear</button><button className="button button-secondary" onClick={() => setConfirmClear(false)}>Cancel</button></div> : <button className="button button-danger-outline" onClick={() => setConfirmClear(true)}><Trash2 size={15} /> Clear data</button>}</div>
        </div>
        <div className="settings-section last">
          <div className="settings-heading"><div className="settings-icon green"><FlaskConical size={18} /></div><div><h2>Algorithm engine</h2><p>Connect the original C implementation through WebAssembly.</p></div></div>
          <div className="wasm-info"><span className={plannerAvailable ? 'engine-ready' : 'engine-waiting'} /><div><strong>{plannerAvailable ? 'C / WebAssembly module ready' : 'Temporary fallback — C / WebAssembly unavailable'}</strong><span>{plannerAvailable ? 'Schedule requests run through the original C exports.' : <>Follow <code>wasm/README.md</code> to build and serve the C exports. No JavaScript scheduling algorithms are used.</>}</span></div></div>
        </div>
      </section>
      <aside className="settings-aside"><div className="settings-aside-art"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-center"><Command size={26} /></div><span className="art-dot dot-one" /><span className="art-dot dot-two" /><span className="art-dot dot-three" /></div><h3>A planner that stays yours.</h3><p>Your sessions live in local storage and never leave this browser.</p><button className="text-link" onClick={loadSamples}>Restore demo data <ArrowRight size={15} /></button></aside>
    </div>
  </>;
}

function EmptyState({ icon: Icon, title, text, action }) {
  return <div className="empty-state"><div className="empty-illustration"><span /><span /><Icon size={21} /></div><strong>{title}</strong><p>{text}</p>{action && <div className="empty-actions">{action}</div>}</div>;
}

function weeklyHours(sessions) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const totals = days.map((day) => ({ day, hours: 0 }));
  sessions.forEach((session) => {
    const date = new Date(session.createdAt || Date.now());
    const offset = Math.floor((date - weekStart) / 86400000);
    if (offset >= 0 && offset < 7) totals[offset].hours += duration(session);
  });
  return totals.map((item) => ({ ...item, hours: Number(item.hours.toFixed(1)) }));
}

function duration(session) { return Math.max(0, (toMinutes(session.end) - toMinutes(session.start)) / 60); }
function toMinutes(time) { const [hours, minutes] = String(time).split(':').map(Number); return hours * 60 + minutes; }
function validTime(time) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(time); }
function formatTime(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`; }
function priorityLevel(score) {
  if (score <= 3) return { label: 'Low', className: 'low' };
  if (score <= 6) return { label: 'Medium', className: 'medium' };
  if (score <= 8) return { label: 'High', className: 'high' };
  return { label: 'Critical', className: 'critical' };
}
function subjectHue(subject) { let hash = 0; for (const char of subject) hash = (hash * 31 + char.charCodeAt(0)) % 360; return hash; }
function initials(name) { return String(name || 'Student').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ST'; }
function relativeTime(timestamp) { const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000)); return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`; }

export default App;