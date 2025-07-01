# docc-mcp

A Model Context Protocol (MCP) server that exposes Apple DocC documentation archives to AI agents, enabling real-time access to Swift documentation without requiring training data or massive context windows.

## Features

- **🔍 Advanced Text Search**: Full-text search using TF-IDF algorithm across all DocC archives
- **📖 Symbol Details**: Get detailed information about specific Swift symbols
- **📄 Article Access**: Get detailed information about tutorials and articles
- **🗂️ Browse Archives**: Navigate DocC archive structures interactively  
- **⚡ Real-time Access**: Query current documentation without stale data
- **🎯 Filtered Search**: Search by symbol type (class, struct, enum, protocol, etc.)
- **📊 Smart Indexing**: Automatic text indexing for fast and accurate search results

## Installation

```bash
npm install
npm run build
```

## Building the Text Search Index

The server uses an advanced TF-IDF text search engine for fast and accurate documentation search. While the text index is built automatically when the server starts, you can pre-build it for better performance.

### Automatic Index Building

When the MCP server starts, it will:
1. Initialize the text search engine
2. Load any existing text index from `.text-index/`
3. Build the index incrementally as searches are performed

### Manual Index Building

For better performance, especially with large documentation sets, pre-build the text index:

**Using npm script:**
```bash
npm run build-text-index -- --archive-path /path/to/your/docc/archives
```

**Using the built distribution:**
```bash
node dist/text-index-builder.js --archive-path /path/to/your/docc/archives
```

### Index Builder Options

```bash
# Build index for single archive directory
npm run build-text-index -- --archive-path ~/my-docs

# Build index for multiple archive directories  
npm run build-text-index -- --archive-path ~/Project1/docs --archive-path ~/Project2/docs

# Rebuild index from scratch (clears existing index)
npm run build-text-index -- --archive-path ~/docs --rebuild

# Build index for Xcode-generated documentation
npm run build-text-index -- --archive-path "~/Library/Developer/Xcode/DerivedData"
```

### Index Storage

The text search index is stored in `.text-index/` directory and includes:
- **Document chunks**: Text content split into searchable segments
- **TF-IDF vectors**: Mathematical representation for search scoring
- **Metadata**: Archive names, symbol types, URLs, and titles
- **Statistics**: Document counts and archive information

The index directory is automatically created and can be safely deleted to rebuild from scratch.

### Performance Considerations

- **Initial build time**: 1-10 minutes depending on documentation size
- **Index size**: Typically 10-50MB for large documentation sets
- **Search performance**: Sub-second response times after indexing
- **Memory usage**: ~100-500MB during index building

## Usage

