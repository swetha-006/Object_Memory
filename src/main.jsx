import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  useNavigate,
  useParams,
  useLocation,
  Link,
  Navigate,
  Routes,
  Route,
} from 'react-router-dom';
import {
  Search,
  Plus,
  LockKeyhole,
  ArrowRight,
  ArrowLeft,
  FileText,
  PenLine,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  Settings,
  Clock3,
  Package,
  Trash2,
  Upload,
  ChevronRight,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  Camera,
  Save,
  Paperclip,
  Send,
  Home,
  UserPlus,
  ImagePlus,
  Sparkles,
  Archive as ArchiveIcon,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { MarkdownView } from './components/MarkdownView';
import { ToastProvider, useToast } from './components/Toast';
import { WarrantyBadge } from './components/WarrantyBadge';
import { InsuranceDossierModal } from './components/InsuranceDossierModal';
import { detectCategoryFromImage } from './utils/vision';
import './styles.css';

const API = '/api';

async function api(path, opts = {}) {
  const headers = {
    ...(opts.body instanceof FormData
      ? {}
      : { 'Content-Type': 'application/json' }),
    ...(opts.headers || {}),
  };

  const token = localStorage.getItem('om_token');

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const r = await fetch(API + path, {
    ...opts,
    headers,
  });

  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(d.error || 'Request failed');
  }

  return d;
}

function useAuth() {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem('om_user') || 'null')
  );

  return {
    user,
    setUser,
  };
}

function Logo() {
  return (
    <Link className="logo" to="/">
      <span className="logoMark">O</span>
      <span>ObjectMemory</span>
    </Link>
  );
}

