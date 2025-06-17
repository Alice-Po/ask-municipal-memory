<script>
  import { onMount } from 'svelte';
  import Navlink from './Navlink.svelte';
  
  export let active = '';
  export let base = '/';
  export let siteName = 'Municipal Memory';
  export let showFavicon = false;
  export let siteFavicon = '';
  export let manualDarkMode = true;
  
  let isMenuOpen = false;
  let isMobile = false;
  
  // Toggle menu mobile
  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }
  
  // Fermer le menu quand on clique sur un lien
  function closeMenu() {
    isMenuOpen = false;
  }
  
  // Fermer le menu quand on appuie sur Escape
  function handleKeydown(event) {
    if (event.key === 'Escape' && isMenuOpen) {
      closeMenu();
    }
  }
  
  // Détecter si on est sur mobile
  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
      if (!isMobile) {
        isMenuOpen = false;
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    document.addEventListener('keydown', handleKeydown);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<header>
  <nav
    class="flex items-center justify-between p-6 lg:px-8"
    aria-label="Global"
  >
    <!-- Logo -->
    <div class="flex lg:flex-1">
      <a href={base + "/"} class="p-1.5">
        <span class="sr-only">go to home</span>
        <div class="text-3xl flex items-center gap-x-2">
          {#if showFavicon && siteFavicon}
            <span>{siteFavicon}</span>
          {/if}
          <span
            class="hidden md:block font-bold text-base text-base-950 dark:text-base-50"
          >
            {siteName}
          </span>
        </div>
      </a>
    </div>

    <!-- Navigation Desktop -->
    <div class="hidden md:flex gap-x-10 items-center">
      <Navlink
        href={base + "/"}
        active={active === 'home'}
        className="text-sm font-semibold leading-6"
      >
        Accueil
      </Navlink>
      <Navlink
        href={base + "/about"}
        active={active === 'about'}
        className="text-sm font-semibold leading-6"
      >
        À propos
      </Navlink>
      <Navlink
        href={base + "/documents"}
        active={active === 'documents'}
        className="text-sm font-semibold leading-6"
      >
        Documents
      </Navlink>
      <slot name="theme-toggle" />
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-x-4">
      <!-- Bouton hamburger pour mobile -->
      <button
        type="button"
        class="md:hidden inline-flex items-center justify-center p-2 rounded-md text-base-950 dark:text-base-50 hover:bg-base-100 dark:hover:bg-base-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
        aria-controls="mobile-menu"
        aria-expanded={isMenuOpen}
        on:click={toggleMenu}
      >
        <span class="sr-only">Ouvrir le menu principal</span>
        {#if isMenuOpen}
          <!-- Icône X -->
          <svg
            class="block h-6 w-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        {:else}
          <!-- Icône hamburger -->
          <svg
            class="block h-6 w-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        {/if}
      </button>
    </div>
  </nav>

  <!-- Menu mobile -->
  {#if isMenuOpen}
    <div
      id="mobile-menu"
      class="md:hidden"
      role="dialog"
      aria-modal="true"
    >
      <div class="fixed inset-0 z-50" />
      <div class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white dark:bg-base-900 px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-base-900/10">
        <div class="flex items-center justify-between">
          <a href={base + "/"} class="p-1.5" on:click={closeMenu}>
            <span class="sr-only">go to home</span>
            <div class="text-2xl flex items-center gap-x-2">
              {#if showFavicon && siteFavicon}
                <span>{siteFavicon}</span>
              {/if}
              <span class="font-bold text-base-950 dark:text-base-50">
                {siteName}
              </span>
            </div>
          </a>
          <button
            type="button"
            class="rounded-md p-2.5 text-base-950 dark:text-base-50"
            on:click={toggleMenu}
          >
            <span class="sr-only">Fermer le menu</span>
            <svg
              class="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div class="mt-6 flow-root">
          <div class="-my-6 divide-y divide-base-500/10">
            <div class="space-y-2 py-6">
              <Navlink
                href={base + "/"}
                active={active === 'home'}
                className="block rounded-lg px-3 py-2 text-base font-semibold leading-7"
                on:click={closeMenu}
              >
                Accueil
              </Navlink>
              <Navlink
                href={base + "/about"}
                active={active === 'about'}
                className="block rounded-lg px-3 py-2 text-base font-semibold leading-7"
                on:click={closeMenu}
              >
                À propos
              </Navlink>
              <Navlink
                href={base + "/documents"}
                active={active === 'documents'}
                className="block rounded-lg px-3 py-2 text-base font-semibold leading-7"
                on:click={closeMenu}
              >
                Documents
              </Navlink>
            </div>
            <div class="py-4 flex justify-end">
              <slot name="theme-toggle" />
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</header> 