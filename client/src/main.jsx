import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import { installApiInterceptor } from './services/mdp/intercept';
import { isAuthenticated } from './services/mdp/auth';
import './locales/i18n';
import App from './App';
import './style.css';
import './mobile.css';
import { ApiErrorBoundaryProvider } from './hooks/ApiErrorBoundaryContext';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/copy-tex.js';

const LOGIN_URL =
  import.meta.env.VITE_MDP_LOGIN_URL ?? 'https://dev.mayadataprivacy.in/login';

if (!isAuthenticated()) {
  const returnTo = encodeURIComponent(window.location.href);
  window.location.replace(`${LOGIN_URL}?redirect=${returnTo}`);
} else {
  installApiInterceptor();

  const container = document.getElementById('root');
  const root = createRoot(container);

  root.render(
    <ApiErrorBoundaryProvider>
      <App />
    </ApiErrorBoundaryProvider>,
  );
}
