import { Resource, ResourceInteraction, UserPreferences, RecommendationResult, ResourceType } from '../types';

/**
 * Smart Resource Recommendation Service
 * Implements collaborative filtering, content-based filtering, and time-based recommendations
 */

// Configuration constants
const EXAM_SEASON_MONTHS = [11, 0, 4, 5]; // November-December (11, 0) and April-May (4, 5)
const DEFAULT_TRENDING_WINDOW_HOURS = 168; // One week
const RECOMMENDATION_WEIGHTS = {
  collaborative: 0.35,
  'content-based': 0.35,
  'time-based': 0.20,
  popular: 0.10
};

// Calculate cosine similarity between two vectors
const cosineSimilarity = (vec1: number[], vec2: number[]): number => {
  if (vec1.length !== vec2.length || vec1.length === 0) return 0;
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }
  
  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
};

// Build user preference vector from interactions
export const buildUserVector = (
  interactions: ResourceInteraction[],
  allSubjects: string[]
): number[] => {
  const subjectCounts: { [key: string]: number } = {};
  
  interactions.forEach(interaction => {
    if (interaction.subject) {
      subjectCounts[interaction.subject] = (subjectCounts[interaction.subject] || 0) + 1;
    }
  });
  
  return allSubjects.map(subject => subjectCounts[subject] || 0);
};

/**
 * Collaborative Filtering: "Users who viewed X also viewed Y"
 * Finds similar users based on interaction patterns and recommends what they viewed
 */
