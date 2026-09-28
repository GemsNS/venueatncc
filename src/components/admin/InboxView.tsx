import { useEffect, useRef, useState } from 'preact/hooks';
import { api, isError } from '../../lib/api';
import { formatShort, todayKey } from '../../shared/dates';
import { INQUIRY_STATUSES, type Inquiry, type InquiryStatus } from '../../shared/types';
import { Icon } from '../islands/Icon';
import { useAdmin } from './context';
import { ELLIPSIS, LDQUO, RDQUO, SEP, eventTypeName, formatUSD, plural, spaceLabel, statusLabel } from './format';
import { inboxHash, type InboxFilter } from './route';
import { EmptyState, ErrorBanner, PageHeader, SegmentedRadio, SkeletonRows, StatusBadge } from './ui';

type Primary = 'open' | 'booked' | 'all';
const PRIMARY: { id: Primary; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'booked', label: 'Booked' },
  { id: 'all', label: 'All' },
];
const OTHER: { id: InquiryStatus; label: string }[] = INQUIRY_STATUSES.filter((s) => s.id !== 'booked');

function isPrimary(f: InboxFilter): f is Primary {
  return f === 'open' || f === 'booked' || f === 'all';
}

function focusRow(list: HTMLElement | null, index: number) {
  const links = list ? Array.from(list.querySelectorAll<HTMLAnchorElement>('a.adm-row')) : [];
  if (links.length === 0) return;
  links[Math.max(0, Math.min(links.length - 1, index))].focus();
}

