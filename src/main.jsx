import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import * as mobilenet from '@tensorflow-models/mobilenet';
import '@tensorflow/tfjs';
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
          <span className="pill">
            USER PROVIDED
          </span>

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

  if (
    /warrant|expire|expiry|renew/.test(q)
  ) {
    if (!warranty.length) {
      return {
        title: 'No warranty deadline recorded.',
        text:
          'I could not find an upcoming warranty expiry in your current archive. Add warranty dates to your objects and I’ll surface them here.',
      };
    }

    const top = warranty
      .slice(0, 4)
      .map(
        (o) =>
          `${o.title} — ${
            o.days === 0
              ? 'today'
              : `in ${o.days} day${
                  o.days === 1 ? '' : 's'
                }`
          } (${formatMemoryDate(o.warranty)})`
      )
      .join(' · ');

    return {
      title: 'Warranty deadlines',
      text: top,
    };
  }

  if (
    /damage|damaged|scratch|crack|incident|repair|broke|broken|change/.test(
      q
    )
  ) {
    if (!damage.length) {
      return {
        title: 'No recent damage recorded.',
        text:
          'There are no incident or damage events in the current archive.',
      };
    }

    const top = damage
      .slice(0, 4)
      .map(
        (e) =>
          `${e.object_title}: ${e.title}${
            e.note ? ` — ${e.note}` : ''
          } (${formatMemoryDate(
            e.occurred_at || e.created_at
          )})`
      )
      .join(' · ');

    return {
      title: 'Recent changes & incidents',
      text: top,
    };
  }

  if (
    /new object|new arrival|arriv|added|recent object/.test(
      q
    )
  ) {
    if (!arrivals.length) {
      return {
        title: 'No recent arrivals recorded.',
        text:
          'Add an object and ObjectMemory will keep its arrival in the living record.',
      };
    }

    const top = arrivals
      .slice(0, 4)
      .map(
        (e) =>
          `${e.object_title} — ${formatMemoryDate(
            e.created_at
          )}`
      )
      .join(' · ');

    return {
      title: 'Recent arrivals',
      text: top,
    };
  }

  if (
    /condition|state|health|needs attention|attention|need/.test(
      q
    )
  ) {
    if (!attention.length) {
      return {
        title: 'Nothing currently flagged.',
        text:
          'No object is marked Fair, Damaged, or Needs repair.',
      };
    }

    return {
      title: 'Objects needing attention',
      text: attention
        .map(
          (o) => `${o.title} — ${o.condition}`
        )
        .join(' · '),
    };
  }

  if (
    /document|receipt|invoice|paper/.test(q)
  ) {
    return {
      title: 'Your archive documents',
      text: `You currently have ${
        documentCount || 0
      } recorded document(s) across ${
        objects.length
      } object(s).`,
    };
  }

  if (
    /how many|count|many object|own/.test(q)
  ) {
    return {
      title: 'Your object archive',
      text: `You currently remember ${
        objects.length
      } object${
        objects.length === 1 ? '' : 's'
      } in ObjectMemory.`,
    };
  }

  return {
    title: 'Your archive at a glance',
    text: `${objects.length} object${
      objects.length === 1 ? '' : 's'
    }, ${damage.length} recent incident${
      damage.length === 1 ? '' : 's'
    }, and ${warranty.length} upcoming warranty deadline${
      warranty.length === 1 ? '' : 's'
    } are currently visible to me.`,
  };
}

