import { ITool, FunctionDeclarationSchema } from '../types.js';
import { DatabaseService } from '../../db/DatabaseService.js';

export class DatabaseFilesTool implements ITool {
  private dbService: DatabaseService;

  constructor(dbService?: DatabaseService) {
    this.dbService = dbService || new DatabaseService();
  }

  declaration: FunctionDeclarationSchema = {
    name: 'count_database_files',
    description:
      'Checks the database to inspect and count how many different document files are currently indexed and stored in the vector database. Returns total distinct files, total chunks, and the detailed breakdown per file.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: [],
    },
  };

  async execute(_args: any): Promise<any> {
    try {
      const summary = await this.dbService.getStoredFilesSummary();
      return {
        success: true,
        totalDistinctFiles: summary.totalDistinctFiles,
        totalChunks: summary.totalChunks,
        files: summary.files,
        message:
          summary.totalDistinctFiles === 0
            ? 'The database currently contains no indexed document files.'
            : `Found ${summary.totalDistinctFiles} distinct file(s) with a total of ${summary.totalChunks} chunk(s) stored in the database.`,
      };
    } catch (error: any) {
      console.error('Error executing count_database_files tool:', error);
      return {
        success: false,
        error: error.message || 'Failed to retrieve database file summary.',
      };
    }
  }
}
