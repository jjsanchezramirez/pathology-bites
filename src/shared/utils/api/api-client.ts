/**
 * Centralized API client
 *
 * Provides a fetch wrapper that:
 * - Includes credentials for authenticated requests
 * - Sets JSON Content-Type when body is a string
 */

class APIClient {
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers || {});

    if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: options.credentials || "include",
    });
  }

  async get(url: string, options: RequestInit = {}): Promise<Response> {
    return this.fetch(url, { ...options, method: "GET" });
  }

  async post(url: string, body?: unknown, options: RequestInit = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch(url: string, body?: unknown, options: RequestInit = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put(url: string, body?: unknown, options: RequestInit = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete(url: string, body?: unknown, options: RequestInit = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const apiClient = new APIClient();
export { APIClient };
