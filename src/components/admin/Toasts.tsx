/** Glass capsule toasts: role="status", explicit close, auto-hide after 6 seconds, paused on hover or focus. */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import type { ToastTone } from './context';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const AUTO_HIDE_MS = 6000;

export function useToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++seq.current;
    // Keep at most three; the newest is last.
    setItems((list) => [...list.slice(-2), { id, message, tone }]);
  }, []);
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  return { items, push, dismiss };
}

function Toast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(AUTO_HIDE_MS);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pause = () => setPaused(true);
    const resume = () => {
      if (!el.matches(':hover') && !el.contains(document.activeElement)) setPaused(false);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) setPaused(el.matches(':hover'));
    };
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    el.addEventListener('focusin', pause);
    el.addEventListener('focusout', onFocusOut);
    return () => {
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
      el.removeEventListener('focusin', pause);
      el.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = window.setTimeout(onClose, Math.max(remaining.current, 2000));
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused]);

  const icon = item.tone === 'success' ? 'check-circle' : 'info';
  return (
    <div ref={ref} class={`adm-toast glass adm-toast--${item.tone}`} role="status">
      <Icon name={icon} class="adm-toast__icon" />
      <p class="adm-toast__text">{item.message}</p>
      <button type="button" class="adm-iconbtn adm-toast__close" onClick={onClose} aria-label="Close">
        <Icon name="x" />
      </button>
    </div>
  );
}

export function ToastRegion({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div class="adm-toasts" aria-live="polite">
      {items.map((t) => (
        <Toast key={t.id} item={t} onClose={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}
