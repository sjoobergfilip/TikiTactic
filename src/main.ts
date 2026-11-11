import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import { initializeSession } from './lib/stores/tactics';
import '@fontsource-variable/inter';
import '@fontsource/fira-code/400.css';
import './app.css';

async function bootstrap() {
  await initializeSession();
  mount(App, { target: document.getElementById('app')! });
  registerSW({ immediate: true });
}

void bootstrap();
