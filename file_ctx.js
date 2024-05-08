const vscode = require('vscode');
const fs = require('fs');
const ignore = require('ignore'); // You may need to install ignore
const path = require('path');

function isGitDirectory(filePath) {
    return filePath.includes('/.git') || filePath.includes('\\.git');
}

function scanFiles(dir, allFiles = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (isGitDirectory(filePath)) {
            // Skip any files or directories that are within .git folders
            return;
        }
        if (fs.statSync(filePath).isDirectory()) {
            scanFiles(filePath, allFiles);
        } else {
            allFiles.push(filePath);
        }
    });
    return allFiles;
}

// Assuming you have a function to handle adding the file contexts
async function handleAddFileContext() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage("No open workspace.");
        return;
    }

    // Assuming the first workspace folder is the root
    const rootPath = workspaceFolders[0].uri.fsPath;
    const gitignorePath = `${rootPath}/.gitignore`;
    let ig = ignore();

    try {
        const gitignore = fs.readFileSync(gitignorePath, 'utf8');
        ig.add(gitignore.split(/\r?\n/));
    } catch (err) {
        vscode.window.showInformationMessage(".gitignore not found. Scanning all files.");
    }

    let allFiles = scanFiles(rootPath);

    try {
        // Convert allFiles to relative paths with respect to rootPath
        allFiles = allFiles.map(file => path.relative(rootPath, file));
        // Filtering files not ignored by .gitignore
        const trackedFiles = allFiles.filter(file => !ig.ignores(file));
        // Proceed to add these files to your context file
        addToContextFile(rootPath, trackedFiles);
    } catch (err) {
        console.log('Error', err);
    }
}

function addToContextFile(rootPath, trackedFiles) {
    // Implement the logic to write file details to .ctx-pilot.cfg
    const configPath = `${rootPath}/.ctx-pilot.cfg`;
    // Example: write or append to the file the tracked files
    fs.writeFileSync(configPath, JSON.stringify(trackedFiles, null, 2), { flag: 'w' });
    vscode.window.showInformationMessage('File context added to .ctx-pilot.cfg');
}

module.exports = {
    handleAddFileContext
};