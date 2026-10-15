// Theme preference: per-device convenience, so localStorage is fine (guarded).
export type ThemeChoice = 'dark' | 'light' | 'system';

const KEY = 'toc.theme';

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

function resolve(choice: ThemeChoice): 'dark' | 'light' {
  if (choice !== 'system') return choice;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

class ThemeStore {
  choice = $state<ThemeChoice>(read());

  set(choice: ThemeChoice): void {
    this.choice = choice;
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      /* storage blocked: preference lasts for the session only */
    }
    this.apply();
  }

  apply(): void {
    document.documentElement.dataset['theme'] = resolve(this.choice);
  }
}

export const theme = new ThemeStore();
