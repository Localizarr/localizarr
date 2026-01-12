<script setup lang="ts">
import { Head, Link } from "@inertiajs/vue3";
import { ref } from "vue";

// ... (interfaces)

interface ExecutionLog {
  id: number;
  routeUrl: string;
  indexerName: string;
  searchQuery: any;
  status: string;
  durationMs: number;
  originalResponseBody: string;
  processedResponseBody: string;
  llmPrompt: string;
  llmResponse: string;
  createdAt: string;
}

const props = defineProps<{
  logs: {
    data: ExecutionLog[];
    meta: any;
  };
}>();

console.log('[logs.vue] Received logs:', props.logs);
console.log('[logs.vue] Logs data length:', props.logs?.data?.length);

const expandedLogs = ref<number[]>([]);

const toggleExpanded = (id: number) => {
  console.log('[logs.vue] Toggling log:', id);
  const currentIndex = expandedLogs.value.indexOf(id);
  if (currentIndex > -1) {
    // Remove o ID se já estiver expandido
    expandedLogs.value.splice(currentIndex, 1);
  } else {
    // Adiciona o ID se não estiver expandido
    expandedLogs.value.push(id);
  }
  console.log('[logs.vue] Expanded logs after toggle:', expandedLogs.value);
};

const isExpanded = (id: number) => {
  return expandedLogs.value.includes(id);
};

const formatDate = (date: string) => {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
    });
  } catch (e) {
    return date;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 border-green-200";
    case "processing":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "failed":
      return "bg-red-100 text-red-800 border-red-200";
    case "queued_async":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};
</script>

<template>
  <Head title="Execution Logs - Localizarr" />

  <div class="min-h-screen bg-[#FDFDFC] text-[#21201C]">
    <!-- Header -->
    <header class="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-sand-5">
      <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Link
            href="/"
            class="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
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
      <div class="bg-white rounded-[2rem] border border-sand-5 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-sand-2 text-sand-11 font-medium border-b border-sand-4">
              <tr>
                <th class="px-6 py-4">Status</th>
                <th class="px-6 py-4">Time</th>
                <th class="px-6 py-4">Indexer / Route</th>
                <th class="px-6 py-4">Query</th>
                <th class="px-6 py-4">Duration</th>
                <th class="px-6 py-4">Action</th>
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
                    <div class="flex flex-col">
                      <span>{{ log.indexerName || "Unknown" }}</span>
                      <span
                        class="text-xs text-sand-9 font-mono truncate max-w-[200px]"
                        >{{ log.routeUrl }}</span
                      >
                    </div>
                  </td>
                  <td class="px-6 py-4 text-sand-11 max-w-xs truncate">
                    {{ JSON.stringify(log.searchQuery) }}
                  </td>
                  <td class="px-6 py-4 text-sand-11 font-mono">
                    {{ log.durationMs ? log.durationMs + "ms" : "-" }}
                  </td>
                  <td class="px-6 py-4">
                    <button
                      @click="toggleExpanded(log.id)"
                      class="px-3 py-1.5 border border-sand-5 rounded-lg text-xs font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors"
                    >
                      {{ isExpanded(log.id) ? "Collapse" : "Details" }}
                    </button>
                  </td>
                </tr>
                <!-- Details Row -->
                <tr
                  v-if="isExpanded(log.id)"
                  class="bg-sand-2/50 animate-in slide-in-from-top"
                >
                  <td colspan="6" class="px-6 py-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <!-- LLM Prompt -->
                      <div>
                        <h4
                          class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2"
                        >
                          LLM Prompt
                        </h4>
                        <div
                          class="bg-white p-4 rounded-xl border border-sand-4 font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap"
                        >
                          {{ log.llmPrompt || "No prompt recorded" }}
                        </div>
                      </div>

                      <!-- LLM Response -->
                      <div>
                        <h4
                          class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2"
                        >
                          LLM Response
                        </h4>
                        <div
                          class="bg-white p-4 rounded-xl border border-sand-4 font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap"
                        >
                          {{ log.llmResponse || "No response recorded" }}
                        </div>
                      </div>

                      <!-- Response Bodies -->
                      <div>
                        <h4
                          class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2"
                        >
                          Original Response (Truncated)
                        </h4>
                        <div
                          class="bg-white p-4 rounded-xl border border-sand-4 font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap"
                        >
                          {{ log.originalResponseBody || "None" }}
                        </div>
                      </div>

                      <div>
                        <h4
                          class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2"
                        >
                          Processed Response (Truncated)
                        </h4>
                        <div
                          class="bg-white p-4 rounded-xl border border-sand-4 font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap"
                        >
                          {{ log.processedResponseBody || "None" }}
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
          v-if="logs?.meta?.last_page > 1"
          class="px-6 py-4 border-t border-sand-4 flex justify-between items-center bg-sand-1"
        >
          <span class="text-sm text-sand-10"
            >Page {{ logs.meta.current_page }} of {{ logs.meta.last_page }}</span
          >
          <div class="flex gap-2">
            <Link
              v-if="logs.meta.current_page > 1"
              :href="`/logs?page=${logs.meta.current_page - 1}`"
              class="px-4 py-2 bg-white border border-sand-5 rounded-lg text-sm hover:bg-sand-2"
              >Previous</Link
            >
            <Link
              v-if="logs.meta.current_page < logs.meta.last_page"
              :href="`/logs?page=${logs.meta.current_page + 1}`"
              class="px-4 py-2 bg-white border border-sand-5 rounded-lg text-sm hover:bg-sand-2"
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
</style>
