/** Small form helpers for the booking wizard. */
import { errorId } from './wizard';

/** Join ids for aria-describedby, skipping empty ones. */
export const describe = (...ids: (string | false | null | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

export function FieldError(props: { errors: Record<string, string>; field: string }) {
  const msg = props.errors[props.field];
  if (!msg) return null;
  return (
    <p class="field__error bk-field-error" id={errorId(props.field)}>
      {msg}
    </p>
  );
}
