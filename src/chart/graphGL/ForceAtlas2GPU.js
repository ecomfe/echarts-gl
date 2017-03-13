var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var Pass = require('qtek/lib/compositor/Pass');
var FrameBuffer = require('qtek/lib/FrameBuffer');

graphicGL.Shader.import(require('text!./forceAtlas2.glsl'));

var defaultConfigs = {
    autoSettings: true,

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

function ForceAtlas2GPU(options) {

    for (var name in defaultConfigs) {
        this[name] = defaultConfigs[name];
    }

    if (options) {
        for (var name in options) {
            this[name] = options[name];
        }
    }

    var textureOpt = {
        type: graphicGL.Texture.FLOAT,
        minFilter: graphicGL.Texture.NEAREST,
        magFilter: graphicGL.Texture.NEAREST
    };

    this._positionSourceTex = new graphicGL.Texture2D(textureOpt);
    this._positionSourceTex.flipY = false;

    this._positionTex = new graphicGL.Texture2D(textureOpt);
    this._positionPrevTex = new graphicGL.Texture2D(textureOpt);
    this._forceTex = new graphicGL.Texture2D(textureOpt);
    this._forcePrevTex = new graphicGL.Texture2D(textureOpt);

    this._weightedSumTex = new graphicGL.Texture2D(textureOpt);
    this._weightedSumTex.width = this._weightedSumTex.height = 1;

    this._globalSpeedTex = new graphicGL.Texture2D(textureOpt);
    this._globalSpeedPrevTex = new graphicGL.Texture2D(textureOpt);
    this._globalSpeedTex.width = this._globalSpeedTex.height = 1;
    this._globalSpeedPrevTex.width = this._globalSpeedPrevTex.height = 1;

    this._nodeRepulsionPass = new Pass({
        fragment: graphicGL.Shader.source('ecgl.forceAtlas2.updateNodeRepulsion')
    });
    this._positionPass = new Pass({
        fragment: graphicGL.Shader.source('ecgl.forceAtlas2.updatePosition')
    });
    this._globalSpeedPass = new Pass({
        fragment: graphicGL.Shader.source('ecgl.forceAtlas2.calcGlobalSpeed')
    });
    this._copyPass = new Pass({
        fragment: graphicGL.Shader.source('qtek.compositor.output')
    });

    var additiveBlend = function (gl) {
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE);
    };
    this._edgeForceMesh = new graphicGL.Mesh({
        geometry: new graphicGL.Geometry({
            attributes: {
                node0: new graphicGL.Geometry.Attribute('node0', 'float', 2),
                node1: new graphicGL.Geometry.Attribute('node1', 'float', 2),
                weight: new graphicGL.Geometry.Attribute('weight', 'float', 1)
            },
            dynamic: true,
            mainAttribute: 'node0'
        }),
        material: new graphicGL.Material({
            transparent: true,
            shader: graphicGL.createShader('ecgl.forceAtlas2.updateEdgeAttraction'),
            blend: additiveBlend,
            depthMask: false,
            depthText: false
        }),
        mode: graphicGL.Mesh.POINTS
    });
    this._weightedSumMesh = new graphicGL.Mesh({
        geometry: new graphicGL.Geometry({
            attributes: {
                node: new graphicGL.Geometry.Attribute('node', 'float', 2)
            },
            dynamic: true,
            mainAttribute: 'node'
        }),
        material: new graphicGL.Material({
            transparent: true,
            shader: graphicGL.createShader('ecgl.forceAtlas2.calcWeightedSum'),
            blend: additiveBlend,
            depthMask: false,
            depthText: false
        }),
        mode: graphicGL.Mesh.POINTS
    });

    this._framebuffer = new FrameBuffer({
        depthBuffer: false
    });

    this._dummyCamera = new graphicGL.OrthographicCamera({
        left: -1, right: 1,
        top: 1, bottom: -1,
        near: 0, far: 100
    });

    this._globalSpeed = 0;
}

ForceAtlas2GPU.prototype._updateSettings = function () {
    var nodes = this._nodes;
    var edges = this._edges;
    if (this.autoSettings) {
        var nNodes = nodes.length;
        if (nNodes > 50000) {
            this.jitterTolerence = 10;
        }
        else if (nNodes > 5000) {
            this.jitterTolerence = 1;
        }
        else {
            this.jitterTolerence = 0.1;
        }

        if (nNodes > 100) {
            this.scaling = 2.0;
        }
        else {
            this.scaling = 10.0;
        }

        // this.edgeWeightInfluence = 1;
        // this.gravity = 1;
        // this.strongGravityMode = false;
    }

    if (!this.gravityCenter) {
        var min = [Infinity, Infinity];
        var max = [-Infinity, -Infinity];
        for (var i = 0; i < nodes.length; i++) {
            min[0] = Math.min(nodes[i].x, min[0]);
            min[1] = Math.min(nodes[i].y, min[1]);
            max[0] = Math.max(nodes[i].x, max[0]);
            max[1] = Math.max(nodes[i].y, max[1]);
        }

        this._gravityCenter = [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5];
    }
    else {
        this._gravityCenter = this.gravityCenter;
    }
    // Update inDegree, outDegree
    for (var i = 0; i < edges.length; i++) {
        var node1 = edges[i].node1;
        var node2 = edges[i].node2;

        nodes[node1].degree = (nodes[node1].degree || 0) + 1;
        nodes[node2].degree = (nodes[node2].degree || 0) + 1;
    }
}
/**
 * @param {Array.<Object>} [{ x, y, max}]
 */
