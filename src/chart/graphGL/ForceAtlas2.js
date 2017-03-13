var workerUrl = require('text!./forceAtlas2Worker.js');

var defaultConfigs = {

    barnesHutOptimize: true,
    barnesHutTheta: 1.5,

    autoSettings: true,

    repulsionByDegree: true,
    linLogMode: false,

    strongGravityMode: false,
    gravity: 1.0,

    scaling: 1.0,

    edgeWeightInfluence: 1.0,

    jitterTolerence: 0.1,

    preventOverlap: false,

    dissuadeHubs: false

};

var ForceAtlas2 = function(options) {

    this.onupdate = function() {};

    for (var name in defaultConfigs) {
        this[name] = defaultConfigs[name];
    }

    if (options) {
        for (var name in options) {
            this[name] = options[name];
        }
    }

    this.nodes = [];
    this.edges = [];

    this.nodesMap = {};

    this._disposed = false;
}

ForceAtlas2.prototype.addNode = function(node) {
    if (node.id) {
        if (this.nodesMap[node.id]) {
            return;
        }
        this.nodesMap[node.id] = node;
    }
    this.nodes.push(node);
}

ForceAtlas2.prototype.addEdge = function(edge) {
    this.edges.push(edge);
}

ForceAtlas2.prototype.init = function() {

    this._worker = new Worker(workerUrl);

    this._worker.onmessage = this._$onupdate.bind(this);

    var nNodes = this.nodes.length;
    var nEdges = this.edges.length;

    var positionArr = new Float32Array(nNodes * 2);
    var massArr = new Float32Array(nNodes);
    var sizeArr = new Float32Array(nNodes);

    var edgeArr = new Float32Array(nEdges * 2);
    var edgeWeightArr = new Float32Array(nEdges);

    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        node.__fidx__ = i;

        positionArr[i * 2] = node.position[0];
        positionArr[i * 2 + 1] = node.position[1];

        massArr[i] = typeof(node.mass) == 'undefined' ? 1 : node.mass;
        sizeArr[i] = typeof(node.size) == 'undefined' ? 1 : node.size;
    }

    for (var i = 0; i < this.edges.length; i++) {
        var edge = this.edges[i];

        var source, target;
        if (typeof(edge.source) == 'string') {
            source = this.nodesMap[edge.source];
            target = this.nodesMap[edge.target];
        } else {
            source = edge.source;
            target = edge.target;
        }

        if (!source) {
            console.warn('Source "' + edge.source + '" of edge not exists in group');
            continue;
        }
        if (!target) {
            console.warn('Target "' + edge.target + '" of edge not exists in group');
            continue;
        }

        edgeArr[i * 2] = source.__fidx__;
        edgeArr[i * 2 + 1] = target.__fidx__;

        edgeWeightArr[i] = typeof(edge.weight) == 'undefined' ? 1.1 : edge.weight;
    }

    this._worker.postMessage({
        cmd: "init",
        nodesPosition: positionArr,
        nodesMass: massArr,
        nodesSize: sizeArr,
        edges: edgeArr,
        edgesWeight: edgeWeightArr
    });

    this.updateConfig();
}

ForceAtlas2.prototype.updateConfig = function() {
    var config = {};
    for (var name in defaultConfigs) {
        config[name] = this[name];
    }

    if (this._worker) {
        this._worker.postMessage({
            cmd: 'updateConfig',
            config: config
        });
    }
}

// Steps per call, to keep sync with rendering
ForceAtlas2.prototype.update = function(steps) {
    if (typeof(steps) == 'undefined') {
        steps = 1;
    } else {
        steps = Math.max(steps, 1);
    }
    if (this._worker) {
        this._worker.postMessage({
            cmd: 'update',
            steps: Math.round(steps)
        });
    }
}

ForceAtlas2.prototype._$onupdate = function(e) {
    // Incase the worker keep postMessage of last frame after it is disposed
    if (this._disposed) {
        return;
    }
    var positionArr = new Float32Array(e.data);
    var nNodes = positionArr.length / 2;
    for (var i = 0; i < nNodes; i++) {
        var node = this.nodes[i];
        node.position[0] = positionArr[i * 2];
        node.position[1] = positionArr[i * 2 + 1];
    }

    this.onupdate(this.nodes, this.edges);
}

ForceAtlas2.prototype.dispose = function() {
    this._disposed = true;
    this._worker = null;
}

ForceAtlas2.Node = function(id, position, mass, size) {
    this.id = id;
    this.position = position;

    this.mass = typeof(mass) == 'undefined' ? 1 : mass;
    this.size = typeof(size) == 'undefined' ? 1 : size;
}

ForceAtlas2.Edge = function(sNode, tNode, weight) {
    this.source = sNode;
    this.target = tNode;

    this.weight = typeof(weight) == 'undefined' ? 1.1 : weight;
}

module.exports = ForceAtlas2;