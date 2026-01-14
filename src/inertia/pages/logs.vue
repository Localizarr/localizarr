<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { ref } from 'vue'

// ... (interfaces)

interface ExecutionLog {
  id: number
  routeUrl: string
  targetUrl: string | null
  indexerName: string
  searchQuery: any
  status: string
  durationMs: number
  originalResponseBody: string
  processedResponseBody: string
  llmPrompt: string
  llmResponse: string
  createdAt: string
}

const props = defineProps<{
  logs: {
    data: ExecutionLog[]
    meta: any
  }
}>()

console.log('[logs.vue] Received logs:', props.logs)
console.log('[logs.vue] Logs data length:', props.logs?.data?.length)

const expandedLogs = ref<number[]>([])

const toggleExpanded = (id: number) => {
  console.log('[logs.vue] Toggling log:', id)
  const currentIndex = expandedLogs.value.indexOf(id)
  if (currentIndex > -1) {
    // Remove o ID se já estiver expandido
    expandedLogs.value.splice(currentIndex, 1)
  } else {
    // Adiciona o ID se não estiver expandido
    expandedLogs.value.push(id)
  }
  console.log('[logs.vue] Expanded logs after toggle:', expandedLogs.value)
}

const isExpanded = (id: number) => {
  return expandedLogs.value.includes(id)
}

const formatDate = (date: string) => {
  if (!date) return '-'
  try {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
    })
  } catch (e) {
    return date
  }
}

const getHostname = (url: string) => {
  if (!url) return '-'
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch (e) {
    return url
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-900 text-green-200 border-green-800'
    case 'processing':
      return 'bg-blue-900 text-blue-200 border-blue-800'
    case 'failed':
      return 'bg-red-900 text-red-200 border-red-800'
    case 'queued_async':
      return 'bg-purple-900 text-purple-200 border-purple-800'
    default:
      return 'bg-sand-3 text-sand-11 border-sand-5'
  }
}

const getVisiblePages = () => {
  const current = props.logs.meta.current_page
  const total = props.logs.meta.last_page
  const pages = []

  // Show max 5 pages around current
  const start = Math.max(1, current - 2)
  const end = Math.min(total, current + 2)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return pages
}
</script>

