import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Types for DocC data structures
export interface DoccMetadata {
  schemaVersion: { major: number; minor: number; patch: number };
  bundleIdentifier: string;
  bundleDisplayName: string;
}

export interface DoccSymbol {
  identifier: {
    url: string;
    interfaceLanguage: string;
  };
  kind: string;
  metadata: {
    title: string;
    role: string;
    symbolKind?: string;
    modules: Array<{ name: string }>;
    platforms?: any[];
    fragments?: any[];
    externalID?: string;
  };
  primaryContentSections?: any[];
  sections?: any[];
  references?: Record<string, any>;
  hierarchy?: {
    paths: string[][];
  };
  abstract?: any[];
}

export interface SearchOptions {
  archive?: string;
  type?: string;
}

export interface SearchResult {
  archive: string;
  symbol: string;
  title: string;
  kind: string;
  role: string;
  path: string;
  abstract?: string;
  relevanceScore?: number;
}

export interface ArchiveInfo {
  name: string;
  displayName: string;
  bundleIdentifier: string;
  path: string;
  symbolCount?: number;
}

export class DocCArchiveManager {
  private archivePaths: string[];
  private archiveCache: Map<string, DoccMetadata> = new Map();
  private symbolCache: Map<string, DoccSymbol> = new Map();

  constructor(archivePaths: string[]) {
    this.archivePaths = archivePaths.map(p => path.resolve(p));
    console.error(`📁 Using configured archive paths: ${this.archivePaths.join(', ')}`);
  }

