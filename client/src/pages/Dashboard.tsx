import { Children, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Globe2, Leaf, ShieldCheck, type LucideIcon } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { useCountUp } from '../hooks/useCountUp';
import { fetchConservationInsights, ConservationApiError, type InsightsResponse } from '../services/conservationApi';
import { fetchIucnStats, type IucnStats } from '../services/iucnStats';
import { CATEGORY_COLORS } from '../utils/chartColors';
import { fetchTaxonImage, STATUS_LABEL, type GbifCard } from '../services/gbif';
import {
  fetchSpeciesOverview, fetchOccurrenceOverview, fetchRecordsByYear, fetchSpotlight, THREATENED,
  type SpeciesOverview, type OccurrenceOverview, type NamedCount,
} from '../services/gbifStats';
import './Dashboard.css';

/**
 * Research dashboard. Visual language adapted from a Figma Make concept
 * ("Wildlife Conservation Dashboard"): dark terminal theme, serif headings,
 * monospace numerics, KPI row + card-grid of charts.
 *
 * Data sources — nothing on this page is typed in by hand:
 *   1. GBIF (live): species counts, IUCN Red List breakdown, occurrence records.
 *   2. ml-service (live): the conservation-risk model's own training-set insights.
 *      That training set is synthetic (see ml-service/common.py) and is labelled so.
 */

// Palette comes from the site: brand accents (index.css) + the shared risk colours (utils/chartColors).
const TREND_COLORS = ['var(--accent)', 'var(--accent-2)', '#B6C1D3', '#6B8487', '#8FB2A9'];
const CHART = { primary: 'var(--accent)', secondary: 'var(--accent-2)', slate: '#6B8487', mist: '#B6C1D3', danger: 'var(--accent-bright)' };
const FEATURE_LABELS: Record<string, string> = {
  range_size_km2: 'range size (km²)',
  generation_length_years: 'generation length',
  population_trend: 'population trend',
  habitat: 'habitat',
  region: 'region',
  class: 'taxonomic class',
};
const featureLabel = (feature: string) => FEATURE_LABELS[feature] ?? feature.replace(/_/g, ' ');
const STATUS_COLORS: Record<string, string> = {
  ...CATEGORY_COLORS, DD: '#ADB5BD', EW: '#6B8487', EX: '#394C59',
};
const KINGDOM_COLORS: Record<string, string> = { Animals: CHART.primary, Plants: CHART.secondary, Fungi: CHART.mist };

const recordToChartData = (record: Record<string, number>): { name: string; count: number }[] =>
  Object.entries(record).map(([name, count]) => ({ name, count }));