export const getCollaborativeRecommendations = (
  userId: string,
  userInteractions: ResourceInteraction[],
  allInteractions: ResourceInteraction[],
  allResources: Resource[],
  limit: number = 5
): RecommendationResult[] => {
  // Get unique subjects from all interactions
  const allSubjects = Array.from(new Set(allInteractions.map(i => i.subject).filter(Boolean) as string[]));
  
  // If there are no subjects, we cannot build meaningful vectors; return empty recommendations
  if (allSubjects.length === 0) {
    return [];
  }
  
  // Build current user's preference vector
  const userVector = buildUserVector(userInteractions, allSubjects);
  
  // Group interactions by user
  const userInteractionMap: { [userId: string]: ResourceInteraction[] } = {};
  allInteractions.forEach(interaction => {
    if (interaction.userId !== userId) {
      if (!userInteractionMap[interaction.userId]) {
        userInteractionMap[interaction.userId] = [];
      }
      userInteractionMap[interaction.userId].push(interaction);
    }
  });
  
  // Calculate similarity with other users
  const userSimilarities: { userId: string; similarity: number }[] = [];
  Object.entries(userInteractionMap).forEach(([otherUserId, interactions]) => {
    const otherVector = buildUserVector(interactions, allSubjects);
    const similarity = cosineSimilarity(userVector, otherVector);
    if (similarity > 0.1) {
      userSimilarities.push({ userId: otherUserId, similarity });
    }
  });
  
  // Sort by similarity
  userSimilarities.sort((a, b) => b.similarity - a.similarity);
  
  // Get resources viewed by similar users but not by current user
  const viewedResourceIds = new Set(userInteractions.map(i => i.resourceId));
  const recommendedResourceScores: { [resourceId: string]: { score: number; users: number } } = {};
  
  userSimilarities.slice(0, 10).forEach(({ userId: similarUserId, similarity }) => {
    userInteractionMap[similarUserId].forEach(interaction => {
      if (!viewedResourceIds.has(interaction.resourceId)) {
        if (!recommendedResourceScores[interaction.resourceId]) {
          recommendedResourceScores[interaction.resourceId] = { score: 0, users: 0 };
        }
        recommendedResourceScores[interaction.resourceId].score += similarity;
        recommendedResourceScores[interaction.resourceId].users += 1;
      }
    });
  });
  
  // Convert to recommendations
  const recommendations: RecommendationResult[] = [];
  Object.entries(recommendedResourceScores).forEach(([resourceId, { score, users }]) => {
    const resource = allResources.find(r => r.id === resourceId);
    if (resource) {
      recommendations.push({
        resource,
        score,
        reason: 'collaborative',
        metadata: { similarUsers: users }
      });
    }
  });
  
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

/**
 * Content-Based Filtering: Match user preferences to resource content
 * Recommends resources similar to what the user has interacted with
 */
export const getContentBasedRecommendations = (
  userPreferences: UserPreferences,
  allResources: Resource[],
  viewedResourceIds: Set<string>,
  limit: number = 5
): RecommendationResult[] => {
  const recommendations: RecommendationResult[] = [];
  
  allResources.forEach(resource => {
    if (viewedResourceIds.has(resource.id)) return;
    
    let score = 0;
    
    // Match subject preferences (high weight)
    if (userPreferences.subjectsViewed.includes(resource.subject)) {
      score += 3;
    }
    
    // Match resource type preferences (medium weight)
    if (userPreferences.preferredResourceTypes.includes(resource.type)) {
      score += 2;
    }
    
    // Match study pattern
    if (userPreferences.studyPattern === 'visual' && resource.type === 'PPT') {
      score += 1.5;
    } else if (userPreferences.studyPattern === 'text' && (resource.type === 'ImpQ' || resource.type === 'PYQ')) {
      score += 1.5;
    } else if (userPreferences.studyPattern === 'mixed') {
      score += 0.5;
    }
    
    // Match active semesters
    if (userPreferences.activeSemesters.includes(resource.semester)) {
      score += 2;
    }
    
    // Search query relevance
    userPreferences.searchQueries.forEach(query => {
      const queryLower = query.toLowerCase();
      if (resource.title.toLowerCase().includes(queryLower) || 
          resource.subject.toLowerCase().includes(queryLower)) {
        score += 1;
      }
    });
    
    if (score > 0) {
      recommendations.push({
        resource,
        score,
        reason: 'content-based',
        metadata: { matchScore: score }
      });
    }
  });
  
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

/**
 * Time-Based Recommendations: Suggest exam-related content based on current time
 * Prioritizes PYQs and MidPapers during exam seasons
 */
export const getTimeBasedRecommendations = (
  userPreferences: UserPreferences,
  allResources: Resource[],
  viewedResourceIds: Set<string>,
  currentMonth: number, // 0-11
  limit: number = 5
): RecommendationResult[] => {
  const isExamSeason = EXAM_SEASON_MONTHS.includes(currentMonth);
  
  const recommendations: RecommendationResult[] = [];
  
  allResources.forEach(resource => {
    if (viewedResourceIds.has(resource.id)) return;
    
    let score = 0;
    
    // During exam season, prioritize exam resources
    if (isExamSeason) {
      if (resource.type === 'PYQ' || resource.type === 'MidPaper') {
        score += 5;
      } else if (resource.type === 'ImpQ') {
        score += 3;
      }
    } else {
      // During regular time, prioritize learning resources
      if (resource.type === 'ImpQ' || resource.type === 'PPT') {
        score += 3;
      }
    }
    
    // Boost for user's active semesters
    if (userPreferences.activeSemesters.includes(resource.semester)) {
      score += 2;
    }
    
    // Boost for user's subjects
    if (userPreferences.subjectsViewed.includes(resource.subject)) {
      score += 1;
    }
    
    if (score > 0) {
      recommendations.push({
        resource,
        score,
        reason: 'time-based',
        metadata: { trendingScore: score }
      });
    }
  });
  
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

/**
 * Get popular/trending resources based on recent interactions
 */
export const getPopularRecommendations = (
  allInteractions: ResourceInteraction[],
  allResources: Resource[],
  viewedResourceIds: Set<string>,
  limit: number = 5,
  timeWindowHours: number = DEFAULT_TRENDING_WINDOW_HOURS
): RecommendationResult[] => {
  const now = Date.now();
  const timeWindow = timeWindowHours * 60 * 60 * 1000;
  
  // Count recent interactions per resource
  const resourcePopularity: { [resourceId: string]: number } = {};
  
  allInteractions.forEach(interaction => {
    if (now - interaction.timestamp <= timeWindow) {
      resourcePopularity[interaction.resourceId] = (resourcePopularity[interaction.resourceId] || 0) + 1;
    }
  });
  
  // Convert to recommendations
  const recommendations: RecommendationResult[] = [];
  Object.entries(resourcePopularity).forEach(([resourceId, count]) => {
    if (!viewedResourceIds.has(resourceId)) {
      const resource = allResources.find(r => r.id === resourceId);
      if (resource) {
        recommendations.push({
          resource,
          score: count,
          reason: 'popular',
          metadata: { trendingScore: count }
        });
      }
    }
  });
  
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

/**
 * Hybrid Recommendation Engine
 * Combines all recommendation strategies with weights for best results
 */
export const getHybridRecommendations = (
  userId: string,
  userPreferences: UserPreferences,
  userInteractions: ResourceInteraction[],
  allInteractions: ResourceInteraction[],
  allResources: Resource[],
  limit: number = 10
): RecommendationResult[] => {
  const viewedResourceIds = new Set(userInteractions.map(i => i.resourceId));
  const currentMonth = new Date().getMonth();
  
  // Get recommendations from each strategy
  const collaborative = getCollaborativeRecommendations(
    userId,
    userInteractions,
    allInteractions,
    allResources,
    limit
  );
  
  const contentBased = getContentBasedRecommendations(
    userPreferences,
    allResources,
    viewedResourceIds,
    limit
  );
  
  const timeBased = getTimeBasedRecommendations(
    userPreferences,
    allResources,
    viewedResourceIds,
    currentMonth,
    limit
  );
  
  const popular = getPopularRecommendations(
    allInteractions,
    allResources,
    viewedResourceIds,
    limit
  );
  
  // Combine with weights
  const combinedScores: { [resourceId: string]: RecommendationResult } = {};
  
  [collaborative, contentBased, timeBased, popular].forEach(recommendations => {
    recommendations.forEach(rec => {
      const weight = RECOMMENDATION_WEIGHTS[rec.reason];
      const weightedScore = rec.score * weight;
      
      if (!combinedScores[rec.resource.id]) {
        combinedScores[rec.resource.id] = {
          ...rec,
          score: weightedScore
        };
      } else {
        combinedScores[rec.resource.id].score += weightedScore;
      }
    });
  });
  
  return Object.values(combinedScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

/**
 * Build user preferences from interactions
 */
export const buildUserPreferences = (
  interactions: ResourceInteraction[],
  studyPattern: 'visual' | 'text' | 'mixed' = 'mixed',
  userId?: string
): UserPreferences => {
  const subjectsViewed = new Set<string>();
  const downloadHistory = new Set<string>();
  const searchQueries: string[] = [];
  const preferredResourceTypes: { [type: string]: number } = {};
  const activeSemesters = new Set<string>();
  
  // Extract userId from first interaction or use provided one
  const extractedUserId = interactions.length > 0 ? interactions[0].userId : (userId || '');
  
  interactions.forEach(interaction => {
    if (interaction.subject) {
      subjectsViewed.add(interaction.subject);
    }
    
    if (interaction.interactionType === 'download') {
      downloadHistory.add(interaction.resourceId);
    }
    
    if (interaction.interactionType === 'search' && interaction.searchQuery) {
      searchQueries.push(interaction.searchQuery);
    }
    
    if (interaction.resourceType) {
      preferredResourceTypes[interaction.resourceType] = 
        (preferredResourceTypes[interaction.resourceType] || 0) + 1;
    }
    
    if (interaction.semester) {
      activeSemesters.add(interaction.semester);
    }
  });
  
  // Get top resource types
  const sortedTypes = Object.entries(preferredResourceTypes)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type as ResourceType);
  
  return {
    userId: extractedUserId,
    subjectsViewed: Array.from(subjectsViewed),
    downloadHistory: Array.from(downloadHistory),
    searchQueries: searchQueries.slice(-10), // Keep last 10 searches
    studyPattern,
    preferredResourceTypes: sortedTypes.slice(0, 3),
    activeSemesters: Array.from(activeSemesters)
  };
};
