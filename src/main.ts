import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import '@fontsource-variable/inter';
import '@fontsource/fira-code/400.css';
import './app.css';

const app = mount(App, { target: document.getElementById('app')! });

registerSW({ immediate: true });

export default app;