/** "More" menu for the statuses that are not in the segmented control. */
function StatusMenu({ value, onPick }: { value: InboxFilter; onPick: (s: InquiryStatus) => void }) {
  const [open, setOpen] = useState(false);
  const [alignEnd, setAlignEnd] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const active = isPrimary(value) ? null : value;

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);

  useEffect(() => {
    if (!open) return;
    const list = items();
    const checked = list.findIndex((el) => el.getAttribute('aria-checked') === 'true');
    list[checked >= 0 ? checked : 0]?.focus();
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Open toward whichever side has room (the menu is about 240px wide).
  const measure = () => {
    const r = button.current?.getBoundingClientRect();
    if (r) setAlignEnd(r.left + 240 > document.documentElement.clientWidth - 8);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const onMenuKey = (e: KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <div class="adm-menuwrap" ref={wrap}>
      <button
        ref={button}
        type="button"
        class={`btn ${active ? 'btn--tinted' : 'btn--gray'} adm-menubtn`}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls="adm-status-menu"
        onClick={() => {
          measure();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            measure();
            setOpen(true);
          }
        }}
      >
        <span>{active ? statusLabel(active) : 'More'}</span>
        <Icon name="chevron-down" />
        {active && <span class="visually-hidden">, status filter</span>}
      </button>
      {open && (
        <ul id="adm-status-menu" class={`adm-menu glass${alignEnd ? ' adm-menu--end' : ''}`} role="menu" aria-label="Filter by status" ref={menu} onKeyDown={onMenuKey}>
          {OTHER.map((s) => (
            <li
              key={s.id}
              role="menuitemradio"
              aria-checked={active === s.id ? 'true' : 'false'}
              tabIndex={-1}
              class="adm-menu__item"
              onClick={() => {
                onPick(s.id);
                close();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick(s.id);
                  close();
                }
              }}
            >
              <span class="adm-menu__check" aria-hidden="true">
                {active === s.id && <Icon name="check" />}
              </span>
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InboxView({ status, q }: { status: InboxFilter; q: string }) {
  const { run, navigate, toast } = useAdmin();
  const [rows, setRows] = useState<Inquiry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(q);
  const [exporting, setExporting] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  // Keep the field in step when the address changes from elsewhere (for example the sidebar link).
  useEffect(() => {
    setSearch((cur) => (cur.trim() === q.trim() ? cur : q));
  }, [q]);

  const load = async () => {
    const id = ++reqId.current;
    setError(null);
    setRows(null);
    const res = await run(api.admin.listInquiries({ status, q: q.trim() || undefined }));
    if (id !== reqId.current) return;
    if (isError(res)) {
      setError(res.error);
      setRows([]);
      return;
    }
    setRows(res);
  };

  useEffect(() => {
    load();
  }, [status, q]);

  // Debounce typing into the address (replace, so Back is not flooded).
  useEffect(() => {
    if (search.trim() === q.trim()) return;
    const t = window.setTimeout(() => navigate(inboxHash(status, search), true), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const setFilter = (next: InboxFilter) => navigate(inboxHash(next, search), true);

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    const res = await run(api.admin.exportCsv());
    setExporting(false);
    if (isError(res)) {
      toast(res.error, 'error');
      return;
    }
    const url = URL.createObjectURL(res);
    const a = document.createElement('a');
    a.href = url;
    a.download = `venue-requests-${todayKey()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('CSV downloaded.');
  };

  const onListKey = (e: KeyboardEvent) => {
    const links = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>('a.adm-row') ?? []);
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusRow(listRef.current, i + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (i === 0) searchRef.current?.focus();
      else focusRow(listRef.current, i - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusRow(listRef.current, 0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusRow(listRef.current, links.length - 1);
    }
  };

  const filterName = isPrimary(status) ? PRIMARY.find((p) => p.id === status)!.label.toLowerCase() : statusLabel(status).toLowerCase();
  const searching = q.trim().length > 0;

  return (
    <div class="adm-screen">
      <PageHeader title="Inbox" subtitle="Booking requests from the website.">
        <button type="button" class="btn btn--gray" onClick={exportCsv} disabled={exporting} aria-busy={exporting ? 'true' : undefined}>
          <Icon name="download" />
          {exporting ? `Exporting${ELLIPSIS}` : 'Export CSV'}
        </button>
      </PageHeader>

      <div class="adm-toolbar">
        <div class="adm-toolbar__filters">
          <SegmentedRadio label="Show" options={PRIMARY} value={isPrimary(status) ? status : null} onChange={setFilter} />
          <StatusMenu value={status} onPick={setFilter} />
        </div>
        <div class="adm-search">
          <label for="adm-search" class="visually-hidden">
            Search requests
          </label>
          <Icon name="search" class="adm-search__icon" />
          <input
            ref={searchRef}
            id="adm-search"
            class="input adm-search__input"
            type="search"
            placeholder="Name, email, phone, or reference"
            autocomplete="off"
            spellcheck={false}
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusRow(listRef.current, 0);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                navigate(inboxHash(status, search), true);
              }
            }}
          />
          {search && (
            <button
              type="button"
              class="adm-iconbtn adm-search__clear"
              aria-label="Clear Search"
              onClick={() => {
                setSearch('');
                navigate(inboxHash(status, ''), true);
                searchRef.current?.focus();
              }}
            >
              <Icon name="x" />
            </button>
          )}
        </div>
      </div>

      <p class="adm-count-line" aria-live="polite">
        {rows && !error ? `${plural(rows.length, 'request')}${searching ? ` matching ${LDQUO}${q.trim()}${RDQUO}` : ''}` : ''}
      </p>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {!rows ? (
        <SkeletonRows count={6} label="Loading requests" />
      ) : rows.length === 0 ? (
        !error && (
          <div class="list-group adm-list">
            {searching ? (
              <EmptyState
                icon="search"
                title="No matches"
                action={
                  <button
                    type="button"
                    class="btn btn--gray"
                    onClick={() => {
                      setSearch('');
                      navigate(inboxHash(status, ''), true);
                    }}
                  >
                    Clear Search
                  </button>
                }
              >
                No {status === 'all' ? '' : `${filterName} `}requests match {LDQUO}
                {q.trim()}
                {RDQUO}.
              </EmptyState>
            ) : (
              <EmptyState icon="inbox" title={status === 'all' ? 'No requests yet' : `No ${filterName} requests`}>
                {status === 'all' ? 'Requests from the booking form show up here.' : 'Nothing to show for this filter right now.'}
              </EmptyState>
            )}
          </div>
        )
      ) : (
        <div class="adm-table">
          <div class="adm-table__head" aria-hidden="true">
            <span>Request</span>
            <span>Event date</span>
            <span>Guests</span>
            <span>Space</span>
            <span class="adm-num">Estimate</span>
            <span>Status</span>
            <span />
          </div>
          <ul class="list-group adm-list adm-inbox" ref={listRef} onKeyDown={onListKey} aria-label="Requests">
            {rows.map((i) => (
              <li key={i.id}>
                <a class="list-row adm-row adm-row--link adm-inbox__row" href={`#/inquiry/${i.id}`}>
                  <span class="adm-inbox__who">
                    <span class="adm-row__title">
                      {i.status === 'new' && <span class="adm-dot" aria-hidden="true" />}
                      {i.name}
                    </span>
                    <span class="adm-row__meta">{eventTypeName(i.eventType, i.eventTypeOther)}</span>
                  </span>
                  <span class="adm-inbox__date">{formatShort(i.date)}</span>
                  <span class="adm-inbox__guests">{plural(i.guests, 'guest')}</span>
                  <span class="adm-inbox__space">{spaceLabel(i.space)}</span>
                  <span class="adm-inbox__est adm-num">{formatUSD(i.estimateTotal)}</span>
                  <span class="adm-inbox__status">
                    <StatusBadge status={i.status} />
                  </span>
                  <Icon name="chevron-right" class="adm-row__chevron" />
                  <span class="adm-inbox__compact">
                    <span class="adm-nowrap">{formatShort(i.date)}</span>
                    {SEP}
                    <span class="adm-nowrap">{plural(i.guests, 'guest')}</span>
                    {SEP}
                    <span class="adm-nowrap">{spaceLabel(i.space)}</span>
                    {SEP}
                    <span class="adm-nowrap">{formatUSD(i.estimateTotal)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
