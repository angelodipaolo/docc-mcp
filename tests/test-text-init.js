#!/usr/bin/env node

import { TextSearchEngine } from '../dist/text-search.js';

async function testInit() {
  console.log('Testing text search initialization...');
  
  const engine = new TextSearchEngine();
  
  try {
    await engine.initialize();
    console.log('✅ Success: Text search engine initialized');
  } catch (error) {
    console.log('❌ Failed:', error.message);
    console.log('Error stack:', error.stack);
  }
}

testInit();