import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { telemetryServer } from './telemetry-server'
import { datasetFilesServer } from './dataset-files-server'

/** Git commit of this build, recorded in every telemetry log ("-dirty" with uncommitted changes). */
function gitCommit(): string {
  const git = (args: string) => {
    try {
      // --no-optional-locks: never leave an index.lock behind
      return execSync(`git --no-optional-locks ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {
      return ''
    }
  }
  const hash = git('rev-parse --short HEAD')
  if (!hash) return 'unknown'
  return git('status --porcelain') ? `${hash}-dirty` : hash
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), telemetryServer(), datasetFilesServer()],
  define: {
    __APP_COMMIT__: JSON.stringify(gitCommit()),
  },
})
