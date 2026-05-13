<template>
  <div class="settings-page">
    <AppHeader />

    <div class="settings-content">
      <div class="settings-header">
        <router-link to="/" class="back-link">← Back</router-link>
        <h1 class="page-title">System Settings</h1>
      </div>

      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >{{ tab.label }}</button>
      </div>

      <!-- AI Model Config -->
      <div v-if="activeTab === 'ai'" class="tab-panel">
        <div class="section">
          <h3 class="section-title">Shared Configuration</h3>
          <p class="section-desc">Base AI settings shared by both scanner and fixer agents.</p>

          <div class="form-group">
            <label class="form-label">Base URL</label>
            <input v-model="aiConfig.baseUrl" class="form-input" placeholder="https://api.anthropic.com" />
            <span class="form-hint">Leave empty for default Anthropic endpoint</span>
          </div>
          <div class="form-group">
            <label class="form-label">API Key</label>
            <div class="input-with-btn">
              <input
                v-model="aiConfig.apiKey"
                class="form-input"
                :type="showApiKey ? 'text' : 'password'"
                placeholder="sk-ant-..."
              />
              <button class="btn-sm" @click="showApiKey = !showApiKey">
                {{ showApiKey ? 'Hide' : 'Show' }}
              </button>
            </div>
            <span class="form-hint">Stored in environment variables, not in config file</span>
          </div>
          <div class="form-group">
            <label class="form-label">Max Retries</label>
            <input v-model.number="aiConfig.maxRetries" class="form-input" type="number" min="0" max="10" />
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">Scanner Agent</h3>
          <p class="section-desc">AI model used for design consistency analysis (finds issues only). Leave fields empty to inherit shared settings.</p>

          <div class="form-group">
            <label class="form-label">Scanner Model</label>
            <input v-model="aiConfig.scannerModel" class="form-input" placeholder="e.g. claude-sonnet-4-6" />
            <span class="form-hint">Leave empty to use the default model above</span>
          </div>
          <div class="form-group">
            <label class="form-label">Scanner API Key</label>
            <div class="input-with-btn">
              <input
                v-model="aiConfig.scannerApiKey"
                class="form-input"
                :type="showScannerApiKey ? 'text' : 'password'"
                placeholder="Leave empty to inherit shared key"
              />
              <button class="btn-sm" @click="showScannerApiKey = !showScannerApiKey">
                {{ showScannerApiKey ? 'Hide' : 'Show' }}
              </button>
            </div>
            <span class="form-hint">Per-agent key overrides the shared API key for this agent</span>
          </div>
          <div class="form-group">
            <label class="form-label">Scanner Base URL</label>
            <input v-model="aiConfig.scannerBaseUrl" class="form-input" placeholder="Leave empty to inherit shared base URL" />
            <span class="form-hint">Custom endpoint for this agent (e.g. a different provider)</span>
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">Fixer Agent</h3>
          <p class="section-desc">AI model used for code fix generation (fixes issues + git commit). Leave fields empty to inherit shared settings.</p>

          <div class="form-group">
            <label class="form-label">Fixer Model</label>
            <input v-model="aiConfig.fixerModel" class="form-input" placeholder="e.g. claude-haiku-4-5-20251001" />
            <span class="form-hint">Leave empty to use the default model above</span>
          </div>
          <div class="form-group">
            <label class="form-label">Fixer API Key</label>
            <div class="input-with-btn">
              <input
                v-model="aiConfig.fixerApiKey"
                class="form-input"
                :type="showFixerApiKey ? 'text' : 'password'"
                placeholder="Leave empty to inherit shared key"
              />
              <button class="btn-sm" @click="showFixerApiKey = !showFixerApiKey">
                {{ showFixerApiKey ? 'Hide' : 'Show' }}
              </button>
            </div>
            <span class="form-hint">Per-agent key overrides the shared API key for this agent</span>
          </div>
          <div class="form-group">
            <label class="form-label">Fixer Base URL</label>
            <input v-model="aiConfig.fixerBaseUrl" class="form-input" placeholder="Leave empty to inherit shared base URL" />
            <span class="form-hint">Custom endpoint for this agent (e.g. a different provider)</span>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn-primary" @click="saveAiConfig" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save AI Config' }}
          </button>
          <button class="btn-secondary" @click="testAiConnection" :disabled="testing">
            {{ testing ? 'Testing...' : 'Test Connection' }}
          </button>
        </div>
        <div v-if="aiTestResult" class="test-result" :class="aiTestResult.success ? 'success' : 'error'">
          {{ aiTestResult.message }}
        </div>
      </div>

      <!-- Agent Teams Config -->
      <div v-if="activeTab === 'teams'" class="tab-panel">
        <div class="section">
          <h3 class="section-title">Agent Teams</h3>
          <p class="section-desc">Configure the Lead, Dev, and Test agent teams.</p>

          <div v-if="teamsLoading" class="loading-text">Loading teams...</div>
          <div v-else-if="teamsError" class="error-text">{{ teamsError }}</div>
          <template v-else>
            <div v-for="team in teams" :key="team.name" class="team-card">
              <div class="team-card-header">
                <h4 class="team-name">{{ team.displayName }}</h4>
                <button class="btn-sm" @click="testTeamConnection(team.name)" :disabled="teamTesting === team.name">
                  {{ teamTesting === team.name ? 'Testing...' : 'Test' }}
                </button>
              </div>
              <div class="team-card-body">
                <div class="form-row">
                  <div class="form-group flex-1">
                    <label class="form-label">Model</label>
                    <input v-model="team.model" class="form-input" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Max Turns</label>
                    <input v-model.number="team.maxTurns" class="form-input" type="number" min="1" max="100" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Timeout (ms)</label>
                    <input v-model.number="team.timeout" class="form-input" type="number" min="5000" step="5000" />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Skills</label>
                  <div class="skills-list">
                    <span v-for="skill in team.skills || []" :key="skill" class="skill-tag">
                      {{ skill }}
                      <button class="skill-remove" @click="removeSkill(team, skill)">×</button>
                    </span>
                    <span v-if="!team.skills || team.skills.length === 0" class="no-skills">No skills configured</span>
                  </div>
                  <div class="add-skill-row">
                    <input
                      v-model="newSkillInputs[team.name]"
                      class="form-input skill-input"
                      placeholder="Add skill name..."
                      @keydown.enter="addSkill(team)"
                    />
                    <button class="btn-sm" @click="addSkill(team)">Add</button>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Allowed Tools</label>
                  <div class="tools-list">
                    <code v-for="tool in team.allowedTools" :key="tool" class="tool-tag">{{ tool }}</code>
                  </div>
                </div>
                <div class="form-actions">
                  <button class="btn-primary" @click="saveTeam(team)" :disabled="teamSaving === team.name">
                    {{ teamSaving === team.name ? 'Saving...' : 'Save' }}
                  </button>
                </div>
              </div>
              <div v-if="teamTestResults[team.name]" class="test-result" :class="teamTestResults[team.name].success ? 'success' : 'error'">
                {{ teamTestResults[team.name].message }}
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Skills Config -->
      <div v-if="activeTab === 'skills'" class="tab-panel">
        <div class="section">
          <h3 class="section-title">Installed Skills</h3>
          <p class="section-desc">Skills are capabilities that can be assigned to agent teams.</p>

          <div class="skill-inventory">
            <div v-for="skill in availableSkills" :key="skill.name" class="skill-inventory-card">
              <div class="skill-inventory-header">
                <h4>{{ skill.name }}</h4>
                <span class="skill-status" :class="skill.installed ? 'installed' : 'available'">
                  {{ skill.installed ? 'Installed' : 'Available' }}
                </span>
              </div>
              <p class="skill-desc">{{ skill.description }}</p>
              <div class="skill-teams">
                Used by: {{ skill.usedBy.length > 0 ? skill.usedBy.join(', ') : 'No teams' }}
              </div>
              <div class="skill-actions">
                <button class="btn-sm" @click="testSkill(skill.name)" :disabled="skillTesting === skill.name">
                  {{ skillTesting === skill.name ? 'Testing...' : 'Test Skill' }}
                </button>
              </div>
              <div v-if="skillTestResults[skill.name]" class="test-result" :class="skillTestResults[skill.name].success ? 'success' : 'error'">
                {{ skillTestResults[skill.name].message }}
              </div>
            </div>
            <div v-if="availableSkills.length === 0" class="empty-text">
              No skills discovered. Skills are configured via team configurations.
            </div>
          </div>
        </div>
      </div>

      <!-- System Config -->
      <div v-if="activeTab === 'system'" class="tab-panel">
        <div class="section">
          <h3 class="section-title">System Configuration</h3>
          <p class="section-desc">General system settings. Some changes require a restart.</p>

          <div class="form-group">
            <label class="form-label">Log Level</label>
            <select v-model="systemConfig.loggingLevel" class="form-input">
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Analysis Mode</label>
            <select v-model="systemConfig.analysisMode" class="form-input">
              <option value="incremental">Incremental</option>
              <option value="full">Full</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Diff Max Tokens</label>
            <input v-model.number="systemConfig.diffMaxTokens" class="form-input" type="number" min="1000" step="1000" />
          </div>
          <div class="form-group">
            <label class="form-label">Auto Discover Projects</label>
            <label class="toggle-label">
              <input type="checkbox" v-model="systemConfig.autoDiscover" />
              <span>Scan for new projects on startup</span>
            </label>
          </div>
          <div class="form-group">
            <label class="form-label">Detection Strategy</label>
            <select v-model="systemConfig.detectionStrategy" class="form-input">
              <option value="hook">Hook</option>
              <option value="watcher">Watcher</option>
              <option value="poller">Poller</option>
            </select>
          </div>
          <div class="form-actions">
            <button class="btn-primary" @click="saveSystemConfig" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save System Config' }}
            </button>
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">Configuration Info</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Database Path</span>
              <code class="info-value">{{ rawConfig.dbPath || '-' }}</code>
            </div>
            <div class="info-item">
              <span class="info-label">Knowledge Directory</span>
              <code class="info-value">{{ rawConfig.knowledge?.directoryName || 'knowledge' }}</code>
            </div>
            <div class="info-item">
              <span class="info-label">Server</span>
              <code class="info-value">{{ rawConfig.server?.host || 'localhost' }}:{{ rawConfig.server?.port || 38888 }}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { configApi, type SystemConfig } from '@/api/config'
