// src/lib/utils/network-monitor.ts
/**
 * A utility for monitoring network connectivity throughout the application
 */

// Create a global event bus for network status changes
type NetworkStatusListener = (isOnline: boolean) => void;

class NetworkMonitor {
  private static instance: NetworkMonitor;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private hasConnectivity: boolean = true; // Deeper connectivity check
  private listeners: NetworkStatusListener[] = [];
  private pingIntervalId?: NodeJS.Timeout;
  private reconnectAttempts: number = 0;
  private pingUrl: string = 'https://1.1.1.1'; // Default to Cloudflare DNS

  private constructor() {
    // Only initialize in browser environment
    if (typeof window !== 'undefined') {
      this.setupListeners();
      this.startPeriodicPing();
    }
  }

  public static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  private setupListeners(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('focus', this.handleWindowFocus);
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
    // Check connectivity when window gets focus
    this.checkConnectivity();
  };

  private startPeriodicPing(interval: number = 30000): void {
    this.pingIntervalId = setInterval(() => {
      this.checkConnectivity();
    }, interval);
  }

  private stopPeriodicPing(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
    }
  }

  private async checkConnectivity(): Promise<void> {
    if (!this.isOnline) {
      this.hasConnectivity = false;
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.pingUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const wasOffline = !this.hasConnectivity;
      this.hasConnectivity = true;
      this.reconnectAttempts = 0;

      if (wasOffline) {
        console.log('Network connectivity restored');
        this.notifyListeners();
      }
    } catch (error) {
      this.reconnectAttempts++;
      this.hasConnectivity = false;
      console.warn(`Connectivity check failed (attempt ${this.reconnectAttempts}):`, error);
      this.notifyListeners();
    }
  }

  /**
   * Check if the application is connected to the internet
   */
  public isConnected(): boolean {
    return this.isOnline && this.hasConnectivity;
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
   * Register a listener for network status changes
   */
  public addListener(listener: NetworkStatusListener): () => void {
    this.listeners.push(listener);
    
    // Return a function to remove the listener
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const status = this.isConnected();
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in network status listener:', error);
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
    }
    this.stopPeriodicPing();
    this.listeners = [];
  }
}

// Export a singleton instance
export const networkMonitor = NetworkMonitor.getInstance();

// Helper hook for components
import { useState, useEffect } from 'react';

export function useNetworkMonitor() {
  const [isConnected, setIsConnected] = useState<boolean>(networkMonitor.isConnected());

  useEffect(() => {
    const removeListener = networkMonitor.addListener((status) => {
      setIsConnected(status);
    });

    // Initial check
    networkMonitor.checkConnection();

    return () => {
      removeListener();
    };
  }, []);

  return {
    isConnected,
    checkConnection: networkMonitor.checkConnection.bind(networkMonitor)
  };
}