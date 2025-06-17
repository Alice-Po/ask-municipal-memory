export const prerender = false;
import { config } from 'dotenv';
import { InferenceClient } from '@huggingface/inference';
import { systemPrompt } from '../../prompts/systemPrompt.js';

config();

/**
 * API Route pour le chatbot RAG
 * Gère les interactions utilisateur avec la base de connaissances municipale
 */
export async function POST({ request }) {
  console.log('[API] Début de la requête POST /api/chat');

  try {
    // Récupération du message utilisateur
    console.log('[API] Parsing du body de la requête...');
    const { message } = await request.json();
    console.log('[API] Message extrait:', message);

    if (!message) {
      console.log('[API] Message manquant');
      return new Response(JSON.stringify({ error: 'Message manquant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Configuration des variables d'environnement
    console.log("[API] Vérification des variables d'environnement...");
    const hfKey = process.env.HUGGINGFACE_API_KEY;
    const qdrantUrl = process.env.QDRANT_URL;
    const qdrantCollection = process.env.QDRANT_COLLECTION_NAME || 'municipal_council_minutes';
    const qdrantApiKey = process.env.QDRANT_API_KEY;

    console.log("[API] Variables d'environnement:");
    console.log('- HUGGINGFACE_API_KEY:', hfKey ? 'PRÉSENTE' : 'MANQUANTE');
    console.log('- QDRANT_URL:', qdrantUrl || 'MANQUANTE');
    console.log('- QDRANT_COLLECTION_NAME:', qdrantCollection);
    console.log('- QDRANT_API_KEY:', qdrantApiKey ? 'PRÉSENTE' : 'MANQUANTE');

    // Vérification des clés API
    if (!hfKey) {
      throw new Error('Clé API Hugging Face manquante');
    }
    if (!qdrantUrl) {
      throw new Error('URL Qdrant manquante');
    }

    // Configuration des modèles
    const mistralModel = 'mistralai/Mistral-7B-Instruct-v0.2';
    const embeddingModel = 'sentence-transformers/all-MiniLM-L6-v2';

    // Initialisation du client Hugging Face (nouvelle API)
    console.log('[API] Initialisation du client Hugging Face...');
    const hf = new InferenceClient(hfKey);

    // 1. Génération de l'embedding de la question utilisateur
    console.log("[API] Génération de l'embedding pour:", message);
    const embeddingRes = await hf.featureExtraction({
      model: embeddingModel,
      inputs: message,
    });

    // Normalisation de la réponse d'embedding
    const embedding = Array.isArray(embeddingRes) ? embeddingRes : embeddingRes[0];
    console.log('[API] Embedding généré, taille:', embedding.length);

    // 2. Recherche vectorielle dans Qdrant
    console.log('[API] Recherche dans Qdrant...');
    const qdrantRes = await fetch(`${qdrantUrl}/collections/${qdrantCollection}/points/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(qdrantApiKey ? { 'api-key': qdrantApiKey } : {}),
      },
      body: JSON.stringify({
        vector: embedding,
        limit: 10, // Récupère les 5 chunks les plus pertinents
        with_payload: true,
        with_score: true, // Inclut les scores de similarité
      }),
    });

    const qdrantData = await qdrantRes.json();

    if (!qdrantRes.ok) {
      throw new Error(qdrantData.status?.error || 'Erreur lors de la recherche Qdrant');
    }

    // Extraction des chunks les plus pertinents
    const topChunks =
      qdrantData.result
        ?.map((pt) => ({
          text: pt.payload?.text,
          score: pt.score,
          filename: pt.payload?.filename,
          page: pt.payload?.page_number,
          year: pt.payload?.year,
        }))
        .filter((chunk) => chunk.text) || [];

    console.log(`[API] Trouvé ${topChunks.length} chunks pertinents`);

    // 3. Construction du contexte pour le LLM
    const contextText = topChunks
      .map(
        (chunk) =>
          `[Source: ${chunk.filename || 'Document'}${chunk.page ? `, page ${chunk.page}` : ''}${chunk.year ? `, année ${chunk.year}` : ''}]\n${chunk.text}`
      )
      .join('\n---\n');

    // 4. Construction du prompt pour Mistral
    const userPrompt = `Contexte des documents municipaux :
${contextText}

Question de l'utilisateur : ${message}`;

    // 5. Génération de la réponse avec Mistral (tâche chatCompletion)
    console.log('[API] Génération de la réponse avec Mistral...');
    const llmRes = await hf.chatCompletion({
      model: mistralModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      parameters: {
        max_tokens: 512, // Réponse plus longue pour plus de contexte
        temperature: 0.7, // Un peu de créativité
      },
    });

    const answer =
      llmRes.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";
    console.log('[API] Réponse générée:', answer.substring(0, 100) + '...');

    // 6. Construction des sources avec URLs
    const sourcesWithUrls = topChunks.map((chunk) => {
      // Construction de l'URL du PDF basée sur le filename et l'année
      let pdfUrl = null;
      if (chunk.filename && chunk.year) {
        pdfUrl = `/datas/${chunk.year}/${chunk.filename}`;
      } else if (chunk.filename) {
        // Fallback : extraction de l'année du filename (ex: "compte-rendu-seance-du-3-fevrier-2025.pdf" -> "2025")
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
        score: chunk.score,
        url: pdfUrl,
        // URL avec ancre pour aller directement à la page (si supporté par le navigateur)
        urlWithPage: chunk.page && pdfUrl ? `${pdfUrl}#page=${chunk.page}` : pdfUrl,
      };
    });

    // 7. Retour de la réponse avec métadonnées
    const responseData = {
      answer,
      sources: sourcesWithUrls,
      chunksFound: topChunks.length,
      systemPrompt,
      contextText,
      userPrompt,
    };

    console.log('[API] Envoi de la réponse finale');
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[API] Exception:', error);
    console.error('[API] Stack trace:', error.stack);

    return new Response(
      JSON.stringify({
        error: 'Erreur lors du traitement de votre demande',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Gestion des méthodes HTTP non supportées
export async function GET() {
  return new Response(JSON.stringify({ error: 'Méthode GET non supportée. Utilisez POST.' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
