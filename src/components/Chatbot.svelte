<script>
  import { onMount } from 'svelte';
  import { systemPrompt } from '../prompts/systemPrompt.js';
  
  // État du composant
  let message = '';
  let messages = [];
  let isLoading = false;
  let error = null;
  let chatContainer;
  let showSystemPrompt = false;
  let showContextText = false;
  let lastSystemPrompt = systemPrompt;
  let lastContextText = '';
  let lastChunksFound = 0;
  let showWarning = false;
  
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
        chunksFound: data.chunksFound,
        systemPrompt: data.systemPrompt,
        contextText: data.contextText,
        userPrompt: data.userPrompt
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
    
    // Mettre à jour les variables de debug pour les réponses du bot
    if (type === MESSAGE_TYPES.BOT) {
      lastSystemPrompt = metadata.systemPrompt || '';
      lastContextText = metadata.contextText || '';
      lastChunksFound = metadata.chunksFound || 0;
    }
    
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
  
  /**
   * Ouvre un PDF dans un nouvel onglet
   */
  function openPdf(url, filename, page) {
    if (url) {
      window.open(url, '_blank');
    } else {
      console.warn('URL PDF non disponible pour:', filename);
    }
  }
  
  /**
   * Formate le texte de la réponse pour rendre les sources cliquables
   */
  function formatAnswerWithClickableSources(answer, sources) {
    if (!sources || sources.length === 0) return answer;
    
    let formattedAnswer = answer;
    
    // Remplace les références de sources par des liens cliquables
    sources.forEach((source, index) => {
      if (source.filename) {
        const sourcePattern = new RegExp(`\\[Source: ${source.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\]]*\\]`, 'g');
        const replacement = source.urlWithPage 
          ? `<a href="${source.urlWithPage}" target="_blank" class="source-link" title="Ouvrir ${source.filename} page ${source.page || '1'}">[Source: ${source.filename}${source.page ? `, page ${source.page}` : ''}]</a>`
          : `[Source: ${source.filename}${source.page ? `, page ${source.page}` : ''}]`;
        
        formattedAnswer = formattedAnswer.replace(sourcePattern, replacement);
      }
    });
    
    return formattedAnswer;
  }
  
  // Message de bienvenue au montage
  onMount(() => {
    addMessage(
      "Bonjour ! Je suis un agent de recherche expérimental qui a pour but de rendre accessible l'information contenue dans les comptes-rendus de conseils municipaux. Posez-moi des questions  et je vous répondrai en me basant sur les documents disponibles.",
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
        <h3 class="text-lg font-semibold">Chatbot Municipal expérimental pour Putanges-le-Lac</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Posez vos questions sur les comptes-rendus des conseils municipaux depuis 2016
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
              {@html formatAnswerWithClickableSources(message.content, message.sources)}
            </div>
            
            <!-- Métadonnées pour les réponses du bot -->
            {#if message.type === MESSAGE_TYPES.BOT && message.sources}
              <div class="message-sources">
                <div class="sources-header">
                  📚 Sources utilisées ({message.chunksFound} extraits)
                </div>
                {#each message.sources as source}
                  <div class="source-item">
                    <button 
                      on:click={() => openPdf(source.urlWithPage, source.filename, source.page)}
                      class="source-link-btn"
                      title="Ouvrir {source.filename} page {source.page || '1'}"
                      disabled={!source.url}
                    >
                      <span class="source-filename">{source.filename || 'Document'}</span>
                      {#if source.page}
                        <span class="source-page">page {source.page}</span>
                      {/if}
                      <span class="source-score">({Math.round(source.score * 100)}% pertinence)</span>
                      {#if source.url}
                        <span class="source-icon">📄</span>
                      {:else}
                        <span class="source-icon-disabled">❌</span>
                      {/if}
                    </button>
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

  <!-- Accordéons de debug -->
  <div class="debug-accordions">
    <!-- Accordéon Prompt Système -->
    <div class="accordion">
      <button 
        class="accordion-header"
        on:click={() => showSystemPrompt = !showSystemPrompt}
      >
        <span>🔧 Prompt Système</span>
        <span class="accordion-icon">{showSystemPrompt ? '▼' : '▶'}</span>
      </button>
      {#if showSystemPrompt}
        <div class="accordion-content">
          <div class="prompt-text" >{lastSystemPrompt || 'Aucun prompt système disponible'}</div>
        </div>
      {/if}
    </div>

    <!-- Accordéon Extraits Utilisés -->
    <div class="accordion">
      <button 
        class="accordion-header"
        on:click={() => showContextText = !showContextText}
      >
        <span>📄 Extraits Utilisés ({lastChunksFound || 0} extraits)</span>
        <span class="accordion-icon">{showContextText ? '▼' : '▶'}</span>
      </button>
      {#if showContextText}
        <div class="accordion-content">
          <div class="context-text" >{lastContextText || 'Aucun extrait disponible'}</div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Accordéon Warning Limitations -->
  <div class="warning-accordion">
    <button 
      class="warning-accordion-header"
      on:click={() => showWarning = !showWarning}
    >
      <span>⚠️ Avertissement - Limitations du service</span>
      <span class="accordion-icon">{showWarning ? '▼' : '▶'}</span>
    </button>
    {#if showWarning}
      <div class="warning-accordion-content">
        <strong>⚠️ Important à savoir</strong>
        <p>
          Ce service utilise l'intelligence artificielle pour faciliter la découverte d'informations dans les comptes-rendus municipaux. Cependant, il présente certaines limitations importantes :
        </p>
        <ul>
          <li><strong>Analyse partielle :</strong> Le système analyse uniquement les 10 extraits les plus pertinents par question, pas l'intégralité des documents</li>
          <li><strong>Pas de mémoire :</strong> Chaque question est traitée indépendamment, sans mémorisation des échanges précédents</li>
          <li><strong>Base de données limitée :</strong> Tous les comptes-rendus ne sont pas forcément inclus dans la base</li>
        </ul>
        <h4>Risques d'erreurs</h4>
        <ul>
          <li><strong>Hallucinations possibles :</strong> L'IA peut parfois générer des informations inexactes ou inventer des détails</li>
          <li><strong>Interprétations erronées :</strong> Le contexte d'une décision peut être mal restitué</li>
          <li><strong>Informations incomplètes :</strong> Des éléments importants peuvent être omis</li>
        </ul>
        <h4>Recommandations d'usage</h4>
        <ul>
          <li>✅ <strong>Utilisez ce service pour :</strong> découvrir rapidement des informations, identifier les documents pertinents, avoir un premier aperçu d'un sujet</li>
          <li>❌ <strong>Ne vous fiez pas uniquement à ce service pour :</strong> prendre des décisions importantes, citer des informations officiellement, comprendre le contexte complet d'une décision</li>
        </ul>
        <p>
          <strong>📋 Vérification recommandée</strong><br>
          Consultez toujours les comptes-rendus sources mentionnés dans les réponses pour vérifier et approfondir les informations. Les références précises (nom du document, numéro de page) sont fournies à cet effet.
        </p>
        <p class="italic">
          Ce service est un outil expérimental d'aide à la recherche, non une source d'information officielle.
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .chatbot-container {
    @apply bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700;
    @apply flex flex-col;
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

  /* Styles pour les liens de sources dans le texte */
  .source-link {
    @apply text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300;
    @apply transition-colors cursor-pointer;
  }

  .message-sources {
    @apply mt-3 pt-3 border-t border-gray-200 dark:border-gray-600;
  }

  .sources-header {
    @apply text-xs font-medium text-gray-600 dark:text-gray-400 mb-2;
  }

  .source-item {
    @apply mb-1;
  }

  .source-link-btn {
    @apply w-full text-left text-xs text-gray-500 dark:text-gray-400;
    @apply flex items-center gap-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600;
    @apply transition-colors cursor-pointer;
    @apply disabled:cursor-not-allowed disabled:opacity-50;
  }

  .source-filename {
    @apply font-medium text-gray-700 dark:text-gray-300;
  }

  .source-page {
    @apply bg-gray-200 dark:bg-gray-600 px-1 rounded text-xs;
  }

  .source-score {
    @apply text-gray-400 text-xs;
  }

  .source-icon {
    @apply text-green-500 ml-auto;
  }

  .source-icon-disabled {
    @apply text-red-500 ml-auto;
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

  /* Styles pour les accordéons de debug */
  .debug-accordions {
    @apply border-t border-gray-200 dark:border-gray-700;
  }

  .accordion {
    @apply border-b border-gray-200 dark:border-gray-700;
  }

  .accordion-header {
    @apply w-full flex items-center justify-between p-3 text-left;
    @apply bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800;
    @apply text-sm font-medium text-gray-700 dark:text-gray-300;
    @apply transition-colors cursor-pointer;
  }

  .accordion-icon {
    @apply text-xs text-gray-500 dark:text-gray-400;
  }

  .accordion-content {
    @apply p-3 bg-white dark:bg-gray-800;
  }

  .prompt-text,
  .context-text {
    max-height: 500px;
    overflow-y: scroll; /* Toujours afficher la barre */
    scrollbar-width: thin;
    scrollbar-color: #3182ce #f7fafc;
    font-family: monospace;
    font-size: 0.95em;
    background: #f7fafc;
    color: #2d3748;
    border-radius: 8px;
    padding: 1em;
    margin: 0.5em 0;
    white-space: pre-wrap;
    line-height: 1.5;
  }

  /* Chrome, Edge, Safari */
  .prompt-text::-webkit-scrollbar,
  .context-text::-webkit-scrollbar {
    width: 10px;
    background: #f7fafc;
  }
  .prompt-text::-webkit-scrollbar-thumb,
  .context-text::-webkit-scrollbar-thumb {
    background: #3182ce;
    border-radius: 6px;
  }

  .prompt-text {
    @apply border-l-4 border-blue-500;
  }

  .context-text {
    @apply border-l-4 border-green-500;
  }

  .warning-accordion {
    border: 1.5px solid #fbbf24;
    border-radius: 8px;
    margin-top: 1.5em;
    background: #fffbea;
  }
  .warning-accordion-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75em 1em;
    background: #fef3c7;
    color: #b45309;
    font-weight: bold;
    font-size: 1em;
    border: none;
    border-radius: 8px 8px 0 0;
    cursor: pointer;
    transition: background 0.2s;
  }
  .warning-accordion-header:hover {
    background: #fde68a;
  }
  .warning-accordion-content {
    padding: 1em;
    color: #92400e;
    font-size: 0.98em;
  }
  .warning-accordion-content ul {
    margin: 0.5em 0 1em 1.5em;
    list-style: disc;
  }
  .warning-accordion-content h4 {
    margin-top: 1em;
    font-weight: bold;
    color: #b45309;
  }
  .warning-accordion-content .italic {
    font-style: italic;
    color: #92400e;
  }
</style>
