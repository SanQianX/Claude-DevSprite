/**
 * ProjectCard Component Tests
 * Tests for: project deletion, delete confirmation, error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Project } from '../../../src/types'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock the stores
const { mockRemoveProject } = vi.hoisted(() => ({
  mockRemoveProject: vi.fn()
}))

vi.mock('@/stores/projects', () => ({
  useProjectsStore: () => ({
    removeProject: mockRemoveProject
  })
}))

vi.mock('@/stores/analysis', () => ({
  useAnalysisStore: () => ({
    progress: { value: { status: 'idle', projectName: '', currentStep: '' } }
  })
}))

vi.mock('@/stores/ui', () => ({
  useUIStore: () => ({
    t: { value: (key: string, params?: any) => params ? `${key}:${JSON.stringify(params)}` : key }
  })
}))

import ProjectCard from '@/components/home/ProjectCard.vue'

describe('ProjectCard', () => {
  const mockProject: Project = {
    name: 'test-project',
    path: 'D:\\Projects\\test-project',
    description: 'Git repository',
    documentCount: 5,
    lastUpdated: '2026-05-07T10:00:00Z',
    color: '#3b82f6'
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should render project name', () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    expect(wrapper.find('.project-name').text()).toBe('test-project')
  })

  it('should render project icon with first letter', () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    expect(wrapper.find('.project-icon').text()).toBe('T')
  })

  it('should render project icon with custom color', () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    expect(wrapper.find('.project-icon').attributes('style')).toContain('background-color: #3b82f6')
  })

  it('should display document count', () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    expect(wrapper.find('.cell-docs').text()).toBe('5')
  })

  it('should display repo type badge', () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    expect(wrapper.find('.repo-badge').text()).toBe('Git')
  })

  it('should display Local badge for non-git projects', () => {
    const localProject = { ...mockProject, description: 'Local project' }
    const wrapper = mount(ProjectCard, {
      props: { project: localProject }
    })

    expect(wrapper.find('.repo-badge').text()).toBe('Local')
  })

  it('should have delete button with correct title', () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    expect(wrapper.find('.action-delete').attributes('title')).toBe('common.delete')
  })

  it('should call removeProject when delete is confirmed', async () => {
    mockRemoveProject.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    await wrapper.find('.action-delete').trigger('click')
    await flushPromises()

    expect(window.confirm).toHaveBeenCalled()
    expect(mockRemoveProject).toHaveBeenCalledWith('test-project')
  })

  it('should not call removeProject when delete is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    await wrapper.find('.action-delete').trigger('click')
    await flushPromises()

    expect(window.confirm).toHaveBeenCalled()
    expect(mockRemoveProject).not.toHaveBeenCalled()
  })

  it('should emit deleted event after successful deletion', async () => {
    mockRemoveProject.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    await wrapper.find('.action-delete').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('deleted')).toBeTruthy()
  })

  it('should show alert when deletion fails', async () => {
    mockRemoveProject.mockRejectedValue(new Error('Delete failed'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})

    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    await wrapper.find('.action-delete').trigger('click')
    await flushPromises()

    expect(window.alert).toHaveBeenCalledWith('home.deleteFailed')
  })

  it('should not emit deleted event when deletion fails', async () => {
    mockRemoveProject.mockRejectedValue(new Error('Delete failed'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})

    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    await wrapper.find('.action-delete').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('deleted')).toBeFalsy()
  })

  it('should show delete confirmation message with project name', async () => {
    mockRemoveProject.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    await wrapper.find('.action-delete').trigger('click')

    expect(window.confirm).toHaveBeenCalledWith('home.deleteConfirm:{"name":"test-project"}')
  })

  it('should navigate to project page when clicking project row', async () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    await wrapper.find('.cell-project').trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/project/test-project')
  })

  it('should navigate to chat when clicking chat button', async () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    await wrapper.find('.action-chat').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({ path: '/chat', query: { project: 'test-project' } })
  })

  it('should format date as Today for recent dates', () => {
    const today = new Date().toISOString()
    const recentProject = { ...mockProject, lastUpdated: today }

    const wrapper = mount(ProjectCard, {
      props: { project: recentProject }
    })

    expect(wrapper.find('.update-time').text()).toBe('Today')
  })

  it('should format date as Yesterday for yesterday', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const recentProject = { ...mockProject, lastUpdated: yesterday.toISOString() }

    const wrapper = mount(ProjectCard, {
      props: { project: recentProject }
    })

    expect(wrapper.find('.update-time').text()).toBe('Yesterday')
  })

  it('should show Never when no lastUpdated', () => {
    const noUpdateProject = { ...mockProject, lastUpdated: '' }

    const wrapper = mount(ProjectCard, {
      props: { project: noUpdateProject }
    })

    expect(wrapper.find('.update-time').text()).toBe('Never')
  })

  it('should display short path', () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject }
    })

    expect(wrapper.find('.update-path').text()).toBe('D:\\Projects\\test-project')
  })

  it('should truncate long paths', () => {
    const longPathProject = {
      ...mockProject,
      path: 'C:\\Users\\very-long-username\\Documents\\Projects\\my-awesome-project-name'
    }

    const wrapper = mount(ProjectCard, {
      props: { project: longPathProject }
    })

    const displayedPath = wrapper.find('.update-path').text()
    expect(displayedPath).toContain('...')
  })
})
