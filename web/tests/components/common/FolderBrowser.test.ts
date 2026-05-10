/**
 * FolderBrowser Component Tests
 * Tests for: folder browsing, disk navigation, parent directory navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

// Use vi.hoisted to create mocks before vi.mock is hoisted
const { mockGet, mockBrowseResult, mockDrivesResult } = vi.hoisted(() => {
  const mockGet = vi.fn()
  return {
    mockGet,
    mockBrowseResult: { value: null as any },
    mockDrivesResult: { value: null as any }
  }
})

// Mock the apiClient - this is what projectsApi uses internally
vi.mock('@/api/client', () => ({
  apiClient: {
    get: mockGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

import FolderBrowser from '@/components/common/FolderBrowser.vue'

/**
 * Helper: mount FolderBrowser and wait for all async operations to complete.
 */
async function mountAndWait(browseData: any, drives?: any[]) {
  const drivesData = drives || [
    { letter: 'C:', label: 'System', free: 100, total: 500 },
    { letter: 'D:', label: 'Data', free: 200, total: 1000 }
  ]

  // Set up mock responses for apiClient.get
  mockGet.mockImplementation(async (endpoint: string) => {
    if (endpoint === '/filesystem/drives') {
      return { success: true, data: { drives: drivesData } }
    }
    if (endpoint.startsWith('/filesystem/browse')) {
      return { success: true, data: browseData }
    }
    return { success: false, error: 'Unknown endpoint' }
  })

  const wrapper = mount(FolderBrowser)
  // Multiple flushes needed for the async chain
  await flushPromises()
  await flushPromises()
  await nextTick()
  await nextTick()

  return wrapper
}

