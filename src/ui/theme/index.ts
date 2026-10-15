// Global stylesheet order matters: tokens → reset → base → print overrides.
import './tokens.css';
import './reset.css';
import './base.css';
import './print.css';

export { theme, type ThemeChoice } from './theme.svelte';