function Header() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);

  const logout = () => {
    localStorage.removeItem('om_token');
    localStorage.removeItem('om_user');
    setUser(null);
    location.href = '/login';
  };

  return (
    <header className="header">
      <div className="headerInner">
        <Logo />

        <div className="headerSearch">
          <Search size={15} />

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' &&
              nav('/archive?search=' + encodeURIComponent(q))
            }
            placeholder="Search your objects..."
          />

          <kbd>⌘K</kbd>
        </div>

        <button
          className="incidentBtn"
          onClick={() => nav('/incident')}
        >
          <ShieldAlert size={14} />
          Incident mode
        </button>

        <div className="userMenu">
          <button
            className="userBtn"
            onClick={() => setMenu(!menu)}
          >
            <span className="tinyAvatar">
              {user?.name?.[0] || 'D'}
            </span>

            <span className="userName">
              {user?.name || 'User'}
            </span>

            <ChevronRight size={12} />
          </button>

          {menu && (
            <div className="dropdown">
              <Link to="/settings">
                <Settings size={14} />
                Settings
              </Link>

              <button onClick={logout}>
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Require({ children }) {
  return localStorage.getItem('om_token') ? (
    children
  ) : (
    <Navigate to="/login" replace />
  );
}

function Shell({ children }) {
  return (
    <>
      <Header />
      <main>{children}</main>
    </>
  );
}

function Login() {
  const nav = useNavigate();

  const [mode, setMode] = useState('login');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const login = async (values) => {
    setError('');
    setBusy(true);

    try {
      const d = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      localStorage.setItem('om_token', d.token);
      localStorage.setItem('om_user', JSON.stringify(d.user));

      nav('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const d = await api('/auth/' + mode, {
        method: 'POST',
        body: JSON.stringify(form),
      });

      localStorage.setItem('om_token', d.token);
      localStorage.setItem('om_user', JSON.stringify(d.user));

      nav('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const demo = () =>
    login({
      email: 'demo@objectmemory.local',
      password: 'demo123',
    });

  return (
    <div className="authSplit">
      <section className="authStory">
        <div className="authStoryTop">
          <Logo />
        </div>

        <div className="authStoryMain">
          <div className="authStoryEyebrow">
            A PRIVATE ARCHIVE FOR THE THINGS THAT MATTER
          </div>

          <h1>
            Give your
            <br />
            possessions a
            <br />
            <em>memory.</em>
          </h1>

          <p>
            Remember how each object entered your life, how it changed
            while you owned it, and what is happening around it now.
          </p>
        </div>

        <div className="authStoryNav">
          <span>01 / MY OBJECTS</span>
          <span>02 / ITS STORY</span>
          <span>03 / THE WORLD AROUND IT</span>
        </div>
      </section>

      <section className="authFormSide">
        <div className="authFormWrap">
          <div className="authFormEyebrow">
            PRIVATE ARCHIVE / SECURE ENTRY
          </div>

          <h2>
            {mode === 'login'
              ? 'Welcome back.'
              : 'Create your archive.'}
          </h2>

          <p className="authFormIntro">
            Your objects, documents, and memories stay private to you.
          </p>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <label>
                Name

                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                  placeholder="Your name"
                />
              </label>
            )}

            <label>
              Email

              <input
                required
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <label>
              Password

              <input
                required
                minLength="8"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
                placeholder="8 characters minimum"
                autoComplete={
                  mode === 'login'
                    ? 'current-password'
                    : 'new-password'
                }
              />
            </label>

            {error && (
              <div className="error authError">
                {error}
              </div>
            )}

            <button
              className="authPrimary"
              disabled={busy}
            >
              {busy
                ? 'Opening your archive…'
                : mode === 'login'
                  ? 'Open my archive'
                  : 'Create my archive'}

              <ArrowRight size={16} />
            </button>
          </form>

          {mode === 'login' && (
            <>
              <div className="authOr">
                <span></span>
                <b>OR</b>
                <span></span>
              </div>

              <button
                className="demoArchive"
                onClick={demo}
                disabled={busy}
              >
                <Sparkles size={16} />
                Explore the demo archive
              </button>

              <div className="authPrivacy">
                <LockKeyhole size={13} />
                Local session · private by design
              </div>
            </>
          )}

          <button
            className="authSwitch"
            onClick={() => {
              setMode(
                mode === 'login'
                  ? 'register'
                  : 'login'
              );

              setForm({
                name: '',
                email: '',
                password: '',
              });

              setError('');
            }}
          >
            {mode === 'login' ? (
              <>
                New to ObjectMemory? <b>Create an account</b>
              </>
            ) : (
              <>
                Already have an archive? <b>Sign in</b>
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, value, label }) {
  return (
    <div className="stat">
      <div className="statIcon">{icon}</div>
      <div className="statValue">{value}</div>
      <div className="statLabel">{label}</div>
      <div className="statHint">in your archive</div>
    </div>
  );
}

function ObjectCard({ obj }) {
  return (
    <Link
      to={'/objects/' + obj.id}
      className="objectCard"
    >
      <div className="objImg">
        {obj.imageUrl ? (
          <img
            src={obj.imageUrl}
            alt={obj.title}
          />
        ) : (
          <ImagePlaceholder />
        )}

        <span className="pill dark">
          {obj.category}
        </span>
      </div>

      <div className="objBody">
        <h3>{obj.title}</h3>

        <p>
          {obj.subtitle || 'Remembered possession'}
        </p>

        <div className="objMeta">
          <span>
            <small>Condition</small>
            {obj.condition}
          </span>

          <span>
            <small>Recorded value</small>
            {obj.value || 'Not recorded'}
          </span>
        </div>

        <div className="objFooter">
          <WarrantyBadge warranty={obj.warranty} />
          <ChevronRight size={14} />
        </div>
      </div>
    </Link>
  );
}

function formatMemoryDate(value) {
  if (!value) return '';

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
}

function daysUntil(value) {
  if (!value) return null;

  const d = new Date(value + 'T23:59:59');

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return Math.ceil(
    (d - new Date()) / 86400000
  );
}

function buildMemoryAnswer(
  question,
  objects,
  recent,
  documentCount
) {
  const q = question.toLowerCase().trim();

  if (!q) {
    return {
      title: 'Ask about your archive.',
      text:
        'Try a question about warranties, recent damage, new arrivals, condition, repairs, documents, or what needs attention.',
    };
  }

  const warranty = objects
    .map((o) => ({
      ...o,
      days: daysUntil(o.warranty),
    }))
    .filter(
      (o) => o.days !== null && o.days >= 0
    )
    .sort((a, b) => a.days - b.days);

  const damage = recent.filter((e) =>
    ['incident', 'damage'].includes(
      String(e.type).toLowerCase()
    )
  );

  const arrivals = recent.filter(
    (e) =>
      String(e.type).toLowerCase() === 'created'
  );

  const attention = objects.filter((o) =>
    ['Damaged', 'Needs repair', 'Fair'].includes(
      o.condition
    )
  );

  if (/warrant|expire|expiry|renew|watchdog/.test(q)) {
    if (!warranty.length) {
      return {
        title: 'Warranty Coverage Overview',
        text: 'I could not find an upcoming warranty expiry date in your current archive. Add warranty dates to your objects and they will appear here.',
      };
    }

    const top = warranty
      .slice(0, 6)
      .map(
        (o) =>
          `- **${o.title}**: ${
            o.days === 0
              ? '**Expires today!**'
              : `expires in **${o.days} day${o.days === 1 ? '' : 's'}**`
          } (\`${formatMemoryDate(o.warranty)}\`)`
      )
      .join('\n');

    return {
      title: 'Upcoming Warranty Deadlines',
      text: `### Warranty Watchdog\n\n${top}\n\n*Review these items to arrange service before coverage concludes.*`,
    };
  }

  if (/damage|damaged|scratch|crack|incident|repair|broke|broken|change/.test(q)) {
    if (!damage.length) {
      return {
        title: 'Incident & Damage Audit',
        text: '✅ **No recent damage recorded:** There are no incident or damage events in your current archive.',
      };
    }

    const top = damage
      .slice(0, 6)
      .map(
        (e) =>
          `- **${e.object_title}** [${formatMemoryDate(e.occurred_at || e.created_at)}]: **${e.title}**${e.note ? ` — ${e.note}` : ''}`
      )
      .join('\n');

    return {
      title: 'Recent Changes & Incidents',
      text: `### Lifecycle Incidents Log\n\n${top}\n\n*Use **Incident Mode** to record new wear or update condition grades.*`,
    };
  }

  if (/new object|new arrival|arriv|added|recent object/.test(q)) {
    if (!arrivals.length) {
      return {
        title: 'Recent Arrivals',
        text: 'Add an object and ObjectMemory will keep its arrival permanently logged in the timeline.',
      };
    }

    const top = arrivals
      .slice(0, 6)
      .map((e) => `- **${e.object_title}** added on \`${formatMemoryDate(e.created_at)}\``)
      .join('\n');

    return {
      title: 'Recent Acquisitions',
      text: `### Catalog Additions\n\n${top}`,
    };
  }

  if (/condition|state|health|needs attention|attention|need/.test(q)) {
    if (!attention.length) {
      return {
        title: 'Condition Health Check',
        text: '✅ **All in good standing:** No objects are currently marked *Fair*, *Damaged*, or *Needs repair*.',
      };
    }

    const list = attention
      .map((o) => `- **${o.title}** (${o.category}): Current condition is **${o.condition}**`)
      .join('\n');

    return {
      title: 'Possessions Needing Attention',
      text: `### Attention List\n\n${list}\n\n*Consider scheduling repairs or filing an insurance dossier if needed.*`,
    };
  }

  if (/list|all\s+(objects|items)|what\s+do\s+i\s+own|catalog/.test(q)) {
    if (!objects.length) {
      return {
        title: 'Your Archive Catalog',
        text: 'Your archive is currently empty. Click **"Add an object"** to get started!',
      };
    }

    const list = objects
      .map((o, idx) => `${idx + 1}. **${o.title}** (${o.category}) — Condition: **${o.condition}** · Value: ${o.value ? '₹' + Number(o.value).toLocaleString() : 'N/A'}`)
      .join('\n');

    return {
      title: `Archive Catalog (${objects.length} Items)`,
      text: `### All Remembered Possessions\n\n${list}`,
    };
  }

  if (/document|receipt|invoice|paper/.test(q)) {
    return {
      title: 'Archive Document Vault',
      text: `You currently have **${documentCount || 0} recorded document(s)** across **${objects.length} possession(s)**.\n\n*All receipts and warranties are securely attached to each item's detail page.*`,
    };
  }

  if (/how many|count|many object|own/.test(q)) {
    return {
      title: 'Possession Count',
      text: `You currently remember **${objects.length} possession${objects.length === 1 ? '' : 's'}** in ObjectMemory.`,
    };
  }

  return {
    title: 'Your Archive at a Glance',
    text: `### Archive Overview\n\n- **Total Possessions:** ${objects.length} item${objects.length === 1 ? '' : 's'}\n- **Recent Incidents:** ${damage.length} recorded incident${damage.length === 1 ? '' : 's'}\n- **Upcoming Warranties:** ${warranty.length} tracked deadline${warranty.length === 1 ? '' : 's'}\n\n*Ask me about any specific item, insurance dossiers, valuations, or warranties!*`,
  };
}

function DashboardMemory({
  objects,
  recent,
  documentCount,
}) {
  const [q, setQ] = useState('');
  const [messages, setMessages] = useState([]);
  const [askingAi, setAskingAi] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const chatBottomRef = useRef(null);

  const copyResponse = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([]);
    setQ('');
  };

  useEffect(() => {
    if (messages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, askingAi]);

  const ask = async (value) => {
    const question = (value || q).trim();
    if (!question || askingAi) return;

    const userMsgId = 'u-' + Date.now();
    const assistantMsgId = 'a-' + Date.now();
    const userMsg = {
      id: userMsgId,
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setQ('');
    setAskingAi(true);

    try {
      const res = await api('/archive/chat', {
        method: 'POST',
        body: JSON.stringify({
          question,
          history: newHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: res.answer,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      // Local client fallback if server or Groq fails
      const fallback = buildMemoryAnswer(
        question,
        objects,
        recent,
        documentCount
      );

      const fallbackText = fallback.text
        ? `### ${fallback.title}\n\n${fallback.text}`
        : `### Archive Intelligence\n\nI was unable to reach the AI server, but your local archive contains **${objects.length} objects** and **${documentCount} documents**.`;

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: fallbackText,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setAskingAi(false);
    }
  };

  return (
    <div className="dashboardMemory">
      <div className="dashboardMemoryHead">
        <div>
          <div className="eyebrow aiPill">
            <Sparkles size={11} />
            WHOLE-PLATFORM & ARCHIVE COPILOT
          </div>

          <h3>Ask ObjectMemory Intelligence</h3>

          <p>
            Your master AI copilot with complete awareness of all {objects.length} cataloged possessions,
            timelines, documents, valuation metrics, and platform workflows.
          </p>
        </div>

        <div className="copilotStatus">
          <span className="copilotPulse"></span>
          <span>{objects.length} Objects Synced</span>
          {messages.length > 0 && (
            <button
              className="clearChatBtn"
              onClick={clearChat}
              title="Reset conversation"
            >
              <RefreshCw size={12} />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="dashboardAskInput">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !askingAi && ask()}
          placeholder="Ask anything about your possessions, warranties, valuations, or platform features…"
          disabled={askingAi}
        />

        <button
          onClick={() => ask()}
          disabled={askingAi || !q.trim()}
          className="askSubmitBtn"
        >
          {askingAi ? (
            <>
              <RefreshCw size={14} className="spin" />
              <span>Analyzing…</span>
            </>
          ) : (
            <>
              <Send size={14} />
              <span>Ask Copilot</span>
            </>
          )}
        </button>
      </div>

      {(messages.length > 0 || askingAi) && (
        <div className="dashboardChatStream">
          {messages.map((m) => {
            if (m.role === 'user') {
              return (
                <div className="msg userMsg" key={m.id}>
                  <b>You</b>
                  <span>{m.content}</span>
                </div>
              );
            }

            return (
              <div className="msg assistantMsg copilotAssistantMsg" key={m.id}>
                <div className="assistantHeader">
                  <span className="assistantBadge">
                    <Sparkles size={12} />
                    Platform Assistant
                  </span>

                  <div className="assistantTools">
                    <button
                      className="copyBtn"
                      onClick={() => copyResponse(m.content, m.id)}
                      title="Copy response"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check size={11} /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={11} /> Copy
                        </>
                      )}
                    </button>

                    {m.created_at && (
                      <span className="msgTimestamp">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <MarkdownView content={m.content} />
              </div>
            );
          })}

          {askingAi && (
            <div className="msg assistantMsg copilotAssistantMsg typingMsg">
              <div className="assistantHeader">
                <span className="assistantBadge">
                  <Sparkles size={12} />
                  Analyzing entire archive & platform records…
                </span>
              </div>
              <div className="copilotLoadingState">
                <span className="typingDot"></span>
                <span className="typingDot"></span>
                <span className="typingDot"></span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const [d, setD] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    api('/dashboard')
      .then(setD)
      .catch(() => {});
  }, []);

  if (!d) {
    return (
      <Shell>
        <div className="loading">
          Loading memory…
        </div>
      </Shell>
    );
  }

  const filtered = d.objects.filter((o) =>
    o.title
      .toLowerCase()
      .includes(q.toLowerCase())
  );

  return (
    <Shell>
      <div className="container dashboard">
        <section className="hero">
          <div className="heroCopy">
            <div className="eyebrow">
              PRIVATE OBJECT MEMORY · LOCAL
            </div>

            <h1>
              Your things have stories.
              <br />
              <em>Keep them close.</em>
            </h1>

            <p>
              ObjectMemory remembers not only
              what you own, but how it entered your
              life, how it changed, and the
              documents and notes around it.
            </p>

            <div className="heroActions">
              <Link
                className="btn primary"
                to="/objects/new"
              >
                <Plus size={14} />
                Add an object
              </Link>

              <Link
                className="textLink"
                to="/archive"
              >
                See archive
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          <div className="quote">
            <div className="eyebrow">
              A small reminder
            </div>

            <blockquote>
              “The smallest details are often the
              ones you’ll want back.”
            </blockquote>

            <span>
              ♡ Your memory, in context
            </span>
          </div>
        </section>

        <div className="stats">
          <Stat
            icon={<ArchiveIcon size={14} />}
            value={d.stats.objects}
            label="Objects remembered"
          />

          <Stat
            icon={<ShieldCheck size={14} />}
            value={d.stats.totalValue ? '₹' + Number(d.stats.totalValue).toLocaleString() : '₹0'}
            label="Archive valuation"
          />

          <Stat
            icon={<AlertTriangle size={14} />}
            value={String(d.stats.incidents).padStart(
              2,
              '0'
            )}
            label="Attention needed"
          />

          <Stat
            icon={<FileText size={14} />}
            value={String(d.stats.documents).padStart(
              2,
              '0'
            )}
            label="Documents"
          />
        </div>

        {d.analytics?.upcomingWarranties?.length > 0 && (
          <div className="watchdogSection">
            <div className="watchdogHead">
              <div className="watchdogTitle">
                <ShieldAlert size={16} />
                <span>Warranty Watchdog: Upcoming Deadlines</span>
              </div>
              <span className="pill warn">{d.analytics.upcomingWarranties.length} Tracked</span>
            </div>
            <div className="watchdogGrid">
              {d.analytics.upcomingWarranties.slice(0, 6).map((w) => (
                <Link to={`/objects/${w.id}?tab=overview`} key={w.id} className="watchdogCard">
                  <div className="watchdogCardInfo">
                    <b>{w.title}</b>
                    <small>{w.category} · Expiry: {w.expiryDate}</small>
                  </div>
                  <WarrantyBadge warranty={w.warranty} />
                </Link>
              ))}
            </div>
          </div>
        )}

        <DashboardMemory
          objects={d.objects}
          recent={d.recent}
          documentCount={d.stats.documents}
        />

        <section className="split">
          <div className="wide">
            <div className="sectionHead">
              <div>
                <div className="eyebrow">
                  THE OBJECT SHELF
                </div>

                <h2>What I own</h2>
              </div>

              <div className="shelfSearch">
                <Search size={13} />

                <input
                  placeholder="Filter objects"
                  value={q}
                  onChange={(e) =>
                    setQ(e.target.value)
                  }
                />
              </div>
            </div>

            <div className="objectGrid">
              {filtered.map((o) => (
                <ObjectCard
                  obj={o}
                  key={o.id}
                />
              ))}
            </div>

            {!filtered.length && (
              <div className="empty">
                No objects match that search.
              </div>
            )}
          </div>

          <aside>
            <div className="nudges">
              <div className="eyebrow">
                SMALL ATTENTIONS
              </div>

              <h3>Small nudges</h3>

              <div className="nudge">
                <b>Keep details current</b>
                <span>
                  Record damage or changes when
                  they happen.
                </span>
              </div>

              <div className="nudge">
                <b>Capture the context</b>
                <span>
                  Add documents, receipts and notes
                  while they are still easy to find.
                </span>
              </div>
            </div>
          </aside>
        </section>

        <section className="recent">
          <div className="sectionHead">
            <div>
              <div className="eyebrow">
                THE LIVING RECORD
              </div>

              <h2>Recent memory</h2>
            </div>

            <span className="micro">
              DATABASE TIMELINE
            </span>
          </div>

          <div className="memoryGrid">
            {d.recent.map((e) => (
              <div
                className="memoryItem"
                key={e.id}
              >
                <span>
                  {new Date(
                    e.created_at
                  ).toLocaleDateString()}
                </span>

                <b>{e.title}</b>

                <small>
                  {e.object_title} · {e.note}
                </small>

                <i>
                  {e.type.toUpperCase()}
                </i>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}


function ImagePlaceholder({ large = false }) {
  return (
    <div
      className={
        large
          ? 'imagePlaceholder large'
          : 'imagePlaceholder'
      }
    >
      <ImagePlus size={large ? 28 : 22} />
      <span>No photo yet</span>
    </div>
  );
}

function AddObject() {
  const nav = useNavigate();

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const [f, setF] = useState({
    title: '',
    brand: '',
    model: '',
    category: 'Other',
    origin: 'Bought new',
    condition: 'Good',
    purchaseDate: today,
    value: '',
    warranty: '',
    serial: '',
    description: '',
  });

  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [detecting, setDetecting] =
    useState(false);
  const [detected, setDetected] =
    useState(null);
  const [saving, setSaving] =
    useState(false);

  const set = (k, v) => {
    setF((prev) => ({
      ...prev,
      [k]: v,
    }));
  };

  const handlePhoto = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert(
        'Image must be 10 MB or smaller.'
      );
      return;
    }

    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setDetected(null);
    setDetecting(true);

    const result =
      await detectCategoryFromImage(file);

    setF((prev) => ({
      ...prev,
      category: result.category,
      title:
        prev.title ||
        (result.category !== 'Other'
          ? result.category
          : ''),
    }));

    setDetected(result);
    setDetecting(false);
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!f.title.trim()) {
      alert('Please enter an object name.');
      return;
    }

    setSaving(true);

    try {
      const d = await api('/objects', {
        method: 'POST',
        body: JSON.stringify(f),
      });

      if (photo) {
        const fd = new FormData();

        fd.append('file', photo);

        await api(
          '/objects/' +
            d.object.id +
            '/image',
          {
            method: 'POST',
            body: fd,
          }
        );
      }

      nav('/objects/' + d.object.id);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell>
      <div className="formPage container">
        <Link to="/" className="back">
          <ArrowLeft size={14} />
          Back to archive
        </Link>

        <div className="eyebrow">
          NEW MEMORY / PHOTO FIRST
        </div>

        <h1>Add an object.</h1>

        <p className="pageIntro">
          Give ObjectMemory a photograph first. AI
          can suggest what it sees; you decide what
          becomes part of the record.
        </p>

        <form
          className="objectForm"
          onSubmit={submit}
        >
          <FormSection title="01 / Object photograph">
            <div className="photoUploadPanel">
              <label className="photoDrop objectPhotoDrop">
                {preview ? (
                  <>
                    <img
                      src={preview}
                      alt="Selected object preview"
                    />

                    <span className="photoChangeHint">
                      Click to replace photo
                    </span>
                  </>
                ) : (
                  <>
                    <Camera size={30} />

                    <b>
                      Upload an object photograph
                    </b>

                    <span>
                      JPEG, PNG or WEBP · up to
                      10 MB · kept private
                    </span>
                  </>
                )}

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  hidden
                  onChange={(e) =>
                    handlePhoto(
                      e.target.files?.[0]
                    )
                  }
                />
              </label>

              <div
                className={
                  detecting
                    ? 'photoAiState aiWorking'
                    : 'photoAiState'
                }
              >
                {detecting ? (
                  <>
                    <Sparkles size={14} />
                    AI is observing the photograph…
                  </>
                ) : detected ? (
                  <>
                    <CheckCircle2 size={14} />
                    AI suggestion:{' '}
                    <b>{detected.category}</b>

                    {detected.label && (
                      <span>
                        {' '}
                        · {detected.label}
                      </span>
                    )}

                    <span>
                      {' '}
                      ·{' '}
                      {Math.round(
                        (detected.confidence || 0) *
                          100
                      )}
                      %
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Add a photo to enable automatic
                    object suggestions.
                  </>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection title="02 / What is it?">
            {detected && (
              <div className="aiSuggestion">
                <div>
                  <Sparkles size={14} />
                  <b>AI observation</b>
                </div>

                <span>
                  Review the suggested category and
                  details before saving. AI suggestions
                  never replace your input.
                </span>
              </div>
            )}

            <div className="formGrid">
              <Field
                label="Object name"
                required
                value={f.title}
                onChange={(v) =>
                  set('title', v)
                }
                placeholder="e.g. Galaxy S24"
              />

              <Field
                label="Brand"
                value={f.brand}
                onChange={(v) =>
                  set('brand', v)
                }
                placeholder="e.g. Samsung"
              />

              <Field
                label="Model"
                value={f.model}
                onChange={(v) =>
                  set('model', v)
                }
                placeholder="e.g. SM-S921B"
              />

              <label>
                Category

                <select
                  value={f.category}
                  onChange={(e) =>
                    set(
                      'category',
                      e.target.value
                    )
                  }
                >
                  <option>Other</option>
                  <option>Electronics</option>
                  <option>Car</option>
                  <option>Computer</option>
                  <option>Phone</option>
                  <option>Camera</option>
                  <option>Furniture</option>
                  <option>Jewellery</option>
                  <option>Document</option>
                </select>
              </label>
            </div>
          </FormSection>

          <FormSection title="03 / How did it enter your life?">
            <div className="choiceGrid">
              {[
                'Bought new',
                'Bought second-hand',
                'Received as a gift',
                'Inherited',
                "Don't remember",
                'Other',
              ].map((v) => (
                <button
                  type="button"
                  key={v}
                  className={
                    f.origin === v
                      ? 'choice active'
                      : 'choice'
                  }
                  onClick={() =>
                    set('origin', v)
                  }
                >
                  {v}
                </button>
              ))}
            </div>
          </FormSection>

          <FormSection title="04 / Dates & value">
            <div className="formGrid">
              <Field
                label="Purchase date"
                type="date"
                value={f.purchaseDate}
                onChange={(v) =>
                  set('purchaseDate', v)
                }
              />

              <Field
                label="Purchase price (INR)"
                value={f.value}
                onChange={(v) =>
                  set('value', v)
                }
                placeholder="e.g. 74999"
              />

              <Field
                label="Warranty expiry"
                type="date"
                value={f.warranty}
                onChange={(v) =>
                  set('warranty', v)
                }
              />

              <Field
                label="Serial number"
                value={f.serial}
                onChange={(v) =>
                  set('serial', v)
                }
                placeholder="Optional"
              />
            </div>
          </FormSection>

          <FormSection title="05 / Current condition">
            <div className="formGrid">
              <label>
                Current condition

                <select
                  value={f.condition}
                  onChange={(e) =>
                    set(
                      'condition',
                      e.target.value
                    )
                  }
                >
                  <option>Excellent</option>
                  <option>Good</option>
                  <option>Fair</option>
                  <option>Damaged</option>
                  <option>Needs repair</option>
                </select>
              </label>

              <div className="conditionHint">
                <CheckCircle2 size={14} />

                <span>
                  Update this whenever the object's
                  state changes.
                </span>
              </div>

              <Field
                label="Anything else I should remember?"
                full
                value={f.description}
                onChange={(v) =>
                  set('description', v)
                }
                placeholder="A purchase memory, identifying detail, previous owner, setup note…"
              />
            </div>
          </FormSection>

          <div className="formActions">
            <Link
              className="btn ghost"
              to="/"
            >
              Cancel
            </Link>

            <button
              className="btn primary"
              disabled={detecting || saving}
            >
              {saving ? (
                <>
                  <Save size={14} />
                  Saving…
                </>
              ) : detecting ? (
                <>
                  <Sparkles size={14} />
                  Finish AI observation…
                </>
              ) : (
                <>
                  <Save size={14} />
                  Save to my archive
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}

function FormSection({ title, children }) {
  return (
    <section className="formSection">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  full,
  required,
  type = 'text',
  placeholder,
}) {
  return (
    <label
      className={full ? 'fullRow' : ''}
    >
      {label}

      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
      />
    </label>
  );
}

function ObjectDetail() {
  const { id } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const { user } = useAuth();

  const [obj, setObj] = useState(null);
  const [dossier, setDossier] = useState(false);

  const [tab, setTab] = useState(
    new URLSearchParams(location.search).get(
      'tab'
    ) || 'overview'
  );

  const [edit, setEdit] = useState(false);

  const [event, setEvent] = useState({
    type: 'damage',
    title: 'Damage / change noted',
    note: '',
    condition: '',
  });

  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  const [market, setMarket] = useState(null);
  const [marketBusy, setMarketBusy] = useState(false);
  const [marketError, setMarketError] = useState('');

  const load = () =>
    api('/objects/' + id).then((x) =>
      setObj(x.object)
    );

  useEffect(() => {
    load();

    api('/objects/' + id + '/chat')
      .then((x) => setMessages(x.messages))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    const t = new URLSearchParams(
      location.search
    ).get('tab');

    if (t) {
      setTab(t);
    }
  }, [location.search]);

  const loadMarket = async (refresh = false) => {
    setMarketBusy(true);
    setMarketError('');
    try {
      const d = await api(
        '/objects/' + id + '/market' + (refresh ? '?refresh=1' : '')
      );
      setMarket(d);
    } catch (e) {
      setMarketError(e.message);
      setMarket(e.market || null);
    } finally {
      setMarketBusy(false);
    }
  };

  useEffect(() => {
    if (tab === 'market') loadMarket(false);
  }, [id, tab]);

  if (!obj) {
    return (
      <Shell>
        <div className="loading">
          Loading object…
        </div>
      </Shell>
    );
  }

  const saveEdit = async (patch) => {
    const d = await api('/objects/' + id, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });

    setObj(d.object);
    setEdit(false);
  };

  const addEvent = async (e) => {
    e.preventDefault();

    const d = await api(
      '/objects/' + id + '/events',
      {
        method: 'POST',
        body: JSON.stringify(event),
      }
    );

    setObj(d.object);

    setEvent({
      type: 'damage',
      title: 'Damage / change noted',
      note: '',
      condition: '',
    });
  };

  const uploadDoc = async () => {
    if (!file) return;

    const fd = new FormData();
    fd.append('file', file);

    const d = await api(
      '/objects/' + id + '/documents',
      {
        method: 'POST',
        body: fd,
      }
    );

    setObj(d.object);
    setFile(null);
  };

  const uploadImage = async (selected) => {
    if (!selected) return;

    if (!selected.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      alert(
        'Image must be 10 MB or smaller.'
      );
      return;
    }

    const fd = new FormData();
    fd.append('file', selected);

    try {
      const d = await api(
        '/objects/' + id + '/image',
        {
          method: 'POST',
          body: fd,
        }
      );

      setObj(d.object);
    } catch (e) {
      alert(e.message);
    }
  };

  const send = async (explicitText) => {
    const text = (typeof explicitText === 'string' ? explicitText : message).trim();
    if (!text || busy) return;

    setBusy(true);
    setMessage('');

    const tempUserId = 'user-' + Date.now();
    const tempAssistantId = 'ai-' + Date.now();

    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: 'user', content: text, created_at: new Date().toISOString() },
      { id: tempAssistantId, role: 'assistant', content: '', created_at: new Date().toISOString() }
    ]);

    const token = localStorage.getItem('om_token');

    try {
      const response = await fetch(API + '/objects/' + id + '/chat?stream=1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message: text })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Request failed with ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const d = await response.json();
        setMessages(d.messages);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamed = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            if (data.error) throw new Error(data.error);
            if (data.chunk) {
              streamed += data.chunk;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId ? { ...m, content: streamed } : m
                )
              );
            }
            if (data.done && data.messages) {
              setMessages(data.messages);
            }
          } catch (err) {
            if (err.message && err.message !== 'Unexpected end of JSON input') {
              console.error('Stream chunk error:', err);
            }
          }
        }
      }
    } catch (e) {
      alert(e.message || 'Error communicating with assistant');
      api('/objects/' + id + '/chat')
        .then((x) => setMessages(x.messages))
        .catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const deleteDoc = async (did) => {
    await api('/documents/' + did, {
      method: 'DELETE',
    });

    load();
  };

  const deleteObj = async () => {
    if (
      confirm(
        'Delete this object and all its memories?'
      )
    ) {
      await api('/objects/' + id, {
        method: 'DELETE',
      });

      nav('/');
    }
  };

  return (
    <Shell>
      <div className="container detail">
        <div className="detailTop">
          <Link className="back" to="/">
            <ArrowLeft size={14} />
            Back to archive
          </Link>

          <span className="private">
            <LockKeyhole size={12} />
            PRIVATE OBJECT MEMORY
          </span>

          <button
            className="btn danger small"
            onClick={deleteObj}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>

        <div className="crumb">
          MY OBJECTS
          <ChevronRight size={11} />
          {obj.category.toUpperCase()}
        </div>

        <div className="objectHeader">
          <div>
            <div className="mainPhoto">
              {obj.imageUrl ? (
                <img
                  src={obj.imageUrl}
                  alt={obj.title}
                />
              ) : (
                <ImagePlaceholder large />
              )}

              <span className="pill dark">
                {obj.category}
              </span>
            </div>

            <div className="photoStrip">
              <div className="thumb">
                {obj.imageUrl ? (
                  <img
                    src={obj.imageUrl}
                    alt="Object"
                  />
                ) : (
                  <ImagePlaceholder />
                )}
              </div>

              <label className="photoAddButton">
                <Camera size={14} />

                <span>Change photo</span>

                <input
                  id="objectPhotoInput"
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) =>
                    uploadImage(
                      e.target.files?.[0]
                    )
                  }
                />
              </label>
            </div>
          </div>

          <div className="detailInfo">
            <div className="eyebrow">
              OBJECT MEMORY /{' '}
              {obj.category.toUpperCase()}
            </div>

            <h1>{obj.title}</h1>

            <div className="subtitle">
              {obj.subtitle ||
                'Remembered possession'}
            </div>

            <div className="tags">
              <WarrantyBadge warranty={obj.warranty} />

              {obj.condition === 'Damaged' && (
                <span className="pill warn">
                  DAMAGE RECORDED
                </span>
              )}
            </div>

            <div className="infoGrid">
              <Info
                label="Current condition"
                value={obj.condition}
              />

              <Info
                label="Purchase date"
                value={
                  obj.purchase_date ||
                  'Not recorded'
                }
              />

              <Info
                label="Recorded value"
                value={
                  obj.value || 'Not recorded'
                }
              />

              <Info
                label="Warranty expiry"
                value={
                  obj.warranty ||
                  'Not recorded'
                }
              />

              <Info
                label="Serial number"
                value={
                  obj.serial ||
                  'Not recorded'
                }
              />

              <Info
                label="Last memory"
                value={new Date(
                  obj.updated_at
                ).toLocaleDateString()}
              />
            </div>

            <div className="detailActions">
              <button
                className="btn darkBtn"
                onClick={() => setEdit(true)}
              >
                <PenLine size={13} />
                Edit details
              </button>

              <button
                className="btn ghost"
                onClick={() => setDossier(true)}
              >
                <ShieldCheck size={13} />
                Insurance Dossier
              </button>

              <button
                className="btn ghost"
                onClick={() =>
                  document
                    .getElementById('docInput')
                    .click()
                }
              >
                <FileText size={13} />
                Add document
              </button>

              <input
                id="docInput"
                type="file"
                hidden
                onChange={(e) => {
                  setFile(
                    e.target.files?.[0] || null
                  );

                  setTimeout(() => {}, 0);
                }}
              />
            </div>

            {file && (
              <div className="uploadPending">
                <span>{file.name}</span>

                <button
                  className="btn primary small"
                  onClick={uploadDoc}
                >
                  Upload
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="tabs">
          {[
            'overview',
            'timeline',
            'documents',
            'market',
            'ask',
          ].map((t) => (
            <button
              className={
                tab === t ? 'active' : ''
              }
              onClick={() => {
                setTab(t);
                nav(
                  '/objects/' +
                    id +
                    '?tab=' +
                    t
                );
              }}
              key={t}
            >
              {t === 'ask'
                ? 'Ask AI'
                : t[0].toUpperCase() +
                  t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <Overview
            obj={obj}
            onDamage={addEvent}
            event={event}
            setEvent={setEvent}
          />
        )}

        {tab === 'timeline' && (
          <Timeline obj={obj} />
        )}

        {tab === 'documents' && (
          <Documents
            obj={obj}
            onDelete={deleteDoc}
          />
        )}

        {tab === 'market' && (
          <MarketTab
            obj={obj}
            market={market}
            busy={marketBusy}
            error={marketError}
            onRefresh={() => loadMarket(true)}
          />
        )}

        {tab === 'ask' && (
          <AskAI
            obj={obj}
            messages={messages}
            message={message}
            setMessage={setMessage}
            send={send}
            busy={busy}
          />
        )}

        {edit && (
          <EditModal
            obj={obj}
            onClose={() => setEdit(false)}
            onSave={saveEdit}
          />
        )}

        {dossier && (
          <InsuranceDossierModal
            obj={obj}
            user={user}
            onClose={() => setDossier(false)}
          />
        )}
      </div>
    </Shell>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <small>{label}</small>
      <b>{value}</b>
      <i>USER PROVIDED</i>
    </div>
  );
}

function MarketTab({ obj, market, busy, error, onRefresh }) {
  const money = (value) => value == null ? '—' : `₹${Math.round(value).toLocaleString('en-IN')}`;
  const change = market?.changePercent;
  const trendClass = market?.trend === 'Rising' ? 'marketUp' : market?.trend === 'Falling' ? 'marketDown' : '';

  return (
    <div className="singleTab">
      <div className="marketHeaderRow">
        <div>
          <div className="eyebrow">LIVE MARKET OBSERVATION</div>
          <h2>What the market is doing</h2>
          <p className="marketSub">
            Based on current Google Shopping listings matching {market?.query || [obj.brand, obj.model, obj.title].filter(Boolean).join(' ')} in India.
          </p>
        </div>
        <button className="btn small" onClick={onRefresh} disabled={busy}>
          <RefreshCw size={13} className={busy ? 'spin' : ''} />
          {busy ? 'Checking…' : 'Refresh market'}
        </button>
      </div>

      {error && (
        <div className="marketNotice">
          <b>Market data unavailable</b>
          <span>{error}</span>
          {!market?.configured && (
            <span>Add <code>SERPAPI_KEY</code> to <code>.env</code>, then restart the server.</span>
          )}
        </div>
      )}

      <div className="marketGrid">
        <div className="card marketMetric">
          <small>CURRENT MARKET PRICE</small>
          <strong>{money(market?.currentPrice)}</strong>
          <span>{market?.observations ? `${market.observations} listing observations stored` : 'No observations yet'}</span>
        </div>
        <div className="card marketMetric">
          <small>TREND</small>
          <strong className={trendClass}>{market?.trend || 'No data'}</strong>
          <span>{change == null ? 'Collecting price history' : `${change > 0 ? '+' : ''}${change}% since first observation`}</span>
        </div>
        <div className="card marketMetric">
          <small>YOUR RECORDED PRICE</small>
          <strong>{money(Number(obj.value) || null)}</strong>
          <span>User-provided purchase value · not a valuation</span>
        </div>
      </div>

      <div className="card marketChartCard">
        <div className="sectionHead">
          <div>
            <div className="eyebrow">PRICE HISTORY</div>
            <h2>Observed market movement</h2>
          </div>
          <span className="micro">
            {market?.firstObservedAt ? `Since ${new Date(market.firstObservedAt).toLocaleDateString()}` : 'Refresh to start history'}
          </span>
        </div>

        {market?.history?.length ? (
          <MarketChart history={market.history} />
        ) : (
          <div className="marketEmpty">
            {busy ? 'Collecting current listings…' : 'No market observations yet.'}
          </div>
        )}
      </div>

      <div className="card marketListings">
        <div className="sectionHead">
          <div>
            <div className="eyebrow">SOURCE LISTINGS</div>
            <h2>Where the observed prices came from</h2>
          </div>
        </div>
        {market?.listings?.length ? market.listings.slice(0,8).map((item, i) => (
          <div className="marketListing" key={`${item.source}-${item.title}-${i}`}>
            <div>
              <b>{item.title}</b>
              <span>{item.source} · {new Date(item.observedAt).toLocaleString()}</span>
            </div>
            <strong>{money(item.price)}</strong>
            {item.url && <a href={item.url} target="_blank" rel="noreferrer" aria-label="Open listing"><ExternalLink size={13} /></a>}
          </div>
        )) : (
          <div className="empty">No source listings have been captured yet.</div>
        )}
      </div>

      <div className="marketDisclaimer">
        <b>Important:</b> this is an observed retail-listing trend, not an official appraisal or guaranteed resale value. Prices can vary by seller, promotion, stock and condition.
      </div>
    </div>
  );
}

function MarketChart({ history }) {
  if (history.length === 1) {
    return (
      <div className="marketSinglePoint">
        <strong>₹{history[0].price.toLocaleString('en-IN')}</strong>
        <span>{new Date(history[0].date).toLocaleDateString()} · first observation</span>
      </div>
    );
  }

  const width = 760;
  const height = 220;
  const padX = 34;
  const padY = 24;
  const values = history.map(x => x.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, max * 0.04, 1);
  const low = min - spread * 0.15;
  const high = max + spread * 0.15;
  const points = history.map((item, index) => {
    const x = padX + (index / (history.length - 1)) * (width - padX * 2);
    const y = height - padY - ((item.price - low) / (high - low)) * (height - padY * 2);
    return { ...item, x, y };
  });
  const line = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="marketChartWrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="marketChart" role="img" aria-label="Observed market price history">
        <line x1={padX} y1={height-padY} x2={width-padX} y2={height-padY} className="chartAxis" />
        <polyline points={line} fill="none" className="chartLine" />
        {points.map((p, i) => (
          <g key={p.date}>
            <circle cx={p.x} cy={p.y} r="4" className="chartPoint" />
            <text x={p.x} y={height-7} textAnchor="middle" className="chartLabel">{new Date(p.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</text>
            {i === points.length - 1 && <text x={p.x} y={p.y-10} textAnchor="middle" className="chartValue">₹{Math.round(p.price).toLocaleString('en-IN')}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

function Overview({
  obj,
  onDamage,
  event,
  setEvent,
}) {
  return (
    <div className="contentSplit">
      <div className="card history">
        <div className="sectionHead">
          <div>
            <div className="eyebrow">
              CONDITION HISTORY
            </div>

            <h2>How it’s holding up</h2>
          </div>

          <span className="good">
            ✓ {obj.condition}
          </span>
        </div>

        <TimelineEvents obj={obj} />

        <form
          className="damageForm"
          onSubmit={onDamage}
        >
          <div className="eyebrow">
            ADD MEMORY
          </div>

          <div className="formGrid">
            <input
              placeholder="Damage or change note"
              value={event.note}
              onChange={(e) =>
                setEvent({
                  ...event,
                  note: e.target.value,
                })
              }
            />

            <select
              value={event.type}
              onChange={(e) =>
                setEvent({
                  ...event,
                  type: e.target.value,
                })
              }
            >
              <option value="damage">
                Damage note
              </option>

              <option value="incident">
                Incident
              </option>

              <option value="note">
                General note
              </option>
            </select>
          </div>

          <button className="btn primary small">
            <Plus size={13} />
            Save memory
          </button>
        </form>
      </div>

      <div className="card market">
        <div className="eyebrow">
          AROUND YOUR OBJECT
        </div>

        <h2>Object memory</h2>

        <p>
          {obj.description ||
            'No additional description has been recorded yet.'}
        </p>

        <button
          className="askBar"
          onClick={() =>
            (location.href = '?tab=ask')
          }
        >
          <MessageCircle size={13} />
          Ask about this object
        </button>
      </div>
    </div>
  );
}

function TimelineEvents({ obj }) {
  return (
    <div className="timeline">
      {obj.events.map((e) => (
        <div
          className="event"
          key={e.id}
        >
          <span className="dot"></span>

          <div>
            <small>
              {new Date(
                e.occurred_at ||
                  e.created_at
              ).toLocaleString()}{' '}
              · {e.type.toUpperCase()}
            </small>

            <b>{e.title}</b>

            {e.imageUrl && (
              <img
                className="eventPhoto"
                src={e.imageUrl}
                alt="Incident evidence"
              />
            )}

            <span>{e.note}</span>

            <i>
              {e.condition ||
                'USER PROVIDED'}
            </i>
          </div>
        </div>
      ))}
    </div>
  );
}

function Timeline({ obj }) {
  return (
    <div className="singleTab">
      <div className="card">
        <div className="eyebrow">
          LIVING RECORD
        </div>

        <h2>Object timeline</h2>

        <TimelineEvents obj={obj} />
      </div>
    </div>
  );
}

function Documents({ obj, onDelete }) {
  return (
    <div className="singleTab">
      <div className="card">
        <div className="sectionHead">
          <div>
            <div className="eyebrow">
              DOCUMENT MEMORY
            </div>

            <h2>Documents</h2>
          </div>

          <span>
            {obj.documents.length} file(s)
          </span>
        </div>

        {obj.documents.length ? (
          <div className="docs">
            {obj.documents.map((d) => (
              <div
                className="doc"
                key={d.id}
              >
                <FileText size={18} />

                <span>
                  <b>{d.original_name}</b>

                  <small>
                    {Math.round(
                      d.size / 1024
                    )}{' '}
                    KB ·{' '}
                    {new Date(
                      d.created_at
                    ).toLocaleDateString()}
                  </small>
                </span>

                <a
                  className="btn ghost small"
                  href={
                    '/uploads/' +
                    d.stored_name
                  }
                  target="_blank"
                >
                  Open
                </a>

                <button
                  className="iconBtn"
                  onClick={() =>
                    onDelete(d.id)
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            No documents yet. Use “Add document”
            above.
          </div>
        )}
      </div>
    </div>
  );
}

function AskAI({
  obj,
  messages,
  message,
  setMessage,
  send,
  busy,
}) {
  const [copiedId, setCopiedId] = useState(null);
  const chatBottomRef = useRef(null);

  const copyResponse = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const promptSuggestions = [
    'What could cause it to overheat?',
    'Is my warranty still valid?',
    'Care and maintenance guidelines',
    'Summarize condition and past incidents',
    'Compare recorded value with current market'
  ];

  return (
    <div className="singleTab">
      <div className="card aiCard">
        <div className="eyebrow">
          OBJECTMEMORY ASSISTANT
        </div>

        <h2>Talk to your object.</h2>

        <p>
          I can answer questions about this possession using its verified details and memory, including care, troubleshooting, warranty deadlines, valuation, and past incident history.
        </p>

        <div className="chat">
          {!messages.length && (
            <div className="msg assistantMsg">
              <div className="assistantHeader">
                <span className="assistantBadge">
                  <Sparkles size={12} />
                  ObjectMemory Assistant
                </span>
              </div>
              <MarkdownView
                content={`Hello! I am your AI assistant for **${obj.title}** (${obj.category}).\n\nAsk me anything about this item: troubleshooting, care guidelines, warranty status, maintenance, or recorded history.`}
              />
            </div>
          )}

          {messages.map((m) => {
            if (m.role === 'user') {
              return (
                <div className="msg userMsg" key={m.id}>
                  <b>You</b>
                  <span>{m.content}</span>
                </div>
              );
            }

            return (
              <div className="msg assistantMsg" key={m.id}>
                <div className="assistantHeader">
                  <span className="assistantBadge">
                    <Sparkles size={12} />
                    ObjectMemory Assistant
                  </span>

                  <div className="assistantTools">
                    <button
                      className="copyBtn"
                      onClick={() => copyResponse(m.content, m.id)}
                      title="Copy response"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check size={11} /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={11} /> Copy
                        </>
                      )}
                    </button>

                    {m.created_at && (
                      <span className="msgTimestamp">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <MarkdownView content={m.content} />
                {busy && !m.content && <span className="typingCursor">▋</span>}
              </div>
            );
          })}
          <div ref={chatBottomRef} />
        </div>

        <div className="chatPromptSuggestions">
          {promptSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              className="chatPromptChip"
              onClick={() => {
                setMessage(suggestion);
                send(suggestion);
              }}
              disabled={busy}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="qaBox">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask about this object…"
            disabled={busy}
          />

          <button
            className="btn primary"
            onClick={() => send()}
            disabled={busy || !message.trim()}
          >
            <Send size={13} />
            {busy ? 'Streaming…' : 'Ask'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({
  obj,
  onClose,
  onSave,
}) {
  const [f, setF] = useState({
    title: obj.title,
    category: obj.category,
    subtitle: obj.subtitle,
    condition: obj.condition,
    purchaseDate: obj.purchase_date,
    value: obj.value,
    warranty: obj.warranty,
    serial: obj.serial,
    description: obj.description,
  });

  const set = (k, v) =>
    setF({
      ...f,
      [k]: v,
    });

  return (
    <div className="overlay">
      <div className="modal">
        <button
          className="close"
          onClick={onClose}
        >
          <X size={17} />
        </button>

        <div className="eyebrow">
          EDIT MEMORY
        </div>

        <h2>Update object details</h2>

        <div className="formGrid">
          <Field
            label="Name"
            value={f.title}
            onChange={(v) =>
              set('title', v)
            }
          />

          <label>
            Category

            <select
              value={f.category}
              onChange={(e) =>
                set(
                  'category',
                  e.target.value
                )
              }
            >
              <option>Other</option>
              <option>Car</option>
              <option>Computer</option>
              <option>Phone</option>
              <option>Camera</option>
              <option>Furniture</option>
              <option>Jewellery</option>
            </select>
          </label>

          <label>
            Condition

            <select
              value={f.condition}
              onChange={(e) =>
                set(
                  'condition',
                  e.target.value
                )
              }
            >
              <option>Excellent</option>
              <option>Good</option>
              <option>Fair</option>
              <option>Damaged</option>
              <option>Needs repair</option>
            </select>
          </label>

          <Field
            label="Purchase date"
            type="date"
            value={f.purchaseDate}
            onChange={(v) =>
              set('purchaseDate', v)
            }
          />

          <Field
            label="Value"
            value={f.value}
            onChange={(v) =>
              set('value', v)
            }
          />

          <Field
            label="Warranty"
            value={f.warranty}
            onChange={(v) =>
              set('warranty', v)
            }
          />

          <Field
            label="Serial"
            value={f.serial}
            onChange={(v) =>
              set('serial', v)
            }
          />

          <Field
            label="Description"
            full
            value={f.description}
            onChange={(v) =>
              set('description', v)
            }
          />
        </div>

        <div className="modalActions">
          <button
            className="btn ghost"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="btn primary"
            onClick={() => onSave(f)}
          >
            <Save size={13} />
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function Archive() {
  const [items, setItems] = useState([]);

  const [q, setQ] = useState(
    new URLSearchParams(
      useLocation().search
    ).get('search') || ''
  );

  useEffect(() => {
    api(
      '/objects?search=' +
        encodeURIComponent(q)
    ).then((x) => setItems(x.objects));
  }, [q]);

  return (
    <Shell>
      <div className="container archive">
        <Link className="back" to="/">
          <ArrowLeft size={14} />
          Back
        </Link>

        <div className="pageHeader">
          <div>
            <div className="eyebrow">
              THE ARCHIVE
            </div>

            <h1>Everything remembered.</h1>
          </div>

          <Link
            className="btn primary"
            to="/objects/new"
          >
            <Plus size={14} />
            Add object
          </Link>
        </div>

        <div className="archiveSearch">
          <Search size={15} />

          <input
            value={q}
            onChange={(e) =>
              setQ(e.target.value)
            }
            placeholder="Search objects, categories or descriptions…"
          />
        </div>

        <div className="archiveGrid">
          {items.map((o) => (
            <ObjectCard
              key={o.id}
              obj={o}
            />
          ))}
        </div>
      </div>
    </Shell>
  );
}

function Incident() {
  const [objects, setObjects] = useState([]);
  const [objectId, setObjectId] = useState('');
  const [change, setChange] =
    useState('Damage / scratch');
  const [date, setDate] = useState(
    new Date()
      .toISOString()
      .slice(0, 10)
  );
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [note, setNote] = useState('');
  const [condition, setCondition] =
    useState('');
  const [detecting, setDetecting] =
    useState(false);
  const [observation, setObservation] =
    useState(null);
  const [saving, setSaving] =
    useState(false);

  const nav = useNavigate();

  useEffect(() => {
    api('/objects')
      .then((x) => {
        setObjects(x.objects);

        if (x.objects[0]) {
          setObjectId(x.objects[0].id);
        }
      })
      .catch((e) => alert(e.message));
  }, []);

  const handlePhoto = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert(
        'Image must be 10 MB or smaller.'
      );
      return;
    }

    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setObservation(null);
    setDetecting(true);

    const result =
      await detectCategoryFromImage(file);

    setObservation(result);
    setDetecting(false);
  };

  const useObservation = () => {
    if (!observation) return;

    const text = observation.label
      ? `Photo observation: ${observation.label}. Please verify the visible change before saving.`
      : 'Photo added for visual reference. Please describe the change you observed.';

    setNote((prev) =>
      prev ? prev + ' ' + text : text
    );
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!objectId || !note.trim()) {
      alert(
        'Choose an object and describe what happened.'
      );
      return;
    }

    setSaving(true);

    try {
      const d = await api(
        '/objects/' +
          objectId +
          '/events',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'incident',
            title: change,
            note: note.trim(),
            condition,
            occurredAt: date,
          }),
        }
      );

      if (photo) {
        const fd = new FormData();

        fd.append('file', photo);

        await api(
          '/objects/' +
            objectId +
            '/events/' +
            d.event.id +
            '/image',
          {
            method: 'POST',
            body: fd,
          }
        );
      }

      nav(
        '/objects/' +
          objectId +
          '?tab=timeline'
      );
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell>
      <div className="container incidentPage">
        <Link className="back" to="/">
          <ArrowLeft size={14} />
          Back
        </Link>

        <div className="eyebrow">
          INCIDENT MODE / UNDER 30 SECONDS
        </div>

        <h1>Report a change.</h1>

        <p className="pageIntro">
          Keep the record honest. AI can observe
          a photo, but you decide what becomes
          memory.
        </p>

        <form
          className="incidentCard incidentForm"
          onSubmit={submit}
        >
          <label>
            Which object?

            <select
              value={objectId}
              onChange={(e) =>
                setObjectId(e.target.value)
              }
            >
              <option value="">
                Choose an object…
              </option>

              {objects.map((o) => (
                <option
                  value={o.id}
                  key={o.id}
                >
                  {o.title}
                  {o.brand
                    ? ` · ${o.brand}`
                    : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="fieldLabel">
            What changed?
          </div>

          <div className="incidentChoices">
            {[
              'Damage / scratch',
              'Crack / physical damage',
              'Performance issue',
              'Part replaced',
              'Repair completed',
              'Lost / missing',
              'Stolen',
              'Other',
            ].map((v) => (
              <button
                type="button"
                key={v}
                className={
                  change === v
                    ? 'choice active'
                    : 'choice'
                }
                onClick={() =>
                  setChange(v)
                }
              >
                {v}
              </button>
            ))}
          </div>

          <div className="incidentMetaGrid">
            <label>
              When did it happen?

              <input
                type="date"
                value={date}
                onChange={(e) =>
                  setDate(e.target.value)
                }
              />
            </label>

            <div>
              <div className="fieldLabel">
                Photo
              </div>

              <label className="incidentPhotoDrop">
                {preview ? (
                  <>
                    <img
                      src={preview}
                      alt="Incident preview"
                    />
                    <span>
                      Replace photo
                    </span>
                  </>
                ) : (
                  <>
                    <Camera size={15} />
                    <span>
                      Add a photo
                    </span>
                  </>
                )}

                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) =>
                    handlePhoto(
                      e.target.files?.[0]
                    )
                  }
                />
              </label>
            </div>
          </div>

          {photo && (
            <div
              className={
                detecting
                  ? 'incidentAi aiWorking'
                  : 'incidentAi'
              }
            >
              {detecting ? (
                <>
                  <Sparkles size={14} />
                  AI is observing the photo…
                </>
              ) : (
                <>
                  <Sparkles size={14} />

                  <div>
                    <b>AI observation</b>

                    <span>
                      {observation?.label
                        ? `The image classifier sees “${observation.label}”.`
                        : 'The photo is stored as visual evidence.'}{' '}
                      {observation?.confidence
                        ? `${Math.round(
                            observation.confidence *
                              100
                          )}% confidence.`
                        : ''}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={useObservation}
                  >
                    Use observation
                  </button>
                </>
              )}
            </div>
          )}

          <label>
            What happened?

            <textarea
              value={note}
              onChange={(e) =>
                setNote(e.target.value)
              }
              placeholder="Small dent near the bottom-right corner after it fell from the table…"
            />
          </label>

          <label>
            Condition after change

            <select
              value={condition}
              onChange={(e) =>
                setCondition(e.target.value)
              }
            >
              <option value="">
                Keep current condition
              </option>

              <option>Excellent</option>
              <option>Good</option>
              <option>Fair</option>
              <option>Damaged</option>
              <option>Needs repair</option>
            </select>
          </label>

          <div className="safetyBoundary">
            <b>Safety boundary:</b> AI observations
            are not a diagnosis. For electrical,
            liquid or safety-critical issues, stop
            using the object and contact a qualified
            professional.
          </div>

          <div className="modalActions">
            <Link
              className="btn ghost"
              to="/"
            >
              Cancel
            </Link>

            <button
              className="btn primary"
              disabled={saving || detecting}
            >
              {saving ? (
                'Saving…'
              ) : (
                <>
                  <Save size={14} />
                  Save to timeline
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}

function SettingsPage() {
  const user = JSON.parse(
    localStorage.getItem('om_user') || '{}'
  );
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const exportJson = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('om_token');
      const res = await fetch('/api/archive/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `objectmemory-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Archive backup exported successfully!');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = async () => {
    try {
      const data = await api('/objects');
      const objects = data.objects || [];
      const headers = ['ID', 'Title', 'Brand', 'Model', 'Category', 'Condition', 'Purchase Date', 'Value', 'Warranty', 'Serial'];
      const rows = objects.map(o => [
        o.id,
        `"${(o.title || '').replace(/"/g, '""')}"`,
        `"${(o.brand || '').replace(/"/g, '""')}"`,
        `"${(o.model || '').replace(/"/g, '""')}"`,
        `"${(o.category || '').replace(/"/g, '""')}"`,
        `"${(o.condition || '').replace(/"/g, '""')}"`,
        `"${(o.purchase_date || '').replace(/"/g, '""')}"`,
        `"${(o.value || '').replace(/"/g, '""')}"`,
        `"${(o.warranty || '').replace(/"/g, '""')}"`,
        `"${(o.serial || '').replace(/"/g, '""')}"`,
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `objectmemory-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Catalog CSV exported successfully!');
    } catch (e) {
      toast.error(e.message || 'CSV export failed');
    }
  };

  const importJson = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImporting(true);
      const text = await file.text();
      const json = JSON.parse(text);
      const payload = json.data || json;
      const res = await api('/archive/import', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      toast.success(`Successfully restored ${res.imported || 0} possessions!`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <Shell>
      <div className="container settingsPage">
        <Link className="back" to="/">
          <ArrowLeft size={14} />
          Back
        </Link>

        <div className="eyebrow">
          ACCOUNT
        </div>

        <h1>Settings</h1>

        <div className="settingsCard">
          <div className="profileIcon">
            <Package size={16} />
          </div>

          <div>
            <b>{user.name}</b>
            <span>{user.email}</span>
          </div>

          <span>Local account</span>
        </div>

        <div className="backupCard">
          <div className="eyebrow">DATA PORTABILITY & BACKUP</div>
          <h2>Export & Restore Archive</h2>
          <p>
            Safely download your complete ObjectMemory vault (including all possession histories, timeline logs, and documents metadata) or restore an existing backup.
          </p>

          <div className="backupGrid">
            <div className="backupActionBox">
              <b>Export Vault (JSON)</b>
              <p>Download your entire archive in portable JSON format for safekeeping or migrating.</p>
              <button className="btn primary small" onClick={exportJson} disabled={exporting}>
                <Download size={13} />
                {exporting ? 'Exporting...' : 'Export JSON Backup'}
              </button>
            </div>

            <div className="backupActionBox">
              <b>Export Catalog (CSV)</b>
              <p>Download an inventory spreadsheet of your possessions with values and conditions.</p>
              <button className="btn ghost small" onClick={exportCsv}>
                <FileSpreadsheet size={13} />
                Export CSV Catalog
              </button>
            </div>
          </div>

          <div style={{ marginTop: '16px' }} className="backupActionBox">
            <b>Restore Archive (JSON)</b>
            <p>Upload a previously exported ObjectMemory JSON backup file to restore records.</p>
            <input
              type="file"
              accept=".json"
              onChange={importJson}
              disabled={importing}
              style={{ marginTop: '6px', fontSize: '9px' }}
            />
            {importing && <span style={{ fontSize: '8px', color: '#a54128' }}>Importing records into vault...</span>}
          </div>
        </div>

        <div className="card" style={{ marginTop: '16px' }}>
          <div className="eyebrow">
            STORAGE
          </div>

          <h2>Private local database</h2>

          <p>
            Your objects, events, documents and AI
            conversations are stored in the local
            SQLite database inside this project with WAL mode enabled.
          </p>
        </div>
      </div>
    </Shell>
  );
}

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/"
        element={
          <Require>
            <Dashboard />
          </Require>
        }
      />

      <Route
        path="/archive"
        element={
          <Require>
            <Archive />
          </Require>
        }
      />

      <Route
        path="/objects/new"
        element={
          <Require>
            <AddObject />
          </Require>
        }
      />

      <Route
        path="/objects/:id"
        element={
          <Require>
            <ObjectDetail />
          </Require>
        }
      />

      <Route
        path="/incident"
        element={
          <Require>
            <Incident />
          </Require>
        }
      />

      <Route
        path="/settings"
        element={
          <Require>
            <SettingsPage />
          </Require>
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  );
}

createRoot(
  document.getElementById('root')
).render(
  <BrowserRouter>
    <ToastProvider>
      <App />
    </ToastProvider>
  </BrowserRouter>
);