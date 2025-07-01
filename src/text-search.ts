import pkg from 'natural';
const { TfIdf } = pkg;
import fs from 'fs/promises';
import path from 'path';

export interface TextSearchRecord {
  id: string;
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

export interface TextSearchResult {
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

export class TextSearchEngine {
  private tfidf: any;
  private documents: TextSearchRecord[] = [];
  private indexPath: string;

  constructor(indexPath: string = '.text-index') {
    // Resolve to absolute path to avoid issues with working directory
    this.indexPath = path.resolve(process.cwd(), indexPath);
    this.tfidf = new TfIdf();
  }

  /**
   * Initialize the text search engine
   */
  async initialize(): Promise<void> {
    console.log(`📝 Initializing text search engine...`);
    console.log(`📁 Index path: ${this.indexPath}`);
    
    try {
      // Ensure index directory exists
      await fs.mkdir(this.indexPath, { recursive: true });
      console.log('✅ Text search engine initialized successfully');
    } catch (error) {
      console.error(`❌ Failed to initialize text search engine at path: ${this.indexPath}`);
      console.error('Error details:', error);
      throw error;
    }
  }

  /**
   * Process DocC content into searchable chunks
   */
  processDocCContent(symbol: any, archiveName: string): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    
    if (!symbol || !symbol.metadata) {
      return chunks;
    }

    const baseMetadata = {
      archive: archiveName,
      symbolId: symbol.identifier?.url || '',
      title: symbol.metadata.title || 'Untitled',
      kind: symbol.metadata.symbolKind || symbol.kind || 'unknown',
      url: symbol.identifier?.url || ''
    };

    // Extract main content
    let mainContent = '';
    
    // Add title and abstract
    if (symbol.metadata.title) {
      mainContent += symbol.metadata.title + ' ';
    }
    
    if (symbol.abstract) {
      const abstractText = this.extractTextFromInlineContent(symbol.abstract);
      mainContent += abstractText + ' ';
    }

    // Process primary content sections
    if (symbol.primaryContentSections) {
      for (const section of symbol.primaryContentSections) {
        if (section.kind === 'content' && section.content) {
          const sectionText = this.extractTextFromContent(section.content);
          mainContent += sectionText + ' ';
        }
        
        if (section.kind === 'declarations' && section.declarations) {
          for (const declaration of section.declarations) {
            if (declaration.tokens) {
              const declarationText = declaration.tokens.map((t: any) => t.text).join('');
              mainContent += declarationText + ' ';
            }
          }
        }
      }
    }

    // Process topic sections (additional documentation)
    if (symbol.topicSections) {
      for (const section of symbol.topicSections) {
        if (section.title) {
          mainContent += section.title + ' ';
        }
        
        if (section.abstract) {
          const abstractText = this.extractTextFromInlineContent(section.abstract);
          mainContent += abstractText + ' ';
        }
      }
    }

    // Clean up the content
    mainContent = this.cleanText(mainContent);
    
    if (mainContent.trim()) {
      // Chunk the content into manageable pieces
      const textChunks = this.chunkText(mainContent, 1000, 100);
      
      textChunks.forEach((chunk, index) => {
        chunks.push({
          content: chunk,
          metadata: {
            ...baseMetadata,
            title: index === 0 ? baseMetadata.title : `${baseMetadata.title} (part ${index + 1})`
          }
        });
      });
    }

    return chunks;
  }

  /**
   * Extract text from DocC inline content format
   */
  private extractTextFromInlineContent(inlineContent: any[]): string {
    if (!Array.isArray(inlineContent)) return '';
    
    return inlineContent.map(item => {
      if (typeof item === 'string') return item;
      if (item.text) return item.text;
      if (item.code) return item.code;
      return '';
    }).join(' ');
  }

  /**
   * Extract text from DocC content sections
   */
  private extractTextFromContent(content: any[]): string {
    if (!Array.isArray(content)) return '';
    
    let text = '';
    
    for (const item of content) {
      if (typeof item === 'string') {
        text += item + ' ';
      } else if (item.type === 'paragraph' && item.inlineContent) {
        text += this.extractTextFromInlineContent(item.inlineContent) + ' ';
      } else if (item.type === 'heading' && item.text) {
        text += item.text + ' ';
      } else if (item.type === 'codeListing' && item.code) {
        // Include code but with less weight
        if (Array.isArray(item.code)) {
          text += item.code.join(' ') + ' ';
        } else {
          text += item.code + ' ';
        }
      } else if (item.inlineContent) {
        text += this.extractTextFromInlineContent(item.inlineContent) + ' ';
      } else if (item.content) {
        text += this.extractTextFromContent(item.content) + ' ';
      }
    }
    
    return text;
  }

