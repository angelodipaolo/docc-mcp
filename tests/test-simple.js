#!/usr/bin/env node

import { DocCArchiveManager } from '../dist/docc-manager.js';

async function testSimple() {
  console.log('🧪 Testing configurable paths...\n');

  // Test custom path 
  console.log('📋 Testing with custom path: .samples');
  const manager = new DocCArchiveManager(['../.samples']);
  const archives = await manager.listArchives();
  console.log(`✅ Found ${archives.length} archives\n`);
  
  // Show first few
  archives.slice(0, 3).forEach(archive => {
    console.log(`  - ${archive.displayName} (${archive.symbolCount} symbols)`);
  });
  
  console.log('\n🎉 Configuration system working!');
}

testSimple();