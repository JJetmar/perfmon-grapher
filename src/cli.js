#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const PerfmonGrapher = require("./perfmon-grapher");
const yargs = require('yargs');
const opener = require('opener');

(async () => {
    const arguments = yargs.command('$0').argv;
    delete arguments['$0'];

    const options = {
        run: !!arguments["r"],
        interactive: !!arguments["i"],
        inputFile: Object.values(arguments).find(
            value => typeof value === "string")
    };

    const perfmonLogZipFilePath = options.inputFile;

    if (!perfmonLogZipFilePath) {
        console.log("You need to specify a path to a permMon zip file...");
        process.exit(1);
    }

    const filePath = path.resolve(perfmonLogZipFilePath);

    if (!fs.existsSync(filePath)) {
        console.log(`File: ${filePath} does not exist.`);
        process.exit(1);
    }

    const perfmonGrapher = new PerfmonGrapher(filePath);
    const graphWebpage = await perfmonGrapher.getOverviewGraph(options.interactive);

    const generateRandomPort = () => (49152 + Math.floor((65535 - 49152) * Math.random()));

    let port = process.env.port || generateRandomPort();
    let runUri;

    if (options.interactive) {
        const Koa = require("koa");
        const app = new Koa();

        app.use(async ctx => {
            const filename = ctx.url.substr(1);
            if (filename === "") {
                ctx.body = graphWebpage;
            } else {
                ctx.body = await perfmonGrapher.getDetailGraphStructure(filename);
            }
        });

        let repeat = true;
        do {
            try {
                app.listen(port);
                repeat = false
            } catch (e) {
                if (process.env.port === port) {
                    console.error(`Port ${port} seem to be already in use`, e);
                    process.exit(1);
                } else {
                    const newPort = generateRandomPort();
                    console.warn(`Port ${port} seem to be already in use. Trying new port ${newPort}...`)
                    port = newPort;
                }
            }
        } while(repeat);

        runUri = `http://localhost:${port}`;

        console.log(`Interactive perfmon graph available on ${runUri} .`);
    } else {
        const resultPath = path.join(path.dirname(perfmonLogZipFilePath), path.basename(perfmonLogZipFilePath, '.zip') + ".html");
        fs.writeFileSync(resultPath, graphWebpage);
        runUri = `file://${resultPath}`;
        console.log(`Generating graph file finished. (${resultPath}).`);
    }

    if (options.run) {
        opener(runUri);
        console.log(`Running ${runUri} in a web browser...`);
    }

    if (options.interactive) {
        console.log(`Press Ctrl+C to finish interactive mode.`);
        const infinitePromise = new Promise(() => {});
        await infinitePromise;
    }
})();