const compact = (n: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const axisTick = { fontSize: 11, fill: 'var(--dash-muted)', fontFamily: 'var(--dash-mono)' };

/** Loads once; surfaces loading + a readable error so each panel group fails on its own. */
function useLoad<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: '', loading: true });
  const [attempt, setAttempt] = useState(0);
  const retry = () => { setState(s => ({ ...s, error: '', loading: true })); setAttempt(n => n + 1); };
  useEffect(() => {
    let alive = true;
    load()
      .then(data => alive && setState({ data, error: '', loading: false }))
      .catch(err => alive && setState({ data: null, error: err instanceof Error ? err.message : 'Request failed.', loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  return { ...state, retry };
}

/** Placeholder panels shown while a section loads, so the layout does not jump. */
const DashSkeleton = ({ label }: { label: string }) => (
  <div className="dash-grid dash-skeleton" role="status" aria-label={label}>
    {[2, 1, 1, 2].map((span, i) => <div key={i} className={`dash-skeleton__panel dash-skeleton__panel--${span}`} />)}
  </div>
);

const DashError = ({ message, onRetry, hint }: { message: string; onRetry: () => void; hint?: string }) => (
  <div className="dash__error" role="alert">
    <div>{message}</div>
    {hint && <div className="dash__hint">{hint}</div>}
    <button type="button" className="dash__retry" onClick={onRetry}>Try again</button>
  </div>
);

const StatNumber = ({ value }: { value: number }) => <>{useCountUp(value).toLocaleString()}</>;

interface KpiProps { label: string; value: number | string; sub: string; icon: LucideIcon; tone?: 'up' | 'flat' | 'warn'; }
const Kpi = ({ label, value, sub, icon: Icon, tone = 'up' }: KpiProps) => (
  <div className="dash-kpi">
    <div className="dash-kpi__head">
      <p className="dash-kpi__label">{label}</p>
      <span className="dash-kpi__icon"><Icon size={14} aria-hidden="true" /></span>
    </div>
    <p className="dash-kpi__value">{typeof value === 'number' ? <StatNumber value={value} /> : value}</p>
    <p className={`dash-kpi__sub${tone !== 'up' ? ` dash-kpi__sub--${tone}` : ''}`}>{sub}</p>
  </div>
);

interface PanelProps {
  title: string; subtitle?: string; badge?: string; link?: { to: string; label: string };
  span?: 2 | 3; note?: string;
  /** A recharts height in px, or 'auto' to render `children` as plain content (no ResponsiveContainer). */
  height?: number | 'auto';
  children: ReactNode;
}
const Panel = ({ title, subtitle, badge, link, span, note, height = 220, children }: PanelProps) => {
  // Only the first child is the chart that goes inside ResponsiveContainer (which recharts
  // expects to have exactly one child, at a fixed height). Anything after it — a legend list,
  // for instance — must render as a normal flowing sibling, or it gets trapped inside that
  // fixed-height box and silently overflows past the card's edge instead of adding to it.
  const [chart, ...rest] = Children.toArray(children);
  return (
    <div className={`dash-panel${span ? ` dash-span-${span}` : ''}`}>
      <div className="dash-panel__head">
        <div>
          <h2 className="dash-panel__title">{title}</h2>
          {subtitle && <p className="dash-panel__subtitle">{subtitle}</p>}
        </div>
        {badge && <span className="dash-panel__badge">{badge}</span>}
        {link && <Link to={link.to} className="dash-panel__link">{link.label} <ChevronRight size={12} aria-hidden="true" /></Link>}
      </div>
      {height === 'auto' ? chart : <ResponsiveContainer width="100%" height={height}>{chart as ReactElement}</ResponsiveContainer>}
      {rest}
      {note && <p className="dash-panel__note">{note}</p>}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tip">
      <p className="dash-tip__label">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="dash-tip__row">
          <span className="dash-tip__dot" style={{ background: p.color }} />
          <span>{p.name ?? p.dataKey}:</span>
          <span>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{p.unit}</span>
        </div>
      ))}
    </div>
  );
};

const SpotlightCard = ({ card }: { card: GbifCard }) => {
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchTaxonImage(card.key).then(url => { if (alive) setImage(url); });
    return () => { alive = false; };
  }, [card.key]);
  return (
    <Link to={`/explore/${card.key}`} className="dash-species-card">
      <div className="dash-species-card__media">
        {image ? <img src={image} alt={card.name} loading="lazy" /> : <div className="dash-species-card__placeholder" aria-hidden="true" />}
        {card.status && (
          <span className="dash-species-card__badge" style={{ background: `${STATUS_COLORS[card.status] ?? '#8fb2a9'}26`, color: STATUS_COLORS[card.status] ?? '#8fb2a9' }}>
            {card.status}
          </span>
        )}
      </div>
      <div className="dash-species-card__body">
        <h3>{card.name}</h3>
        <p>{card.scientificName}</p>
        <p className="dash-species-card__meta">{card.status ? STATUS_LABEL[card.status] ?? card.status : card.kingdom}</p>
      </div>
    </Link>
  );
};

