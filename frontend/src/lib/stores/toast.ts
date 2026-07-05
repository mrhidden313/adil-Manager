import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

function createToastStore() {
  const { subscribe, update } = writable<ToastMessage[]>([]);

  return {
    subscribe,
    add: (message: string, type: ToastType = 'info', timeout = 3000) => {
      const id = Math.random().toString(36).substring(2, 9);
      update(all => [{ id, message, type }, ...all]);
      setTimeout(() => {
        update(all => all.filter(t => t.id !== id));
      }, timeout);
    },
    remove: (id: string) => {
      update(all => all.filter(t => t.id !== id));
    }
  };
}

export const toast = createToastStore();
