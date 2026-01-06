const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const AdmZip = require('adm-zip');

class Updater {
    constructor() {
        this.updateUrl = 'https://github.com/lklynet/hypermind/archive/refs/heads/main.zip';
        this.versionUrl = 'https://raw.githubusercontent.com/lklynet/hypermind/main/package.json';
        this.notesUrl = 'https://raw.githubusercontent.com/lklynet/hypermind/main/public/updates.json';
        this.appDir = path.resolve(__dirname, '../..');
    }

    async getRemoteNotes() {
        return this.fetchJson(this.notesUrl);
    }

    async check() {
        try {
            const currentPkg = require('../../package.json');
            const remotePkg = await this.fetchJson(this.versionUrl);
            
            return {
                currentVersion: currentPkg.version,
                latestVersion: remotePkg.version,
                updateAvailable: this.compareVersions(remotePkg.version, currentPkg.version) > 0
            };
        } catch (error) {
            console.error('Update check failed:', error);
            throw error;
        }
    }

    async update() {
        console.log('Starting self-update...');
        const tempZip = path.join(this.appDir, 'update.zip');
        const tempDir = path.join(this.appDir, 'temp_update');

        try {
            // 1. Download Zip
            await this.downloadFile(this.updateUrl, tempZip);

            // 2. Extract
            const zip = new AdmZip(tempZip);
            zip.extractAllTo(tempDir, true);

            // 3. Move files
            const extractedRoot = fs.readdirSync(tempDir)[0];
            const sourceDir = path.join(tempDir, extractedRoot);

            this.copyRecursiveSync(sourceDir, this.appDir);

            // 4. Cleanup
            fs.unlinkSync(tempZip);
            fs.rmSync(tempDir, { recursive: true, force: true });

            // 5. Install dependencies
            await this.execCommand('npm install --omit=dev');

            console.log('Update completed successfully.');
            
            if (fs.existsSync('/.dockerenv')) {
                console.log('Docker environment detected. Restarting container...');
            } else {
                console.log('Manual environment detected. Application will stop.');
                console.log('Please restart the server manually to apply changes.');
            }
            
            // 6. Restart
            // In Docker, exiting causing a restart policy trigger.
            // In PM2, it restarts automatically.
            setTimeout(() => process.exit(0), 1000);

            return { success: true };
        } catch (error) {
            console.error('Update failed:', error);
            // Cleanup on fail
            if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
            if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
            throw error;
        }
    }

    fetchJson(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    downloadFile(url, dest) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            const request = https.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    file.close();
                    fs.unlinkSync(dest);
                    return this.downloadFile(response.headers.location, dest)
                        .then(resolve)
                        .catch(reject);
                }

                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(dest);
                    return reject(new Error(`Failed to download: ${response.statusCode}`));
                }

                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            });

            request.on('error', (err) => {
                file.close();
                if (fs.existsSync(dest)) fs.unlinkSync(dest);
                reject(err);
            });
        });
    }

    copyRecursiveSync(src, dest) {
        const exists = fs.existsSync(src);
        const stats = exists && fs.statSync(src);
        const isDirectory = exists && stats.isDirectory();

        if (isDirectory) {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest);
            fs.readdirSync(src).forEach((childItemName) => {
                this.copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    }

    execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, { cwd: this.appDir }, (error, stdout, stderr) => {
                if (error) {
                    console.warn(stderr);
                    // Don't reject strictly on stderr warnings
                }
                resolve(stdout);
            });
        });
    }

    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < 3; i++) {
            if (parts1[i] > parts2[i]) return 1;
            if (parts1[i] < parts2[i]) return -1;
        }
        return 0;
    }
}

module.exports = new Updater();
