/**
 * Prompt Templates
 * Defines templates for AI analysis prompts
 */

export const PROMPT_TEMPLATES = {
  fullAnalysis: `# Full Project Analysis Request

You are an expert software architect analyzing a complete codebase to generate a comprehensive knowledge base.

## Project: {{projectName}}
## Root Path: {{projectRoot}}

## Project Structure
{{projectStructure}}

## Key Source Files
{{sourceFiles}}

## Existing Knowledge
{{previousKnowledge}}

---

Please analyze this project and generate a comprehensive knowledge base. Generate the following documents:

1. **project-overview/01-overview.md** - Project overview: what it does, its purpose, and core value proposition
2. **project-overview/02-architecture.md** - System architecture: main components, data flow, how they connect
3. **project-overview/03-modules.md** - Module breakdown: key modules, their responsibilities and APIs
4. **project-overview/04-tech-stack.md** - Technology stack: frameworks, libraries, tools used, and why
5. **features/*.md** - One document per major feature, explaining how it works

IMPORTANT: Respond ONLY with valid JSON in this exact format (no markdown code blocks, no extra text):
{
  "documents": [
    {
      "path": "project-overview/01-overview.md",
      "title": "项目概览",
      "category": "overview",
      "content": "---\\ntitle: 项目概览\\ncategory: overview\\n---\\n\\n# 项目概览\\n\\n...detailed content here...",
      "relations": []
    }
  ]
}

Requirements:
- Each document should have YAML frontmatter with title and category
- Use Chinese (中文) for document content and titles since this is a Chinese project
- Include source file references using the format: [source](/project/{{projectName}}/source?path=src/some/file.ts)
- Content should be detailed and informative, not just summaries
- Each document should be at least 200 characters of meaningful content
- Use markdown headers, lists, code blocks for structure
- The relations array should link related documents using paths`,

  incrementalAnalysis: `# Incremental Analysis Request

You are analyzing specific code changes after a git commit to update the project's knowledge base.

## Project: {{projectName}}
## Commit Message
{{commitMessage}}

## Changed Files
{{changedFiles}}

## Previous Knowledge
{{previousKnowledge}}

---

Please analyze these changes and determine what knowledge base documents need to be created or updated.

IMPORTANT: Respond ONLY with valid JSON in this exact format (no markdown code blocks, no extra text):
{
  "documents": [
    {
      "path": "changelog/TIMESTAMP.md",
      "title": "变更记录",
      "category": "changelog",
      "content": "---\\ntitle: 变更记录\\ncategory: changelog\\n---\\n\\n# 变更记录\\n\\n...detailed content here...",
      "relations": []
    }
  ]
}

Requirements:
- Generate a changelog entry for the commit
- Update any feature documents that are affected by the changes
- Use Chinese (中文) for content
- Include source file references where relevant
- Keep the content focused and actionable`,
};