<template>
  <Head title="Execution Logs - Localizarr" />

  <div class="min-h-screen bg-sand-1 text-sand-12">
    <!-- Header -->
    <header class="sticky top-0 z-50 backdrop-blur-md bg-sand-2/70 border-b border-sand-5">
      <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Link href="/" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div
              class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden"
            >
              <span class="text-white font-bold text-lg">L</span>
            </div>
            <div>
              <h1 class="text-xl font-bold tracking-tight">Localizarr</h1>
              <p class="text-xs text-sand-11 font-medium uppercase tracking-wider">
                Execution Logs
              </p>
            </div>
          </Link>
        </div>

        <div class="flex items-center gap-4">
          <Link
            href="/"
            class="px-4 py-2 text-sm font-medium text-sand-11 hover:text-primary transition-colors"
          >
            Back to Titles
          </Link>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-10">
      <div class="bg-sand-2 rounded-[2rem] border border-sand-5 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm resizable-table">
            <thead class="bg-sand-2 text-sand-11 font-medium border-b border-sand-4">
              <tr>
                <th class="px-6 py-4 min-w-[120px]">Status</th>
                <th class="px-6 py-4 min-w-[150px]">Time</th>
                <th class="px-6 py-4 min-w-[150px]">Indexer</th>
                <th class="px-6 py-4 min-w-[250px]">Query</th>
                <th class="px-6 py-4 min-w-[100px]">Duration</th>
                <th class="px-6 py-4 min-w-[100px]">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-sand-3">
              <template v-for="log in logs.data" :key="log.id">
                <tr class="hover:bg-sand-1 transition-colors group">
                  <td class="px-6 py-4">
                    <span
                      :class="[
                        'px-2.5 py-1 rounded-full text-xs font-bold border',
                        getStatusColor(log.status),
                      ]"
                    >
                      {{ log.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 font-mono text-sand-10 whitespace-nowrap">
                    {{ formatDate(log.createdAt) }}
                  </td>
                  <td class="px-6 py-4 text-sand-12 font-medium">
                    <span class="text-xs text-sand-9 font-mono">{{
                      log.indexerName || 'Unknown'
                    }}</span>
                  </td>
                  <td class="px-6 py-4 text-sand-11">
                    {{ JSON.stringify(log.searchQuery) }}
                  </td>
                  <td class="px-6 py-4 text-sand-11 font-mono">
                    {{ log.durationMs ? log.durationMs + 'ms' : '-' }}
                  </td>
                  <td class="px-6 py-4">
                    <button
                      @click="toggleExpanded(log.id)"
                      class="px-3 py-1.5 border border-sand-5 rounded-lg text-xs font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors"
                    >
                      {{ isExpanded(log.id) ? 'Collapse' : 'Details' }}
                    </button>
                  </td>
                </tr>
                <!-- Details Row -->
                <tr v-if="isExpanded(log.id)" class="bg-sand-2/50 animate-in slide-in-from-top">
                  <td colspan="6" class="px-6 py-6">
                    <!-- Details -->
                    <div class="mb-6">
                      <h4 class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2">
                        Details
                      </h4>
                      <div class="bg-sand-2 p-4 rounded-xl border border-sand-4 font-mono text-xs">
                        <div class="mb-2">
                          <span class="font-semibold">Host:</span>
                          <span class="text-sand-11">{{
                            getHostname(log.targetUrl || log.routeUrl)
                          }}</span>
                        </div>
                        <div class="mb-2">
                          <span class="font-semibold">Requested:</span>
                          <div class="text-sand-11 break-all">{{ log.routeUrl }}</div>
                        </div>
                        <div v-if="log.targetUrl">
                          <span class="font-semibold">Target:</span>
                          <div class="text-sand-11 break-all">{{ log.targetUrl }}</div>
                        </div>
                      </div>
                    </div>

                    <!-- LLM Sections -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <!-- LLM Prompt -->
                      <div>
                        <h4 class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2">
                          LLM Prompt
                        </h4>
                        <div
                          class="bg-sand-2 p-4 rounded-xl border border-sand-4 font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap"
                        >
                          {{ log.llmPrompt || 'No prompt recorded' }}
                        </div>
                      </div>

                      <!-- LLM Response -->
                      <div>
                        <h4 class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2">
                          LLM Response
                        </h4>
                        <div
                          class="bg-sand-2 p-4 rounded-xl border border-sand-4 font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap"
                        >
                          {{ log.llmResponse || 'No response recorded' }}
                        </div>
                      </div>
                    </div>

                    <!-- Response Bodies -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2">
                          Original Response (Truncated)
                        </h4>
                        <div
                          class="bg-sand-2 p-4 rounded-xl border border-sand-4 font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap"
                        >
                          {{ log.originalResponseBody || 'None' }}
                        </div>
                      </div>

                      <div>
                        <h4 class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2">
                          Processed Response (Truncated)
                        </h4>
                        <div
                          class="bg-sand-2 p-4 rounded-xl border border-sand-4 font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap"
                        >
                          {{ log.processedResponseBody || 'None' }}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="!logs.data || logs.data.length === 0">
                <td colspan="6" class="px-6 py-12 text-center text-sand-11">
                  No logs found in the database.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div
          class="px-6 py-4 border-t border-sand-4 flex justify-between items-center bg-sand-1"
        >
          <span class="text-sm text-sand-10"
            >Page {{ logs.meta.current_page }} of {{ logs.meta.last_page }} ({{ logs.meta.total }} total)</span
          >
          <div class="flex gap-2 items-center">
            <Link
              v-if="logs.meta.current_page > 1"
              :href="`/logs?page=${logs.meta.current_page - 1}`"
              class="px-4 py-2 bg-sand-2 border border-sand-5 rounded-lg text-sm hover:bg-sand-3"
              >Previous</Link
            >

            <!-- Page numbers -->
            <template v-if="logs.meta.last_page > 1">
              <Link
                v-for="page in getVisiblePages()"
                :key="page"
                :href="`/logs?page=${page}`"
                :class="[
                  'px-3 py-2 border rounded-lg text-sm',
                  page === logs.meta.current_page
                    ? 'bg-primary text-white border-primary'
                    : 'bg-sand-2 border-sand-5 hover:bg-sand-3'
                ]"
              >
                {{ page }}
              </Link>
            </template>

            <Link
              v-if="logs.meta.current_page < logs.meta.last_page"
              :href="`/logs?page=${logs.meta.current_page + 1}`"
              class="px-4 py-2 bg-sand-2 border border-sand-5 rounded-lg text-sm hover:bg-sand-3"
              >Next</Link
            >
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
/* Same animations as home */
@keyframes slide-in-from-top {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: slide-in-from-top 0.2s ease-out;
}

/* Resizable table columns */
.resizable-table th {
  position: relative;
  resize: horizontal;
  overflow: hidden;
  min-width: 50px;
}

.resizable-table th:last-child {
  resize: none;
}
</style>
