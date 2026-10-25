import { ITool, FunctionDeclarationSchema } from '../types.js';
import { RagService } from '../../embedding/RagService.js';

export class RagSearchTool implements ITool {
  private ragService: RagService;

  constructor(ragService?: RagService) {
    this.ragService = ragService || new RagService();
  }

  declaration: FunctionDeclarationSchema = {
    name: 'query_rag_knowledge_base',
    description:
      'Searches the enterprise vector database for company policies, credit concession guidelines, collections recovery rules, and stored documents using semantic vector similarity and cross-encoder reranking. Use this tool to retrieve accurate facts and excerpts before answering questions about corporate policies.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'The search query or factual question to look up in the documents.',
        },
        limit: {
          type: 'INTEGER',
          description: 'Number of relevant excerpts to retrieve (default: 3).',
        },
        category: {
          type: 'STRING',
          description: 'Optional metadata category filter (e.g., "policy").',
        },
        year: {
          type: 'INTEGER',
          description: 'Optional year filter (e.g., 2026 or 2025).',
        },
      },
      required: ['query'],
    },
  };

  async execute(args: any): Promise<any> {
    try {
      const query = args?.query;
      if (!query || typeof query !== 'string' || !query.trim()) {
        return {
          success: false,
          error: 'Parameter "query" is required and must be a non-empty string.',
        };
      }

      const limit = Number(args.limit) || 3;
      const metadataFilter: Record<string, any> = {};

      if (args.category) {
        metadataFilter.category = args.category;
      }
      if (args.year !== undefined && args.year !== null) {
        metadataFilter.year = Number(args.year);
      }

      const result = await this.ragService.retrieveChunks({
        query,
        limit,
        metadataFilter: Object.keys(metadataFilter).length > 0 ? metadataFilter : null,
        useReranker: true,
      });

      if (result.chunks.length === 0) {
        return {
          success: true,
          chunksFound: 0,
          results: [],
          message: 'No relevant excerpts found in the database for the given query and filters.',
        };
      }

      return {
        success: true,
        chunksFound: result.chunks.length,
        results: result.chunks.map((c) => ({
          filename: c.filename,
          chunkIndex: c.chunk_index,
          similarity: c.similarity,
          rerankScore: c.rerank_score,
          excerpt: c.text.trim(),
        })),
      };
    } catch (error: any) {
      console.error('Error executing query_rag_knowledge_base tool:', error);
      return {
        success: false,
        error: error.message || 'Failed to retrieve chunks from RAG knowledge base.',
      };
    }
  }
}