import { teamsApi, type TeamConfig } from '@/api/teams'

const tabs = [
  { key: 'ai', label: 'AI Model' },
  { key: 'teams', label: 'Agent Teams' },
  { key: 'skills', label: 'Skills' },
  { key: 'system', label: 'System' },
]

const activeTab = ref('ai')
const saving = ref(false)
const rawConfig = ref<SystemConfig>({})

// AI Config
const aiConfig = reactive({
  model: '',
  baseUrl: '',
  apiKey: '',
  maxRetries: 3,
  scannerModel: '',
  fixerModel: '',
  scannerApiKey: '',
  scannerBaseUrl: '',
  fixerApiKey: '',
  fixerBaseUrl: '',
})
const showApiKey = ref(false)
const showScannerApiKey = ref(false)
const showFixerApiKey = ref(false)
const testing = ref(false)
const aiTestResult = ref<{ success: boolean; message: string } | null>(null)

// Teams
const teams = ref<TeamConfig[]>([])
const teamsLoading = ref(false)
const teamsError = ref('')
const teamSaving = ref('')
const teamTesting = ref('')
const teamTestResults = reactive<Record<string, { success: boolean; message: string }>>({})
const newSkillInputs = reactive<Record<string, string>>({})

// Skills
const availableSkills = ref<{ name: string; description: string; installed: boolean; usedBy: string[] }[]>([])
const skillTesting = ref('')
const skillTestResults = reactive<Record<string, { success: boolean; message: string }>>({})

