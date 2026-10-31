import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RagSearchTool } from '../../tools/definitions/RagSearchTool.js';
import { DatabaseFilesTool } from '../../tools/definitions/DatabaseFilesTool.js';

const ragSearchInstance = new RagSearchTool();
const dbFilesInstance = new DatabaseFilesTool();

/**
 * LangChain wrapper around the existing RagSearchTool (pgvector + cross-encoder reranker).
 */
export const ragKnowledgeLangChainTool = tool(
  async (input) => {
    const result = await ragSearchInstance.execute({
      query: input.query,
      limit: input.limit ?? 4,
      category: input.category,
      year: input.year,
    });
    return JSON.stringify(result);
  },
  {
    name: 'query_rag_knowledge_base',
    description:
      'Searches the enterprise pgvector knowledge base for company policies, 2025/2026 credit concession guidelines, underwriting thresholds, ESG exclusions, approval workflows, and 2026 collections recovery rules using semantic similarity and cross-encoder reranking.',
    schema: z.object({
      query: z
        .string()
        .describe('The search query or specific policy topic to retrieve from the knowledge base.'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .default(4)
        .describe('Number of relevant document chunks to retrieve (default: 4).'),
      category: z
        .string()
        .optional()
        .describe('Optional metadata category filter (e.g., "policy").'),
      year: z
        .number()
        .int()
        .optional()
        .describe('Optional policy year filter (e.g., 2026 or 2025).'),
    }),
  }
);

/**
 * LangChain wrapper around the existing DatabaseFilesTool.
 */
export const databaseFilesLangChainTool = tool(
  async () => {
    const result = await dbFilesInstance.execute({});
    return JSON.stringify(result);
  },
  {
    name: 'count_database_files',
    description:
      'Checks the PostgreSQL vector database to list all indexed policy files and their chunk counts.',
    schema: z.object({}),
  }
);
