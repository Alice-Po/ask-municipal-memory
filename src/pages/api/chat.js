/**
 * =============================================================================
 * API ROUTE: CHATBOT RAG MUNICIPAL
 * =============================================================================
 *
 * ENDPOINT: POST /api/chat
 *
 * DESCRIPTION:
 * Cette API route implémente un système de Retrieval-Augmented Generation (RAG)
 * spécialisé pour les comptes-rendus de conseils municipaux. Elle combine
 * recherche vectorielle, filtrage temporel intelligent et génération de texte
 * pour fournir des réponses contextuelles et sourcées.
 *
 * ARCHITECTURE RAG:
 * 1. Embedding de la question utilisateur
 * 2. Recherche vectorielle dans Qdrant
 * 3. Recherche hybride temporelle (filtrage + pondération)
 * 4. Construction du contexte pour le LLM
 * 5. Génération de réponse avec Mistral
 * 6. Enrichissement des sources avec métadonnées
 *
 * TECHNOLOGIES UTILISÉES:
 * - Hugging Face Inference API (embeddings + LLM)
 * - Qdrant Vector Database (stockage et recherche)
 * - Recherche hybride temporelle (propriétaire)
 *
 * PERFORMANCE:
 * - Temps de réponse typique: 2-5 secondes
 * - Limite de tokens: 512 pour la réponse
 * - Chunks analysés: 10 maximum pour le contexte
 *
 * SÉCURITÉ:
 * - Validation des entrées utilisateur
 * - Gestion sécurisée des clés API
 * - Logging détaillé pour audit
 *
 * MAINTENANCE:
 * - Logs structurés avec préfixes [API]
 * - Gestion d'erreurs complète
 * - Métadonnées de debug incluses
 *
 * =============================================================================
 */

export const prerender = false;

// =============================================================================
// IMPORTS ET CONFIGURATION
// =============================================================================

import { config } from 'dotenv';
import { InferenceClient } from '@huggingface/inference';
import { systemPrompt } from '../../prompts/systemPrompt.js';
import { performHybridSearch, logSearchMetadata } from '../../utils/temporalSearch.js';

// Chargement des variables d'environnement
config();

// =============================================================================
// CONSTANTES ET CONFIGURATION
// =============================================================================

/**
 * Configuration des modèles IA utilisés
 */
const AI_MODELS = {
  LLM: 'mistralai/Mistral-7B-Instruct-v0.2', // Modèle de génération de texte
  EMBEDDING: 'sentence-transformers/all-MiniLM-L6-v2', // Modèle d'embeddings (384 dimensions)
};

/**
 * Configuration de la recherche vectorielle
 */
const SEARCH_CONFIG = {
  VECTOR_LIMIT: 20, // Nombre de chunks récupérés de Qdrant
  CONTEXT_LIMIT: 10, // Nombre de chunks utilisés pour le contexte LLM
  MAX_TOKENS: 512, // Limite de tokens pour la réponse
  TEMPERATURE: 0.3, // Créativité du modèle (0 = déterministe, 1 = créatif)
};

/**
 * Configuration de la recherche hybride temporelle
 */
const HYBRID_SEARCH_CONFIG = {
  TEMPORAL_WEIGHT: 0.3, // Poids du facteur temporel (30%)
  YEAR_TOLERANCE: 2, // Tolérance en années (±2 ans)
  ENABLE_FILTERING: true, // Activation du filtrage temporel
  ENABLE_WEIGHTING: true, // Activation de la pondération temporelle
};

// =============================================================================
// FONCTION PRINCIPALE - POST /api/chat
// =============================================================================

