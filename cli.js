#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const PerfMonGrapher = require("./perfmon-grapher");

(async () => {
    const perfMonLogZipFilePath = process.argv[2];

    if (!process.argv[2]) {
        console.log("You need to specify a path to a perfMon zip file...");
        process.exit(1);
    }

    const filePath = path.resolve(perfMonLogZipFilePath);

    if (!fs.existsSync(filePath)) {
        console.log(`File: ${perfMonLogZipFilePath} does not exist`);
        process.exit(1);
    }

    await PerfMonGrapher(filePath);
    
    console.log("Generating graph file finished.");
})();