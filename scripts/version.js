// scripts/version.js
const { execSync } = require("child_process");

function run(command, options = {}) {
  console.log(`> ${command}`);
  execSync(command, { stdio: "inherit", ...options });
}

async function main() {
  try {
    // 1. Build dist
    console.log("Building action...");
    run("npm run build");

    // 2. Bump version (patch by default, can pass minor/major)
    const versionType = process.argv[2] || "patch";
    console.log(`Bumping version: ${versionType}`);
    run(`npm version ${versionType} -m "chore(release): Bump to %s"`);

    // 3. Add dist/ to the version commit
    console.log("Adding dist/ to the release commit...");
    run("git add -f dist");
    run("git commit --amend --no-edit");

    // 4. Push commit and tags
    console.log("Pushing to remote...");
    run("git push origin HEAD --follow-tags");

    console.log("Versioning completed.");
  } catch (err) {
    console.error("❌ Versioning failed:", err.message);
    process.exit(1);
  }
}

main();