/**
 * Gère les requêtes POST pour le chatbot RAG municipal
 *
 * @async
 * @param {Object} params - Paramètres de la requête Astro
 * @param {Request} params.request - Objet Request de la requête HTTP
 * @returns {Promise<Response>} Réponse JSON avec la réponse du chatbot
 *
 * @example
 * // Requête client
 * const response = await fetch('/api/chat', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ message: 'Quels sont les projets pour 2025?' })
 * });
 *
 * // Réponse
 * {
 *   answer: "Réponse générée par l'IA...",
 *   sources: [...],
 *   chunksFound: 5,
 *   searchMetadata: {...}
 * }
 */
export async function POST({ request }) {
  console.log('[API] 🚀 Début de la requête POST /api/chat');

  try {
    // =====================================================================
    // ÉTAPE 1: VALIDATION ET EXTRACTION DES DONNÉES
    // =====================================================================

    console.log('[API] 📝 Validation et extraction des données...');
    const { message } = await request.json();

    // Validation de la requête
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.log('[API] ❌ Message invalide ou manquant');
      return createErrorResponse(400, 'Message manquant ou invalide');
    }

    const userMessage = message.trim();
    console.log('[API] ✅ Message validé:', userMessage.substring(0, 100) + '...');

    // =====================================================================
    // ÉTAPE 2: VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT
    // =====================================================================

    console.log("[API] 🔧 Vérification des variables d'environnement...");
    const envVars = validateEnvironmentVariables();
    if (!envVars.valid) {
      throw new Error(`Configuration manquante: ${envVars.missing.join(', ')}`);
    }
    console.log('[API] ✅ Configuration validée');

    // =====================================================================
    // ÉTAPE 3: GÉNÉRATION DE L'EMBEDDING
    // =====================================================================

    console.log("[API] 🧠 Génération de l'embedding...");
    const hf = new InferenceClient(envVars.hfKey);

    const embeddingRes = await hf.featureExtraction({
      model: AI_MODELS.EMBEDDING,
      inputs: userMessage,
    });

    // Normalisation de la réponse d'embedding
    const embedding = Array.isArray(embeddingRes) ? embeddingRes : embeddingRes[0];
    console.log(`[API] ✅ Embedding généré (${embedding.length} dimensions)`);

    // =====================================================================
    // ÉTAPE 4: RECHERCHE VECTORIELLE DANS QDRANT
    // =====================================================================

    console.log('[API] 🔍 Recherche vectorielle dans Qdrant...');
    const rawChunks = await performVectorSearch(
      embedding,
      envVars.qdrantUrl,
      envVars.qdrantCollection,
      envVars.qdrantApiKey
    );

    console.log(`[API] ✅ ${rawChunks.length} chunks trouvés dans la recherche vectorielle`);

    // =====================================================================
    // ÉTAPE 5: RECHERCHE HYBRIDE TEMPORELLE
    // =====================================================================

    console.log('[API] ⏰ Application de la recherche hybride temporelle...');
    const { chunks: topChunks, metadata: searchMetadata } = performHybridSearch(
      rawChunks,
      userMessage,
      HYBRID_SEARCH_CONFIG
    );

    // Log des métadonnées de recherche pour debug
    logSearchMetadata(searchMetadata, userMessage);

    // Limitation du nombre de chunks pour le contexte LLM
    const finalChunks = topChunks.slice(0, SEARCH_CONFIG.CONTEXT_LIMIT);
    console.log(`[API] ✅ ${finalChunks.length} chunks sélectionnés pour le contexte`);

    // =====================================================================
    // ÉTAPE 6: CONSTRUCTION DU CONTEXTE LLM
    // =====================================================================

    console.log('[API] 📚 Construction du contexte pour le LLM...');
    const contextText = buildContextText(finalChunks);
    const userPrompt = buildUserPrompt(contextText, userMessage);

    // =====================================================================
    // ÉTAPE 7: GÉNÉRATION DE LA RÉPONSE AVEC MISTRAL
    // =====================================================================

    console.log('[API] 🤖 Génération de la réponse avec Mistral...');
    const llmRes = await hf.chatCompletion({
      model: AI_MODELS.LLM,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      parameters: {
        max_tokens: SEARCH_CONFIG.MAX_TOKENS,
        temperature: SEARCH_CONFIG.TEMPERATURE,
      },
    });

    const answer =
      llmRes.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";

    console.log('[API] ✅ Réponse générée:', answer.substring(0, 100) + '...');

    // =====================================================================
    // ÉTAPE 8: CONSTRUCTION DES SOURCES ENRICHIES
    // =====================================================================

    console.log('[API] 📄 Construction des sources enrichies...');
    const sourcesWithUrls = buildEnrichedSources(finalChunks);

    // =====================================================================
    // ÉTAPE 9: PRÉPARATION DE LA RÉPONSE FINALE
    // =====================================================================

    const responseData = {
      answer,
      sources: sourcesWithUrls,
      chunksFound: finalChunks.length,
      searchMetadata,
      systemPrompt,
      contextText,
      userPrompt,
    };

    console.log('[API] ✅ Envoi de la réponse finale');
    return createSuccessResponse(responseData);
  } catch (error) {
    // =====================================================================
    // GESTION D'ERREUR GLOBAL
    // =====================================================================

    console.error('[API] 💥 Exception:', error);
    console.error('[API] 📍 Stack trace:', error.stack);

    return createErrorResponse(500, 'Erreur lors du traitement de votre demande', error.message);
  }
}

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

