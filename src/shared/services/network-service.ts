// src/lib/network/network-service.ts

import { createClient } from '@/shared/services/client'

type NetworkStatusListener = (isConnected: boolean) => void;
type AuthStatusListener = (isAuthenticated: boolean) => void;
type CombinedStatusListener = (isConnected: boolean, isAuthenticated: boolean) => void;

class NetworkService {
  private static instance: NetworkService;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private hasConnectivity: boolean = true;
  private isAuthenticated: boolean = false;

  private networkListeners: NetworkStatusListener[] = [];
  private authListeners: AuthStatusListener[] = [];
  private combinedListeners: CombinedStatusListener[] = [];

  private pingIntervalId?: NodeJS.Timeout;
  private authCheckIntervalId?: NodeJS.Timeout;
  private reconnectAttempts: number = 0;
  private pingUrl: string = '/api/health'; // Use internal health check instead

  private constructor() {
    if (typeof window !== 'undefined') {
      this.setupListeners();
      this.startPeriodicChecks();
    }
  }

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  private setupListeners(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('focus', this.handleWindowFocus);
    window.addEventListener('storage', this.handleStorageChange);
  }

  private handleOnline = (): void => {
    this.isOnline = true;
    this.checkConnectivity(); // Verify true connectivity
  };

  private handleOffline = (): void => {
    this.isOnline = false;
    this.hasConnectivity = false;
    this.notifyListeners();
    console.log('Network appears to be offline');
  };

  private handleWindowFocus = (): void => {
    // Check connectivity and auth when window gets focus
    this.checkConnectivity();
    this.checkAuthStatus();
  };

  private handleStorageChange = (event: StorageEvent): void => {
    // Check for auth-related storage changes
    if (event.key?.includes('supabase.auth') || event.key === null) {
      this.checkAuthStatus();
    }
  };

  private startPeriodicChecks(pingInterval: number = 300000, authInterval: number = 600000): void {
    // Optimized: Much less aggressive - check connectivity every 5 minutes, auth every 10 minutes
    // This significantly reduces database load from frequent checks
    this.pingIntervalId = setInterval(() => {
      this.checkConnectivity();
    }, pingInterval);

    this.authCheckIntervalId = setInterval(() => {
      this.checkAuthStatus();
    }, authInterval);
  }

