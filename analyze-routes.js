const fs = require('fs');
const path = require('path');

// Function to extract routes from a file
function extractRoutesFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath, '.ts');
  const routes = [];
  
  // Extract route patterns
  const routePatterns = [
    /router\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g,
    /router\.route\(['"`]([^'"`]+)['"`]\)\s*\.(get|post|put|patch|delete)/g
  ];
  
  routePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (pattern.source.includes('route')) {
        routes.push({
          method: match[2].toUpperCase(),
          path: match[1],
          file: fileName
        });
      } else {
        routes.push({
          method: match[1].toUpperCase(),
          path: match[2],
          file: fileName
        });
      }
    }
  });
  
  // Also check for router.route() patterns with chained methods
  const chainPattern = /router\s*\.route\(['"`]([^'"`]+)['"`]\)\s*((?:\.[a-z]+\([^)]*\))+)/g;
  let chainMatch;
  while ((chainMatch = chainPattern.exec(content)) !== null) {
    const path = chainMatch[1];
    const chainedMethods = chainMatch[2];
    const methods = chainedMethods.match(/\.(get|post|put|patch|delete)/g);
    if (methods) {
      methods.forEach(method => {
        routes.push({
          method: method.replace('.', '').toUpperCase(),
          path: path,
          file: fileName
        });
      });
    }
  }
  
  return routes;
}

// Analyze all route files
const routesDir = path.join(__dirname, 'src', 'routes');
const files = fs.readdirSync(routesDir).filter(file => file.endsWith('.routes.ts'));

const allRoutes = {};

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  const routes = extractRoutesFromFile(filePath);
  const basePath = file.replace('.routes.ts', '').replace(/-/g, '_');
  
  if (!allRoutes[basePath]) {
    allRoutes[basePath] = [];
  }
  
  allRoutes[basePath].push(...routes);
});

// Sort and display routes
console.log('\n=== FIELDSY API ROUTES ANALYSIS ===\n');

Object.keys(allRoutes).sort().forEach(category => {
  const categoryName = category.replace(/_/g, '-');
  console.log(`\n📁 /api/${categoryName}`);
  console.log('─'.repeat(50));
  
  // Sort routes by path
  allRoutes[category].sort((a, b) => a.path.localeCompare(b.path));
  
  allRoutes[category].forEach(route => {
    const method = route.method.padEnd(7);
    const methodColor = {
      GET: '\x1b[32m',     // Green
      POST: '\x1b[34m',    // Blue
      PUT: '\x1b[33m',     // Yellow
      PATCH: '\x1b[35m',   // Magenta
      DELETE: '\x1b[31m'   // Red
    };
    const color = methodColor[route.method] || '\x1b[0m';
    const resetColor = '\x1b[0m';
    
    console.log(`  ${color}${method}${resetColor} ${route.path}`);
  });
});

// Generate summary
const totalRoutes = Object.values(allRoutes).reduce((sum, routes) => sum + routes.length, 0);
console.log('\n' + '='.repeat(50));
console.log(`📊 Total Routes: ${totalRoutes}`);
console.log(`📂 Categories: ${Object.keys(allRoutes).length}`);
console.log('='.repeat(50));

// Export as JSON for documentation
const output = {
  timestamp: new Date().toISOString(),
  totalRoutes,
  categories: Object.keys(allRoutes).length,
  routes: {}
};

Object.keys(allRoutes).forEach(category => {
  output.routes[`/api/${category.replace(/_/g, '-')}`] = allRoutes[category].map(r => ({
    method: r.method,
    path: r.path,
    fullPath: `/api/${category.replace(/_/g, '-')}${r.path}`
  }));
});

fs.writeFileSync(
  path.join(__dirname, 'api-routes-analysis.json'),
  JSON.stringify(output, null, 2)
);

console.log('\n✅ Routes analysis saved to api-routes-analysis.json\n');