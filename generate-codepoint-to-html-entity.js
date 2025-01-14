import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const LIST_URL = 'http://www.w3.org/2003/entities/2007/htmlmathml-f.ent';
const CACHE_FILE = '/tmp/generate-codepoint-to-html-entity-list-file';
const DEST_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), './src/components/react/codepoint-to-html-entity.json');

const entityRegex = /<!ENTITY (\w+)\s+?"(.+)"/g;
const canUseCache = fs.existsSync('/tmp'); // yh, I am lazy

async function downloadList() {
    return new Promise((resolve, reject) => {
        http.get(LIST_URL, (response) => {
            if (response.statusCode !== 200) {
                reject(`Failed to download the list with HTTP code: ${response.statusCode}`);
            }

            let data = '';
            response.on('data', (chunk) => data += chunk);
            response.on('end', () => resolve(data));
        }).on('error', (err) => reject(err));
    });
}

(async () => { //main
    /** @type {string} */
    let data;
    if (canUseCache) {
        if (fs.existsSync(CACHE_FILE)) {
            console.debug(`Found cached file: ${CACHE_FILE}`);
            data = fs.readFileSync(CACHE_FILE, {encoding: 'utf-8'});
        } else {
            console.debug(`Failed to load cache, downloading`);
            data = await downloadList();
            fs.writeFileSync(CACHE_FILE, data);
            console.debug(`Downloaded ${data.length} long list.`);
        }
    } else {
        console.debug("Cannot use cache, downloading list.");
        data = await downloadList();
        console.debug(`Downloaded ${data.length} long list.`);
    }

    /** @type {Record<number, string[]>} */
    const found = {};
    const matches = data.matchAll(entityRegex);
    for (const match of matches) {
        const codepoints = match[2]
            .split(';')
            .map(x => x.trim())
            .filter(x => x !== '')
            .map(codepoint_str => {
                let codepoint = -1;

                if (codepoint_str === '') return codepoint;
                if (!codepoint_str.startsWith('&#')) {
                    console.debug(`found unrecognised codepoint representation - ${match[1]}: ${codepoint_str}`);
                    return codepoint;
                }

                try {
                    codepoint = parseInt(codepoint_str.substring(3), codepoint_str[2] == 'x' ? 16 : 10);
                } catch {
                    console.error(`Could not parse the codepoint from "${codepoint_str}"`);
                }
                return codepoint;
            })
            .filter(x => x !== -1)
            .reduce((unique, item) => (unique.includes(item) ? unique : [...unique, item]), [])
            .map(x => parseInt(x, 10))
        ;

        if (codepoints.length >= 2) {
            console.debug(`Found ${codepoints.length}-codepoint long entity (${match[1]}), skipping`);
            continue;
        }

        const codepoint = codepoints[0];
        if (!found[codepoint]) found[codepoint] = [];
        found[codepoint].push(match[1]);
    }

    // Manually fix amp and lt, since their declaration is a bit weird
    delete found[8];
    found[38] = ['AMP', 'amp'];
    found[60] = ['LT', 'lt'];

    const json = {
        "#": `Generated on '${(new Date()).toUTCString()}' from '${LIST_URL}'`,
        data: found,
    };
    fs.writeFileSync(DEST_FILE, JSON.stringify(json));
})();