ForceAtlas2GPU.prototype.initData = function (nodes, edges) {

    this._nodes = nodes;
    this._edges = edges;

    this._updateSettings();

    var textureWidth = Math.ceil(Math.sqrt(nodes.length));
    var textureHeight = textureWidth;
    var positionBuffer = new Float32Array(textureWidth * textureHeight * 4);
    var offset = 0;
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        positionBuffer[offset++] = node.x || 0;
        positionBuffer[offset++] = node.y || 0;

        if (this.repulsionByDegree) {
            positionBuffer[offset++] = (node.degree || 0) + 1;
        }
        else {
            positionBuffer[offset++] = node.mass || 1;
        }
        positionBuffer[offset++] = node.size || 1;
    }
    this._positionSourceTex.pixels = positionBuffer;

    var edgeGeometry = this._edgeForceMesh.geometry;
    var edgeLen = edges.length;
    edgeGeometry.attributes.node0.init(edgeLen * 2);
    edgeGeometry.attributes.node1.init(edgeLen * 2);
    edgeGeometry.attributes.weight.init(edgeLen * 2);

    var uv = [];

    function getUvOfNode(nodeIndex) {
        uv[0] = (nodeIndex % textureWidth) / (textureWidth - 1);
        uv[1] = Math.floor(nodeIndex / textureWidth) / (textureHeight - 1);
        return uv;
    }
    for (var i = 0; i < edges.length; i++) {
        var attributes = edgeGeometry.attributes;
        var weight = edges[i].weight;
        if (weight == null) {
            weight = 1;
        }
        // Two way.
        attributes.node0.set(i, getUvOfNode(edges[i].node1));
        attributes.node1.set(i, getUvOfNode(edges[i].node2));
        attributes.weight.set(i, weight);

        attributes.node0.set(i + edgeLen, getUvOfNode(edges[i].node2));
        attributes.node1.set(i + edgeLen, getUvOfNode(edges[i].node1));
        attributes.weight.set(i + edgeLen, weight);
    }

    var weigtedSumGeo = this._weightedSumMesh.geometry;
    weigtedSumGeo.attributes.node.init(nodes.length);
    for (var i = 0; i < nodes.length; i++) {
        weigtedSumGeo.attributes.node.set(i, getUvOfNode(i));
    }

    edgeGeometry.dirty();
    weigtedSumGeo.dirty();

    this._resize(textureWidth, textureHeight);

    this._nodeRepulsionPass.material.shader.define('fragment', 'NODE_COUNT', nodes.length);
    this._nodeRepulsionPass.material.setUniform('textureSize', [textureWidth, textureHeight]);

    this._inited = false;
};

