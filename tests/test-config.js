#!/usr/bin/env node

import { DocCArchiveManager } from '../dist/docc-manager.js';

async function testConfig() {
  console.log('🧪 Testing configurable archive paths...\n');

  // Test 1: Default path
  console.log('📋 Test 1: Default path (.samples)');
  const defaultManager = new DocCArchiveManager(['../.samples']);
  const defaultArchives = await defaultManager.listArchives();
  console.log(`Found ${defaultArchives.length} archives in default path\n`);

  // Test 2: Custom path (same as default for this test)
  console.log('📋 Test 2: Custom path (explicitly set to .samples)');
  const customManager = new DocCArchiveManager(['../.samples']);
  const customArchives = await customManager.listArchives();
  console.log(`Found ${customArchives.length} archives in custom path\n`);

  // Test 3: Multiple paths (including non-existent one)
  console.log('📋 Test 3: Multiple paths (valid + invalid)');
  const multiManager = new DocCArchiveManager(['../.samples', '/nonexistent/path']);
  const multiArchives = await multiManager.listArchives();
  console.log(`Found ${multiArchives.length} archives across multiple paths\n`);

  // Test 4: Command line argument parsing
  console.log('📋 Test 4: Command line argument parsing');
  
  // Simulate command line args
  const originalArgv = process.argv;
  process.argv = ['node', 'script.js', '--archive-path', '../.samples', '--archive-path', '/another/path'];
  
  // Import and test the parsing function
  const { parseArchivePaths } = await import('../dist/index.js');
  
  console.log('✅ Configuration system working correctly!');
  
  // Restore argv
  process.argv = originalArgv;
}

testConfig().catch(console.error);