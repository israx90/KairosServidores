const ftp = require("basic-ftp")
const fs = require('fs')
const path = require('path')

const config = {
    host: "ftpupload.net",
    user: "if0_41055875",
    password: "R65Lj914HSITA",
    secure: false, // InfinityFree uses plain FTP or explicit TLS
    connTimeout: 30000, // 30s timeout
    pasvTimeout: 30000,
    keepalive: 10000
}

async function deploy() {
    const client = new ftp.Client()
    // client.ftp.verbose = true // Reduce noise to see important logs

    const connect = async () => {
        try {
            console.log("Connecting to FTP...")
            await client.access(config)
            console.log("Connected!")
        } catch (err) {
            console.error("Connection failed:", err)
            // Wait and retry?
            await new Promise(r => setTimeout(r, 5000))
            await connect()
        }
    }

    const uploadFile = async (localPath, remotePath, attempts = 3) => {
        for (let i = 0; i < attempts; i++) {
            try {
                if (client.closed) await connect()

                console.log(`Uploading: ${path.basename(localPath)} -> ${remotePath}`)
                await client.uploadFrom(localPath, remotePath)
                return // Success
            } catch (err) {
                console.error(`Upload failed (Attempt ${i + 1}/${attempts}): ${err.message}`)
                client.close() // Force reconnect on next try
                await new Promise(r => setTimeout(r, 2000)) // Wait 2s
            }
        }
        throw new Error(`Failed to upload ${localPath} after ${attempts} attempts`)
    }

    const walkAndUpload = async (localDir, remoteDir) => {
        const items = fs.readdirSync(localDir)

        for (const item of items) {
            // Exclusions
            if (['node_modules', '.git', '.vscode', '.gemini', 'package.json', 'package-lock.json', 'deploy.js', '_backup_20260216'].includes(item)) continue

            const localItemPath = path.join(localDir, item)
            const remoteItemPath = `${remoteDir}/${item}`
            const stats = fs.statSync(localItemPath)

            if (stats.isDirectory()) {
                try {
                    if (client.closed) await connect()
                    await client.ensureDir(remoteItemPath)
                } catch (e) {
                    console.log(`Error creating dir ${remoteItemPath}, trying to continue...`)
                }
                await walkAndUpload(localItemPath, remoteItemPath)
            } else {
                await uploadFile(localItemPath, remoteItemPath)

                // Special case for index2.html
                if (item === 'index2.html') {
                    await uploadFile(localItemPath, '/htdocs/index.html')
                }
            }
        }
    }

    try {
        await connect()
        console.log("Starting Deployment...")
        await walkAndUpload(__dirname, "/htdocs")
        console.log("Deployment Complete! 🚀")
    } catch (err) {
        console.error("Fatal Error during deployment:", err)
    } finally {
        client.close()
    }
}

deploy()
