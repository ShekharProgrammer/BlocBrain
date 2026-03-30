import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type Priority = 'low' | 'medium' | 'high';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  settings?: Settings;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface HabitEntry {
  completed: boolean;
  feedback?: string;
}

export interface Habit {
  id: string;
  name: string;
  entries: { [date: string]: HabitEntry }; // date key: YYYY-MM-DD
}

export interface Node {
  id: string;
  type: 'text' | 'image' | 'link' | 'board' | 'todo' | 'tracker';
  title: string;
  content: string;
  x: number;
  y: number;
  priority: Priority;
  color?: string; // Custom color
  deadline?: string;
  lastNotified?: string; // ISO string of last notification time
  tracker?: number; // 0-100
  parentId?: string; // For nested boards
  targetUrl?: string; // For links
  imageUrl?: string; // For images
  width: number;
  height: number;
  shape?: 'circle' | 'square' | 'rounded';
  todoList?: TodoItem[];
  habits?: Habit[];
  dailyFeedback?: string;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  color?: string;
}

export interface Brain {
  id: string;
  name: string;
  nodes: Node[];
  connections: Connection[];
  isDeleted?: boolean;
  deletedAt?: string;
}

interface Settings {
  theme: 'minecraft' | 'dark' | 'minimal';
  fontSize: number;
  fontFamily: string;
  wallpaper?: string;
}

interface HistoryState {
  brains: Brain[];
  activeBrainId: string;
}

interface BrainState {
  user: User | null;
  brains: Brain[];
  activeBrainId: string;
  settings: Settings;
  history: {
    past: HistoryState[];
    future: HistoryState[];
  };
  
  // Actions
  setUser: (user: User | null) => void;
  setBrains: (brains: Brain[]) => void;
  setActiveBrain: (id: string) => void;
  addBrain: (name: string) => void;
  updateBrain: (brain: Brain, skipHistory?: boolean) => void;
  deleteBrain: (id: string) => void;
  reorderBrains: (startIndex: number, endIndex: number) => void;
  restoreBrain: (id: string) => void;
  permanentlyDeleteBrain: (id: string) => void;
  
  // Node Actions
  addNode: (node: Partial<Node>) => void;
  updateNode: (nodeId: string, updates: Partial<Node>, skipHistory?: boolean) => void;
  deleteNode: (nodeId: string) => void;
  
  // Connection Actions
  addConnection: (fromId: string, toId: string, color?: string) => void;
  deleteConnection: (connectionId: string) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
  
  // Settings
  updateSettings: (settings: Partial<Settings>) => void;
  resetStore: () => void;
}

const DEFAULT_BRAIN_ID = 'main-brain';

