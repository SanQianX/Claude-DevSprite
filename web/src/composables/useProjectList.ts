import { computed } from 'vue'
import { useProjectsStore } from '@/stores/projects'

export function useProjectList() {
  const projectsStore = useProjectsStore()

  const projects = computed(() => projectsStore.projects)
  const loading = computed(() => projectsStore.loading)
  const error = computed(() => projectsStore.error)
  const currentProject = computed(() => projectsStore.currentProject)

  async function fetchProjects() {
    await projectsStore.fetchProjects()
  }

  function getProjectByName(name: string) {
    return projectsStore.getProjectByName(name)
  }

  function setCurrentProject(project: any) {
    projectsStore.setCurrentProject(project)
  }

  return {
    projects,
    loading,
    error,
    currentProject,
    fetchProjects,
    getProjectByName,
    setCurrentProject
  }
}
