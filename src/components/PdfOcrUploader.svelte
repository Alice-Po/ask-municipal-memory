---
<script>
  import { onMount } from 'svelte';
  import Tesseract from 'tesseract.js';

  pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';

  let file;
  let ocrText = '';
  let ocrPages = []; // [{ page_number, text }]
  let progress = 0;
  let processing = false;
  let error = '';
  let uploadStatus = '';
  let uploadProgress = 0;

  async function handleFileChange(event) {
    error = '';
    ocrText = '';
    ocrPages = [];
    progress = 0;
    processing = true;
    const inputFile = event.target.files[0];
    if (!inputFile) return;
    try {
      console.log('Début du traitement du fichier:', inputFile.name);
      const arrayBuffer = await inputFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log('PDF chargé, nombre de pages:', pdf.numPages);
      let results = [];
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
              progress = Math.round(((i - 1 + m.progress) / pdf.numPages) * 100);
              console.log(`OCR page ${i}: ${Math.round(m.progress * 100)}%`);
            }
          }
        });
        console.log(`OCR terminé pour la page ${i}`);
        results.push(text);
        ocrPages.push({ page_number: i, text });
        progress = Math.round((i / pdf.numPages) * 100);
      }
      ocrText = results.join('\n');
      console.log('Texte OCR final:', ocrText);
    } catch (e) {
      error = e.message || 'An error occurred during OCR.';
      console.error('Erreur OCR:', error);
    } finally {
      processing = false;
      console.log('Traitement terminé.');
    }
  }

  function downloadTxt() {
    const blob = new Blob([ocrText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? file.name.replace(/\.pdf$/i, '.txt') : 'ocr-result.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadOcrJson() {
    if (!file) return;
    const exportObj = {
      filename: file.name,
      filepath: file.webkitRelativePath || file.name, // webkitRelativePath si dispo, sinon nom
      pages: ocrPages
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.pdf$/i, '.ocr.json');
    a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadToQdrant() {
    if (!file || !ocrPages.length) return;
    
    uploadStatus = 'Envoi en cours...';
    uploadProgress = 0;
    try {
      const exportObj = {
        filename: file.name,
        filepath: file.webkitRelativePath || file.name,
        pages: ocrPages
      };

      const response = await fetch('/api/QdrantUploader', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportObj),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'envoi à Qdrant');
      }

      uploadStatus = `Succès ! ${result.pages_processed} pages traitées, ${result.total_chunks} chunks créés.`;
      uploadProgress = 100;
    } catch (e) {
      uploadStatus = `Erreur : ${e.message}`;
      console.error('Erreur upload Qdrant:', e);
    }
  }
</script>

<div class="space-y-4">
  <label class="block">
    <span class="font-semibold">Upload a PDF file for OCR (French)</span>
    <input type="file" accept="application/pdf" on:change={handleFileChange} bind:this={file} class="block mt-2" />
  </label>

  {#if processing}
    <div>Processing... {progress}%</div>
  {/if}

  {#if error}
    <div class="text-red-600">{error}</div>
  {/if}

  {#if ocrText && !processing}
    <div>
      <button on:click={downloadTxt} class="px-4 py-2 bg-accent-600 text-white rounded">Download TXT</button>
      <button on:click={downloadOcrJson} class="ml-2 px-4 py-2 bg-accent-700 text-white rounded">Download OCR JSON</button>
      <button on:click={uploadToQdrant} class="ml-2 px-4 py-2 bg-accent-800 text-white rounded">Upload to Qdrant</button>
      
      {#if uploadStatus}
        <div class="mt-2">
          <div class="text-sm">{uploadStatus}</div>
          {#if uploadProgress > 0}
            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
              <div class="bg-accent-600 h-2.5 rounded-full" style="width: {uploadProgress}%"></div>
            </div>
          {/if}
        </div>
      {/if}

      <details class="mt-2">
        <summary class="cursor-pointer">Show extracted text</summary>
        <pre class="bg-base-100 p-2 rounded max-h-96 overflow-auto">{ocrText}</pre>
      </details>
      <details class="mt-2">
        <summary class="cursor-pointer">Show OCR JSON</summary>
        <pre class="bg-base-100 p-2 rounded max-h-96 overflow-auto">{JSON.stringify({ filename: file?.name, filepath: file?.webkitRelativePath || file?.name, pages: ocrPages }, null, 2)}</pre>
      </details>
    </div>
  {/if}
</div> 