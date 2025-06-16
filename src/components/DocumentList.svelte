<script>
  import Accordion from './Accordion.svelte';
  export let documents = [];
</script>

<ul class="space-y-2">
  {#each documents as doc}
    <li>
      <Accordion title={doc.name} metadata={doc} pdfUrl={doc.path} />
    </li>
  {/each}
</ul> 