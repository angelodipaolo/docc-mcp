#!/usr/bin/env node

import { DocCArchiveManager } from './dist/docc-manager.js';
import { SemanticSearchEngine } from './dist/semantic-search.js';

async function testSemanticSearch() {
  console.log('🧪 Testing semantic search with a few symbols...');
  
  try {
    // Initialize managers
    const doccManager = new DocCArchiveManager(['.samples']);
    const searchEngine = new SemanticSearchEngine();

    // Initialize search engine
    console.log('🤖 Initializing semantic search engine...');
    await searchEngine.initialize();

    // Get a few symbols to test with
    console.log('📖 Getting test symbols...');
    const testSymbols = [
      'documentation/composablearchitecture/store',
      'documentation/composablearchitecture/shared',
      'documentation/composablearchitecture/teststore'
    ];

    let totalChunks = 0;
    for (const symbolId of testSymbols) {
      try {
        console.log(`   Processing ${symbolId}...`);
        const symbol = await doccManager.getSymbol(symbolId, 'ComposableArchitecture', {
          includeReferences: false,
          maxSections: 5,
          summaryOnly: false
        });
        
        if (symbol) {
          const chunks = searchEngine.processDocCContent(symbol, 'ComposableArchitecture');
          console.log(`   Generated ${chunks.length} chunks`);
          
          if (chunks.length > 0) {
            await searchEngine.addToIndex(chunks);
            totalChunks += chunks.length;
          }
        }
      } catch (error) {
        console.warn(`   ⚠️  Failed to process ${symbolId}:`, error.message);
      }
    }

    console.log(`\n✅ Added ${totalChunks} chunks to search index`);

    // Test searches
    const testQueries = [
      'how to test shared state',
      'store and state management',
      'composable architecture testing'
    ];

    for (const query of testQueries) {
      console.log(`\n🔍 Testing search: "${query}"`);
      const results = await searchEngine.search(query, 3);
      
      console.log(`   Found ${results.length} results:`);
      results.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.title} (${result.kind}) - Score: ${result.score.toFixed(3)}`);
        console.log(`      ${result.content.substring(0, 100)}...`);
      });
    }

    // Save the test index
    await searchEngine.saveIndex();
    console.log('\n💾 Saved test index');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSemanticSearch();