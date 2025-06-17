<script>
  import { onMount } from 'svelte';
  
  // État du composant
  let message = '';
  let messages = [];
  let isLoading = false;
  let error = null;
  let chatContainer;
  
  // Configuration
  const API_ENDPOINT = '/api/chat';
  
  // Types de messages
  const MESSAGE_TYPES = {
    USER: 'user',
    BOT: 'bot',
    ERROR: 'error'
  };
  
  /**
   * Envoie un message au chatbot
   */
  async function sendMessage() {
    if (!message.trim() || isLoading) return;
    
    const userMessage = message.trim();
    message = ''; // Vide le champ
    
    // Ajoute le message utilisateur
    addMessage(userMessage, MESSAGE_TYPES.USER);
    
    // Indique le chargement
    isLoading = true;
    error = null;
    
    try {
      // Appel à l'API
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur de communication avec le serveur');
      }
      
      // Ajoute la réponse du bot
      addMessage(data.answer, MESSAGE_TYPES.BOT, {
        sources: data.sources,
        chunksFound: data.chunksFound
      });
      
    } catch (err) {
      console.error('Erreur chatbot:', err);
      error = err.message;
      addMessage(
        `Désolé, une erreur s'est produite : ${err.message}`, 
        MESSAGE_TYPES.ERROR
      );
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Ajoute un message à la conversation
   */
  function addMessage(content, type, metadata = {}) {
    messages = [...messages, {
      id: Date.now() + Math.random(),
      content,
      type,
      timestamp: new Date(),
      ...metadata
    }];
    
    // Scroll vers le bas après un court délai
    setTimeout(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }
  
  /**
   * Gestion de la touche Entrée
   */
  function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  
  /**
   * Efface l'historique de conversation
   */
  function clearChat() {
    messages = [];
    error = null;
  }
  
  // Message de bienvenue au montage
  onMount(() => {
    addMessage(
      "Bonjour ! Je suis votre assistant municipal. Posez-moi des questions sur les comptes-rendus de conseil municipal et je vous répondrai en me basant sur les documents disponibles.",
      MESSAGE_TYPES.BOT
    );
  });
</script>

<div class="chatbot-container">
  <!-- En-tête du chat -->
  <div class="chat-header">
    <div class="chat-title">
      <div class="chat-icon">🏛️</div>
      <div>
        <h3 class="text-lg font-semibold">Assistant Municipal</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Posez vos questions sur les comptes-rendus
        </p>
      </div>
    </div>
    <button 
      on:click={clearChat}
      class="clear-btn"
      title="Effacer la conversation"
    >
      🗑️
    </button>
  </div>

  <!-- Zone de messages -->
  <div 
    bind:this={chatContainer}
    class="chat-messages"
  >
    {#each messages as message (message.id)}
      <div class="message-wrapper {message.type}">
        <div class="message-content">
          <!-- Avatar et contenu -->
          <div class="message-avatar">
            {#if message.type === MESSAGE_TYPES.USER}
              👤
            {:else if message.type === MESSAGE_TYPES.BOT}
              🤖
            {:else}
              ⚠️
            {/if}
          </div>
          
          <div class="message-bubble">
            <div class="message-text">
              {message.content}
            </div>
            
            <!-- Métadonnées pour les réponses du bot -->
            {#if message.type === MESSAGE_TYPES.BOT && message.sources}
              <div class="message-sources">
                <div class="sources-header">
                  📚 Sources utilisées ({message.chunksFound} extraits)
                </div>
                {#each message.sources as source}
                  <div class="source-item">
                    <span class="source-filename">{source.filename || 'Document'}</span>
                    {#if source.page}
                      <span class="source-page">page {source.page}</span>
                    {/if}
                    <span class="source-score">({Math.round(source.score * 100)}% pertinence)</span>
                  </div>
                {/each}
              </div>
            {/if}
            
            <div class="message-time">
              {message.timestamp.toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          </div>
        </div>
      </div>
    {/each}
    
    <!-- Indicateur de chargement -->
    {#if isLoading}
      <div class="message-wrapper bot">
        <div class="message-content">
          <div class="message-avatar">🤖</div>
          <div class="message-bubble">
            <div class="loading-indicator">
              <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div class="loading-text">Recherche en cours...</div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Zone de saisie -->
  <div class="chat-input-container">
    <div class="input-wrapper">
      <textarea
        bind:value={message}
        on:keydown={handleKeydown}
        placeholder="Posez votre question sur les comptes-rendus municipaux..."
        class="chat-input"
        rows="1"
        disabled={isLoading}
      ></textarea>
      
      <button
        on:click={sendMessage}
        disabled={!message.trim() || isLoading}
        class="send-button"
        title="Envoyer le message"
      >
        {#if isLoading}
          <div class="spinner"></div>
        {:else}
          ➤
        {/if}
      </button>
    </div>
    
    <!-- Indicateur d'erreur -->
    {#if error}
      <div class="error-message">
        ⚠️ {error}
      </div>
    {/if}
  </div>
</div>

<style>
  .chatbot-container {
    @apply bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700;
    @apply flex flex-col h-96 max-h-96;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .chat-header {
    @apply flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700;
    @apply bg-gray-50 dark:bg-gray-900 rounded-t-lg;
  }

  .chat-title {
    @apply flex items-center gap-3;
  }

  .chat-icon {
    @apply text-2xl;
  }

  .clear-btn {
    @apply p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors;
    @apply text-gray-600 dark:text-gray-400;
  }

  .chat-messages {
    @apply flex-1 overflow-y-auto p-4 space-y-4;
    scroll-behavior: smooth;
  }

  .message-wrapper {
    @apply flex;
  }

  .message-wrapper.user {
    @apply justify-end;
  }

  .message-wrapper.bot,
  .message-wrapper.error {
    @apply justify-start;
  }

  .message-content {
    @apply flex items-start gap-3 max-w-[80%];
  }

  .message-wrapper.user .message-content {
    @apply flex-row-reverse;
  }

  .message-avatar {
    @apply text-xl flex-shrink-0;
  }

  .message-bubble {
    @apply rounded-lg p-3 max-w-full;
  }

  .message-wrapper.user .message-bubble {
    @apply bg-blue-500 text-white;
  }

  .message-wrapper.bot .message-bubble {
    @apply bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100;
  }

  .message-wrapper.error .message-bubble {
    @apply bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200;
  }

  .message-text {
    @apply text-sm leading-relaxed;
    white-space: pre-wrap;
  }

  .message-sources {
    @apply mt-3 pt-3 border-t border-gray-200 dark:border-gray-600;
  }

  .sources-header {
    @apply text-xs font-medium text-gray-600 dark:text-gray-400 mb-2;
  }

  .source-item {
    @apply text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mb-1;
  }

  .source-filename {
    @apply font-medium;
  }

  .source-page {
    @apply bg-gray-200 dark:bg-gray-600 px-1 rounded;
  }

  .source-score {
    @apply text-gray-400;
  }

  .message-time {
    @apply text-xs text-gray-400 dark:text-gray-500 mt-2;
  }

  .loading-indicator {
    @apply flex items-center gap-2;
  }

  .loading-dots {
    @apply flex gap-1;
  }

  .loading-dots span {
    @apply w-2 h-2 bg-gray-400 rounded-full animate-pulse;
    animation-delay: calc(var(--i) * 0.2s);
  }

  .loading-dots span:nth-child(1) { --i: 0; }
  .loading-dots span:nth-child(2) { --i: 1; }
  .loading-dots span:nth-child(3) { --i: 2; }

  .loading-text {
    @apply text-sm text-gray-600 dark:text-gray-400;
  }

  .chat-input-container {
    @apply p-4 border-t border-gray-200 dark:border-gray-700;
  }

  .input-wrapper {
    @apply flex items-end gap-2;
  }

  .chat-input {
    @apply flex-1 resize-none border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2;
    @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100;
    @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent;
    @apply placeholder-gray-500 dark:placeholder-gray-400;
    min-height: 44px;
    max-height: 120px;
  }

  .send-button {
    @apply p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600;
    @apply disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed;
    @apply transition-colors flex items-center justify-center;
    min-width: 44px;
    min-height: 44px;
  }

  .spinner {
    @apply w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin;
  }

  .error-message {
    @apply text-sm text-red-600 dark:text-red-400 mt-2 text-center;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .chatbot-container {
      @apply h-80;
    }
    
    .message-content {
      @apply max-w-[90%];
    }
  }

  /* Animations */
  .message-wrapper {
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
