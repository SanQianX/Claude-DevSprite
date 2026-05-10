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

describe('FolderBrowser debug3', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('manual loadDirectory call', async () => {
    mockGet.mockImplementation(async (endpoint: string) => {
      console.log('[MOCK] called:', endpoint)
      if (endpoint === '/filesystem/drives') {
        return { success: true, data: { drives: [{ letter: 'C:', label: 'System', free: 100, total: 500 }] } }
      }
      if (endpoint.startsWith('/filesystem/browse')) {
        return { success: true, data: { currentPath: 'D:Projects', parentPath: 'D:', entries: [{ name: 'app-a', path: 'D:Projectsapp-a', isDirectory: true }] } }
      }
      return { success: false, error: 'Unknown' }
    })

    const wrapper = mount(FolderBrowser)

    // Wait for mount to complete
    await flushPromises()
    await flushPromises()
    await nextTick()
    await nextTick()

    console.log('[TEST] After mount - mockGet calls:', mockGet.mock.calls.length)
    console.log('[TEST] After mount - path-text:', wrapper.find('.path-text').text())
    console.log('[TEST] After mount - drives options:', wrapper.findAll('.drive-select option').length)

    // Now manually call loadDirectory
    console.log('[TEST] Calling loadDirectory manually...')
    await (wrapper.vm as any).loadDirectory('D:Projects')
    await flushPromises()
    await nextTick()

    console.log('[TEST] After manual loadDirectory - mockGet calls:', mockGet.mock.calls.length)
    console.log('[TEST] After manual loadDirectory - path-text:', wrapper.find('.path-text').text())
    console.log('[TEST] After manual loadDirectory - items:', wrapper.findAll('.directory-item').length)
    console.log('[TEST] After manual loadDirectory - drives options:', wrapper.findAll('.drive-select option').length)
  })
})
