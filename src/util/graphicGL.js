var Mesh = require('qtek/lib/Mesh');
var Renderer = require('qtek/lib/Renderer');
var Texture2D = require('qtek/lib/Texture2D');
var Texture = require('qtek/lib/Texture');
var Shader = require('qtek/lib/Shader');
var Material = require('qtek/lib/Material');
var Node3D = require('qtek/lib/Node');
var StaticGeometry = require('qtek/lib/StaticGeometry');
var echarts = require('echarts/lib/echarts');
var Scene = require('qtek/lib/Scene');
var LRUCache = require('zrender/lib/core/LRU');
var textureUtil = require('qtek/lib/util/texture');
var EChartsSurface = require('./EChartsSurface');
var AmbientCubemapLight = require('qtek/lib/light/AmbientCubemap');
var AmbientSHLight = require('qtek/lib/light/AmbientSH');
var shUtil = require('qtek/lib/util/sh');
var retrieve = require('./retrieve');

var animatableMixin = require('./animatableMixin');
echarts.util.extend(Node3D.prototype, animatableMixin);

// Some common shaders
Shader.import(require('qtek/lib/shader/source/util.essl'));
Shader.import(require('text!./shader/common.glsl'));
Shader.import(require('text!./shader/color.glsl'));
Shader.import(require('text!./shader/lambert.glsl'));
Shader.import(require('text!./shader/realistic.glsl'));

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
Material.prototype.setTextureImage = function (textureName, imgValue, api, textureOpts) {
    if (api == null) {
        api = textureOpts;
    }

    if (!this.shader) {
        return;
    }

    var zr = api.getZr();
    var material = this;
    var texture;
    // disableTexture first
    material.shader.disableTexture(textureName);
    if (!isValueNone(imgValue)) {
        texture = graphicGL.loadTexture(imgValue, api, textureOpts, function (texture) {
            material.shader.enableTexture(textureName);
            material.set(textureName, texture);
            zr && zr.refresh();
        });
    }

    return texture;
};

var graphicGL = {};

graphicGL.Renderer = Renderer;

graphicGL.Node = Node3D;

graphicGL.Mesh = Mesh;

graphicGL.Shader = Shader;

graphicGL.Material = Material;

graphicGL.Texture = Texture;

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

// Cameras
graphicGL.PerspectiveCamera = require('qtek/lib/camera/Perspective');
graphicGL.OrthographicCamera = require('qtek/lib/camera/Orthographic');

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
            surface.onupdate = function () {
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

            cb && cb(textureObj.texture);
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
            if (imgValue.match(/.hdr$/)) {
                textureObj = {
                    callbacks: [cb]
                };
                var texture = textureUtil.loadTexture(imgValue, {
                    exposure: textureOpts.exposure
                }, function () {
                    texture.dirty();
                    textureObj.callbacks.forEach(function (cb) {
                        cb && cb(texture);
                    });
                    textureObj.callbacks = null;
                });
                textureObj.texture = texture;
                textureCache.put(prefix + imgValue, textureObj);
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
                var originalImage = texture.image;
                originalImage.onload = function () {
                    texture.image = originalImage;
                    texture.dirty();
                    textureObj.callbacks.forEach(function (cb) {
                        cb && cb(texture);
                    });
                    textureObj.callbacks = null;
                };
                originalImage.src = imgValue;
                // Use blank image as place holder.
                texture.image = blankImage;

                textureCache.put(prefix + imgValue, textureObj);
            }
        }

        return textureObj.texture;
    }
};

/**
 * Create ambientCubemap and ambientSH light. respectively to have specular and diffuse light
 * @return {Object} { specular, diffuse }
 */
