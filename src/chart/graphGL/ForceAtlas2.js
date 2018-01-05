import Texture2D from 'claygl/src/Texture2D';
import Texture from 'claygl/src/Texture';
import workerFunc from './forceAtlas2Worker.js';
var workerUrl = workerFunc.toString();
workerUrl = workerUrl.slice(workerUrl.indexOf('{') + 1, workerUrl.lastIndexOf('}'));

var defaultConfigs = {

    barnesHutOptimize: true,
    barnesHutTheta: 1.5,

    repulsionByDegree: true,
    linLogMode: false,

    strongGravityMode: false,
    gravity: 1.0,

    scaling: 1.0,

    edgeWeightInfluence: 1.0,

    jitterTolerence: 0.1,

    preventOverlap: false,

    dissuadeHubs: false,

    gravityCenter: null
};

var ForceAtlas2 = function (options) {

    for (var name in defaultConfigs) {
        this[name] = defaultConfigs[name];
    }

    if (options) {
        for (var name in options) {
            this[name] = options[name];
        }
    }

    this._nodes = [];
    this._edges = [];

    this._disposed = false;

    this._positionTex = new Texture2D({
        type: Texture.FLOAT,
        flipY: false,
        minFilter: Texture.NEAREST,
        magFilter: Texture.NEAREST
    });
};

ForceAtlas2.prototype.initData = function (nodes, edges) {

    var bb = new Blob([workerUrl]);
    var blobURL = window.URL.createObjectURL(bb);

    this._worker = new Worker(blobURL);

    this._worker.onmessage = this._$onupdate.bind(this);

    this._nodes = nodes;
    this._edges = edges;
    this._frame = 0;

    var nNodes = nodes.length;
    var nEdges = edges.length;

    var positionArr = new Float32Array(nNodes * 2);
    var massArr = new Float32Array(nNodes);
    var sizeArr = new Float32Array(nNodes);

    var edgeArr = new Float32Array(nEdges * 2);
    var edgeWeightArr = new Float32Array(nEdges);

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];

        positionArr[i * 2] = node.x;
        positionArr[i * 2 + 1] = node.y;

        massArr[i] = node.mass == null ? 1 : node.mass;
        sizeArr[i] = node.size == null ? 1 : node.size;
    }

    for (var i = 0; i < edges.length; i++) {
        var edge = edges[i];

        var source = edge.node1;
        var target = edge.node2;

        edgeArr[i * 2] = source;
        edgeArr[i * 2 + 1] = target;

        edgeWeightArr[i] = edge.weight == null ? 1 : edge.weight;
    }


    var textureWidth = Math.ceil(Math.sqrt(nodes.length));
    var textureHeight = textureWidth;
    var pixels = new Float32Array(textureWidth * textureHeight * 4);
    var positionTex = this._positionTex;
    positionTex.width = textureWidth;
    positionTex.height = textureHeight;
    positionTex.pixels = pixels;

    this._worker.postMessage({
        cmd: 'init',
        nodesPosition: positionArr,
        nodesMass: massArr,
        nodesSize: sizeArr,
        edges: edgeArr,
        edgesWeight: edgeWeightArr
    });

    this._globalSpeed = Infinity;
};

ForceAtlas2.prototype.updateOption = function (options) {
    var config = {};
    // Default config
    for (var name in defaultConfigs) {
        config[name] = defaultConfigs[name];
    }

    var nodes = this._nodes;
    var edges = this._edges;

    // Config according to data scale
    var nNodes = nodes.length;
    if (nNodes > 50000) {
        config.jitterTolerence = 10;
    }
    else if (nNodes > 5000) {
        config.jitterTolerence = 1;
    }
    else {
        config.jitterTolerence = 0.1;
    }

    if (nNodes > 100) {
        config.scaling = 2.0;
    }
    else {
        config.scaling = 10.0;
    }
    if (nNodes > 1000) {
        config.barnesHutOptimize = true;
    }
    else {
        config.barnesHutOptimize = false;
    }

    if (options) {
        for (var name in defaultConfigs) {
            if (options[name] != null) {
                config[name] = options[name];
            }
        }
    }

    if (!config.gravityCenter) {
        var min = [Infinity, Infinity];
        var max = [-Infinity, -Infinity];
        for (var i = 0; i < nodes.length; i++) {
            min[0] = Math.min(nodes[i].x, min[0]);
            min[1] = Math.min(nodes[i].y, min[1]);
            max[0] = Math.max(nodes[i].x, max[0]);
            max[1] = Math.max(nodes[i].y, max[1]);
        }

        config.gravityCenter = [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5];
    }

    // Update inDegree, outDegree
    for (var i = 0; i < edges.length; i++) {
        var node1 = edges[i].node1;
        var node2 = edges[i].node2;

        nodes[node1].degree = (nodes[node1].degree || 0) + 1;
        nodes[node2].degree = (nodes[node2].degree || 0) + 1;
    }

    if (this._worker) {
        this._worker.postMessage({
            cmd: 'updateConfig',
            config: config
        });
    }
};

// Steps per call, to keep sync with rendering
ForceAtlas2.prototype.update = function (renderer, steps, cb) {
    if (steps == null) {
        steps = 1;
    }
    steps = Math.max(steps, 1);

    this._frame += steps;
    this._onupdate = cb;

    if (this._worker) {
        this._worker.postMessage({
            cmd: 'update',
            steps: Math.round(steps)
        });
    }
};

ForceAtlas2.prototype._$onupdate = function (e) {
    // Incase the worker keep postMessage of last frame after it is disposed
    if (this._disposed) {
        return;
    }

    var positionArr = new Float32Array(e.data.buffer);
    this._globalSpeed = e.data.globalSpeed;

    this._positionArr = positionArr;

    this._updateTexture(positionArr);

    this._onupdate && this._onupdate();
};

ForceAtlas2.prototype.getNodePositionTexture = function () {
    return this._positionTex;
};

ForceAtlas2.prototype.getNodeUV = function (nodeIndex, uv) {
    uv = uv || [];
    var textureWidth = this._positionTex.width;
    var textureHeight = this._positionTex.height;
    uv[0] = (nodeIndex % textureWidth) / (textureWidth - 1);
    uv[1] = Math.floor(nodeIndex / textureWidth) / (textureHeight - 1);
    return uv;
};

ForceAtlas2.prototype.getNodes = function () {
    return this._nodes;
};
ForceAtlas2.prototype.getEdges = function () {
    return this._edges;
};
ForceAtlas2.prototype.isFinished = function (maxSteps) {
    return this._frame > maxSteps;
};

ForceAtlas2.prototype.getNodePosition = function (renderer, out) {
    if (!out) {
        out = new Float32Array(this._nodes.length * 2);
    }
    if (this._positionArr) {
        for (var i = 0; i < this._positionArr.length; i++) {
            out[i] = this._positionArr[i];
        }
    }
    return out;
};

ForceAtlas2.prototype._updateTexture = function (positionArr) {
    var pixels = this._positionTex.pixels;
    var offset = 0;
    for (var i = 0; i < positionArr.length;){
        pixels[offset++] = positionArr[i++];
        pixels[offset++] = positionArr[i++];
        pixels[offset++] = 1;
        pixels[offset++] = 1;
    }
    this._positionTex.dirty();
};

ForceAtlas2.prototype.dispose = function (renderer) {
    this._disposed = true;
    this._worker = null;
};

export default ForceAtlas2;