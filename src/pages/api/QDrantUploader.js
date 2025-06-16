export const prerender = false;

import { QdrantClient } from '@qdrant/js-client-rest';
import { HfInference } from '@huggingface/inference';
import { config } from 'dotenv';
import crypto from 'crypto';

config();

// Découpe un texte en chunks de ~1000 caractères sans couper les mots
function chunkText(text, maxLen = 1000) {
  const chunks = [];
  let current = '';
  for (const paragraph of text.split(/\n+/)) {
    if ((current + paragraph).length > maxLen) {
      if (current) chunks.push(current);
      current = paragraph;
    } else {
      current += (current ? '\n' : '') + paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function POST({ request }) {
  try {
    const { text, filename } = await request.json();
    if (!text) {
      console.error('[API] Texte manquant dans la requête');
      return new Response(JSON.stringify({ error: 'Texte manquant' }), { status: 400 });
    }

    const hfKey = process.env.HUGGINGFACE_API_KEY;
    const qdrantUrl = process.env.QDRANT_URL;
    const qdrantCollection = process.env.QDRANT_COLLECTION_NAME || 'municipal_council_minutes';
    const qdrantApiKey = process.env.QDRANT_API_KEY;

    // Découper le texte en chunks
    const chunks = chunkText(text, 1000);
    const totalChunks = chunks.length;

    // Qdrant client avec clé API
    const qdrant = new QdrantClient({ url: qdrantUrl, apiKey: qdrantApiKey });

    // Vérifier si la collection existe, sinon la créer
    try {
      await qdrant.getCollection(qdrantCollection);
      console.log(`[API] Collection ${qdrantCollection} exists`);
    } catch {
      console.log(`[API] Creating collection ${qdrantCollection}`);
      // On suppose que tous les chunks ont la même taille d'embedding
      // On génère un embedding sur le premier chunk pour la taille
      const hf = new HfInference(hfKey);
      const testEmbedding = await hf.featureExtraction({
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputs: chunks[0],
      });
      await qdrant.createCollection(qdrantCollection, {
        vectors: {
          size: testEmbedding.length,
          distance: 'Cosine',
        },
      });
    }

    // Pour chaque chunk, générer l'embedding et stocker dans Qdrant
    const hf = new HfInference(hfKey);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await hf.featureExtraction({
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputs: chunk,
      });
      const chunkId = crypto.randomUUID();
      await qdrant.upsert(qdrantCollection, {
        points: [
          {
            id: chunkId,
            vector: embedding,
            payload: {
              text: chunk,
              filename: filename || 'unknown.txt',
              chunk_index: i,
              total_chunks: totalChunks,
              timestamp: new Date().toISOString(),
              _timestamp: Date.now(),
            },
          },
        ],
      });
      console.log(`[API] Chunk ${i + 1}/${totalChunks} stocké dans Qdrant`);
    }

    return new Response(JSON.stringify({ success: true, chunks: totalChunks }), { status: 200 });
  } catch (e) {
    console.error('[API] Exception:', e);
    return new Response(JSON.stringify({ error: e.message || 'Erreur serveur' }), { status: 500 });
  }
}
