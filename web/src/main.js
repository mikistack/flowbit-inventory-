import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import '@/assets/main.css';

const startLegacyCardCleanup = () => {
  if (typeof document === 'undefined') return;

  const removeCards = () => {
    document.querySelectorAll('h2').forEach((heading) => {
      if (heading.textContent?.trim().toLowerCase() === 'recent sales') {
        heading.closest('.card')?.remove();
      }
    });
  };

  const initObserver = () => {
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(removeCards);
      observer.observe(document.body, { childList: true, subtree: true });
      removeCards();
    } else {
      removeCards();
    }
    const intervalId = window.setInterval(removeCards, 500);
    window.setTimeout(() => window.clearInterval(intervalId), 10000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver, { once: true });
  } else {
    initObserver();
  }
};

startLegacyCardCleanup();

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

app.mount('#app');