describe('FolderBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render folder browser container', async () => {
    const wrapper = await mountAndWait({
      currentPath: 'C:\\Users\\test',
      parentPath: 'C:\\Users',
      entries: []
    })

    expect(wrapper.find('.folder-browser').exists()).toBe(true)
  })

  it('should render drive selector', async () => {
    const wrapper = await mountAndWait({
      currentPath: 'C:\\Users\\test',
      parentPath: 'C:\\Users',
      entries: []
    })

    expect(wrapper.find('.drive-selector').exists()).toBe(true)
    expect(wrapper.find('.drive-select').exists()).toBe(true)
  })

  it('should call API on mount', async () => {
    await mountAndWait({
      currentPath: 'C:\\Users\\test',
      parentPath: 'C:\\Users',
      entries: []
    })

    expect(mockGet).toHaveBeenCalled()
  })

  it('should call getDrives on mount', async () => {
    await mountAndWait({
      currentPath: 'C:\\Users\\test',
      parentPath: 'C:\\Users',
      entries: []
    })

    expect(mockGet).toHaveBeenCalledWith('/filesystem/drives')
  })

  it('should call browseFilesystem on mount', async () => {
    await mountAndWait({
      currentPath: 'C:\\Users\\test',
      parentPath: 'C:\\Users',
      entries: []
    })

    // browseFilesystem with no path argument creates query without path param
    const browseCalls = mockGet.mock.calls.filter((c: any[]) => c[0].startsWith('/filesystem/browse'))
    expect(browseCalls.length).toBeGreaterThan(0)
  })

  it('should display current path', async () => {
    const wrapper = await mountAndWait({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: []
    })

    expect(wrapper.find('.path-text').text()).toBe('D:\\Projects')
  })

  it('should display directory entries', async () => {
    const wrapper = await mountAndWait({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: [
        { name: 'project-a', path: 'D:\\Projects\\project-a', isDirectory: true },
        { name: 'project-b', path: 'D:\\Projects\\project-b', isDirectory: true }
      ]
    })

    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    expect(items).toHaveLength(2)
    expect(items[0].find('.folder-name').text()).toBe('project-a')
    expect(items[1].find('.folder-name').text()).toBe('project-b')
  })

  it('should show parent directory entry when parentPath exists', async () => {
    const wrapper = await mountAndWait({
      currentPath: 'D:\\Projects\\my-app',
      parentPath: 'D:\\Projects',
      entries: []
    })

    const parentItem = wrapper.find('.parent-item')
    expect(parentItem.exists()).toBe(true)
    expect(parentItem.find('.folder-name').text()).toBe('..')
  })

  it('should not show parent directory entry at root', async () => {
    const wrapper = await mountAndWait({
      currentPath: 'C:\\',
      parentPath: null,
      entries: [{ name: 'Users', path: 'C:\\Users', isDirectory: true }]
    })

    expect(wrapper.find('.parent-item').exists()).toBe(false)
  })

  it('should populate drive selector with available drives', async () => {
    const wrapper = await mountAndWait({
      currentPath: 'C:\\Users',
      parentPath: 'C:\\',
      entries: []
    })

    const options = wrapper.findAll('.drive-select option')
    expect(options.length).toBe(2)
  })

  it('should navigate to different disk via loadDirectory', async () => {
    mockGet.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/filesystem/drives') {
        return {
          success: true,
          data: { drives: [{ letter: 'C:', label: 'System', free: 100, total: 500 }, { letter: 'D:', label: 'Data', free: 200, total: 1000 }] }
        }
      }
      if (endpoint.startsWith('/filesystem/browse')) {
        return {
          success: true,
          data: { currentPath: 'C:\\Users\\test', parentPath: 'C:\\Users', entries: [] }
        }
      }
      return { success: false }
    })

    const wrapper = mount(FolderBrowser)
    await flushPromises()
    await flushPromises()
    await nextTick()

    // Now change the mock for the next browse call
    mockGet.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/filesystem/drives') {
        return {
          success: true,
          data: { drives: [{ letter: 'C:', label: 'System', free: 100, total: 500 }, { letter: 'D:', label: 'Data', free: 200, total: 1000 }] }
        }
      }
      if (endpoint.startsWith('/filesystem/browse')) {
        return {
          success: true,
          data: {
            currentPath: 'D:\\',
            parentPath: null,
            entries: [
              { name: 'Projects', path: 'D:\\Projects', isDirectory: true },
              { name: 'Code', path: 'D:\\Code', isDirectory: true }
            ]
          }
        }
      }
      return { success: false }
    })

    await (wrapper.vm as any).loadDirectory('D:\\')
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.path-text').text()).toBe('D:\\')
  })

  it('should update selected drive when browsing to different disk', async () => {
    mockGet.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/filesystem/drives') {
        return {
          success: true,
          data: { drives: [{ letter: 'C:', label: 'System', free: 100, total: 500 }, { letter: 'D:', label: 'Data', free: 200, total: 1000 }] }
        }
      }
      return {
        success: true,
        data: { currentPath: 'C:\\Users', parentPath: 'C:\\', entries: [] }
      }
    })

    const wrapper = mount(FolderBrowser)
    await flushPromises()
    await flushPromises()
    await nextTick()

    mockGet.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/filesystem/drives') {
        return {
          success: true,
          data: { drives: [{ letter: 'C:', label: 'System', free: 100, total: 500 }, { letter: 'D:', label: 'Data', free: 200, total: 1000 }] }
        }
      }
      return {
        success: true,
        data: { currentPath: 'D:\\Projects', parentPath: 'D:\\', entries: [] }
      }
    })

    await (wrapper.vm as any).loadDirectory('D:\\Projects')
    await flushPromises()
    await nextTick()

    const select = wrapper.find('.drive-select')
    expect((select.element as HTMLSelectElement).value).toBe('D:')
  })

  it('should disable parent button when at root', async () => {
    const wrapper = await mountAndWait({
      currentPath: 'C:\\',
      parentPath: null,
      entries: []
    })

    expect(wrapper.find('.nav-btn').attributes('disabled')).toBeDefined()
  })

  it('should emit select when clicking a directory entry', async () => {
    const wrapper = await mountAndWait({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: [
        { name: 'my-app', path: 'D:\\Projects\\my-app', isDirectory: true }
      ]
    })

    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    expect(items.length).toBeGreaterThan(0)
    await items[0].trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual(['D:\\Projects\\my-app'])
  })

  it('should emit update:modelValue when selecting a directory', async () => {
    const wrapper = await mountAndWait({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: [
        { name: 'my-app', path: 'D:\\Projects\\my-app', isDirectory: true }
      ]
    })

    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    expect(items.length).toBeGreaterThan(0)
    await items[0].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  })

  it('should navigate into directory on double click', async () => {
    let callCount = 0
    mockGet.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/filesystem/drives') {
        return {
          success: true,
          data: { drives: [{ letter: 'D:', label: 'Data', free: 200, total: 1000 }] }
        }
      }
      if (endpoint.startsWith('/filesystem/browse')) {
        callCount++
        if (callCount === 1) {
          return {
            success: true,
            data: {
              currentPath: 'D:\\Projects',
              parentPath: 'D:\\',
              entries: [
                { name: 'my-app', path: 'D:\\Projects\\my-app', isDirectory: true }
              ]
            }
          }
        }
        return {
          success: true,
          data: {
            currentPath: 'D:\\Projects\\my-app',
            parentPath: 'D:\\Projects',
            entries: [
              { name: 'src', path: 'D:\\Projects\\my-app\\src', isDirectory: true }
            ]
          }
        }
      }
      return { success: false }
    })

    const wrapper = mount(FolderBrowser)
    await flushPromises()
    await flushPromises()
    await nextTick()

    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    expect(items.length).toBeGreaterThan(0)
    await items[0].trigger('dblclick')
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.path-text').text()).toBe('D:\\Projects\\my-app')
  })

  it('should show loading state', async () => {
    let resolveBrowse: (value: any) => void
    mockGet.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/filesystem/drives') {
        return {
          success: true,
          data: { drives: [{ letter: 'C:', label: 'System', free: 100, total: 500 }] }
        }
      }
      if (endpoint.startsWith('/filesystem/browse')) {
        return new Promise(resolve => {
          resolveBrowse = resolve
        })
      }
      return { success: false }
    })

    const wrapper = mount(FolderBrowser)
    await flushPromises() // resolve getDrives
    await nextTick()

    expect(wrapper.find('.loading-state').exists()).toBe(true)

    resolveBrowse!({
      success: true,
      data: { currentPath: 'C:\\', parentPath: null, entries: [] }
    })
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.loading-state').exists()).toBe(false)
  })

  it('should show error state when browse fails', async () => {
    mockGet.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/filesystem/drives') {
        return {
          success: true,
          data: { drives: [{ letter: 'C:', label: 'System', free: 100, total: 500 }] }
        }
      }
      if (endpoint.startsWith('/filesystem/browse')) {
        return { success: false, error: 'Access denied' }
      }
      return { success: false }
    })

    const wrapper = mount(FolderBrowser)
    await flushPromises()
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.error-state').exists()).toBe(true)
    expect(wrapper.find('.error-state').text()).toContain('Access denied')
  })

  it('should show retry button on error', async () => {
    mockGet.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/filesystem/drives') {
        return {
          success: true,
          data: { drives: [{ letter: 'C:', label: 'System', free: 100, total: 500 }] }
        }
      }
      if (endpoint.startsWith('/filesystem/browse')) {
        return { success: false, error: 'Network error' }
      }
      return { success: false }
    })

    const wrapper = mount(FolderBrowser)
    await flushPromises()
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.retry-btn').exists()).toBe(true)
  })

  it('should show empty state when no entries and no parent', async () => {
    const wrapper = await mountAndWait({
      currentPath: 'C:\\',
      parentPath: null,
      entries: []
    })

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.empty-state').text()).toContain('No subdirectories found')
  })

  it('should highlight selected directory', async () => {
    const wrapper = await mountAndWait({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: [
        { name: 'app-a', path: 'D:\\Projects\\app-a', isDirectory: true },
        { name: 'app-b', path: 'D:\\Projects\\app-b', isDirectory: true }
      ]
    })

    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    expect(items.length).toBeGreaterThan(1)

    await items[0].trigger('click')

    expect(items[0].classes()).toContain('selected')
    expect(items[1].classes()).not.toContain('selected')
  })

  it('should accept modelValue prop for initial path', async () => {
    mockGet.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/filesystem/drives') {
        return {
          success: true,
          data: { drives: [{ letter: 'D:', label: 'Data', free: 200, total: 1000 }] }
        }
      }
      if (endpoint.startsWith('/filesystem/browse')) {
        return {
          success: true,
          data: { currentPath: 'D:\\Code', parentPath: 'D:\\', entries: [] }
        }
      }
      return { success: false }
    })

    const wrapper = mount(FolderBrowser, {
      props: { modelValue: 'D:\\Code' }
    })
    await flushPromises()
    await flushPromises()
    await nextTick()

    // Verify browseFilesystem was called with the modelValue path
    const browseCalls = mockGet.mock.calls.filter((c: any[]) => c[0].includes('D%3A%5CCode'))
    expect(browseCalls.length).toBeGreaterThan(0)
  })

  it('should browse E: drive correctly', async () => {
    mockGet.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/filesystem/drives') {
        return {
          success: true,
          data: {
            drives: [
              { letter: 'C:', label: 'System', free: 100, total: 500 },
              { letter: 'D:', label: 'Data', free: 200, total: 1000 },
              { letter: 'E:', label: 'External', free: 50, total: 200 }
            ]
          }
        }
      }
      if (endpoint.startsWith('/filesystem/browse')) {
        if (endpoint.includes('E%3A')) {
          return {
            success: true,
            data: {
              currentPath: 'E:\\',
              parentPath: null,
              entries: [
                { name: 'Data', path: 'E:\\Data', isDirectory: true },
                { name: 'Backup', path: 'E:\\Backup', isDirectory: true }
              ]
            }
          }
        }
        return {
          success: true,
          data: { currentPath: 'C:\\Users', parentPath: 'C:\\', entries: [] }
        }
      }
      return { success: false }
    })

    const wrapper = mount(FolderBrowser)
    await flushPromises()
    await flushPromises()
    await nextTick()

    await (wrapper.vm as any).loadDirectory('E:\\')
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.path-text').text()).toBe('E:\\')
    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    expect(items).toHaveLength(2)
  })

  it('should fallback to default drives if getDrives fails', async () => {
    mockGet.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/filesystem/drives') {
        return { success: false, error: 'API error' }
      }
      if (endpoint.startsWith('/filesystem/browse')) {
        return {
          success: true,
          data: { currentPath: 'C:\\', parentPath: null, entries: [] }
        }
      }
      return { success: false }
    })

    const wrapper = mount(FolderBrowser)
    await flushPromises()
    await flushPromises()
    await nextTick()

    // Should still render with fallback drives
    const options = wrapper.findAll('.drive-select option')
    expect(options.length).toBeGreaterThan(0)
  })
})
