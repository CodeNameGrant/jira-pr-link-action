// scripts/release.js
const { execSync } = require('child_process');

(async () => {
  try {
    const semVerType = process.argv[2] || 'patch';

    console.log('Building action…');
    run('npm run build');

    // Stage dist so it’s part of the version commit
    run('git add -f dist');

    console.log(`Bumping version: ${semVerType}`);
    // npm version prints the new tag, e.g. "v0.0.12"
    const newTag = out(`npm version ${semVerType} -m "chore(release): Bump to %s"`);

    // Push the branch and the specific tag
    run('git push origin HEAD');
    run(`git push origin ${newTag}`);

    console.log(`✅ Versioning completed. Pushed tag ${newTag}`);

    updateMajorAliasTag(newTag);
  } catch (err) {
    console.error('❌ Versioning failed:', err.message);
    process.exit(1);
  }
})();

/**
 * Executes a shell command synchronously and prints the command to the console.
 *
 * @param {string} cmd - The shell command to execute.
 * @param {Object} [opts={}] - Optional options to pass to execSync.
 * @returns {Buffer} The stdout from the executed command.
 */
function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

/**
 * Executes a shell command synchronously and returns its stdout output as a trimmed string.
 * By default, stdin and stderr are inherited from the parent process, while stdout is captured.
 *
 * @param {string} cmd - The shell command to execute.
 * @param {Object} [opts={}] - Optional options to pass to execSync.
 * @returns {string} The trimmed stdout output from the executed command.
 */
function out(cmd, opts = {}) {
  // Capture stdout (for grabbing the new tag from `npm version`)
  return execSync(cmd, { stdio: ['inherit', 'pipe', 'inherit'], ...opts })
    .toString()
    .trim();
}

/**
 * Updates the major version alias tag in Git to point to the specified tag.
 * Skips updating if the major version is 'v0'.
 *
 * @param {string} tag - The full version tag (e.g., "v1.2.3").
 */
function updateMajorAliasTag(tag) {
  const major = tag.split('.')[0]; // e.g. "v1"
  const majorTag = major;

  if (majorTag === 'v0') {
    console.log('Skipping major alias for v0 release');
    return;
  }

  console.log(`Updating major alias: ${majorTag} -> ${tag}`);

  run(`git tag -f ${majorTag}`);
  run(`git push origin ${majorTag} --force`);

  console.log(`✅ Updated alias ${majorTag} to point at ${tag}`);
}
