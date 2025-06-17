<script>
  import Accordion from './Accordion.svelte';
  import Tesseract from 'tesseract.js';
  import { onMount } from 'svelte';

  // Configuration de PDF.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';

  export let documents = [];
  export let isProd = false;
  
  // État pour chaque document
  let documentStates = new Map();
  
  // Stocker la taille de chaque document
  let fileSizes = [];
  
  // Initialiser l'état pour chaque document
  $: {
    documents.forEach(doc => {
      if (!documentStates.has(doc.path)) {
        documentStates.set(doc.path, {
          processing: false,
          progress: 0,
          error: '',
          uploadStatus: '',
          uploadProgress: 0,
          ocrPages: []
        });
      }
    });
  }

  // Récupérer la taille des fichiers au montage
  onMount(async () => {
    fileSizes = await Promise.all(documents.map(async (doc) => {
      let size = null;
      try {
        const response = await fetch(doc.path);
        const arrayBuffer = await response.arrayBuffer();
        size = arrayBuffer.byteLength;
      } catch (e) {
        size = null;
      }
      return size;
    }));
  });

  function formatSize(size) {
    if (!size) return '?';
    if (size < 1024) return `${size} o`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
    return `${(size / (1024 * 1024)).toFixed(2)} Mo`;
  }

  async function processDocument(doc) {
    const state = documentStates.get(doc.path);
    if (!state || state.processing) return;

    state.processing = true;
    state.progress = 0;
    state.error = '';
    state.uploadStatus = '';
    state.uploadProgress = 0;
    state.ocrPages = [];

    try {
      console.log('Début du traitement du fichier:', doc.name);
      const response = await fetch(doc.path);
      const arrayBuffer = await response.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log('PDF chargé, nombre de pages:', pdf.numPages);

      for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`Traitement de la page ${i} / ${pdf.numPages}`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
        console.log(`Page ${i} rendue sur canvas, début OCR...`);
        
        const { data: { text } } = await Tesseract.recognize(canvas, 'fra', {
          logger: m => {
            if (m.status === 'recognizing text') {
              state.progress = Math.round(((i - 1 + m.progress) / pdf.numPages) * 100);
              console.log(`OCR page ${i}: ${Math.round(m.progress * 100)}%`);
            }
          }
        });
        
        console.log(`OCR terminé pour la page ${i}`);
        state.ocrPages.push({ page_number: i, text });
        state.progress = Math.round((i / pdf.numPages) * 100);
      }

      // Upload vers Qdrant
      state.uploadStatus = 'Envoi en cours...';
      state.uploadProgress = 0;

      const exportObj = {
        filename: doc.name,
        filepath: doc.path,
        year: doc.year,
        pages: state.ocrPages
      };

      const uploadResponse = await fetch('/api/QrrantUploader', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportObj),
      });

      const result = await uploadResponse.json();
      
      if (!uploadResponse.ok) {
        throw new Error(result.error || 'Erreur lors de l\'envoi à Qdrant');
      }

      state.uploadStatus = `Succès ! ${result.pages_processed} pages traitées, ${result.total_chunks} chunks créés.`;
      state.uploadProgress = 100;

    } catch (e) {
      state.error = e.message || 'Une erreur est survenue pendant l\'OCR.';
      console.error('Erreur OCR:', e);
    } finally {
      state.processing = false;
      console.log('Traitement terminé.');
    }
  }

  async function processAllSequentially() {
    for (const doc of documents) {
      await processDocument(doc);
    }
  }
</script>

<ul class="space-y-2">
  {#each documents as doc, i}
    {@const state = documentStates.get(doc.path)}
    <li>
      <Accordion 
        title={`${doc.name} ` + (fileSizes[i] !== undefined ? `(${formatSize(fileSizes[i])})` : '(...)')}
        metadata={doc}
        pdfUrl={doc.path}
      >
        {#if !isProd}
          <button 
            on:click={() => processDocument(doc)}
            disabled={state?.processing}
            class="inline-block px-3 py-1 bg-accent-600 text-white rounded hover:bg-accent-700 disabled:opacity-50"
          >
            {state?.processing ? 'Traitement en cours...' : 'Appliquer OCR'}
          </button>
        {/if}
      </Accordion>

      {#if state?.processing || state?.error || state?.uploadStatus}
        <div class="px-4 py-2 bg-base-50 border-t text-sm">
          {#if state?.processing}
            <div>OCR en cours... {state.progress}%</div>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
              <div class="bg-accent-600 h-2.5 rounded-full" style="width: {state.progress}%"></div>
            </div>
          {/if}

          {#if state?.error}
            <div class="text-red-600">{state.error}</div>
          {/if}

          {#if state?.uploadStatus}
            <div class="mt-2">
              <div>{state.uploadStatus}</div>
              {#if state.uploadProgress > 0}
                <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                  <div class="bg-accent-600 h-2.5 rounded-full" style="width: {state.uploadProgress}%"></div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </li>
  {/each}
</ul>

{#if !isProd}
  <div class="space-y-4">
    <div class="flex justify-end">
      <button 
        on:click={processAllSequentially}
        class="px-4 py-2 bg-accent-600 text-white rounded hover:bg-accent-700"
      >
        Traiter tous les documents
      </button>
    </div>
  </div>
{/if} 