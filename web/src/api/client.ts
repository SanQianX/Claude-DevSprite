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
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Request failed'
      }
    }

    return {
      success: true,
      data
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
  post: <T>(endpoint: string, body: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  put: <T>(endpoint: string, body: any) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' })
}