graphicGL.createAmbientCubemap = function (opt, renderer, api) {
    opt = opt || {};
    var textureUrl = opt.texture;
    var exposure = retrieve.firstNotNull(opt.exposure, 1.0);

    var ambientCubemap = new AmbientCubemapLight({
        intensity: retrieve.firstNotNull(opt.specularIntensity, 1.0)
    });
    var ambientSH = new AmbientSHLight({
        intensity: retrieve.firstNotNull(opt.diffuseIntensity, 1.0),
        coefficients: [0.844, 0.712, 0.691, -0.037, 0.083, 0.167, 0.343, 0.288, 0.299, -0.041, -0.021, -0.009, -0.003, -0.041, -0.064, -0.011, -0.007, -0.004, -0.031, 0.034, 0.081, -0.060, -0.049, -0.060, 0.046, 0.056, 0.050]
    });

    ambientCubemap.cubemap = graphicGL.loadTexture(textureUrl, api, {
        exposure: exposure
    }, function () {
        ambientCubemap.cubemap.flipY = false;
        ambientCubemap.prefilter(renderer, 32);
        ambientSH.coefficients = shUtil.projectEnvironmentMap(renderer, ambientCubemap.cubemap, {
            lod: 1
        });
    });

    return {
        specular: ambientCubemap,
        diffuse: ambientSH
    };
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

/**
 * @param {string|Array.<number>} colorStr
 * @param {Array.<number>} [rgba]
 * @return {Array.<number>} rgba
 */
graphicGL.parseColor = function (colorStr, rgba) {
    if (colorStr instanceof Array) {
        // Color has been parsed.
        return colorStr;
    }

    rgba = echarts.color.parse(colorStr || '#000', rgba) || [0, 0, 0, 0];
    rgba[0] /= 255;
    rgba[1] /= 255;
    rgba[2] /= 255;
    return rgba;
};

/**
 * Convert alpha beta rotation to direction.
 * @param {number} alpha
 * @param {number} beta
 * @return {Array.<number>}
 */
graphicGL.directionFromAlphaBeta = function (alpha, beta) {
    var theta = alpha / 180 * Math.PI + Math.PI / 2;
    var phi = -beta / 180 * Math.PI + Math.PI / 2;

    var dir = [];
    var r = Math.sin(theta);
    dir[0] = r * Math.cos(phi);
    dir[1] = -Math.cos(theta);
    dir[2] = r * Math.sin(phi);

    return dir;
};
/**
 * Get shadow resolution from shadowQuality configuration
 */
graphicGL.getShadowResolution = function (shadowQuality) {
    var shadowResolution = 1024;
    switch (shadowQuality) {
        case 'low':
            shadowResolution = 512;
            break;
        case 'medium':
            break;
        case 'high':
            shadowResolution = 2048;
            break;
        case 'ultra':
            shadowResolution = 4096;
            break;
    }
    return shadowResolution;
};

/**
 * Shading utilities
 */
graphicGL.COMMON_SHADERS = ['lambert', 'color', 'realistic'];

/**
 * Create shader including vertex and fragment
 * @param {string} prefix.
 */
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
/**
 * Set material from model.
 * @param {qtek.Material} material
 * @param {module:echarts/model/Model} model
 * @param {module:echarts/ExtensionAPI} api
 */
graphicGL.setMaterialFromModel = function (shading, material, model, api) {
    var materialModel = model.getModel(shading + 'Material');
    var baseTexture = materialModel.get('baseTexture');
    var uvRepeat = retrieve.firstNotNull(materialModel.get('textureTiling'), 1.0);
    var uvOffset = retrieve.firstNotNull(materialModel.get('textureOffset'), 1.0);
    if (typeof uvRepeat === 'number') {
        uvRepeat = [uvRepeat, uvRepeat];
    }
    if (typeof uvOffset === 'number') {
        uvOffset = [uvOffset, uvOffset];
    }
    var textureOpt = {
        anisotropic: 8,
        wrapS: graphicGL.Texture.REPEAT,
        wrapT: graphicGL.Texture.REPEAT
    };
    if (shading === 'realistic') {
        var roughness = retrieve.firstNotNull(materialModel.get('roughness'), 0.5);
        var metalness = materialModel.get('metalness') || 0;
        var roughnessTexture = materialModel.get('roughnessTexture');
        var metalnessTexture = materialModel.get('metalnessTexture');
        if (metalness == null) {
            if (metalnessTexture == null) {
                metalness = 0.0;
            }
            else {
                metalness = 0.5;
            }
        }
        if (roughness == null) {
            roughness = 0.5;
        }

        material.setTextureImage('diffuseMap', baseTexture, api, textureOpt);
        material.setTextureImage('roughnessMap', roughnessTexture, api, textureOpt);
        material.setTextureImage('metalnessMap', metalnessTexture, api, textureOpt);
        material.set({
            roughness: roughness,
            metalness: metalness,
            uvRepeat: uvRepeat,
            uvOffset: uvOffset
        });
    }
    else if (shading === 'lambert') {
        material.setTextureImage('diffuseMap', baseTexture, api, textureOpt);
        material.set({
            uvRepeat: uvRepeat,
            uvOffset: uvOffset
        });
    }
    else if (shading === 'color') {
        material.setTextureImage('diffuseMap', baseTexture, api, textureOpt);
        material.set({
            uvRepeat: uvRepeat,
            uvOffset: uvOffset
        });
    }
};

module.exports = graphicGL;