### As MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "docc": {
      "command": "node",
      "args": [
        "/path/to/docc-mcp/dist/index.js",
        "--archive-path", "/path/to/your/docc/archives",
        "--archive-path", "~/Documents/Xcode/DerivedData"
      ]
    }
  }
}
```

### Configuration Options

Configure archive paths using the `--archive-path` argument:

**Single archive directory:**
```json
{
  "mcpServers": {
    "docc": {
      "command": "node", 
      "args": [
        "/path/to/docc-mcp/dist/index.js",
        "--archive-path", "/Users/yourname/docc-archives"
      ]
    }
  }
}
```

**Multiple archive directories:**
```json
{
  "mcpServers": {
    "docc": {
      "command": "node",
      "args": [
        "/path/to/docc-mcp/dist/index.js",
        "--archive-path", "/Users/yourname/Project1/docs",
        "--archive-path", "/Users/yourname/Project2/docs", 
        "--archive-path", "~/Documents/Xcode/DerivedData"
      ]
    }
  }
}
```

**Using Xcode's generated documentation:**
```json
{
  "mcpServers": {
    "docc": {
      "command": "node",
      "args": [
        "/path/to/docc-mcp/dist/index.js",
        "--archive-path", "~/Library/Developer/Xcode/DerivedData/YourApp-*/Build/Products/Debug/YourApp.doccarchive"
      ]
    }
  }
}
```

**Note**: At least one `--archive-path` must be specified. The server will exit with an error if no archive paths are provided.

### Common DocC Archive Locations

**Xcode-generated documentation:**
- `~/Library/Developer/Xcode/DerivedData/YourApp-*/Build/Products/Debug*/Documentation/`
- `~/Library/Developer/Xcode/DerivedData/YourApp-*/Build/Products/Release*/Documentation/`

**Swift Package Manager:**
- `.build/plugins/Swift-DocC/outputs/YourPackage.doccarchive`

**Manual DocC builds:**
- `docs/` (if you organize archives in a docs folder)
- Project root directory where you run `swift package generate-documentation`

**Multiple projects:**
```json
{
  "args": [
    "/path/to/docc-mcp/dist/index.js",
    "--archive-path", "~/MySwiftPackage1/docs",
    "--archive-path", "~/MySwiftPackage2/.build/plugins/Swift-DocC/outputs", 
    "--archive-path", "~/Library/Developer/Xcode/DerivedData"
  ]
}
```

### Available Tools

#### 1. `list_archives`
Lists all available DocC archives with metadata.

```json
{
  "name": "list_archives"
}
```

#### 2. `search_docc`
Search across DocC documentation using advanced TF-IDF text search.

```json
{
  "name": "search_docc",
  "arguments": {
    "query": "SwiftSyntax",
    "archive": "SwiftSyntax",
    "type": "struct",
    "limit": 10
  }
}
```

#### 3. `get_symbol`
Get detailed information about a specific symbol.

```json
{
  "name": "get_symbol", 
  "arguments": {
    "symbolId": "documentation/swiftsyntax/tokensyntax",
    "archive": "SwiftSyntax"
  }
}
```

#### 4. `get_article`
Get detailed information about a specific article or tutorial.

```json
{
  "name": "get_article",
  "arguments": {
    "articleId": "meetcomposablearchitecture",
    "archive": "ComposableArchitecture"
  }
}
```

#### 5. `browse_archive`
Browse the structure of a DocC archive.

```json
{
  "name": "browse_archive",
  "arguments": {
    "archive": "SwiftSyntax",
    "path": "documentation/swiftsyntax"
  }
}
```

## Archive Structure

The server expects DocC archives in directories specified by `--archive-path`:

## Testing

Run the test script to validate functionality:

```bash
node test-server.js
```

This will:
- List all available archives
- Test search functionality
- Browse archive structures
- Validate symbol retrieval

## Example Queries

**Find all SwiftUI navigation components:**
```json
{
  "name": "search_docc",
  "arguments": {
    "query": "navigation",
    "type": "struct"
  }
}
```

**Get details about TokenSyntax:**
```json
{
  "name": "get_symbol",
  "arguments": {
    "symbolId": "documentation/swiftsyntax/tokensyntax", 
    "archive": "SwiftSyntax"
  }
}
```

**Browse SwiftSyntax types:**
```json
{
  "name": "browse_archive",
  "arguments": {
    "archive": "SwiftSyntax",
    "path": "documentation/swiftsyntax"
  }
}
```

## Performance

- **Text Search Engine**: Advanced TF-IDF algorithm provides fast, relevance-ranked results
- **Intelligent Caching**: Archives and symbols are cached for fast repeated access
- **Configurable Limits**: Search results limited to 10 per query by default (configurable)
- **Lazy Loading**: Archives loaded on-demand to minimize memory usage
- **Chunked Content**: Large documents split into searchable segments for better performance
- **Persistent Index**: Text search index saved to disk for fast server restarts

## DocC Integration

This server works with standard DocC archives. To generate compatible archives:

```bash
# Using Swift-DocC
swift package generate-documentation --target MyLibrary

# Using Xcode
# Product → Build Documentation
```

## Supported DocC Features

- ✅ Symbol metadata (title, kind, role, platforms)
- ✅ Documentation hierarchy
- ✅ Symbol references and relationships  
- ✅ Code declarations with syntax highlighting
- ✅ Abstract/summary text
- ✅ Platform availability information
- ✅ Module organization
- ✅ Full-text search with TF-IDF ranking
- ✅ Content chunking for large documents

## License

MIT License