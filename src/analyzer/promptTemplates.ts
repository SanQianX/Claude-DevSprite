/**
 * Prompt Templates
 * Defines templates for AI analysis prompts
 */

export const PROMPT_TEMPLATES = {
  fullAnalysis: `
# Full Analysis Request

You are analyzing a complete codebase after a commit.

## Commit Message
{{commitMessage}}

## Changed Files
{{changedFiles}}

Please provide a comprehensive analysis including:
1. Overall architecture overview
2. Key features and modules
3. Important patterns and conventions
4. Dependencies and relationships

Respond in the following JSON format:
{
  "documents": [
    {
      "path": "overview/architecture.md",
      "title": "System Architecture",
      "category": "architecture",
      "content": "# Architecture\\n\\n...",
      "relations": []
    }
  ]
}
`,

  incrementalAnalysis: `
# Incremental Analysis Request

You are analyzing specific code changes after a commit.

## Commit Message
{{commitMessage}}

## Changed Files
{{changedFiles}}

Please analyze these changes and provide:
1. What feature/bug fix was implemented
2. What modules are affected
3. What knowledge needs to be updated

Respond in the following JSON format:
{
  "documents": [
    {
      "path": "features/new-feature.md",
      "title": "New Feature Documentation",
      "category": "feature",
      "content": "# New Feature\\n\\n...",
      "relations": []
    }
  ]
}
`,
};