/**
 * Valide les variables d'environnement requises
 *
 * @returns {Object} Objet avec statut de validation et variables
 */
function validateEnvironmentVariables() {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantCollection = process.env.QDRANT_COLLECTION_NAME || 'municipal_council_minutes';
  const qdrantApiKey = process.env.QDRANT_API_KEY;

  const missing = [];
  if (!hfKey) missing.push('HUGGINGFACE_API_KEY');
  if (!qdrantUrl) missing.push('QDRANT_URL');

  console.log("[API] 📋 Variables d'environnement:");
  console.log('- HUGGINGFACE_API_KEY:', hfKey ? '✅ PRÉSENTE' : '❌ MANQUANTE');
  console.log('- QDRANT_URL:', qdrantUrl || '❌ MANQUANTE');
  console.log('- QDRANT_COLLECTION_NAME:', qdrantCollection);
  console.log('- QDRANT_API_KEY:', qdrantApiKey ? '✅ PRÉSENTE' : '⚠️ MANQUANTE');

  return {
    valid: missing.length === 0,
    missing,
    hfKey,
    qdrantUrl,
    qdrantCollection,
    qdrantApiKey,
  };
}

/**
 * Effectue la recherche vectorielle dans Qdrant
 *
 * @param {Array<number>} embedding - Vecteur d'embedding de la question
 * @param {string} qdrantUrl - URL de l'instance Qdrant
 * @param {string} collection - Nom de la collection
 * @param {string} apiKey - Clé API Qdrant (optionnelle)
 * @returns {Promise<Array>} Chunks trouvés avec métadonnées
 */
