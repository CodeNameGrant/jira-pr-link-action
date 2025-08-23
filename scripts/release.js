// scripts/release.js
const { execSync } = require('child_process');

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}
function out(cmd, opts = {}) {
  // Capture stdout (for grabbing the new tag from `npm version`)
  return execSync(cmd, { stdio: ['inherit', 'pipe', 'inherit'], ...opts })
    .toString()
    .trim();
}

(async () => {
  try {
    const type = process.argv[2] || 'patch';

    console.log('Building action…');
    run('npm run build');

    // Stage dist so it’s part of the version commit
    run('git add -f dist');

    console.log(`Bumping version: ${type}`);
    // npm version prints the new tag, e.g. "v0.0.12"
    const newTag = out(`npm version ${type} -m "chore(release): Bump to %s"`);

    // Push the branch and the specific tag
    run('git push origin HEAD');
    run(`git push origin ${newTag}`);

    console.log(`✅ Versioning completed. Pushed tag ${newTag}`);
  } catch (err) {
    console.error('❌ Versioning failed:', err.message);
    process.exit(1);
  }
})();
