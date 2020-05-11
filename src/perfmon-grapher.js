const fs = require('fs');
const unzip = require('unzip-stream');
const path = require('path');
const template = require('./template');

class PerfmonGrapher {

    constructor(filePath) {
        this.filePath = filePath;
    }

    async getOverviewGraph(interactive = false) {
        const dataStructures = [];

        const file = fs.createReadStream(this.filePath);

        const collectingData = [];

        const readingEntries = new Promise((resolve) => {
            file.pipe(unzip.Parse())
            .on('entry', (entry) => {
                const entryPromise = new Promise((resolve => {
                    const fileName = entry.path;
                    const data = [];

                    entry.on("data", (chunk) => {
                        data.push(chunk);
                    }).on("end", () => {
                        const result = JSON.parse(data.join("")).log;
                        dataStructures.push({
                            file: fileName,
                            useCase: result.useCase,
                            start: new Date(new Date(result.timestamp).getTime() - result.duration),
                            end: new Date(result.timestamp)
                        });
                        resolve();
                    });
                }));
                collectingData.push(entryPromise);
            })
            .on("close", () => {
                resolve();
            });
        });
        await readingEntries;
        await Promise.all(collectingData);

        // graph width
        const pixelsPerSecond = 200;
        dataStructures.sort((ds1, ds2) => ds1.start.getTime() - ds2.start.getTime());
        const start = dataStructures[0].start.getTime();
        let end = 0;
        for (const dataStructure of dataStructures) {
            end = Math.max(end, dataStructure.end.getTime());
        }
        const width = pixelsPerSecond * ((end - start) / 1000);

        const filename = path.basename(this.filePath);

        return template({ filename, interactive, width, dataStructures });
    }

    async getDetailGraphStructure(perfmonFilePath) {
        const file = fs.createReadStream(this.filePath);

        const detailData = new Promise((resolve => {
            file.pipe(unzip.Parse())
            .on('entry', (entry) => {
                if (perfmonFilePath === entry.path) {
                    const data = [];
                    entry.on("data", (chunk) => {
                       data.push(chunk);
                    }).on("end", () =>{
                        resolve(data.join(""));
                    });
                } else {
                    entry.autodrain();
                }
            });
        }));

        return await detailData;
    }
}

module.exports = PerfmonGrapher;