# OpenAPI Spec Crawler - Detailed Step-by-Step Workflow

## 📋 Table of Contents
1. [System Architecture](#system-architecture)
2. [Component Breakdown](#component-breakdown)
3. [How a Crawl Works (Step by Step)](#how-a-crawl-works-step-by-step)
4. [How Updates Work](#how-updates-work)
5. [Data Flow Examples](#data-flow-examples)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Command                             │
│                  npm run crawl -- --token XXX                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CLI (cli.js)                              │
│  - Parse command line arguments                                  │
│  - Call crawl() or demo() or update()                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │   CRAWL    │  │   DEMO     │  │   UPDATE   │
   │  (Find     │  │  (Local    │  │  (Re-fetch │
   │  new)      │  │  testing)  │  │  & sync)   │
   └──────┬─────┘  └────────────┘  └────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│            GitHub Search / Local Files                           │
│                                                                  │
│  1. searchGithubCode() - Query GitHub API                      │
│  2. resolveRawGithubUrl() - Get actual download URL           │
│  3. fetchSpec() - Download file from GitHub/local             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Parse & Extract (spec-parser.js)                    │
│                                                                  │
│  1. Detect if YAML or JSON                                     │
│  2. Detect OpenAPI 2.x (Swagger) or 3.x                       │
│  3. Extract: title, version, paths, tags, servers            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│            Version Tracking (catalog-store.js)                   │
│                                                                  │
│  1. Create SHA256 hash of file content                         │
│  2. Compare with previous hash (detect changes)               │
│  3. Create history record                                     │
│  4. Calculate diff (what paths were added/removed)           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Save to Catalog (catalog.json)                      │
│                                                                  │
│  {                                                              │
│    "id": "github:stripe/openapi/spec3.yaml",                  │
│    "source_url": "https://raw.githubusercontent.com/...",     │
│    "title": "Stripe API",                                     │
│    "latest_version": "2024-06-20",                           │
│    "paths_count": 312,                                       │
│    "history": [ ... old versions ... ]                       │
│  }                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Component Breakdown

### **1. CLI (src/cli.js)**
**What it does:** Entry point, parses arguments, decides what to run

| Function | Purpose |
|----------|---------|
| `parseArgs()` | Parse `--token`, `--query`, `--limit` from command line |
| `runDemo()` | Run local demo with fixture files |
| `crawl` command | Discover and index new specs |

**Example:**
```bash
npm run crawl -- --token ghp_xxx --query "filename:openapi.yaml" --limit 5
```
Becomes:
```javascript
{
  token: "ghp_xxx",
  query: "filename:openapi.yaml",
  limit: 5
}
```

---

### **2. GitHub Search (src/github-search.js)**
**What it does:** Finds specs on GitHub using their search API

| Function | Purpose |
|----------|---------|
| `searchGithubCode()` | Query GitHub Code Search API for file names |
| `resolveRawGithubUrl()` | Convert search result to direct download URL |
| `fetchRepositoryInfo()` | Get repo details (default branch, etc.) |

**Example flow:**
```
Input: filename:openapi.yaml
       ↓
GitHub API returns:
{
  repository: { full_name: "stripe/openapi" },
  path: "openapi/spec3.yaml",
  branch: "main"
}
       ↓
Output: https://raw.githubusercontent.com/stripe/openapi/main/openapi/spec3.yaml
        (Now we can download it!)
```

---

### **3. Fetch Spec (src/fetch-spec.js)**
**What it does:** Download the actual file (YAML/JSON)

| Function | Purpose |
|----------|---------|
| `fetchSpec()` | Download file with conditional headers (ETag, If-Modified-Since) |

**Key features:**
- ✅ Returns 304 "Not Modified" if file hasn't changed (saves bandwidth)
- ✅ Includes ETag header for future conditional requests
- ✅ Includes Last-Modified timestamp
- ✅ Calculates SHA256 hash of content

**Example:**
```javascript
// First request
Response: 200 OK, Content: "openapi: 3.0.0\n...", ETag: "abc123"

// Second request (same file)
Request with: If-None-Match: "abc123"
Response: 304 Not Modified (no download needed!)
```

---

### **4. Spec Parser (src/spec-parser.js)**
**What it does:** Read YAML/JSON, detect spec version, extract metadata

| Function | Purpose |
|----------|---------|
| `parseSpec()` | Parse YAML or JSON, validate OpenAPI/Swagger |
| `collectTags()` | Extract tags from spec |
| `buildSwaggerServers()` | Convert Swagger 2.x host info to server URLs |

**Supports:**
- ✅ OpenAPI 3.0, 3.1 (YAML or JSON)
- ✅ Swagger 2.0 (YAML or JSON)

**Extracted data:**
```javascript
{
  title: "Stripe API",
  description: "Official Stripe API documentation",
  oasVersion: "3.0.0",      // version of OpenAPI spec
  version: "2024-06-20",     // API version from info.version
  servers: ["https://api.stripe.com"],
  pathsCount: 312,           // how many endpoints
  tags: ["accounts", "charges", "customers"],
  document: { ... full parsed spec object ... }
}
```

---

### **5. Hash (src/hash.js)**
**What it does:** Create fingerprint of file for change detection

```javascript
SHA256("openapi: 3.0.0\ninfo: ...") = "a3f2e1c9..."
```

**Why?** If hash changes = spec changed, even if version number didn't update.

---

### **6. Spec Diff (src/spec-diff.js)**
**What it does:** Compare old and new specs to detect what changed

**Example:**
```
Old spec paths: /payments, /refunds
New spec paths: /payments, /refunds, /customers

Diff output:
{
  added: ["/customers"],
  removed: [],
  delta: +1  // net change in paths
}
```

Used to track what changed in history:
```json
{
  "version": "1.0.0",
  "hash": "a3f2...",
  "paths_count": 2,
  "diff": { "added": ["/customers"], "removed": [], "delta": 1 }
}
```

---

### **7. Catalog Store (src/catalog-store.js)**
**What it does:** Load/save catalog.json, manage versioned entries

| Function | Purpose |
|----------|---------|
| `loadCatalog()` | Read catalog.json from disk (or return [] if empty) |
| `saveCatalog()` | Write updated catalog back to disk |
| `createCatalogEntry()` | Build a new catalog entry with history |
| `upsertCatalogEntry()` | Insert new entry or update existing one |

**Entry structure:**
```javascript
{
  id: "github:stripe/openapi/spec3.yaml",           // unique ID
  source_url: "https://raw.githubusercontent.com/...", // where to download
  title: "Stripe API",
  oas_version: "3.0.0",                              // OpenAPI version
  latest_version: "2024-06-20",                      // API version
  paths_count: 312,
  servers: ["https://api.stripe.com"],
  tags: ["accounts", "charges"],
  fetched_at: "2026-05-15T15:47:54Z",               // when we downloaded it
  status: "active",                                  // active|stale|invalid
  etag: "W/\"abc123\"",                             // for conditional requests
  content_hash: "a3f2e1c9...",                      // SHA256 of file
  history: [                                         // previous versions
    {
      version: "2024-06-10",
      hash: "b2d8...",
      fetched_at: "2026-05-10T10:00:00Z",
      paths_count: 310,
      diff: { added: ["/customers"], removed: [], delta: 1 }
    }
  ],
  spec_snapshot: { ... full parsed spec ... }       // entire parsed object
}
```

---

### **8. Crawler (src/crawler.js)**
**What it does:** Orchestrates the whole workflow

**Steps:**
1. Load existing catalog from disk
2. Discover sources (GitHub search + local seeds)
3. For each source:
   - Fetch the spec file
   - Parse it
   - Create/update catalog entry
   - Save to catalog
4. Return summary (new, updated, unchanged, failed)

---

### **9. Update (src/update.js)**
**What it does:** Re-check existing specs for changes

**Steps:**
1. Load existing catalog
2. For each entry in catalog:
   - Use ETag to check if file changed
   - If changed: re-fetch and update entry
   - If not changed: skip (save bandwidth!)
3. Update history with new version info
4. Return summary

---

## 🚀 How a Crawl Works (Step by Step)

### **Scenario:** Run `npm run crawl -- --token ABC123 --query "filename:openapi.yaml" --limit 5`

#### **Step 1: CLI Parses Arguments**
```
Input: npm run crawl -- --token ABC123 --query "filename:openapi.yaml" --limit 5

↓

Output:
{
  token: "ABC123",
  query: "filename:openapi.yaml",
  limit: 5,
  catalog: "./catalog.json"
}
```

---

#### **Step 2: Load Existing Catalog**
```javascript
const catalog = await loadCatalog("./catalog.json");
// catalog = [ { id: "demo:payments", ... }, ... ] or []
```

---

#### **Step 3: Discover Sources via GitHub**
```javascript
// Search GitHub for openapi.yaml files
const items = await searchGithubCode({
  token: "ABC123",
  query: "filename:openapi.yaml",
  perPage: 5
});

// Returns:
[
  {
    repository: { full_name: "stripe/openapi" },
    path: "openapi/spec3.yaml"
  },
  {
    repository: { full_name: "APIs-guru/openapi-directory" },
    path: "APIs/twilio.com/api/openapi.yaml"
  },
  ...
]
```

---

#### **Step 4: Convert to Download URLs**
```javascript
// For each result, resolve the raw GitHub URL
const sourceUrl = await resolveRawGithubUrl(item, token);

// stripe/openapi + openapi/spec3.yaml
// ↓
// https://raw.githubusercontent.com/stripe/openapi/main/openapi/spec3.yaml

// APIs-guru/openapi-directory + APIs/twilio.com/api/openapi.yaml
// ↓
// https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/twilio.com/api/openapi.yaml
```

---

#### **Step 5: Fetch Each Spec**
```javascript
for (const source of sources) {
  const fetched = await fetchSpec(source.sourceUrl);
  
  // Returns:
  {
    notModified: false,
    content: "openapi: 3.0.0\ninfo:\n  title: Stripe API\n...",
    contentHash: "a3f2e1c9...",
    etag: "W/\"abc123\"",
    lastModified: "Wed, 15 May 2026 15:47:54 GMT"
  }
}
```

---

#### **Step 6: Parse Each Spec**
```javascript
const parsedSpec = parseSpec(fetched.content, source.sourceUrl);

// Returns:
{
  title: "Stripe API",
  description: "Official Stripe API",
  oasVersion: "3.0.0",
  version: "2024-06-20",
  servers: ["https://api.stripe.com"],
  pathsCount: 312,
  tags: ["accounts", "charges", "customers"],
  document: { ... full OpenAPI object ... }
}
```

---

#### **Step 7: Check for Previous Entry**
```javascript
const previousEntry = catalog.find(e => e.id === source.id);

// If exists, extract:
const previousHash = previousEntry.content_hash;
// If NOT exists:
const previousEntry = null;
```

---

#### **Step 8: Calculate Diff**
```javascript
if (previousEntry) {
  const diff = diffPaths(
    previousEntry.spec_snapshot,  // old spec
    parsedSpec.document            // new spec
  );
  // Returns: { added: [...], removed: [...], delta: N }
}
```

---

#### **Step 9: Create New Catalog Entry**
```javascript
const newEntry = createCatalogEntry({
  id: "github:stripe/openapi/spec3.yaml",
  sourceUrl: "https://raw.githubusercontent.com/...",
  parsedSpec: { title: "Stripe API", ... },
  contentHash: "a3f2e1c9...",
  fetchedAt: "2026-05-15T15:47:54Z",
  etag: "W/\"abc123\"",
  lastModified: "Wed, 15 May 2026 15:47:54 GMT",
  previousEntry: { ... old entry ... },
  previousHash: "b2d8...",
  diff: { added: [...], removed: [...] }
});

// Creates history with previous entry appended:
{
  id: "github:stripe/openapi/spec3.yaml",
  title: "Stripe API",
  latest_version: "2024-06-20",
  paths_count: 312,
  history: [
    {
      version: "2024-06-10",
      hash: "b2d8...",
      paths_count: 310,
      diff: { added: [...], removed: [...] }
    }
  ]
}
```

---

#### **Step 10: Upsert into Catalog**
```javascript
const outcome = upsertCatalogEntry(catalog, newEntry);

// If entry.id NOT in catalog:
//   → action: "new" (add to end)
// If entry.id exists but content_hash changed:
//   → action: "updated" (replace + keep history)
// If entry.id exists but content_hash same:
//   → action: "unchanged" (update timestamps only)
```

---

#### **Step 11: Save to Disk**
```javascript
await saveCatalog("./catalog.json", catalog);

// File now contains:
[
  { id: "demo:payments", ... },
  { id: "github:stripe/openapi/spec3.yaml", ... },
  { id: "github:APIs-guru/openapi-directory/twilio.yaml", ... },
  ...
]
```

---

#### **Step 12: Log Summary**
```javascript
{
  "new": 3,
  "updated": 1,
  "unchanged": 2,
  "failed": 1
}
```

---

## 🔄 How Updates Work

### **Scenario:** Run `npm run update` (re-check existing specs)

**Key difference from crawl:**
- ❌ NOT searching GitHub for NEW specs
- ✅ ONLY re-checking existing catalog entries
- ✅ Using ETag to avoid re-downloading unchanged files

#### **Steps:**

```
1. Load catalog.json
   ↓
2. For each entry in catalog:
   ↓
3. Fetch spec with If-None-Match: <etag>
   ↓
   IF 304 Not Modified:
     → Skip (unchanged)
   ELSE:
     → Parse new content
     → Compare hash
     → Create history entry
     → Update catalog entry
   ↓
4. Save updated catalog
   ↓
5. Return summary
```

**Example:**
```
Entry 1: "github:stripe/openapi/spec3.yaml"
  ETag: "abc123"
  Fetch with If-None-Match: "abc123"
  Response: 304 Not Modified
  Action: UNCHANGED ✅ (skip re-download)

Entry 2: "github:APIs-guru/openapi-directory/twilio.yaml"
  ETag: "xyz789"
  Fetch with If-None-Match: "xyz789"
  Response: 200 OK, new content, ETag: "xyz791"
  Parse new content
  Compare hashes: "hash1" → "hash2" (changed!)
  Create history with diff
  Action: UPDATED ✅
```

---

## 📊 Data Flow Examples

### **Example 1: First Crawl of a Spec**

```
User runs: npm run crawl -- --token ABC --query "filename:openapi.yaml" --limit 1

↓

GitHub Search finds: stripe/openapi/spec3.yaml

↓

Download: https://raw.githubusercontent.com/stripe/openapi/main/spec3.yaml
Content: "openapi: 3.0.0\ninfo:\n  title: Stripe API\n  version: 2024-06-20\n..."
Hash: a3f2e1c9

↓

Parse:
{
  title: "Stripe API",
  version: "2024-06-20",
  pathsCount: 312,
  ...
}

↓

Create Entry (no previous):
{
  id: "github:stripe/openapi/spec3.yaml",
  latest_version: "2024-06-20",
  paths_count: 312,
  content_hash: "a3f2e1c9",
  history: [],  ← EMPTY (first time)
  status: "active"
}

↓

Save to catalog.json

Result: "new" ✅
```

---

### **Example 2: Re-crawl Same Spec (No Changes)**

```
User runs: npm run update

↓

Load catalog → finds existing Stripe entry
ETag: "abc123"

↓

Fetch: https://raw.githubusercontent.com/stripe/openapi/main/spec3.yaml
Headers: If-None-Match: "abc123"

↓

Response: 304 Not Modified ✅

↓

NO re-parse, NO file download
Just update fetch timestamp

Result: "unchanged" ✅
```

---

### **Example 3: Re-crawl Same Spec (Changed)**

```
User runs: npm run update

↓

Load catalog → finds existing Stripe entry
ETag: "abc123"

↓

Fetch: https://raw.githubusercontent.com/stripe/openapi/main/spec3.yaml
Headers: If-None-Match: "abc123"

↓

Response: 200 OK
New content: "openapi: 3.0.0\ninfo:\n  title: Stripe API\n  version: 2024-06-25\n..."
New Hash: b2d8f4a1
New ETag: "xyz789"

↓

Parse:
{
  title: "Stripe API",
  version: "2024-06-25",
  pathsCount: 315,  ← CHANGED (was 312)
  ...
}

↓

Compare hashes: a3f2e1c9 → b2d8f4a1 (DIFFERENT)
Compare versions: 2024-06-20 → 2024-06-25 (DIFFERENT)

Create diff:
{
  added: ["/charges/refunds/{refund_id}", "/accounts/{account_id}"],
  removed: [],
  delta: +3
}

↓

Create history entry:
{
  version: "2024-06-20",
  hash: "a3f2e1c9",
  paths_count: 312,
  diff: { added: [...], removed: [], delta: +3 },
  fetched_at: "2026-05-10T10:00:00Z"
}

↓

Update catalog entry:
{
  id: "github:stripe/openapi/spec3.yaml",
  latest_version: "2024-06-25",
  paths_count: 315,
  content_hash: "b2d8f4a1",
  etag: "xyz789",
  history: [
    {
      version: "2024-06-20",
      hash: "a3f2e1c9",
      paths_count: 312,
      diff: { added: [...], removed: [], delta: +3 }
    }
  ]
}

↓

Save to catalog.json

Result: "updated" ✅
```

---

## 🧪 Test Coverage

The tests verify:

1. **Parsing OpenAPI 3 YAML** ✅
   - Can read YAML file
   - Extracts title, version, paths
   
2. **Parsing Swagger 2 JSON** ✅
   - Can read JSON file
   - Converts Swagger 2 structure to standard format

3. **Creating History** ✅
   - When spec changes, old version saved to history
   - Diff is calculated correctly
   
4. **Computing Path Diffs** ✅
   - Detects added paths
   - Detects removed paths
   - Calculates delta

---

## 📁 File Structure Summary

```
src/
  cli.js               ← User entry point (parses args, calls crawl/demo/update)
  crawler.js          ← Main crawl logic (discovers, fetches, parses, saves)
  github-search.js    ← Find specs on GitHub
  fetch-spec.js       ← Download file with ETag support
  spec-parser.js      ← Parse YAML/JSON → extract metadata
  catalog-store.js    ← Load/save catalog.json, manage versions
  spec-diff.js        ← Compare old/new specs
  hash.js             ← SHA256 hashing
  logger.js           ← JSON structured logging
  update.js           ← Re-check existing specs

fixtures/
  openapi-v1.yaml     ← Test fixture (v1.0.0, 2 paths)
  openapi-v2.yaml     ← Test fixture (v1.1.0, 3 paths - for update testing)

test/
  catalog-store.test.js    ← Test versioning logic
  parser.test.js           ← Test parsing
  spec-diff.test.js        ← Test diff detection

catalog.json        ← OUTPUT: Final catalog (created after running)
```

---

## 🎯 Key Takeaways

1. **Discovery Phase** → GitHub Search finds where specs live
2. **Fetch Phase** → Download spec with ETag for efficiency
3. **Parse Phase** → Extract metadata (title, paths, version)
4. **Hash Phase** → Create SHA256 fingerprint for change detection
5. **Diff Phase** → Compare old vs new (what changed?)
6. **Store Phase** → Save to catalog.json with history
7. **Update Phase** → Re-check existing specs using ETags (no re-download if unchanged)

**All the magic is in:**
- Using **content hashes** for change detection
- Using **ETags** for efficient updates
- Using **history array** to keep all versions
- Using **diff detection** to show what changed

