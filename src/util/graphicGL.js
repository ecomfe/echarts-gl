var Mesh = require('qtek/lib/Mesh');
var Texture2D = require('qtek/lib/Texture2D');
var Shader = require('qtek/lib/Shader');
var Material = require('qtek/lib/Material');
var Node3D = require('qtek/lib/Node');
var StaticGeometry = require('qtek/lib/StaticGeometry');
var echarts = require('echarts/lib/echarts');
var Scene = require('qtek/lib/Scene');
var LRUCache = require('zrender/lib/core/LRU');
var textureUtil = require('qtek/lib/util/texture');
var EChartsSurface = require('./EChartsSurface');

var animatableMixin = require('./animatableMixin');
echarts.util.extend(Node3D.prototype, animatableMixin);

function isValueNone(value) {
    return !value || value === 'none';
}

function isValueImage(value) {
    return value instanceof HTMLCanvasElement
        || value instanceof HTMLImageElement
        || value instanceof Image;
}

function isECharts(value) {
    return value.getZr && value.setOption;
}

// Overwrite addToScene and removeFromScene
var oldAddToScene = Scene.prototype.addToScene;
var oldRemoveFromScene = Scene.prototype.removeFromScene;

Scene.prototype.addToScene = function (node) {
    oldAddToScene.call(this, node);

    if (this.__zr) {
        var zr = this.__zr;
        node.traverse(function (child) {
            child.__zr = zr;
            if (child.addAnimatorsToZr) {
                child.addAnimatorsToZr(zr);
            }
        })
    }
};

Scene.prototype.removeFromScene = function (node) {
    oldRemoveFromScene.call(this, node);

    node.traverse(function (child) {
        var zr = child.__zr;
        child.__zr = null;
        if (zr && child.removeAnimatorsFromZr) {
            child.removeAnimatorsFromZr(zr);
        }
    });
};

/**
 * @param {string} textureName
 * @param {string|HTMLImageElement|HTMLCanvasElement} imgValue
 * @param {module:echarts/ExtensionAPI} api
 * @param {Object} [textureOpts]
 */
Mesh.prototype.setTextureImage = function (textureName, imgValue, api, textureOpts) {
    if (api == null) {
        api = textureOpts;
    }

    var material = this.material;
    if (!material || !material.shader) {
        return;
    }

    var zr = api.getZr();
    var mesh = this;

    // disableTexture first
    material.shader.disableTexture(textureName);
    if (!isValueNone(imgValue)) {
        graphicGL.loadTexture(imgValue, api, textureOpts, function (texture) {
            if (texture.surface) {
                texture.surface.attachToMesh(mesh);
            }
            material.shader.enableTexture(textureName);
            material.set(textureName, texture);
            zr && zr.refresh();
        });
    }

    return material.get(textureName);
};

var graphicGL = {};

graphicGL.Node = Node3D;

graphicGL.Mesh = Mesh;

graphicGL.Shader = Shader;

graphicGL.createShader = function (prefix) {
    var vertexShaderStr = Shader.source(prefix + '.vertex');
    var fragmentShaderStr = Shader.source(prefix + '.fragment');
    if (!vertexShaderStr) {
        console.error('Vertex shader of \'%s\' not exits', prefix);
    }
    if (!fragmentShaderStr) {
        console.error('Fragment shader of \'%s\' not exits', prefix);
    }
    return new Shader({
        vertex: vertexShaderStr,
        fragment: fragmentShaderStr
    });
};

graphicGL.Material = Material;

graphicGL.Texture2D = Texture2D;

// Geometries
graphicGL.Geometry = StaticGeometry;

graphicGL.SphereGeometry = require('qtek/lib/geometry/Sphere');

graphicGL.PlaneGeometry = require('qtek/lib/geometry/Plane');

graphicGL.CubeGeometry = require('qtek/lib/geometry/Cube');

// Lights
graphicGL.AmbientLight = require('qtek/lib/light/Ambient');
graphicGL.DirectionalLight = require('qtek/lib/light/Directional');
graphicGL.PointLight = require('qtek/lib/light/Point');
graphicGL.SpotLight = require('qtek/lib/light/Spot');

// Math
graphicGL.Vector2 = require('qtek/lib/math/Vector2');
graphicGL.Vector3 = require('qtek/lib/math/Vector3');
graphicGL.Vector4 = require('qtek/lib/math/Vector4');

