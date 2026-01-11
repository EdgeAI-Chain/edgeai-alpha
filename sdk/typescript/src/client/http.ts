/**
 * HTTP Client for EdgeAI API
 * @packageDocumentation
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { EdgeAIConfig, ApiResponse } from '../types';

/**
 * HTTP client error
 */
export class EdgeAIHttpError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.name = 'EdgeAIHttpError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * HTTP client for making API requests
 */
export class HttpClient {
  private readonly client: AxiosInstance;
  private readonly debug: boolean;

  constructor(config: EdgeAIConfig) {
    this.debug = config.debug ?? false;

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout ?? 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'X-API-Key': config.apiKey }),
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (request) => {
        if (this.debug) {
          console.log(`[EdgeAI SDK] ${request.method?.toUpperCase()} ${request.url}`);
        }
        return request;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse<unknown>>) => {
        const message = error.response?.data?.error ?? error.message;
        const statusCode = error.response?.status ?? 500;
        const errorCode = error.response?.data?.errorCode;
        throw new EdgeAIHttpError(message, statusCode, errorCode);
      }
    );
  }

  /**
   * Make a GET request
   */
  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(path, { params });
    return response.data;
  }

  /**
   * Make a POST request
   */
  async post<T>(path: string, data?: unknown): Promise<T> {
    const response = await this.client.post<T>(path, data);
    return response.data;
  }

  /**
   * Make a PUT request
   */
  async put<T>(path: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(path, data);
    return response.data;
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(path: string): Promise<T> {
    const response = await this.client.delete<T>(path);
    return response.data;
  }

  /**
   * Make a raw request with custom config
   */
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }
}
