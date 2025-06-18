/**
 * =============================================================================
 * API ROUTE: QDRANT UPLOADER - DOCUMENT INDEXING PIPELINE
 * =============================================================================
 *
 * ENDPOINT: POST /api/QdrantUploader
 *
 * DESCRIPTION:
 * Cette API route gère l'indexation des documents municipaux dans la base de
 * données vectorielle Qdrant. Elle implémente un pipeline complet de traitement
 * des documents : découpage en chunks, génération d'embeddings, et stockage
 * avec métadonnées enrichies.
 *
 * PIPELINE D'INDEXATION:
 * 1. Validation des données d'entrée
 * 2. Vérification/création de la collection Qdrant
 * 3. Découpage des pages en chunks de texte
 * 4. Génération d'embeddings pour chaque chunk
 * 5. Stockage avec métadonnées complètes
 *
 * UTILISATION PÉDAGOGIQUE:
 * Ce fichier illustre les concepts fondamentaux du RAG :
 * - Préprocessing des documents
 * - Chunking intelligent
 * - Génération d'embeddings
 * - Stockage vectoriel avec métadonnées
 * - Gestion d'erreurs robuste
 *
 * TECHNOLOGIES UTILISÉES:
 * - Qdrant Vector Database (stockage)
 * - Hugging Face Inference API (embeddings)
 * - Node.js crypto (génération d'IDs)
 *
 * PERFORMANCE:
 * - Chunking: ~1000 caractères par chunk
 * - Embeddings: 384 dimensions (all-MiniLM-L6-v2)
 * - Métadonnées: Complètes pour traçabilité
 *
 * =============================================================================
 */

export const prerender = false;

// =============================================================================
// IMPORTS ET CONFIGURATION
// =============================================================================

import { QdrantClient } from '@qdrant/js-client-rest';
import { InferenceClient } from '@huggingface/inference';
import { config } from 'dotenv';
import crypto from 'crypto';

// Chargement des variables d'environnement
config();

// =============================================================================
// CONSTANTES ET CONFIGURATION
// =============================================================================

/**
 * Configuration du chunking des documents
 */
const CHUNKING_CONFIG = {
  MAX_CHUNK_SIZE: 1000, // Taille maximale d'un chunk en caractères
  EMBEDDING_MODEL: 'sentence-transformers/all-MiniLM-L6-v2', // Modèle d'embeddings
  VECTOR_DISTANCE: 'Cosine', // Métrique de similarité pour Qdrant
};

/**
 * Structure des métadonnées stockées avec chaque chunk
 */
const METADATA_STRUCTURE = {
  text: 'string', // Contenu textuel du chunk
  filename: 'string', // Nom du fichier source
  filepath: 'string', // Chemin complet du fichier
  year: 'number', // Année du document
  page_number: 'number', // Numéro de page
  chunk_index: 'number', // Index du chunk dans la page
  total_chunks: 'number', // Nombre total de chunks dans la page
  timestamp: 'string', // Timestamp ISO de création
  _timestamp: 'number', // Timestamp Unix pour indexation
};

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

/**
 * Découpe un texte en chunks de taille optimale pour les embeddings
 *
 * Cette fonction implémente un algorithme de chunking intelligent qui :
 * - Respecte les paragraphes naturels du texte
 * - Évite de couper les mots au milieu
 * - Maintient une taille optimale pour les embeddings
 * - Préserve la cohérence sémantique
 *
 * @param {string} text - Texte à découper
 * @param {number} maxLen - Taille maximale d'un chunk (défaut: 1000)
 * @returns {Array<string>} Tableau de chunks de texte
 *
 * @example
 * const chunks = chunkText("Paragraphe 1...\n\nParagraphe 2...", 1000);
 * // Retourne: ["Paragraphe 1...", "Paragraphe 2..."]
 */
function chunkText(text, maxLen = CHUNKING_CONFIG.MAX_CHUNK_SIZE) {
  const chunks = [];
  let current = '';

  // Division par paragraphes pour préserver la structure
  for (const paragraph of text.split(/\n+/)) {
    // Si l'ajout du paragraphe dépasse la limite
    if ((current + paragraph).length > maxLen) {
      // Sauvegarde du chunk actuel s'il n'est pas vide
      if (current) chunks.push(current);
      // Commence un nouveau chunk avec le paragraphe actuel
      current = paragraph;
    } else {
      // Ajoute le paragraphe au chunk actuel
      current += (current ? '\n' : '') + paragraph;
    }
  }

  // Ajoute le dernier chunk s'il n'est pas vide
  if (current) chunks.push(current);

  return chunks;
}

/**
 * Valide les données d'entrée pour l'upload
 *
 * @param {Object} data - Données reçues de la requête
 * @returns {Object} Résultat de validation avec statut et message
 */
