import { create } from "zustand";
import { persist } from "zustand/middleware";

// Types
interface User {
  id: string;
  name?: string;
  email?: string;
  walletAddress?: string;
  isVerified?: boolean;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

interface AppState {
  // User
  user: User | null;
  setUser: (user: User | null) => void;
  
  // Wallet
  isWalletConnected: boolean;
  walletAddress: string | null;
  setWalletConnected: (connected: boolean, address?: string) => void;
  
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, "id" | "createdAt">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  
  // UI State
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  
  // Theme
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  
  // Watchlist
  watchlist: string[];
  addToWatchlist: (listingId: string) => void;
  removeFromWatchlist: (listingId: string) => void;
  isInWatchlist: (listingId: string) => boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // User
      user: null,
      setUser: (user) => set({ user }),
      
      // Wallet
      isWalletConnected: false,
      walletAddress: null,
      setWalletConnected: (connected, address) =>
        set({
          isWalletConnected: connected,
          walletAddress: address || null,
        }),
      
      // Notifications
      notifications: [],
      unreadCount: 0,
      addNotification: (notification) =>
        set((state) => {
          const newNotification = {
            ...notification,
            id: Math.random().toString(36).substring(7),
            createdAt: new Date(),
          };
          return {
            notifications: [newNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          };
        }),
      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        })),
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),
      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
      
      // UI State
      isMobileMenuOpen: false,
      setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
      
      // Theme
      theme: "system",
      setTheme: (theme) => set({ theme }),
      
      // Watchlist
      watchlist: [],
      addToWatchlist: (listingId) =>
        set((state) => ({
          watchlist: [...state.watchlist, listingId],
        })),
      removeFromWatchlist: (listingId) =>
        set((state) => ({
          watchlist: state.watchlist.filter((id) => id !== listingId),
        })),
      isInWatchlist: (listingId) => get().watchlist.includes(listingId),
    }),
    {
      name: "app-market-storage",
      partialize: (state) => ({
        theme: state.theme,
        watchlist: state.watchlist,
      }),
    }
  )
);

// Separate store for bid state (not persisted)
interface BidState {
  activeBids: Map<string, number>;
  pendingBids: Map<string, { amount: number; status: string }>;
  setBid: (listingId: string, amount: number) => void;
  clearBid: (listingId: string) => void;
  setPendingBid: (listingId: string, amount: number, status: string) => void;
  clearPendingBid: (listingId: string) => void;
}

export const useBidStore = create<BidState>((set, get) => ({
  activeBids: new Map(),
  pendingBids: new Map(),
  setBid: (listingId, amount) =>
    set((state) => {
      const newBids = new Map(state.activeBids);
      newBids.set(listingId, amount);
      return { activeBids: newBids };
    }),
  clearBid: (listingId) =>
    set((state) => {
      const newBids = new Map(state.activeBids);
      newBids.delete(listingId);
      return { activeBids: newBids };
    }),
  setPendingBid: (listingId, amount, status) =>
    set((state) => {
      const newPending = new Map(state.pendingBids);
      newPending.set(listingId, { amount, status });
      return { pendingBids: newPending };
    }),
  clearPendingBid: (listingId) =>
    set((state) => {
      const newPending = new Map(state.pendingBids);
      newPending.delete(listingId);
      return { pendingBids: newPending };
    }),
}));
