const BASE_URL = '/api'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers,
      ...options
    })

    // Try to parse JSON, but handle parsing errors gracefully
    let data: unknown
    try {
      data = await response.json()
    } catch (parseError) {
      // If JSON parsing fails, treat response body as error message
      const text = await response.text()
      return {
        success: false,
        error: text.substring(0, 200) || 'Invalid response from server'
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: (data as { error?: string })?.error || 'Request failed'
      }
    }

    return {
      success: true,
      data: data as T
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export const apiClient = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: Record<string, unknown>) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  put: <T>(endpoint: string, body: Record<string, unknown>) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' })
}

/**
 * Unwrap an ApiResponse, returning data on success or throwing on failure
 */
export async function unwrap<T>(promise: Promise<ApiResponse<T>>): Promise<T> {
  const result = await promise
  if (!result.success) {
    throw new Error(result.error || 'API call failed')
  }
  return result.data as T
}
