import { boot } from './app.js';

const root = document.getElementById('app');
try {
  window.mauvineApp = boot(root);
} catch (error) {
  console.error('Unable to start Mauvine Rota', error);
  root.textContent = 'The workspace could not start. Please refresh the page or check your browser settings.';
}