  private stopPeriodicChecks(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
    }
    if (this.authCheckIntervalId) {
      clearInterval(this.authCheckIntervalId);
    }
  }

  private async checkConnectivity(): Promise<void> {
    // If browser says we're offline, trust it
    if (!this.isOnline) {
      this.hasConnectivity = false;
      this.notifyListeners();
      return;
    }

    try {
      const controller = new AbortController();
      // Exponential backoff for timeout based on attempts
      const timeout = Math.min(8000 + (this.reconnectAttempts * 2000), 20000);
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Try to ping our own API first (more reliable than external)
      const response = await fetch(this.pingUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // If health endpoint doesn't exist (404), we're still online
      if (response.ok || response.status === 404) {
        const wasOffline = !this.hasConnectivity;
        this.hasConnectivity = true;
        this.reconnectAttempts = 0;

        if (wasOffline) {
          console.log('Network connectivity restored');
          this.notifyListeners();
          // Also check auth status when connectivity is restored
          this.checkAuthStatus();
        }
      } else {
        throw new Error(`Health check failed with status: ${response.status}`);
      }
    } catch (error) {
      // Exponential backoff: Only mark as offline after multiple failures
      this.reconnectAttempts++;
      const maxAttempts = 3;

      if (this.reconnectAttempts >= maxAttempts) {
        this.hasConnectivity = false;
        console.warn(`Connectivity check failed after ${this.reconnectAttempts} attempts:`, error);
        this.notifyListeners();
      } else {
        // Exponential backoff delay before next attempt
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Connectivity check failed (attempt ${this.reconnectAttempts}/${maxAttempts}), retrying in ${delay}ms...`);

        setTimeout(() => {
          if (this.reconnectAttempts < maxAttempts) {
            this.checkConnectivity();
          }
        }, delay);
      }
    }
  }

  private async checkAuthStatus(): Promise<void> {
    if (!this.hasConnectivity) {
      return; // Don't try to check auth when offline
    }

    try {
      const supabase = createClient();

      // First try getSession which is more reliable
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        const wasUnauthenticated = !this.isAuthenticated;
        this.isAuthenticated = !!session;

        if (wasUnauthenticated !== !this.isAuthenticated) {
          console.log('Authentication status changed:', this.isAuthenticated ? 'authenticated' : 'unauthenticated');
          this.notifyListeners();
        }

        return;
      } catch { // Remove the 'error' parameter
        // If getSession fails, try getUser as fallback
        try {
          const { data: { user }, error } = await supabase.auth.getUser();

          if (error) {
            throw error;
          }

          const wasUnauthenticated = !this.isAuthenticated;
          this.isAuthenticated = !!user;

          if (wasUnauthenticated !== !this.isAuthenticated) {
            console.log('Authentication status changed:', this.isAuthenticated ? 'authenticated' : 'unauthenticated');
            this.notifyListeners();
          }

          return;
        } catch { // Remove the 'fallbackError' parameter
          // Both methods failed, assume not authenticated
          if (this.isAuthenticated) {
            this.isAuthenticated = false;
            console.log('User is no longer authenticated');
            this.notifyListeners();
          }
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      // Don't change auth status on network/unexpected errors
    }
  }

  /**
   * Check if the application is connected to the internet
   */
  public isConnected(): boolean {
    return this.isOnline && this.hasConnectivity;
  }

  /**
   * Check if the user is authenticated
   */
  public isUserAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Set a custom URL to ping for connectivity checks
   */
  public setPingUrl(url: string): void {
    this.pingUrl = url;
  }

  /**
   * Force a connectivity check
   */
  public async checkConnection(): Promise<boolean> {
    await this.checkConnectivity();
    return this.isConnected();
  }

  /**
   * Force an authentication check
   */
  public async checkAuthentication(): Promise<boolean> {
    await this.checkAuthStatus();
    return this.isUserAuthenticated();
  }

  /**
   * Register a listener for network status changes only
   */
  public addNetworkListener(listener: NetworkStatusListener): () => void {
    this.networkListeners.push(listener);

    // Return a function to remove the listener
    return () => {
      this.networkListeners = this.networkListeners.filter(l => l !== listener);
    };
  }

  /**
   * Register a listener for authentication status changes only
   */
  public addAuthListener(listener: AuthStatusListener): () => void {
    this.authListeners.push(listener);

    // Return a function to remove the listener
    return () => {
      this.authListeners = this.authListeners.filter(l => l !== listener);
    };
  }

  /**
   * Register a listener for combined network and auth status changes
   */
  public addCombinedListener(listener: CombinedStatusListener): () => void {
    this.combinedListeners.push(listener);

    // Return a function to remove the listener
    return () => {
      this.combinedListeners = this.combinedListeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const isConnected = this.isConnected();
    const isAuthenticated = this.isUserAuthenticated();

    // Notify network-only listeners
    this.networkListeners.forEach(listener => {
      try {
        listener(isConnected);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });

    // Notify auth-only listeners
    this.authListeners.forEach(listener => {
      try {
        listener(isAuthenticated);
      } catch (error) {
        console.error('Error in auth status listener:', error);
      }
    });

    // Notify combined listeners
    this.combinedListeners.forEach(listener => {
      try {
        listener(isConnected, isAuthenticated);
      } catch (error) {
        console.error('Error in combined status listener:', error);
      }
    });
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
      window.removeEventListener('focus', this.handleWindowFocus);
      window.removeEventListener('storage', this.handleStorageChange);
    }
    this.stopPeriodicChecks();
    this.networkListeners = [];
    this.authListeners = [];
    this.combinedListeners = [];
  }
}

// Export a singleton instance
export const networkService = NetworkService.getInstance();

// Simple hook for components that just need network status
