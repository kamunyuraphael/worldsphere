import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { CalendarDays, Copy, Heart, MessageSquare, Pencil, Plus, Receipt, Route, Trash2, WalletCards } from 'lucide-react';
import { Spinner } from 'react-bootstrap';
import { useAuth } from '../context/auth';
import { notify } from '../utils/notifications';
import {
  AccountApiError, calculateBudget, createBudget, createTrip, deleteBudget, deleteTrip, deleteTripPlan,
  duplicateBudget, duplicateTrip, getDashboard, getTripPlan, updateBudget, updateTrip, updateTripPlan,
  type BudgetInput, type DashboardData, type Expense, type SavedTrip, type TripPlan,
} from '../services/accountApi';
import FavoriteButton from '../components/FavoriteButton';
import NumberInput from '../components/account/NumberInput';
import { ConfirmDialog, Dialog } from '../components/account/Dialog';
import './AccountDashboard.css';

const FAVORITES_PREVIEW = 8;

const DEFAULT_EXPENSES: Expense[] = [
  ['accommodation', 'Accommodation'],
  ['food', 'Food'],
  ['local_transport', 'Local transportation'],
  ['long_distance', 'Flights / long-distance'],
  ['activities', 'Activities and entrance fees'],
  ['shopping', 'Shopping'],
  ['insurance', 'Insurance'],
  ['visa', 'Visa / entry costs'],
  ['contingency', 'Emergency / contingency'],
].map(([category, label]) => ({ category, label, amountMinor: 0 }));

const newBudget = (): BudgetInput => ({
  title: 'My trip budget', currency: 'KES', targetMinor: 0, travelers: 1, durationDays: 1,
  expenses: DEFAULT_EXPENSES.map(item => ({ ...item })),
});
const newTrip = (): Partial<SavedTrip> => ({ title: '', travelers: 1, notes: '', itinerary: {} });

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(minor / 100);
const dateText = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));

interface PendingConfirm {
  title: string;
  message: string;
  run: () => Promise<unknown>;
  success: string;
  failure: string;
}

