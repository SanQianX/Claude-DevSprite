/**
 * Auth Store
 * Manages user authentication state and JWT token persistence
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '../api/client';

interface User {
  id: number;
  username: string;
  role: string;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('auth_token'));
  const user = ref<User | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value && !!user.value);

  async function login(username: string, password: string): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiClient.post<{ token: string; user: User }>(
        '/auth/login',
        { username, password }
      );

      if (result.success && result.data) {
        token.value = result.data.token;
        user.value = result.data.user;
        localStorage.setItem('auth_token', result.data.token);
        return true;
      }

      error.value = result.error || 'Login failed';
      return false;
    } catch (err: any) {
      error.value = err.message || 'Login failed';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function register(username: string, password: string): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiClient.post<{ token: string; user: User }>(
        '/auth/register',
        { username, password }
      );

      if (result.success && result.data) {
        token.value = result.data.token;
        user.value = result.data.user;
        localStorage.setItem('auth_token', result.data.token);
        return true;
      }

      error.value = result.error || 'Registration failed';
      return false;
    } catch (err: any) {
      error.value = err.message || 'Registration failed';
      return false;
    } finally {
      loading.value = false;
    }
  }

  function logout(): void {
    token.value = null;
    user.value = null;
    localStorage.removeItem('auth_token');
  }

  async function checkAuth(): Promise<void> {
    if (!token.value) return;

    try {
      const result = await apiClient.get<{ user: User }>('/auth/me');
      if (result.success && result.data) {
        user.value = result.data.user;
      } else {
        // Token invalid — clear
        logout();
      }
    } catch {
      logout();
    }
  }

  // Check auth on store initialization if token exists
  if (token.value) {
    checkAuth();
  }

  return {
    token,
    user,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    logout,
    checkAuth,
  };
});
