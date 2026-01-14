<script setup lang="ts">
import { Head, Link, router } from "@inertiajs/vue3";
import { ref } from "vue";

// Props from Adonis Controller (Inertia)
const props = defineProps<{
  titles: {
    data: Title[];
    meta: {
      current_page: number;
      last_page: number;
      total: number;
    };
  };
  flash?: {
    success?: string;
    error?: string;
  };
}>();

interface Title {
  id: number;
  imdbId: string;
  mediaType: string;
  originalTitle: string;
  imdbData: any;
  localizedNames: LocalizedName[];
}

interface LocalizedName {
  id: number;
  titleId: number;
  langId: string;
  localizedName: string;
}

interface ParsedImdbData {
  primaryTitle: string;
  titleType: string;
  startYear: string | null;
  genres: string | null;
}

// Local State
const searchQuery = ref("");
const selectedLang = ref("");
const expandedTitles = ref<Set<number>>(new Set());
const showAddModal = ref(false);
const selectedTitleForAdd = ref<Title | null>(null);
const newLocalizedName = ref("");
const newLangId = ref("pt-BR");

// New title modal refs
const showNewTitleModal = ref(false);
const titleSearchQuery = ref("");
const searchResults = ref<Title[]>([]);
const selectedExistingTitle = ref<Title | null>(null);
const newTitleLangId = ref("pt-BR");
const newTitleLocalized = ref("");

// Debounced Search Watcher
let searchTimeout: NodeJS.Timeout;
let titleSearchTimeout: NodeJS.Timeout;

const performSearch = () => {
  router.get(
    "/",
    {
      search: searchQuery.value,
      lang: selectedLang.value,
    },
    {
      preserveState: true,
      preserveScroll: true,
      replace: true,
    }
  );
};

const handleSearchInput = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(performSearch, 500);
};

const changeLang = () => {
  performSearch();
};

const toggleExpanded = (titleId: number) => {
  const next = new Set(expandedTitles.value);
  if (next.has(titleId)) {
    next.delete(titleId);
  } else {
    next.add(titleId);
  }
  expandedTitles.value = next;
};

// Actions using Inertia Router
const deleteTitle = (titleId: number) => {
  if (!confirm("Are you sure you want to remove this title and all its localized names?"))
    return;
  router.delete(`/api/titles/${titleId}`, { preserveScroll: true });
};

const deleteLocalizedName = (titleId: number, localizedNameId: number) => {
  if (!confirm("Are you sure you want to remove this localized name?")) return;
  router.delete(`/api/titles/${titleId}/localized-names/${localizedNameId}`, {
    preserveScroll: true,
    onSuccess: () => {
      // Inertia automatically updates props, but we might want to close expanded if empty?
      // Not strictly necessary as the reactive props will update the view.
    },
  });
};

const clearAllLocalizedNames = () => {
  if (
    !confirm(
      "Are you sure you want to remove ALL localized names? The original titles will remain in the database."
    )
  )
    return;
  router.delete("/api/titles/clear-all", { preserveScroll: true });
};

const registerTitle = (titleId: number) => {
  const title = props.titles.data.find(t => t.id === titleId);
  if (title) {
    selectedTitleForAdd.value = title;
    newLocalizedName.value = "";
    newLangId.value = "pt-BR";
    showAddModal.value = true;
  }
};

const addLocalizedName = () => {
  if (!selectedTitleForAdd.value || !newLocalizedName.value.trim()) return;

  router.post(`/api/titles/${selectedTitleForAdd.value.id}/localized-names`, {
    localizedName: newLocalizedName.value.trim(),
    langId: newLangId.value,
  }, {
    preserveScroll: true,
    onSuccess: () => {
      showAddModal.value = false;
      selectedTitleForAdd.value = null;
      newLocalizedName.value = "";
    },
  });
};

const closeAddModal = () => {
  showAddModal.value = false;
  selectedTitleForAdd.value = null;
  newLocalizedName.value = "";
};

const openNewTitleModal = () => {
  showNewTitleModal.value = true;
};

