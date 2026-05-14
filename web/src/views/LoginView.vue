<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isRegisterMode = ref(false)
const username = ref('')
const password = ref('')
const errorMsg = ref('')

async function handleSubmit() {
  errorMsg.value = ''

  if (!username.value.trim() || !password.value.trim()) {
    errorMsg.value = '请输入用户名和密码'
    return
  }

  let success: boolean
  if (isRegisterMode.value) {
    success = await authStore.register(username.value, password.value)
  } else {
    success = await authStore.login(username.value, password.value)
  }

  if (success) {
    router.push('/')
  } else {
    errorMsg.value = authStore.error || '操作失败'
  }
}

function toggleMode() {
  isRegisterMode.value = !isRegisterMode.value
  errorMsg.value = ''
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">Claude-DevSprite</h1>
      <p class="login-subtitle">{{ isRegisterMode ? '创建账号' : '登录' }}</p>

      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="3-30个字符，字母数字下划线"
            autocomplete="username"
            :disabled="authStore.loading"
          />
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="至少6个字符"
            autocomplete="current-password"
            :disabled="authStore.loading"
          />
        </div>

        <div v-if="errorMsg" class="error-message">{{ errorMsg }}</div>

        <button type="submit" class="login-btn" :disabled="authStore.loading">
          {{ authStore.loading ? '处理中...' : (isRegisterMode ? '注册' : '登录') }}
        </button>
      </form>

      <div class="login-footer">
        <button class="toggle-btn" @click="toggleMode" :disabled="authStore.loading">
          {{ isRegisterMode ? '已有账号？去登录' : '没有账号？去注册' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-primary, #fafafa);
}

.login-card {
  width: 100%;
  max-width: 380px;
  padding: 40px;
  background: var(--bg-secondary, #fff);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.login-title {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
  text-align: center;
}

.login-subtitle {
  margin: 0 0 28px;
  font-size: 14px;
  color: var(--text-secondary, #666);
  text-align: center;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #333);
}

.form-group input {
  padding: 10px 12px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 8px;
  font-size: 14px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #333);
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: var(--accent-color, #4a90d9);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  padding: 8px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 13px;
}

.login-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: var(--accent-color, #4a90d9);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.login-btn:hover:not(:disabled) {
  background: var(--accent-hover, #3a7bc8);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-footer {
  margin-top: 20px;
  text-align: center;
}

.toggle-btn {
  background: none;
  border: none;
  color: var(--accent-color, #4a90d9);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
}

.toggle-btn:hover:not(:disabled) {
  text-decoration: underline;
}

.toggle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
