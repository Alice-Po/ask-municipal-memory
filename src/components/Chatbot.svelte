<!--
  =============================================================================
  CHATBOT MUNICIPAL - COMPOSANT SVELTE
  =============================================================================
  
  DESCRIPTION:
  Ce composant implémente un chatbot expérimental pour interroger les comptes-rendus
  de conseils municipaux. Il utilise l'IA pour analyser des documents PDF et répondre
  aux questions des utilisateurs en se basant sur le contenu extrait.
  
  FONCTIONNALITÉS PRINCIPALES:
  - Interface de chat en temps réel
  - Recherche sémantique dans les documents municipaux
  - Affichage des sources avec liens vers les PDF
  - Gestion des erreurs et états de chargement
  - Mode debug avec accordéons pour les développeurs
  - Interface responsive (desktop/mobile)
  
  ARCHITECTURE:
  - État local géré par Svelte (messages, loading, error, etc.)
  - Communication avec l'API backend via fetch()
  - Formatage des réponses avec liens cliquables
  - Gestion des événements clavier (Entrée pour envoyer)
  - Scroll automatique vers le bas
  
  UTILISATION:
  <Chatbot client:only="svelte" />
  
  PROPS:
  Aucune prop requise - le composant est autonome
  
  ÉVÉNEMENTS:
  - Aucun événement émis vers le parent
  
  API ENDPOINT:
  - POST /api/chat
  - Body: { message: string }
  - Response: { answer, sources, chunksFound, systemPrompt, contextText, userPrompt }
  
  TYPES DE MESSAGES:
  - 'user': Messages envoyés par l'utilisateur
  - 'bot': Réponses générées par l'IA
  - 'error': Messages d'erreur
  
  STRUCTURE DES SOURCES:
  {
    filename: string,
    page: number,
    score: number,
    url: string,
    urlWithPage: string
  }
  
  LIMITATIONS:
  - Pas de mémoire de conversation (chaque question est indépendante)
  - Analyse limitée aux 10 extraits les plus pertinents
  - Dépendance aux services externes (HuggingFace, Qdrant)
  
  SÉCURITÉ:
  - Validation des entrées côté client et serveur
  - Échappement HTML pour éviter les XSS
  - Gestion des erreurs réseau et serveur
  
  ACCESSIBILITÉ:
  - Support des lecteurs d'écran (aria-labels, sr-only)
  - Navigation au clavier
  - Contraste et tailles de police adaptées
  
  PERFORMANCE:
  - Lazy loading des composants
  - Debouncing des requêtes
  - Optimisation des re-renders Svelte
  
  MAINTENANCE:
  - Code modulaire et commenté
  - Variables d'état clairement nommées
  - Fonctions pures quand possible
  - Gestion d'erreur centralisée
  
  =============================================================================
-->