graphicGL.Quaternion = require('qtek/lib/math/Quaternion');

graphicGL.Matrix2 = require('qtek/lib/math/Matrix2');
graphicGL.Matrix2d = require('qtek/lib/math/Matrix2d');
graphicGL.Matrix3 = require('qtek/lib/math/Matrix3');
graphicGL.Matrix4 = require('qtek/lib/math/Matrix4');

graphicGL.Plane = require('qtek/lib/math/Plane');
graphicGL.Ray = require('qtek/lib/math/Ray');
graphicGL.BoundingBox = require('qtek/lib/math/BoundingBox');
graphicGL.Frustum = require('qtek/lib/math/Frustum');

// Texture utilities

var blankImage = textureUtil.createBlank('rgba(255,255,255,0)');
/**
 * @param {string|HTMLImageElement|HTMLCanvasElement} imgValue
 * @param {module:echarts/ExtensionAPI} api
 * @param {Object} [textureOpts]
 * @param {Function} cb
 */
// TODO Promise
graphicGL.loadTexture = function (imgValue, api, textureOpts, cb) {
    if (typeof textureOpts === 'function') {
        cb = textureOpts;
        textureOpts = {};
    }

    var keys = Object.keys(textureOpts).sort();
    var prefix = '';
    for (var i = 0; i < keys.length; i++) {
        prefix += keys[i] + '_' + textureOpts[keys[i]] + '_';
    }

    var textureCache = api.__textureCache = api.__textureCache || new LRUCache(20);

    if (isECharts(imgValue)) {
        var id = imgValue.__textureid__;
        var textureObj = textureCache.get(prefix + id);
        if (!textureObj) {
            var surface = new EChartsSurface(imgValue);
            surface.textureupdated = function () {
                api.getZr().refresh();
            };
            textureObj = {
                texture: surface.getTexture()
            };
            for (var i = 0; i < keys.length; i++) {
                textureObj.texture[keys[i]] = textureOpts[keys[i]];
            }
            id = imgValue.__textureid__ || '__ecgl_ec__' + textureObj.texture.__GUID__;
            imgValue.__textureid__ = id;
            textureCache.put(prefix + id, textureObj);
            // TODO Next tick?
            cb && cb(textureObj.texture);
        }
        else {
            textureObj.texture.surface.setECharts(imgValue);
        }
        return textureObj.texture;
    }
    else if (isValueImage(imgValue)) {
        var id = imgValue.__textureid__;
        var textureObj = textureCache.get(prefix + id);
        if (!textureObj) {
            textureObj = {
                texture: new graphicGL.Texture2D({
                    image: imgValue
                })
            };
            for (var i = 0; i < keys.length; i++) {
                textureObj.texture[keys[i]] = textureOpts[keys[i]];
            }
            id = imgValue.__textureid__ || '__ecgl_image__' + textureObj.texture.__GUID__;
            imgValue.__textureid__ = id;
            textureCache.put(prefix + id, textureObj);
            // TODO Next tick?
            cb && cb(textureObj.texture);
        }
        return textureObj.texture;
    }
    else {
        var textureObj = textureCache.get(prefix + imgValue);
        if (textureObj) {
            if (textureObj.callbacks) {
                // Add to pending callbacks
                textureObj.callbacks.push(cb);
            }
            else {
                // TODO Next tick?
                cb && cb(textureObj.texture);
            }
        }
        else {
            var texture = new graphicGL.Texture2D({
                image: new Image()
            });
            for (var i = 0; i < keys.length; i++) {
                texture[keys[i]] = textureOpts[keys[i]];
            }

            textureObj = {
                texture: texture,
                callbacks: [cb]
            };
            texture.image.onload = function () {
                texture.dirty();
                textureObj.callbacks.forEach(function (cb) {
                    cb && cb(texture);
                });
                textureObj.callbacks = null;
            };
            texture.image.src = imgValue;

            textureCache.put(prefix + imgValue, textureObj);
        }

        return textureObj.texture;
    }
};

/**
 * Create a blank texture for placeholder
 */
graphicGL.createBlankTexture = textureUtil.createBlank;

/**
 * If value is image
 * @param {*}
 * @return {boolean}
 */
graphicGL.isImage = isValueImage;

graphicGL.additiveBlend = function (gl) {
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
};

module.exports = graphicGL;