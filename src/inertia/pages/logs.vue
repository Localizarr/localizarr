<script setup lang="ts">
import { Head, Link, router } from "@inertiajs/vue3";
import { ref, onMounted, onUnmounted, watch } from "vue";

// ... (interfaces)

interface ExecutionLog {
  id: number;
  routeUrl: string;
  targetUrl: string | null;
  indexerName: string;
  hostHeader: string | null;
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

const escapeHtml = (text: string) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const limit = ref(props.logs.meta.per_page || 20);
const jumpToPage = ref("");

console.log("[logs.vue] Logs data length:", props.logs?.data?.length);

const expandedLogs = ref<number[]>([]);

const toggleExpanded = (id: number) => {
  console.log("[logs.vue] Toggling log:", id);
  const currentIndex = expandedLogs.value.indexOf(id);
  if (currentIndex > -1) {
    // Remove o ID se já estiver expandido
    expandedLogs.value.splice(currentIndex, 1);
  } else {
    // Adiciona o ID se não estiver expandido
    expandedLogs.value.push(id);
  }
  console.log("[logs.vue] Expanded logs after toggle:", expandedLogs.value);
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

const getHostname = (url: string) => {
  if (!url) return "-";
  try {
    const urlObj = new URL(url);
    return urlObj.port ? `${urlObj.hostname}:${urlObj.port}` : urlObj.hostname;
  } catch (e) {
    return url;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-900 text-green-200 border-green-800";
    case "processing":
      return "bg-blue-900 text-blue-200 border-blue-800";
    case "failed":
      return "bg-red-900 text-red-200 border-red-800";
    case "queued_async":
      return "bg-purple-900 text-purple-200 border-purple-800";
    default:
      return "bg-sand-3 text-sand-11 border-sand-5";
  }
};

const replay = async (logId: number) => {
  if (
    !confirm(
      "Are you sure you want to replay this request? This will create a new log entry."
    )
  ) {
    return;
  }

  try {
    const csrfToken = document
      .querySelector('meta[name="csrf-token"]')
      ?.getAttribute("content");
    const response = await fetch(`/logs/${logId}/replay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken || "",
      },
    });

    if (response.ok) {
      // Reload the page or update the list
      window.location.reload();
    } else {
      alert("Replay failed");
    }
  } catch (error) {
    console.error("Replay error:", error);
    alert("Replay failed");
  }
};

const getVisiblePages = () => {
  const pages: number[] = [];
  const start = Math.max(1, props.logs.meta.current_page - 2);
  const end = Math.min(props.logs.meta.last_page, props.logs.meta.current_page + 2);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return pages;
};

const buildUrl = (page?: number, newLimit?: number) => {
  const params = new URLSearchParams();
  params.set("page", (page || props.logs.meta.current_page).toString());
  params.set("limit", (newLimit || limit.value).toString());
  return `/logs?${params.toString()}`;
};

const changeLimit = () => {
  router.visit(buildUrl(1, limit.value));
};

const jumpToPageAction = () => {
  const inputValue = (jumpToPage.value || "").toString().trim();
  console.log("[jumpToPageAction] input value:", inputValue);

  if (!inputValue) {
    alert("Please enter a page number");
    return;
  }

  const page = parseInt(inputValue);
  console.log("[jumpToPageAction] parsed page:", page);
  console.log("[jumpToPageAction] isNaN:", isNaN(page));
  console.log("[jumpToPageAction] last_page:", props.logs.meta.last_page);

  if (isNaN(page) || page < 1 || page > props.logs.meta.last_page) {
    alert(`Please enter a valid page number between 1 and ${props.logs.meta.last_page}`);
    return;
  }

  const url = buildUrl(page);
  console.log("[jumpToPageAction] navigating to:", url);
  window.location.href = url;
  jumpToPage.value = "";
};

const goToPreviousPage = () => {
  if (props.logs.meta.current_page > 1) {
    router.visit(buildUrl(props.logs.meta.current_page - 1));
  }
};

const goToNextPage = () => {
  if (props.logs.meta.current_page < props.logs.meta.last_page) {
    router.visit(buildUrl(props.logs.meta.current_page + 1));
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  // Only handle keyboard navigation if not typing in an input
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return;
  }

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      goToPreviousPage();
      break;
    case "ArrowRight":
      event.preventDefault();
      goToNextPage();
      break;
    case "Home":
      if (event.ctrlKey) {
        event.preventDefault();
        window.location.href = buildUrl(1);
      }
      break;
    case "End":
      if (event.ctrlKey) {
        event.preventDefault();
        window.location.href = buildUrl(props.logs.meta.last_page);
      }
      break;
  }
};

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
});

// Watch for changes in jumpToPage
watch(jumpToPage, (newValue, oldValue) => {
  console.log(
    "[watch jumpToPage] changed from:",
    oldValue,
    "to:",
    newValue,
    "type:",
    typeof newValue
  );
  if (typeof newValue !== "string") {
    console.warn("[jumpToPage watch] value is not string, converting...");
    jumpToPage.value = newValue?.toString() || "";
  }
});

// Diff functionality
const computeJsonDiff = (original: string, processed: string) => {
  if (!original || !processed || original === processed) {
    return null;
  }

  try {
    const originalObj = JSON.parse(original);
    const processedObj = JSON.parse(processed);

    // Simple diff: compare stringified versions line by line
    const originalLines = JSON.stringify(originalObj, null, 2).split("\n");
    const processedLines = JSON.stringify(processedObj, null, 2).split("\n");

    const maxLines = Math.max(originalLines.length, processedLines.length);
    const diffLines: string[] = [];

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i] || "";
      const procLine = processedLines[i] || "";

      if (origLine === procLine) {
        // Same line
        diffLines.push(`<span class="text-sand-11">${escapeHtml(origLine)}</span>`);
      } else if (origLine && !procLine) {
        // Line removed
        diffLines.push(
          `<span class="bg-red-900/30 text-red-200 border-l-2 border-red-500 pl-2">${escapeHtml(
            origLine
          )}</span>`
        );
      } else if (!origLine && procLine) {
        // Line added
        diffLines.push(
          `<span class="bg-green-900/30 text-green-200 border-l-2 border-green-500 pl-2">${escapeHtml(
            procLine
          )}</span>`
        );
      } else {
        // Line changed
        diffLines.push(
          `<span class="bg-yellow-900/30 text-yellow-200 border-l-2 border-yellow-500 pl-2">${escapeHtml(
            procLine
          )}</span>`
        );
      }
    }

    return diffLines.join("\n");
  } catch (e) {
    // Fallback to simple text diff if JSON parsing fails
    return computeTextDiff(original, processed);
  }
};

const computeTextDiff = (original: string, processed: string) => {
  if (original === processed) return null;

  const originalLines = original.split("\n");
  const processedLines = processed.split("\n");
  const maxLines = Math.max(originalLines.length, processedLines.length);
  const diffLines: string[] = [];

  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i] || "";
    const procLine = processedLines[i] || "";

    if (origLine === procLine) {
      diffLines.push(`<span class="text-sand-11">${escapeHtml(origLine)}</span>`);
    } else if (origLine && !procLine) {
      diffLines.push(
        `<span class="bg-red-900/30 text-red-200 border-l-2 border-red-500 pl-2">${escapeHtml(
          origLine
        )}</span>`
      );
    } else if (!origLine && procLine) {
      diffLines.push(
        `<span class="bg-green-900/30 text-green-200 border-l-2 border-green-500 pl-2">${escapeHtml(
          procLine
        )}</span>`
      );
    } else {
      diffLines.push(
        `<span class="bg-yellow-900/30 text-yellow-200 border-l-2 border-yellow-500 pl-2">${escapeHtml(
          procLine
        )}</span>`
      );
    }
  }

  return diffLines.join("\n");
};

const computeProcessedDiff = (original: string, processed: string) => {
  if (!original || !processed || original === processed) {
    return null;
  }

  try {
    const originalObj = JSON.parse(original);
    const processedObj = JSON.parse(processed);

    // Simple diff: compare stringified versions line by line
    const originalLines = JSON.stringify(originalObj, null, 2).split("\n");
    const processedLines = JSON.stringify(processedObj, null, 2).split("\n");

    const maxLines = Math.max(originalLines.length, processedLines.length);
    const diffLines: string[] = [];

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i] || "";
      const procLine = processedLines[i] || "";

      if (origLine === procLine) {
        // Same line - show in green to indicate it's the final result
        diffLines.push(`<span class="text-gray-200">${escapeHtml(origLine)}</span>`);
      } else if (origLine && !procLine) {
        // Line was removed - don't show (not in final result)
        continue;
      } else if (!origLine && procLine) {
        // Line was added - show in bright green
        diffLines.push(
          `<span class="text-green-500 bg-green-900 bg-opacity-50 font-semibold">${escapeHtml(
            procLine
          )}</span>`
        );
      } else {
        // Line was changed - show the new version in bright green
        diffLines.push(
          `<span class="text-green-500 bg-green-900 bg-opacity-50 font-semibold">${escapeHtml(
            procLine
          )}</span>`
        );
      }
    }

    return diffLines.join("\n");
  } catch (e) {
    // Fallback to simple text diff if JSON parsing fails
    return computeProcessedTextDiff(original, processed);
  }
};

const computeProcessedTextDiff = (original: string, processed: string) => {
  if (original === processed) return null;

  const originalLines = original.split("\n");
  const processedLines = processed.split("\n");
  const maxLines = Math.max(originalLines.length, processedLines.length);
  const diffLines: string[] = [];

  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i] || "";
    const procLine = processedLines[i] || "";

    if (origLine === procLine) {
      diffLines.push(`<span class="text-green-200">${escapeHtml(origLine)}</span>`);
    } else if (origLine && !procLine) {
      // Line was removed - skip
      continue;
    } else if (!origLine && procLine) {
      diffLines.push(
        `<span class="text-green-100 font-semibold">${escapeHtml(procLine)}</span>`
      );
    } else {
      diffLines.push(
        `<span class="text-green-100 font-semibold">${escapeHtml(procLine)}</span>`
      );
    }
  }

  return diffLines.join("\n");
};

const hasDiff = (log: ExecutionLog) => {
  return (
    log.originalResponseBody &&
    log.processedResponseBody &&
    log.originalResponseBody !== log.processedResponseBody
  );
};

const highlightTitles = (originalJsonString: string, processedJsonString: string) => {
  if (!originalJsonString) return originalJsonString;

  try {
    let originalObj = null;
    let originalToParse = originalJsonString;
    if (originalToParse.endsWith('...[TRUNCATED]')) {
      originalToParse = originalToParse.slice(0, -15);
    }
    originalObj = JSON.parse(originalToParse);

    let processedObj = null;
    if (processedJsonString) {
      let processedToParse = processedJsonString;
      if (processedToParse.endsWith('...[TRUNCATED]')) {
        processedToParse = processedToParse.slice(0, -15);
      }
      try {
        processedObj = JSON.parse(processedToParse);
      } catch {
        // If processed is not valid JSON even after removing truncation, no highlighting
      }
    }

    const highlight = (o: any, p: any, path: string[] = []): any => {
      if (Array.isArray(o)) {
        return o.map((item, index) =>
          highlight(item, p?.[index], [...path, index.toString()])
        );
      } else if (o && typeof o === "object") {
        const newObj: any = {};
        for (const key in o) {
          const shouldHighlight =
            (key === "n" || key === "title") && p && p[key] && o[key] !== p[key];
          if (shouldHighlight) {
            newObj[key] = `<span class="highlight-title">${escapeHtml(o[key])}</span>`;
          } else {
            newObj[key] = highlight(o[key], p?.[key], [...path, key]);
          }
        }
        return newObj;
      } else {
        return o;
      }
    };
    const highlightedObj = highlight(originalObj, processedObj);
    return JSON.stringify(highlightedObj, null, 2);
  } catch (e) {
    // Fallback for non-JSON: return escaped HTML
    return escapeHtml(originalJsonString);
  }
};
</script>

<template>
  <Head title="Execution Logs - Localizarr" />

  <div class="min-h-screen bg-sand-1 text-sand-12">
    <!-- Header -->
    <header
      class="sticky top-0 z-50 backdrop-blur-md bg-sand-2/70 border-b border-sand-5"
    >
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
      <div
        class="bg-sand-2 rounded-[2rem] border border-sand-5 shadow-sm overflow-hidden"
      >
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
                      log.indexerName || "Unknown"
                    }}</span>
                  </td>
                  <td class="px-6 py-4 text-sand-11">
                    {{ JSON.stringify(log.searchQuery) }}
                  </td>
                  <td class="px-6 py-4 text-sand-11 font-mono">
                    {{ log.durationMs ? log.durationMs + "ms" : "-" }}
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex gap-2">
                      <button
                        @click="toggleExpanded(log.id)"
                        class="px-3 py-1.5 border border-sand-5 rounded-lg text-xs font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors"
                      >
                        {{ isExpanded(log.id) ? "Collapse" : "Details" }}
                      </button>
                      <button
                        @click="replay(log.id)"
                        class="px-3 py-1.5 bg-blue-600 border border-blue-500 rounded-lg text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                      >
                        Replay
                      </button>
                    </div>
                  </td>
                </tr>
                <!-- Details Row -->
                <tr
                  v-if="isExpanded(log.id)"
                  class="bg-sand-2/50 animate-in slide-in-from-top"
                >
                  <td colspan="6" class="px-6 py-6">
                    <!-- Details -->
                    <div class="mb-6">
                      <h4
                        class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2"
                      >
                        Details
                      </h4>
                      <div
                        class="bg-sand-2 p-4 rounded-xl border border-sand-4 font-mono text-xs"
                      >
                        <div class="mb-2">
                          <span class="font-semibold">Host:</span>
                          <span class="text-sand-11">{{
                            log.hostHeader || getHostname(log.targetUrl || log.routeUrl)
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
                        <h4
                          class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2"
                        >
                          LLM Prompt
                        </h4>
                        <div
                          class="bg-sand-2 p-4 rounded-xl border border-sand-4 font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap"
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
                          class="bg-sand-2 p-4 rounded-xl border border-sand-4 font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap"
                        >
                          {{ log.llmResponse || "No response recorded" }}
                        </div>
                      </div>
                    </div>

                    <!-- Response Bodies -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4
                          class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2"
                        >
                          Original Response (Truncated) - Titles
                        </h4>
                        <div
                          class="bg-sand-2 p-4 rounded-xl border border-sand-4 font-mono text-xs overflow-auto max-h-60"
                        >
                          <div
                            v-html="
                              highlightTitles(
                                log.originalResponseBody,
                                log.processedResponseBody
                              ) || 'None'
                            "
                          ></div>
                        </div>
                      </div>

                      <div>
                        <h4
                          class="text-xs font-bold uppercase tracking-wider text-sand-9 mb-2"
                        >
                          Processed Response - Final Result
                        </h4>
                        <div
                          class="bg-sand-2 p-4 rounded-xl border border-sand-4 font-mono text-xs overflow-auto max-h-60"
                        >
                          <div
                            v-if="hasDiff(log)"
                            v-html="
                              computeProcessedDiff(
                                log.originalResponseBody,
                                log.processedResponseBody
                              )
                            "
                          ></div>
                          <div v-else class="whitespace-pre-wrap">
                            {{ log.processedResponseBody || "None" }}
                          </div>
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
        <div class="px-6 py-4 border-t border-sand-4 bg-sand-1">
          <!-- Top row: Info and controls -->
          <div class="flex justify-between items-center mb-4">
            <div class="flex flex-col">
              <span class="text-sm text-sand-10">
                Page {{ logs.meta.current_page }} of {{ logs.meta.last_page }} ({{
                  logs.meta.total
                }}
                total)
              </span>
              <span class="text-xs text-sand-11">
                Use ← → arrow keys for navigation, Ctrl+Home/End for first/last page
              </span>
            </div>
            <div class="flex items-center gap-4">
              <!-- Items per page -->
              <div class="flex items-center gap-2">
                <label for="limit" class="text-sm text-sand-11">Items per page:</label>
                <select
                  id="limit"
                  v-model="limit"
                  @change="changeLimit"
                  class="px-2 py-1 bg-sand-2 border border-sand-5 rounded text-sm"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              <!-- Jump to page -->
              <div class="flex items-center gap-2">
                <label for="jump-page" class="text-sm text-sand-11">Jump to page:</label>
                <input
                  id="jump-page"
                  v-model="jumpToPage"
                  @keyup.enter="jumpToPageAction"
                  type="number"
                  min="1"
                  :max="logs.meta.last_page"
                  class="w-16 px-2 py-1 bg-sand-2 border border-sand-5 rounded text-sm text-center"
                  placeholder="1"
                />
                <button
                  @click="jumpToPageAction"
                  class="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary/80"
                >
                  Go
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom row: Navigation buttons -->
          <div class="flex justify-center items-center gap-2">
            <!-- First -->
            <Link
              v-if="logs.meta.current_page > 1"
              :href="buildUrl(1)"
              class="px-3 py-2 bg-sand-2 border border-sand-5 rounded-lg text-sm hover:bg-sand-3"
              title="First page"
            >
              « First
            </Link>

            <!-- Previous -->
            <Link
              v-if="logs.meta.current_page > 1"
              :href="buildUrl(logs.meta.current_page - 1)"
              class="px-4 py-2 bg-sand-2 border border-sand-5 rounded-lg text-sm hover:bg-sand-3"
              title="Previous page (←)"
            >
              Previous
            </Link>

            <!-- Page numbers -->
            <template v-if="logs.meta.last_page > 1">
              <!-- Show first page if not in range -->
              <Link
                v-if="getVisiblePages()[0] > 1"
                :href="buildUrl(1)"
                class="px-3 py-2 bg-sand-2 border border-sand-5 rounded-lg text-sm hover:bg-sand-3"
              >
                1
              </Link>
              <span v-if="getVisiblePages()[0] > 2" class="px-2 text-sand-11">...</span>

              <!-- Visible pages -->
              <Link
                v-for="page in getVisiblePages()"
                :key="page"
                :href="buildUrl(page)"
                :class="[
                  'px-3 py-2 border rounded-lg text-sm',
                  page === logs.meta.current_page
                    ? 'bg-primary text-white border-primary'
                    : 'bg-sand-2 border-sand-5 hover:bg-sand-3',
                ]"
              >
                {{ page }}
              </Link>

              <!-- Show last page if not in range -->
              <span
                v-if="
                  getVisiblePages()[getVisiblePages().length - 1] <
                  logs.meta.last_page - 1
                "
                class="px-2 text-sand-11"
                >...</span
              >
              <Link
                v-if="
                  getVisiblePages()[getVisiblePages().length - 1] < logs.meta.last_page
                "
                :href="buildUrl(logs.meta.last_page)"
                class="px-3 py-2 bg-sand-2 border border-sand-5 rounded-lg text-sm hover:bg-sand-3"
              >
                {{ logs.meta.last_page }}
              </Link>
            </template>

            <!-- Next -->
            <Link
              v-if="logs.meta.current_page < logs.meta.last_page"
              :href="buildUrl(logs.meta.current_page + 1)"
              class="px-4 py-2 bg-sand-2 border border-sand-5 rounded-lg text-sm hover:bg-sand-3"
              title="Next page (→)"
            >
              Next
            </Link>

            <!-- Last -->
            <Link
              v-if="logs.meta.current_page < logs.meta.last_page"
              :href="buildUrl(logs.meta.last_page)"
              class="px-3 py-2 bg-sand-2 border border-sand-5 rounded-lg text-sm hover:bg-sand-3"
              title="Last page"
            >
              Last »
            </Link>
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

.highlight-title {
  background-color: rgba(251, 191, 36, 0.3); /* Light amber background */
  color: #92400e; /* Dark amber text for contrast */
  font-weight: bold;
  padding: 2px 4px;
  border-radius: 3px;
}
</style>