function DashboardMemory({
  objects,
  recent,
  documentCount,
}) {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState(null);

  const suggestions = [
    'Which warranties expire soon?',
    'What damage was recorded recently?',
    'What objects arrived recently?',
    'What needs attention?',
  ];

  const ask = (value) => {
    const question = value || q;

    setQ(question);

    setAnswer(
      buildMemoryAnswer(
        question,
        objects,
        recent,
        documentCount
      )
    );
  };

  return (
    <div className="dashboardMemory">
      <div className="dashboardMemoryHead">
        <div>
          <div className="eyebrow">
            ASK YOUR MEMORY
          </div>

          <h3>A question away.</h3>

          <p>
            Ask across your entire archive —
            warranties, incidents, arrivals,
            condition, repairs, documents and more.
          </p>
        </div>

        <span className="memoryQuestionMark">?</span>
      </div>

      <div className="dashboardAskInput">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' && ask()
          }
          placeholder="Which warranties expire soon?"
        />

        <button onClick={() => ask()}>
          <MessageCircle size={15} />
          Ask ObjectMemory
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="memorySuggestions">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {answer && (
        <div className="memoryAnswer">
          <div>
            <Sparkles size={14} />
            <b>{answer.title}</b>
          </div>

          <p>{answer.text}</p>
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

          <Stat
            icon={<LockKeyhole size={14} />}
            value="100%"
            label="Private by design"
          />
        </div>

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

const CATEGORY_RULES = {
  Car: [
    'car',
    'sports car',
    'convertible',
    'minivan',
    'limousine',
    'jeep',
    'pickup',
    'racer',
    'cab',
    'taxi',
    'vehicle',
    'automobile',
  ],

  Computer: [
    'laptop',
    'notebook',
    'desktop computer',
    'computer keyboard',
    'monitor',
    'screen',
  ],

  Phone: [
    'cellular telephone',
    'mobile phone',
    'telephone',
  ],

  Camera: [
    'camera',
    'digital camera',
    'reflex camera',
    'lens cap',
  ],

  Furniture: [
    'chair',
    'couch',
    'sofa',
    'desk',
    'table',
    'bookcase',
    'wardrobe',
    'cabinet',
    'studio couch',
  ],

  Jewellery: [
    'necklace',
    'chain',
    'ring',
    'earring',
    'bracelet',
    'jewelry',
  ],

  Document: [
    'envelope',
    'menu',
    'book jacket',
    'notebook',
  ],
};

let visionModelPromise = null;

async function detectCategoryFromImage(file) {
  if (!file) {
    return {
      category: 'Other',
      label: '',
      confidence: 0,
    };
  }

  try {
    visionModelPromise ||= mobilenet.load({
      version: 2,
      alpha: 1.0,
    });

    const model = await visionModelPromise;

    const url = URL.createObjectURL(file);

    const img = new Image();
    img.src = url;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const predictions = await model.classify(
      img,
      5
    );

    URL.revokeObjectURL(url);

    for (const p of predictions) {
      const label = p.className.toLowerCase();

      for (const [
        category,
        terms,
      ] of Object.entries(CATEGORY_RULES)) {
        if (
          terms.some((term) =>
            label.includes(term)
          )
        ) {
          return {
            category,
            label: p.className,
            confidence: p.probability,
          };
        }
      }
    }

    return {
      category: 'Other',
      label:
        predictions[0]?.className || '',
      confidence:
        predictions[0]?.probability || 0,
    };
  } catch (err) {
    console.warn(
      'Local image classification unavailable:',
      err
    );

    return {
      category: 'Other',
      label: '',
      confidence: 0,
    };
  }
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

  const [obj, setObj] = useState(null);

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

  const send = async () => {
    if (!message.trim() || busy) return;

    setBusy(true);

    try {
      const d = await api(
        '/objects/' + id + '/chat',
        {
          method: 'POST',
          body: JSON.stringify({
            message,
          }),
        }
      );

      setMessages(d.messages);
      setMessage('');
    } catch (e) {
      alert(e.message);
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
              <span className="pill">
                USER PROVIDED
              </span>

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
          <div className="singleTab">
            <div className="card market">
              <div className="eyebrow">
                AROUND YOUR OBJECT
              </div>

              <h2>Market memory</h2>

              <p>
                Live market data is not connected
                in this local build. Your recorded
                value is stored exactly as entered
                and is not presented as a live
                valuation.
              </p>
            </div>
          </div>
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
  return (
    <div className="singleTab">
      <div className="card aiCard">
        <div className="eyebrow">
          OBJECTMEMORY ASSISTANT
        </div>

        <h2>Talk to your object.</h2>

        <p>
          I answer from the information stored
          for this object. No external AI service
          is required for the local build.
        </p>

        <div className="chat">
          {!messages.length && (
            <div className="answer">
              <b>Assistant</b>

              <span>
                Ask me about {obj.title}:
                condition, damage, warranty,
                documents, purchase date, value or
                history.
              </span>
            </div>
          )}

          {messages.map((m) => (
            <div
              className={
                m.role === 'user'
                  ? 'msg userMsg'
                  : 'msg'
              }
              key={m.id}
            >
              <b>
                {m.role === 'user'
                  ? 'You'
                  : 'ObjectMemory'}
              </b>

              <span>{m.content}</span>
            </div>
          ))}
        </div>

        <div className="qaBox">
          <input
            value={message}
            onChange={(e) =>
              setMessage(e.target.value)
            }
            onKeyDown={(e) =>
              e.key === 'Enter' && send()
            }
            placeholder="Ask about this object…"
          />

          <button
            className="btn primary"
            onClick={send}
            disabled={busy}
          >
            <Send size={13} />
            {busy ? 'Thinking…' : 'Ask'}
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

        <div className="card">
          <div className="eyebrow">
            STORAGE
          </div>

          <h2>Private local database</h2>

          <p>
            Your objects, events, documents and AI
            conversations are stored in the local
            SQLite database inside this project.
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
    <App />
  </BrowserRouter>
);