const shell = require('shelljs');
const path = require('path');
const fs = require('fs');

const stagingPath = path.join(__dirname, 'test_staging');
const rootPath = path.join(__dirname, 'test_root');

// Prep
if (!fs.existsSync(stagingPath)) fs.mkdirSync(stagingPath);
if (!fs.existsSync(rootPath)) fs.mkdirSync(rootPath);
if (!fs.existsSync(path.join(stagingPath, 'subdir'))) fs.mkdirSync(path.join(stagingPath, 'subdir'));

fs.writeFileSync(path.join(stagingPath, 'file1.txt'), 'content1');
fs.writeFileSync(path.join(stagingPath, 'subdir', 'file2.txt'), 'content2');

console.log('--- TEST START ---');
console.log(`Staging: ${stagingPath}`);
console.log(`Root: ${rootPath}`);

// Try with forward slashes and without path.join for the *
const src = stagingPath.replace(/\\/g, '/') + '/*';
const dst = rootPath.replace(/\\/g, '/') + '/';

console.log(`Executing: shell.cp('-Rf', "${src}", "${dst}")`);
const result = shell.cp('-Rf', src, dst);

if (result.code !== 0) {
    console.error('FAIL:', result.stderr);
} else {
    console.log('SUCCESS: shell.cp returned 0');
    // Verify
    const f1 = fs.existsSync(path.join(rootPath, 'file1.txt'));
    const f2 = fs.existsSync(path.join(rootPath, 'subdir', 'file2.txt'));
    console.log(`File 1 exists: ${f1}`);
    console.log(`File 2 exists: ${f2}`);
}

// Cleanup
// shell.rm('-rf', stagingPath, rootPath);
