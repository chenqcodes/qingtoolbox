import { MAX_INPUT_LENGTH } from './constants';

/** A fragment never goes to the server or appears in the HTTP Referer header. */
export function worksheetHref(text: string): string {
  // Keep one excess character so the destination rejects, rather than silently truncates, oversized input.
  return `/tools/hanzi-worksheet/#text=${encodeURIComponent(Array.from(text).slice(0, MAX_INPUT_LENGTH + 1).join(''))}`;
}

export function readSharedText(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.has('text') ? params.get('text') : null;
}
