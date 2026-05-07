import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Project } from '@/types'
import { projectsApi } from '@/api/projects'

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProjects() {
    loading.value = true
    error.value = null
    try {
      const response = await projectsApi.getProjects()
      projects.value = response.projects
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  function setProjects(list: Project[]) {
    projects.value = list
  }

  function setCurrentProject(project: Project | null) {
    currentProject.value = project
  }

  function getProjectByName(name: string): Project | undefined {
    return projects.value.find(p => p.name === name)
  }

  async function addProject(projectPath: string): Promise<Project> {
    const project = await projectsApi.addProject(projectPath)
    projects.value.push(project)
    return project
  }

  async function removeProject(name: string): Promise<void> {
    await projectsApi.deleteProject(name)
    projects.value = projects.value.filter(p => p.name !== name)
    if (currentProject.value?.name === name) {
      currentProject.value = null
    }
  }

  return {
    projects,
    currentProject,
    loading,
    error,
    fetchProjects,
    setProjects,
    setCurrentProject,
    getProjectByName,
    addProject,
    removeProject
  }
})