// System
const systemConfig = reactive({
  loggingLevel: 'info',
  analysisMode: 'incremental',
  diffMaxTokens: 8000,
  autoDiscover: true,
  detectionStrategy: 'hook',
})

onMounted(async () => {
  await Promise.all([loadConfig(), loadTeams()])
})

async function loadConfig() {
  try {
    const cfg = await configApi.get()
    rawConfig.value = cfg
    // Populate system config
    systemConfig.loggingLevel = cfg.logging?.level || 'info'
    systemConfig.analysisMode = cfg.analysis?.mode || 'incremental'
    systemConfig.diffMaxTokens = cfg.analysis?.diffMaxTokens || 8000
    systemConfig.autoDiscover = cfg.projectDiscovery?.autoDiscover ?? true
    systemConfig.detectionStrategy = cfg.detection?.preferredStrategy || 'hook'
    // AI config from ai section
    aiConfig.model = cfg.ai?.model || ''
    aiConfig.baseUrl = cfg.ai?.baseUrl || ''
    // Show masked key so user knows a key is saved; empty string means nothing saved
    aiConfig.apiKey = cfg.ai?.maskedApiKey || ''
    aiConfig.maxRetries = cfg.ai?.maxRetries || cfg.analysis?.maxRetries || 3
    aiConfig.scannerModel = cfg.ai?.scannerModel || ''
    aiConfig.fixerModel = cfg.ai?.fixerModel || ''
    aiConfig.scannerApiKey = cfg.ai?.scanner?.maskedApiKey || ''
    aiConfig.scannerBaseUrl = cfg.ai?.scanner?.baseUrl || ''
    aiConfig.fixerApiKey = cfg.ai?.fixer?.maskedApiKey || ''
    aiConfig.fixerBaseUrl = cfg.ai?.fixer?.baseUrl || ''
  } catch (e: any) {
    console.error('Failed to load config:', e)
  }
}