ForceAtlas2GPU.prototype.step = function (renderer) {
    if (!this._inited) {
        this._initFromSource(renderer);
        this._inited = true;
    }

    this._framebuffer.attach(this._forceTex);
    this._framebuffer.bind(renderer);
    var nodeRepulsionPass = this._nodeRepulsionPass;
    // Calc node repulsion, gravity
    nodeRepulsionPass.setUniform('strongGravityMode', this.strongGravityMode);
    nodeRepulsionPass.setUniform('gravity', this.gravity);
    nodeRepulsionPass.setUniform('gravityCenter', this._gravityCenter);
    nodeRepulsionPass.setUniform('scaling', this.scaling);
    nodeRepulsionPass.setUniform('preventOverlap', this.preventOverlap);
    nodeRepulsionPass.setUniform('positionTex', this._positionPrevTex);
    nodeRepulsionPass.render(renderer);

    // Calc edge attraction force
    var edgeForceMesh = this._edgeForceMesh;
    edgeForceMesh.material.set('linLogMode', this.linLogMode);
    edgeForceMesh.material.set('edgeWeightInfluence', this.edgeWeightInfluence);
    edgeForceMesh.material.set('preventOverlap', this.preventOverlap);
    edgeForceMesh.material.set('positionTex', this._positionPrevTex);
    renderer.gl.enable(renderer.gl.BLEND);
    renderer.renderQueue([edgeForceMesh], this._dummyCamera);

    // Calc weighted sum.
    this._framebuffer.attach(this._weightedSumTex);
    renderer.gl.clearColor(0, 0, 0, 0);
    renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT);
    renderer.gl.enable(renderer.gl.BLEND);
    var weightedSumMesh = this._weightedSumMesh;
    weightedSumMesh.material.set('positionTex', this._positionPrevTex);
    weightedSumMesh.material.set('forceTex', this._forceTex);
    weightedSumMesh.material.set('forcePrevTex', this._forcePrevTex);
    renderer.renderQueue([weightedSumMesh], this._dummyCamera);

    // Calc global speed.
    this._framebuffer.attach(this._globalSpeedTex);
    var globalSpeedPass = this._globalSpeedPass;
    globalSpeedPass.setUniform('globalSpeedPrevTex', this._globalSpeedPrevTex);
    globalSpeedPass.setUniform('weightedSumTex', this._weightedSumTex);
    globalSpeedPass.setUniform('jitterTolerence', this.jitterTolerence);
    renderer.gl.disable(renderer.gl.BLEND);
    globalSpeedPass.render(renderer);

    // Update position.
    var positionPass = this._positionPass;
    this._framebuffer.attach(this._positionTex);
    positionPass.setUniform('globalSpeedTex', this._globalSpeedTex);
    positionPass.setUniform('positionTex', this._positionPrevTex);
    positionPass.setUniform('forceTex', this._forceTex);
    positionPass.setUniform('forcePrevTex', this._forcePrevTex);
    positionPass.render(renderer);

    this._framebuffer.unbind(renderer);

    this._swapTexture();
};

ForceAtlas2GPU.prototype.getNodePositionTexture = function () {
    // Texture already been swapped.
    return this._positionPrevTex;
};

ForceAtlas2GPU.prototype.getNodePosition = function (renderer, out) {
    var positionArr = this._positionArr;
    var width = this._positionTex.width;
    var height = this._positionTex.height;
    var size = width * height;
    if (!positionArr || positionArr.length !== size * 4) {
        positionArr = this._positionArr = new Float32Array(size * 4);
    }
    this._framebuffer.bind(renderer);
    this._framebuffer.attach(this._positionPrevTex);
    renderer.gl.readPixels(
        0, 0, width, height,
        renderer.gl.RGBA, renderer.gl.FLOAT,
        positionArr
    );
    this._framebuffer.unbind(renderer);
    if (!out) {
        out = new Float32Array(this._nodes.length * 2);
    }
    for (var i = 0; i < this._nodes.length; i++) {
        out[i * 2] = positionArr[i * 4];
        out[i * 2 + 1] = positionArr[i * 4 + 1];
    }
    return out;
};

ForceAtlas2GPU.prototype.getTextureData = function (renderer, textureName) {
    var tex = this['_' + textureName + 'Tex'];
    var width = tex.width;
    var height = tex.height;
    this._framebuffer.bind(renderer);
    this._framebuffer.attach(tex);
    var arr = new Float32Array(width * height * 4);
    renderer.gl.readPixels(0, 0, width, height, renderer.gl.RGBA, renderer.gl.FLOAT, arr);
    this._framebuffer.unbind(renderer);
    return arr;
};

ForceAtlas2GPU.prototype._swapTexture = function () {
    var tmp = this._positionPrevTex;
    this._positionPrevTex = this._positionTex;
    this._positionTex = tmp;

    var tmp = this._forcePrevTex;
    this._forcePrevTex = this._forceTex;
    this._forceTex = tmp;

    var tmp = this._globalSpeedPrevTex;
    this._globalSpeedPrevTex = this._globalSpeedTex;
    this._globalSpeedTex = tmp;
};

ForceAtlas2GPU.prototype._initFromSource = function (renderer) {
    this._framebuffer.attach(this._positionPrevTex);
    this._framebuffer.bind(renderer);
    this._copyPass.setUniform('texture', this._positionSourceTex);
    this._copyPass.render(renderer);

    renderer.gl.clearColor(0, 0, 0, 0);
    this._framebuffer.attach(this._forcePrevTex);
    renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT);
    this._framebuffer.attach(this._globalSpeedPrevTex);
    renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT);

    this._framebuffer.unbind(renderer);
};

ForceAtlas2GPU.prototype._resize = function (width, height) {
    ['_positionSourceTex', '_positionTex', '_positionPrevTex', '_forceTex', '_forcePrevTex'].forEach(function (texName) {
        this[texName].width = width;
        this[texName].height = height;
        this[texName].dirty();
    }, this);
};

echarts.ForceAtlas2GPU = ForceAtlas2GPU;

module.exports = ForceAtlas2GPU;