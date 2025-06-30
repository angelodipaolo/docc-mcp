import { pipeline, env } from '@xenova/transformers';
import fs from 'fs/promises';
import path from 'path';

// Allow remote models for initial download, then cache locally
env.allowRemoteModels = true;
env.allowLocalModels = true;

export interface EmbeddingRecord {
  id: string;
  embedding: number[];
  content: string;
  metadata: {
    archive: string;
    symbolId?: string;
    title: string;
    kind: string; // symbol, article, tutorial
    url: string;
    tokens: number;
  };
}

export interface SemanticSearchResult {
  content: string;
  title: string;
  url: string;
  score: number;
  archive: string;
  kind: string;
}

export interface ContentChunk {
  content: string;
  metadata: {
    archive: string;
    symbolId?: string;
    title: string;
    kind: string;
    url: string;
  };
}

export class SemanticSearchEngine {
  private embedder: any = null;
  private embeddings: EmbeddingRecord[] = [];
  private indexPath: string;

  constructor(indexPath: string = '.semantic-index') {
    this.indexPath = indexPath;
  }

  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    console.log('🤖 Loading sentence transformer model...');
    
    try {
      // Use a lightweight sentence transformer model optimized for semantic search
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('✅ Sentence transformer model loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load embedding model:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for a piece of text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedding model not initialized. Call initialize() first.');
    }

