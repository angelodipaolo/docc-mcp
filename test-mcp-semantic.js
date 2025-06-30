#!/usr/bin/env node

import { spawn } from 'child_process';

async function testMCPSemanticSearch() {
  console.log('🧪 Testing semantic search via MCP server...');
  
  // Start the MCP server
  const server = spawn('node', ['dist/index.js', '--archive-path', '.samples'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Wait a bit for server to initialize
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test the semantic search tool
  const testRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "semantic_search_docc",
      arguments: {
        query: "how to test shared state",
        limit: 3
      }
    }
  };

  console.log('📤 Sending semantic search request...');
  console.log('Query:', testRequest.params.arguments.query);

  server.stdin.write(JSON.stringify(testRequest) + '\n');

  // Listen for response
  server.stdout.on('data', (data) => {
    try {
      const response = JSON.parse(data.toString());
      console.log('\n📥 Received response:');
      
      if (response.result && response.result.content) {
        const results = JSON.parse(response.result.content[0].text);
        console.log(`Found ${results.length} semantic search results:`);
        
        results.forEach((result, i) => {
          console.log(`\n${i + 1}. ${result.title} (${result.kind})`);
          console.log(`   Score: ${result.score.toFixed(3)}`);
          console.log(`   Archive: ${result.archive}`);
          console.log(`   Content: ${result.content.substring(0, 150)}...`);
        });
      } else {
        console.log('Response:', JSON.stringify(response, null, 2));
      }
      
      // Clean up
      server.kill();
      process.exit(0);
    } catch (error) {
      console.error('Failed to parse response:', data.toString());
    }
  });

  server.stderr.on('data', (data) => {
    console.log('Server log:', data.toString());
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
  });

  // Timeout after 30 seconds
  setTimeout(() => {
    console.log('❌ Test timed out');
    server.kill();
    process.exit(1);
  }, 30000);
}

testMCPSemanticSearch();