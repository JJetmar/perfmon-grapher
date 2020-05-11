module.exports = ({filename, interactive, width, dataStructures}) => `
<html lang="en">
  <head>
    <title>${filename} - Perfmon Grapher</title>
  </head>
  <body>
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <script src="https://code.jquery.com/jquery-3.4.1.min.js"></script>
${interactive ? `
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css">
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/js/bootstrap.min.js"></script>
    <style type="text/css">   
#perfmon-timeline svg g:nth-of-type(3) rect,
#perfmon-timeline svg g:nth-of-type(5) rect {
  cursor: zoom-in
}
.tab-content>.tab-pane {
    display: block!important;
    position: fixed;
    left: -9999999px;
    top: -9999999px;
}
.tab-content>.active {
    display: block;
    position: relative;
    left: 0;
    top: 0;
}
    </style>
` : ""}
    <script type="text/javascript">
      const $ = jQuery;

      google.charts.load("current", {packages:["timeline"]});
      google.charts.setOnLoadCallback(drawChart);
      function drawChart() {
        const container = document.getElementById('perfmon-timeline');
        const chart = new google.visualization.Timeline(container);                
        const dataTable = new google.visualization.DataTable();
    
        dataTable.addColumn({ type: 'string', id: 'UseCase' });
        dataTable.addColumn({ type: 'string', id: 'File' });
        dataTable.addColumn({ type: 'date', id: 'Start' });
        dataTable.addColumn({ type: 'date', id: 'End' });
    
        dataTable.addRows([${dataStructures.map(
    ds => `["${ds.useCase}", "${ds.file}", new Date("${ds.start.toISOString()}"), new Date("${ds.end.toISOString()}")]`).join(
    ",")}]);

    ${interactive ? `
      // Transform data for detail visualization
      const transformToDetail = (data) => {
        const rootDatetime = new Date(data.log.timestamp);
        const graphData = [];
        
        let monitorStack =  [data.log.log];
        
        while (monitorStack.length > 0) {
          const monitor = monitorStack.shift();
          const monitorStart = monitor.start || rootDatetime;
          const monitorEnd = monitor.end || new Date(monitorStart.getTime() + monitor.duration);
          const monitorLevel = monitor.level || 0;
        
          graphData.push([monitorLevel === 0 ? "Root" : \`level \${monitorLevel}\`, \`\${monitor.name} (\${monitor.group})\`, new Date(monitorStart.toISOString()), new Date(monitorEnd.toISOString())]);

          const monitorItems = monitor.items ? monitor.items.filter(i => i.duration > 0) : [];

          if (monitorItems.length > 0) {
            const accChildrenTime = monitorItems.reduce((acc, i) => acc + i.duration, 0);
            const emptySpaceTime = (monitor.duration - accChildrenTime) / (monitorItems.length + 1);
        
            let lastEndTime = new Date(monitorStart.getTime() + emptySpaceTime);
            const childLevel = monitorLevel + 1;
            if (emptySpaceTime > 0) {
              monitorStack.push({ level: childLevel, name: "Not measured", group: "UNKNOWN", start: monitorStart, end: lastEndTime});
            }
            for (const item of monitorItems) {
              item.level = childLevel;
              item.start = lastEndTime;
              lastEndTime = new Date(lastEndTime.getTime() + item.duration);
              item.end = lastEndTime;
              monitorStack.push(item);
        
              if (emptySpaceTime > 0) {
                lastEndTime = new Date(lastEndTime.getTime() + emptySpaceTime);
                monitorStack.push({level: childLevel, name: "Not measured", group: "UNKNOWN", start: new Date(item.end), end: new Date(lastEndTime)});
              }
            }
          }
        }
        return graphData;
      };
      
      // Detail visualization
      google.visualization.events.addListener(chart, 'select', () => {

        if ($(chart).data("disableSelect")) {
          return;
        }
        
        $(".google-visualization-tooltip").remove();
        
        const selection = chart.getSelection();

        if (selection.length > 0) {
          // Disable selection and avoid recursion
          $(chart).data("disableSelect", true);
          setTimeout(() => {
            $(chart).data("disableSelect", false);
          }, 500);
          chart.setSelection([]);
          
          const filename = dataTable.getValue(selection[0].row, 1);
          $('#detail-title').text(filename);
          $('#modal').modal({show:true});
          $.get("/" + filename, (data) => {
            $('#json').html(JSON.stringify(data, null, 2));
            const container = document.getElementById('graph-detail');
            const chart = new google.visualization.Timeline(container);                
            const dataTable = new google.visualization.DataTable();
        
            dataTable.addColumn({ type: 'string', id: 'UseCase' });
            dataTable.addColumn({ type: 'string', id: 'Measurement' });
            dataTable.addColumn({ type: 'date', id: 'Start' });
            dataTable.addColumn({ type: 'date', id: 'End' });
        
            dataTable.addRows(transformToDetail(data));

            // Draw Graph with small height
            chart.draw(dataTable, {
              height: 20,
              timeline: {
                showBarLabels: false
              },
              hAxis: {
                format: 'HH:mm:ss'
              },
            });
            let height = 0;
            
            // Get expected height of graph
            $('#graph-detail svg').each(function(el) {
                const svgHeight = $('#graph-detail svg')[el].getAttribute("height");
                height = Math.max(height, svgHeight);
            });

            const pixelsPerSecond = 500;
            const graphDetailWidth = Math.max((data.log.duration / 1000) * pixelsPerSecond, $('.tab-content').innerWidth());

            // Redraw graph with expected height
            chart.draw(dataTable, {
              height: height + 80,
              width: graphDetailWidth, 
              timeline: {
                showBarLabels: false
              },
              hAxis: {
                format: 'HH:mm:ss'
              },
            }, "test");
          }, "json");
        }
      });
    ` : ""};
      
    chart.draw(dataTable, {
      timeline: { showBarLabels: false, colorByRowLabel: true, barLabelStyle: { fontSize: 6 } },
      hAxis: { format: 'HH:mm:ss' },
    });
    
    const SVG_NS = "http://www.w3.org/2000/svg";

    let $hoverLines = $('#perfmon-timeline svg:eq(1) g#hover-lines');
    
    if ($hoverLines.length === 0) {
      $('#perfmon-timeline svg:eq(1)').append($(document.createElementNS(SVG_NS, "g")).attr({
        id: "hover-lines"
      }));
      $hoverLines = $('#perfmon-timeline svg:eq(1) g#hover-lines');
    }

    $('#perfmon-timeline svg:eq(1) g').each((index, el) => {
      const $group = $(el);
      
      if (index === 2) {
        $group.on("mouseenter", (ev) => {
          const $bar = $(ev.target);
          if (ev.target.tagName === "rect") {
                                $hoverLines.children().remove();

            const $barRow = $('#perfmon-timeline svg:eq(1) g:eq(0) rect').filter((index, el) => {
              const $row = $(el);
              return parseFloat($row.attr("y")) < parseFloat($bar.attr("y")) && parseFloat($row.attr("y")) + parseFloat($row.attr("height")) > parseFloat($bar.attr("y")) + parseFloat($bar.attr("height"));
            }).eq(0);
            
            const $collisionBars = $bar.parent().children("rect").filter((index, el) => {
              const $iBar = $(el);
              return index !== 0
                && parseFloat($iBar.attr("y")) > parseFloat($barRow.attr("y"))
                && parseFloat($iBar.attr("y")) < parseFloat($bar.attr("y"))
                && parseFloat($iBar.attr("x")) <= parseFloat($bar.attr("x"))
                && parseFloat($iBar.attr("x")) + parseFloat($iBar.attr("width")) > parseFloat($bar.attr("x"));
            });
            
            if ($collisionBars.length === 0) return;
            
            const barLeftMiddle = [parseFloat($bar.attr("x")), parseFloat($bar.attr("y")) + parseFloat($bar.attr("height")) / 2];
            const rowTop = [parseFloat($bar.attr("x")) - 50, parseFloat($barRow.attr("y"))];
            
            const $linePath = $(document.createElementNS(SVG_NS, "path")).attr({
                "d": \`M\${barLeftMiddle[0] - 5},\${barLeftMiddle[1]}L\${rowTop[0]},\${barLeftMiddle[1]}L\${rowTop[0]},\${rowTop[1]}\`,
                "stroke": "#bbb",
                "stroke-width": "1.2",
                "fill": "none",
                "stroke-dasharray": "2 2"
              }
            );
            
            const $linePathBackground = $linePath.clone().attr({
                "d": \`M\${barLeftMiddle[0] - 5},\${barLeftMiddle[1]}L\${rowTop[0]},\${barLeftMiddle[1]}L\${rowTop[0]},\${rowTop[1]}\`,
                "stroke": "#fff",
                "stroke-width": "3",
                "stroke-opacity": "0.5",
                "fill": "none",
                "stroke-dasharray": null
              }
            );
            
            const $text = $(document.createElementNS(SVG_NS, "text")).attr({ 
                "x": rowTop[0] + 7,
                "y": barLeftMiddle[1] - 7,
                "font-family": "Arial",
                "font-size": "13",
                "stroke":"none",
                "stroke-width": "0",
                "fill": "#000000"
            }).text($collisionBars.length + 1);
            
            $hoverLines.append($text);
            
            const $textBackground = $(document.createElementNS(SVG_NS, "rect")).attr({
                "x": rowTop[0],
                "y": barLeftMiddle[1] - $text[0].getBBox().height - 2 * 5,
                "width": $text[0].getBBox().width + 2 * 7,
                "height": $text[0].getBBox().height + 2 * 5,
                "stroke":"none",
                "fill": "#fff",
                "fill-opacity": "0.75"
            });
            
            $text.before($textBackground);
            
            $hoverLines
              .append($linePathBackground)
              .append($linePath)
          }
        });
      } else if (index === 4) {
        $group.on("mouseout", (ev) => {
          if (ev.target.tagName === "rect") {
            $hoverLines.children().remove();
          }
        });
      }
    })
  }
  </script>
  <div id="perfmon-timeline" style="min-height: 100%; width: ${width + "px"}"></div>
${interactive ? `
    <div class="modal fade " id="modal" tabindex="-1" role="dialog" aria-labelledby="chart-detail" aria-hidden="true">
      <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="detail-title"></h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <ul class="nav nav-tabs mb-3" role="tablist">
              <li class="nav-item">
                <a class="nav-link active" id="tree-graph-tab" data-toggle="tab" href="#detail-graph-panel" role="tab" aria-controls="detail-graph-panel" aria-selected="true">Detail graph</a>
              </li>
              <li class="nav-item">
                <a class="nav-link" id="json-tab" data-toggle="tab" href="#json-panel" role="tab" aria-controls="json-panel" aria-selected="false">JSON</a>
              </li>
            </ul>
            <div class="tab-content">
              <div class="tab-pane fade show active" id="detail-graph-panel" role="tabpanel" aria-labelledby="detail-graph-tab"><div style="overflow: auto"><div id="graph-detail" ></div></div></div>
              <div class="tab-pane fade" id="json-panel" role="tabpanel" aria-labelledby="json-tab"><pre><code id="json"></code></pre></div>
            </div>
            <div class="alert alert-primary mt-2" role="alert">
              There are currently missing data for start and end of each items. These are artificially calculated. Durations of items correspond to the real measurements.  
            </div>
          </div>
        </div>
      </div>
    </div>` : ""}
  </body>
</html>`;