    try {
      const output = await this.embedder(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Chunk text content into smaller pieces
   */
  chunkText(text: string, maxTokens: number = 500, overlap: number = 50): string[] {
    // Simple word-based chunking (approximate tokenization)
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    
    // Rough estimate: 1 token ≈ 0.75 words
    const wordsPerChunk = Math.floor(maxTokens * 0.75);
    const overlapWords = Math.floor(overlap * 0.75);
    
    for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
      const chunk = words.slice(i, i + wordsPerChunk).join(' ');
      if (chunk.trim().length > 0) {
        chunks.push(chunk.trim());
      }
      
      // Avoid infinite loop if chunk is too small
      if (i + wordsPerChunk >= words.length) break;
    }
    
    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * Process and chunk DocC content
   */
  processDocCContent(symbol: any, archiveName: string): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    const baseMetadata = {
      archive: archiveName,
      symbolId: symbol.identifier?.url,
      title: symbol.metadata?.title || 'Unknown',
      kind: symbol.metadata?.symbolKind || symbol.kind || 'unknown',
      url: symbol.identifier?.url || ''
    };

    // Extract main abstract
    if (symbol.abstract && Array.isArray(symbol.abstract)) {
      const abstractText = this.extractTextFromContent(symbol.abstract);
      if (abstractText.length > 50) {
        chunks.push({
          content: `${baseMetadata.title}: ${abstractText}`,
          metadata: { ...baseMetadata, kind: `${baseMetadata.kind}-abstract` }
        });
      }
    }

    // Extract discussion content
    if (symbol.primaryContentSections) {
      for (const section of symbol.primaryContentSections) {
        if (section.kind === 'content' && section.content) {
          const discussionText = this.extractTextFromContent(section.content);
          if (discussionText.length > 50) {
            const textChunks = this.chunkText(discussionText);
            textChunks.forEach((chunk, index) => {
              chunks.push({
                content: `${baseMetadata.title} - Discussion${textChunks.length > 1 ? ` (${index + 1})` : ''}: ${chunk}`,
                metadata: { ...baseMetadata, kind: `${baseMetadata.kind}-discussion` }
              });
            });
          }
        }

        // Extract parameter documentation
        if (section.kind === 'parameters' && section.parameters) {
          for (const param of section.parameters) {
            if (param.content) {
              const paramText = this.extractTextFromContent(param.content);
              if (paramText.length > 20) {
                chunks.push({
                  content: `${baseMetadata.title} - Parameter ${param.name}: ${paramText}`,
                  metadata: { ...baseMetadata, kind: `${baseMetadata.kind}-parameter` }
                });
              }
            }
          }
        }
      }
    }

    return chunks;
  }

  /**
   * Extract plain text from DocC content structure
   */
  private extractTextFromContent(content: any[]): string {
    if (!Array.isArray(content)) return '';
    
    let text = '';
    for (const item of content) {
      if (item.type === 'text' && item.text) {
        text += item.text + ' ';
      } else if (item.type === 'codeVoice' && item.code) {
        text += item.code + ' ';
      } else if (item.type === 'paragraph' && item.inlineContent) {
        text += this.extractTextFromContent(item.inlineContent) + ' ';
      } else if (item.inlineContent) {
        text += this.extractTextFromContent(item.inlineContent) + ' ';
      } else if (item.content) {
        text += this.extractTextFromContent(item.content) + ' ';
      }
    }
    return text.trim();
  }

  /**
   * Add content chunks to the index
   */
  async addToIndex(chunks: ContentChunk[]): Promise<void> {
    console.log(`📚 Processing ${chunks.length} content chunks...`);
    
    for (const chunk of chunks) {
      try {
        const embedding = await this.generateEmbedding(chunk.content);
        const record: EmbeddingRecord = {
          id: `${chunk.metadata.archive}-${chunk.metadata.symbolId || 'unknown'}-${Date.now()}`,
          embedding,
          content: chunk.content,
          metadata: {
            ...chunk.metadata,
            tokens: Math.ceil(chunk.content.split(/\s+/).length * 1.33) // Rough token estimate
          }
        };
        
        this.embeddings.push(record);
      } catch (error) {
        console.error(`Failed to process chunk for ${chunk.metadata.title}:`, error);
      }
    }
    
    console.log(`✅ Added ${chunks.length} chunks to search index`);
  }

  /**
   * Perform semantic search
   */
  async search(query: string, limit: number = 10, archiveFilter?: string): Promise<SemanticSearchResult[]> {
    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    if (this.embeddings.length === 0) {
      return [];
    }

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Calculate similarities
    const results = this.embeddings
      .filter(record => !archiveFilter || record.metadata.archive === archiveFilter)
      .map(record => ({
        ...record,
        score: this.cosineSimilarity(queryEmbedding, record.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results.map(result => ({
      content: result.content,
      title: result.metadata.title,
      url: result.metadata.url,
      score: result.score,
      archive: result.metadata.archive,
      kind: result.metadata.kind
    }));
  }

  /**
   * Save index to disk
   */
  async saveIndex(): Promise<void> {
    try {
      await fs.mkdir(this.indexPath, { recursive: true });
      const indexFile = path.join(this.indexPath, 'embeddings.json');
      await fs.writeFile(indexFile, JSON.stringify(this.embeddings, null, 2));
      console.log(`💾 Saved ${this.embeddings.length} embeddings to ${indexFile}`);
    } catch (error) {
      console.error('Failed to save index:', error);
    }
  }

  /**
   * Load index from disk
   */
  async loadIndex(): Promise<void> {
    try {
      const indexFile = path.join(this.indexPath, 'embeddings.json');
      const data = await fs.readFile(indexFile, 'utf-8');
      this.embeddings = JSON.parse(data);
      console.log(`📖 Loaded ${this.embeddings.length} embeddings from ${indexFile}`);
    } catch (error) {
      console.log('No existing index found, starting fresh');
      this.embeddings = [];
    }
  }

  /**
   * Get index statistics
   */
  getStats(): { totalEmbeddings: number; archives: string[]; kinds: string[] } {
    const archives = [...new Set(this.embeddings.map(e => e.metadata.archive))];
    const kinds = [...new Set(this.embeddings.map(e => e.metadata.kind))];
    
    return {
      totalEmbeddings: this.embeddings.length,
      archives,
      kinds
    };
  }

  /**
   * Clear the index
   */
  clearIndex(): void {
    this.embeddings = [];
  }
}