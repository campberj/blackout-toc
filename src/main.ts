import { mount } from 'svelte';
import { theme } from './ui/theme';
import App from './ui/App.svelte';

theme.apply();

const target = document.getElementById('app');
if (!target) throw new Error('#app mount point missing');
export default mount(App, { target });