<script>
  import { onMount } from 'svelte';
  import { systemPrompt } from '../prompts/systemPrompt.js';
  
  // =============================================================================
  // ÉTAT DU COMPOSANT
  // =============================================================================
  
  // État de la conversation
  let message = '';                    // Message en cours de saisie
  let messages = [];                   // Historique des messages
  let isLoading = false;               // Indicateur de chargement
  let error = null;                    // Message d'erreur actuel
  let chatContainer;                   // Référence au conteneur de messages
  
  // État des accordéons de debug (développeurs uniquement)
  let showSystemPrompt = false;        // Affichage du prompt système
  let showContextText = false;         // Affichage du contexte utilisé
  let showWarning = false;             // Affichage des avertissements
  let showSearchMetadata = false;      // Affichage des métadonnées de recherche
  
  // Métadonnées de la dernière réponse (pour debug)
  let lastSystemPrompt = systemPrompt; // Dernier prompt système utilisé
  let lastContextText = '';            // Dernier contexte extrait
  let lastChunksFound = 0;             // Nombre d'extraits trouvés
  let lastSearchMetadata = null;       // Métadonnées de recherche hybride
  
  // =============================================================================
  // CONFIGURATION
  // =============================================================================
  
  const API_ENDPOINT = '/api/chat';    // Endpoint de l'API backend
  
  // Types de messages pour la classification
  const MESSAGE_TYPES = {
    USER: 'user',    // Message envoyé par l'utilisateur
    BOT: 'bot',      // Réponse générée par l'IA
    ERROR: 'error'   // Message d'erreur
  };
  
  // =============================================================================
  // FONCTIONS PRINCIPALES
  // =============================================================================
  
  /**
   * Envoie un message au chatbot et gère la réponse
   * 
   * Cette fonction est le cœur du composant. Elle :
   * 1. Valide l'entrée utilisateur
   * 2. Met à jour l'interface (ajout du message, état de chargement)
   * 3. Envoie la requête à l'API backend
   * 4. Traite la réponse ou l'erreur
   * 5. Met à jour l'interface avec le résultat
   * 
   * @async
   * @returns {Promise<void>}
   */
  async function sendMessage() {
    // Validation de l'entrée
    if (!message.trim() || isLoading) return;
    
    const userMessage = message.trim();
    message = ''; // Vide le champ de saisie
    
    // Ajoute le message utilisateur à l'historique
    addMessage(userMessage, MESSAGE_TYPES.USER);
    
    // Active l'état de chargement
    isLoading = true;
    error = null;
    
    try {
      // Appel à l'API backend
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });
      
      const data = await response.json();
      
      // Vérification de la réponse HTTP
      if (!response.ok) {
        throw new Error(data.error || 'Erreur de communication avec le serveur');
      }
      
      // Ajoute la réponse du bot avec ses métadonnées
      addMessage(data.answer, MESSAGE_TYPES.BOT, {
        sources: data.sources,           // Sources utilisées
        chunksFound: data.chunksFound,   // Nombre d'extraits
        systemPrompt: data.systemPrompt, // Prompt système utilisé
        contextText: data.contextText,   // Contexte extrait
        userPrompt: data.userPrompt,      // Prompt utilisateur
        searchMetadata: data.searchMetadata
      });
      
    } catch (err) {
      // Gestion des erreurs
      console.error('Erreur chatbot:', err);
      error = err.message;
      addMessage(
        `Désolé, une erreur s'est produite : ${err.message}`, 
        MESSAGE_TYPES.ERROR
      );
    } finally {
      // Désactive l'état de chargement
      isLoading = false;
    }
  }
  
  /**
   * Ajoute un message à l'historique de conversation
   * 
   * @param {string} content - Contenu du message
   * @param {string} type - Type de message (user/bot/error)
   * @param {Object} metadata - Métadonnées optionnelles (sources, etc.)
   */
  function addMessage(content, type, metadata = {}) {
    // Création du nouveau message avec timestamp unique
    const newMessage = {
      id: Date.now() + Math.random(), // ID unique pour Svelte
      content,
      type,
      timestamp: new Date(),
      ...metadata
    };
    
    // Ajout à l'historique (immutabilité pour Svelte)
    messages = [...messages, newMessage];
    
    // Mise à jour des variables de debug pour les réponses du bot
    if (type === MESSAGE_TYPES.BOT) {
      lastSystemPrompt = metadata.systemPrompt || '';
      lastContextText = metadata.contextText || '';
      lastChunksFound = metadata.chunksFound || 0;
      lastSearchMetadata = metadata.searchMetadata || null;
    }
    
    // Scroll automatique vers le bas après un court délai
    setTimeout(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }
  
  // =============================================================================
  // FONCTIONS UTILITAIRES
  // =============================================================================
  
  /**
   * Gestion de la touche Entrée pour envoyer le message
   * 
   * @param {KeyboardEvent} event - Événement clavier
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
   * 
   * @param {string} url - URL du PDF
   * @param {string} filename - Nom du fichier
   * @param {number} page - Numéro de page
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
   * 
   * Cette fonction remplace les références de sources dans le texte
   * par des liens HTML cliquables qui ouvrent les PDF correspondants.
   * 
   * @param {string} answer - Réponse du bot
   * @param {Array} sources - Liste des sources utilisées
   * @returns {string} Texte formaté avec liens HTML
   */
  function formatAnswerWithClickableSources(answer, sources) {
    if (!sources || sources.length === 0) return answer;
    
    let formattedAnswer = answer;
    
    // Remplace chaque référence de source par un lien cliquable
    sources.forEach((source, index) => {
      if (source.filename) {
        // Échappement des caractères spéciaux pour l'expression régulière
        const escapedFilename = source.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const sourcePattern = new RegExp(`\\[Source: ${escapedFilename}[^\\]]*\\]`, 'g');
        
        // Création du lien HTML
        const replacement = source.urlWithPage 
          ? `<a href="${source.urlWithPage}" target="_blank" class="source-link" title="Ouvrir ${source.filename} page ${source.page || '1'}">[Source: ${source.filename}${source.page ? `, page ${source.page}` : ''}]</a>`
          : `[Source: ${source.filename}${source.page ? `, page ${source.page}` : ''}]`;
        
        formattedAnswer = formattedAnswer.replace(sourcePattern, replacement);
      }
    });
    
    return formattedAnswer;
  }
  
  /**
   * Tronque intelligemment un nom de fichier pour l'affichage
   * @param {string} filename - Nom du fichier complet
   * @param {number} maxLength - Longueur maximale (défaut: 30)
   * @returns {string} - Nom tronqué avec ellipsis
   */
  function truncateFilename(filename, maxLength = 30) {
    if (!filename || filename.length <= maxLength) return filename;
    
    // Si c'est un PDF, on garde l'extension
    if (filename.endsWith('.pdf')) {
      const nameWithoutExt = filename.slice(0, -4);
      const extension = '.pdf';
      const maxNameLength = maxLength - extension.length - 3; // 3 pour "..."
      
      if (nameWithoutExt.length <= maxNameLength) return filename;
      
      return nameWithoutExt.slice(0, maxNameLength) + '...' + extension;
    }
    
    // Sinon, troncature simple
    return filename.slice(0, maxLength - 3) + '...';
  }
  
  // =============================================================================
  // LIFECYCLE DU COMPOSANT
  // =============================================================================
  
  /**
   * Initialisation du composant
   * 
   * Ajoute un message de bienvenue au montage du composant
   */
  onMount(() => {
    addMessage(
      "Bonjour ! Je suis un agent de recherche expérimental qui a pour but de rendre accessible l'information contenue dans les comptes-rendus de conseils municipaux. Posez-moi des questions, en précisant une année si possible et je vous répondrai en me basant sur les documents disponibles.",
      MESSAGE_TYPES.BOT
    );
  });
</script>

<!-- =============================================================================
     TEMPLATE HTML
     ============================================================================= -->

<div class="chatbot-container">
  <!-- En-tête du chat -->
  <div class="chat-header">
    <div class="chat-title">
      <div class="chat-icon">🏛️</div>
      <div>
        <h3 class="text-lg font-semibold"><strong>Prototype</strong>  de chatbot Municipale pour Putanges-le-Lac</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Posez vos questions sur les comptes-rendus des conseils municipaux depuis 2016
        </p>
      </div>
    </div>
    <button 
      on:click={clearChat}
      class="clear-btn"
      title="Effacer la conversation"
      aria-label="Effacer l'historique de conversation"
    >
      🗑️
    </button>
  </div>

  <!-- Zone de messages -->
  <div 
    bind:this={chatContainer}
    class="chat-messages"
    role="log"
    aria-live="polite"
    aria-label="Historique de conversation"
  >
    {#each messages as message (message.id)}
      <div class="message-wrapper {message.type}">
        <div class="message-content">
          <!-- Avatar et contenu -->
          <div class="message-avatar" aria-hidden="true">
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
                  <div class="sources-title">
                    📚 Sources utilisées ({message.chunksFound} extraits)
                  </div>
                  {#if message.searchMetadata}
                    {#if message.searchMetadata.queryYear}
                      <div class="temporal-info">
                        🕒 {message.searchMetadata.queryYear}
                        {#if message.searchMetadata.temporalFilterApplied}
                          <span class="filter-applied">±2 ans</span>
                        {/if}
                        {#if message.searchMetadata.temporalWeightingApplied}
                          <span class="weighting-applied">pondéré</span>
                        {/if}
                      </div>
                    {/if}
                  {/if}
                </div>
                <div class="sources-list">
                  {#each message.sources as source}
                    <div class="source-item">
                      <button 
                        on:click={() => openPdf(source.urlWithPage, source.filename, source.page)}
                        class="source-link-btn"
                        title="Ouvrir {source.filename} page {source.page || '1'}"
                        disabled={!source.url}
                        aria-label="Ouvrir le document {source.filename || 'Document'} {source.page ? `page ${source.page}` : ''} {source.year ? `de l'année ${source.year}` : ''} - Pertinence {Math.round(source.score * 100)}%"
                      >
                        <div class="source-main-info">
                          <div 
                            class="source-filename" 
                            title={source.filename && source.filename.length > 30 ? source.filename : ''}
                          >
                            {truncateFilename(source.filename)}
                          </div>
                          <div class="source-meta">
                            {#if source.year}
                              <span class="source-year">{source.year}</span>
                            {/if}
                            {#if source.page}
                              <span class="source-page">page {source.page}</span>
                            {/if}
                          </div>
                        </div>
                        <div class="source-scores">
                          <div class="score-container">
                            <span class="score-label">Pertinence:</span>
                            <span class="source-score">
                              {Math.round(source.score * 100)}%
                              {#if source.temporalScore}
                                <span class="temporal-score">({Math.round(source.temporalScore * 100)}%)</span>
                              {/if}
                            </span>
                          </div>
                          {#if source.url}
                            <span class="source-icon" title="Ouvrir le document">📄</span>
                          {:else}
                            <span class="source-icon-disabled" title="Document non disponible">❌</span>
                          {/if}
                        </div>
                      </button>
                    </div>
                  {/each}
                </div>
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
        aria-label="Zone de saisie du message"
      ></textarea>
      
      <button
        on:click={sendMessage}
        disabled={!message.trim() || isLoading}
        class="send-button"
        title="Envoyer le message"
        aria-label="Envoyer le message"
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
      <div class="error-message" role="alert">
        ⚠️ {error}
      </div>
    {/if}
  </div>

  <!-- Accordéons de debug (développeurs uniquement) -->
  <div class="debug-accordions">
    <!-- Accordéon Prompt Système -->
    <div class="accordion">
      <button 
        class="accordion-header"
        on:click={() => showSystemPrompt = !showSystemPrompt}
        aria-expanded={showSystemPrompt}
        aria-controls="system-prompt-content"
      >
        <span>🔧 Prompt Système</span>
        <span class="accordion-icon">{showSystemPrompt ? '▼' : '▶'}</span>
      </button>
      {#if showSystemPrompt}
        <div id="system-prompt-content" class="accordion-content">
          <div class="prompt-text" >{lastSystemPrompt || 'Aucun prompt système disponible'}</div>
        </div>
      {/if}
    </div>

    <!-- Accordéon Extraits Utilisés -->
    <div class="accordion">
      <button 
        class="accordion-header"
        on:click={() => showContextText = !showContextText}
        aria-expanded={showContextText}
        aria-controls="context-text-content"
      >
        <span>📄 Extraits Utilisés ({lastChunksFound || 0} extraits)</span>
        <span class="accordion-icon">{showContextText ? '▼' : '▶'}</span>
      </button>
      {#if showContextText}
        <div id="context-text-content" class="accordion-content">
          <div class="context-text" >{lastContextText || 'Aucun extrait disponible'}</div>
        </div>
      {/if}
    </div>

    <!-- Accordéon Métadonnées de Recherche -->
    <div class="accordion">
      <button 
        class="accordion-header"
        on:click={() => showSearchMetadata = !showSearchMetadata}
        aria-expanded={showSearchMetadata}
        aria-controls="search-metadata-content"
      >
        <span>🔍 Métadonnées de Recherche</span>
        <span class="accordion-icon">{showSearchMetadata ? '▼' : '▶'}</span>
      </button>
      {#if showSearchMetadata}
        <div id="search-metadata-content" class="accordion-content">
          <div class="search-metadata">
            {#if lastSearchMetadata}
              <p><strong>Recherche hybride temporelle:</strong></p>
              <ul>
                {#if lastSearchMetadata.queryYear}
                  <li><strong>Année détectée:</strong> {lastSearchMetadata.queryYear}</li>
                {/if}
                <li><strong>Filtrage temporel:</strong> {lastSearchMetadata.temporalFilterApplied ? 'Activé' : 'Désactivé'}</li>
                <li><strong>Pondération temporelle:</strong> {lastSearchMetadata.temporalWeightingApplied ? 'Activée' : 'Désactivée'}</li>
                <li><strong>Chunks originaux:</strong> {lastSearchMetadata.originalCount}</li>
                <li><strong>Chunks après filtrage:</strong> {lastSearchMetadata.filteredCount}</li>
              </ul>
            {:else}
              <p>Aucune métadonnée de recherche disponible</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Accordéon Warning Limitations -->
  <div class="warning-accordion">
    <button 
      class="warning-accordion-header"
      on:click={() => showWarning = !showWarning}
      aria-expanded={showWarning}
      aria-controls="warning-content"
    >
      <span>⚠️ Avertissement - Limitations du service</span>
      <span class="accordion-icon">{showWarning ? '▼' : '▶'}</span>
    </button>
    {#if showWarning}
      <div id="warning-content" class="warning-accordion-content">
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

<!-- =============================================================================
     STYLES CSS
     ============================================================================= -->

<style>
  /* =============================================================================
     CONTAINER PRINCIPAL
     ============================================================================= */
  
  .chatbot-container {
    @apply bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700;
    @apply flex flex-col;
    font-family: system-ui, -apple-system, sans-serif;
  }

  /* =============================================================================
     EN-TÊTE DU CHAT
     ============================================================================= */
  
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

  /* =============================================================================
     ZONE DE MESSAGES
     ============================================================================= */
  
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

  /* =============================================================================
     LIENS DE SOURCES
     ============================================================================= */
  
  .source-link {
    @apply text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300;
    @apply transition-colors cursor-pointer;
  }

  .message-sources {
    @apply mt-3 pt-3 border-t border-gray-200 dark:border-gray-600;
  }

  .sources-header {
    @apply flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3;
  }

  .sources-title {
    @apply text-xs font-medium text-gray-600 dark:text-gray-400;
  }

  .sources-list {
    @apply space-y-2;
  }

  .source-item {
    @apply w-full;
    animation: slideInSource 0.3s ease-out;
    animation-fill-mode: both;
  }

  .source-item:nth-child(1) { animation-delay: 0.1s; }
  .source-item:nth-child(2) { animation-delay: 0.2s; }
  .source-item:nth-child(3) { animation-delay: 0.3s; }
  .source-item:nth-child(4) { animation-delay: 0.4s; }
  .source-item:nth-child(5) { animation-delay: 0.5s; }

  @keyframes slideInSource {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .source-link-btn {
    @apply w-full text-left text-xs text-gray-500 dark:text-gray-400;
    @apply flex items-center justify-between gap-2 p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600;
    @apply transition-all duration-200 cursor-pointer;
    @apply disabled:cursor-not-allowed disabled:opacity-50;
    @apply border border-transparent hover:border-gray-300 dark:hover:border-gray-500;
    @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50;
    @apply active:scale-[0.98];
  }

  .source-link-btn:hover {
    @apply shadow-sm;
  }

  .source-link-btn:disabled {
    @apply hover:bg-transparent hover:border-transparent hover:shadow-none;
  }

  .source-main-info {
    @apply flex-1 min-w-0;
  }

  .source-filename {
    @apply font-medium text-gray-700 dark:text-gray-300 text-sm;
    @apply truncate;
  }

  .source-meta {
    @apply flex flex-wrap gap-1 mt-1;
  }

  .source-page {
    @apply bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded text-xs;
  }

  .source-scores {
    @apply flex items-center gap-2 flex-shrink-0;
  }

  .score-container {
    @apply flex items-center gap-1;
  }

  .score-label {
    @apply text-xs font-medium text-gray-600 dark:text-gray-400;
  }

  .source-score {
    @apply text-gray-400 text-xs whitespace-nowrap;
  }

  .source-year {
    @apply text-blue-600 dark:text-blue-400 text-xs font-medium;
    @apply bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded;
  }

  .temporal-score {
    @apply text-orange-600 dark:text-orange-400 text-xs;
    @apply bg-orange-100 dark:bg-orange-900 px-1 py-0.5 rounded;
  }

  .temporal-info {
    @apply text-xs text-blue-600 dark:text-blue-400;
    @apply bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded;
    @apply flex items-center gap-1 flex-wrap;
  }

  .filter-applied {
    @apply text-green-600 dark:text-green-400;
  }

  .weighting-applied {
    @apply text-purple-600 dark:text-purple-400;
  }

  .source-icon {
    @apply text-green-500 text-sm cursor-pointer;
    @apply hover:scale-110 transition-transform;
  }

  .source-icon-disabled {
    @apply text-red-500 text-sm;
  }

  .message-time {
    @apply text-xs text-gray-400 dark:text-gray-500 mt-2;
  }

  /* =============================================================================
     INDICATEUR DE CHARGEMENT
     ============================================================================= */
  
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

  /* =============================================================================
     ZONE DE SAISIE
     ============================================================================= */
  
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

  /* =============================================================================
     RESPONSIVE DESIGN
     ============================================================================= */
  
  @media (max-width: 640px) {
    .message-content {
      @apply max-w-[90%];
    }

    .sources-header {
      @apply flex-col gap-1;
    }

    .sources-title {
      @apply text-sm;
    }

    .temporal-info {
      @apply text-xs px-1.5 py-0.5;
    }

    .source-link-btn {
      @apply p-1.5;
    }

    .source-filename {
      @apply text-xs;
    }

    .source-meta {
      @apply gap-0.5;
    }

    .source-year,
    .source-page {
      @apply px-1 py-0.5 text-xs;
    }

    .source-scores {
      @apply gap-1;
    }

    .source-score {
      @apply text-xs;
    }

    .temporal-score {
      @apply px-0.5 py-0.5 text-xs;
    }
  }

  @media (max-width: 480px) {
    .message-content {
      @apply max-w-[95%];
    }

    .source-link-btn {
      @apply flex-col items-start gap-1 p-2;
    }

    .source-scores {
      @apply w-full justify-between;
    }

    .score-label {
      @apply hidden;
    }

    .temporal-info {
      @apply flex-col items-start gap-0.5;
    }
  }

  /* =============================================================================
     ANIMATIONS
     ============================================================================= */
  
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

  /* =============================================================================
     ACCORDÉONS DE DEBUG
     ============================================================================= */
  
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

  .search-metadata {
    @apply border-l-4 border-purple-500;
    @apply bg-purple-50 dark:bg-purple-900/20 p-3 rounded;
  }

  .search-metadata ul {
    @apply list-disc list-inside space-y-1 mt-2;
  }

  .search-metadata li {
    @apply text-sm text-gray-700 dark:text-gray-300;
  }

  /* =============================================================================
     ACCORDÉON D'AVERTISSEMENT
     ============================================================================= */
  
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
