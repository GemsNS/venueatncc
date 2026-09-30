/**
 * Native <dialog> wrappers. Esc, the Close button, and a click on the backdrop all dismiss.
 * Focus returns to whatever opened the dialog.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import { ELLIPSIS } from './format';

let seq = 0;
const nextId = (p: string) => `${p}-${++seq}`;

function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDialogClose = () => {
      const back = opener.current as HTMLElement | null;
      opener.current = null;
      closeRef.current();
      if (back && document.contains(back) && typeof back.focus === 'function') back.focus();
    };
    const onClick = (e: MouseEvent) => {
      if (e.target === el) el.close();
    };
    el.addEventListener('close', onDialogClose);
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('close', onDialogClose);
      el.removeEventListener('click', onClick);
      if (el.open) el.close();
    };
  }, []);

  return ref;
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ComponentChildren;
}) {
  const ref = useModal(open, onClose);
  const ids = useRef({ title: nextId('sheet-title'), sub: nextId('sheet-sub') }).current;
  return (
    <dialog ref={ref} class="adm-sheet" aria-labelledby={ids.title} aria-describedby={subtitle ? ids.sub : undefined}>
      <div class="adm-sheet__grabber" aria-hidden="true" />
      <header class="adm-sheet__head">
        <div>
          <h2 id={ids.title} class="adm-sheet__title">
            {title}
          </h2>
          {subtitle && (
            <p id={ids.sub} class="adm-sheet__sub">
              {subtitle}
            </p>
          )}
        </div>
        <button type="button" class="adm-iconbtn adm-iconbtn--fill" onClick={() => ref.current?.close()} aria-label="Close">
          <Icon name="x" />
        </button>
      </header>
      <div class="adm-sheet__body">{open && children}</div>
    </dialog>
  );
}

/** A small alert for significant or irreversible actions. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  busyLabel,
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ComponentChildren;
  confirmLabel: string;
  busyLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useModal(open, onClose);
  const ids = useRef({ title: nextId('alert-title'), body: nextId('alert-body') }).current;
  return (
    <dialog ref={ref} class="adm-alert" role="alertdialog" aria-labelledby={ids.title} aria-describedby={ids.body}>
      <h2 id={ids.title} class="adm-alert__title">
        {title}
      </h2>
      <div id={ids.body} class="adm-alert__body">
        {body}
      </div>
      {error && (
        <p class="adm-error" role="alert">
          {error}
        </p>
      )}
      <div class="adm-alert__actions">
        <button type="button" class="btn btn--outline" onClick={() => ref.current?.close()} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          class={destructive ? 'btn adm-btn--destructive' : 'btn btn--filled'}
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy ? 'true' : undefined}
        >
          {busy ? (busyLabel ?? `${confirmLabel}${ELLIPSIS}`) : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
