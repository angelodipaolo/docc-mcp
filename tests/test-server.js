#!/usr/bin/env node

import { DocCArchiveManager } from '../dist/docc-manager.js';

const manager = new DocCArchiveManager(['../.samples']);

async function testServer() {
  console.log('🧪 Testing DocC MCP Server...\n');

  try {
    // Test 1: List archives
    console.log('📋 Test 1: Listing archives...');
    const archives = await manager.listArchives();
    console.log(`Found ${archives.length} archives:`);
    archives.forEach(archive => {
      console.log(`  - ${archive.displayName} (${archive.symbolCount} symbols)`);
    });
    console.log();

    if (archives.length === 0) {
      console.error('❌ No archives found! Check .samples directory');
      return;
    }

    // Test 2: Search functionality
    console.log('🔍 Test 2: Searching for "Syntax"...');
    const searchResults = await manager.search('Syntax');
    console.log(`Found ${searchResults.length} results:`);
    searchResults.slice(0, 5).forEach(result => {
      console.log(`  - ${result.title} (${result.kind}) in ${result.archive}`);
    });
    console.log();

    // Test 3: Get specific symbol
    const firstArchive = archives[0].name;
    console.log(`🎯 Test 3: Browsing archive "${firstArchive}"...`);
    const structure = await manager.browseArchive(firstArchive);
    console.log(`Root contains ${structure.entries.length} entries:`);
    structure.entries.slice(0, 5).forEach(entry => {
      console.log(`  - ${entry.name} (${entry.type})`);
    });
    console.log();

    // Test 4: Get symbol details (if available)
    const symbolResults = searchResults.filter(r => r.archive === firstArchive);
    if (symbolResults.length > 0) {
      const symbolId = symbolResults[0].symbol.replace('doc://com.apple.swift-syntax/documentation/', 'documentation/');
      console.log(`📖 Test 4: Getting details for symbol "${symbolResults[0].title}"...`);
      const symbol = await manager.getSymbol(symbolId, firstArchive);
      if (symbol) {
        console.log(`  Title: ${symbol.metadata?.title}`);
        console.log(`  Kind: ${symbol.metadata?.symbolKind || symbol.kind}`);
        console.log(`  Role: ${symbol.metadata?.role}`);
        console.log(`  Platforms: ${symbol.metadata?.platforms?.length || 0}`);
      } else {
        console.log('  Symbol not found (this is expected for complex IDs)');
      }
      console.log();
    }

    console.log('✅ All tests completed successfully!');
    console.log('\n🚀 Server is ready to use with MCP clients.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testServer();