async function loadTeams() {
  teamsLoading.value = true
  teamsError.value = ''
  try {
    teams.value = await teamsApi.getAll()
    buildSkillInventory()
  } catch (e: any) {
    teamsError.value = e.message || 'Failed to load teams'
  } finally {
    teamsLoading.value = false
  }
}

function buildSkillInventory() {
  const skillMap = new Map<string, { name: string; description: string; usedBy: string[] }>()
  for (const team of teams.value) {
    for (const skill of team.skills || []) {
      if (!skillMap.has(skill)) {
        skillMap.set(skill, { name: skill, description: `Skill: ${skill}`, usedBy: [] })
      }
      skillMap.get(skill)!.usedBy.push(team.displayName)
    }
  }
  availableSkills.value = Array.from(skillMap.values()).map(s => ({
    ...s,
    installed: true,
  }))

  // Add known skills that might not be in config yet
  const known = ['playwright', 'code-review', 'test-generator']
  for (const k of known) {
    if (!skillMap.has(k)) {
      availableSkills.value.push({ name: k, description: `Available skill: ${k}`, installed: false, usedBy: [] })
    }
  }
}

function addSkill(team: TeamConfig) {
  const name = newSkillInputs[team.name]?.trim()
  if (!name) return
  if (!team.skills) team.skills = []
  if (!team.skills.includes(name)) {
    team.skills.push(name)
  }
  newSkillInputs[team.name] = ''
}

function removeSkill(team: TeamConfig, skill: string) {
  if (team.skills) {
    team.skills = team.skills.filter(s => s !== skill)
  }
}

