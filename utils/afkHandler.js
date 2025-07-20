import fs from 'fs';
import path from 'path';

const afkFilePath = path.join(process.cwd(), 'data', 'afk.json');

/**
 * Ensures the afk.json file exists.
 */
function ensureAfkFile() {
    const dir = path.dirname(afkFilePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(afkFilePath)) {
        fs.writeFileSync(afkFilePath, JSON.stringify({}));
    }
}

/**
 * Reads the AFK data from afk.json.
 * @returns {Object} The AFK data.
 */
export function readAfkData() {
    ensureAfkFile();
    try {
        const data = fs.readFileSync(afkFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[ERROR] Error reading AFK data:', error);
        return {};
    }
}

/**
 * Writes data to the AFK file.
 * @param {Object} data - The data to write.
 */
export function writeAfkData(data) {
    ensureAfkFile();
    try {
        fs.writeFileSync(afkFilePath, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error('[ERROR] Error writing AFK data:', error);
    }
}