const AccountDashboard = () => {
  const { user, isAuthenticated, loading, logout, favorites, toggleFavorite } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [initialised, setInitialised] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllFavorites, setShowAllFavorites] = useState(false);

  const [trip, setTrip] = useState<Partial<SavedTrip> | null>(null);
  const [budget, setBudget] = useState<(BudgetInput & { id?: number }) | null>(null);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [confirming, setConfirming] = useState(false);

  /** A 401 means the session is gone: sign out instead of showing a confusing error. */
  const failureMessage = useCallback((err: unknown, fallback: string) => {
    if (err instanceof AccountApiError && err.status === 401) {
      logout();
      return 'Your session expired. Please sign in again.';
    }
    return err instanceof Error && err.message ? err.message : fallback;
  }, [logout]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await getDashboard());
      setError('');
    } catch (err) {
      setError(failureMessage(err, 'Could not load your dashboard.'));
    } finally {
      setRefreshing(false);
      setInitialised(true);
    }
  }, [failureMessage]);

  useEffect(() => {
    if (isAuthenticated) queueMicrotask(refresh);
  }, [isAuthenticated, refresh]);

  /** Runs a mutation, reports the outcome, and refreshes quietly (no full-page spinner). */
  const mutate = useCallback(async (action: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await action();
      notify(success);
      void refresh();
      return true;
    } catch (err) {
      notify(failureMessage(err, failure), 'error');
      return false;
    }
  }, [failureMessage, refresh]);

  const askToDelete = (title: string, label: string, run: () => Promise<unknown>, success: string, failure: string) =>
    setConfirm({ title, message: `“${label}” will be permanently deleted. This can't be undone.`, run, success, failure });

  const runConfirmed = async () => {
    if (!confirm) return;
    setConfirming(true);
    await mutate(confirm.run, confirm.success, confirm.failure);
    setConfirming(false);
    setConfirm(null);
  };

  const saveTrip = async (event: FormEvent) => {
    event.preventDefault();
    if (!trip?.title?.trim()) return;
    if (trip.startDate && trip.endDate && trip.endDate < trip.startDate) {
      notify('The end date cannot be before the start date.', 'error');
      return;
    }
    const fields = {
      title: trip.title.trim(),
      destination: trip.destination?.trim() || null,
      startDate: trip.startDate || null,
      endDate: trip.endDate || null,
      travelers: trip.travelers || 1,
      notes: trip.notes || '',
    };
    const saved = await mutate(
      () => (trip.id ? updateTrip(trip.id, fields) : createTrip({ ...fields, itinerary: trip.itinerary || {} })),
      'Trip saved.', 'Could not save trip.',
    );
    if (saved) setTrip(null);
  };

  const saveBudget = async (event: FormEvent) => {
    event.preventDefault();
    if (!budget) return;
    if (!budget.title.trim()) {
      notify('Give your budget a title.', 'error');
      return;
    }
    const saved = await mutate(
      () => (budget.id ? updateBudget(budget.id, budget) : createBudget(budget)),
      'Budget plan saved.', 'Could not save budget.',
    );
    if (saved) setBudget(null);
  };

  const savePlan = async (event: FormEvent) => {
    event.preventDefault();
    if (!plan) return;
    const saved = await mutate(
      () => updateTripPlan(plan.id, { title: plan.title, destination: plan.destination, savedTripId: plan.savedTripId, planText: plan.planText }),
      'Trip plan updated.', 'Could not update plan.',
    );
    if (saved) setPlan(null);
  };

  const openPlan = async (id: number) => {
    try {
      setPlan(await getTripPlan(id));
    } catch (err) {
      notify(failureMessage(err, 'Could not open plan.'), 'error');
    }
  };

  const removeFavorite = (item: (typeof favorites)[number]) =>
    toggleFavorite(item)
      .then(() => notify('Removed from favorites.'))
      .catch(() => notify('Could not update favorite.', 'error'));

  const budgetTotals = useMemo(() => (budget ? calculateBudget(budget) : null), [budget]);

  // Order matters: settle auth first so signed-out visitors are redirected rather than left on a spinner.
  if (loading) return <LoadingState />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace state={{ from: '/profile' }} />;
  if (!initialised) return <LoadingState />;
  if (!data) {
    return (
      <section className="page-shell account-state">
        <p role="alert" className="account-state__error">{error || 'Could not load your dashboard.'}</p>
        <button type="button" className="btn-solar" onClick={() => void refresh()}>Try again</button>
      </section>
    );
  }

  const visibleFavorites = showAllFavorites ? favorites : favorites.slice(0, FAVORITES_PREVIEW);

  return (
    <section className="page-shell account-page" aria-busy={refreshing}>
      <div className="account-wrap">
        <header className="account-hero">
          <div>
            <p className="kicker">Your WorldSphere</p>
            <h1>Welcome back, {user.name.split(' ')[0]}</h1>
            <p>Trips, plans, conversations and budgets—kept together and private to your account.</p>
          </div>
          <div className="account-hero__actions">
            <button type="button" className="btn-solar" onClick={() => setTrip(newTrip())}><Plus size={17} aria-hidden="true" /> Save a trip</button>
            <button type="button" className="account-secondary" onClick={() => setBudget(newBudget())}><WalletCards size={17} aria-hidden="true" /> New budget</button>
            <button type="button" className="account-signout" onClick={logout}>Sign out</button>
          </div>
        </header>

        {refreshing && <p className="account-refreshing" role="status">Updating…</p>}
        {error && (
          <div className="account-error" role="alert">
            {error}
            <button type="button" onClick={() => void refresh()}>Retry</button>
          </div>
        )}

        <div className="account-summary">
          <div><Route aria-hidden="true" /><strong>{data.trips.length}</strong><span>Saved trips</span></div>
          <div><Heart aria-hidden="true" /><strong>{favorites.length}</strong><span>Favorites</span></div>
          <div><MessageSquare aria-hidden="true" /><strong>{data.conversations.length}</strong><span>Recent chats</span></div>
          <div><Receipt aria-hidden="true" /><strong>{data.budgets.length}</strong><span>Budgets</span></div>
        </div>

        <section className="account-section" aria-labelledby="trips-heading">
          <div className="account-section__head">
            <div><h2 id="trips-heading">Saved trips</h2><p>Destinations and itineraries you can edit and reopen.</p></div>
            <button type="button" onClick={() => setTrip(newTrip())}><Plus size={16} aria-hidden="true" /> Add trip</button>
          </div>
          {!data.trips.length ? (
            <Empty text="No saved trips yet." action="Browse destinations" to="/tourism" />
          ) : (
            <div className="workspace-grid">
              {data.trips.map(item => (
                <article className="workspace-item" key={item.id}>
                  <CalendarDays aria-hidden="true" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.destination || 'Flexible destination'} · {item.travelers} traveler{item.travelers === 1 ? '' : 's'}</p>
                    {item.startDate && <small>{item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}</small>}
                  </div>
                  <div className="workspace-actions">
                    <FavoriteButton fav={{ key: String(item.id), source: 'trip', name: item.title }} />
                    <button type="button" onClick={() => setTrip(item)} aria-label={`Edit ${item.title}`}><Pencil size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => void mutate(() => duplicateTrip(item.id), 'Trip duplicated.', 'Could not duplicate trip.')} aria-label={`Duplicate ${item.title}`}><Copy size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => askToDelete('Delete trip?', item.title, () => deleteTrip(item.id), 'Trip deleted.', 'Could not delete trip.')} aria-label={`Delete ${item.title}`}><Trash2 size={15} aria-hidden="true" /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="account-columns">
          <section className="account-section" aria-labelledby="favorites-heading">
            <div className="account-section__head">
              <div><h2 id="favorites-heading">Favorites</h2><p>Destinations, attractions, species and plans.</p></div>
            </div>
            {!favorites.length ? (
              <Empty text="Nothing favorited yet." action="Explore WorldSphere" to="/explore" />
            ) : (
              <>
                <ul className="account-list">
                  {visibleFavorites.map(item => (
                    <li key={`${item.source}:${item.key}`}>
                      <Heart className="favorite-red" fill="currentColor" aria-hidden="true" />
                      <div><strong>{item.name}</strong><span>{item.source.replace('_', ' ')}</span></div>
                      <button type="button" onClick={() => void removeFavorite(item)} aria-label={`Remove ${item.name} from favorites`}>Remove</button>
                    </li>
                  ))}
                </ul>
                {favorites.length > FAVORITES_PREVIEW && (
                  <button type="button" className="account-more" aria-expanded={showAllFavorites} onClick={() => setShowAllFavorites(value => !value)}>
                    {showAllFavorites ? 'Show fewer' : `View all ${favorites.length} favorites`}
                  </button>
                )}
              </>
            )}
          </section>

          <section className="account-section" aria-labelledby="chats-heading">
            <div className="account-section__head">
              <div><h2 id="chats-heading">Recent AI conversations</h2><p>Continue where you left off.</p></div>
              <Link to="/ai">New chat</Link>
            </div>
            {!data.conversations.length ? (
              <Empty text="No saved conversations." action="Ask WorldSphere AI" to="/ai" />
            ) : (
              <ul className="account-list">
                {data.conversations.map(item => (
                  <li key={item.id}>
                    <MessageSquare aria-hidden="true" />
                    <div>
                      <strong>{item.title || 'Untitled conversation'}</strong>
                      <span>{item.preview || item.assistantType.replace('_', ' ')} · {dateText(item.updatedAt)}</span>
                    </div>
                    <Link to={`${item.assistantType === 'TOUR_GUIDE' ? '/ai/tour-guide' : '/ai/species'}?conversation=${encodeURIComponent(item.id)}`}>Continue</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="account-section" aria-labelledby="plans-heading">
          <div className="account-section__head">
            <div><h2 id="plans-heading">Personalized trip plans</h2><p>AI-generated plans remain separate from trips and favorites.</p></div>
            <Link to="/ai/tour-guide">Plan with AI</Link>
          </div>
          {!data.plans.length ? (
            <Empty text="No personalized plan saved yet." action="Build a plan" to="/ai/tour-guide" />
          ) : (
            <div className="workspace-grid">
              {data.plans.map(item => (
                <article className="workspace-item" key={item.id}>
                  <Route aria-hidden="true" />
                  <div><h3>{item.title}</h3><p>{item.destination}</p><small>Updated {dateText(item.updatedAt)}</small></div>
                  <div className="workspace-actions">
                    <FavoriteButton fav={{ key: String(item.id), source: 'trip_plan', name: item.title }} />
                    <button type="button" onClick={() => void openPlan(item.id)} aria-label={`Open ${item.title}`}><Pencil size={15} aria-hidden="true" /></button>
                    {item.conversationId && (
                      <Link aria-label={`Discuss ${item.title}`} to={`/ai/tour-guide?conversation=${item.conversationId}`}><MessageSquare size={15} aria-hidden="true" /></Link>
                    )}
                    <button type="button" onClick={() => askToDelete('Delete trip plan?', item.title, () => deleteTripPlan(item.id), 'Trip plan deleted.', 'Could not delete plan.')} aria-label={`Delete ${item.title}`}><Trash2 size={15} aria-hidden="true" /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="account-section" aria-labelledby="budgets-heading">
          <div className="account-section__head">
            <div><h2 id="budgets-heading">Budget plans</h2><p>All money is stored as integer minor units for accurate totals.</p></div>
            <button type="button" onClick={() => setBudget(newBudget())}><Plus size={16} aria-hidden="true" /> Add budget</button>
          </div>
          {!data.budgets.length ? (
            <Empty text="No budget plan yet." action="Create one" onClick={() => setBudget(newBudget())} />
          ) : (
            <div className="workspace-grid">
              {data.budgets.map(item => (
                <article className="workspace-item" key={item.id}>
                  <WalletCards aria-hidden="true" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{money(item.totalMinor, item.currency)} total</p>
                    <small className={item.remainingMinor < 0 ? 'over-budget' : ''}>
                      {item.remainingMinor < 0
                        ? `${money(-item.remainingMinor, item.currency)} over budget`
                        : `${money(item.remainingMinor, item.currency)} remaining`}
                    </small>
                  </div>
                  <div className="workspace-actions">
                    <button type="button" onClick={() => setBudget({ ...item, expenses: item.expenses.map(expense => ({ ...expense })) })} aria-label={`Edit ${item.title}`}><Pencil size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => void mutate(() => duplicateBudget(item.id), 'Budget duplicated.', 'Could not duplicate budget.')} aria-label={`Duplicate ${item.title}`}><Copy size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => askToDelete('Delete budget?', item.title, () => deleteBudget(item.id), 'Budget deleted.', 'Could not delete budget.')} aria-label={`Delete ${item.title}`}><Trash2 size={15} aria-hidden="true" /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="account-section" aria-labelledby="activity-heading">
          <div className="account-section__head">
            <div><h2 id="activity-heading">Recent activity</h2><p>Your latest account actions, retained safely in PostgreSQL.</p></div>
          </div>
          {!data.activity.length ? (
            <p className="account-empty">Activity will appear as you explore and save.</p>
          ) : (
            <ol className="activity-list">
              {data.activity.map(item => (
                <li key={item.id}>
                  <span aria-hidden="true" />
                  <div><strong>{item.label}</strong><small>{item.eventType.replaceAll('_', ' ')} · {dateText(item.createdAt)}</small></div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {trip && (
        <Dialog title={trip.id ? 'Edit trip' : 'Save a trip'} onClose={() => setTrip(null)} onSubmit={saveTrip}>
          <label>Title<input required maxLength={160} value={trip.title || ''} onChange={e => setTrip({ ...trip, title: e.target.value })} /></label>
          <label>Destination<input maxLength={200} value={trip.destination || ''} onChange={e => setTrip({ ...trip, destination: e.target.value })} /></label>
          <div className="account-form-row">
            <label>Start date<input type="date" value={trip.startDate || ''} onChange={e => setTrip({ ...trip, startDate: e.target.value })} /></label>
            <label>End date<input type="date" min={trip.startDate || undefined} value={trip.endDate || ''} onChange={e => setTrip({ ...trip, endDate: e.target.value })} /></label>
            <label>Travelers<NumberInput min={1} max={100} value={trip.travelers || 1} onValueChange={value => setTrip({ ...trip, travelers: value })} /></label>
          </div>
          <label>Notes<textarea maxLength={5000} rows={4} value={trip.notes || ''} onChange={e => setTrip({ ...trip, notes: e.target.value })} /></label>
          <div className="dialog-actions">
            <button type="button" onClick={() => setTrip(null)}>Cancel</button>
            <button type="submit" className="btn-solar">Save trip</button>
          </div>
        </Dialog>
      )}

      {plan && (
        <Dialog title="Reopen personalized plan" wide onClose={() => setPlan(null)} onSubmit={savePlan}>
          <label>Title<input required maxLength={160} value={plan.title} onChange={e => setPlan({ ...plan, title: e.target.value })} /></label>
          <label>Destination<input required maxLength={200} value={plan.destination} onChange={e => setPlan({ ...plan, destination: e.target.value })} /></label>
          <label>Associate saved trip
            <select value={plan.savedTripId || ''} onChange={e => setPlan({ ...plan, savedTripId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">None</option>
              {data.trips.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label>Plan details<textarea maxLength={50000} rows={14} value={plan.planText} onChange={e => setPlan({ ...plan, planText: e.target.value })} /></label>
          <p className="account-safe-note">AI plan text is displayed as plain text and is never executed as HTML.</p>
          <div className="dialog-actions">
            <button type="button" onClick={() => setPlan(null)}>Cancel</button>
            {plan.conversationId && <Link to={`/ai/tour-guide?conversation=${plan.conversationId}`}>Discuss with AI</Link>}
            <button type="submit" className="btn-solar">Save plan</button>
          </div>
        </Dialog>
      )}

      {budget && (
        <Dialog title={budget.id ? 'Edit budget' : 'Create budget'} wide onClose={() => setBudget(null)} onSubmit={saveBudget}>
          <div className="account-form-row">
            <label>Title<input required maxLength={160} value={budget.title} onChange={e => setBudget({ ...budget, title: e.target.value })} /></label>
            <label>Currency
              <select value={budget.currency} onChange={e => setBudget({ ...budget, currency: e.target.value })}>
                <option>KES</option><option>USD</option><option>EUR</option><option>GBP</option>
              </select>
            </label>
            <label>Target budget<NumberInput money value={budget.targetMinor} onValueChange={value => setBudget({ ...budget, targetMinor: value })} /></label>
            <label>Travelers<NumberInput min={1} max={100} value={budget.travelers} onValueChange={value => setBudget({ ...budget, travelers: value })} /></label>
            <label>Days<NumberInput min={1} max={365} value={budget.durationDays} onValueChange={value => setBudget({ ...budget, durationDays: value })} /></label>
            <label>Associate trip
              <select value={budget.savedTripId || ''} onChange={e => setBudget({ ...budget, savedTripId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">None</option>
                {data.trips.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
          </div>

          <div className="expense-list">
            {budget.expenses.map((item, index) => (
              <div key={`${item.category}:${index}`}>
                <input
                  aria-label="Expense label" maxLength={120} value={item.label}
                  onChange={e => setBudget({ ...budget, expenses: budget.expenses.map((x, i) => (i === index ? { ...x, label: e.target.value } : x)) })}
                />
                <NumberInput
                  money aria-label={`${item.label} amount`} value={item.amountMinor}
                  onValueChange={value => setBudget({ ...budget, expenses: budget.expenses.map((x, i) => (i === index ? { ...x, amountMinor: value } : x)) })}
                />
                {item.category === 'custom' && (
                  <button type="button" aria-label={`Remove ${item.label}`} onClick={() => setBudget({ ...budget, expenses: budget.expenses.filter((_, i) => i !== index) })}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="account-add-custom" onClick={() => setBudget({ ...budget, expenses: [...budget.expenses, { category: 'custom', label: 'Custom expense', amountMinor: 0 }] })}>
            <Plus size={15} aria-hidden="true" /> Custom category
          </button>

          {budgetTotals && (
            <div className="budget-totals" aria-live="polite">
              <div><span>Total</span><strong>{money(budgetTotals.totalMinor, budget.currency)}</strong></div>
              <div><span>Per traveler</span><strong>{money(budgetTotals.perTravelerMinor, budget.currency)}</strong></div>
              <div><span>Per day</span><strong>{money(budgetTotals.perDayMinor, budget.currency)}</strong></div>
              <div className={budgetTotals.remainingMinor < 0 ? 'over-budget' : ''}>
                <span>{budgetTotals.remainingMinor < 0 ? 'Over budget' : 'Remaining'}</span>
                <strong>{money(Math.abs(budgetTotals.remainingMinor), budget.currency)}</strong>
              </div>
            </div>
          )}
          <div className="dialog-actions">
            <button type="button" onClick={() => setBudget(null)}>Cancel</button>
            <button type="submit" className="btn-solar">Save budget</button>
          </div>
        </Dialog>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          busy={confirming}
          onConfirm={() => void runConfirmed()}
          onCancel={() => !confirming && setConfirm(null)}
        />
      )}
    </section>
  );
};

const LoadingState = () => (
  <section className="page-shell account-state" role="status">
    <Spinner animation="border" />
    <p>Loading your WorldSphere workspace…</p>
  </section>
);

const Empty = ({ text, action, to, onClick }: { text: string; action: string; to?: string; onClick?: () => void }) => (
  <div className="account-empty">
    <p>{text}</p>
    {to ? <Link to={to}>{action}</Link> : <button type="button" onClick={onClick}>{action}</button>}
  </div>
);

export default AccountDashboard;