export const useBrainStore = create<BrainState>()(
  persist(
    (set, get) => ({
      user: null,
      brains: [
        { id: DEFAULT_BRAIN_ID, name: 'Second Brain', nodes: [], connections: [] },
        { id: 'proof-of-work', name: 'Proof Of Work', nodes: [], connections: [] },
        { id: 'my-why', name: 'My Why', nodes: [], connections: [] },
      ],
      activeBrainId: DEFAULT_BRAIN_ID,
      settings: {
        theme: 'minecraft',
        fontSize: 16,
        fontFamily: 'Inter',
      },
      history: {
        past: [],
        future: [],
      },

      setUser: (user) => set({ user }),
      setBrains: (brains) => set({ brains }),
      setActiveBrain: (id) => set({ activeBrainId: id }),

      saveHistory: () => set((state) => ({
        history: {
          past: [...state.history.past, { brains: JSON.parse(JSON.stringify(state.brains)), activeBrainId: state.activeBrainId }].slice(-30),
          future: []
        }
      })),

      addBrain: (name) => {
        get().saveHistory();
        set((state) => ({
          brains: [...state.brains, { id: uuidv4(), name, nodes: [], connections: [] }]
        }));
      },

      updateBrain: (updatedBrain, skipHistory = false) => set((state) => {
        const newPast = skipHistory 
          ? state.history.past 
          : [...state.history.past, { brains: JSON.parse(JSON.stringify(state.brains)), activeBrainId: state.activeBrainId }].slice(-30);
        
        return {
          brains: state.brains.map(b => b.id === updatedBrain.id ? updatedBrain : b),
          history: {
            past: newPast,
            future: skipHistory ? state.history.future : []
          }
        };
      }),

      deleteBrain: (id) => {
        get().saveHistory();
        set((state) => ({
          brains: state.brains.map(b => b.id === id ? { ...b, isDeleted: true, deletedAt: new Date().toISOString() } : b)
        }));
      },

      reorderBrains: (startIndex, endIndex) => {
        get().saveHistory();
        set((state) => {
          const result = Array.from(state.brains);
          const [removed] = result.splice(startIndex, 1);
          result.splice(endIndex, 0, removed);
          return { brains: result };
        });
      },

      restoreBrain: (id) => {
        get().saveHistory();
        set((state) => ({
          brains: state.brains.map(b => b.id === id ? { ...b, isDeleted: false, deletedAt: undefined } : b)
        }));
      },

      permanentlyDeleteBrain: (id) => {
        get().saveHistory();
        set((state) => ({
          brains: state.brains.filter(b => b.id !== id)
        }));
      },

      addNode: (nodeData) => {
        const state = get();
        const activeBrain = state.brains.find(b => b.id === state.activeBrainId);
        if (!activeBrain) return;

        const newNode: Node = {
          id: uuidv4(),
          type: 'text',
          title: 'New Note',
          content: '',
          x: 100,
          y: 100,
          priority: 'low',
          color: '#ff9800',
          width: 200,
          height: 200,
          shape: 'square',
          ...nodeData
        };

        state.updateBrain({
          ...activeBrain,
          nodes: [...activeBrain.nodes, newNode]
        });
      },

      updateNode: (nodeId, updates, skipHistory = false) => {
        const state = get();
        const activeBrain = state.brains.find(b => b.id === state.activeBrainId);
        if (!activeBrain) return;

        state.updateBrain({
          ...activeBrain,
          nodes: activeBrain.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n)
        }, skipHistory);
      },

      deleteNode: (nodeId) => {
        const state = get();
        const activeBrain = state.brains.find(b => b.id === state.activeBrainId);
        if (!activeBrain) return;

        state.updateBrain({
          ...activeBrain,
          nodes: activeBrain.nodes.filter(n => n.id !== nodeId),
          connections: activeBrain.connections.filter(c => c.fromId !== nodeId && c.toId !== nodeId)
        });
      },

      addConnection: (fromId, toId, color) => {
        const state = get();
        const activeBrain = state.brains.find(b => b.id === state.activeBrainId);
        if (!activeBrain) return;

        if (activeBrain.connections.some(c => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId))) return;

        state.updateBrain({
          ...activeBrain,
          connections: [...activeBrain.connections, { id: uuidv4(), fromId, toId, color }]
        });
      },

      deleteConnection: (connectionId) => {
        const state = get();
        const activeBrain = state.brains.find(b => b.id === state.activeBrainId);
        if (!activeBrain) return;

        state.updateBrain({
          ...activeBrain,
          connections: activeBrain.connections.filter(c => c.id !== connectionId)
        });
      },

      undo: () => set((state) => {
        if (state.history.past.length === 0) return state;
        
        const previous = state.history.past[state.history.past.length - 1];
        const newPast = state.history.past.slice(0, state.history.past.length - 1);
        const current = { brains: JSON.parse(JSON.stringify(state.brains)), activeBrainId: state.activeBrainId };
        
        return {
          brains: previous.brains,
          activeBrainId: previous.activeBrainId,
          history: {
            past: newPast,
            future: [current, ...state.history.future]
          }
        };
      }),

      redo: () => set((state) => {
        if (state.history.future.length === 0) return state;
        
        const next = state.history.future[0];
        const newFuture = state.history.future.slice(1);
        const current = { brains: JSON.parse(JSON.stringify(state.brains)), activeBrainId: state.activeBrainId };
        
        return {
          brains: next.brains,
          activeBrainId: next.activeBrainId,
          history: {
            past: [...state.history.past, current],
            future: newFuture
          }
        };
      }),

      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),

      resetStore: () => set({
        brains: [
          { id: DEFAULT_BRAIN_ID, name: 'Second Brain', nodes: [], connections: [] },
          { id: 'proof-of-work', name: 'Proof Of Work', nodes: [], connections: [] },
          { id: 'my-why', name: 'My Why', nodes: [], connections: [] },
        ],
        activeBrainId: DEFAULT_BRAIN_ID,
        user: null,
        history: {
          past: [],
          future: [],
        }
      })
    }),
    {
      name: 'block-brain-storage',
    }
  )
);
