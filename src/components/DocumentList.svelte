<script>
  export let documents = [];
</script>

<ul class="space-y-2">
  {#each documents as doc}
    <li class="border rounded p-2 hover:bg-base-200 transition">
      <a href={doc.path} target="_blank" class="text-accent-600 hover:underline">
        {doc.name}
      </a>
    </li>
  {/each}
</ul> 