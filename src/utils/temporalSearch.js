/**
 * Utilitaires pour la recherche hybride temporelle
 * Combine recherche vectorielle avec filtrage et pondération temporelle
 */

/**
 * Extrait l'année de la requête utilisateur
 * @param {string} query - La requête utilisateur
 * @returns {number|null} - L'année extraite ou null si non trouvée
 */
export function extractYearFromQuery(query) {
  // Patterns pour détecter les années
  const yearPatterns = [
    /(\d{4})/g, // Année à 4 chiffres
    /(?:en|de|du|pour l'|pour|année|exercice)\s+(\d{4})/gi, // "en 2025", "année 2024"
    /(?:l'|le|la)\s+(\d{4})/gi, // "l'2025", "le 2025"
  ];

  for (const pattern of yearPatterns) {
    const matches = query.match(pattern);
    if (matches) {
      // Extraire l'année du premier match
      const yearMatch = matches[0].match(/(\d{4})/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        // Validation : année entre 1900 et 2100
        if (year >= 1900 && year <= 2100) {
          return year;
        }
      }
    }
  }

  return null;
}

/**
 * Calcule un score de proximité temporelle
 * @param {number} queryYear - L'année de la requête
 * @param {number} documentYear - L'année du document
 * @returns {number} - Score entre 0 et 1 (1 = même année, 0 = très éloigné)
 */
export function calculateTemporalProximity(queryYear, documentYear) {
  const yearDiff = Math.abs(queryYear - documentYear);

  // Pondération exponentielle décroissante
  // Même année = 1.0, 1 an de différence = 0.8, 2 ans = 0.64, etc.
  return Math.pow(0.8, yearDiff);
}

/**
 * Applique un filtre temporel aux résultats de recherche
 * @param {Array} chunks - Les chunks de documents
 * @param {number} targetYear - L'année cible
 * @param {number} tolerance - Tolérance en années (défaut: 2)
 * @returns {Array} - Chunks filtrés
 */
export function filterByYear(chunks, targetYear, tolerance = 2) {
  return chunks.filter((chunk) => {
    if (!chunk.year) return true; // Garder si pas d'année

    const yearDiff = Math.abs(chunk.year - targetYear);
    return yearDiff <= tolerance;
  });
}

/**
 * Pondère les scores de similarité avec la proximité temporelle
 * @param {Array} chunks - Les chunks avec scores
 * @param {number} queryYear - L'année de la requête
 * @param {number} temporalWeight - Poids du facteur temporel (0-1, défaut: 0.3)
 * @returns {Array} - Chunks avec scores pondérés
 */
export function applyTemporalWeighting(chunks, queryYear, temporalWeight = 0.3) {
  return chunks.map((chunk) => {
    if (!chunk.year) {
      // Si pas d'année, garder le score original
      return { ...chunk, finalScore: chunk.score };
    }

    const temporalScore = calculateTemporalProximity(queryYear, chunk.year);

    // Score hybride : combinaison du score vectoriel et du score temporel
    const finalScore = (1 - temporalWeight) * chunk.score + temporalWeight * temporalScore;

    return {
      ...chunk,
      temporalScore,
      finalScore,
      originalScore: chunk.score,
    };
  });
}

/**
 * Effectue une recherche hybride avec filtrage et pondération temporelle
 * @param {Array} chunks - Résultats de la recherche vectorielle
 * @param {string} query - Requête utilisateur
 * @param {Object} options - Options de configuration
 * @returns {Object} - Résultats avec métadonnées de recherche
 */
export function performHybridSearch(chunks, query, options = {}) {
  const {
    temporalWeight = 0.3,
    yearTolerance = 2,
    enableFiltering = true,
    enableWeighting = true,
  } = options;

  // Extraction de l'année de la requête
  const queryYear = extractYearFromQuery(query);

  let processedChunks = [...chunks];
  let searchMetadata = {
    queryYear,
    temporalFilterApplied: false,
    temporalWeightingApplied: false,
    originalCount: chunks.length,
    filteredCount: chunks.length,
  };

  // 1. Filtrage temporel si une année est détectée
  if (queryYear && enableFiltering) {
    processedChunks = filterByYear(processedChunks, queryYear, yearTolerance);
    searchMetadata.temporalFilterApplied = true;
    searchMetadata.filteredCount = processedChunks.length;
  }

  // 2. Pondération temporelle si une année est détectée
  if (queryYear && enableWeighting) {
    processedChunks = applyTemporalWeighting(processedChunks, queryYear, temporalWeight);
    searchMetadata.temporalWeightingApplied = true;
  }

  // 3. Tri par score final (vectoriel ou hybride)
  const sortKey = queryYear && enableWeighting ? 'finalScore' : 'score';
  processedChunks.sort((a, b) => b[sortKey] - a[sortKey]);

  return {
    chunks: processedChunks,
    metadata: searchMetadata,
  };
}

/**
 * Log les métadonnées de recherche pour le debugging
 * @param {Object} metadata - Métadonnées de recherche
 * @param {string} query - Requête utilisateur
 */
export function logSearchMetadata(metadata, query) {
  console.log('[Temporal Search] Métadonnées de recherche:');
  console.log('- Requête:', query);
  console.log('- Année détectée:', metadata.queryYear);
  console.log('- Filtrage temporel appliqué:', metadata.temporalFilterApplied);
  console.log('- Pondération temporelle appliquée:', metadata.temporalWeightingApplied);
  console.log('- Chunks originaux:', metadata.originalCount);
  console.log('- Chunks après filtrage:', metadata.filteredCount);
}