const closeNewTitleModal = () => {
  showNewTitleModal.value = false;
  titleSearchQuery.value = "";
  searchResults.value = [];
  selectedExistingTitle.value = null;
  newTitleLangId.value = "pt-BR";
  newTitleLocalized.value = "";
  if (titleSearchTimeout) {
    clearTimeout(titleSearchTimeout);
  }
};

const searchTitles = async () => {
  if (titleSearchTimeout) {
    clearTimeout(titleSearchTimeout);
  }

  titleSearchTimeout = setTimeout(async () => {
    if (!titleSearchQuery.value.trim()) {
      searchResults.value = [];
      return;
    }

    try {
      const response = await fetch(`/api/titles?search=${encodeURIComponent(titleSearchQuery.value)}&limit=10`);
      const data = await response.json();
      if (data.success) {
        searchResults.value = data.data.data;
      }
    } catch (error) {
      console.error('Error searching titles:', error);
    }
  }, 300); // 300ms debounce
};

const selectTitle = (title: Title) => {
  selectedExistingTitle.value = title;
  searchResults.value = [];
  titleSearchQuery.value = title.originalTitle;
};

const addTranslationToExistingTitle = () => {
  if (!selectedExistingTitle.value || !newTitleLocalized.value.trim()) return;

  router.post(`/api/titles/${selectedExistingTitle.value.id}/localized-names`, {
    localizedName: newTitleLocalized.value.trim(),
    langId: newTitleLangId.value,
  }, {
    preserveScroll: true,
    onSuccess: () => {
      closeNewTitleModal();
    },
  });
};

const parseImdbData = (data: any): ParsedImdbData | null => {
  if (!data) return null;
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return {
      primaryTitle: parsed.primaryTitle || "Unknown",
      titleType: parsed.titleType || "Unknown",
      startYear: parsed.startYear || null,
      genres: parsed.genres || null,
    };
  } catch (e) {
    return null;
  }
};
</script>

