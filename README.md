# docc-mcp

A Model Context Protocol (MCP) server that exposes Apple DocC documentation archives to AI agents, enabling real-time access to Swift documentation without requiring training data or massive context windows.

## Features

- **🔍 Search Documentation**: Find symbols, types, functions across all DocC archives
- **📖 Symbol Details**: Get detailed information about specific Swift symbols
- **🗂️ Browse Archives**: Navigate DocC archive structures interactively  
- **⚡ Real-time Access**: Query current documentation without stale data
- **🎯 Filtered Search**: Search by symbol type (class, struct, enum, protocol, etc.)

## Installation

```bash
npm install
npm run build
```

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
Search across DocC documentation.

```json
{
  "name": "search_docc",
  "arguments": {
    "query": "SwiftSyntax",
    "archive": "SwiftSyntax",
    "type": "struct"
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

#### 4. `browse_archive`
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

- **Caching**: Archives and symbols are cached for fast repeated access
- **Search limits**: Results limited to 50 per query for performance
- **Lazy loading**: Archives loaded on-demand
- **File limits**: Search limited to 100 files per archive for performance

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

## License

MIT License