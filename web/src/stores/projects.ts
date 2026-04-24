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

  return {
    projects,
    currentProject,
    loading,
    error,
    fetchProjects,
    setProjects,
    setCurrentProject,
    getProjectByName
  }
})