<template>
  <Head title="Localizarr - Media Localizer" />

  <div class="min-h-screen bg-[#2A2A2A] text-[#E5E5E5] selection:bg-primary/20">
    <!-- Header -->
    <header
      class="sticky top-0 z-50 backdrop-blur-md bg-[#1F1F1F]/80 border-b border-[#404040]"
    >
      <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden"
          >
            <span class="text-white font-bold text-lg">L</span>
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight">Localizarr</h1>
            <p class="text-xs text-[#B0B0B0] font-medium uppercase tracking-wider">
              Title Database
            </p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <Link
            href="/logs"
            class="text-sm font-medium text-[#B0B0B0] hover:text-primary transition-colors"
          >
            View Logs
          </Link>
          <button
            @click="openNewTitleModal"
            class="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-all active:scale-95"
          >
            + Add Translation
          </button>
          <button
            @click="clearAllLocalizedNames"
            class="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-95"
          >
            Clear Localizations
          </button>
        </div>
      </div>
    </header>

    <!-- Flash Messages -->
    <div
      v-if="props.flash?.success || props.flash?.error"
      class="max-w-7xl mx-auto px-6 py-4"
    >
      <div
        v-if="props.flash?.success"
        class="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg"
      >
        {{ props.flash.success }}
      </div>
      <div
        v-if="props.flash?.error"
        class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg"
      >
        {{ props.flash.error }}
      </div>
    </div>

    <main class="max-w-7xl mx-auto px-6 py-10">
      <!-- Search & Filters -->
      <section class="mb-12">
        <div
          class="flex flex-col md:flex-row gap-4 p-2 bg-[#3A3A3A] rounded-2xl shadow-inner border border-[#505050]"
        >
          <div class="relative flex-1 group">
            <div
              class="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#888888] group-focus-within:text-primary transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <input
              v-model="searchQuery"
              @input="handleSearchInput"
              type="text"
              placeholder="Search by original or localized title..."
              class="w-full pl-12 pr-4 py-3 bg-sand-2 border-none rounded-xl shadow-sm focus:ring-2 focus:ring-primary transition-all placeholder:text-sand-9"
            />
          </div>

          <div class="flex gap-2">
            <select
              v-model="selectedLang"
              @change="changeLang"
              class="pl-4 pr-10 py-3 bg-sand-2 border-none rounded-xl shadow-sm focus:ring-2 focus:ring-primary appearance-none transition-all cursor-pointer min-w-[160px]"
            >
              <option value="">All Languages</option>
              <option value="pt-BR">🇧🇷 Portuguese</option>
              <option value="en">🇺🇸 English</option>
              <option value="es">🇪🇸 Spanish</option>
              <option value="fr">🇫🇷 French</option>
              <option value="de">🇩🇪 German</option>
              <option value="it">🇮🇹 Italian</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Empty State -->
      <section
        v-if="!titles.data || titles.data.length === 0"
        class="flex flex-col items-center justify-center py-24 text-center"
      >
        <div
          class="w-20 h-20 bg-sand-3 rounded-full flex items-center justify-center mb-6"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-10 h-10 text-sand-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <line x1="3" x2="21" y1="9" y2="9" />
            <line x1="9" x2="9" y1="21" y2="9" />
          </svg>
        </div>
        <h3 class="text-xl font-bold">No titles found</h3>
        <p class="text-sand-11 max-w-xs mx-auto mt-2">
          Try adjusting your search or filters to find what you're looking for.
        </p>
      </section>

      <!-- Grid -->
      <section v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <article
          v-for="title in titles.data"
          :key="title.id"
          class="group bg-sand-2 rounded-[2rem] border border-sand-5 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 overflow-hidden flex flex-col"
        >
          <!-- Card Content -->
          <div class="p-8 flex-1">
            <div class="flex items-start justify-between mb-4">
              <span
                class="px-3 py-1 bg-sand-3 text-sand-11 text-[10px] font-bold uppercase tracking-widest rounded-full"
              >
                {{ title.mediaType === "movie" ? "🎬 Movie" : "📺 TV Series" }}
              </span>
              <span class="text-xs font-mono text-sand-9">{{ title.imdbId }}</span>
            </div>

            <h3
              class="text-2xl font-bold leading-tight group-hover:text-primary transition-colors duration-300"
            >
              {{ title.originalTitle }}
            </h3>

            <!-- Metadata -->
            <div v-if="parseImdbData(title.imdbData)" class="mt-4 flex flex-wrap gap-2">
              <span
                v-if="parseImdbData(title.imdbData)?.startYear"
                class="text-sm font-medium text-sand-11"
              >
                {{ parseImdbData(title.imdbData)?.startYear }}
              </span>
              <span class="text-sand-6">•</span>
              <span class="text-sm text-sand-11">
                {{
                  parseImdbData(title.imdbData)?.genres?.split(",").slice(0, 2).join(", ")
                }}
              </span>
            </div>

            <!-- Stats -->
            <div class="mt-6 flex items-center gap-2">
              <div class="flex -space-x-2">
                <div
                  v-for="lang in title.localizedNames.slice(0, 3)"
                  :key="lang.id"
                  class="w-8 h-8 rounded-full border-2 border-white bg-sand-3 flex items-center justify-center text-[10px] font-bold uppercase"
                >
                  {{ lang.langId.split("-")[0] }}
                </div>
                <div
                  v-if="title.localizedNames.length > 3"
                  class="w-8 h-8 rounded-full border-2 border-white bg-primary text-white flex items-center justify-center text-[10px] font-bold"
                >
                  +{{ title.localizedNames.length - 3 }}
                </div>
              </div>
              <span class="text-xs font-medium text-sand-10">
                {{ title.localizedNames.length }} localization{{
                  title.localizedNames.length !== 1 ? "s" : ""
                }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="p-4 bg-sand-2 flex items-center gap-2 border-t border-sand-4">
            <button
              @click="toggleExpanded(title.id)"
              class="flex-1 py-3 bg-sand-2 hover:bg-primary hover:text-white border border-sand-5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span>{{ expandedTitles.has(title.id) ? "Collapse" : "Manage" }}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4 transition-transform duration-300"
                :class="{ 'rotate-180': expandedTitles.has(title.id) }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <button
              @click="registerTitle(title.id)"
              class="p-3 text-green-400 hover:text-green-600 hover:bg-green-900/20 rounded-xl transition-all active:scale-90"
              title="Register title"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </button>
            <button
              @click="deleteTitle(title.id)"
              class="p-3 text-red-400 hover:text-red-600 hover:bg-red-900/20 rounded-xl transition-all active:scale-90"
              title="Remove title"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </button>
          </div>

          <!-- Expanded -->
          <div
            v-if="expandedTitles.has(title.id)"
            class="px-8 pb-8 bg-sand-2 animate-in slide-in-from-top duration-300"
          >
            <div class="space-y-3">
              <div
                v-for="localized in title.localizedNames"
                :key="localized.id"
                class="group/item flex items-center justify-between p-4 bg-sand-2 rounded-2xl border border-sand-5 hover:border-primary/30 transition-all shadow-sm"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black uppercase"
                  >
                    {{ localized.langId }}
                  </div>
                  <span class="font-bold text-sand-12">{{
                    localized.localizedName
                  }}</span>
                </div>
                <button
                  @click="deleteLocalizedName(title.id, localized.id)"
                  class="opacity-0 group-hover/item:opacity-100 p-2 text-sand-8 hover:text-red-600 transition-all"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>

      <!-- Pagination -->
      <footer
        v-if="titles?.meta?.last_page > 1"
        class="mt-16 flex items-center justify-center gap-4"
      >
        <Link
          v-if="titles.meta.current_page > 1"
          :href="`/?page=${
            titles.meta.current_page - 1
          }&search=${searchQuery}&lang=${selectedLang}`"
          class="flex items-center gap-2 px-6 py-3 bg-sand-2 border border-sand-5 rounded-2xl font-bold shadow-sm hover:bg-sand-3 transition-all active:scale-95"
          preserve-scroll
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Previous</span>
        </Link>

        <div class="hidden sm:flex items-center gap-2">
          <Link
            v-for="p in titles?.meta?.last_page"
            :key="p"
            :href="`/?page=${p}&search=${searchQuery}&lang=${selectedLang}`"
            class="w-10 h-10 flex items-center justify-center rounded-xl cursor-pointer transition-all font-bold"
            :class="
              p === titles.meta.current_page
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'hover:bg-sand-4 border border-transparent'
            "
            preserve-scroll
          >
            {{ p }}
          </Link>
        </div>

        <Link
          v-if="titles.meta.current_page < titles?.meta?.last_page"
          :href="`/?page=${
            titles.meta.current_page + 1
          }&search=${searchQuery}&lang=${selectedLang}`"
          class="flex items-center gap-2 px-6 py-3 bg-sand-2 border border-sand-5 rounded-2xl font-bold shadow-sm hover:bg-sand-3 transition-all active:scale-95"
          preserve-scroll
        >
          <span>Next</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      </footer>
    </main>

    <!-- Add Localized Name Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="closeAddModal">
      <div class="bg-sand-2 rounded-2xl border border-sand-5 shadow-xl max-w-md w-full mx-4" @click.stop>
        <div class="p-6">
          <h3 class="text-lg font-bold text-sand-12 mb-4">Add Localized Name</h3>
          <p class="text-sm text-sand-11 mb-4">
            Add a localized name for: <strong>{{ selectedTitleForAdd?.originalTitle }}</strong>
          </p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-sand-12 mb-2">Language</label>
              <select
                v-model="newLangId"
                class="w-full px-3 py-2 bg-sand-3 border border-sand-5 rounded-xl text-sand-12 focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="pt-BR">Portuguese (Brazil)</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-sand-12 mb-2">Localized Name</label>
              <input
                v-model="newLocalizedName"
                type="text"
                class="w-full px-3 py-2 bg-sand-3 border border-sand-5 rounded-xl text-sand-12 placeholder-sand-9 focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Enter localized title name"
                @keyup.enter="addLocalizedName"
              />
            </div>
          </div>

          <div class="flex gap-3 mt-6">
            <button
              @click="closeAddModal"
              class="flex-1 py-2 px-4 bg-sand-3 hover:bg-sand-4 border border-sand-5 rounded-xl text-sand-12 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              @click="addLocalizedName"
              :disabled="!newLocalizedName.trim()"
              class="flex-1 py-2 px-4 bg-primary hover:bg-primary/90 disabled:bg-sand-4 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
            >
              Add Name
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Translation Modal -->
    <div v-if="showNewTitleModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="closeNewTitleModal">
      <div class="bg-sand-2 rounded-2xl border border-sand-5 shadow-xl max-w-md w-full mx-4" @click.stop>
        <div class="p-6">
          <h3 class="text-lg font-bold text-sand-12 mb-4">Add Translation</h3>
          <p class="text-sm text-sand-11 mb-4">
            Search for an existing title and add a localized translation
          </p>

          <div class="space-y-4">
            <!-- Title Search -->
            <div>
              <label class="block text-sm font-medium text-sand-12 mb-2">Search Title</label>
              <input
                v-model="titleSearchQuery"
                type="text"
                class="w-full px-3 py-2 bg-sand-3 border border-sand-5 rounded-xl text-sand-12 placeholder-sand-9 focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Type to search existing titles..."
                @input="searchTitles"
              />
            </div>

            <!-- Search Results -->
            <div v-if="searchResults.length > 0" class="max-h-40 overflow-y-auto border border-sand-5 rounded-xl bg-sand-3">
              <div
                v-for="title in searchResults"
                :key="title.id"
                class="p-3 border-b border-sand-5 last:border-b-0 hover:bg-sand-4 cursor-pointer"
                @click="selectTitle(title)"
              >
                <div class="font-medium text-sand-12">{{ title.originalTitle }}</div>
                <div class="text-xs text-sand-10">{{ title.imdbId }} • {{ title.mediaType }}</div>
              </div>
            </div>

            <!-- Selected Title Display -->
            <div v-if="selectedExistingTitle" class="p-3 bg-primary/10 border border-primary/30 rounded-xl">
              <div class="text-sm font-medium text-sand-12">Selected Title:</div>
              <div class="font-bold text-primary">{{ selectedExistingTitle.originalTitle }}</div>
              <div class="text-xs text-sand-10">{{ selectedExistingTitle.imdbId }} • {{ selectedExistingTitle.mediaType }}</div>
            </div>

            <!-- Language Selection -->
            <div>
              <label class="block text-sm font-medium text-sand-12 mb-2">Language</label>
              <select
                v-model="newTitleLangId"
                class="w-full px-3 py-2 bg-sand-3 border border-sand-5 rounded-xl text-sand-12 focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="pt-BR">Portuguese (Brazil)</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>

            <!-- Localized Name -->
            <div>
              <label class="block text-sm font-medium text-sand-12 mb-2">Localized Name</label>
              <input
                v-model="newTitleLocalized"
                type="text"
                class="w-full px-3 py-2 bg-sand-3 border border-sand-5 rounded-xl text-sand-12 placeholder-sand-9 focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Enter localized title name"
                @keyup.enter="addTranslationToExistingTitle"
              />
            </div>
          </div>

          <div class="flex gap-3 mt-6">
            <button
              @click="closeNewTitleModal"
              class="flex-1 py-2 px-4 bg-sand-3 hover:bg-sand-4 border border-sand-5 rounded-xl text-sand-12 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              @click="addTranslationToExistingTitle"
              :disabled="!selectedExistingTitle || !newTitleLocalized.trim()"
              class="flex-1 py-2 px-4 bg-primary hover:bg-primary/90 disabled:bg-sand-4 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
            >
              Add Translation
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
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
  animation: slide-in-from-top 0.3s ease-out;
}
</style>
