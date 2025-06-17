<script>
  export let href = '';
  export let active = false;
  export let className = '';
</script>

<a
  href={href}
  class="{className} {active ? 'text-accent-700 hover:text-accent-600 dark:text-accent-500 dark:hover:text-accent-400' : 'text-base-900 dark:text-base-50'}"
  aria-current={active ? 'page' : undefined}
>
  <slot />
</a> 