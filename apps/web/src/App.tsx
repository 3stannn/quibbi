import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useBlocker,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  CircleAlert,
  Layers2,
  LogOut,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  api,
  ApiError,
  authAction,
  safeReturnPath,
  type Card,
  type Deck,
  type Session,
} from '@/lib/api';

const Landing = lazy(() =>
  import('@/components/Landing').then((module) => ({
    default: module.Landing,
  })),
);

const SessionContext = createContext<Session>({
  user: null,
  configured: false,
});
export function Numeric({ children }: { children: ReactNode }) {
  return (
    <span className="numeric" data-font="geist-fallback">
      {children}
    </span>
  );
}
function Mark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="21"
        height="24"
        rx="5"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M28 9v15a6 6 0 0 1-6 6H10M9 11h9M9 17h5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function Brand() {
  return (
    <span className="brand">
      <span>quibbi.</span>
    </span>
  );
}
function Failure({
  message,
  retry,
  title = 'Something needs attention',
}: {
  message: string;
  retry?: () => void;
  title?: string;
}) {
  return (
    <Alert role="alert">
      <CircleAlert />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {message}
        {retry && (
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
function Loading() {
  return (
    <div
      className="loading"
      role="status"
      aria-label="Loading your study space"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
function Shell({ children }: { children: ReactNode }) {
  const { user } = useContext(SessionContext);
  const [error, setError] = useState('');
  const location = useLocation();
  const landing = !user && ['/login', '/'].includes(location.pathname);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={landing ? 'topbar landing-topbar' : 'topbar'}>
        <Link to="/library" aria-label="Quibbi library">
          <Brand />
        </Link>
        {user ? (
          <nav aria-label="Main navigation">
            <Link className="nav-link" to="/library">
              My library
            </Link>
            <span className="account-name">
              {user.name || user.email || 'Your account'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Sign out"
              onClick={() =>
                void authAction('signout', '/login').catch((e) =>
                  setError(e.message),
                )
              }
            >
              <LogOut data-icon="inline-start" />
              <span className="signout-label">Sign out</span>
            </Button>
          </nav>
        ) : landing ? (
          <nav className="landing-nav" aria-label="Main navigation">
            <a href="#a-little-different">A little different</a>
            <a href="#make-it-yours">Make it yours</a>
            <a href="#get-started" className="landing-nav-action">
              Get started
            </a>
          </nav>
        ) : (
          <span className="topbar-note">A little space to learn.</span>
        )}
      </header>
      {error && (
        <div className="main-width">
          <Failure message={error} />
        </div>
      )}
      {children}
      {!landing && (
        <footer className="footer">
          <span>Made for one more “I got it.”</span>
          <span>Your cards. Your pace.</span>
        </footer>
      )}
    </>
  );
}
export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const location = useLocation();
  const load = useCallback(() => {
    setError('');
    api<Session>('/api/session')
      .then(setSession)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  if (error)
    return (
      <SessionContext.Provider value={{ user: null, configured: false }}>
        <Shell>
          <main id="main" className="main-width page">
            <Failure
              title="Your study space is unavailable"
              message={error}
              retry={load}
            />
          </main>
        </Shell>
      </SessionContext.Provider>
    );
  if (!session)
    return (
      <Shell>
        <main id="main" className="main-width page">
          <Loading />
        </main>
      </Shell>
    );
  const protectedPage = (node: ReactNode) =>
    session.user ? (
      node
    ) : (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  return (
    <SessionContext.Provider value={session}>
      <Shell>
        <Routes>
          <Route
            path="/login"
            element={
              session.user ? (
                <Navigate
                  to={safeReturnPath(
                    new URLSearchParams(location.search).get('returnTo'),
                  )}
                  replace
                />
              ) : (
                <Login />
              )
            }
          />
          <Route path="/library" element={protectedPage(<Library />)} />
          <Route
            path="/decks/:id"
            element={protectedPage(<DeckEditor key={location.pathname} />)}
          />
          <Route
            path="/"
            element={
              <Navigate to={session.user ? '/library' : '/login'} replace />
            }
          />
          <Route
            path="*"
            element={
              <main id="main" className="main-width page">
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>This page isn’t here</EmptyTitle>
                    <EmptyDescription>
                      Head back to your library to find your decks.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button asChild>
                      <Link to="/library">Go to library</Link>
                    </Button>
                  </EmptyContent>
                </Empty>
              </main>
            }
          />
        </Routes>
      </Shell>
    </SessionContext.Provider>
  );
}
function Login() {
  const { configured } = useContext(SessionContext);
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signin() {
    setBusy(true);
    setError('');
    try {
      await authAction('signin/google', safeReturnPath(params.get('returnTo')));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Suspense
      fallback={
        <main id="main" className="main-width page">
          <Loading />
        </main>
      }
    >
      <Landing
        configured={configured}
        busy={busy}
        error={error}
        cancelled={!!params.get('error')}
        onSignin={() => void signin()}
      />
    </Suspense>
  );
}

function Library() {
  const session = useContext(SessionContext);
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const morePending = useRef(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [createError, setCreateError] = useState('');
  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const result = await api<{ decks: Deck[]; nextCursor: string | null }>(
        '/api/decks',
      );
      setDecks(result.decks);
      setCursor(result.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function more() {
    if (morePending.current || !cursor) return;
    morePending.current = true;
    setLoadingMore(true);
    setError('');
    try {
      const result = await api<{ decks: Deck[]; nextCursor: string | null }>(
        `/api/decks?cursor=${encodeURIComponent(cursor!)}`,
      );
      setDecks((old) => [
        ...new Map(
          [...old, ...result.decks].map((deck) => [deck.id, deck]),
        ).values(),
      ]);
      setCursor(result.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      morePending.current = false;
      setLoadingMore(false);
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const { deck } = await api<{ deck: Deck }>('/api/decks', {
        method: 'POST',
        headers: { 'x-csrf-token': session.csrfToken || '' },
        body: JSON.stringify({
          title: title.trim(),
          description: '',
          cards: [],
        }),
      });
      navigate(`/decks/${deck.id}`);
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }
  const filtered = decks.filter((d) =>
    `${d.title} ${d.description}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  return (
    <main id="main" className="main-width page library">
      <div className="page-heading">
        <div>
          <h1>My library</h1>
          <p className="muted">A home for the things you’re learning.</p>
        </div>
        <Button
          onClick={() => {
            setNewOpen(true);
            setCreateError('');
          }}
        >
          <Plus data-icon="inline-start" />
          New deck
        </Button>
      </div>
      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="library-toolbar">
            <Field>
              <FieldLabel className="sr-only" htmlFor="search">
                Find a deck
              </FieldLabel>
              <Input
                id="search"
                type="search"
                placeholder="Find a deck…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
            <p className="muted">
              <Numeric>{filtered.length}</Numeric>{' '}
              {filtered.length === 1 ? 'deck' : 'decks'}
              {cursor ? ' loaded' : ''}
            </p>
          </div>
          {error && <Failure message={error} retry={() => void load()} />}
          {filtered.length > 0 ? (
            <div className="deck-list">
              {filtered.map((deck) => (
                <Link
                  className="deck-row"
                  key={deck.id}
                  to={`/decks/${deck.id}`}
                >
                  <span className="deck-object">
                    <Layers2 aria-hidden="true" />
                  </span>
                  <span className="deck-row-copy">
                    <strong>{deck.title}</strong>
                    <span className="muted">
                      {deck.description || 'Your next little learning session.'}
                    </span>
                  </span>
                  <span className="deck-count">
                    <Numeric>{deck.cards.length}</Numeric>
                    <span>{deck.cards.length === 1 ? 'card' : 'cards'}</span>
                  </span>
                  <ChevronRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            !error && (
              <Empty className="library-empty">
                <EmptyHeader>
                  <span className="empty-cards" aria-hidden="true">
                    <Mark />
                  </span>
                  <EmptyTitle>
                    {query
                      ? 'No decks match that search'
                      : 'Something to learn? Make it a deck.'}
                  </EmptyTitle>
                  <EmptyDescription>
                    {query
                      ? 'Try another title or clear your search.'
                      : 'Start with a question on the front and an answer on the back. Your first card is a good place to begin.'}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  {query ? (
                    <Button variant="outline" onClick={() => setQuery('')}>
                      Clear search
                    </Button>
                  ) : (
                    <Button onClick={() => setNewOpen(true)}>
                      <Plus data-icon="inline-start" />
                      Create your first deck
                    </Button>
                  )}
                </EmptyContent>
              </Empty>
            )
          )}
          {cursor && (
            <Button
              variant="outline"
              disabled={loadingMore}
              onClick={() => void more()}
            >
              {loadingMore ? 'Loading more' : 'Load more decks'}
            </Button>
          )}
        </>
      )}
      <Dialog
        open={newOpen}
        onOpenChange={(open) => {
          if (!creating) setNewOpen(open);
        }}
      >
        <DialogContent>
          <form onSubmit={(e) => void create(e)}>
            <DialogHeader>
              <DialogTitle>A new little beginning</DialogTitle>
              <DialogDescription>
                Give your deck a name. You can add your cards next.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-6">
              <Field data-invalid={!!createError}>
                <FieldLabel htmlFor="new-title">Deck name</FieldLabel>
                <Input
                  id="new-title"
                  autoFocus
                  maxLength={120}
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Biology: the cell"
                  aria-invalid={!!createError}
                />
              </Field>
              {createError && <Failure message={createError} />}
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={creating}
                onClick={() => setNewOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !title.trim()}>
                {creating ? 'Creating…' : 'Create deck'}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
function DeckEditor() {
  const { id } = useParams();
  const session = useContext(SessionContext);
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [draft, setDraft] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [conflict, setConflict] = useState(false);
  const deleted = useRef(false);
  const dirty =
    !!deck && !!draft && JSON.stringify(deck) !== JSON.stringify(draft);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !deleted.current &&
      dirty &&
      currentLocation.pathname !== nextLocation.pathname,
  );
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await api<{ deck: Deck }>(`/api/decks/${id}`);
      setDeck(result.deck);
      setDraft(result.deck);
      setConflict(false);
      setError('');
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    setError('');
    setConflict(false);
    const snapshot = draft;
    try {
      const { deck: saved } = await api<{ deck: Deck }>(`/api/decks/${id}`, {
        method: 'PATCH',
        headers: { 'x-csrf-token': session.csrfToken || '' },
        body: JSON.stringify({
          title: snapshot.title,
          description: snapshot.description,
          revision: snapshot.revision,
          cards: snapshot.cards.map(
            ({ id, front, back, alternatives, alternativesApproved }) => ({
              id,
              front,
              back,
              alternatives,
              alternativesApproved,
            }),
          ),
        }),
      });
      setDeck(saved);
      setDraft(saved);
    } catch (e) {
      setError((e as Error).message);
      setConflict(e instanceof ApiError && e.status === 409);
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    setDeleting(true);
    setError('');
    try {
      await api(`/api/decks/${id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': session.csrfToken || '' },
      });
      deleted.current = true;
      setDeck(null);
      setDraft(null);
      setDeleteOpen(false);
      navigate('/library');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }
  function changeCard(cardId: string, change: Partial<Card>) {
    setDraft((old) =>
      old
        ? {
            ...old,
            cards: old.cards.map((card) =>
              card.id === cardId
                ? { ...card, ...change, alternativesApproved: false }
                : card,
            ),
          }
        : old,
    );
  }
  function move(index: number, by: number) {
    setDraft((old) => {
      if (!old) return old;
      const cards = [...old.cards];
      [cards[index], cards[index + by]] = [cards[index + by], cards[index]];
      return { ...old, cards };
    });
  }
  if (loading)
    return (
      <main id="main" className="main-width page">
        <Loading />
      </main>
    );
  if (loadError || !draft)
    return (
      <main id="main" className="main-width page">
        <Button variant="ghost" asChild>
          <Link to="/library">
            <ArrowLeft data-icon="inline-start" />
            Library
          </Link>
        </Button>
        <Failure
          message={loadError || 'Deck not found.'}
          retry={() => void load()}
        />
      </main>
    );
  return (
    <main id="main" className="main-width page editor">
      <div className="editor-top">
        <Button variant="ghost" asChild>
          <Link to="/library">
            <ArrowLeft data-icon="inline-start" />
            Library
          </Link>
        </Button>
        <div className="editor-save">
          <span role="status" aria-live="polite" className="save-status">
            {saving ? (
              'Saving…'
            ) : dirty ? (
              'Unsaved changes'
            ) : (
              <>
                <Check aria-hidden="true" />
                All changes saved
              </>
            )}
          </span>
          <Button
            onClick={() => void save()}
            disabled={saving || !dirty || !draft.title.trim()}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
      <div className="editor-heading">
        <h1>Your deck</h1>
        <Badge variant="secondary">Private</Badge>
      </div>
      {error && (
        <Failure
          title={
            conflict
              ? 'This deck changed elsewhere'
              : 'Your changes haven’t been saved'
          }
          message={
            conflict
              ? `${error} Your draft is still here. Copy any changes you want to keep before loading the latest version.`
              : error
          }
        />
      )}
      {conflict && (
        <Button
          variant="outline"
          onClick={() => {
            if (
              window.confirm(
                'Discard your draft and load the latest saved deck?',
              )
            )
              void load();
          }}
        >
          Load latest saved deck
        </Button>
      )}
      <fieldset disabled={saving || deleting} className="editor-fields">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="deck-title">Deck name</FieldLabel>
            <Input
              id="deck-title"
              maxLength={120}
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="deck-description">
              Description <span className="muted">(optional)</span>
            </FieldLabel>
            <Textarea
              id="deck-description"
              maxLength={1000}
              rows={2}
              value={draft.description}
              placeholder="What are you learning?"
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </Field>
        </FieldGroup>
        <Separator />
        <div className="cards-heading">
          <div>
            <h2>
              Flashcards{' '}
              <span className="muted">
                <Numeric>{draft.cards.length}</Numeric>
              </span>
            </h2>
            <p className="muted">One idea per card. Keep it simple.</p>
          </div>
          <Button
            variant="outline"
            disabled={draft.cards.length >= 200}
            onClick={() =>
              setDraft({
                ...draft,
                cards: [
                  ...draft.cards,
                  {
                    id: crypto.randomUUID(),
                    front: '',
                    back: '',
                    contentVersion: 1,
                    alternatives: [],
                    alternativesApproved: false,
                  },
                ],
              })
            }
          >
            <Plus data-icon="inline-start" />
            Add card
          </Button>
        </div>
        {draft.cards.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Your first card starts here</EmptyTitle>
              <EmptyDescription>
                Add a card, then write a question and its answer.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() =>
                  setDraft({
                    ...draft,
                    cards: [
                      {
                        id: crypto.randomUUID(),
                        front: '',
                        back: '',
                        contentVersion: 1,
                        alternatives: [],
                        alternativesApproved: false,
                      },
                    ],
                  })
                }
              >
                <Plus data-icon="inline-start" />
                Add your first card
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="editor-cards">
            {draft.cards.map((card, index) => (
              <section
                className="edit-card"
                key={card.id}
                aria-label={`Card ${index + 1}`}
              >
                <div className="edit-card-header">
                  <span>
                    Card <Numeric>{index + 1}</Numeric>
                  </span>
                  <div className="card-actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move card ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move card ${index + 1} down`}
                      disabled={index === draft.cards.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove card ${index + 1}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          cards: draft.cards.filter((c) => c.id !== card.id),
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <FieldGroup className="card-face-fields">
                  <Field>
                    <FieldLabel htmlFor={`front-${card.id}`}>Front</FieldLabel>
                    <Textarea
                      id={`front-${card.id}`}
                      maxLength={2000}
                      rows={3}
                      placeholder="A question, term, or idea"
                      value={card.front}
                      onChange={(e) =>
                        changeCard(card.id, { front: e.target.value })
                      }
                    />
                    <FieldDescription>
                      The question you want to remember.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`back-${card.id}`}>Back</FieldLabel>
                    <Textarea
                      id={`back-${card.id}`}
                      maxLength={2000}
                      rows={3}
                      placeholder="The answer, in your own words"
                      value={card.back}
                      onChange={(e) =>
                        changeCard(card.id, { back: e.target.value })
                      }
                    />
                    <FieldDescription>
                      The answer on the other side.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </section>
            ))}
          </div>
        )}
        <div className="editor-bottom">
          <span className="muted">
            Up to <Numeric>200</Numeric> cards per deck.
          </span>
          <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
            <Trash2 data-icon="inline-start" />
            Delete deck
          </Button>
        </div>
      </fieldset>
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleting) setDeleteOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete “<span className="content-text">{deck?.title}</span>”?
            </DialogTitle>
            <DialogDescription>
              This removes the deck and its cards from your library. This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <Failure message={error} />}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
              Keep deck
            </Button>
            <Button disabled={deleting} onClick={() => void remove()}>
              {deleting ? 'Deleting…' : 'Delete deck'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave your unsaved changes?</DialogTitle>
            <DialogDescription>
              Your latest edits haven’t been saved. Stay to save them, or leave
              and discard this draft.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (blocker.state === 'blocked') blocker.reset();
              }}
            >
              Keep editing
            </Button>
            <Button
              onClick={() => {
                if (blocker.state === 'blocked') blocker.proceed();
              }}
            >
              Discard and leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
