---
<script>

  let file;
  let text = '';
  let processing = false;
  let error = '';
  let success = '';

  async function handleFileChange(event) {
    error = '';
    success = '';
    const inputFile = event.target.files[0];
    if (!inputFile) return;

    try {
      text = await inputFile.text();
    } catch (e) {
      error = "Erreur lors de la lecture du fichier";
      console.error(e);
    }
  }

  async function generateEmbeddings() {
    if (!text) return;

    processing = true;
    error = '';
    success = '';

    try {
      const response = await fetch('/api/QDrantUploader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          filename: file ? file.name : 'unknown.txt'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur API');
      }

      success = "Document stocké avec succès dans Qdrant !";
    } catch (e) {
      error = e.message || "Une erreur est survenue";
      console.error(e);
    } finally {
      processing = false;
    }
  }
</script>

<div class="space-y-4">
  <label class="block">
    <span class="font-semibold">Upload un fichier texte</span>
    <input 
      type="file" 
      accept=".txt" 
      on:change={handleFileChange} 
      bind:this={file} 
      class="block mt-2" 
    />
  </label>

  {#if processing}
    <div class="text-accent-600">Traitement en cours...</div>
  {/if}

  {#if error}
    <div class="text-red-600">{error}</div>
  {/if}

  {#if success}
    <div class="text-green-600">{success}</div>
  {/if}

  {#if text}
    <div>
      <button
        on:click={generateEmbeddings}
        disabled={processing}
        class="px-4 py-2 bg-accent-600 text-white rounded disabled:opacity-50"
      >
        Générer les embeddings et stocker dans Qdrant
      </button>
      <details class="mt-2">
        <summary class="cursor-pointer">Afficher le contenu du fichier</summary>
        <pre class="bg-base-100 p-2 rounded max-h-96 overflow-auto">{text}</pre>
      </details>
    </div>
  {/if}
</div> 