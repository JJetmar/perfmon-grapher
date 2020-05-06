const fs = require('fs');
const path = require('path');
const unzip = require('unzip-stream');

module.exports = async (perfMonLogZipFilePath) => {
    const dataStructure = [];

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
                        dataStructure.push({
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
    
        dataTable.addRows([${dataStructure.map( ds => `["${ds.useCase}", "${ds.file}", new Date("${ds.start.toISOString()}"), new Date("${ds.end.toISOString()}")]`).join(",")}]);
    
        chart.draw(dataTable, { timeline: { showBarLabels: false, colorByRowLabel: true } });
      }
    </script>
    <div id="perfmon-timeline" style="height: 100%; width: 600%"></div>
    `);
    return { resultPath };
};