function validateUploadData(data) {
  const { filename, filepath, year, pages } = data;

  // Validation des pages
  if (!pages || !Array.isArray(pages)) {
    return {
      valid: false,
      error: 'Format invalide: pages manquantes ou invalides',
    };
  }

  // Validation de la structure des pages
  for (const page of pages) {
    if (!page.text || typeof page.text !== 'string') {
      return {
        valid: false,
        error: 'Chaque page doit contenir un champ "text" valide',
      };
    }
    if (!page.page_number || typeof page.page_number !== 'number') {
      return {
        valid: false,
        error: 'Chaque page doit contenir un numéro de page valide',
      };
    }
  }

  return { valid: true };
}

/**
 * Crée ou vérifie l'existence d'une collection Qdrant
 *
 * @param {QdrantClient} qdrant - Client Qdrant
 * @param {string} collectionName - Nom de la collection
 * @param {string} hfKey - Clé API Hugging Face
 * @param {string} sampleText - Texte d'exemple pour déterminer la taille des embeddings
 * @returns {Promise<void>}
 */
async function ensureCollectionExists(qdrant, collectionName, hfKey, sampleText) {
  try {
    // Tentative de récupération de la collection existante
    await qdrant.getCollection(collectionName);
    console.log(`[API] ✅ Collection ${collectionName} existe déjà`);
  } catch {
    // Collection inexistante, création nécessaire
    console.log(`[API] 🔧 Création de la collection ${collectionName}`);

    // Génération d'un embedding de test pour déterminer la taille
    const hf = new InferenceClient(hfKey);
    const testEmbedding = await hf.featureExtraction({
      model: CHUNKING_CONFIG.EMBEDDING_MODEL,
      inputs: sampleText,
    });

    // Création de la collection avec la configuration appropriée
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: testEmbedding.length,
        distance: CHUNKING_CONFIG.VECTOR_DISTANCE,
      },
    });

    console.log(
      `[API] ✅ Collection ${collectionName} créée avec ${testEmbedding.length} dimensions`
    );
  }
}

/**
 * Traite une page et génère ses embeddings
 *
 * @param {Object} page - Page à traiter
 * @param {string} filename - Nom du fichier source
 * @param {string} filepath - Chemin du fichier
 * @param {number} year - Année du document
 * @param {InferenceClient} hf - Client Hugging Face
 * @param {QdrantClient} qdrant - Client Qdrant
 * @param {string} collectionName - Nom de la collection
 * @returns {Promise<number>} Nombre de chunks traités
 */
async function processPage(page, filename, filepath, year, hf, qdrant, collectionName) {
  // Découpage de la page en chunks
  const chunks = chunkText(page.text, CHUNKING_CONFIG.MAX_CHUNK_SIZE);
  const pageChunks = chunks.length;

  console.log(`[API] 📄 Traitement de la page ${page.page_number}: ${pageChunks} chunks`);

  // Traitement de chaque chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Génération de l'embedding
    const embedding = await hf.featureExtraction({
      model: CHUNKING_CONFIG.EMBEDDING_MODEL,
      inputs: chunk,
    });

    // Génération d'un ID unique pour le chunk
    const chunkId = crypto.randomUUID();

    // Préparation des métadonnées
    const payload = {
      text: chunk,
      filename: filename || 'unknown.txt',
      filepath: filepath || filename || 'unknown.txt',
      year: year || new Date().getFullYear(),
      page_number: page.page_number,
      chunk_index: i,
      total_chunks: pageChunks,
      timestamp: new Date().toISOString(),
      _timestamp: Date.now(),
    };

    // Stockage dans Qdrant
    await qdrant.upsert(collectionName, {
      points: [
        {
          id: chunkId,
          vector: embedding,
          payload: payload,
        },
      ],
    });

    console.log(
      `[API] ✅ Page ${page.page_number}, Chunk ${i + 1}/${pageChunks} stocké (ID: ${chunkId.substring(0, 8)}...)`
    );
  }

  return pageChunks;
}

// =============================================================================
// FONCTION PRINCIPALE - POST /api/QdrantUploader
// =============================================================================