  /**
   * Clean and normalize text for search
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.-]/g, ' ') // Remove special chars except dots and hyphens
      .toLowerCase()
      .trim();
  }

  /**
   * Chunk text content into smaller pieces
   */
  chunkText(text: string, maxTokens: number = 1000, overlap: number = 100): string[] {
    // Simple word-based chunking
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    
    if (words.length <= maxTokens) {
      return [text];
    }
    
    for (let i = 0; i < words.length; i += maxTokens - overlap) {
      const chunk = words.slice(i, i + maxTokens).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  /**
   * Add content chunks to the search index
   */
  async addToIndex(chunks: ContentChunk[]): Promise<void> {
    for (const chunk of chunks) {
      const record: TextSearchRecord = {
        id: this.generateId(chunk),
        content: chunk.content,
        metadata: {
          ...chunk.metadata,
          tokens: chunk.content.split(/\s+/).length
        }
      };
      
      this.documents.push(record);
      this.tfidf.addDocument(chunk.content);
    }
  }

  /**
   * Generate unique ID for content chunk
   */
  private generateId(chunk: ContentChunk): string {
    const { archive, symbolId, title } = chunk.metadata;
    const contentHash = Buffer.from(chunk.content).toString('base64').slice(0, 8);
    return `${archive}-${symbolId || title}-${contentHash}`.replace(/[^a-zA-Z0-9-]/g, '-');
  }

  /**
   * Search the index for relevant content
   */
  async search(query: string, limit: number = 10, archiveFilter?: string): Promise<TextSearchResult[]> {
    if (this.documents.length === 0) {
      return [];
    }

    // Clean the query
    const cleanQuery = this.cleanText(query);
    
    // Get TF-IDF scores for the query
    const scores: Array<{ index: number; score: number }> = [];
    
    this.tfidf.tfidfs(cleanQuery, (docIndex: number, measure: number) => {
      if (measure > 0) {
        scores.push({ index: docIndex, score: measure });
      }
    });

    // Sort by score and apply filters
    let results = scores
      .sort((a, b) => b.score - a.score)
      .map(({ index, score }) => {
        const doc = this.documents[index];
        return {
          content: doc.content,
          title: doc.metadata.title,
          url: doc.metadata.url,
          score: score,
          archive: doc.metadata.archive,
          kind: doc.metadata.kind
        };
      });

    // Apply archive filter
    if (archiveFilter) {
      results = results.filter(result => result.archive === archiveFilter);
    }

    // Return top results
    return results.slice(0, limit);
  }

  /**
   * Clear the search index
   */
  clearIndex(): void {
    this.documents = [];
    this.tfidf = new TfIdf();
  }

  /**
   * Save the index to disk
   */
  async saveIndex(): Promise<void> {
    const indexData = {
      documents: this.documents,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
    
    const indexFile = path.join(this.indexPath, 'text-index.json');
    await fs.writeFile(indexFile, JSON.stringify(indexData, null, 2));
  }

  /**
   * Load the index from disk
   */
  async loadIndex(): Promise<void> {
    const indexFile = path.join(this.indexPath, 'text-index.json');
    
    try {
      const data = await fs.readFile(indexFile, 'utf-8');
      const indexData = JSON.parse(data);
      
      this.documents = indexData.documents || [];
      
      // Rebuild TF-IDF index
      this.tfidf = new TfIdf();
      for (const doc of this.documents) {
        this.tfidf.addDocument(doc.content);
      }
      
      console.log(`📖 Loaded text search index: ${this.documents.length} documents`);
    } catch (error) {
      console.log('📝 No existing text search index found, starting fresh');
    }
  }

  /**
   * Get index statistics
   */
  getStats(): { totalDocuments: number; archives: string[]; kinds: string[] } {
    const archives = new Set<string>();
    const kinds = new Set<string>();
    
    for (const doc of this.documents) {
      archives.add(doc.metadata.archive);
      kinds.add(doc.metadata.kind);
    }
    
    return {
      totalDocuments: this.documents.length,
      archives: Array.from(archives),
      kinds: Array.from(kinds)
    };
  }
}