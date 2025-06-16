---
<script>
  import { onMount } from 'svelte';
  import Tesseract from 'tesseract.js';

  pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';

  let file;
  let ocrText = '';
  let progress = 0;
  let processing = false;
  let error = '';

  async function handleFileChange(event) {
    error = '';
    ocrText = '';
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
      <details class="mt-2">
        <summary class="cursor-pointer">Show extracted text</summary>
        <pre class="bg-base-100 p-2 rounded max-h-96 overflow-auto">{ocrText}</pre>
      </details>
    </div>
  {/if}
</div> 