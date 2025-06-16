<script>
  export let title = '';
  export let metadata = {};
  export let pdfUrl = '';
  let open = false;
</script>

<div class="border rounded mb-2">
  <button
    class="w-full text-left px-4 py-2 font-semibold bg-base-100 hover:bg-base-200 flex justify-between items-center"
    on:click={() => (open = !open)}
    aria-expanded={open}
  >
    <span>{title}</span>
    <span>{open ? '▲' : '▼'}</span>
  </button>
  {#if open}
    <div class="px-4 py-2 bg-base-50 border-t">
      <h4 class="font-semibold mb-2">Métadonnées</h4>
      <ul class="text-sm mb-4">
        {#each Object.entries(metadata) as [key, value]}
          <li><span class="font-mono text-xs text-base-600">{key}</span>: {value}</li>
        {/each}
      </ul>
      <div class="flex gap-2 items-center">
        <a href={pdfUrl} target="_blank" class="inline-block px-3 py-1 bg-accent-600 text-white rounded hover:bg-accent-700">Visualiser le PDF</a>
        <slot />
      </div>
    </div>
  {/if}
</div> 