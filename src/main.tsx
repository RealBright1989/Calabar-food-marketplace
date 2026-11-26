import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

(window as unknown as {gm_authFailure?: () => void}).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  origConsoleError.apply(console, args);
  const msg = args.map((a) => String(a)).join(' ');
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

// Firebase Auth caches its project config response. Some networks keep serving
// an old authorized-domains list after a domain is added in the console. Bust
// that one request so sign-in sees the current allowlist.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (/identitytoolkit\.googleapis\.com\/v1\/projects\?/.test(rawUrl)) {
    try {
      const url = new URL(rawUrl);
      url.searchParams.set('cb', String(Date.now()));
      return nativeFetch(url.toString(), { ...init, cache: 'no-store' });
    } catch {
      return nativeFetch(input, init);
    }
  }

  return nativeFetch(input, init);
};

createRoot(document.getElementById('root')!).render(<App />);
