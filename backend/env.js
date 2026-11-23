const path = require("path");

try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // no .env file (like on render), use whatever is already set
}
