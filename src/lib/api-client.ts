import { CustomError, HTTPError, NetworkError } from "./errors";

import { getErrorFromResponseData, getStatusCodeErrorMessage } from "./http";

export type APIClientOptions = RequestInit & {
  baseURL?: string;
  noBaseURL?: boolean;
  authRetries?: number;
  withCredentials?: boolean;
  retries?: number;
  retryDelay?: number;
};

export class APIClient {
  baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  _getRequestUrl(endpoint: string, options?: APIClientOptions) {
    if (options?.noBaseURL) {
      return endpoint;
    }

    const baseUrl = options?.baseURL ?? this.baseURL;

    if (!endpoint.startsWith("/")) {
      return `${baseUrl}/${endpoint}`;
    }

    return `${baseUrl}${endpoint}`;
  }

  async _getResponseErrors(response: Response): Promise<string> {
    try {
      const data = await response.json();
      const errorMessage = getErrorFromResponseData(data);
      return errorMessage || getStatusCodeErrorMessage(response.status);
    } catch (error) {
      return getStatusCodeErrorMessage(response.status);
    }
  }

  async fetch(url: string, options?: APIClientOptions) {
    const maxRetries = options?.retries ?? 3;
    const retryDelay = options?.retryDelay ?? 1000;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          credentials: options?.withCredentials ? "include" : "same-origin",
        });

        if (!response.ok) {
          const errorMessage = await this._getResponseErrors(response);
          throw new HTTPError(errorMessage, response.status);
        }

        return response;
      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          continue;
        }
      }
    }

    if (lastError instanceof HTTPError) {
      throw lastError;
    }
    
    throw new NetworkError("Failed to fetch after multiple retries");
  }

  async get(endpoint: string, options?: APIClientOptions) {
    const url = this._getRequestUrl(endpoint, options);
    return this.fetch(url, {
      ...options,
      method: "GET",
    });
  }

  async post(endpoint: string, options?: APIClientOptions) {
    const url = this._getRequestUrl(endpoint, options);
    return this.fetch(url, {
      ...options,
      method: "POST",
    });
  }

  async put(endpoint: string, options?: APIClientOptions) {
    const requestUrl = this._getRequestUrl(endpoint, options);

    return this.fetch(requestUrl, {
      ...options,
      method: "PUT",
    });
  }

  async delete(endpoint: string, options?: APIClientOptions) {
    const requestUrl = this._getRequestUrl(endpoint, options);

    return this.fetch(requestUrl, {
      ...options,
      method: "DELETE",
    });
  }

  async patch(endpoint: string, options?: APIClientOptions) {
    const requestUrl = this._getRequestUrl(endpoint, options);

    return this.fetch(requestUrl, {
      ...options,
      method: "PATCH",
    });
  }
}

const apiClient = new APIClient("/api");

export { apiClient };
