import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function initializeApp() {
  const isStaticBlogPage =
    document
      .querySelector('meta[name="prerender-static-page"]')
      ?.getAttribute('content') === 'blog' &&
    window.location.pathname.startsWith('/blog');

  if (isStaticBlogPage) {
    return;
  }

  createRoot(document.getElementById('root')!).render(<App />);
}

initializeApp();
