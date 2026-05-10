/**
 * AddProjectModal Component Tests
 * Tests for: folder selection sync with manual input, project addition, error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// Use vi.hoisted to create mocks before vi.mock is hoisted
const { mockBrowseFilesystem, mockGetDrives, mockAddProject } = vi.hoisted(() => ({
  mockBrowseFilesystem: vi.fn(),
  mockGetDrives: vi.fn(),
  mockAddProject: vi.fn()
}))

vi.mock('@/api/projects', () => ({
  projectsApi: {
    browseFilesystem: mockBrowseFilesystem,
    getDrives: mockGetDrives
  }
}))

vi.mock('@/stores/projects', () => ({
  useProjectsStore: () => ({
    addProject: mockAddProject
  })
}))

vi.mock('@/stores/ui', () => ({
  useUIStore: () => ({
    t: { value: (key: string) => key }
  })
}))

import AddProjectModal from '@/components/home/AddProjectModal.vue'

describe('AddProjectModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Default mocks
    mockGetDrives.mockResolvedValue([
      { letter: 'C:', label: 'System', free: 100, total: 500 }
    ])
  })

  it('should render modal overlay', () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'C:\\Users',
      parentPath: 'C:\\',
      entries: []
    })

    const wrapper = mount(AddProjectModal)
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
  })

  it('should render modal title', () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'C:\\Users',
      parentPath: 'C:\\',
      entries: []
    })

    const wrapper = mount(AddProjectModal)
    expect(wrapper.find('.modal-title').text()).toBe('home.addProject')
  })

  it('should render FolderBrowser component', () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'C:\\Users',
      parentPath: 'C:\\',
      entries: []
    })

    const wrapper = mount(AddProjectModal)
    expect(wrapper.find('.folder-browser').exists()).toBe(true)
  })

  it('should render manual path input', () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'C:\\Users',
      parentPath: 'C:\\',
      entries: []
    })

    const wrapper = mount(AddProjectModal)
    expect(wrapper.find('.manual-input-section input').exists()).toBe(true)
  })

  it('should render cancel and add buttons', () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'C:\\Users',
      parentPath: 'C:\\',
      entries: []
    })

    const wrapper = mount(AddProjectModal)
    const buttons = wrapper.findAll('.modal-footer .btn')
    expect(buttons).toHaveLength(2)
  })

  it('should emit close when clicking cancel button', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'C:\\Users',
      parentPath: 'C:\\',
      entries: []
    })

    const wrapper = mount(AddProjectModal)
    await flushPromises()

    await wrapper.findAll('.modal-footer .btn')[0].trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('should emit close when clicking overlay', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'C:\\Users',
      parentPath: 'C:\\',
      entries: []
    })

    const wrapper = mount(AddProjectModal)
    await flushPromises()

    await wrapper.find('.modal-overlay').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('should emit close when clicking close button', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'C:\\Users',
      parentPath: 'C:\\',
      entries: []
    })

    const wrapper = mount(AddProjectModal)
    await flushPromises()

    await wrapper.find('.modal-close').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('should disable add button when no path is provided', () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'C:\\Users',
      parentPath: 'C:\\',
      entries: []
    })

    const wrapper = mount(AddProjectModal)
    expect(wrapper.find('.btn-primary').attributes('disabled')).toBeDefined()
  })

  it('should enable add button when manual path is provided', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'C:\\Users',
      parentPath: 'C:\\',
      entries: []
    })

    const wrapper = mount(AddProjectModal)
    await flushPromises()

    await wrapper.find('.manual-input-section input').setValue('D:\\Projects\\my-app')

    expect(wrapper.find('.btn-primary').attributes('disabled')).toBeUndefined()
  })

  it('should sync folder browser selection to manual input', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: [
        { name: 'my-app', path: 'D:\\Projects\\my-app', isDirectory: true }
      ]
    })

    const wrapper = mount(AddProjectModal)
    await flushPromises()
    await nextTick()

    // Select from browser
    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    if (items.length > 0) {
      await items[0].trigger('click')
    }
    await nextTick()

    // Manual input should be synced with the selected path
    const input = wrapper.find('.manual-input-section input')
    expect((input.element as HTMLInputElement).value).toBe('D:\\Projects\\my-app')
  })

  it('should use manual path when provided (takes priority over browser)', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: []
    })
    mockAddProject.mockResolvedValue({ name: 'my-app' })

    const wrapper = mount(AddProjectModal)
    await flushPromises()

    // Type manual path
    await wrapper.find('.manual-input-section input').setValue('D:\\Projects\\my-app')

    // Click add
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(mockAddProject).toHaveBeenCalledWith('D:\\Projects\\my-app')
  })

  it('should use browser selection when no manual path', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: [
        { name: 'my-app', path: 'D:\\Projects\\my-app', isDirectory: true }
      ]
    })
    mockAddProject.mockResolvedValue({ name: 'my-app' })

    const wrapper = mount(AddProjectModal)
    await flushPromises()
    await nextTick()

    // Select from browser
    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    if (items.length > 0) {
      await items[0].trigger('click')
    }

    // Click add
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(mockAddProject).toHaveBeenCalledWith('D:\\Projects\\my-app')
  })

  it('should emit added and close after successful addition', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: [
        { name: 'my-app', path: 'D:\\Projects\\my-app', isDirectory: true }
      ]
    })
    mockAddProject.mockResolvedValue({ name: 'my-app' })

    const wrapper = mount(AddProjectModal)
    await flushPromises()
    await nextTick()

    // Select from browser
    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    if (items.length > 0) {
      await items[0].trigger('click')
    }

    // Click add
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('added')).toBeTruthy()
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('should show error message when addition fails', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: [
        { name: 'my-app', path: 'D:\\Projects\\my-app', isDirectory: true }
      ]
    })
    mockAddProject.mockRejectedValue(new Error('Project already exists'))

    const wrapper = mount(AddProjectModal)
    await flushPromises()
    await nextTick()

    // Select from browser
    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    if (items.length > 0) {
      await items[0].trigger('click')
    }

    // Click add
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(wrapper.find('.error-text').exists()).toBe(true)
    expect(wrapper.find('.error-text').text()).toBe('Project already exists')
  })

  it('should not emit added when addition fails', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: [
        { name: 'my-app', path: 'D:\\Projects\\my-app', isDirectory: true }
      ]
    })
    mockAddProject.mockRejectedValue(new Error('Failed'))

    const wrapper = mount(AddProjectModal)
    await flushPromises()
    await nextTick()

    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    if (items.length > 0) {
      await items[0].trigger('click')
    }

    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('added')).toBeFalsy()
    expect(wrapper.emitted('close')).toBeFalsy()
  })

  it('should show spinner while adding', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: [
        { name: 'my-app', path: 'D:\\Projects\\my-app', isDirectory: true }
      ]
    })

    let resolveAdd: (value: any) => void
    mockAddProject.mockImplementation(() => new Promise(resolve => {
      resolveAdd = resolve
    }))

    const wrapper = mount(AddProjectModal)
    await flushPromises()
    await nextTick()

    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    if (items.length > 0) {
      await items[0].trigger('click')
    }

    await wrapper.find('.btn-primary').trigger('click')

    // Should show spinner
    expect(wrapper.find('.spinner').exists()).toBe(true)

    // Resolve the promise
    resolveAdd!({ name: 'my-app' })
    await flushPromises()
  })

  it('should allow adding project by pressing Enter in manual input', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: []
    })
    mockAddProject.mockResolvedValue({ name: 'my-app' })

    const wrapper = mount(AddProjectModal)
    await flushPromises()

    // Type manual path and press Enter
    const input = wrapper.find('.manual-input-section input')
    await input.setValue('D:\\Projects\\my-app')
    await input.trigger('keyup.enter')
    await flushPromises()

    expect(mockAddProject).toHaveBeenCalledWith('D:\\Projects\\my-app')
  })

  it('should trim whitespace from manual path', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: []
    })
    mockAddProject.mockResolvedValue({ name: 'my-app' })

    const wrapper = mount(AddProjectModal)
    await flushPromises()

    // Type path with whitespace
    await wrapper.find('.manual-input-section input').setValue('  D:\\Projects\\my-app  ')
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(mockAddProject).toHaveBeenCalledWith('D:\\Projects\\my-app')
  })

  it('should clear error when retrying addition', async () => {
    mockBrowseFilesystem.mockResolvedValue({
      currentPath: 'D:\\Projects',
      parentPath: 'D:\\',
      entries: [
        { name: 'my-app', path: 'D:\\Projects\\my-app', isDirectory: true }
      ]
    })

    mockAddProject
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce({ name: 'my-app' })

    const wrapper = mount(AddProjectModal)
    await flushPromises()
    await nextTick()

    // First attempt - fails
    const items = wrapper.findAll('.directory-item:not(.parent-item)')
    if (items.length > 0) {
      await items[0].trigger('click')
    }

    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(wrapper.find('.error-text').exists()).toBe(true)

    // Second attempt - should clear error
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    // Error should be gone after successful attempt
    expect(wrapper.find('.error-text').exists()).toBe(false)
  })

  it('should navigate to different disk in folder browser', async () => {
    mockBrowseFilesystem.mockResolvedValueOnce({
      currentPath: 'C:\\Users',
      parentPath: 'C:\\',
      entries: []
    })

    const wrapper = mount(AddProjectModal)
    await flushPromises()

    // Navigate to D: drive
    mockBrowseFilesystem.mockResolvedValueOnce({
      currentPath: 'D:\\',
      parentPath: null,
      entries: [
        { name: 'Projects', path: 'D:\\Projects', isDirectory: true }
      ]
    })

    // Access the FolderBrowser component and trigger navigation
    const folderBrowser = wrapper.findComponent({ name: 'FolderBrowser' })
    await (folderBrowser.vm as any).loadDirectory('D:\\')
    await flushPromises()

    expect(mockBrowseFilesystem).toHaveBeenCalledWith('D:\\')
  })
})
