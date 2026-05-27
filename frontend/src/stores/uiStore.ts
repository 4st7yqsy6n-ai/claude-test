import { create } from 'zustand';

export type ActiveView = 'terminal' | 'macro' | 'screener' | 'news' | 'ai' | 'backtesting' | 'vip';
export type ThemeType = 'bloomberg' | 'dark' | 'matrix';

interface UIState {
  activeView: ActiveView;
  commandPaletteOpen: boolean;
  selectedTheme: ThemeType;
  sidebarOpen: boolean;
  rightPanelMode: 'news' | 'ai';

  // Actions
  setActiveView: (view: ActiveView) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  setTheme: (theme: ThemeType) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setRightPanelMode: (mode: 'news' | 'ai') => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'terminal',
  commandPaletteOpen: false,
  selectedTheme: 'bloomberg',
  sidebarOpen: true,
  rightPanelMode: 'news',

  setActiveView: (view) => set({ activeView: view }),

  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  setTheme: (theme) => set({ selectedTheme: theme }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
}));