async function saveAiConfig() {
  saving.value = true
  try {
    // If apiKey still contains "..." (masked), it means user didn't edit it.
    // Send empty so backend keeps the existing saved key.
    const apiKeyToSend = aiConfig.apiKey.includes('...') ? '' : aiConfig.apiKey
    const scannerApiKeyToSend = aiConfig.scannerApiKey.includes('...') ? '' : aiConfig.scannerApiKey
    const fixerApiKeyToSend = aiConfig.fixerApiKey.includes('...') ? '' : aiConfig.fixerApiKey

    // Build per-agent payloads (only send when user typed something new)
    const scannerPayload = (scannerApiKeyToSend || aiConfig.scannerBaseUrl || aiConfig.scannerModel) ? {
      model: aiConfig.scannerModel || undefined,
      apiKey: scannerApiKeyToSend || undefined,
      baseUrl: aiConfig.scannerBaseUrl || undefined,
    } : undefined
    const fixerPayload = (fixerApiKeyToSend || aiConfig.fixerBaseUrl || aiConfig.fixerModel) ? {
      model: aiConfig.fixerModel || undefined,
      apiKey: fixerApiKeyToSend || undefined,
      baseUrl: aiConfig.fixerBaseUrl || undefined,
    } : undefined

    await configApi.saveAI({
      model: aiConfig.model,
      baseUrl: aiConfig.baseUrl,
      apiKey: apiKeyToSend,
      maxRetries: aiConfig.maxRetries,
      scannerModel: aiConfig.scannerModel || undefined,
      fixerModel: aiConfig.fixerModel || undefined,
      scanner: scannerPayload,
      fixer: fixerPayload,
    })
    // Reload to reflect saved state (shows masked key again)
    await loadConfig()
  } catch (e: any) {
    alert('Save failed: ' + e.message)
  } finally {
    saving.value = false
  }
}

async function testAiConnection() {
  testing.value = true
  aiTestResult.value = null
  try {
    // If apiKey is masked (contains "..."), don't send it — let backend use the real saved key.
    // If user typed a new key, send it for testing.
    const apiKeyToSend = aiConfig.apiKey.includes('...') ? undefined : (aiConfig.apiKey || undefined)

    const result = await configApi.testAI({
      model: aiConfig.model || undefined,
      baseUrl: aiConfig.baseUrl || undefined,
      apiKey: apiKeyToSend,
    })
    aiTestResult.value = result
  } catch (e: any) {
    aiTestResult.value = { success: false, message: e.message || 'Connection test failed' }
  } finally {
    testing.value = false
  }
}

async function saveTeam(team: TeamConfig) {
  teamSaving.value = team.name
  try {
    await teamsApi.update(team.name, {
      model: team.model,
      maxTurns: team.maxTurns,
      allowedTools: team.allowedTools,
      disallowedTools: team.disallowedTools,
      timeout: team.timeout,
      skills: team.skills,
    })
  } catch (e: any) {
    alert('Save failed: ' + e.message)
  } finally {
    teamSaving.value = ''
  }
}

async function testTeamConnection(name: string) {
  teamTesting.value = name
  teamTestResults[name] = undefined as any
  try {
    const result = await teamsApi.test(name)
    teamTestResults[name] = result
  } catch (e: any) {
    teamTestResults[name] = { success: false, message: e.message || 'Test failed' }
  } finally {
    teamTesting.value = ''
  }
}

async function testSkill(name: string) {
  skillTesting.value = name
  skillTestResults[name] = undefined as any
  try {
    const result = await teamsApi.test('test')
    skillTestResults[name] = { success: result.success, message: `${name}: ${result.message}` }
  } catch (e: any) {
    skillTestResults[name] = { success: false, message: e.message || 'Skill test failed' }
  } finally {
    skillTesting.value = ''
  }
}

