import echarts from 'echarts/lib/echarts';
import Graph from 'echarts/lib/data/Graph';
import linkList from 'echarts/lib/data/helper/linkList';
import retrieve from '../../util/retrieve';

export default function (nodes, edges, hostModel, directed, beforeLink) {
    var graph = new Graph(directed);
    for (var i = 0; i < nodes.length; i++) {
        graph.addNode(retrieve.firstNotNull(
            // Id, name, dataIndex
            nodes[i].id, nodes[i].name, i
        ), i);
    }

    var linkNameList = [];
    var validEdges = [];
    var linkCount = 0;
    for (var i = 0; i < edges.length; i++) {
        var link = edges[i];
        var source = link.source;
        var target = link.target;
        // addEdge may fail when source or target not exists
        if (graph.addEdge(source, target, linkCount)) {
            validEdges.push(link);
            linkNameList.push(retrieve.firstNotNull(link.id, source + ' > ' + target));
            linkCount++;
        }
    }

    var nodeData;

    // FIXME, support more coordinate systems.
    var dimensionNames = echarts.helper.completeDimensions(
        ['value'], nodes
    );
    nodeData = new echarts.List(dimensionNames, hostModel);
    nodeData.initData(nodes);

    var edgeData = new echarts.List(['value'], hostModel);
    edgeData.initData(validEdges, linkNameList);

    beforeLink && beforeLink(nodeData, edgeData);

    linkList({
        mainData: nodeData,
        struct: graph,
        structAttr: 'graph',
        datas: {node: nodeData, edge: edgeData},
        datasAttr: {node: 'data', edge: 'edgeData'}
    });

    // Update dataIndex of nodes and edges because invalid edge may be removed
    graph.update();

    return graph;
};