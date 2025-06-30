#!/usr/bin/env node

import { DocCArchiveManager } from './docc-manager.js';
import { SemanticSearchEngine } from './semantic-search.js';

/**
 * CLI tool to build semantic search index from DocC archives
 */
async function buildIndex() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
DocC Semantic Search Index Builder

Usage: node dist/index-builder.js --archive-path <path> [options]

Options:
  --archive-path <path>    Directory containing .doccarchive files (can be repeated)
  --rebuild               Clear existing index and rebuild from scratch
  --help, -h              Show this help message

Examples:
  node dist/index-builder.js --archive-path ./docs --archive-path ~/my-docs
  node dist/index-builder.js --archive-path ~/Library/Developer/Xcode/DerivedData --rebuild
`);
    process.exit(0);
  }

  // Parse archive paths
  const archivePaths: string[] = [];
  let rebuild = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--archive-path' && i + 1 < args.length) {
      archivePaths.push(args[i + 1]);
      i++; // Skip the next argument since we consumed it
    } else if (args[i].startsWith('--archive-path=')) {
      archivePaths.push(args[i].substring('--archive-path='.length));
    } else if (args[i] === '--rebuild') {
      rebuild = true;
    }
  }

  if (archivePaths.length === 0) {
    console.error('❌ Error: No archive paths specified. Use --archive-path to specify directories containing .doccarchive files.');
    process.exit(1);
  }

  console.log('🚀 Starting semantic search index building...');
  console.log(`📁 Archive paths: ${archivePaths.join(', ')}`);

  try {
    // Initialize managers
    const doccManager = new DocCArchiveManager(archivePaths);
    const searchEngine = new SemanticSearchEngine();

    // Initialize search engine
    console.log('🤖 Initializing semantic search engine...');
    await searchEngine.initialize();

    // Load or clear existing index
    if (rebuild) {
      console.log('🔄 Rebuilding index from scratch...');
      searchEngine.clearIndex();
    } else {
      await searchEngine.loadIndex();
      const stats = searchEngine.getStats();
      console.log(`📖 Loaded existing index: ${stats.totalEmbeddings} embeddings across ${stats.archives.length} archives`);
    }

    // Get all archives
    const archives = await doccManager.listArchives();
    console.log(`📚 Found ${archives.length} DocC archives`);

    let totalProcessed = 0;
    let totalChunks = 0;

    // Process each archive
    for (const archive of archives) {
      console.log(`\n📖 Processing archive: ${archive.name}`);
      
      try {
        // Browse the archive to get all symbols recursively
        const symbolIds = await getAllSymbolIds(doccManager, archive.name);
        
        console.log(`   Found ${symbolIds.length} symbols`);
        
        // Process symbols in batches to avoid memory issues
        const batchSize = 50;
        for (let i = 0; i < symbolIds.length; i += batchSize) {
          const batch = symbolIds.slice(i, i + batchSize);
          console.log(`   Processing symbols ${i + 1}-${Math.min(i + batchSize, symbolIds.length)}...`);
          
          for (const symbolId of batch) {
            try {
              // Get symbol data
              const symbol = await doccManager.getSymbol(symbolId, archive.name, {
                includeReferences: false,
                maxSections: 20,
                summaryOnly: false
              });
              
              if (symbol) {
                // Process content into chunks
                const chunks = searchEngine.processDocCContent(symbol, archive.name);
                if (chunks.length > 0) {
                  await searchEngine.addToIndex(chunks);
                  totalChunks += chunks.length;
                }
                totalProcessed++;
              }
            } catch (error) {
              console.warn(`   ⚠️  Failed to process ${symbolId}:`, error instanceof Error ? error.message : 'Unknown error');
            }
          }
          
          // Save progress periodically
          if ((i + batchSize) % 200 === 0) {
            console.log(`   💾 Saving progress... (${totalChunks} chunks so far)`);
            await searchEngine.saveIndex();
          }
        }
      } catch (error) {
        console.error(`❌ Failed to process archive ${archive.name}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Save final index
    console.log('\n💾 Saving final index...');
    await searchEngine.saveIndex();

    // Show final stats
    const finalStats = searchEngine.getStats();
    console.log(`\n✅ Index building complete!`);
    console.log(`📊 Statistics:`);
    console.log(`   - Processed ${totalProcessed} symbols`);
    console.log(`   - Generated ${finalStats.totalEmbeddings} content chunks`);
    console.log(`   - Archives: ${finalStats.archives.join(', ')}`);
    console.log(`   - Content types: ${finalStats.kinds.join(', ')}`);

  } catch (error) {
    console.error('❌ Index building failed:', error);
    process.exit(1);
  }
}

/**
 * Get all symbol IDs from an archive by recursively browsing directories
 */
async function getAllSymbolIds(doccManager: DocCArchiveManager, archiveName: string): Promise<string[]> {
  const symbolIds: string[] = [];
  const visited = new Set<string>();
  
  async function browseRecursively(path?: string): Promise<void> {
    const pathKey = path || 'root';
    if (visited.has(pathKey)) return;
    visited.add(pathKey);
    
    try {
      const structure = await doccManager.browseArchive(archiveName, path);
      
      if (structure.entries) {
        for (const entry of structure.entries) {
          if (entry.type === 'symbol' && entry.name.endsWith('.json')) {
            // Convert filename to symbol ID (remove .json extension)
            const symbolId = entry.name.replace('.json', '');
            symbolIds.push(symbolId);
          } else if (entry.type === 'directory' && entry.path) {
            // Recursively browse subdirectories
            await browseRecursively(entry.path);
          }
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  Failed to browse path ${path}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  await browseRecursively();
  return symbolIds;
}

// Run the index builder
buildIndex().catch(console.error);