async function performVectorSearch(embedding, qdrantUrl, collection, apiKey) {
  const qdrantRes = await fetch(`${qdrantUrl}/collections/${collection}/points/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'api-key': apiKey } : {}),
    },
    body: JSON.stringify({
      vector: embedding,
      limit: SEARCH_CONFIG.VECTOR_LIMIT,
      with_payload: true,
      with_score: true,
    }),
  });

  const qdrantData = await qdrantRes.json();

  if (!qdrantRes.ok) {
    throw new Error(qdrantData.status?.error || 'Erreur lors de la recherche Qdrant');
  }

  return (
    qdrantData.result
      ?.map((pt) => ({
        text: pt.payload?.text,
        score: pt.score,
        filename: pt.payload?.filename,
        page: pt.payload?.page_number,
        year: pt.payload?.year,
      }))
      .filter((chunk) => chunk.text) || []
  );
}

/**
 * Construit le texte de contexte pour le LLM
 *
 * @param {Array} chunks - Chunks de documents sélectionnés
 * @returns {string} Texte de contexte formaté
 */
function buildContextText(chunks) {
  return chunks
    .map((chunk) => {
      const sourceInfo = [
        chunk.filename || 'Document',
        chunk.page ? `page ${chunk.page}` : '',
        chunk.year ? `année ${chunk.year}` : '',
        chunk.temporalScore
          ? `pertinence temporelle: ${(chunk.temporalScore * 100).toFixed(1)}%`
          : '',
      ]
        .filter(Boolean)
        .join(', ');

      return `[Source: ${sourceInfo}]\n${chunk.text}`;
    })
    .join('\n---\n');
}

/**
 * Construit le prompt utilisateur pour le LLM
 *
 * @param {string} contextText - Contexte des documents
 * @param {string} userMessage - Question de l'utilisateur
 * @returns {string} Prompt complet
 */
function buildUserPrompt(contextText, userMessage) {
  return `Contexte des documents municipaux :
${contextText}

Question de l'utilisateur : ${userMessage}`;
}

/**
 * Construit les sources enrichies avec URLs et métadonnées
 *
 * @param {Array} chunks - Chunks de documents
 * @returns {Array} Sources avec URLs et métadonnées temporelles
 */
function buildEnrichedSources(chunks) {
  return chunks.map((chunk) => {
    // Construction de l'URL du PDF
    let pdfUrl = null;
    if (chunk.filename && chunk.year) {
      pdfUrl = `/datas/${chunk.year}/${chunk.filename}`;
    } else if (chunk.filename) {
      // Fallback : extraction de l'année du filename
      const yearMatch = chunk.filename.match(/(\d{4})/);
      if (yearMatch) {
        const year = yearMatch[1];
        pdfUrl = `/datas/${year}/${chunk.filename}`;
      }
    }

    return {
      filename: chunk.filename,
      page: chunk.page,
      year: chunk.year,
      score: chunk.finalScore || chunk.score,
      originalScore: chunk.originalScore || chunk.score,
      temporalScore: chunk.temporalScore,
      url: pdfUrl,
      urlWithPage: chunk.page && pdfUrl ? `${pdfUrl}#page=${chunk.page}` : pdfUrl,
    };
  });
}

/**
 * Crée une réponse de succès
 *
 * @param {Object} data - Données de la réponse
 * @returns {Response} Réponse HTTP
 */
function createSuccessResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Crée une réponse d'erreur
 *
 * @param {number} status - Code de statut HTTP
 * @param {string} message - Message d'erreur
 * @param {string} details - Détails optionnels
 * @returns {Response} Réponse HTTP d'erreur
 */
function createErrorResponse(status, message, details = null) {
  const errorData = { error: message };
  if (details) errorData.details = details;

  return new Response(JSON.stringify(errorData), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// =============================================================================
// GESTION DES MÉTHODES HTTP NON SUPPORTÉES
// =============================================================================

/**
 * Gère les requêtes GET (non supportées)
 *
 * @returns {Response} Réponse d'erreur 405
 */
export async function GET() {
  return createErrorResponse(405, 'Méthode GET non supportée. Utilisez POST.');
}

/**
 * Gère les requêtes PUT (non supportées)
 *
 * @returns {Response} Réponse d'erreur 405
 */
export async function PUT() {
  return createErrorResponse(405, 'Méthode PUT non supportée. Utilisez POST.');
}

/**
 * Gère les requêtes DELETE (non supportées)
 *
 * @returns {Response} Réponse d'erreur 405
 */
export async function DELETE() {
  return createErrorResponse(405, 'Méthode DELETE non supportée. Utilisez POST.');
}

/**
 * Gère les requêtes PATCH (non supportées)
 *
 * @returns {Response} Réponse d'erreur 405
 */
export async function PATCH() {
  return createErrorResponse(405, 'Méthode PATCH non supportée. Utilisez POST.');
}
