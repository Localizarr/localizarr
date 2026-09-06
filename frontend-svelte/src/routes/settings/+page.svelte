<script lang="ts">
  import { onMount } from 'svelte'
  let ollamaUrl = ''
  let ollamaModel = ''
  let models: string[] = []
  let loadingModels = false
  let saving = false
  let message = ''
  let error = ''

  async function load() {
    const res = await fetch('/api/settings')
    if (res.ok) {
      const d = await res.json()
      ollamaUrl = d.ollama_url || ''
      ollamaModel = d.ollama_model || ''
      if (ollamaUrl) await fetchModels(false)
    }
  }

  async function fetchModels(showMsg = true) {
    if (!ollamaUrl) { error = 'Informe a URL do Ollama'; return }
    loadingModels = true; error = ''; message = ''
    try {
      const res = await fetch(`/api/ollama/models?url=${encodeURIComponent(ollamaUrl)}`)
      const d = await res.json()
      if (!res.ok) { error = d.error || 'Falha ao listar modelos'; models = [] }
      else { models = d.models || []; if (showMsg) message = `${models.length} modelos encontrados` }
    } catch (e: any) { error = e.message } finally { loadingModels = false }
  }

  async function save() {
    saving = true; error=''; message=''
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ollama_url: ollamaUrl, ollama_model: ollamaModel })
      })
      const d = await res.json()
      if (!res.ok) error = d.error || 'Erro ao salvar'
      else message = 'Salvo! Próximas requisições já usam o novo servidor/modelo.'
    } catch (e: any) { error = e.message } finally { saving = false }
  }

  onMount(load)
</script>

<main style="max-width:600px; margin:2rem auto; padding:1rem;">
  <h1>Settings — LLM</h1>
  <p>Escolha o servidor Ollama e o modelo sem precisar editar variável de ambiente.</p>

  <label>Servidor LLM (OLLAMA_URL)
    <input bind:value={ollamaUrl} placeholder="http://localhost:11434" style="width:100%; padding:0.5rem; margin:0.5rem 0;" />
  </label>
  <button on:click={() => fetchModels()} disabled={loadingModels} style="margin-bottom:1rem;">
    {loadingModels ? 'Carregando...' : 'Listar modelos (/models)'}
  </button>

  <label>Modelo (OLLAMA_MODEL)
    {#if models.length}
      <select bind:value={ollamaModel} style="width:100%; padding:0.5rem; margin:0.5rem 0;">
        <option value="">-- selecione --</option>
        {#each models as m}<option value={m}>{m}</option>{/each}
      </select>
    {:else}
      <input bind:value={ollamaModel} placeholder="qwen3:1.7b" style="width:100%; padding:0.5rem; margin:0.5rem 0;" />
    {/if}
  </label>

  <button on:click={save} disabled={saving} style="padding:0.6rem 1.2rem; background:#0a7; color:#fff; border:none; cursor:pointer;">
    {saving ? 'Salvando...' : 'Salvar'}
  </button>

  {#if message}<p style="color:green;">{message}</p>{/if}
  {#if error}<p style="color:red;">{error}</p>{/if}

  <p style="margin-top:1rem;"><a href="/">Voltar</a> · <a href="/logs">Logs</a></p>
</main>
