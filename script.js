let width = window.innerWidth - 50;
let height = window.innerHeight - 150;
const svg = d3.select("svg")
    .attr("width", width)
    .attr("height", height);
const typeColor = d3.scaleOrdinal()
    .domain([1, 2, 3, 4, 6])
    .range(d3.schemeCategory10);
let graphData = { nodes: [], links: [] };
let subjects = new Map();
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip");
const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", zoomed);
function zoomed(event) {
    container.attr("transform", event.transform);
}
svg.call(zoom);
const container = svg.append("g");
window.addEventListener("resize", resizeSvg);
function resizeSvg() {
    width = window.innerWidth;
    height = window.innerHeight;
    svg.attr("width", width).attr("height", height);
    simulation.force("center", d3.forceCenter(width / 2, height / 2));
    simulation.alpha(1).restart();
}
document.getElementById('loading').style.display = 'none';
function loadJSONLines(file, callback) {
    document.getElementById('loading').style.display = 'flex';
    d3.text(file).then(data => {
        const lines = data.split('\n').filter(line => line.trim() !== '');
        const jsonData = lines.map(line => JSON.parse(line));
        document.getElementById('loading').style.display = 'none';
        callback(jsonData);
    });
}
function drawGraph() {
    const subjectId = document.getElementById('subjectIdInput').value;
    if (!subjectId) return;
    loadJSONLines('/subject-relations.jsonlines', data => {
        graphData = buildGraphData(data, parseInt(subjectId));
        updateGraph();
    });
}
function buildGraphData(data, subjectId) {
    const nodes = new Map();
    const links = [];
    data.forEach(d => {
        if (d.subject_id === subjectId || d.related_subject_id === subjectId) {
            if (!nodes.has(d.subject_id)) {
                nodes.set(d.subject_id, { id: d.subject_id });
            }
            if (!nodes.has(d.related_subject_id)) {
                nodes.set(d.related_subject_id, { id: d.related_subject_id });
            }
            links.push({ source: d.subject_id, target: d.related_subject_id, type: d.relation_type });
        }
    });
    return { nodes: Array.from(nodes.values()), links };
}
function updateGraph() {
    container.selectAll("*").remove();
    const link = container.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(graphData.links)
        .enter().append("line")
        .attr("class", d => `link type-${d.type}`)
        .attr("stroke-width", 2);
    const node = container.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(graphData.nodes)
        .enter().append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("dblclick", (event, d) => {expandNode(d.id)})
        .on("click", (event, d) => {
            showNodeInfo(d.id, event.pageX, event.pageY);
        })        
        .on("mouseover", (event, d) => {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(subjects.get(d.id)?.name || d.id)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    node.append("circle")
        .attr("r", 10)
        .attr("fill", d => {
            const type = subjects.get(d.id)?.type;
            return type !== undefined ? typeColor(type) : '#000';
        });
    node.append("text")
        .attr("dy", 4)
        .attr("x", d => 15)
        .style("text-anchor", "middle")
        .style("font-size", "8px")
        .text(d => subjects.get(d.id)?.name || d.id)
        .on("mouseover", function() {
            d3.select(this).style("font-size", "16px");
        })
        .on("mouseout", function() {
            d3.select(this).style("font-size", "8px");
        });
    simulation.nodes(graphData.nodes);
    simulation.force("link").links(graphData.links);
    simulation.alpha(1).restart();
}
function expandNode(subjectId) {
    loadJSONLines('/subject-relations.jsonlines', data => {
        const newGraphData = buildGraphData(data, subjectId);
        const existingNodeMap = new Map(graphData.nodes.map(node => [node.id, node]));
        newGraphData.nodes.forEach(node => {
            if (!existingNodeMap.has(node.id)) {
                existingNodeMap.set(node.id, node);
            }
        });
        const newLinks = [...graphData.links];
        newGraphData.links.forEach(link => {
            if (!newLinks.some(l => (l.source.id === link.source && l.target.id === link.target) || (l.source.id === link.target && l.target.id === link.source))) {
                newLinks.push(link);
            }
        });
        graphData = { nodes: Array.from(existingNodeMap.values()), links: newLinks };
        updateGraph();
    });
}
loadJSONLines('/subject.jsonlines', data => {
    data.forEach(d => {
        subjects.set(d.id, d);
    });
});
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .on("tick", () => {
        container.selectAll(".links line")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        container.selectAll(".nodes g")
            .attr("transform", d => `translate(${d.x}, ${d.y})`);
    });
function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}
function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}
function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}
function showNodeInfo(nodeId, mouseX, mouseY) {
    const nodeInfo = subjects.get(nodeId);
    if (nodeInfo) {
        tooltip.transition()
            .duration(200)
            .style("opacity", .9);
        tooltip.html(`${nodeInfo.id} | ${nodeInfo.name} | ${nodeInfo.name_cn}`)
            .style("left", (mouseX + 5) + "px")
            .style("top", (mouseY - 28) + "px");
    }
}