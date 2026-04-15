const axios = require('axios');
const fs = require('fs');
const path = require('path');

function getConfig() {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO; // formato: "owner/repo"
    if (!token || !repo) return null;
    const [owner, repoName] = repo.split('/');
    return { token, owner, repo: repoName };
}

function api() {
    const cfg = getConfig();
    if (!cfg) throw new Error('GITHUB_TOKEN ou GITHUB_REPO não configurados no .env');
    return axios.create({
        baseURL: 'https://api.github.com',
        headers: {
            Authorization: `token ${cfg.token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'squad-autonoma'
        }
    });
}

function isConfigured() {
    return !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
}

// Lê os arquivos de staging e retorna um mapa { filename: content }
function readStagingFiles(stagingPath) {
    if (!fs.existsSync(stagingPath)) return {};
    const staged = {};
    const walk = (dir, base) => {
        fs.readdirSync(dir).forEach(f => {
            const full = path.join(dir, f);
            const rel = base ? `${base}/${f}` : f;
            if (fs.statSync(full).isDirectory()) {
                walk(full, rel);
            } else {
                staged[rel] = fs.readFileSync(full, 'utf8');
            }
        });
    };
    walk(stagingPath, '');
    return staged;
}

/**
 * Cria uma branch + PR no GitHub com os arquivos de staging.
 * Usa a Git Data API para criar um único commit com todas as mudanças.
 * @returns { prUrl, prNumber, branchName }
 */
async function createPRFromStaging(projectId, projectTitle, stagingPath) {
    const cfg = getConfig();
    const gh = api();
    const branchName = `squad/evolucao-${projectId}`;

    const stagedFiles = readStagingFiles(stagingPath);
    if (Object.keys(stagedFiles).length === 0) {
        throw new Error('Nenhum arquivo em staging para criar PR');
    }

    // 1. SHA do HEAD do master
    const { data: ref } = await gh.get(`/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/master`);
    const masterSha = ref.object.sha;

    // 2. SHA da tree do commit atual
    const { data: masterCommit } = await gh.get(`/repos/${cfg.owner}/${cfg.repo}/git/commits/${masterSha}`);
    const baseTreeSha = masterCommit.tree.sha;

    // 3. Criar blobs para cada arquivo
    const treeItems = [];
    for (const [filename, content] of Object.entries(stagedFiles)) {
        const { data: blob } = await gh.post(`/repos/${cfg.owner}/${cfg.repo}/git/blobs`, {
            content: Buffer.from(content).toString('base64'),
            encoding: 'base64'
        });
        treeItems.push({ path: filename, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // 4. Criar nova tree
    const { data: newTree } = await gh.post(`/repos/${cfg.owner}/${cfg.repo}/git/trees`, {
        base_tree: baseTreeSha,
        tree: treeItems
    });

    // 5. Criar commit
    const changedList = Object.keys(stagedFiles).join(', ');
    const { data: newCommit } = await gh.post(`/repos/${cfg.owner}/${cfg.repo}/git/commits`, {
        message: `🤖 squad: meta-evolução ${projectId}\n\nArquivos: ${changedList}`,
        tree: newTree.sha,
        parents: [masterSha]
    });

    // 6. Criar branch apontando para o novo commit
    await gh.post(`/repos/${cfg.owner}/${cfg.repo}/git/refs`, {
        ref: `refs/heads/${branchName}`,
        sha: newCommit.sha
    });

    // 7. Criar PR
    const filesListMd = Object.keys(stagedFiles).map(f => `- \`${f}\``).join('\n');
    const { data: pr } = await gh.post(`/repos/${cfg.owner}/${cfg.repo}/pulls`, {
        title: `🤖 Squad: ${projectTitle}`,
        body: `## Meta-Evolução Autônoma\n\nGerada automaticamente pela Squad.\n\n### Arquivos modificados:\n${filesListMd}\n\n> Revise o diff antes de aprovar o merge.`,
        head: branchName,
        base: 'master'
    });

    } catch (e) {
        if (e.response && e.response.status === 403) {
            console.error(`[GITHUB] ❌ Erro 403 (Forbidden): O token no .env não tem permissão para escrever neste repositório.`);
            console.error(`👉 Verifique se o token tem a permissão "Contents: Read & Write" em 'Repository permissions'.`);
        }
        console.error(`[GITHUB] Falha ao criar PR: ${e.message}`);
        throw e;
    }
}

/**
 * Faz squash merge de uma PR e apaga a branch.
 */
async function mergePR(prNumber, branchName) {
    const cfg = getConfig();
    const gh = api();
    await gh.put(`/repos/${cfg.owner}/${cfg.repo}/pulls/${prNumber}/merge`, {
        merge_method: 'squash'
    });
    await gh.delete(`/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${branchName}`).catch(() => {});
    console.log(`[GITHUB] PR #${prNumber} mergeada e branch "${branchName}" deletada.`);
}

/**
 * Fecha uma PR sem fazer merge e apaga a branch.
 */
async function closePR(prNumber, branchName) {
    const cfg = getConfig();
    const gh = api();
    await gh.patch(`/repos/${cfg.owner}/${cfg.repo}/pulls/${prNumber}`, { state: 'closed' });
    await gh.delete(`/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${branchName}`).catch(() => {});
    console.log(`[GITHUB] PR #${prNumber} fechada e branch "${branchName}" deletada.`);
}

module.exports = { isConfigured, createPRFromStaging, mergePR, closePR };