/**
 * Gère l'upload et l'indexation de documents dans Qdrant
 *
 * Cette fonction implémente le pipeline complet d'indexation :
 * 1. Validation des données d'entrée
 * 2. Configuration des clients (Qdrant, Hugging Face)
 * 3. Vérification/création de la collection
 * 4. Traitement de chaque page (chunking + embeddings)
 * 5. Stockage avec métadonnées complètes
 *
 * @async
 * @param {Object} params - Paramètres de la requête Astro
 * @param {Request} params.request - Objet Request de la requête HTTP
 * @returns {Promise<Response>} Réponse JSON avec statistiques d'indexation
 *
 * @example
 * // Requête client
 * const response = await fetch('/api/QdrantUploader', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     filename: 'compte-rendu-2025.pdf',
 *     filepath: '/data/municipal/compte-rendu-2025.pdf',
 *     year: 2025,
 *     pages: [
 *       { page_number: 1, text: 'Contenu de la page 1...' },
 *       { page_number: 2, text: 'Contenu de la page 2...' }
 *     ]
 *   })
 * });
 *
 * // Réponse
 * {
 *   success: true,
 *   total_chunks: 15,
 *   pages_processed: 2
 * }
 */
export async function POST({ request }) {
  console.log("[API] 🚀 Début de l'upload vers Qdrant");

  try {
    // =====================================================================
    // ÉTAPE 1: VALIDATION ET EXTRACTION DES DONNÉES
    // =====================================================================

    console.log("[API] 📝 Validation des données d'entrée...");
    const { filename, filepath, year, pages } = await request.json();

    // Validation des données
    const validation = validateUploadData({ filename, filepath, year, pages });
    if (!validation.valid) {
      console.error('[API] ❌ Validation échouée:', validation.error);
      return new Response(JSON.stringify({ error: validation.error }), { status: 400 });
    }

    console.log(`[API] ✅ Validation réussie: ${pages.length} pages à traiter`);

    // =====================================================================
    // ÉTAPE 2: CONFIGURATION DES CLIENTS
    // =====================================================================

    console.log('[API] 🔧 Configuration des clients...');
    const hfKey = process.env.HUGGINGFACE_API_KEY;
    const qdrantUrl = process.env.QDRANT_URL;
    const qdrantCollection = process.env.QDRANT_COLLECTION_NAME || 'municipal_council_minutes';
    const qdrantApiKey = process.env.QDRANT_API_KEY;

    // Vérification des variables d'environnement
    if (!hfKey || !qdrantUrl) {
      throw new Error("Variables d'environnement manquantes: HUGGINGFACE_API_KEY ou QDRANT_URL");
    }

    // Initialisation des clients
    const qdrant = new QdrantClient({ url: qdrantUrl, apiKey: qdrantApiKey });
    const hf = new InferenceClient(hfKey);

    console.log('[API] ✅ Clients configurés');

    // =====================================================================
    // ÉTAPE 3: VÉRIFICATION/CRÉATION DE LA COLLECTION
    // =====================================================================

    console.log('[API] 🗄️ Vérification de la collection Qdrant...');
    await ensureCollectionExists(qdrant, qdrantCollection, hfKey, pages[0].text);

    // =====================================================================
    // ÉTAPE 4: TRAITEMENT DES PAGES
    // =====================================================================

    console.log('[API] 🔄 Début du traitement des pages...');
    let totalChunks = 0;

    // Traitement séquentiel de chaque page
    for (const page of pages) {
      const pageChunks = await processPage(
        page,
        filename,
        filepath,
        year,
        hf,
        qdrant,
        qdrantCollection
      );
      totalChunks += pageChunks;
    }

    // =====================================================================
    // ÉTAPE 5: PRÉPARATION DE LA RÉPONSE
    // =====================================================================

    const responseData = {
      success: true,
      total_chunks: totalChunks,
      pages_processed: pages.length,
      filename: filename,
      year: year || new Date().getFullYear(),
      average_chunks_per_page: Math.round((totalChunks / pages.length) * 100) / 100,
    };

    console.log(
      `[API] ✅ Upload terminé: ${totalChunks} chunks indexés pour ${pages.length} pages`
    );

    return new Response(JSON.stringify(responseData), { status: 200 });
  } catch (error) {
    // =====================================================================
    // GESTION D'ERREUR GLOBAL
    // =====================================================================

    console.error("[API] 💥 Exception lors de l'upload:", error);
    console.error('[API] 📍 Stack trace:', error.stack);

    return new Response(
      JSON.stringify({
        error: "Erreur lors de l'indexation du document",
        details: error.message,
      }),
      { status: 500 }
    );
  }
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
  return new Response(JSON.stringify({ error: 'Méthode GET non supportée. Utilisez POST.' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Gère les requêtes PUT (non supportées)
 *
 * @returns {Response} Réponse d'erreur 405
 */
export async function PUT() {
  return new Response(JSON.stringify({ error: 'Méthode PUT non supportée. Utilisez POST.' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Gère les requêtes DELETE (non supportées)
 *
 * @returns {Response} Réponse d'erreur 405
 */
export async function DELETE() {
  return new Response(JSON.stringify({ error: 'Méthode DELETE non supportée. Utilisez POST.' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
