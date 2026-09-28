import { useEffect, useState } from 'preact/hooks';
import { api, isError } from '../../lib/api';
import { formatLong, formatShort, parseKey, todayKey } from '../../shared/dates';
import type { Inquiry } from '../../shared/types';
import { Icon } from '../islands/Icon';
import { useAdmin } from './context';
import { OPEN_STATUSES, SEP, eventTypeName, formatUSD, plural, spaceLabel } from './format';
import { calendarHash } from './route';
import { EmptyState, ErrorBanner, PageHeader, Skeleton, SkeletonRows, StatusBadge } from './ui';

const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

function DateTile({ date }: { date: string }) {
  const { y, m, d } = parseKey(date);
  return (
    <span class="adm-datetile" aria-hidden="true">
      <span class="adm-datetile__month">{monthShort.format(new Date(Date.UTC(y, m - 1, d)))}</span>
      <span class="adm-datetile__day">{d}</span>
    </span>
  );
}

export function TodayView() {
  const { run, stats, statsError, refreshStats, user } = useAdmin();
  const [recent, setRecent] = useState<Inquiry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The app refreshes stats on every screen change; a retry refreshes them too.
  const load = async (withStats = false) => {
    setError(null);
    if (withStats) refreshStats();
    const res = await run(api.admin.listInquiries({ status: 'all' }));
    if (isError(res)) {
      setError(res.error);
      return;
    }
    setRecent(res.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5));
  };

  useEffect(() => {
    load();
  }, []);

  const openCount = stats ? OPEN_STATUSES.reduce((sum, s) => sum + (stats.byStatus[s] ?? 0), 0) : 0;
  const tiles = stats
    ? [
        { label: 'New this week', value: String(stats.newThisWeek), note: 'Requests received this week' },
        { label: 'Open requests', value: String(openCount), note: 'New, contacted, visit, or quoted' },
        { label: 'Pipeline value', value: formatUSD(stats.pipelineValue), note: 'Estimates on open requests' },
        { label: 'Booked value', value: formatUSD(stats.bookedValue), note: 'Estimates on booked requests' },
      ]
    : null;

  const firstName = user.name.split(' ')[0];

  return (
    <div class="adm-screen">
      <PageHeader title="Today" subtitle={`${formatLong(todayKey())}. Welcome back, ${firstName}.`} />

      {(error || (statsError && !stats)) && <ErrorBanner message={error ?? statsError ?? ''} onRetry={() => load(true)} />}

      <section aria-labelledby="adm-today-stats">
        <h2 id="adm-today-stats" class="visually-hidden">
          At a glance
        </h2>
        <ul class="adm-tiles" aria-busy={tiles ? undefined : 'true'}>
          {tiles
            ? tiles.map((t) => (
                <li class="adm-tile" key={t.label}>
                  <span class="adm-tile__label">{t.label}</span>
                  <span class="adm-tile__value">{t.value}</span>
                  <span class="adm-tile__note">{t.note}</span>
                </li>
              ))
            : [0, 1, 2, 3].map((i) => (
                <li class="adm-tile" key={i} aria-hidden="true">
                  <Skeleton width="60%" height="0.9rem" />
                  <Skeleton width="45%" height="1.9rem" />
                  <Skeleton width="80%" height="0.75rem" />
                </li>
              ))}
        </ul>
      </section>

      <div class="adm-columns">
        <section class="adm-section" aria-labelledby="adm-today-upcoming">
          <div class="adm-section__head">
            <h2 id="adm-today-upcoming" class="adm-section__title">
              Upcoming booked dates
            </h2>
            <a class="btn btn--plain btn--sm adm-btn-44" href="#/calendar">
              Calendar
            </a>
          </div>
          {!stats ? (
            <SkeletonRows count={3} label="Loading booked dates" />
          ) : stats.upcomingBooked.length === 0 ? (
            <div class="list-group adm-list">
              <EmptyState icon="calendar" title="No booked dates yet">
                When you mark a request booked, its date shows up here.
              </EmptyState>
            </div>
          ) : (
            <ul class="list-group adm-list">
              {stats.upcomingBooked.slice(0, 6).map((b) => (
                <li key={`${b.date}-${b.space}-${b.label}`}>
                  <a class="list-row adm-row adm-row--link" href={calendarHash(b.date.slice(0, 7), b.date)}>
                    <DateTile date={b.date} />
                    <span class="list-row__main">
                      <span class="adm-row__title">{b.label || 'Booked'}</span>
                      <span class="adm-row__meta">
                        <span class="adm-nowrap">{formatShort(b.date)}</span>
                        {SEP}
                        <span class="adm-nowrap">{spaceLabel(b.space)}</span>
                      </span>
                    </span>
                    <Icon name="chevron-right" class="adm-row__chevron" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section class="adm-section" aria-labelledby="adm-today-recent">
          <div class="adm-section__head">
            <h2 id="adm-today-recent" class="adm-section__title">
              Newest requests
            </h2>
            <a class="btn btn--plain btn--sm adm-btn-44" href="#/inbox?status=all">
              View All
            </a>
          </div>
          {!recent ? (
            <SkeletonRows count={5} label="Loading requests" />
          ) : recent.length === 0 ? (
            <div class="list-group adm-list">
              <EmptyState icon="inbox" title="No requests yet">
                Requests from the booking form show up here.
              </EmptyState>
            </div>
          ) : (
            <ul class="list-group adm-list">
              {recent.map((i) => (
                <li key={i.id}>
                  <a class="list-row adm-row adm-row--link" href={`#/inquiry/${i.id}`}>
                    <span class="list-row__main">
                      <span class="adm-row__title">
                        {i.status === 'new' && <span class="adm-dot" aria-hidden="true" />}
                        {i.name}
                      </span>
                      <span class="adm-row__meta">
                        {eventTypeName(i.eventType, i.eventTypeOther)}
                        {SEP}
                        <span class="adm-nowrap">{formatShort(i.date)}</span>
                        {SEP}
                        <span class="adm-nowrap">{plural(i.guests, 'guest')}</span>
                      </span>
                    </span>
                    <StatusBadge status={i.status} />
                    <Icon name="chevron-right" class="adm-row__chevron" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
