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

import FolderBrowser from '@/components/common/FolderBrowser.vue'

describe('FolderBrowser debug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debug: check mock flow', async () => {
    mockGet.mockImplementation(async (endpoint: string) => {
      console.log('[MOCK] apiClient.get called with:', endpoint)
      if (endpoint === '/filesystem/drives') {
        return { success: true, data: { drives: [{ letter: 'C:', label: 'System', free: 100, total: 500 }] } }
      }
      if (endpoint.startsWith('/filesystem/browse')) {
        return { success: true, data: { currentPath: 'D:Projects', parentPath: 'D:', entries: [{ name: 'app-a', path: 'D:Projectsapp-a', isDirectory: true }] } }
      }
      return { success: false, error: 'Unknown' }
    })

    const wrapper = mount(FolderBrowser)
    console.log('[TEST] Mounted, before flush')

    await flushPromises()
    console.log('[TEST] After first flush, mockGet calls:', mockGet.mock.calls.length)

    await flushPromises()
    console.log('[TEST] After second flush, mockGet calls:', mockGet.mock.calls.length)

    await nextTick()
    await nextTick()

    console.log('[TEST] Final mockGet calls:', JSON.stringify(mockGet.mock.calls))
    console.log('[TEST] path-text:', wrapper.find('.path-text').text())
    console.log('[TEST] directory items:', wrapper.findAll('.directory-item').length)
    console.log('[TEST] loading:', wrapper.find('.loading-state').exists())
    console.log('[TEST] error:', wrapper.find('.error-state').exists())
    console.log('[TEST] HTML:', wrapper.html())
  })
})