  /**
   * List all available DocC archives
   */
  async listArchives(): Promise<ArchiveInfo[]> {
    const archives: ArchiveInfo[] = [];
    
    for (const archivePath of this.archivePaths) {
      try {
        const entries = await fs.readdir(archivePath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.endsWith('.doccarchive')) {
            const fullArchivePath = path.join(archivePath, entry.name);
            const metadata = await this.loadArchiveMetadata(entry.name, archivePath);
            
            if (metadata) {
              // Count symbols by looking at data directory
              const symbolCount = await this.countSymbols(fullArchivePath);
              
              archives.push({
                name: entry.name.replace('.doccarchive', ''),
                displayName: metadata.bundleDisplayName,
                bundleIdentifier: metadata.bundleIdentifier,
                path: fullArchivePath,
                symbolCount,
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error listing archives in ${archivePath}:`, error);
      }
    }
    
    return archives;
  }

  /**
   * Load metadata for a specific archive
   */
  private async loadArchiveMetadata(archiveName: string, basePath?: string): Promise<DoccMetadata | null> {
    const cacheKey = archiveName;
    if (this.archiveCache.has(cacheKey)) {
      return this.archiveCache.get(cacheKey)!;
    }

    // If basePath is provided, use it; otherwise search all paths
    const searchPaths = basePath ? [basePath] : this.archivePaths;

    for (const searchPath of searchPaths) {
      try {
        const metadataPath = path.join(
          searchPath,
          archiveName.endsWith('.doccarchive') ? archiveName : `${archiveName}.doccarchive`,
          'metadata.json'
        );
        
        const content = await fs.readFile(metadataPath, 'utf-8');
        const metadata: DoccMetadata = JSON.parse(content);
        
        this.archiveCache.set(cacheKey, metadata);
        return metadata;
      } catch (error) {
        // Continue to next path
        continue;
      }
    }

    console.error(`Error loading metadata for ${archiveName}: not found in any configured path`);
    return null;
  }

  /**
   * Count symbols in an archive
   */
  private async countSymbols(archivePath: string): Promise<number> {
    try {
      const dataPath = path.join(archivePath, 'data');
      const count = await this.countJsonFiles(dataPath);
      return count;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Recursively count JSON files
   */
  private async countJsonFiles(dirPath: string): Promise<number> {
    let count = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          count += await this.countJsonFiles(fullPath);
        } else if (entry.name.endsWith('.json')) {
          count++;
        }
      }
    } catch (error) {
      // Directory might not exist
    }
    
    return count;
  }

  /**
   * Get a specific symbol from an archive with enhanced content
   */
  async getSymbol(symbolId: string, archiveName: string): Promise<any | null> {
    const cacheKey = `${archiveName}:${symbolId}`;
    if (this.symbolCache.has(cacheKey)) {
      return this.symbolCache.get(cacheKey)!;
    }

    try {
      // First, try to find the symbol file directly
      const symbolPath = await this.findSymbolPath(symbolId, archiveName);
      
      if (!symbolPath) {
        return null;
      }

      const content = await fs.readFile(symbolPath, 'utf-8');
      const symbol: DoccSymbol = JSON.parse(content);
      
      // Create enhanced symbol with extracted content
      const enhancedSymbol = {
        ...symbol,
        extractedContent: {
          abstract: symbol.abstract ? this.extractTextFromContent(symbol.abstract) : '',
          discussion: this.extractDiscussionContent(symbol),
          parameters: this.extractParameterContent(symbol),
          returnValue: this.extractReturnValueContent(symbol),
          availability: this.extractAvailabilityInfo(symbol),
        }
      };
      
      this.symbolCache.set(cacheKey, enhancedSymbol);
      return enhancedSymbol;
    } catch (error) {
      console.error(`Error getting symbol ${symbolId} from ${archiveName}:`, error);
      return null;
    }
  }

  /**
   * Extract discussion content from symbol
   */
  private extractDiscussionContent(symbol: DoccSymbol): string {
    if (!symbol.primaryContentSections) return '';
    
    let discussion = '';
    for (const section of symbol.primaryContentSections) {
      if (section.kind === 'content' && section.content) {
        discussion += this.extractTextFromContent(section.content) + '\n';
      }
    }
    return discussion.trim();
  }

  /**
   * Extract parameter information
   */
  private extractParameterContent(symbol: DoccSymbol): any[] {
    if (!symbol.primaryContentSections) return [];
    
    const parameters = [];
    for (const section of symbol.primaryContentSections) {
      if (section.kind === 'parameters' && section.parameters) {
        for (const param of section.parameters) {
          parameters.push({
            name: param.name,
            description: param.content ? this.extractTextFromContent(param.content) : ''
          });
        }
      }
    }
    return parameters;
  }

  /**
   * Extract return value information
   */
  private extractReturnValueContent(symbol: DoccSymbol): string {
    if (!symbol.primaryContentSections) return '';
    
    for (const section of symbol.primaryContentSections) {
      if (section.kind === 'content' && section.content) {
        for (const item of section.content) {
          if (item.type === 'heading' && item.text && item.text.toLowerCase().includes('return')) {
            // Find the content following the return heading
            const index = section.content.indexOf(item);
            if (index >= 0 && index < section.content.length - 1) {
              const nextItem = section.content[index + 1];
              if (nextItem.content) {
                return this.extractTextFromContent(nextItem.content);
              }
            }
          }
        }
      }
    }
    return '';
  }

  /**
   * Extract availability information
   */
  private extractAvailabilityInfo(symbol: DoccSymbol): any {
    const platforms = symbol.metadata?.platforms || [];
    const availability = {
      platforms: platforms.map(p => ({
        name: p.name,
        introducedAt: p.introducedAt,
        deprecated: p.deprecated || false,
        deprecatedAt: p.deprecatedAt
      }))
    };
    return availability;
  }

  /**
   * Find the file path for a symbol
   */
  private async findSymbolPath(symbolId: string, archiveName: string): Promise<string | null> {
    // Search all configured paths for the archive
    for (const basePath of this.archivePaths) {
      const archivePath = path.join(
        basePath,
        archiveName.endsWith('.doccarchive') ? archiveName : `${archiveName}.doccarchive`
      );
      
      try {
        // Check if archive exists in this path
        await fs.access(archivePath);
        
        // Check if it's a direct path
        if (symbolId.includes('/')) {
          const directPath = path.join(archivePath, 'data', `${symbolId}.json`);
          try {
            await fs.access(directPath);
            return directPath;
          } catch {
            // Continue with search
          }
        }

        // Search for the symbol file
        const dataPath = path.join(archivePath, 'data');
        const result = await this.searchForSymbolFile(dataPath, symbolId);
        if (result) {
          return result;
        }
      } catch {
        // Archive doesn't exist in this path, try next
        continue;
      }
    }
    
    return null;
  }

  /**
   * Recursively search for a symbol file
   */
  private async searchForSymbolFile(dirPath: string, symbolId: string): Promise<string | null> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const result = await this.searchForSymbolFile(fullPath, symbolId);
          if (result) return result;
        } else if (entry.name.endsWith('.json')) {
          // Check if filename matches (with or without .json extension)
          const baseName = entry.name.replace('.json', '');
          if (baseName === symbolId || entry.name === symbolId) {
            return fullPath;
          }
        }
      }
    } catch (error) {
      // Directory might not exist
    }
    
    return null;
  }

  /**
   * Search for symbols across archives
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const archives = options.archive ? [options.archive] : await this.getArchiveNames();
    
    for (const archiveName of archives) {
      const archiveResults = await this.searchInArchive(query, archiveName, options);
      results.push(...archiveResults);
    }
    
    return results.slice(0, 50); // Limit results
  }

  /**
   * Search within a specific archive
   */
  private async searchInArchive(
    query: string,
    archiveName: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    // Find the archive in any of the configured paths
    let archivePath: string | null = null;
    for (const basePath of this.archivePaths) {
      const candidatePath = path.join(
        basePath,
        archiveName.endsWith('.doccarchive') ? archiveName : `${archiveName}.doccarchive`
      );
      
      try {
        await fs.access(candidatePath);
        archivePath = candidatePath;
        break;
      } catch {
        continue;
      }
    }
    
    if (!archivePath) {
      return results;
    }
    
    const dataPath = path.join(archivePath, 'data');
    const symbolFiles = await this.findJsonFiles(dataPath);
    
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 0);
    
    for (const filePath of symbolFiles.slice(0, 200)) { // Increased limit
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const symbol: DoccSymbol = JSON.parse(content);
        
        const title = symbol.metadata?.title || '';
        const kind = symbol.metadata?.symbolKind || symbol.kind;
        const role = symbol.metadata?.role || '';
        
        // Extract abstract text
        let abstract = '';
        if (symbol.abstract && Array.isArray(symbol.abstract)) {
          abstract = this.extractTextFromContent(symbol.abstract);
        }
        
        // Extract discussion content
        let discussion = '';
        if (symbol.primaryContentSections) {
          for (const section of symbol.primaryContentSections) {
            if (section.kind === 'content' && section.content) {
              discussion += this.extractTextFromContent(section.content) + ' ';
            }
          }
        }
        
        // Extract parameter descriptions
        let parameters = '';
        if (symbol.primaryContentSections) {
          for (const section of symbol.primaryContentSections) {
            if (section.kind === 'parameters' && section.parameters) {
              for (const param of section.parameters) {
                if (param.content) {
                  parameters += this.extractTextFromContent(param.content) + ' ';
                }
              }
            }
          }
        }
        
        // Create searchable text combining all content
        const searchableText = [
          title,
          kind,
          role,
          abstract,
          discussion,
          parameters
        ].join(' ').toLowerCase();
        
        // Enhanced matching: check if all query words appear in the searchable text
        const matchesQuery = queryWords.every(word => 
          searchableText.includes(word)
        ) || title.toLowerCase().includes(queryLower); // Exact title match still prioritized
          
        const matchesType = !options.type || 
          kind.toLowerCase().includes(options.type.toLowerCase()) ||
          role.toLowerCase().includes(options.type.toLowerCase());
        
        if (matchesQuery && matchesType) {
          results.push({
            archive: archiveName.replace('.doccarchive', ''),
            symbol: symbol.identifier?.url || path.basename(filePath, '.json'),
            title,
            kind,
            role,
            path: filePath,
            abstract: abstract || undefined,
          });
        }
      } catch (error) {
        // Skip invalid JSON files
        continue;
      }
    }
    
    return results;
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
   * Browse archive structure
   */
  async browseArchive(archiveName: string, browsePath?: string): Promise<any> {
    // Find the archive in any of the configured paths
    let archivePath: string | null = null;
    for (const basePath of this.archivePaths) {
      const candidatePath = path.join(
        basePath,
        archiveName.endsWith('.doccarchive') ? archiveName : `${archiveName}.doccarchive`
      );
      
      try {
        await fs.access(candidatePath);
        archivePath = candidatePath;
        break;
      } catch {
        continue;
      }
    }
    
    if (!archivePath) {
      throw new Error(`Archive "${archiveName}" not found in any configured path`);
    }
    
    const targetPath = browsePath 
      ? path.join(archivePath, 'data', browsePath)
      : path.join(archivePath, 'data');
    
    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const structure = {
        path: browsePath || '/',
        entries: [] as any[],
      };
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          structure.entries.push({
            name: entry.name,
            type: 'directory',
            path: browsePath ? `${browsePath}/${entry.name}` : entry.name,
          });
        } else if (entry.name.endsWith('.json')) {
          // Try to read symbol info
          try {
            const content = await fs.readFile(path.join(targetPath, entry.name), 'utf-8');
            const symbol: DoccSymbol = JSON.parse(content);
            
            structure.entries.push({
              name: entry.name,
              type: 'symbol',
              title: symbol.metadata?.title,
              kind: symbol.metadata?.symbolKind || symbol.kind,
              role: symbol.metadata?.role,
            });
          } catch {
            structure.entries.push({
              name: entry.name,
              type: 'file',
            });
          }
        }
      }
      
      return structure;
    } catch (error) {
      throw new Error(`Cannot browse path: ${browsePath || '/'}`);
    }
  }

  /**
   * Get list of archive names
   */
  private async getArchiveNames(): Promise<string[]> {
    const archives = await this.listArchives();
    return archives.map(archive => archive.name);
  }

  /**
   * Find all JSON files recursively
   */
  private async findJsonFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.findJsonFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.name.endsWith('.json')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist
    }
    
    return files;
  }
}