// Store local funcional: créditos, proyectos, archivos, transacciones, generaciones.
// Persiste todo en localStorage. Funciona sin backend.
import type { FileItem } from "@/components/builder/CodeEditor";

const KEY = "nexa.store.v1";

export interface LocalProject {
  id: string;
  name: string;
  description: string | null;
  prompt: string | null;
  files: FileItem[];
  created_at: string;
  updated_at: string;
}

export interface LocalTx {
  id: string;
  amount: number; // negative = consumo, positive = recarga
  reason: string;
  created_at: string;
}

export interface LocalGeneration {
  id: string;
  project_id: string;
  prompt: string;
  response_summary: string;
  cost: number;
  model: string;
  created_at: string;
}

export interface LocalState {
  credits: { balance: number; unlimited: boolean };
  projects: LocalProject[];
  transactions: LocalTx[];
  generations: LocalGeneration[];
}

const DEFAULT_STATE: LocalState = {
  credits: { balance: 25, unlimited: false },
  projects: [],
  transactions: [
    {
      id: crypto.randomUUID?.() || String(Math.random()),
      amount: 25,
      reason: "Bienvenida — créditos demo",
      created_at: new Date().toISOString(),
    },
  ],
  generations: [],
};

function read(): LocalState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as LocalState;
    return {
      credits: parsed.credits ?? DEFAULT_STATE.credits,
      projects: parsed.projects ?? [],
      transactions: parsed.transactions ?? [],
      generations: parsed.generations ?? [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function write(state: LocalState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("nexa:store-change"));
}

function uid() {
  return (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
}

export const localStore = {
  get: read,

  // Credits
  getCredits() {
    return read().credits;
  },
  consumeCredits(amount: number, reason: string): boolean {
    const s = read();
    if (!s.credits.unlimited && s.credits.balance < amount) return false;
    if (!s.credits.unlimited) s.credits.balance -= amount;
    s.transactions.unshift({
      id: uid(),
      amount: -amount,
      reason,
      created_at: new Date().toISOString(),
    });
    write(s);
    return true;
  },
  addCredits(amount: number, reason: string) {
    const s = read();
    s.credits.balance += amount;
    s.transactions.unshift({
      id: uid(),
      amount,
      reason,
      created_at: new Date().toISOString(),
    });
    write(s);
  },
  setUnlimited(v: boolean) {
    const s = read();
    s.credits.unlimited = v;
    write(s);
  },

  // Projects
  listProjects(): LocalProject[] {
    return read().projects.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },
  getProject(id: string): LocalProject | undefined {
    return read().projects.find((p) => p.id === id);
  },
  saveProject(input: {
    id?: string;
    name: string;
    description?: string | null;
    prompt?: string | null;
    files: FileItem[];
  }): LocalProject {
    const s = read();
    const now = new Date().toISOString();
    if (input.id) {
      const idx = s.projects.findIndex((p) => p.id === input.id);
      if (idx >= 0) {
        s.projects[idx] = {
          ...s.projects[idx],
          name: input.name,
          description: input.description ?? s.projects[idx].description,
          prompt: input.prompt ?? s.projects[idx].prompt,
          files: input.files,
          updated_at: now,
        };
        write(s);
        return s.projects[idx];
      }
    }
    const proj: LocalProject = {
      id: input.id || uid(),
      name: input.name,
      description: input.description ?? null,
      prompt: input.prompt ?? null,
      files: input.files,
      created_at: now,
      updated_at: now,
    };
    s.projects.unshift(proj);
    write(s);
    return proj;
  },
  deleteProject(id: string) {
    const s = read();
    s.projects = s.projects.filter((p) => p.id !== id);
    write(s);
  },

  // Generations
  recordGeneration(g: Omit<LocalGeneration, "id" | "created_at">) {
    const s = read();
    s.generations.unshift({
      ...g,
      id: uid(),
      created_at: new Date().toISOString(),
    });
    write(s);
  },
  listGenerations(): LocalGeneration[] {
    return read().generations;
  },
  listTransactions(): LocalTx[] {
    return read().transactions;
  },

  reset() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("nexa:store-change"));
  },
};

export function subscribeStore(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => fn();
  window.addEventListener("nexa:store-change", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("nexa:store-change", handler);
    window.removeEventListener("storage", handler);
  };
}