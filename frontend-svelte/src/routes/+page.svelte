<script lang="ts">
  export let name: string = "Localizarr";
</script>

<main>
  <h1>Welcome to {name}!</h1>
  <nav style="display:flex; gap:1rem;">
    <a href="/logs">Go to Logs</a>
    <a href="/settings">Settings (LLM)</a>
  </nav>
</main>
