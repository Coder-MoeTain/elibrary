/**
 * Generate self-signed TLS files in ./certs (key.pem + cert.pem).
 * Requires OpenSSL on PATH (Ubuntu: apt install openssl; Windows: Git Bash or install OpenSSL).
 *
 * Usage:
 *   node scripts/generate-self-signed-certs.js [IP_OR_HOST]
 *   CERT_IP=192.168.11.56 node scripts/generate-self-signed-certs.js
 *
 * Default CN/SAN: 127.0.0.1 + localhost
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const projectRoot = path.join(__dirname, "..");
const certsDir = path.join(projectRoot, "certs");
const keyPath = path.join(certsDir, "key.pem");
const certPath = path.join(certsDir, "cert.pem");

const primary = (process.argv[2] || process.env.CERT_IP || "127.0.0.1").trim();

fs.mkdirSync(certsDir, { recursive: true });

const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(primary);
const cnfPath = path.join(certsDir, "openssl-gen.cnf");

const sanBlock = isIp
  ? `IP.1 = ${primary}
IP.2 = 127.0.0.1
DNS.1 = localhost`
  : `DNS.1 = ${primary}
DNS.2 = localhost
IP.1 = 127.0.0.1`;

const cnf = `
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = ${primary}

[v3_req]
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
${sanBlock}
`.trim();

fs.writeFileSync(cnfPath, cnf, "utf8");

try {
  execSync(
    `openssl req -x509 -newkey rsa:4096 -sha256 -days 825 -nodes -keyout "${keyPath}" -out "${certPath}" -config "${cnfPath}" -extensions v3_req`,
    { stdio: "inherit", cwd: projectRoot, shell: true },
  );
} catch {
  // eslint-disable-next-line no-console
  console.error("\nOpenSSL failed. Install openssl and retry.");
  process.exit(1);
} finally {
  try {
    fs.unlinkSync(cnfPath);
  } catch {
    /* ignore */
  }
}

// eslint-disable-next-line no-console
console.log(`\nCreated:\n  ${keyPath}\n  ${certPath}`);
// eslint-disable-next-line no-console
console.log(
  "\nNext: set in .env → USE_TLS=true and USE_HTTPS=true, then restart the server.",
);
// eslint-disable-next-line no-console
console.log(
  "Browser will warn (self-signed): choose Advanced → Continue / accept risk.\n",
);
