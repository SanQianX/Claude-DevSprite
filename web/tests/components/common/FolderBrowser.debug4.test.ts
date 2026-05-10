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

describe('FolderBrowser debug4', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('check error catching', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

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
    await flushPromises()
    await flushPromises()
    await nextTick()
    await nextTick()

    console.log('[TEST] console.error calls:', errorSpy.mock.calls.map(c => c.join(' ')))
    console.log('[TEST] console.warn calls:', warnSpy.mock.calls.map(c => c.join(' ')))
    console.log('[TEST] path-text:', JSON.stringify(wrapper.find('.path-text').text()))
    console.log('[TEST] error-state:', wrapper.find('.error-state').exists())
    console.log('[TEST] loading-state:', wrapper.find('.loading-state').exists())

    // Try to access vm data directly
    const vm = wrapper.vm as any
    console.log('[TEST] vm.currentPath:', JSON.stringify(vm.currentPath))
    console.log('[TEST] vm.loading:', vm.loading)
    console.log('[TEST] vm.error:', JSON.stringify(vm.error))
    console.log('[TEST] vm.drives:', JSON.stringify(vm.drives))
    console.log('[TEST] vm.entries:', JSON.stringify(vm.entries))

    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })
})