const Legend = ({ rows, colorFor, total }: { rows: NamedCount[]; colorFor: (name: string, i: number) => string; total?: number }) => (
  <div className="dash-legend">
    {rows.map((d, i) => (
      <div key={d.name} className="dash-legend__row">
        <span className="dash-legend__key">
          <span className="dash-legend__dot" style={{ background: colorFor(d.name, i) }} />
          <span>{STATUS_LABEL[d.name] ? `${d.name} · ${STATUS_LABEL[d.name]}` : d.name}</span>
        </span>
        <span className="dash-legend__value">{d.count.toLocaleString()}{total ? <small> ({Math.round((d.count / total) * 100)}%)</small> : null}</span>
      </div>
    ))}
  </div>
);

const Dashboard = () => {
  // --- Live data from GBIF (independent requests so one failure doesn't blank the page) ---
  const species = useLoad<SpeciesOverview>(fetchSpeciesOverview);
  const occurrences = useLoad<OccurrenceOverview>(fetchOccurrenceOverview);
  const byYear = useLoad<NamedCount[]>(() => fetchRecordsByYear(1990));
  const spotlight = useLoad<GbifCard[]>(() => fetchSpotlight(6));

  const iucn = useLoad<IucnStats | null>(fetchIucnStats);

  const sp = species.data;
  const occ = occurrences.data;
  const kingdomSpeciesData = useMemo(() => (sp?.kingdoms ?? []).map(k => ({ name: k.kingdom, count: k.species })), [sp]);
  const animalIucn = sp?.kingdoms.find(k => k.kingdom === 'Animals')?.iucn ?? [];
  const plantIucn = sp?.kingdoms.find(k => k.kingdom === 'Plants')?.iucn ?? [];
  const threatenedOf = (rows: NamedCount[]) => rows.filter(r => THREATENED.has(r.name)).reduce((s, r) => s + r.count, 0);
  const totalThreatened = threatenedOf(animalIucn) + threatenedOf(plantIucn);
  const totalCritical = [...animalIucn, ...plantIucn].filter(r => r.name === 'CR').reduce((s, r) => s + r.count, 0);
  const totalAssessed = [...animalIucn, ...plantIucn].reduce((s, r) => s + r.count, 0);
  const sumCount = (rows: NamedCount[]) => rows.reduce((s, r) => s + r.count, 0);

  // IUCN Red List (server-cached). Categories shown in severity order.
  const iucnData = iucn.data;
  const IUCN_CATS = ['CR', 'EN', 'VU', 'NT', 'LC', 'DD'] as const;
  const iucnKingdomRows = iucnData
    ? Object.entries(iucnData.by_kingdom)
        .map(([name, counts]) => ({ name, ...Object.fromEntries(IUCN_CATS.map(c => [c, counts[c] ?? 0])) }))
        .filter(r => IUCN_CATS.some(c => (r as Record<string, number | string>)[c] as number > 0))
    : [];
  const iucnSystemRows = iucnData
    ? Object.entries(iucnData.by_system).map(([name, counts]) => {
        const total = Object.values(counts).reduce((s, n) => s + n, 0);
        const threatened = ['CR', 'EN', 'VU'].reduce((s, c) => s + (counts[c] ?? 0), 0);
        return { name, assessed: total, threatened, rate: total ? Math.round((threatened / total) * 100) : 0 };
      }).filter(r => r.assessed > 0)
    : [];

  // --- Live data from the Python ml-service (600-species synthetic training set) ---
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [insightsError, setInsightsError] = useState('');
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsAttempt, setInsightsAttempt] = useState(0);
  const retryInsights = () => { setInsightsError(''); setInsightsLoading(true); setInsightsAttempt(n => n + 1); };

  useEffect(() => {
    let alive = true;
    fetchConservationInsights()
      .then(data => { if (alive) setInsights(data); })
      .catch(err => { if (alive) setInsightsError(err instanceof ConservationApiError ? err.message : 'Could not load model insights.'); })
      .finally(() => { if (alive) setInsightsLoading(false); });
    return () => { alive = false; };
  }, [insightsAttempt]);

  const importanceData = insights?.feature_importance.map(f => ({ name: featureLabel(f.feature), value: Math.round(f.importance * 100) })) ?? [];
  const categoryDistributionData = insights ? recordToChartData(insights.category_distribution) : [];
  const classDistributionData = insights ? recordToChartData(insights.class_distribution) : [];
  const trendDistributionData = insights ? recordToChartData(insights.population_trend_distribution) : [];
  const rangeSizeData = insights ? recordToChartData(insights.average_range_size_by_category).map(d => ({ ...d, value: Math.round(d.count) })) : [];
  const riskByGenerationData = insights?.risk_by_generation_length.map(r => ({ name: r.bucket, rate: Math.round(r.high_risk_rate * 100), count: r.species_count })) ?? [];
  const riskByRangeData = insights?.risk_by_range_size.map(r => ({ name: r.bucket, rate: Math.round(r.high_risk_rate * 100), count: r.species_count })) ?? [];
  const categoryTotal = categoryDistributionData.reduce((s, d) => s + d.count, 0);
  const trendTotal = trendDistributionData.reduce((s, d) => s + d.count, 0);

  const gbifError = species.error || occurrences.error;
  const gbifLoading = species.loading || occurrences.loading;
  const retryGbif = () => { if (species.error) species.retry(); if (occurrences.error) occurrences.retry(); };

  return (
    <section className="page-shell dash">
      <Container>
        <div className="dash__head">
          <div>
            <p className="dash__kicker">Research</p>
            <h1 className="dash__title">What the data is telling us</h1>
            <p className="dash__lede">Live figures from the Global Biodiversity Information Facility (GBIF) and the patterns our conservation risk model has learned — computed from data, not typed in.</p>
          </div>
          <div className="dash__actions">
            <Link to="/risk-predictor" className="dash__btn">Run risk predictor</Link>
            <Link to="/ai" className="dash__btn dash__btn--solid">Open AI Explorer &rarr;</Link>
          </div>
        </div>

        {/* KPI row */}
        <div className="dash-kpis">
          <Kpi label="Accepted species (GBIF)" value={sp?.totalSpecies ?? '—'} sub="animals · plants · fungi" icon={Leaf} />
          <Kpi label="Occurrence records" value={occ ? compact(occ.totalRecords) : '—'} sub="observations & specimens" icon={Globe2} />
          <Kpi
            label="Threatened species"
            value={sp ? totalThreatened : '—'}
            sub={sp && totalAssessed ? `VU/EN/CR · ${Math.round((totalThreatened / totalAssessed) * 100)}% of IUCN-assessed` : 'IUCN Red List, via GBIF'}
            icon={AlertTriangle}
            tone={totalThreatened > 0 ? 'warn' : 'flat'}
          />
          <Kpi
            label="Critically endangered"
            value={sp ? totalCritical : '—'}
            sub="CR species, animals + plants (GBIF)"
            icon={ShieldCheck}
            tone={totalCritical > 0 ? 'warn' : 'flat'}
          />
        </div>

        {/* ================= Section 1: live GBIF data ================= */}
        <div className="dash__section">
          <div className="dash__section-head">
            <p className="dash__kicker">Live from GBIF &middot; gbif.org</p>
            <p className="dash__lede">
              Aggregates computed by GBIF over its backbone taxonomy and occurrence index. IUCN categories cover only the
              species that have been assessed, so they describe the assessed share of life, not all of it.
            </p>
          </div>

          {gbifLoading && !sp && <DashSkeleton label="Loading live GBIF statistics" />}
          {!gbifLoading && gbifError && <DashError message={gbifError} onRetry={retryGbif} />}

          {sp && (
            <div className="dash-grid">
              <Panel title="Accepted Species by Kingdom" subtitle="GBIF Backbone Taxonomy" badge="LIVE" span={2}>
                <BarChart data={kingdomSpeciesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
                  <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={compact} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Species" radius={[4, 4, 0, 0]}>
                    {kingdomSpeciesData.map(d => <Cell key={d.name} fill={KINGDOM_COLORS[d.name] ?? '#8fb2a9'} />)}
                  </Bar>
                </BarChart>
              </Panel>

              <Panel title="IUCN Status · Animals" subtitle={`${sumCount(animalIucn).toLocaleString()} assessed species`}>
                <PieChart>
                  <Pie data={animalIucn} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                    {animalIucn.map(e => <Cell key={e.name} fill={STATUS_COLORS[e.name] ?? '#8fb2a9'} stroke="transparent" />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
                <Legend rows={animalIucn} colorFor={n => STATUS_COLORS[n] ?? '#8fb2a9'} total={sumCount(animalIucn)} />
              </Panel>
            </div>
          )}

          {sp && (
            <div className="dash-grid" style={{ marginTop: '0.75rem' }}>
              <Panel title="IUCN Status · Plants" subtitle={`${sumCount(plantIucn).toLocaleString()} assessed species`}>
                <PieChart>
                  <Pie data={plantIucn} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                    {plantIucn.map(e => <Cell key={e.name} fill={STATUS_COLORS[e.name] ?? '#8fb2a9'} stroke="transparent" />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
                <Legend rows={plantIucn} colorFor={n => STATUS_COLORS[n] ?? '#8fb2a9'} total={sumCount(plantIucn)} />
              </Panel>

              {sp.animalHabitats.length > 0 && (
                <Panel title="Animal Habitats" subtitle="Accepted animal species by habitat" span={2}>
                  <BarChart data={sp.animalHabitats.map(h => ({ ...h, name: h.name.charAt(0) + h.name.slice(1).toLowerCase() }))} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" horizontal={false} />
                    <XAxis type="number" tickFormatter={compact} tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11, fill: 'var(--dash-ink-dim)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="count" name="Species" fill={CHART.slate} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </Panel>
              )}
            </div>
          )}

          {occ && (
            <div className="dash-grid" style={{ marginTop: '0.75rem' }}>
              <Panel title="Where Records Come From" subtitle="Top countries by occurrence records" span={2} height={300}>
                <BarChart data={occ.topCountries} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" horizontal={false} />
                  <XAxis type="number" tickFormatter={compact} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: 'var(--dash-ink-dim)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Records" fill={CHART.primary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </Panel>

              <Panel title="How Records Were Made" subtitle="Basis of record">
                <PieChart>
                  <Pie data={occ.basisOfRecord} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                    {occ.basisOfRecord.map((e, i) => <Cell key={e.name} fill={TREND_COLORS[i % TREND_COLORS.length]} stroke="transparent" />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
                <Legend rows={occ.basisOfRecord.slice(0, 5)} colorFor={(_, i) => TREND_COLORS[i % TREND_COLORS.length]} total={sumCount(occ.basisOfRecord)} />
              </Panel>
            </div>
          )}

          {byYear.data && byYear.data.length > 0 && (
            <div className="dash-grid" style={{ marginTop: '0.75rem' }}>
              <Panel title="Records Published per Year" subtitle="Occurrence records by event year, 1990 onward" span={3} height={240}
                note="The latest year is still filling in as datasets are published.">
                <LineChart data={byYear.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
                  <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tickFormatter={compact} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Line type="monotone" dataKey="count" name="Records" stroke={CHART.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </Panel>
            </div>
          )}

          {spotlight.data && spotlight.data.length > 0 && (
            <div className="dash-grid" style={{ marginTop: '0.75rem' }}>
              <Panel title="Critically Endangered Spotlight" subtitle={`Animals GBIF lists as Critically Endangered${totalCritical ? ` · ${totalCritical.toLocaleString()} in total` : ''}`}
                span={3} height="auto" link={{ to: '/explore', label: 'Explore species' }}>
                <div className="dash-species-grid">
                  {spotlight.data.map(card => <SpotlightCard key={card.key} card={card} />)}
                </div>
              </Panel>
            </div>
          )}
        </div>

        {/* ================= Section 1b: IUCN Red List (cached by the server) ================= */}
        {iucnData && iucnKingdomRows.length > 0 && (
          <div className="dash__section">
            <div className="dash__section-head">
              <p className="dash__kicker">IUCN Red List{iucnData.red_list_version ? ` · ${iucnData.red_list_version}` : ''}</p>
              <p className="dash__lede">
                Official Red List assessments (global scope), loaded through the IUCN API and cached by our server
                {iucnData.partial ? ' — partial sample, run the full refresh for complete totals' : ''}.
                A species can be listed in more than one system, so system totals overlap.
              </p>
            </div>
            <div className="dash-grid">
              <Panel title="Red List Categories by Kingdom" subtitle="Share of assessed species in each category (hover for counts)" span={2} height={260} badge="IUCN">
                <BarChart data={iucnKingdomRows} layout="vertical" stackOffset="expand" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: 'var(--dash-ink-dim)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  {IUCN_CATS.map(c => <Bar key={c} dataKey={c} name={STATUS_LABEL[c]} stackId="s" fill={STATUS_COLORS[c]} />)}
                </BarChart>
              </Panel>
              {iucnSystemRows.length > 0 && (
                <Panel title="Threatened Share by System" subtitle="% of assessed species that are VU / EN / CR" height={260}>
                  <BarChart data={iucnSystemRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
                    <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis unit="%" domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="rate" name="Threatened" unit="%" fill={CHART.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </Panel>
              )}
            </div>
          </div>
        )}

        {/* ================= Section 2: live ml-service model ================= */}
        <div className="dash__section">
          <div className="dash__section-head">
            <p className="dash__kicker">Powered by ml-service &middot; synthetic 600-species training set</p>
            <p className="dash__lede">
              The conservation risk model's own training data. It is a synthetic starter dataset, so treat the patterns below as
              a demonstration of what the model has learned rather than a real-world census, unlike the GBIF figures above — see{' '}
              <Link to="/risk-predictor" style={{ color: 'var(--dash-primary)' }}>the risk predictor</Link> to try it on your own inputs.
            </p>
          </div>

          {insightsLoading && <DashSkeleton label="Loading model insights" />}
          {!insightsLoading && insightsError && (
            <DashError
              message={insightsError}
              onRetry={retryInsights}
              hint={import.meta.env.DEV
                ? 'Start the ml-service: python model/train.py, then uvicorn app.main:app --reload --port 8001.'
                : 'The analysis service may be waking up. Try again in a few seconds.'}
            />
          )}

          {insights && (
            <>
              <div className="dash-grid" style={{ marginBottom: '0.75rem' }}>
                <Panel title="What Drives the Risk Prediction" subtitle="Feature importance, from the trained model" span={2} height={230}
                  link={{ to: '/risk-predictor', label: 'Run predictor' }}>
                  <BarChart data={importanceData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" horizontal={false} />
                    <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: 'var(--dash-muted)', fontFamily: 'var(--dash-mono)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: 'var(--dash-ink-dim)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} formatter={(value: number) => `${value}%`} />
                    <Bar dataKey="value" fill={CHART.primary} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </Panel>

                <Panel title="Avg. Range Size by Status" subtitle="km&sup2;, by conservation category" badge="LIVE">
                  <BarChart data={rangeSizeData} layout="vertical" margin={{ left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--dash-muted)', fontFamily: 'var(--dash-mono)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={66} tick={{ fontSize: 10, fill: 'var(--dash-ink-dim)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} formatter={(value: number) => `${value.toLocaleString()} km²`} />
                    <Bar dataKey="value" fill={CHART.slate} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </Panel>
              </div>

              <div className="dash-grid" style={{ marginBottom: '0.75rem' }}>
                <Panel title="Conservation Status" subtitle={`Distribution across ${insights.total_species} species`}>
                  <PieChart>
                    <Pie data={categoryDistributionData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                      {categoryDistributionData.map(entry => <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#8fb2a9'} stroke="transparent" />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                  <div className="dash-legend">
                    {categoryDistributionData.map(d => (
                      <div key={d.name} className="dash-legend__row">
                        <span className="dash-legend__key">
                          <span className="dash-legend__dot" style={{ background: STATUS_COLORS[d.name] ?? '#8fb2a9' }} />
                          <span>{d.name}</span>
                        </span>
                        <span className="dash-legend__value">{d.count} <small>({Math.round((d.count / categoryTotal) * 100)}%)</small></span>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Population Trend" subtitle="Across the training set">
                  <PieChart>
                    <Pie data={trendDistributionData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} startAngle={90} endAngle={-270}>
                      {trendDistributionData.map((entry, i) => <Cell key={entry.name} fill={TREND_COLORS[i % TREND_COLORS.length]} stroke="transparent" />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                  <div className="dash-legend dash-legend--row">
                    {trendDistributionData.map((d, i) => (
                      <div key={d.name} className="dash-legend__row">
                        <span className="dash-legend__key">
                          <span className="dash-legend__dot" style={{ background: TREND_COLORS[i % TREND_COLORS.length] }} />
                          <span>{d.name}</span>
                        </span>
                        <span className="dash-legend__pct" style={{ color: TREND_COLORS[i % TREND_COLORS.length] }}>
                          {Math.round((d.count / trendTotal) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Taxonomic Class" subtitle="Training-set species by class" height="auto">
                  <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={classDistributionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--dash-muted)', fontFamily: 'var(--dash-mono)' }} angle={-20} textAnchor="end" height={46} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--dash-muted)', fontFamily: 'var(--dash-mono)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="count" fill={CHART.mist} radius={[3, 3, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
                </Panel>
              </div>

              <div className="dash-grid dash-grid--2">
                <Panel
                  title="Risk Rate by Generation Length"
                  subtitle="Share classified VU / EN / CR, per bucket"
                  note="Species with longer generations show a higher share of elevated risk in this training set — slower reproduction limits recovery."
                >
                  <LineChart data={riskByGenerationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--dash-muted)', fontFamily: 'var(--dash-mono)' }} axisLine={false} tickLine={false} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--dash-muted)', fontFamily: 'var(--dash-mono)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} formatter={(value: number) => `${value}%`} />
                    <Line type="monotone" dataKey="rate" name="High-risk rate" unit="%" stroke={CHART.danger} strokeWidth={2.5} dot={{ r: 4, fill: CHART.danger, stroke: 'transparent' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </Panel>

                <Panel
                  title="Risk Rate by Range Size"
                  subtitle="Share classified VU / EN / CR, per bucket"
                  note="Smaller geographic ranges track with a higher share of elevated risk — the model has learned this from the training data, not from real IUCN records."
                >
                  <LineChart data={riskByRangeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--dash-muted)', fontFamily: 'var(--dash-mono)' }} angle={-15} textAnchor="end" height={40} axisLine={false} tickLine={false} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--dash-muted)', fontFamily: 'var(--dash-mono)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} formatter={(value: number) => `${value}%`} />
                    <Line type="monotone" dataKey="rate" name="High-risk rate" unit="%" stroke={CHART.secondary} strokeWidth={2.5} dot={{ r: 4, fill: CHART.secondary, stroke: 'transparent' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </Panel>
              </div>
            </>
          )}
        </div>
      </Container>
    </section>
  );
};

export default Dashboard;