async function saveSystemConfig() {
  saving.value = true
  try {
    await configApi.patch({
      logging: { level: systemConfig.loggingLevel },
      analysis: {
        mode: systemConfig.analysisMode as any,
        diffMaxTokens: systemConfig.diffMaxTokens,
        maxRetries: rawConfig.analysis?.maxRetries || 3,
        fullAnalysisIntervalDays: rawConfig.analysis?.fullAnalysisIntervalDays || 30,
        fullAnalysisTriggers: undefined as any,
      },
      detection: {
        preferredStrategy: systemConfig.detectionStrategy as any,
        pollerIntervalMs: rawConfig.detection?.pollerIntervalMs || 5000,
      },
      projectDiscovery: {
        knowledgeDirName: rawConfig.projectDiscovery?.knowledgeDirName || 'knowledge',
        autoDiscover: systemConfig.autoDiscover,
        maxDepth: rawConfig.projectDiscovery?.maxDepth || 3,
        scanPaths: rawConfig.projectDiscovery?.scanPaths || [],
      },
    })
  } catch (e: any) {
    alert('Save failed: ' + e.message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: var(--color-bg-primary, #fff);
}

.settings-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.back-link {
  font-size: 14px;
  color: var(--color-text-link, #0969da);
  text-decoration: none;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-border);
  margin-bottom: 24px;
}

.tab-btn {
  padding: 10px 20px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary, #656d76);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  font-family: inherit;
}

.tab-btn:hover {
  color: var(--color-text-primary, #1f2328);
}

.tab-btn.active {
  color: var(--color-text-link, #0969da);
  border-bottom-color: var(--color-text-link, #0969da);
}

.tab-panel {
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.section {
  background: var(--color-bg-primary, #fff);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px;
}

.section-desc {
  font-size: 13px;
  color: var(--color-text-secondary, #656d76);
  margin: 0 0 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--color-text-primary, #1f2328);
}

.form-input {
  width: 100%;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  background: var(--color-bg-primary, #fff);
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-text-link, #0969da);
  box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.2);
}

select.form-input {
  appearance: auto;
}

.form-hint {
  display: block;
  font-size: 12px;
  color: var(--color-text-secondary, #656d76);
  margin-top: 4px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.flex-1 { flex: 1; }

.input-with-btn {
  display: flex;
  gap: 8px;
}

.input-with-btn .form-input {
  flex: 1;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn-primary {
  padding: 8px 20px;
  background: #2da44e;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
}

.btn-primary:hover { background: #2c974b; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 8px 20px;
  background: var(--color-bg-secondary, #f6f8fa);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
}

.btn-secondary:hover { background: var(--color-bg-tertiary, #f0f2f5); }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-sm {
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-secondary, #f6f8fa);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}

.btn-sm:hover { background: var(--color-bg-tertiary, #f0f2f5); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

.test-result {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.test-result.success {
  background: #dafbe1;
  color: #1a7f37;
}

.test-result.error {
  background: #ffebe9;
  color: #cf222e;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

/* Team cards */
.team-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
}

.team-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-bg-secondary, #f6f8fa);
  border-bottom: 1px solid var(--color-border);
}

.team-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.team-card-body {
  padding: 16px;
}

.skills-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.skill-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  background: #ddf4ff;
  color: #0969da;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.skill-remove {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #0969da;
  padding: 0;
  line-height: 1;
}

.no-skills {
  font-size: 12px;
  color: var(--color-text-secondary, #656d76);
}

.add-skill-row {
  display: flex;
  gap: 8px;
}

.skill-input {
  max-width: 250px;
}

.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tool-tag {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--color-bg-tertiary, #f0f2f5);
  border-radius: 4px;
  color: var(--color-text-secondary, #656d76);
}

/* Skills inventory */
.skill-inventory {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.skill-inventory-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
}

.skill-inventory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.skill-inventory-header h4 {
  margin: 0;
  font-size: 14px;
}

.skill-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.skill-status.installed {
  background: #dafbe1;
  color: #1a7f37;
}

.skill-status.available {
  background: var(--color-bg-tertiary, #f0f2f5);
  color: var(--color-text-secondary, #656d76);
}

.skill-desc {
  font-size: 13px;
  color: var(--color-text-secondary, #656d76);
  margin: 0 0 8px;
}

.skill-teams {
  font-size: 12px;
  color: var(--color-text-secondary, #656d76);
  margin-bottom: 12px;
}

.skill-actions {
  display: flex;
  gap: 8px;
}

/* Info grid */
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.info-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #656d76);
  min-width: 160px;
}

.info-value {
  font-size: 13px;
  color: var(--color-text-primary, #1f2328);
}

.loading-text, .error-text, .empty-text {
  padding: 20px;
  text-align: center;
  color: var(--color-text-secondary, #656d76);
}

.error-text {
  color: #cf222e;
}

@media (max-width: 640px) {
  .form-row {
    flex-direction: column;
  }
  .skill-inventory {
    grid-template-columns: 1fr;
  }
}
</style>
