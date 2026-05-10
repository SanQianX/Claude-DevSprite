import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

const { mockGet } = vi.hoisted(() => {
  const mockGet = vi.fn()
  return { mockGet }
})

vi.mock('@/api/client', () => ({
  apiClient: {
    get: mockGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

import { projectsApi } from '@/api/projects'

describe('projectsApi debug', () => {
  it('browseFilesystem returns correct data', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { currentPath: 'D:Projects', parentPath: 'D:', entries: [{ name: 'app-a', path: 'D:Projectsapp-a', isDirectory: true }] }
    })

    const result = await projectsApi.browseFilesystem()
    console.log('[TEST] browseFilesystem result:', JSON.stringify(result))
    console.log('[TEST] currentPath:', result.currentPath)
    console.log('[TEST] entries:', result.entries.length)
  })

  it('getDrives returns correct data', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { drives: [{ letter: 'C:', label: 'System', free: 100, total: 500 }] }
    })

    const result = await projectsApi.getDrives()
    console.log('[TEST] getDrives result:', JSON.stringify(result))
  })
})
