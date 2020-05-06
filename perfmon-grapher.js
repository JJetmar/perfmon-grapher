const fs = require('fs');
const path = require('path');
const unzip = require('unzip-stream');

module.exports = async (perfMonLogZipFilePath) => {
    const dataStructures = [];

    const file = fs.createReadStream(perfMonLogZipFilePath);

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

    const resultPath = path.join(path.dirname(perfMonLogZipFilePath), path.basename(perfMonLogZipFilePath, '.zip') + ".html");

    // graph width
    const pixelsPerSecond = 200;
    dataStructures.sort((ds1, ds2) => ds1.start.getTime() - ds2.start.getTime());
    const start = dataStructures[0].start.getTime();
    let end = 0;
    for (const dataStructure of dataStructures) {
        end = Math.max(end, dataStructure.end.getTime());
    }
    const width = pixelsPerSecond * ((end - start) / 1000);

    fs.writeFileSync(resultPath, `
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <script type="text/javascript">
      google.charts.load("current", {packages:["timeline"]});
      google.charts.setOnLoadCallback(drawChart);
      function drawChart() {
        var container = document.getElementById('perfmon-timeline');
        var chart = new google.visualization.Timeline(container);
    
        var dataTable = new google.visualization.DataTable();
    
        dataTable.addColumn({ type: 'string', id: 'UseCase' });
        dataTable.addColumn({ type: 'string', id: 'File' });
        dataTable.addColumn({ type: 'date', id: 'Start' });
        dataTable.addColumn({ type: 'date', id: 'End' });
    
        dataTable.addRows([${dataStructures.map( ds => `["${ds.useCase}", "${ds.file}", new Date("${ds.start.toISOString()}"), new Date("${ds.end.toISOString()}")]`).join(",")}]);
    
        chart.draw(dataTable, { timeline: { showBarLabels: false, colorByRowLabel: true } });
      }
    </script>
    <div id="perfmon-timeline" style="height: 100%; width: ${width + "px"}"></div>
    `);
    return { resultPath };
};