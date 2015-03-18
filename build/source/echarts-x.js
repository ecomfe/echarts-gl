define('echarts-x', ['echarts-x/echarts-x'], function (main) {return main;});
define('echarts-x/echarts-x', [
    'require',
    'zrender',
    'qtek',
    'echarts',
    'echarts/config',
    './config',
    'zrender/tool/util',
    'qtek/Node',
    'qtek/Mesh',
    'qtek/Material',
    'qtek/Shader',
    'qtek/Texture2D',
    'qtek/core/glenum',
    './util/shader/albedo.essl',
    './util/shader/points.essl',
    './util/shader/curveAnimatingPoints.essl',
    './util/shader/vectorFieldParticle.essl',
    './util/shader/lambert.essl',
    './util/shader/motionBlur.essl'
], function (require) {
    var ecx = {
        version: '0.2.0',
        dependencies: {
            echarts: '2.2.1',
            zrender: '2.0.8',
            qtek: '0.2.1'
        }
    };
    var deps = ecx.dependencies;
    function versionTooOldMsg(name) {
        throw new Error(name + ' version is too old, needs ' + deps[name] + ' or higher');
    }
    function checkVersion(mod, name) {
        if (mod.version.replace('.', '') - 0 < deps[name].replace('.', '') - 0) {
            versionTooOldMsg(name);
        }
        console.log('Loaded ' + name + ', version ' + mod.version);
    }
    checkVersion(require('zrender'), 'zrender');
    checkVersion(require('qtek'), 'qtek');
    checkVersion(require('echarts'), 'echarts');
    var ecConfig = require('echarts/config');
    var ecxConfig = require('./config');
    var zrUtil = require('zrender/tool/util');
    zrUtil.merge(ecConfig, ecxConfig, true);
    require('qtek/Node');
    require('qtek/Mesh');
    require('qtek/Material');
    require('qtek/Shader');
    require('qtek/Texture2D');
    require('qtek/core/glenum');
    var Shader = require('qtek/Shader');
    Shader['import'](require('./util/shader/albedo.essl'));
    Shader['import'](require('./util/shader/points.essl'));
    Shader['import'](require('./util/shader/curveAnimatingPoints.essl'));
    Shader['import'](require('./util/shader/vectorFieldParticle.essl'));
    Shader['import'](require('./util/shader/lambert.essl'));
    Shader['import'](require('./util/shader/motionBlur.essl'));
    return ecx;
});define('qtek', ['qtek/qtek.amd'], function (main) {return main;});
define('qtek/qtek.amd', [], function () {
    return { version: '0.2.1' };
});define('echarts-x/config', [], {
    CHART_TYPE_MAP3D: 'map3d',
    map3d: {
        background: '',
        zlevel: -1,
        mapType: 'world',
        flat: false,
        flatAngle: 30,
        hoverable: true,
        clickable: true,
        selectedMode: false,
        mapLocation: {
            x: 0,
            y: 0,
            width: '100%',
            height: '100%'
        },
        baseLayer: {
            backgroundColor: 'black',
            backgroundImage: '',
            quality: 'medium',
            heightImage: ''
        },
        light: {
            show: false,
            sunIntensity: 1,
            ambientIntensity: 0.1,
            time: ''
        },
        surfaceLayers: [],
        itemStyle: {
            normal: {
                label: {
                    show: false,
                    textStyle: { color: 'black' }
                },
                borderColor: 'black',
                borderWidth: 1,
                areaStyle: {
                    color: '#396696',
                    opacity: 1
                }
            },
            emphasis: {
                borderColor: 'black',
                borderWidth: 1,
                areaStyle: { color: 'rgba(255,215,0,0.5)' }
            }
        },
        roam: {
            autoRotate: true,
            autoRotateAfterStill: 3,
            focus: '',
            zoom: 1,
            minZoom: 0.5,
            maxZoom: 1.5,
            preserve: true
        }
    },
    markBar: {
        barSize: 1,
        distance: 1,
        itemStyle: { normal: {} }
    },
    markPoint: {
        symbolSize: 4,
        distance: 1,
        orientation: 'tangent',
        orientationAngle: 0,
        itemStyle: {
            normal: {
                borderWidth: 1,
                borderColor: '#000',
                label: {
                    show: false,
                    position: 'inside',
                    textStyle: { color: 'black' }
                }
            }
        }
    },
    markLine: {
        distance: 1,
        itemStyle: {
            normal: {
                lineStyle: {
                    width: 1,
                    opacity: 0.2
                }
            }
        }
    },
    EVENT: { MAP3D_SELECTED: 'map3dSelected' }
});define('qtek/Node', [
    'require',
    './core/Base',
    './math/Vector3',
    './math/Quaternion',
    './math/Matrix4',
    './dep/glmatrix'
], function (require) {
    'use strict';
    var Base = require('./core/Base');
    var Vector3 = require('./math/Vector3');
    var Quaternion = require('./math/Quaternion');
    var Matrix4 = require('./math/Matrix4');
    var glMatrix = require('./dep/glmatrix');
    var mat4 = glMatrix.mat4;
    var nameId = 0;
    var Node = Base.derive({
        name: '',
        position: null,
        rotation: null,
        scale: null,
        worldTransform: null,
        localTransform: null,
        autoUpdateLocalTransform: true,
        _parent: null,
        _scene: null,
        _needsUpdateWorldTransform: true,
        _inIterating: false,
        __depth: 0
    }, function () {
        if (!this.name) {
            this.name = 'NODE_' + nameId++;
        }
        if (!this.position) {
            this.position = new Vector3();
        }
        if (!this.rotation) {
            this.rotation = new Quaternion();
        }
        if (!this.scale) {
            this.scale = new Vector3(1, 1, 1);
        }
        this.worldTransform = new Matrix4();
        this.localTransform = new Matrix4();
        this._children = [];
    }, {
        visible: true,
        isRenderable: function () {
            return false;
        },
        setName: function (name) {
            if (this._scene) {
                delete this._scene._nodeRepository[this.name];
                this._scene._nodeRepository[name] = this;
            }
            this.name = name;
        },
        add: function (node) {
            if (this._inIterating) {
                console.warn('Add operation can cause unpredictable error when in iterating');
            }
            if (node._parent === this) {
                return;
            }
            if (node._parent) {
                node._parent.remove(node);
            }
            node._parent = this;
            this._children.push(node);
            if (this._scene && this._scene !== node.scene) {
                node.traverse(this._addSelfToScene, this);
            }
        },
        remove: function (node) {
            if (this._inIterating) {
                console.warn('Remove operation can cause unpredictable error when in iterating');
            }
            var idx = this._children.indexOf(node);
            if (idx < 0) {
                return;
            }
            this._children.splice(idx, 1);
            node._parent = null;
            if (this._scene) {
                node.traverse(this._removeSelfFromScene, this);
            }
        },
        getScene: function () {
            return this._scene;
        },
        getParent: function () {
            return this._parent;
        },
        _removeSelfFromScene: function (descendant) {
            descendant._scene.removeFromScene(descendant);
            descendant._scene = null;
        },
        _addSelfToScene: function (descendant) {
            this._scene.addToScene(descendant);
            descendant._scene = this._scene;
        },
        isAncestor: function (node) {
            var parent = node._parent;
            while (parent) {
                if (parent === this) {
                    return true;
                }
                parent = parent._parent;
            }
            return false;
        },
        children: function () {
            return this._children.slice();
        },
        childAt: function (idx) {
            return this._children[idx];
        },
        getChildByName: function (name) {
            for (var i = 0; i < this._children.length; i++) {
                if (this._children[i].name === name) {
                    return this._children[i];
                }
            }
        },
        getDescendantByName: function (name) {
            for (var i = 0; i < this._children.length; i++) {
                var child = this._children[i];
                if (child.name === name) {
                    return child;
                } else {
                    var res = child.getDescendantByName(name);
                    if (res) {
                        return res;
                    }
                }
            }
        },
        queryNode: function (path) {
            if (!path) {
                return;
            }
            var pathArr = path.split('/');
            var current = this;
            for (var i = 0; i < pathArr.length; i++) {
                var name = pathArr[i];
                if (!name) {
                    continue;
                }
                var found = false;
                for (var j = 0; j < current._children.length; j++) {
                    var child = current._children[j];
                    if (child.name === name) {
                        current = child;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    return;
                }
            }
            return current;
        },
        getPath: function (rootNode) {
            if (!this._parent) {
                return '/';
            }
            var current = this._parent;
            var path = this.name;
            while (current._parent) {
                path = current.name + '/' + path;
                if (current._parent == rootNode) {
                    break;
                }
                current = current._parent;
            }
            if (!current._parent && rootNode) {
                return null;
            }
            return path;
        },
        traverse: function (callback, context, ctor) {
            this._inIterating = true;
            if (ctor === undefined || this.constructor === ctor) {
                callback.call(context, this);
            }
            var _children = this._children;
            for (var i = 0, len = _children.length; i < len; i++) {
                _children[i].traverse(callback, context, ctor);
            }
            this._inIterating = false;
        },
        setLocalTransform: function (matrix) {
            mat4.copy(this.localTransform._array, matrix._array);
            this.decomposeLocalTransform();
        },
        decomposeLocalTransform: function (keepScale) {
            var scale = !keepScale ? this.scale : null;
            this.localTransform.decomposeMatrix(scale, this.rotation, this.position);
        },
        setWorldTransform: function (matrix) {
            mat4.copy(this.worldTransform._array, matrix._array);
            this.decomposeWorldTransform();
        },
        decomposeWorldTransform: function () {
            var tmp = mat4.create();
            return function (keepScale) {
                if (this._parent) {
                    mat4.invert(tmp, this._parent.worldTransform._array);
                    mat4.multiply(this.localTransform._array, tmp, this.worldTransform._array);
                } else {
                    mat4.copy(this.localTransform._array, this.worldTransform._array);
                }
                var scale = !keepScale ? this.scale : null;
                this.localTransform.decomposeMatrix(scale, this.rotation, this.position);
            };
        }(),
        updateLocalTransform: function () {
            var position = this.position;
            var rotation = this.rotation;
            var scale = this.scale;
            if (position._dirty || scale._dirty || rotation._dirty) {
                var m = this.localTransform._array;
                mat4.fromRotationTranslation(m, rotation._array, position._array);
                mat4.scale(m, m, scale._array);
                rotation._dirty = false;
                scale._dirty = false;
                position._dirty = false;
                this._needsUpdateWorldTransform = true;
            }
        },
        updateWorldTransform: function () {
            if (this._parent) {
                mat4.multiply(this.worldTransform._array, this._parent.worldTransform._array, this.localTransform._array);
            } else {
                mat4.copy(this.worldTransform._array, this.localTransform._array);
            }
        },
        update: function (forceUpdateWorld) {
            if (this.autoUpdateLocalTransform) {
                this.updateLocalTransform();
            } else {
                forceUpdateWorld = true;
            }
            if (forceUpdateWorld || this._needsUpdateWorldTransform) {
                this.updateWorldTransform();
                forceUpdateWorld = true;
                this._needsUpdateWorldTransform = false;
            }
            for (var i = 0, len = this._children.length; i < len; i++) {
                this._children[i].update(forceUpdateWorld);
            }
        },
        getWorldPosition: function (out) {
            var m = this.worldTransform._array;
            if (out) {
                out._array[0] = m[12];
                out._array[1] = m[13];
                out._array[2] = m[14];
                return out;
            } else {
                return new Vector3(m[12], m[13], m[14]);
            }
        },
        clone: function () {
            var node = new this.constructor();
            node.setName(this.name);
            node.position.copy(this.position);
            node.rotation.copy(this.rotation);
            node.scale.copy(this.scale);
            for (var i = 0; i < this._children.length; i++) {
                node.add(this._children[i].clone());
            }
            return node;
        },
        rotateAround: function () {
            var v = new Vector3();
            var RTMatrix = new Matrix4();
            return function (point, axis, angle) {
                v.copy(this.position).subtract(point);
                this.localTransform.identity();
                this.localTransform.translate(point);
                this.localTransform.rotate(angle, axis);
                RTMatrix.fromRotationTranslation(this.rotation, v);
                this.localTransform.multiply(RTMatrix);
                this.localTransform.scale(this.scale);
                this.decomposeLocalTransform();
                this._needsUpdateWorldTransform = true;
            };
        }(),
        lookAt: function () {
            var m = new Matrix4();
            return function (target, up) {
                m.lookAt(this.position, target, up || this.localTransform.y).invert();
                m.decomposeMatrix(null, this.rotation, this.position);
            };
        }()
    });
    return Node;
});define('qtek/Mesh', [
    'require',
    './Renderable',
    './core/glenum'
], function (require) {
    'use strict';
    var Renderable = require('./Renderable');
    var glenum = require('./core/glenum');
    var Mesh = Renderable.derive({
        skeleton: null,
        joints: null
    }, function () {
        if (!this.joints) {
            this.joints = [];
        }
    }, {
        render: function (_gl, globalMaterial) {
            var material = globalMaterial || this.material;
            if (this.skeleton) {
                var skinMatricesArray = this.skeleton.getSubSkinMatrices(this.__GUID__, this.joints);
                material.shader.setUniformBySemantic(_gl, 'SKIN_MATRIX', skinMatricesArray);
            }
            return Renderable.prototype.render.call(this, _gl, globalMaterial);
        }
    });
    Mesh.POINTS = glenum.POINTS;
    Mesh.LINES = glenum.LINES;
    Mesh.LINE_LOOP = glenum.LINE_LOOP;
    Mesh.LINE_STRIP = glenum.LINE_STRIP;
    Mesh.TRIANGLES = glenum.TRIANGLES;
    Mesh.TRIANGLE_STRIP = glenum.TRIANGLE_STRIP;
    Mesh.TRIANGLE_FAN = glenum.TRIANGLE_FAN;
    Mesh.BACK = glenum.BACK;
    Mesh.FRONT = glenum.FRONT;
    Mesh.FRONT_AND_BACK = glenum.FRONT_AND_BACK;
    Mesh.CW = glenum.CW;
    Mesh.CCW = glenum.CCW;
    return Mesh;
});define('qtek/Material', [
    'require',
    './core/Base',
    './Texture'
], function (require) {
    'use strict';
    var Base = require('./core/Base');
    var Texture = require('./Texture');
    var Material = Base.derive({
        name: '',
        uniforms: null,
        shader: null,
        depthTest: true,
        depthMask: true,
        transparent: false,
        blend: null,
        _enabledUniforms: null
    }, function () {
        if (!this.name) {
            this.name = 'MATERIAL_' + this.__GUID__;
        }
        if (this.shader) {
            this.attachShader(this.shader);
        }
        if (!this.uniforms) {
            this.uniforms = {};
        }
    }, {
        bind: function (_gl, prevMaterial) {
            var slot = 0;
            var sameShader = prevMaterial && prevMaterial.shader === this.shader;
            for (var u = 0; u < this._enabledUniforms.length; u++) {
                var symbol = this._enabledUniforms[u];
                var uniform = this.uniforms[symbol];
                if (sameShader) {
                    if (prevMaterial.uniforms[symbol].value === uniform.value) {
                        continue;
                    }
                }
                if (uniform.value === undefined) {
                    console.warn('Uniform value "' + symbol + '" is undefined');
                    continue;
                } else if (uniform.value === null) {
                    continue;
                } else if (uniform.value instanceof Array && !uniform.value.length) {
                    continue;
                } else if (uniform.value instanceof Texture) {
                    var res = this.shader.setUniform(_gl, '1i', symbol, slot);
                    if (!res) {
                        continue;
                    }
                    var texture = uniform.value;
                    _gl.activeTexture(_gl.TEXTURE0 + slot);
                    if (texture.isRenderable()) {
                        texture.bind(_gl);
                    } else {
                        texture.unbind(_gl);
                    }
                    slot++;
                } else if (uniform.value instanceof Array) {
                    if (uniform.value.length === 0) {
                        continue;
                    }
                    var exampleValue = uniform.value[0];
                    if (exampleValue instanceof Texture) {
                        if (!this.shader.hasUniform(symbol)) {
                            continue;
                        }
                        var arr = [];
                        for (var i = 0; i < uniform.value.length; i++) {
                            var texture = uniform.value[i];
                            _gl.activeTexture(_gl.TEXTURE0 + slot);
                            if (texture.isRenderable()) {
                                texture.bind(_gl);
                            } else {
                                texture.unbind(_gl);
                            }
                            arr.push(slot++);
                        }
                        this.shader.setUniform(_gl, '1iv', symbol, arr);
                    } else {
                        this.shader.setUniform(_gl, uniform.type, symbol, uniform.value);
                    }
                } else {
                    this.shader.setUniform(_gl, uniform.type, symbol, uniform.value);
                }
            }
        },
        setUniform: function (symbol, value) {
            var uniform = this.uniforms[symbol];
            if (uniform) {
                uniform.value = value;
            }
        },
        setUniforms: function (obj) {
            for (var key in obj) {
                var val = obj[key];
                this.setUniform(key, val);
            }
        },
        enableUniform: function (symbol) {
            if (this.uniforms[symbol] && !this.isUniformEnabled(symbol)) {
                this._enabledUniforms.push(symbol);
            }
        },
        disableUniform: function (symbol) {
            var idx = this._enabledUniforms.indexOf(symbol);
            if (idx >= 0) {
                this._enabledUniforms.splice(idx, 1);
            }
        },
        isUniformEnabled: function (symbol) {
            return this._enabledUniforms.indexOf(symbol) >= 0;
        },
        set: function (symbol, value) {
            if (typeof symbol === 'object') {
                for (var key in symbol) {
                    var val = symbol[key];
                    this.set(key, val);
                }
            } else {
                var uniform = this.uniforms[symbol];
                if (uniform) {
                    uniform.value = value;
                }
            }
        },
        get: function (symbol) {
            var uniform = this.uniforms[symbol];
            if (uniform) {
                return uniform.value;
            }
        },
        attachShader: function (shader, keepUniform) {
            if (this.shader) {
                this.shader.detached();
            }
            var originalUniforms = this.uniforms;
            this.uniforms = shader.createUniforms();
            this.shader = shader;
            this._enabledUniforms = Object.keys(this.uniforms);
            if (keepUniform) {
                for (var symbol in originalUniforms) {
                    if (this.uniforms[symbol]) {
                        this.uniforms[symbol].value = originalUniforms[symbol].value;
                    }
                }
            }
            shader.attached();
        },
        detachShader: function () {
            this.shader.detached();
            this.shader = null;
            this.uniforms = {};
        },
        clone: function () {
            var material = new Material({
                name: this.name,
                shader: this.shader
            });
            for (var symbol in this.uniforms) {
                material.uniforms[symbol].value = this.uniforms[symbol].value;
            }
            material.depthTest = this.depthTest;
            material.depthMask = this.depthMask;
            material.transparent = this.transparent;
            material.blend = this.blend;
            return material;
        },
        dispose: function (_gl, disposeTexture) {
            if (disposeTexture) {
                for (var name in this.uniforms) {
                    var val = this.uniforms[name].value;
                    if (!val) {
                        continue;
                    }
                    if (val instanceof Texture) {
                        val.dispose(_gl);
                    } else if (val instanceof Array) {
                        for (var i = 0; i < val.length; i++) {
                            if (val[i] instanceof Texture) {
                                val[i].dispose(_gl);
                            }
                        }
                    }
                }
            }
            var shader = this.shader;
            if (shader) {
                this.detachShader();
                if (!shader.isAttachedToAny()) {
                    shader.dispose(_gl);
                }
            }
        }
    });
    return Material;
});define('qtek/Shader', [
    'require',
    './core/Base',
    './core/util',
    './core/Cache',
    './dep/glmatrix'
], function (require) {
    'use strict';
    var Base = require('./core/Base');
    var util = require('./core/util');
    var Cache = require('./core/Cache');
    var glMatrix = require('./dep/glmatrix');
    var mat2 = glMatrix.mat2;
    var mat3 = glMatrix.mat3;
    var mat4 = glMatrix.mat4;
    var uniformRegex = /uniform\s+(bool|float|int|vec2|vec3|vec4|ivec2|ivec3|ivec4|mat2|mat3|mat4|sampler2D|samplerCube)\s+([\w\,]+)?(\[.*?\])?\s*(:\s*([\S\s]+?))?;/g;
    var attributeRegex = /attribute\s+(float|int|vec2|vec3|vec4)\s+(\w*)\s*(:\s*(\w+))?;/g;
    var defineRegex = /#define\s+(\w+)?(\s+[\w-.]+)?\s*\n/g;
    var uniformTypeMap = {
        'bool': '1i',
        'int': '1i',
        'sampler2D': 't',
        'samplerCube': 't',
        'float': '1f',
        'vec2': '2f',
        'vec3': '3f',
        'vec4': '4f',
        'ivec2': '2i',
        'ivec3': '3i',
        'ivec4': '4i',
        'mat2': 'm2',
        'mat3': 'm3',
        'mat4': 'm4'
    };
    var uniformValueConstructor = {
        'bool': function () {
            return true;
        },
        'int': function () {
            return 0;
        },
        'float': function () {
            return 0;
        },
        'sampler2D': function () {
            return null;
        },
        'samplerCube': function () {
            return null;
        },
        'vec2': function () {
            return [
                0,
                0
            ];
        },
        'vec3': function () {
            return [
                0,
                0,
                0
            ];
        },
        'vec4': function () {
            return [
                0,
                0,
                0,
                0
            ];
        },
        'ivec2': function () {
            return [
                0,
                0
            ];
        },
        'ivec3': function () {
            return [
                0,
                0,
                0
            ];
        },
        'ivec4': function () {
            return [
                0,
                0,
                0,
                0
            ];
        },
        'mat2': function () {
            return mat2.create();
        },
        'mat3': function () {
            return mat3.create();
        },
        'mat4': function () {
            return mat4.create();
        },
        'array': function () {
            return [];
        }
    };
    var attribSemantics = [
        'POSITION',
        'NORMAL',
        'BINORMAL',
        'TANGENT',
        'TEXCOORD',
        'TEXCOORD_0',
        'TEXCOORD_1',
        'COLOR',
        'JOINT',
        'WEIGHT',
        'SKIN_MATRIX'
    ];
    var matrixSemantics = [
        'WORLD',
        'VIEW',
        'PROJECTION',
        'WORLDVIEW',
        'VIEWPROJECTION',
        'WORLDVIEWPROJECTION',
        'WORLDINVERSE',
        'VIEWINVERSE',
        'PROJECTIONINVERSE',
        'WORLDVIEWINVERSE',
        'VIEWPROJECTIONINVERSE',
        'WORLDVIEWPROJECTIONINVERSE',
        'WORLDTRANSPOSE',
        'VIEWTRANSPOSE',
        'PROJECTIONTRANSPOSE',
        'WORLDVIEWTRANSPOSE',
        'VIEWPROJECTIONTRANSPOSE',
        'WORLDVIEWPROJECTIONTRANSPOSE',
        'WORLDINVERSETRANSPOSE',
        'VIEWINVERSETRANSPOSE',
        'PROJECTIONINVERSETRANSPOSE',
        'WORLDVIEWINVERSETRANSPOSE',
        'VIEWPROJECTIONINVERSETRANSPOSE',
        'WORLDVIEWPROJECTIONINVERSETRANSPOSE'
    ];
    var enabledAttributeList = {};
    var SHADER_STATE_TO_ENABLE = 1;
    var SHADER_STATE_KEEP_ENABLE = 2;
    var SHADER_STATE_PENDING = 3;
    var Shader = Base.derive(function () {
        return {
            vertex: '',
            fragment: '',
            precision: 'mediump',
            attribSemantics: {},
            matrixSemantics: {},
            matrixSemanticKeys: [],
            uniformTemplates: {},
            attributeTemplates: {},
            vertexDefines: {},
            fragmentDefines: {},
            lightNumber: {},
            _attacheMaterialNumber: 0,
            _uniformList: [],
            _textureStatus: {},
            _vertexProcessed: '',
            _fragmentProcessed: '',
            _currentLocationsMap: {}
        };
    }, function () {
        this._cache = new Cache();
        this._updateShaderString();
    }, {
        setVertex: function (str) {
            this.vertex = str;
            this._updateShaderString();
            this.dirty();
        },
        setFragment: function (str) {
            this.fragment = str;
            this._updateShaderString();
            this.dirty();
        },
        bind: function (_gl) {
            this._cache.use(_gl.__GLID__, getCacheSchema);
            this._currentLocationsMap = this._cache.get('locations');
            if (this._cache.isDirty()) {
                this._updateShaderString();
                var errMsg = this._buildProgram(_gl, this._vertexProcessed, this._fragmentProcessed);
                this._cache.fresh();
                if (errMsg) {
                    return errMsg;
                }
            }
            _gl.useProgram(this._cache.get('program'));
        },
        dirty: function () {
            this._cache.dirtyAll();
            for (var i = 0; i < this._cache._caches.length; i++) {
                if (this._cache._caches[i]) {
                    var context = this._cache._caches[i];
                    context['locations'] = {};
                    context['attriblocations'] = {};
                }
            }
        },
        _updateShaderString: function () {
            if (this.vertex !== this._vertexPrev || this.fragment !== this._fragmentPrev) {
                this._parseImport();
                this.attribSemantics = {};
                this.matrixSemantics = {};
                this._textureStatus = {};
                this._parseUniforms();
                this._parseAttributes();
                this._parseDefines();
                this._vertexPrev = this.vertex;
                this._fragmentPrev = this.fragment;
            }
            this._addDefine();
        },
        define: function (shaderType, symbol, val) {
            val = val !== undefined ? val : null;
            if (shaderType == 'vertex' || shaderType == 'both') {
                if (this.vertexDefines[symbol] !== val) {
                    this.vertexDefines[symbol] = val;
                    this.dirty();
                }
            }
            if (shaderType == 'fragment' || shaderType == 'both') {
                if (this.fragmentDefines[symbol] !== val) {
                    this.fragmentDefines[symbol] = val;
                    if (shaderType !== 'both') {
                        this.dirty();
                    }
                }
            }
        },
        unDefine: function (shaderType, symbol) {
            if (shaderType == 'vertex' || shaderType == 'both') {
                if (this.isDefined('vertex', symbol)) {
                    delete this.vertexDefines[symbol];
                    this.dirty();
                }
            }
            if (shaderType == 'fragment' || shaderType == 'both') {
                if (this.isDefined('fragment', symbol)) {
                    delete this.fragmentDefines[symbol];
                    if (shaderType !== 'both') {
                        this.dirty();
                    }
                }
            }
        },
        isDefined: function (shaderType, symbol) {
            switch (shaderType) {
            case 'vertex':
                return this.vertexDefines[symbol] !== undefined;
            case 'fragment':
                return this.fragmentDefines[symbol] !== undefined;
            }
        },
        getDefine: function (shaderType, symbol) {
            switch (shaderType) {
            case 'vertex':
                return this.vertexDefines[symbol];
            case 'fragment':
                return this.fragmentDefines[symbol];
            }
        },
        enableTexture: function (symbol) {
            var status = this._textureStatus[symbol];
            if (status) {
                var isEnabled = status.enabled;
                if (!isEnabled) {
                    status.enabled = true;
                    this.dirty();
                }
            }
        },
        enableTexturesAll: function () {
            for (var symbol in this._textureStatus) {
                this._textureStatus[symbol].enabled = true;
            }
            this.dirty();
        },
        disableTexture: function (symbol) {
            var status = this._textureStatus[symbol];
            if (status) {
                var isDisabled = !status.enabled;
                if (!isDisabled) {
                    status.enabled = false;
                    this.dirty();
                }
            }
        },
        disableTexturesAll: function () {
            for (var symbol in this._textureStatus) {
                this._textureStatus[symbol].enabled = false;
            }
            this.dirty();
        },
        isTextureEnabled: function (symbol) {
            return this._textureStatus[symbol].enabled;
        },
        getEnabledTextures: function () {
            var enabledTextures = [];
            for (var symbol in this._textureStatus) {
                if (this._textureStatus[symbol].enabled) {
                    enabledTextures.push(symbol);
                }
            }
            return enabledTextures;
        },
        hasUniform: function (symbol) {
            var location = this._currentLocationsMap[symbol];
            return location !== null && location !== undefined;
        },
        setUniform: function (_gl, type, symbol, value) {
            var locationMap = this._currentLocationsMap;
            var location = locationMap[symbol];
            if (location === null || location === undefined) {
                return false;
            }
            switch (type) {
            case 'm4':
                _gl.uniformMatrix4fv(location, false, value);
                break;
            case '2i':
                _gl.uniform2i(location, value[0], value[1]);
                break;
            case '2f':
                _gl.uniform2f(location, value[0], value[1]);
                break;
            case '3i':
                _gl.uniform3i(location, value[0], value[1], value[2]);
                break;
            case '3f':
                _gl.uniform3f(location, value[0], value[1], value[2]);
                break;
            case '4i':
                _gl.uniform4i(location, value[0], value[1], value[2], value[3]);
                break;
            case '4f':
                _gl.uniform4f(location, value[0], value[1], value[2], value[3]);
                break;
            case '1i':
                _gl.uniform1i(location, value);
                break;
            case '1f':
                _gl.uniform1f(location, value);
                break;
            case '1fv':
                _gl.uniform1fv(location, value);
                break;
            case '1iv':
                _gl.uniform1iv(location, value);
                break;
            case '2iv':
                _gl.uniform2iv(location, value);
                break;
            case '2fv':
                _gl.uniform2fv(location, value);
                break;
            case '3iv':
                _gl.uniform3iv(location, value);
                break;
            case '3fv':
                _gl.uniform3fv(location, value);
                break;
            case '4iv':
                _gl.uniform4iv(location, value);
                break;
            case '4fv':
                _gl.uniform4fv(location, value);
                break;
            case 'm2':
            case 'm2v':
                _gl.uniformMatrix2fv(location, false, value);
                break;
            case 'm3':
            case 'm3v':
                _gl.uniformMatrix3fv(location, false, value);
                break;
            case 'm4v':
                if (value instanceof Array) {
                    var array = new Float32Array(value.length * 16);
                    var cursor = 0;
                    for (var i = 0; i < value.length; i++) {
                        var item = value[i];
                        for (var j = 0; j < 16; j++) {
                            array[cursor++] = item[j];
                        }
                    }
                    _gl.uniformMatrix4fv(location, false, array);
                } else if (value instanceof Float32Array) {
                    _gl.uniformMatrix4fv(location, false, value);
                }
                break;
            }
            return true;
        },
        setUniformBySemantic: function (_gl, semantic, val) {
            var semanticInfo = this.attribSemantics[semantic];
            if (semanticInfo) {
                return this.setUniform(_gl, semanticInfo.type, semanticInfo.symbol, val);
            }
            return false;
        },
        enableAttributes: function (_gl, attribList, vao) {
            var program = this._cache.get('program');
            var locationMap = this._cache.get('attriblocations');
            var enabledAttributeListInContext;
            if (vao) {
                enabledAttributeListInContext = vao.__enabledAttributeList;
            } else {
                enabledAttributeListInContext = enabledAttributeList[_gl.__GLID__];
            }
            if (!enabledAttributeListInContext) {
                if (vao) {
                    enabledAttributeListInContext = vao.__enabledAttributeList = [];
                } else {
                    enabledAttributeListInContext = enabledAttributeList[_gl.__GLID__] = [];
                }
            }
            var locationList = [];
            for (var i = 0; i < attribList.length; i++) {
                var symbol = attribList[i];
                if (!this.attributeTemplates[symbol]) {
                    locationList[i] = -1;
                    continue;
                }
                var location = locationMap[symbol];
                if (location === undefined) {
                    location = _gl.getAttribLocation(program, symbol);
                    if (location === -1) {
                        locationList[i] = -1;
                        continue;
                    }
                    locationMap[symbol] = location;
                }
                locationList[i] = location;
                if (!enabledAttributeListInContext[location]) {
                    enabledAttributeListInContext[location] = SHADER_STATE_TO_ENABLE;
                } else {
                    enabledAttributeListInContext[location] = SHADER_STATE_KEEP_ENABLE;
                }
            }
            for (var i = 0; i < enabledAttributeListInContext.length; i++) {
                switch (enabledAttributeListInContext[i]) {
                case SHADER_STATE_TO_ENABLE:
                    _gl.enableVertexAttribArray(i);
                    enabledAttributeListInContext[i] = SHADER_STATE_PENDING;
                    break;
                case SHADER_STATE_KEEP_ENABLE:
                    enabledAttributeListInContext[i] = SHADER_STATE_PENDING;
                    break;
                case SHADER_STATE_PENDING:
                    _gl.disableVertexAttribArray(i);
                    enabledAttributeListInContext[i] = 0;
                    break;
                }
            }
            return locationList;
        },
        _parseImport: function () {
            this._vertexProcessedNoDefine = Shader.parseImport(this.vertex);
            this._fragmentProcessedNoDefine = Shader.parseImport(this.fragment);
        },
        _addDefine: function () {
            var defineStr = [];
            for (var lightType in this.lightNumber) {
                var count = this.lightNumber[lightType];
                if (count > 0) {
                    defineStr.push('#define ' + lightType.toUpperCase() + '_NUMBER ' + count);
                }
            }
            for (var symbol in this._textureStatus) {
                var status = this._textureStatus[symbol];
                if (status.enabled) {
                    defineStr.push('#define ' + symbol.toUpperCase() + '_ENABLED');
                }
            }
            for (var symbol in this.vertexDefines) {
                var value = this.vertexDefines[symbol];
                if (value === null) {
                    defineStr.push('#define ' + symbol);
                } else {
                    defineStr.push('#define ' + symbol + ' ' + value.toString());
                }
            }
            this._vertexProcessed = defineStr.join('\n') + '\n' + this._vertexProcessedNoDefine;
            defineStr = [];
            for (var lightType in this.lightNumber) {
                var count = this.lightNumber[lightType];
                if (count > 0) {
                    defineStr.push('#define ' + lightType.toUpperCase() + '_NUMBER ' + count);
                }
            }
            for (var symbol in this._textureStatus) {
                var status = this._textureStatus[symbol];
                if (status.enabled) {
                    defineStr.push('#define ' + symbol.toUpperCase() + '_ENABLED');
                }
            }
            for (var symbol in this.fragmentDefines) {
                var value = this.fragmentDefines[symbol];
                if (value === null) {
                    defineStr.push('#define ' + symbol);
                } else {
                    defineStr.push('#define ' + symbol + ' ' + value.toString());
                }
            }
            var code = defineStr.join('\n') + '\n' + this._fragmentProcessedNoDefine;
            this._fragmentProcessed = [
                'precision',
                this.precision,
                'float'
            ].join(' ') + ';\n' + code;
        },
        _parseUniforms: function () {
            var uniforms = {};
            var self = this;
            var shaderType = 'vertex';
            this._uniformList = [];
            this._vertexProcessedNoDefine = this._vertexProcessedNoDefine.replace(uniformRegex, _uniformParser);
            shaderType = 'fragment';
            this._fragmentProcessedNoDefine = this._fragmentProcessedNoDefine.replace(uniformRegex, _uniformParser);
            self.matrixSemanticKeys = Object.keys(this.matrixSemantics);
            function _uniformParser(str, type, symbol, isArray, semanticWrapper, semantic) {
                if (type && symbol) {
                    var uniformType = uniformTypeMap[type];
                    var isConfigurable = true;
                    var defaultValueFunc;
                    if (uniformType) {
                        self._uniformList.push(symbol);
                        if (type === 'sampler2D' || type === 'samplerCube') {
                            self._textureStatus[symbol] = {
                                enabled: false,
                                shaderType: shaderType
                            };
                        }
                        if (isArray) {
                            uniformType += 'v';
                        }
                        if (semantic) {
                            if (attribSemantics.indexOf(semantic) >= 0) {
                                self.attribSemantics[semantic] = {
                                    symbol: symbol,
                                    type: uniformType
                                };
                                isConfigurable = false;
                            } else if (matrixSemantics.indexOf(semantic) >= 0) {
                                var isTranspose = false;
                                var semanticNoTranspose = semantic;
                                if (semantic.match(/TRANSPOSE$/)) {
                                    isTranspose = true;
                                    semanticNoTranspose = semantic.slice(0, -9);
                                }
                                self.matrixSemantics[semantic] = {
                                    symbol: symbol,
                                    type: uniformType,
                                    isTranspose: isTranspose,
                                    semanticNoTranspose: semanticNoTranspose
                                };
                                isConfigurable = false;
                            } else {
                                if (semantic === 'unconfigurable') {
                                    isConfigurable = false;
                                } else {
                                    defaultValueFunc = self._parseDefaultValue(type, semantic);
                                    if (!defaultValueFunc) {
                                        throw new Error('Unkown semantic "' + semantic + '"');
                                    } else {
                                        semantic = '';
                                    }
                                }
                            }
                        }
                        if (isConfigurable) {
                            uniforms[symbol] = {
                                type: uniformType,
                                value: isArray ? uniformValueConstructor['array'] : defaultValueFunc || uniformValueConstructor[type],
                                semantic: semantic || null
                            };
                        }
                    }
                    return [
                        'uniform',
                        type,
                        symbol,
                        isArray
                    ].join(' ') + ';\n';
                }
            }
            this.uniformTemplates = uniforms;
        },
        _parseDefaultValue: function (type, str) {
            var arrayRegex = /\[\s*(.*)\s*\]/;
            if (type === 'vec2' || type === 'vec3' || type === 'vec4') {
                var arrayStr = arrayRegex.exec(str)[1];
                if (arrayStr) {
                    var arr = arrayStr.split(/\s*,\s*/);
                    return function () {
                        return new Float32Array(arr);
                    };
                } else {
                    return;
                }
            } else if (type === 'bool') {
                return function () {
                    return str.toLowerCase() === 'true' ? true : false;
                };
            } else if (type === 'float') {
                return function () {
                    return parseFloat(str);
                };
            }
        },
        createUniforms: function () {
            var uniforms = {};
            for (var symbol in this.uniformTemplates) {
                var uniformTpl = this.uniformTemplates[symbol];
                uniforms[symbol] = {
                    type: uniformTpl.type,
                    value: uniformTpl.value()
                };
            }
            return uniforms;
        },
        attached: function () {
            this._attacheMaterialNumber++;
        },
        detached: function () {
            this._attacheMaterialNumber--;
        },
        isAttachedToAny: function () {
            return this._attacheMaterialNumber !== 0;
        },
        _parseAttributes: function () {
            var attributes = {};
            var self = this;
            this._vertexProcessedNoDefine = this._vertexProcessedNoDefine.replace(attributeRegex, _attributeParser);
            function _attributeParser(str, type, symbol, semanticWrapper, semantic) {
                if (type && symbol) {
                    var size = 1;
                    switch (type) {
                    case 'vec4':
                        size = 4;
                        break;
                    case 'vec3':
                        size = 3;
                        break;
                    case 'vec2':
                        size = 2;
                        break;
                    case 'float':
                        size = 1;
                        break;
                    }
                    attributes[symbol] = {
                        type: 'float',
                        size: size,
                        semantic: semantic || null
                    };
                    if (semantic) {
                        if (attribSemantics.indexOf(semantic) < 0) {
                            throw new Error('Unkown semantic "' + semantic + '"');
                        } else {
                            self.attribSemantics[semantic] = {
                                symbol: symbol,
                                type: type
                            };
                        }
                    }
                }
                return [
                    'attribute',
                    type,
                    symbol
                ].join(' ') + ';\n';
            }
            this.attributeTemplates = attributes;
        },
        _parseDefines: function () {
            var self = this;
            var shaderType = 'vertex';
            this._vertexProcessedNoDefine = this._vertexProcessedNoDefine.replace(defineRegex, _defineParser);
            shaderType = 'fragment';
            this._fragmentProcessedNoDefine = this._fragmentProcessedNoDefine.replace(defineRegex, _defineParser);
            function _defineParser(str, symbol, value) {
                var defines = shaderType === 'vertex' ? self.vertexDefines : self.fragmentDefines;
                if (!defines[symbol]) {
                    if (value == 'false') {
                        defines[symbol] = false;
                    } else if (value == 'true') {
                        defines[symbol] = true;
                    } else {
                        defines[symbol] = value ? parseFloat(value) : null;
                    }
                }
                return '';
            }
        },
        _buildProgram: function (_gl, vertexShaderString, fragmentShaderString) {
            if (this._cache.get('program')) {
                _gl.deleteProgram(this._cache.get('program'));
            }
            var program = _gl.createProgram();
            var vertexShader = _gl.createShader(_gl.VERTEX_SHADER);
            _gl.shaderSource(vertexShader, vertexShaderString);
            _gl.compileShader(vertexShader);
            var fragmentShader = _gl.createShader(_gl.FRAGMENT_SHADER);
            _gl.shaderSource(fragmentShader, fragmentShaderString);
            _gl.compileShader(fragmentShader);
            var msg = this._checkShaderErrorMsg(_gl, vertexShader, vertexShaderString);
            if (msg) {
                return msg;
            }
            msg = this._checkShaderErrorMsg(_gl, fragmentShader, fragmentShaderString);
            if (msg) {
                return msg;
            }
            _gl.attachShader(program, vertexShader);
            _gl.attachShader(program, fragmentShader);
            if (this.attribSemantics['POSITION']) {
                _gl.bindAttribLocation(program, 0, this.attribSemantics['POSITION'].symbol);
            } else {
                var keys = Object.keys(this.attributeTemplates);
                _gl.bindAttribLocation(program, 0, keys[0]);
            }
            _gl.linkProgram(program);
            if (!_gl.getProgramParameter(program, _gl.LINK_STATUS)) {
                return 'Could not link program\n' + 'VALIDATE_STATUS: ' + _gl.getProgramParameter(program, _gl.VALIDATE_STATUS) + ', gl error [' + _gl.getError() + ']';
            }
            for (var i = 0; i < this._uniformList.length; i++) {
                var uniformSymbol = this._uniformList[i];
                var locationMap = this._cache.get('locations');
                locationMap[uniformSymbol] = _gl.getUniformLocation(program, uniformSymbol);
            }
            _gl.deleteShader(vertexShader);
            _gl.deleteShader(fragmentShader);
            this._cache.put('program', program);
        },
        _checkShaderErrorMsg: function (_gl, shader, shaderString) {
            if (!_gl.getShaderParameter(shader, _gl.COMPILE_STATUS)) {
                return [
                    _gl.getShaderInfoLog(shader),
                    addLineNumbers(shaderString)
                ].join('\n');
            }
        },
        clone: function () {
            var shader = new Shader({
                vertex: this.vertex,
                fragment: this.fragment,
                vertexDefines: util.clone(this.vertexDefines),
                fragmentDefines: util.clone(this.fragmentDefines)
            });
            for (var name in this._textureStatus) {
                shader._textureStatus[name] = util.clone(this._textureStatus[name]);
            }
            return shader;
        },
        dispose: function (_gl) {
            this._cache.use(_gl.__GLID__);
            var program = this._cache.get('program');
            if (program) {
                _gl.deleteProgram(program);
            }
            this._cache.deleteContext(_gl.__GLID__);
            this._locations = {};
        }
    });
    function getCacheSchema() {
        return {
            locations: {},
            attriblocations: {}
        };
    }
    function addLineNumbers(string) {
        var chunks = string.split('\n');
        for (var i = 0, il = chunks.length; i < il; i++) {
            chunks[i] = i + 1 + ': ' + chunks[i];
        }
        return chunks.join('\n');
    }
    var importRegex = /(@import)\s*([0-9a-zA-Z_\-\.]*)/g;
    Shader.parseImport = function (shaderStr) {
        shaderStr = shaderStr.replace(importRegex, function (str, importSymbol, importName) {
            var str = Shader.source(importName);
            if (str) {
                return Shader.parseImport(str);
            } else {
                console.warn('Shader chunk "' + importName + '" not existed in library');
                return '';
            }
        });
        return shaderStr;
    };
    var exportRegex = /(@export)\s*([0-9a-zA-Z_\-\.]*)\s*\n([\s\S]*?)@end/g;
    Shader['import'] = function (shaderStr) {
        shaderStr.replace(exportRegex, function (str, exportSymbol, exportName, code) {
            var code = code.replace(/(^[\s\t\xa0\u3000]+)|([\u3000\xa0\s\t]+\x24)/g, '');
            if (code) {
                var parts = exportName.split('.');
                var obj = Shader.codes;
                var i = 0;
                var key;
                while (i < parts.length - 1) {
                    key = parts[i++];
                    if (!obj[key]) {
                        obj[key] = {};
                    }
                    obj = obj[key];
                }
                key = parts[i];
                obj[key] = code;
            }
            return code;
        });
    };
    Shader.codes = {};
    Shader.source = function (name) {
        var parts = name.split('.');
        var obj = Shader.codes;
        var i = 0;
        while (obj && i < parts.length) {
            var key = parts[i++];
            obj = obj[key];
        }
        if (!obj) {
            console.warn('Shader "' + name + '" not existed in library');
            return;
        }
        return obj;
    };
    return Shader;
});define('qtek/Texture2D', [
    'require',
    './Texture',
    './core/glinfo',
    './core/glenum'
], function (require) {
    var Texture = require('./Texture');
    var glinfo = require('./core/glinfo');
    var glenum = require('./core/glenum');
    var Texture2D = Texture.derive(function () {
        return {
            image: null,
            pixels: null,
            mipmaps: []
        };
    }, {
        update: function (_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, this._cache.get('webgl_texture'));
            this.beforeUpdate(_gl);
            var glFormat = this.format;
            var glType = this.type;
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, this.wrapS);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, this.wrapT);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, this.magFilter);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, this.minFilter);
            var anisotropicExt = glinfo.getExtension(_gl, 'EXT_texture_filter_anisotropic');
            if (anisotropicExt && this.anisotropic > 1) {
                _gl.texParameterf(_gl.TEXTURE_2D, anisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic);
            }
            if (glType === 36193) {
                var halfFloatExt = glinfo.getExtension(_gl, 'OES_texture_half_float');
                if (!halfFloatExt) {
                    glType = glenum.FLOAT;
                }
            }
            if (this.mipmaps.length) {
                var width = this.width;
                var height = this.height;
                for (var i = 0; i < this.mipmaps.length; i++) {
                    var mipmap = this.mipmaps[i];
                    this._updateTextureData(_gl, mipmap, i, width, height, glFormat, glType);
                    width /= 2;
                    height /= 2;
                }
            } else {
                this._updateTextureData(_gl, this, 0, this.width, this.height, glFormat, glType);
                if (this.useMipmap && !this.NPOT) {
                    _gl.generateMipmap(_gl.TEXTURE_2D);
                }
            }
            _gl.bindTexture(_gl.TEXTURE_2D, null);
        },
        _updateTextureData: function (_gl, data, level, width, height, glFormat, glType) {
            if (data.image) {
                _gl.texImage2D(_gl.TEXTURE_2D, level, glFormat, glFormat, glType, data.image);
            } else {
                if (glFormat <= Texture.COMPRESSED_RGBA_S3TC_DXT5_EXT && glFormat >= Texture.COMPRESSED_RGB_S3TC_DXT1_EXT) {
                    _gl.compressedTexImage2D(_gl.TEXTURE_2D, level, glFormat, width, height, 0, data.pixels);
                } else {
                    _gl.texImage2D(_gl.TEXTURE_2D, level, glFormat, width, height, 0, glFormat, glType, data.pixels);
                }
            }
        },
        generateMipmap: function (_gl) {
            if (this.useMipmap && !this.NPOT) {
                _gl.bindTexture(_gl.TEXTURE_2D, this._cache.get('webgl_texture'));
                _gl.generateMipmap(_gl.TEXTURE_2D);
            }
        },
        isPowerOfTwo: function () {
            var width;
            var height;
            if (this.image) {
                width = this.image.width;
                height = this.image.height;
            } else {
                width = this.width;
                height = this.height;
            }
            return (width & width - 1) === 0 && (height & height - 1) === 0;
        },
        isRenderable: function () {
            if (this.image) {
                return this.image.nodeName === 'CANVAS' || this.image.complete;
            } else {
                return this.width && this.height;
            }
        },
        bind: function (_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, this.getWebGLTexture(_gl));
        },
        unbind: function (_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, null);
        },
        load: function (src) {
            var image = new Image();
            var self = this;
            image.onload = function () {
                self.dirty();
                self.trigger('success', self);
                image.onload = null;
            };
            image.onerror = function () {
                self.trigger('error', self);
                image.onerror = null;
            };
            image.src = src;
            this.image = image;
            return this;
        }
    });
    return Texture2D;
});define('qtek/core/glenum', [], function () {
    return {
        DEPTH_BUFFER_BIT: 256,
        STENCIL_BUFFER_BIT: 1024,
        COLOR_BUFFER_BIT: 16384,
        POINTS: 0,
        LINES: 1,
        LINE_LOOP: 2,
        LINE_STRIP: 3,
        TRIANGLES: 4,
        TRIANGLE_STRIP: 5,
        TRIANGLE_FAN: 6,
        ZERO: 0,
        ONE: 1,
        SRC_COLOR: 768,
        ONE_MINUS_SRC_COLOR: 769,
        SRC_ALPHA: 770,
        ONE_MINUS_SRC_ALPHA: 771,
        DST_ALPHA: 772,
        ONE_MINUS_DST_ALPHA: 773,
        DST_COLOR: 774,
        ONE_MINUS_DST_COLOR: 775,
        SRC_ALPHA_SATURATE: 776,
        FUNC_ADD: 32774,
        BLEND_EQUATION: 32777,
        BLEND_EQUATION_RGB: 32777,
        BLEND_EQUATION_ALPHA: 34877,
        FUNC_SUBTRACT: 32778,
        FUNC_REVERSE_SUBTRACT: 32779,
        BLEND_DST_RGB: 32968,
        BLEND_SRC_RGB: 32969,
        BLEND_DST_ALPHA: 32970,
        BLEND_SRC_ALPHA: 32971,
        CONSTANT_COLOR: 32769,
        ONE_MINUS_CONSTANT_COLOR: 32770,
        CONSTANT_ALPHA: 32771,
        ONE_MINUS_CONSTANT_ALPHA: 32772,
        BLEND_COLOR: 32773,
        ARRAY_BUFFER: 34962,
        ELEMENT_ARRAY_BUFFER: 34963,
        ARRAY_BUFFER_BINDING: 34964,
        ELEMENT_ARRAY_BUFFER_BINDING: 34965,
        STREAM_DRAW: 35040,
        STATIC_DRAW: 35044,
        DYNAMIC_DRAW: 35048,
        BUFFER_SIZE: 34660,
        BUFFER_USAGE: 34661,
        CURRENT_VERTEX_ATTRIB: 34342,
        FRONT: 1028,
        BACK: 1029,
        FRONT_AND_BACK: 1032,
        CULL_FACE: 2884,
        BLEND: 3042,
        DITHER: 3024,
        STENCIL_TEST: 2960,
        DEPTH_TEST: 2929,
        SCISSOR_TEST: 3089,
        POLYGON_OFFSET_FILL: 32823,
        SAMPLE_ALPHA_TO_COVERAGE: 32926,
        SAMPLE_COVERAGE: 32928,
        NO_ERROR: 0,
        INVALID_ENUM: 1280,
        INVALID_VALUE: 1281,
        INVALID_OPERATION: 1282,
        OUT_OF_MEMORY: 1285,
        CW: 2304,
        CCW: 2305,
        LINE_WIDTH: 2849,
        ALIASED_POINT_SIZE_RANGE: 33901,
        ALIASED_LINE_WIDTH_RANGE: 33902,
        CULL_FACE_MODE: 2885,
        FRONT_FACE: 2886,
        DEPTH_RANGE: 2928,
        DEPTH_WRITEMASK: 2930,
        DEPTH_CLEAR_VALUE: 2931,
        DEPTH_FUNC: 2932,
        STENCIL_CLEAR_VALUE: 2961,
        STENCIL_FUNC: 2962,
        STENCIL_FAIL: 2964,
        STENCIL_PASS_DEPTH_FAIL: 2965,
        STENCIL_PASS_DEPTH_PASS: 2966,
        STENCIL_REF: 2967,
        STENCIL_VALUE_MASK: 2963,
        STENCIL_WRITEMASK: 2968,
        STENCIL_BACK_FUNC: 34816,
        STENCIL_BACK_FAIL: 34817,
        STENCIL_BACK_PASS_DEPTH_FAIL: 34818,
        STENCIL_BACK_PASS_DEPTH_PASS: 34819,
        STENCIL_BACK_REF: 36003,
        STENCIL_BACK_VALUE_MASK: 36004,
        STENCIL_BACK_WRITEMASK: 36005,
        VIEWPORT: 2978,
        SCISSOR_BOX: 3088,
        COLOR_CLEAR_VALUE: 3106,
        COLOR_WRITEMASK: 3107,
        UNPACK_ALIGNMENT: 3317,
        PACK_ALIGNMENT: 3333,
        MAX_TEXTURE_SIZE: 3379,
        MAX_VIEWPORT_DIMS: 3386,
        SUBPIXEL_BITS: 3408,
        RED_BITS: 3410,
        GREEN_BITS: 3411,
        BLUE_BITS: 3412,
        ALPHA_BITS: 3413,
        DEPTH_BITS: 3414,
        STENCIL_BITS: 3415,
        POLYGON_OFFSET_UNITS: 10752,
        POLYGON_OFFSET_FACTOR: 32824,
        TEXTURE_BINDING_2D: 32873,
        SAMPLE_BUFFERS: 32936,
        SAMPLES: 32937,
        SAMPLE_COVERAGE_VALUE: 32938,
        SAMPLE_COVERAGE_INVERT: 32939,
        COMPRESSED_TEXTURE_FORMATS: 34467,
        DONT_CARE: 4352,
        FASTEST: 4353,
        NICEST: 4354,
        GENERATE_MIPMAP_HINT: 33170,
        BYTE: 5120,
        UNSIGNED_BYTE: 5121,
        SHORT: 5122,
        UNSIGNED_SHORT: 5123,
        INT: 5124,
        UNSIGNED_INT: 5125,
        FLOAT: 5126,
        DEPTH_COMPONENT: 6402,
        ALPHA: 6406,
        RGB: 6407,
        RGBA: 6408,
        LUMINANCE: 6409,
        LUMINANCE_ALPHA: 6410,
        UNSIGNED_SHORT_4_4_4_4: 32819,
        UNSIGNED_SHORT_5_5_5_1: 32820,
        UNSIGNED_SHORT_5_6_5: 33635,
        FRAGMENT_SHADER: 35632,
        VERTEX_SHADER: 35633,
        MAX_VERTEX_ATTRIBS: 34921,
        MAX_VERTEX_UNIFORM_VECTORS: 36347,
        MAX_VARYING_VECTORS: 36348,
        MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661,
        MAX_VERTEX_TEXTURE_IMAGE_UNITS: 35660,
        MAX_TEXTURE_IMAGE_UNITS: 34930,
        MAX_FRAGMENT_UNIFORM_VECTORS: 36349,
        SHADER_TYPE: 35663,
        DELETE_STATUS: 35712,
        LINK_STATUS: 35714,
        VALIDATE_STATUS: 35715,
        ATTACHED_SHADERS: 35717,
        ACTIVE_UNIFORMS: 35718,
        ACTIVE_ATTRIBUTES: 35721,
        SHADING_LANGUAGE_VERSION: 35724,
        CURRENT_PROGRAM: 35725,
        NEVER: 512,
        LESS: 513,
        EQUAL: 514,
        LEQUAL: 515,
        GREATER: 516,
        NOTEQUAL: 517,
        GEQUAL: 518,
        ALWAYS: 519,
        KEEP: 7680,
        REPLACE: 7681,
        INCR: 7682,
        DECR: 7683,
        INVERT: 5386,
        INCR_WRAP: 34055,
        DECR_WRAP: 34056,
        VENDOR: 7936,
        RENDERER: 7937,
        VERSION: 7938,
        NEAREST: 9728,
        LINEAR: 9729,
        NEAREST_MIPMAP_NEAREST: 9984,
        LINEAR_MIPMAP_NEAREST: 9985,
        NEAREST_MIPMAP_LINEAR: 9986,
        LINEAR_MIPMAP_LINEAR: 9987,
        TEXTURE_MAG_FILTER: 10240,
        TEXTURE_MIN_FILTER: 10241,
        TEXTURE_WRAP_S: 10242,
        TEXTURE_WRAP_T: 10243,
        TEXTURE_2D: 3553,
        TEXTURE: 5890,
        TEXTURE_CUBE_MAP: 34067,
        TEXTURE_BINDING_CUBE_MAP: 34068,
        TEXTURE_CUBE_MAP_POSITIVE_X: 34069,
        TEXTURE_CUBE_MAP_NEGATIVE_X: 34070,
        TEXTURE_CUBE_MAP_POSITIVE_Y: 34071,
        TEXTURE_CUBE_MAP_NEGATIVE_Y: 34072,
        TEXTURE_CUBE_MAP_POSITIVE_Z: 34073,
        TEXTURE_CUBE_MAP_NEGATIVE_Z: 34074,
        MAX_CUBE_MAP_TEXTURE_SIZE: 34076,
        TEXTURE0: 33984,
        TEXTURE1: 33985,
        TEXTURE2: 33986,
        TEXTURE3: 33987,
        TEXTURE4: 33988,
        TEXTURE5: 33989,
        TEXTURE6: 33990,
        TEXTURE7: 33991,
        TEXTURE8: 33992,
        TEXTURE9: 33993,
        TEXTURE10: 33994,
        TEXTURE11: 33995,
        TEXTURE12: 33996,
        TEXTURE13: 33997,
        TEXTURE14: 33998,
        TEXTURE15: 33999,
        TEXTURE16: 34000,
        TEXTURE17: 34001,
        TEXTURE18: 34002,
        TEXTURE19: 34003,
        TEXTURE20: 34004,
        TEXTURE21: 34005,
        TEXTURE22: 34006,
        TEXTURE23: 34007,
        TEXTURE24: 34008,
        TEXTURE25: 34009,
        TEXTURE26: 34010,
        TEXTURE27: 34011,
        TEXTURE28: 34012,
        TEXTURE29: 34013,
        TEXTURE30: 34014,
        TEXTURE31: 34015,
        ACTIVE_TEXTURE: 34016,
        REPEAT: 10497,
        CLAMP_TO_EDGE: 33071,
        MIRRORED_REPEAT: 33648,
        FLOAT_VEC2: 35664,
        FLOAT_VEC3: 35665,
        FLOAT_VEC4: 35666,
        INT_VEC2: 35667,
        INT_VEC3: 35668,
        INT_VEC4: 35669,
        BOOL: 35670,
        BOOL_VEC2: 35671,
        BOOL_VEC3: 35672,
        BOOL_VEC4: 35673,
        FLOAT_MAT2: 35674,
        FLOAT_MAT3: 35675,
        FLOAT_MAT4: 35676,
        SAMPLER_2D: 35678,
        SAMPLER_CUBE: 35680,
        VERTEX_ATTRIB_ARRAY_ENABLED: 34338,
        VERTEX_ATTRIB_ARRAY_SIZE: 34339,
        VERTEX_ATTRIB_ARRAY_STRIDE: 34340,
        VERTEX_ATTRIB_ARRAY_TYPE: 34341,
        VERTEX_ATTRIB_ARRAY_NORMALIZED: 34922,
        VERTEX_ATTRIB_ARRAY_POINTER: 34373,
        VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: 34975,
        COMPILE_STATUS: 35713,
        LOW_FLOAT: 36336,
        MEDIUM_FLOAT: 36337,
        HIGH_FLOAT: 36338,
        LOW_INT: 36339,
        MEDIUM_INT: 36340,
        HIGH_INT: 36341,
        FRAMEBUFFER: 36160,
        RENDERBUFFER: 36161,
        RGBA4: 32854,
        RGB5_A1: 32855,
        RGB565: 36194,
        DEPTH_COMPONENT16: 33189,
        STENCIL_INDEX: 6401,
        STENCIL_INDEX8: 36168,
        DEPTH_STENCIL: 34041,
        RENDERBUFFER_WIDTH: 36162,
        RENDERBUFFER_HEIGHT: 36163,
        RENDERBUFFER_INTERNAL_FORMAT: 36164,
        RENDERBUFFER_RED_SIZE: 36176,
        RENDERBUFFER_GREEN_SIZE: 36177,
        RENDERBUFFER_BLUE_SIZE: 36178,
        RENDERBUFFER_ALPHA_SIZE: 36179,
        RENDERBUFFER_DEPTH_SIZE: 36180,
        RENDERBUFFER_STENCIL_SIZE: 36181,
        FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE: 36048,
        FRAMEBUFFER_ATTACHMENT_OBJECT_NAME: 36049,
        FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL: 36050,
        FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE: 36051,
        COLOR_ATTACHMENT0: 36064,
        DEPTH_ATTACHMENT: 36096,
        STENCIL_ATTACHMENT: 36128,
        DEPTH_STENCIL_ATTACHMENT: 33306,
        NONE: 0,
        FRAMEBUFFER_COMPLETE: 36053,
        FRAMEBUFFER_INCOMPLETE_ATTACHMENT: 36054,
        FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 36055,
        FRAMEBUFFER_INCOMPLETE_DIMENSIONS: 36057,
        FRAMEBUFFER_UNSUPPORTED: 36061,
        FRAMEBUFFER_BINDING: 36006,
        RENDERBUFFER_BINDING: 36007,
        MAX_RENDERBUFFER_SIZE: 34024,
        INVALID_FRAMEBUFFER_OPERATION: 1286,
        UNPACK_FLIP_Y_WEBGL: 37440,
        UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37441,
        CONTEXT_LOST_WEBGL: 37442,
        UNPACK_COLORSPACE_CONVERSION_WEBGL: 37443,
        BROWSER_DEFAULT_WEBGL: 37444
    };
});;
define('echarts-x/util/shader/albedo.essl', function() { return '@export ecx.albedo.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform vec2 uvRepeat: [1, 1];\n\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 position: POSITION;\n\n#ifdef VERTEX_COLOR\nattribute vec4 a_Color : COLOR;\nvarying vec4 v_Color;\n#endif\n\nvarying vec2 v_Texcoord;\n\nvoid main()\n{\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n    v_Texcoord = texcoord * uvRepeat;\n\n    #ifdef VERTEX_COLOR\n    v_Color = a_Color;\n    #endif\n}\n\n@end\n\n@export ecx.albedo.fragment\n\nuniform sampler2D diffuseMap;\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\n#ifdef VERTEX_COLOR\nvarying vec4 v_Color;\n#endif\n\nvarying vec2 v_Texcoord;\n\nvoid main()\n{\n    gl_FragColor = vec4(color, alpha);\n    \n    #ifdef VERTEX_COLOR\n        gl_FragColor *= v_Color;\n    #endif\n    #ifdef DIFFUSEMAP_ENABLED\n        vec4 tex = texture2D(diffuseMap, v_Texcoord);\n        // Premultiplied alpha\n        #ifdef PREMULTIPLIED_ALPHA\n        tex.rgb /= tex.a;\n        #endif\n        gl_FragColor *= tex;\n    #endif\n}\n@end'});
;
define('echarts-x/util/shader/points.essl', function() { return '@export ecx.points.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform float elapsedTime : 0;\n\nattribute vec3 position : POSITION;\nattribute vec4 color : COLOR;\nattribute float size;\n\n#ifdef ANIMATING\nattribute float delay;\n#endif\n\nvarying vec4 v_Color;\n\nvoid main()\n{\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n\n    #ifdef ANIMATING\n        gl_PointSize = size * (sin((elapsedTime + delay) * 3.14) * 0.5 + 1.0);\n    #else\n        gl_PointSize = size;\n    #endif\n\n    v_Color = color;\n}\n\n@end\n\n@export ecx.points.fragment\n\nvarying vec4 v_Color;\nuniform sampler2D sprite;\n\nvoid main()\n{\n    vec4 color = v_Color;\n\n    #ifdef SPRITE_ENABLED\n        color *= texture2D(sprite, gl_PointCoord);\n    #endif\n\n    gl_FragColor = color;\n}\n@end'});
;
define('echarts-x/util/shader/curveAnimatingPoints.essl', function() { return '@export ecx.curveAnimatingPoints.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform float percent : 0.0;\nuniform float pointSize : 2.0;\n\nattribute vec3 p0;\nattribute vec3 p1;\nattribute vec3 p2;\nattribute vec3 p3;\nattribute vec4 color : COLOR;\n\nattribute float offset;\nattribute float size;\n\nvarying vec4 v_Color;\n\nvoid main()\n{\n    float t = mod(offset + percent, 1.0);\n    float onet = 1.0 - t;\n    vec3 position = onet * onet * (onet * p0 + 3.0 * t * p1)\n        + t * t * (t * p3 + 3.0 * onet * p2);\n\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n\n    gl_PointSize = pointSize * size;\n\n    v_Color = color;\n}\n\n@end\n\n@export ecx.curveAnimatingPoints.fragment\n\nvarying vec4 v_Color;\n\nvoid main()\n{\n    gl_FragColor = v_Color;\n}\n@end'});
;
define('echarts-x/util/shader/vectorFieldParticle.essl', function() { return '@export ecx.vfParticle.particle.fragment\n\nuniform sampler2D particleTexture;\nuniform sampler2D spawnTexture;\nuniform sampler2D velocityTexture;\n\nuniform float deltaTime;\nuniform float elapsedTime;\n\nuniform float speedScaling : 1.0;\n\nvarying vec2 v_Texcoord;\n\nvoid main()\n{\n    vec4 p = texture2D(particleTexture, v_Texcoord);\n    if (p.w > 0.0) {\n        vec4 vTex = texture2D(velocityTexture, p.xy);\n        vec2 v = vTex.xy;\n        v = (v - 0.5) * 2.0;\n        p.z = length(v);\n        p.xy += v * deltaTime / 50.0 * speedScaling;\n        // Make the particle surface seamless \n        p.xy = fract(p.xy);\n        p.w -= deltaTime;\n    }\n    else {\n        p = texture2D(spawnTexture, fract(v_Texcoord + elapsedTime / 10.0));\n        p.z = 0.0;\n    }\n    gl_FragColor = p;\n}\n@end\n\n@export ecx.vfParticle.renderPoints.vertex\n\n#define PI 3.1415926\n\nattribute vec2 texcoord : TEXCOORD_0;\n\nuniform sampler2D particleTexture;\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nuniform float sizeScaling : 1.0;\n\nvoid main()\n{\n    vec4 p = texture2D(particleTexture, texcoord);\n\n    if (p.w > 0.0) {\n        gl_Position = worldViewProjection * vec4(p.xy * 2.0 - 1.0, 0.0, 1.0);\n    }\n    else {\n        gl_Position = vec4(100000.0, 100000.0, 100000.0, 1.0);\n    }\n\n    gl_PointSize = sizeScaling * p.z;\n}\n\n@end\n\n@export ecx.vfParticle.renderPoints.fragment\n\nuniform sampler2D spriteTexture;\nuniform vec4 color : [1.0, 1.0, 1.0, 1.0];\n\nvoid main()\n{\n    gl_FragColor = color * texture2D(spriteTexture, gl_PointCoord);\n}\n\n@end\n'});
;
define('echarts-x/util/shader/lambert.essl', function() { return '/**\n * http://en.wikipedia.org/wiki/Lambertian_reflectance\n */\n\n@export ecx.lambert.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;\nuniform mat4 world : WORLD;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\nuniform vec2 uvOffset : [0.0, 0.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 normal : NORMAL;\n\nvarying vec2 v_Texcoord;\n\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\nvoid main()\n{\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n\n    v_Texcoord = texcoord * uvRepeat + uvOffset;\n\n    v_Normal = normalize((worldInverseTranspose * vec4(normal, 0.0)).xyz);\n    v_WorldPosition = (world * vec4(position, 1.0)).xyz;\n}\n\n@end\n\n\n@export ecx.lambert.fragment\n\n#define PI 3.14159265358979\n\n#extension GL_OES_standard_derivatives : enable\n\nvarying vec2 v_Texcoord;\n\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\n#ifdef DIFFUSEMAP_ENABLED\nuniform sampler2D diffuseMap;\n#endif\n\n#ifdef BUMPMAP_ENABLED\nuniform sampler2D bumpMap;\nuniform float bumpScale : 1.0;\n// Derivative maps - bump mapping unparametrized surfaces by Morten Mikkelsen\n//  http://mmikkelsen3d.blogspot.sk/2011/07/derivative-maps.html\n\n// Evaluate the derivative of the height w.r.t. screen-space using forward differencing (listing 2)\n\nvec3 perturbNormalArb(vec3 surfPos, vec3 surfNormal, vec3 baseNormal)\n{\n    vec2 dSTdx = dFdx(v_Texcoord);\n    vec2 dSTdy = dFdy(v_Texcoord);\n\n    float Hll = bumpScale * texture2D(bumpMap, v_Texcoord).x;\n    float dHx = bumpScale * texture2D(bumpMap, v_Texcoord + dSTdx).x - Hll;\n    float dHy = bumpScale * texture2D(bumpMap, v_Texcoord + dSTdy).x - Hll;\n\n    vec3 vSigmaX = dFdx(surfPos);\n    vec3 vSigmaY = dFdy(surfPos);\n    vec3 vN = surfNormal;\n\n    vec3 R1 = cross(vSigmaY, vN);\n    vec3 R2 = cross(vN, vSigmaX);\n\n    float fDet = dot(vSigmaX, R1);\n\n    vec3 vGrad = sign(fDet) * (dHx * R1 + dHy * R2);\n    return normalize(abs(fDet) * baseNormal - vGrad);\n\n}\n#endif\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\n#ifdef AMBIENT_LIGHT_NUMBER\n@import buildin.header.ambient_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_NUMBER\n@import buildin.header.directional_light\n#endif\n\nvoid main()\n{\n#ifdef RENDER_TEXCOORD\n    gl_FragColor = vec4(v_Texcoord, 1.0, 1.0);\n    return;\n#endif\n\n    gl_FragColor = vec4(color, alpha);\n\n#ifdef DIFFUSEMAP_ENABLED\n    vec4 tex = texture2D(diffuseMap, v_Texcoord);\n    // Premultiplied alpha\n#ifdef PREMULTIPLIED_ALPHA\n    tex.rgb /= tex.a;\n#endif\n    gl_FragColor *= tex;\n#endif\n\n    vec3 N = v_Normal;\n    vec3 P = v_WorldPosition;\n    float ambientFactor = 1.0;\n#ifdef FLAT\n    // Map plane normal and position to sphere coordinates\n    float theta = (1.0 - v_Texcoord.y) * PI;\n    float phi = v_Texcoord.x * PI * 2.0;\n    float r0 = sin(theta);\n    N = vec3(-cos(phi) * r0, cos(theta), sin(phi) * r0);\n    P = N;\n#endif\n    \n#ifdef BUMPMAP_ENABLED\n    N = perturbNormalArb(v_WorldPosition, v_Normal, N);\n    #ifdef FLAT\n        ambientFactor = dot(P, N);\n    #else\n        ambientFactor = dot(v_Normal, N);\n    #endif\n#endif\n\nvec3 diffuseColor = vec3(0.0, 0.0, 0.0);\n\n#ifdef AMBIENT_LIGHT_NUMBER\n    for(int i = 0; i < AMBIENT_LIGHT_NUMBER; i++)\n    {\n        // Multiply a dot factor to make sure the bump detail can be seen \n        // in the dark side\n        diffuseColor += ambientLightColor[i] * ambientFactor;\n    }\n#endif\n#ifdef DIRECTIONAL_LIGHT_NUMBER\n    for(int i = 0; i < DIRECTIONAL_LIGHT_NUMBER; i++)\n    {\n        vec3 lightDirection = -directionalLightDirection[i];\n        vec3 lightColor = directionalLightColor[i];\n        \n        float ndl = dot(N, normalize(lightDirection));\n\n        float shadowContrib = 1.0;\n        #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n            if(shadowEnabled)\n            {\n                shadowContrib = shadowContribs[i];\n            }\n        #endif\n\n        diffuseColor += lightColor * clamp(ndl, 0.0, 1.0) * shadowContrib;\n    }\n#endif\n\n    gl_FragColor.rgb *= diffuseColor;\n}\n\n@end'});
;
define('echarts-x/util/shader/motionBlur.essl', function() { return '@export ecx.motionBlur.fragment\n\nuniform sampler2D lastFrame;\nuniform sampler2D thisFrame;\n\nuniform float percent: 0.7;\n\nvarying vec2 v_Texcoord;\n\nvoid main()\n{\n    vec4 tex0 = texture2D(lastFrame, v_Texcoord);\n    vec4 tex1 = texture2D(thisFrame, v_Texcoord);\n\n    gl_FragColor = tex0 * percent + tex1;\n}\n\n@end'});
define('qtek/core/Base', [
    'require',
    './mixin/derive',
    './mixin/notifier',
    './util'
], function (require) {
    'use strict';
    var deriveMixin = require('./mixin/derive');
    var notifierMixin = require('./mixin/notifier');
    var util = require('./util');
    var Base = function () {
        this.__GUID__ = util.genGUID();
    };
    Base.__initializers__ = [function (opts) {
            util.extend(this, opts);
        }];
    util.extend(Base, deriveMixin);
    util.extend(Base.prototype, notifierMixin);
    return Base;
});define('qtek/math/Vector3', [
    'require',
    '../dep/glmatrix'
], function (require) {
    'use strict';
    var glMatrix = require('../dep/glmatrix');
    var vec3 = glMatrix.vec3;
    var Vector3 = function (x, y, z) {
        x = x || 0;
        y = y || 0;
        z = z || 0;
        this._array = vec3.fromValues(x, y, z);
        this._dirty = true;
    };
    Vector3.prototype = {
        constructor: Vector3,
        add: function (b) {
            vec3.add(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        set: function (x, y, z) {
            this._array[0] = x;
            this._array[1] = y;
            this._array[2] = z;
            this._dirty = true;
            return this;
        },
        setArray: function (arr) {
            this._array[0] = arr[0];
            this._array[1] = arr[1];
            this._array[2] = arr[2];
            this._dirty = true;
            return this;
        },
        clone: function () {
            return new Vector3(this.x, this.y, this.z);
        },
        copy: function (b) {
            vec3.copy(this._array, b._array);
            this._dirty = true;
            return this;
        },
        cross: function (a, b) {
            vec3.cross(this._array, a._array, b._array);
            this._dirty = true;
            return this;
        },
        dist: function (b) {
            return vec3.dist(this._array, b._array);
        },
        distance: function (b) {
            return vec3.distance(this._array, b._array);
        },
        div: function (b) {
            vec3.div(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        divide: function (b) {
            vec3.divide(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        dot: function (b) {
            return vec3.dot(this._array, b._array);
        },
        len: function () {
            return vec3.len(this._array);
        },
        length: function () {
            return vec3.length(this._array);
        },
        lerp: function (a, b, t) {
            vec3.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },
        min: function (b) {
            vec3.min(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        max: function (b) {
            vec3.max(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        mul: function (b) {
            vec3.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        multiply: function (b) {
            vec3.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        negate: function () {
            vec3.negate(this._array, this._array);
            this._dirty = true;
            return this;
        },
        normalize: function () {
            vec3.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },
        random: function (scale) {
            vec3.random(this._array, scale);
            this._dirty = true;
            return this;
        },
        scale: function (s) {
            vec3.scale(this._array, this._array, s);
            this._dirty = true;
            return this;
        },
        scaleAndAdd: function (b, s) {
            vec3.scaleAndAdd(this._array, this._array, b._array, s);
            this._dirty = true;
            return this;
        },
        sqrDist: function (b) {
            return vec3.sqrDist(this._array, b._array);
        },
        squaredDistance: function (b) {
            return vec3.squaredDistance(this._array, b._array);
        },
        sqrLen: function () {
            return vec3.sqrLen(this._array);
        },
        squaredLength: function () {
            return vec3.squaredLength(this._array);
        },
        sub: function (b) {
            vec3.sub(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        subtract: function (b) {
            vec3.subtract(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        transformMat3: function (m) {
            vec3.transformMat3(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },
        transformMat4: function (m) {
            vec3.transformMat4(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },
        transformQuat: function (q) {
            vec3.transformQuat(this._array, this._array, q._array);
            this._dirty = true;
            return this;
        },
        applyProjection: function (m) {
            var v = this._array;
            m = m._array;
            if (m[15] === 0) {
                var w = -1 / v[2];
                v[0] = m[0] * v[0] * w;
                v[1] = m[5] * v[1] * w;
                v[2] = (m[10] * v[2] + m[14]) * w;
            } else {
                v[0] = m[0] * v[0] + m[12];
                v[1] = m[5] * v[1] + m[13];
                v[2] = m[10] * v[2] + m[14];
            }
            this._dirty = true;
            return this;
        },
        eulerFromQuaternion: function (q, order) {
            Vector3.eulerFromQuaternion(this, q, order);
        },
        toString: function () {
            return '[' + Array.prototype.join.call(this._array, ',') + ']';
        }
    };
    if (Object.defineProperty) {
        var proto = Vector3.prototype;
        Object.defineProperty(proto, 'x', {
            get: function () {
                return this._array[0];
            },
            set: function (value) {
                this._array[0] = value;
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'y', {
            get: function () {
                return this._array[1];
            },
            set: function (value) {
                this._array[1] = value;
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'z', {
            get: function () {
                return this._array[2];
            },
            set: function (value) {
                this._array[2] = value;
                this._dirty = true;
            }
        });
    }
    Vector3.add = function (out, a, b) {
        vec3.add(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.set = function (out, x, y, z) {
        vec3.set(out._array, x, y, z);
        out._dirty = true;
    };
    Vector3.copy = function (out, b) {
        vec3.copy(out._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.cross = function (out, a, b) {
        vec3.cross(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.dist = function (a, b) {
        return vec3.distance(a._array, b._array);
    };
    Vector3.distance = Vector3.dist;
    Vector3.div = function (out, a, b) {
        vec3.divide(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.divide = Vector3.div;
    Vector3.dot = function (a, b) {
        return vec3.dot(a._array, b._array);
    };
    Vector3.len = function (b) {
        return vec3.length(b._array);
    };
    Vector3.lerp = function (out, a, b, t) {
        vec3.lerp(out._array, a._array, b._array, t);
        out._dirty = true;
        return out;
    };
    Vector3.min = function (out, a, b) {
        vec3.min(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.max = function (out, a, b) {
        vec3.max(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.mul = function (out, a, b) {
        vec3.multiply(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.multiply = Vector3.mul;
    Vector3.negate = function (out, a) {
        vec3.negate(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Vector3.normalize = function (out, a) {
        vec3.normalize(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Vector3.random = function (out, scale) {
        vec3.random(out._array, scale);
        out._dirty = true;
        return out;
    };
    Vector3.scale = function (out, a, scale) {
        vec3.scale(out._array, a._array, scale);
        out._dirty = true;
        return out;
    };
    Vector3.scaleAndAdd = function (out, a, b, scale) {
        vec3.scaleAndAdd(out._array, a._array, b._array, scale);
        out._dirty = true;
        return out;
    };
    Vector3.sqrDist = function (a, b) {
        return vec3.sqrDist(a._array, b._array);
    };
    Vector3.squaredDistance = Vector3.sqrDist;
    Vector3.sqrLen = function (a) {
        return vec3.sqrLen(a._array);
    };
    Vector3.squaredLength = Vector3.sqrLen;
    Vector3.sub = function (out, a, b) {
        vec3.subtract(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.subtract = Vector3.sub;
    Vector3.transformMat3 = function (out, a, m) {
        vec3.transformMat3(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    };
    Vector3.transformMat4 = function (out, a, m) {
        vec3.transformMat4(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    };
    Vector3.transformQuat = function (out, a, q) {
        vec3.transformQuat(out._array, a._array, q._array);
        out._dirty = true;
        return out;
    };
    function clamp(val, min, max) {
        return val < min ? min : val > max ? max : val;
    }
    ;
    Vector3.eulerFromQuaternion = function (v, q, order) {
        v = v._array;
        q = q._array;
        var x = q[0], y = q[1], z = q[2], w = q[3];
        var x2 = x * x;
        var y2 = y * y;
        var z2 = z * z;
        var w2 = w * w;
        var atan2 = Math.atan2;
        var asin = Math.asin;
        switch (order && order.toUpperCase()) {
        case 'YXZ':
            v[0] = asin(clamp(2 * (x * w - y * z), -1, 1));
            v[1] = atan2(2 * (x * z + y * w), w2 - x2 - y2 + z2);
            v[2] = atan2(2 * (x * y + z * w), w2 - x2 + y2 - z2);
            break;
        case 'ZXY':
            v[0] = asin(clamp(2 * (x * w + y * z), -1, 1));
            v[1] = atan2(2 * (y * w - z * x), w2 - x2 - y2 + z2);
            v[2] = atan2(2 * (z * w - x * y), w2 - x2 + y2 - z2);
            break;
        case 'ZYX':
            v[0] = atan2(2 * (x * w + z * y), w2 - x2 - y2 + z2);
            v[1] = asin(clamp(2 * (y * w - x * z), -1, 1));
            v[2] = atan2(2 * (x * y + z * w), w2 + x2 - y2 - z2);
            break;
        case 'YZX':
            v[0] = atan2(2 * (x * w - z * y), w2 - x2 + y2 - z2);
            v[1] = atan2(2 * (y * w - x * z), w2 + x2 - y2 - z2);
            v[2] = asin(clamp(2 * (x * y + z * w), -1, 1));
            break;
        case 'XZY':
            v[0] = atan2(2 * (x * w + y * z), w2 - x2 + y2 - z2);
            v[1] = atan2(2 * (x * z + y * w), w2 + x2 - y2 - z2);
            v[2] = asin(clamp(2 * (z * w - x * y), -1, 1));
            break;
        case 'XYZ':
        default:
            v[0] = atan2(2 * (x * w - y * z), w2 - x2 - y2 + z2);
            v[1] = asin(clamp(2 * (x * z + y * w), -1, 1));
            v[2] = atan2(2 * (z * w - x * y), w2 + x2 - y2 - z2);
            break;
        }
        v._dirty = true;
        return v;
    };
    Vector3.POSITIVE_X = new Vector3(1, 0, 0);
    Vector3.NEGATIVE_X = new Vector3(-1, 0, 0);
    Vector3.POSITIVE_Y = new Vector3(0, 1, 0);
    Vector3.NEGATIVE_Y = new Vector3(0, -1, 0);
    Vector3.POSITIVE_Z = new Vector3(0, 0, 1);
    Vector3.NEGATIVE_Z = new Vector3(0, 0, -1);
    Vector3.UP = new Vector3(0, 1, 0);
    Vector3.ZERO = new Vector3(0, 0, 0);
    return Vector3;
});define('qtek/math/Quaternion', [
    'require',
    '../dep/glmatrix'
], function (require) {
    'use strict';
    var glMatrix = require('../dep/glmatrix');
    var quat = glMatrix.quat;
    var Quaternion = function (x, y, z, w) {
        x = x || 0;
        y = y || 0;
        z = z || 0;
        w = w === undefined ? 1 : w;
        this._array = quat.fromValues(x, y, z, w);
        this._dirty = true;
    };
    Quaternion.prototype = {
        constructor: Quaternion,
        add: function (b) {
            quat.add(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        calculateW: function () {
            quat.calculateW(this._array, this._array);
            this._dirty = true;
            return this;
        },
        set: function (x, y, z, w) {
            this._array[0] = x;
            this._array[1] = y;
            this._array[2] = z;
            this._array[3] = w;
            this._dirty = true;
            return this;
        },
        setArray: function (arr) {
            this._array[0] = arr[0];
            this._array[1] = arr[1];
            this._array[2] = arr[2];
            this._array[3] = arr[3];
            this._dirty = true;
            return this;
        },
        clone: function () {
            return new Quaternion(this.x, this.y, this.z, this.w);
        },
        conjugate: function () {
            quat.conjugate(this._array, this._array);
            this._dirty = true;
            return this;
        },
        copy: function (b) {
            quat.copy(this._array, b._array);
            this._dirty = true;
            return this;
        },
        dot: function (b) {
            return quat.dot(this._array, b._array);
        },
        fromMat3: function (m) {
            quat.fromMat3(this._array, m._array);
            this._dirty = true;
            return this;
        },
        fromMat4: function () {
            var mat3 = glMatrix.mat3;
            var m3 = mat3.create();
            return function (m) {
                mat3.fromMat4(m3, m._array);
                mat3.transpose(m3, m3);
                quat.fromMat3(this._array, m3);
                this._dirty = true;
                return this;
            };
        }(),
        identity: function () {
            quat.identity(this._array);
            this._dirty = true;
            return this;
        },
        invert: function () {
            quat.invert(this._array, this._array);
            this._dirty = true;
            return this;
        },
        len: function () {
            return quat.len(this._array);
        },
        length: function () {
            return quat.length(this._array);
        },
        lerp: function (a, b, t) {
            quat.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },
        mul: function (b) {
            quat.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        mulLeft: function (a) {
            quat.multiply(this._array, a._array, this._array);
            this._dirty = true;
            return this;
        },
        multiply: function (b) {
            quat.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        multiplyLeft: function (a) {
            quat.multiply(this._array, a._array, this._array);
            this._dirty = true;
            return this;
        },
        normalize: function () {
            quat.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },
        rotateX: function (rad) {
            quat.rotateX(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },
        rotateY: function (rad) {
            quat.rotateY(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },
        rotateZ: function (rad) {
            quat.rotateZ(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },
        rotationTo: function (a, b) {
            quat.rotationTo(this._array, a._array, b._array);
            this._dirty = true;
            return this;
        },
        setAxes: function (view, right, up) {
            quat.setAxes(this._array, view._array, right._array, up._array);
            this._dirty = true;
            return this;
        },
        setAxisAngle: function (axis, rad) {
            quat.setAxisAngle(this._array, axis._array, rad);
            this._dirty = true;
            return this;
        },
        slerp: function (a, b, t) {
            quat.slerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },
        sqrLen: function () {
            return quat.sqrLen(this._array);
        },
        squaredLength: function () {
            return quat.squaredLength(this._array);
        },
        setFromEuler: function (v) {
        },
        toString: function () {
            return '[' + Array.prototype.join.call(this._array, ',') + ']';
        }
    };
    if (Object.defineProperty) {
        var proto = Quaternion.prototype;
        Object.defineProperty(proto, 'x', {
            get: function () {
                return this._array[0];
            },
            set: function (value) {
                this._array[0] = value;
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'y', {
            get: function () {
                return this._array[1];
            },
            set: function (value) {
                this._array[1] = value;
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'z', {
            get: function () {
                return this._array[2];
            },
            set: function (value) {
                this._array[2] = value;
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'w', {
            get: function () {
                return this._array[3];
            },
            set: function (value) {
                this._array[3] = value;
                this._dirty = true;
            }
        });
    }
    Quaternion.add = function (out, a, b) {
        quat.add(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Quaternion.set = function (out, x, y, z, w) {
        quat.set(out._array, x, y, z, w);
        out._dirty = true;
    };
    Quaternion.copy = function (out, b) {
        quat.copy(out._array, b._array);
        out._dirty = true;
        return out;
    };
    Quaternion.calculateW = function (out, a) {
        quat.calculateW(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Quaternion.conjugate = function (out, a) {
        quat.conjugate(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Quaternion.identity = function (out) {
        quat.identity(out._array);
        out._dirty = true;
        return out;
    };
    Quaternion.invert = function (out, a) {
        quat.invert(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Quaternion.dot = function (a, b) {
        return quat.dot(a._array, b._array);
    };
    Quaternion.len = function (a) {
        return quat.length(a._array);
    };
    Quaternion.lerp = function (out, a, b, t) {
        quat.lerp(out._array, a._array, b._array, t);
        out._dirty = true;
        return out;
    };
    Quaternion.slerp = function (out, a, b, t) {
        quat.slerp(out._array, a._array, b._array, t);
        out._dirty = true;
        return out;
    };
    Quaternion.mul = function (out, a, b) {
        quat.multiply(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Quaternion.multiply = Quaternion.mul;
    Quaternion.rotateX = function (out, a, rad) {
        quat.rotateX(out._array, a._array, rad);
        out._dirty = true;
        return out;
    };
    Quaternion.rotateY = function (out, a, rad) {
        quat.rotateY(out._array, a._array, rad);
        out._dirty = true;
        return out;
    };
    Quaternion.rotateZ = function (out, a, rad) {
        quat.rotateZ(out._array, a._array, rad);
        out._dirty = true;
        return out;
    };
    Quaternion.setAxisAngle = function (out, axis, rad) {
        quat.setAxisAngle(out._array, axis._array, rad);
        out._dirty = true;
        return out;
    };
    Quaternion.normalize = function (out, a) {
        quat.normalize(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Quaternion.sqrLen = function (a) {
        return quat.sqrLen(a._array);
    };
    Quaternion.squaredLength = Quaternion.sqrLen;
    Quaternion.fromMat3 = function (out, m) {
        quat.fromMat3(out._array, m._array);
        out._dirty = true;
        return out;
    };
    Quaternion.setAxes = function (out, view, right, up) {
        quat.setAxes(out._array, view._array, right._array, up._array);
        out._dirty = true;
        return out;
    };
    Quaternion.rotationTo = function (out, a, b) {
        quat.rotationTo(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    return Quaternion;
});define('qtek/math/Matrix4', [
    'require',
    '../dep/glmatrix',
    './Vector3'
], function (require) {
    'use strict';
    var glMatrix = require('../dep/glmatrix');
    var Vector3 = require('./Vector3');
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var mat3 = glMatrix.mat3;
    var quat = glMatrix.quat;
    function makeProperty(n) {
        return {
            set: function (value) {
                this._array[n] = value;
                this._dirty = true;
            },
            get: function () {
                return this._array[n];
            }
        };
    }
    var Matrix4 = function () {
        this._axisX = new Vector3();
        this._axisY = new Vector3();
        this._axisZ = new Vector3();
        this._array = mat4.create();
        this._dirty = true;
    };
    Matrix4.prototype = {
        constructor: Matrix4,
        adjoint: function () {
            mat4.adjoint(this._array, this._array);
            this._dirty = true;
            return this;
        },
        clone: function () {
            return new Matrix4().copy(this);
        },
        copy: function (a) {
            mat4.copy(this._array, a._array);
            this._dirty = true;
            return this;
        },
        determinant: function () {
            return mat4.determinant(this._array);
        },
        fromQuat: function (q) {
            mat4.fromQuat(this._array, q._array);
            this._dirty = true;
            return this;
        },
        fromRotationTranslation: function (q, v) {
            mat4.fromRotationTranslation(this._array, q._array, v._array);
            this._dirty = true;
            return this;
        },
        fromMat2d: function (m2d) {
            Matrix4.fromMat2d(this, m2d);
            return this;
        },
        frustum: function (left, right, bottom, top, near, far) {
            mat4.frustum(this._array, left, right, bottom, top, near, far);
            this._dirty = true;
            return this;
        },
        identity: function () {
            mat4.identity(this._array);
            this._dirty = true;
            return this;
        },
        invert: function () {
            mat4.invert(this._array, this._array);
            this._dirty = true;
            return this;
        },
        lookAt: function (eye, center, up) {
            mat4.lookAt(this._array, eye._array, center._array, up._array);
            this._dirty = true;
            return this;
        },
        mul: function (b) {
            mat4.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        mulLeft: function (a) {
            mat4.mul(this._array, a._array, this._array);
            this._dirty = true;
            return this;
        },
        multiply: function (b) {
            mat4.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        multiplyLeft: function (a) {
            mat4.multiply(this._array, a._array, this._array);
            this._dirty = true;
            return this;
        },
        ortho: function (left, right, bottom, top, near, far) {
            mat4.ortho(this._array, left, right, bottom, top, near, far);
            this._dirty = true;
            return this;
        },
        perspective: function (fovy, aspect, near, far) {
            mat4.perspective(this._array, fovy, aspect, near, far);
            this._dirty = true;
            return this;
        },
        rotate: function (rad, axis) {
            mat4.rotate(this._array, this._array, rad, axis._array);
            this._dirty = true;
            return this;
        },
        rotateX: function (rad) {
            mat4.rotateX(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },
        rotateY: function (rad) {
            mat4.rotateY(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },
        rotateZ: function (rad) {
            mat4.rotateZ(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },
        scale: function (v) {
            mat4.scale(this._array, this._array, v._array);
            this._dirty = true;
            return this;
        },
        translate: function (v) {
            mat4.translate(this._array, this._array, v._array);
            this._dirty = true;
            return this;
        },
        transpose: function () {
            mat4.transpose(this._array, this._array);
            this._dirty = true;
            return this;
        },
        decomposeMatrix: function () {
            var x = vec3.create();
            var y = vec3.create();
            var z = vec3.create();
            var m3 = mat3.create();
            return function (scale, rotation, position) {
                var el = this._array;
                vec3.set(x, el[0], el[1], el[2]);
                vec3.set(y, el[4], el[5], el[6]);
                vec3.set(z, el[8], el[9], el[10]);
                var sx = vec3.length(x);
                var sy = vec3.length(y);
                var sz = vec3.length(z);
                if (scale) {
                    scale.x = sx;
                    scale.y = sy;
                    scale.z = sz;
                    scale._dirty = true;
                }
                position.set(el[12], el[13], el[14]);
                mat3.fromMat4(m3, el);
                mat3.transpose(m3, m3);
                m3[0] /= sx;
                m3[1] /= sx;
                m3[2] /= sx;
                m3[3] /= sy;
                m3[4] /= sy;
                m3[5] /= sy;
                m3[6] /= sz;
                m3[7] /= sz;
                m3[8] /= sz;
                quat.fromMat3(rotation._array, m3);
                quat.normalize(rotation._array, rotation._array);
                rotation._dirty = true;
                position._dirty = true;
            };
        }(),
        toString: function () {
            return '[' + Array.prototype.join.call(this._array, ',') + ']';
        }
    };
    if (Object.defineProperty) {
        var proto = Matrix4.prototype;
        Object.defineProperty(proto, 'z', {
            get: function () {
                var el = this._array;
                this._axisZ.set(el[8], el[9], el[10]);
                return this._axisZ;
            },
            set: function (v) {
                var el = this._array;
                v = v._array;
                el[8] = v[0];
                el[9] = v[1];
                el[10] = v[2];
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'y', {
            get: function () {
                var el = this._array;
                this._axisY.set(el[4], el[5], el[6]);
                return this._axisY;
            },
            set: function (v) {
                var el = this._array;
                v = v._array;
                el[4] = v[0];
                el[5] = v[1];
                el[6] = v[2];
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'x', {
            get: function () {
                var el = this._array;
                this._axisX.set(el[0], el[1], el[2]);
                return this._axisX;
            },
            set: function (v) {
                var el = this._array;
                v = v._array;
                el[0] = v[0];
                el[1] = v[1];
                el[2] = v[2];
                this._dirty = true;
            }
        });
    }
    Matrix4.adjoint = function (out, a) {
        mat4.adjoint(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Matrix4.copy = function (out, a) {
        mat4.copy(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Matrix4.determinant = function (a) {
        return mat4.determinant(a._array);
    };
    Matrix4.identity = function (out) {
        mat4.identity(out._array);
        out._dirty = true;
        return out;
    };
    Matrix4.ortho = function (out, left, right, bottom, top, near, far) {
        mat4.ortho(out._array, left, right, bottom, top, near, far);
        out._dirty = true;
        return out;
    };
    Matrix4.perspective = function (out, fovy, aspect, near, far) {
        mat4.perspective(out._array, fovy, aspect, near, far);
        out._dirty = true;
        return out;
    };
    Matrix4.lookAt = function (out, eye, center, up) {
        mat4.lookAt(out._array, eye._array, center._array, up._array);
        out._dirty = true;
        return out;
    };
    Matrix4.invert = function (out, a) {
        mat4.invert(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Matrix4.mul = function (out, a, b) {
        mat4.mul(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Matrix4.multiply = Matrix4.mul;
    Matrix4.fromQuat = function (out, q) {
        mat4.fromQuat(out._array, q._array);
        out._dirty = true;
        return out;
    };
    Matrix4.fromRotationTranslation = function (out, q, v) {
        mat4.fromRotationTranslation(out._array, q._array, v._array);
        out._dirty = true;
        return out;
    };
    Matrix4.fromMat2d = function (m4, m2d) {
        m4._dirty = true;
        var m2d = m2d._array;
        var m4 = m4._array;
        m4[0] = m2d[0];
        m4[4] = m2d[2];
        m4[12] = m2d[4];
        m4[1] = m2d[1];
        m4[5] = m2d[3];
        m4[13] = m2d[5];
        return m4;
    };
    Matrix4.rotate = function (out, a, rad, axis) {
        mat4.rotate(out._array, a._array, rad, axis._array);
        out._dirty = true;
        return out;
    };
    Matrix4.rotateX = function (out, a, rad) {
        mat4.rotateX(out._array, a._array, rad);
        out._dirty = true;
        return out;
    };
    Matrix4.rotateY = function (out, a, rad) {
        mat4.rotateY(out._array, a._array, rad);
        out._dirty = true;
        return out;
    };
    Matrix4.rotateZ = function (out, a, rad) {
        mat4.rotateZ(out._array, a._array, rad);
        out._dirty = true;
        return out;
    };
    Matrix4.scale = function (out, a, v) {
        mat4.scale(out._array, a._array, v._array);
        out._dirty = true;
        return out;
    };
    Matrix4.transpose = function (out, a) {
        mat4.transpose(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Matrix4.translate = function (out, a, v) {
        mat4.translate(out._array, a._array, v._array);
        out._dirty = true;
        return out;
    };
    return Matrix4;
});(function (_global) {
    'use strict';
    var shim = {};
    if (typeof exports === 'undefined') {
        if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
            shim.exports = {};
            define('qtek/dep/glmatrix', [], function () {
                return shim.exports;
            });
        } else {
            shim.exports = typeof window !== 'undefined' ? window : _global;
        }
    } else {
        shim.exports = exports;
    }
    (function (exports) {
        if (!GLMAT_EPSILON) {
            var GLMAT_EPSILON = 0.000001;
        }
        if (!GLMAT_ARRAY_TYPE) {
            var GLMAT_ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
        }
        if (!GLMAT_RANDOM) {
            var GLMAT_RANDOM = Math.random;
        }
        var glMatrix = {};
        glMatrix.setMatrixArrayType = function (type) {
            GLMAT_ARRAY_TYPE = type;
        };
        if (typeof exports !== 'undefined') {
            exports.glMatrix = glMatrix;
        }
        var degree = Math.PI / 180;
        glMatrix.toRadian = function (a) {
            return a * degree;
        };
        var vec2 = {};
        vec2.create = function () {
            var out = new GLMAT_ARRAY_TYPE(2);
            out[0] = 0;
            out[1] = 0;
            return out;
        };
        vec2.clone = function (a) {
            var out = new GLMAT_ARRAY_TYPE(2);
            out[0] = a[0];
            out[1] = a[1];
            return out;
        };
        vec2.fromValues = function (x, y) {
            var out = new GLMAT_ARRAY_TYPE(2);
            out[0] = x;
            out[1] = y;
            return out;
        };
        vec2.copy = function (out, a) {
            out[0] = a[0];
            out[1] = a[1];
            return out;
        };
        vec2.set = function (out, x, y) {
            out[0] = x;
            out[1] = y;
            return out;
        };
        vec2.add = function (out, a, b) {
            out[0] = a[0] + b[0];
            out[1] = a[1] + b[1];
            return out;
        };
        vec2.subtract = function (out, a, b) {
            out[0] = a[0] - b[0];
            out[1] = a[1] - b[1];
            return out;
        };
        vec2.sub = vec2.subtract;
        vec2.multiply = function (out, a, b) {
            out[0] = a[0] * b[0];
            out[1] = a[1] * b[1];
            return out;
        };
        vec2.mul = vec2.multiply;
        vec2.divide = function (out, a, b) {
            out[0] = a[0] / b[0];
            out[1] = a[1] / b[1];
            return out;
        };
        vec2.div = vec2.divide;
        vec2.min = function (out, a, b) {
            out[0] = Math.min(a[0], b[0]);
            out[1] = Math.min(a[1], b[1]);
            return out;
        };
        vec2.max = function (out, a, b) {
            out[0] = Math.max(a[0], b[0]);
            out[1] = Math.max(a[1], b[1]);
            return out;
        };
        vec2.scale = function (out, a, b) {
            out[0] = a[0] * b;
            out[1] = a[1] * b;
            return out;
        };
        vec2.scaleAndAdd = function (out, a, b, scale) {
            out[0] = a[0] + b[0] * scale;
            out[1] = a[1] + b[1] * scale;
            return out;
        };
        vec2.distance = function (a, b) {
            var x = b[0] - a[0], y = b[1] - a[1];
            return Math.sqrt(x * x + y * y);
        };
        vec2.dist = vec2.distance;
        vec2.squaredDistance = function (a, b) {
            var x = b[0] - a[0], y = b[1] - a[1];
            return x * x + y * y;
        };
        vec2.sqrDist = vec2.squaredDistance;
        vec2.length = function (a) {
            var x = a[0], y = a[1];
            return Math.sqrt(x * x + y * y);
        };
        vec2.len = vec2.length;
        vec2.squaredLength = function (a) {
            var x = a[0], y = a[1];
            return x * x + y * y;
        };
        vec2.sqrLen = vec2.squaredLength;
        vec2.negate = function (out, a) {
            out[0] = -a[0];
            out[1] = -a[1];
            return out;
        };
        vec2.normalize = function (out, a) {
            var x = a[0], y = a[1];
            var len = x * x + y * y;
            if (len > 0) {
                len = 1 / Math.sqrt(len);
                out[0] = a[0] * len;
                out[1] = a[1] * len;
            }
            return out;
        };
        vec2.dot = function (a, b) {
            return a[0] * b[0] + a[1] * b[1];
        };
        vec2.cross = function (out, a, b) {
            var z = a[0] * b[1] - a[1] * b[0];
            out[0] = out[1] = 0;
            out[2] = z;
            return out;
        };
        vec2.lerp = function (out, a, b, t) {
            var ax = a[0], ay = a[1];
            out[0] = ax + t * (b[0] - ax);
            out[1] = ay + t * (b[1] - ay);
            return out;
        };
        vec2.random = function (out, scale) {
            scale = scale || 1;
            var r = GLMAT_RANDOM() * 2 * Math.PI;
            out[0] = Math.cos(r) * scale;
            out[1] = Math.sin(r) * scale;
            return out;
        };
        vec2.transformMat2 = function (out, a, m) {
            var x = a[0], y = a[1];
            out[0] = m[0] * x + m[2] * y;
            out[1] = m[1] * x + m[3] * y;
            return out;
        };
        vec2.transformMat2d = function (out, a, m) {
            var x = a[0], y = a[1];
            out[0] = m[0] * x + m[2] * y + m[4];
            out[1] = m[1] * x + m[3] * y + m[5];
            return out;
        };
        vec2.transformMat3 = function (out, a, m) {
            var x = a[0], y = a[1];
            out[0] = m[0] * x + m[3] * y + m[6];
            out[1] = m[1] * x + m[4] * y + m[7];
            return out;
        };
        vec2.transformMat4 = function (out, a, m) {
            var x = a[0], y = a[1];
            out[0] = m[0] * x + m[4] * y + m[12];
            out[1] = m[1] * x + m[5] * y + m[13];
            return out;
        };
        vec2.forEach = function () {
            var vec = vec2.create();
            return function (a, stride, offset, count, fn, arg) {
                var i, l;
                if (!stride) {
                    stride = 2;
                }
                if (!offset) {
                    offset = 0;
                }
                if (count) {
                    l = Math.min(count * stride + offset, a.length);
                } else {
                    l = a.length;
                }
                for (i = offset; i < l; i += stride) {
                    vec[0] = a[i];
                    vec[1] = a[i + 1];
                    fn(vec, vec, arg);
                    a[i] = vec[0];
                    a[i + 1] = vec[1];
                }
                return a;
            };
        }();
        vec2.str = function (a) {
            return 'vec2(' + a[0] + ', ' + a[1] + ')';
        };
        if (typeof exports !== 'undefined') {
            exports.vec2 = vec2;
        }
        ;
        var vec3 = {};
        vec3.create = function () {
            var out = new GLMAT_ARRAY_TYPE(3);
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            return out;
        };
        vec3.clone = function (a) {
            var out = new GLMAT_ARRAY_TYPE(3);
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            return out;
        };
        vec3.fromValues = function (x, y, z) {
            var out = new GLMAT_ARRAY_TYPE(3);
            out[0] = x;
            out[1] = y;
            out[2] = z;
            return out;
        };
        vec3.copy = function (out, a) {
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            return out;
        };
        vec3.set = function (out, x, y, z) {
            out[0] = x;
            out[1] = y;
            out[2] = z;
            return out;
        };
        vec3.add = function (out, a, b) {
            out[0] = a[0] + b[0];
            out[1] = a[1] + b[1];
            out[2] = a[2] + b[2];
            return out;
        };
        vec3.subtract = function (out, a, b) {
            out[0] = a[0] - b[0];
            out[1] = a[1] - b[1];
            out[2] = a[2] - b[2];
            return out;
        };
        vec3.sub = vec3.subtract;
        vec3.multiply = function (out, a, b) {
            out[0] = a[0] * b[0];
            out[1] = a[1] * b[1];
            out[2] = a[2] * b[2];
            return out;
        };
        vec3.mul = vec3.multiply;
        vec3.divide = function (out, a, b) {
            out[0] = a[0] / b[0];
            out[1] = a[1] / b[1];
            out[2] = a[2] / b[2];
            return out;
        };
        vec3.div = vec3.divide;
        vec3.min = function (out, a, b) {
            out[0] = Math.min(a[0], b[0]);
            out[1] = Math.min(a[1], b[1]);
            out[2] = Math.min(a[2], b[2]);
            return out;
        };
        vec3.max = function (out, a, b) {
            out[0] = Math.max(a[0], b[0]);
            out[1] = Math.max(a[1], b[1]);
            out[2] = Math.max(a[2], b[2]);
            return out;
        };
        vec3.scale = function (out, a, b) {
            out[0] = a[0] * b;
            out[1] = a[1] * b;
            out[2] = a[2] * b;
            return out;
        };
        vec3.scaleAndAdd = function (out, a, b, scale) {
            out[0] = a[0] + b[0] * scale;
            out[1] = a[1] + b[1] * scale;
            out[2] = a[2] + b[2] * scale;
            return out;
        };
        vec3.distance = function (a, b) {
            var x = b[0] - a[0], y = b[1] - a[1], z = b[2] - a[2];
            return Math.sqrt(x * x + y * y + z * z);
        };
        vec3.dist = vec3.distance;
        vec3.squaredDistance = function (a, b) {
            var x = b[0] - a[0], y = b[1] - a[1], z = b[2] - a[2];
            return x * x + y * y + z * z;
        };
        vec3.sqrDist = vec3.squaredDistance;
        vec3.length = function (a) {
            var x = a[0], y = a[1], z = a[2];
            return Math.sqrt(x * x + y * y + z * z);
        };
        vec3.len = vec3.length;
        vec3.squaredLength = function (a) {
            var x = a[0], y = a[1], z = a[2];
            return x * x + y * y + z * z;
        };
        vec3.sqrLen = vec3.squaredLength;
        vec3.negate = function (out, a) {
            out[0] = -a[0];
            out[1] = -a[1];
            out[2] = -a[2];
            return out;
        };
        vec3.normalize = function (out, a) {
            var x = a[0], y = a[1], z = a[2];
            var len = x * x + y * y + z * z;
            if (len > 0) {
                len = 1 / Math.sqrt(len);
                out[0] = a[0] * len;
                out[1] = a[1] * len;
                out[2] = a[2] * len;
            }
            return out;
        };
        vec3.dot = function (a, b) {
            return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        };
        vec3.cross = function (out, a, b) {
            var ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2];
            out[0] = ay * bz - az * by;
            out[1] = az * bx - ax * bz;
            out[2] = ax * by - ay * bx;
            return out;
        };
        vec3.lerp = function (out, a, b, t) {
            var ax = a[0], ay = a[1], az = a[2];
            out[0] = ax + t * (b[0] - ax);
            out[1] = ay + t * (b[1] - ay);
            out[2] = az + t * (b[2] - az);
            return out;
        };
        vec3.random = function (out, scale) {
            scale = scale || 1;
            var r = GLMAT_RANDOM() * 2 * Math.PI;
            var z = GLMAT_RANDOM() * 2 - 1;
            var zScale = Math.sqrt(1 - z * z) * scale;
            out[0] = Math.cos(r) * zScale;
            out[1] = Math.sin(r) * zScale;
            out[2] = z * scale;
            return out;
        };
        vec3.transformMat4 = function (out, a, m) {
            var x = a[0], y = a[1], z = a[2];
            out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
            out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
            out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
            return out;
        };
        vec3.transformMat3 = function (out, a, m) {
            var x = a[0], y = a[1], z = a[2];
            out[0] = x * m[0] + y * m[3] + z * m[6];
            out[1] = x * m[1] + y * m[4] + z * m[7];
            out[2] = x * m[2] + y * m[5] + z * m[8];
            return out;
        };
        vec3.transformQuat = function (out, a, q) {
            var x = a[0], y = a[1], z = a[2], qx = q[0], qy = q[1], qz = q[2], qw = q[3], ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
            out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
            out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
            out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
            return out;
        };
        vec3.forEach = function () {
            var vec = vec3.create();
            return function (a, stride, offset, count, fn, arg) {
                var i, l;
                if (!stride) {
                    stride = 3;
                }
                if (!offset) {
                    offset = 0;
                }
                if (count) {
                    l = Math.min(count * stride + offset, a.length);
                } else {
                    l = a.length;
                }
                for (i = offset; i < l; i += stride) {
                    vec[0] = a[i];
                    vec[1] = a[i + 1];
                    vec[2] = a[i + 2];
                    fn(vec, vec, arg);
                    a[i] = vec[0];
                    a[i + 1] = vec[1];
                    a[i + 2] = vec[2];
                }
                return a;
            };
        }();
        vec3.str = function (a) {
            return 'vec3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ')';
        };
        if (typeof exports !== 'undefined') {
            exports.vec3 = vec3;
        }
        ;
        var vec4 = {};
        vec4.create = function () {
            var out = new GLMAT_ARRAY_TYPE(4);
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            return out;
        };
        vec4.clone = function (a) {
            var out = new GLMAT_ARRAY_TYPE(4);
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            return out;
        };
        vec4.fromValues = function (x, y, z, w) {
            var out = new GLMAT_ARRAY_TYPE(4);
            out[0] = x;
            out[1] = y;
            out[2] = z;
            out[3] = w;
            return out;
        };
        vec4.copy = function (out, a) {
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            return out;
        };
        vec4.set = function (out, x, y, z, w) {
            out[0] = x;
            out[1] = y;
            out[2] = z;
            out[3] = w;
            return out;
        };
        vec4.add = function (out, a, b) {
            out[0] = a[0] + b[0];
            out[1] = a[1] + b[1];
            out[2] = a[2] + b[2];
            out[3] = a[3] + b[3];
            return out;
        };
        vec4.subtract = function (out, a, b) {
            out[0] = a[0] - b[0];
            out[1] = a[1] - b[1];
            out[2] = a[2] - b[2];
            out[3] = a[3] - b[3];
            return out;
        };
        vec4.sub = vec4.subtract;
        vec4.multiply = function (out, a, b) {
            out[0] = a[0] * b[0];
            out[1] = a[1] * b[1];
            out[2] = a[2] * b[2];
            out[3] = a[3] * b[3];
            return out;
        };
        vec4.mul = vec4.multiply;
        vec4.divide = function (out, a, b) {
            out[0] = a[0] / b[0];
            out[1] = a[1] / b[1];
            out[2] = a[2] / b[2];
            out[3] = a[3] / b[3];
            return out;
        };
        vec4.div = vec4.divide;
        vec4.min = function (out, a, b) {
            out[0] = Math.min(a[0], b[0]);
            out[1] = Math.min(a[1], b[1]);
            out[2] = Math.min(a[2], b[2]);
            out[3] = Math.min(a[3], b[3]);
            return out;
        };
        vec4.max = function (out, a, b) {
            out[0] = Math.max(a[0], b[0]);
            out[1] = Math.max(a[1], b[1]);
            out[2] = Math.max(a[2], b[2]);
            out[3] = Math.max(a[3], b[3]);
            return out;
        };
        vec4.scale = function (out, a, b) {
            out[0] = a[0] * b;
            out[1] = a[1] * b;
            out[2] = a[2] * b;
            out[3] = a[3] * b;
            return out;
        };
        vec4.scaleAndAdd = function (out, a, b, scale) {
            out[0] = a[0] + b[0] * scale;
            out[1] = a[1] + b[1] * scale;
            out[2] = a[2] + b[2] * scale;
            out[3] = a[3] + b[3] * scale;
            return out;
        };
        vec4.distance = function (a, b) {
            var x = b[0] - a[0], y = b[1] - a[1], z = b[2] - a[2], w = b[3] - a[3];
            return Math.sqrt(x * x + y * y + z * z + w * w);
        };
        vec4.dist = vec4.distance;
        vec4.squaredDistance = function (a, b) {
            var x = b[0] - a[0], y = b[1] - a[1], z = b[2] - a[2], w = b[3] - a[3];
            return x * x + y * y + z * z + w * w;
        };
        vec4.sqrDist = vec4.squaredDistance;
        vec4.length = function (a) {
            var x = a[0], y = a[1], z = a[2], w = a[3];
            return Math.sqrt(x * x + y * y + z * z + w * w);
        };
        vec4.len = vec4.length;
        vec4.squaredLength = function (a) {
            var x = a[0], y = a[1], z = a[2], w = a[3];
            return x * x + y * y + z * z + w * w;
        };
        vec4.sqrLen = vec4.squaredLength;
        vec4.negate = function (out, a) {
            out[0] = -a[0];
            out[1] = -a[1];
            out[2] = -a[2];
            out[3] = -a[3];
            return out;
        };
        vec4.normalize = function (out, a) {
            var x = a[0], y = a[1], z = a[2], w = a[3];
            var len = x * x + y * y + z * z + w * w;
            if (len > 0) {
                len = 1 / Math.sqrt(len);
                out[0] = a[0] * len;
                out[1] = a[1] * len;
                out[2] = a[2] * len;
                out[3] = a[3] * len;
            }
            return out;
        };
        vec4.dot = function (a, b) {
            return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
        };
        vec4.lerp = function (out, a, b, t) {
            var ax = a[0], ay = a[1], az = a[2], aw = a[3];
            out[0] = ax + t * (b[0] - ax);
            out[1] = ay + t * (b[1] - ay);
            out[2] = az + t * (b[2] - az);
            out[3] = aw + t * (b[3] - aw);
            return out;
        };
        vec4.random = function (out, scale) {
            scale = scale || 1;
            out[0] = GLMAT_RANDOM();
            out[1] = GLMAT_RANDOM();
            out[2] = GLMAT_RANDOM();
            out[3] = GLMAT_RANDOM();
            vec4.normalize(out, out);
            vec4.scale(out, out, scale);
            return out;
        };
        vec4.transformMat4 = function (out, a, m) {
            var x = a[0], y = a[1], z = a[2], w = a[3];
            out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
            out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
            out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
            out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
            return out;
        };
        vec4.transformQuat = function (out, a, q) {
            var x = a[0], y = a[1], z = a[2], qx = q[0], qy = q[1], qz = q[2], qw = q[3], ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
            out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
            out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
            out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
            return out;
        };
        vec4.forEach = function () {
            var vec = vec4.create();
            return function (a, stride, offset, count, fn, arg) {
                var i, l;
                if (!stride) {
                    stride = 4;
                }
                if (!offset) {
                    offset = 0;
                }
                if (count) {
                    l = Math.min(count * stride + offset, a.length);
                } else {
                    l = a.length;
                }
                for (i = offset; i < l; i += stride) {
                    vec[0] = a[i];
                    vec[1] = a[i + 1];
                    vec[2] = a[i + 2];
                    vec[3] = a[i + 3];
                    fn(vec, vec, arg);
                    a[i] = vec[0];
                    a[i + 1] = vec[1];
                    a[i + 2] = vec[2];
                    a[i + 3] = vec[3];
                }
                return a;
            };
        }();
        vec4.str = function (a) {
            return 'vec4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
        };
        if (typeof exports !== 'undefined') {
            exports.vec4 = vec4;
        }
        ;
        var mat2 = {};
        mat2.create = function () {
            var out = new GLMAT_ARRAY_TYPE(4);
            out[0] = 1;
            out[1] = 0;
            out[2] = 0;
            out[3] = 1;
            return out;
        };
        mat2.clone = function (a) {
            var out = new GLMAT_ARRAY_TYPE(4);
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            return out;
        };
        mat2.copy = function (out, a) {
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            return out;
        };
        mat2.identity = function (out) {
            out[0] = 1;
            out[1] = 0;
            out[2] = 0;
            out[3] = 1;
            return out;
        };
        mat2.transpose = function (out, a) {
            if (out === a) {
                var a1 = a[1];
                out[1] = a[2];
                out[2] = a1;
            } else {
                out[0] = a[0];
                out[1] = a[2];
                out[2] = a[1];
                out[3] = a[3];
            }
            return out;
        };
        mat2.invert = function (out, a) {
            var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], det = a0 * a3 - a2 * a1;
            if (!det) {
                return null;
            }
            det = 1 / det;
            out[0] = a3 * det;
            out[1] = -a1 * det;
            out[2] = -a2 * det;
            out[3] = a0 * det;
            return out;
        };
        mat2.adjoint = function (out, a) {
            var a0 = a[0];
            out[0] = a[3];
            out[1] = -a[1];
            out[2] = -a[2];
            out[3] = a0;
            return out;
        };
        mat2.determinant = function (a) {
            return a[0] * a[3] - a[2] * a[1];
        };
        mat2.multiply = function (out, a, b) {
            var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
            var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
            out[0] = a0 * b0 + a1 * b2;
            out[1] = a0 * b1 + a1 * b3;
            out[2] = a2 * b0 + a3 * b2;
            out[3] = a2 * b1 + a3 * b3;
            return out;
        };
        mat2.mul = mat2.multiply;
        mat2.rotate = function (out, a, rad) {
            var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], s = Math.sin(rad), c = Math.cos(rad);
            out[0] = a0 * c + a1 * s;
            out[1] = a0 * -s + a1 * c;
            out[2] = a2 * c + a3 * s;
            out[3] = a2 * -s + a3 * c;
            return out;
        };
        mat2.scale = function (out, a, v) {
            var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], v0 = v[0], v1 = v[1];
            out[0] = a0 * v0;
            out[1] = a1 * v1;
            out[2] = a2 * v0;
            out[3] = a3 * v1;
            return out;
        };
        mat2.str = function (a) {
            return 'mat2(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
        };
        if (typeof exports !== 'undefined') {
            exports.mat2 = mat2;
        }
        ;
        var mat2d = {};
        mat2d.create = function () {
            var out = new GLMAT_ARRAY_TYPE(6);
            out[0] = 1;
            out[1] = 0;
            out[2] = 0;
            out[3] = 1;
            out[4] = 0;
            out[5] = 0;
            return out;
        };
        mat2d.clone = function (a) {
            var out = new GLMAT_ARRAY_TYPE(6);
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            out[4] = a[4];
            out[5] = a[5];
            return out;
        };
        mat2d.copy = function (out, a) {
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            out[4] = a[4];
            out[5] = a[5];
            return out;
        };
        mat2d.identity = function (out) {
            out[0] = 1;
            out[1] = 0;
            out[2] = 0;
            out[3] = 1;
            out[4] = 0;
            out[5] = 0;
            return out;
        };
        mat2d.invert = function (out, a) {
            var aa = a[0], ab = a[1], ac = a[2], ad = a[3], atx = a[4], aty = a[5];
            var det = aa * ad - ab * ac;
            if (!det) {
                return null;
            }
            det = 1 / det;
            out[0] = ad * det;
            out[1] = -ab * det;
            out[2] = -ac * det;
            out[3] = aa * det;
            out[4] = (ac * aty - ad * atx) * det;
            out[5] = (ab * atx - aa * aty) * det;
            return out;
        };
        mat2d.determinant = function (a) {
            return a[0] * a[3] - a[1] * a[2];
        };
        mat2d.multiply = function (out, a, b) {
            var aa = a[0], ab = a[1], ac = a[2], ad = a[3], atx = a[4], aty = a[5], ba = b[0], bb = b[1], bc = b[2], bd = b[3], btx = b[4], bty = b[5];
            out[0] = aa * ba + ab * bc;
            out[1] = aa * bb + ab * bd;
            out[2] = ac * ba + ad * bc;
            out[3] = ac * bb + ad * bd;
            out[4] = ba * atx + bc * aty + btx;
            out[5] = bb * atx + bd * aty + bty;
            return out;
        };
        mat2d.mul = mat2d.multiply;
        mat2d.rotate = function (out, a, rad) {
            var aa = a[0], ab = a[1], ac = a[2], ad = a[3], atx = a[4], aty = a[5], st = Math.sin(rad), ct = Math.cos(rad);
            out[0] = aa * ct + ab * st;
            out[1] = -aa * st + ab * ct;
            out[2] = ac * ct + ad * st;
            out[3] = -ac * st + ct * ad;
            out[4] = ct * atx + st * aty;
            out[5] = ct * aty - st * atx;
            return out;
        };
        mat2d.scale = function (out, a, v) {
            var vx = v[0], vy = v[1];
            out[0] = a[0] * vx;
            out[1] = a[1] * vy;
            out[2] = a[2] * vx;
            out[3] = a[3] * vy;
            out[4] = a[4] * vx;
            out[5] = a[5] * vy;
            return out;
        };
        mat2d.translate = function (out, a, v) {
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            out[4] = a[4] + v[0];
            out[5] = a[5] + v[1];
            return out;
        };
        mat2d.str = function (a) {
            return 'mat2d(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' + a[4] + ', ' + a[5] + ')';
        };
        if (typeof exports !== 'undefined') {
            exports.mat2d = mat2d;
        }
        ;
        var mat3 = {};
        mat3.create = function () {
            var out = new GLMAT_ARRAY_TYPE(9);
            out[0] = 1;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            out[4] = 1;
            out[5] = 0;
            out[6] = 0;
            out[7] = 0;
            out[8] = 1;
            return out;
        };
        mat3.fromMat4 = function (out, a) {
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[4];
            out[4] = a[5];
            out[5] = a[6];
            out[6] = a[8];
            out[7] = a[9];
            out[8] = a[10];
            return out;
        };
        mat3.clone = function (a) {
            var out = new GLMAT_ARRAY_TYPE(9);
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            out[4] = a[4];
            out[5] = a[5];
            out[6] = a[6];
            out[7] = a[7];
            out[8] = a[8];
            return out;
        };
        mat3.copy = function (out, a) {
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            out[4] = a[4];
            out[5] = a[5];
            out[6] = a[6];
            out[7] = a[7];
            out[8] = a[8];
            return out;
        };
        mat3.identity = function (out) {
            out[0] = 1;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            out[4] = 1;
            out[5] = 0;
            out[6] = 0;
            out[7] = 0;
            out[8] = 1;
            return out;
        };
        mat3.transpose = function (out, a) {
            if (out === a) {
                var a01 = a[1], a02 = a[2], a12 = a[5];
                out[1] = a[3];
                out[2] = a[6];
                out[3] = a01;
                out[5] = a[7];
                out[6] = a02;
                out[7] = a12;
            } else {
                out[0] = a[0];
                out[1] = a[3];
                out[2] = a[6];
                out[3] = a[1];
                out[4] = a[4];
                out[5] = a[7];
                out[6] = a[2];
                out[7] = a[5];
                out[8] = a[8];
            }
            return out;
        };
        mat3.invert = function (out, a) {
            var a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[3], a11 = a[4], a12 = a[5], a20 = a[6], a21 = a[7], a22 = a[8], b01 = a22 * a11 - a12 * a21, b11 = -a22 * a10 + a12 * a20, b21 = a21 * a10 - a11 * a20, det = a00 * b01 + a01 * b11 + a02 * b21;
            if (!det) {
                return null;
            }
            det = 1 / det;
            out[0] = b01 * det;
            out[1] = (-a22 * a01 + a02 * a21) * det;
            out[2] = (a12 * a01 - a02 * a11) * det;
            out[3] = b11 * det;
            out[4] = (a22 * a00 - a02 * a20) * det;
            out[5] = (-a12 * a00 + a02 * a10) * det;
            out[6] = b21 * det;
            out[7] = (-a21 * a00 + a01 * a20) * det;
            out[8] = (a11 * a00 - a01 * a10) * det;
            return out;
        };
        mat3.adjoint = function (out, a) {
            var a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[3], a11 = a[4], a12 = a[5], a20 = a[6], a21 = a[7], a22 = a[8];
            out[0] = a11 * a22 - a12 * a21;
            out[1] = a02 * a21 - a01 * a22;
            out[2] = a01 * a12 - a02 * a11;
            out[3] = a12 * a20 - a10 * a22;
            out[4] = a00 * a22 - a02 * a20;
            out[5] = a02 * a10 - a00 * a12;
            out[6] = a10 * a21 - a11 * a20;
            out[7] = a01 * a20 - a00 * a21;
            out[8] = a00 * a11 - a01 * a10;
            return out;
        };
        mat3.determinant = function (a) {
            var a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[3], a11 = a[4], a12 = a[5], a20 = a[6], a21 = a[7], a22 = a[8];
            return a00 * (a22 * a11 - a12 * a21) + a01 * (-a22 * a10 + a12 * a20) + a02 * (a21 * a10 - a11 * a20);
        };
        mat3.multiply = function (out, a, b) {
            var a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[3], a11 = a[4], a12 = a[5], a20 = a[6], a21 = a[7], a22 = a[8], b00 = b[0], b01 = b[1], b02 = b[2], b10 = b[3], b11 = b[4], b12 = b[5], b20 = b[6], b21 = b[7], b22 = b[8];
            out[0] = b00 * a00 + b01 * a10 + b02 * a20;
            out[1] = b00 * a01 + b01 * a11 + b02 * a21;
            out[2] = b00 * a02 + b01 * a12 + b02 * a22;
            out[3] = b10 * a00 + b11 * a10 + b12 * a20;
            out[4] = b10 * a01 + b11 * a11 + b12 * a21;
            out[5] = b10 * a02 + b11 * a12 + b12 * a22;
            out[6] = b20 * a00 + b21 * a10 + b22 * a20;
            out[7] = b20 * a01 + b21 * a11 + b22 * a21;
            out[8] = b20 * a02 + b21 * a12 + b22 * a22;
            return out;
        };
        mat3.mul = mat3.multiply;
        mat3.translate = function (out, a, v) {
            var a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[3], a11 = a[4], a12 = a[5], a20 = a[6], a21 = a[7], a22 = a[8], x = v[0], y = v[1];
            out[0] = a00;
            out[1] = a01;
            out[2] = a02;
            out[3] = a10;
            out[4] = a11;
            out[5] = a12;
            out[6] = x * a00 + y * a10 + a20;
            out[7] = x * a01 + y * a11 + a21;
            out[8] = x * a02 + y * a12 + a22;
            return out;
        };
        mat3.rotate = function (out, a, rad) {
            var a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[3], a11 = a[4], a12 = a[5], a20 = a[6], a21 = a[7], a22 = a[8], s = Math.sin(rad), c = Math.cos(rad);
            out[0] = c * a00 + s * a10;
            out[1] = c * a01 + s * a11;
            out[2] = c * a02 + s * a12;
            out[3] = c * a10 - s * a00;
            out[4] = c * a11 - s * a01;
            out[5] = c * a12 - s * a02;
            out[6] = a20;
            out[7] = a21;
            out[8] = a22;
            return out;
        };
        mat3.scale = function (out, a, v) {
            var x = v[0], y = v[1];
            out[0] = x * a[0];
            out[1] = x * a[1];
            out[2] = x * a[2];
            out[3] = y * a[3];
            out[4] = y * a[4];
            out[5] = y * a[5];
            out[6] = a[6];
            out[7] = a[7];
            out[8] = a[8];
            return out;
        };
        mat3.fromMat2d = function (out, a) {
            out[0] = a[0];
            out[1] = a[1];
            out[2] = 0;
            out[3] = a[2];
            out[4] = a[3];
            out[5] = 0;
            out[6] = a[4];
            out[7] = a[5];
            out[8] = 1;
            return out;
        };
        mat3.fromQuat = function (out, q) {
            var x = q[0], y = q[1], z = q[2], w = q[3], x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, yx = y * x2, yy = y * y2, zx = z * x2, zy = z * y2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
            out[0] = 1 - yy - zz;
            out[3] = yx - wz;
            out[6] = zx + wy;
            out[1] = yx + wz;
            out[4] = 1 - xx - zz;
            out[7] = zy - wx;
            out[2] = zx - wy;
            out[5] = zy + wx;
            out[8] = 1 - xx - yy;
            return out;
        };
        mat3.normalFromMat4 = function (out, a) {
            var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15], b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32, det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
            if (!det) {
                return null;
            }
            det = 1 / det;
            out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
            out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
            out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
            out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
            out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
            out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
            out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
            out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
            out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
            return out;
        };
        mat3.str = function (a) {
            return 'mat3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' + a[4] + ', ' + a[5] + ', ' + a[6] + ', ' + a[7] + ', ' + a[8] + ')';
        };
        if (typeof exports !== 'undefined') {
            exports.mat3 = mat3;
        }
        ;
        var mat4 = {};
        mat4.create = function () {
            var out = new GLMAT_ARRAY_TYPE(16);
            out[0] = 1;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            out[4] = 0;
            out[5] = 1;
            out[6] = 0;
            out[7] = 0;
            out[8] = 0;
            out[9] = 0;
            out[10] = 1;
            out[11] = 0;
            out[12] = 0;
            out[13] = 0;
            out[14] = 0;
            out[15] = 1;
            return out;
        };
        mat4.clone = function (a) {
            var out = new GLMAT_ARRAY_TYPE(16);
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            out[4] = a[4];
            out[5] = a[5];
            out[6] = a[6];
            out[7] = a[7];
            out[8] = a[8];
            out[9] = a[9];
            out[10] = a[10];
            out[11] = a[11];
            out[12] = a[12];
            out[13] = a[13];
            out[14] = a[14];
            out[15] = a[15];
            return out;
        };
        mat4.copy = function (out, a) {
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            out[4] = a[4];
            out[5] = a[5];
            out[6] = a[6];
            out[7] = a[7];
            out[8] = a[8];
            out[9] = a[9];
            out[10] = a[10];
            out[11] = a[11];
            out[12] = a[12];
            out[13] = a[13];
            out[14] = a[14];
            out[15] = a[15];
            return out;
        };
        mat4.identity = function (out) {
            out[0] = 1;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            out[4] = 0;
            out[5] = 1;
            out[6] = 0;
            out[7] = 0;
            out[8] = 0;
            out[9] = 0;
            out[10] = 1;
            out[11] = 0;
            out[12] = 0;
            out[13] = 0;
            out[14] = 0;
            out[15] = 1;
            return out;
        };
        mat4.transpose = function (out, a) {
            if (out === a) {
                var a01 = a[1], a02 = a[2], a03 = a[3], a12 = a[6], a13 = a[7], a23 = a[11];
                out[1] = a[4];
                out[2] = a[8];
                out[3] = a[12];
                out[4] = a01;
                out[6] = a[9];
                out[7] = a[13];
                out[8] = a02;
                out[9] = a12;
                out[11] = a[14];
                out[12] = a03;
                out[13] = a13;
                out[14] = a23;
            } else {
                out[0] = a[0];
                out[1] = a[4];
                out[2] = a[8];
                out[3] = a[12];
                out[4] = a[1];
                out[5] = a[5];
                out[6] = a[9];
                out[7] = a[13];
                out[8] = a[2];
                out[9] = a[6];
                out[10] = a[10];
                out[11] = a[14];
                out[12] = a[3];
                out[13] = a[7];
                out[14] = a[11];
                out[15] = a[15];
            }
            return out;
        };
        mat4.invert = function (out, a) {
            var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15], b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32, det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
            if (!det) {
                return null;
            }
            det = 1 / det;
            out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
            out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
            out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
            out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
            out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
            out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
            out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
            out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
            out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
            out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
            out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
            out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
            out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
            out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
            out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
            out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
            return out;
        };
        mat4.adjoint = function (out, a) {
            var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
            out[0] = a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22);
            out[1] = -(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22));
            out[2] = a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12);
            out[3] = -(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12));
            out[4] = -(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22));
            out[5] = a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22);
            out[6] = -(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12));
            out[7] = a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12);
            out[8] = a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21);
            out[9] = -(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21));
            out[10] = a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11);
            out[11] = -(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11));
            out[12] = -(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21));
            out[13] = a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21);
            out[14] = -(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11));
            out[15] = a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11);
            return out;
        };
        mat4.determinant = function (a) {
            var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15], b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
            return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        };
        mat4.multiply = function (out, a, b) {
            var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
            var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
            out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
            b0 = b[4];
            b1 = b[5];
            b2 = b[6];
            b3 = b[7];
            out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
            b0 = b[8];
            b1 = b[9];
            b2 = b[10];
            b3 = b[11];
            out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
            b0 = b[12];
            b1 = b[13];
            b2 = b[14];
            b3 = b[15];
            out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
            return out;
        };
        mat4.mul = mat4.multiply;
        mat4.translate = function (out, a, v) {
            var x = v[0], y = v[1], z = v[2], a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33;
            a00 = a[0];
            a01 = a[1];
            a02 = a[2];
            a03 = a[3];
            a10 = a[4];
            a11 = a[5];
            a12 = a[6];
            a13 = a[7];
            a20 = a[8];
            a21 = a[9];
            a22 = a[10];
            a23 = a[11];
            a30 = a[12];
            a31 = a[13];
            a32 = a[14];
            a33 = a[15];
            out[0] = a00 + a03 * x;
            out[1] = a01 + a03 * y;
            out[2] = a02 + a03 * z;
            out[3] = a03;
            out[4] = a10 + a13 * x;
            out[5] = a11 + a13 * y;
            out[6] = a12 + a13 * z;
            out[7] = a13;
            out[8] = a20 + a23 * x;
            out[9] = a21 + a23 * y;
            out[10] = a22 + a23 * z;
            out[11] = a23;
            out[12] = a30 + a33 * x;
            out[13] = a31 + a33 * y;
            out[14] = a32 + a33 * z;
            out[15] = a33;
            return out;
        };
        mat4.scale = function (out, a, v) {
            var x = v[0], y = v[1], z = v[2];
            out[0] = a[0] * x;
            out[1] = a[1] * x;
            out[2] = a[2] * x;
            out[3] = a[3] * x;
            out[4] = a[4] * y;
            out[5] = a[5] * y;
            out[6] = a[6] * y;
            out[7] = a[7] * y;
            out[8] = a[8] * z;
            out[9] = a[9] * z;
            out[10] = a[10] * z;
            out[11] = a[11] * z;
            out[12] = a[12];
            out[13] = a[13];
            out[14] = a[14];
            out[15] = a[15];
            return out;
        };
        mat4.rotate = function (out, a, rad, axis) {
            var x = axis[0], y = axis[1], z = axis[2], len = Math.sqrt(x * x + y * y + z * z), s, c, t, a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, b00, b01, b02, b10, b11, b12, b20, b21, b22;
            if (Math.abs(len) < GLMAT_EPSILON) {
                return null;
            }
            len = 1 / len;
            x *= len;
            y *= len;
            z *= len;
            s = Math.sin(rad);
            c = Math.cos(rad);
            t = 1 - c;
            a00 = a[0];
            a01 = a[1];
            a02 = a[2];
            a03 = a[3];
            a10 = a[4];
            a11 = a[5];
            a12 = a[6];
            a13 = a[7];
            a20 = a[8];
            a21 = a[9];
            a22 = a[10];
            a23 = a[11];
            b00 = x * x * t + c;
            b01 = y * x * t + z * s;
            b02 = z * x * t - y * s;
            b10 = x * y * t - z * s;
            b11 = y * y * t + c;
            b12 = z * y * t + x * s;
            b20 = x * z * t + y * s;
            b21 = y * z * t - x * s;
            b22 = z * z * t + c;
            out[0] = a00 * b00 + a10 * b01 + a20 * b02;
            out[1] = a01 * b00 + a11 * b01 + a21 * b02;
            out[2] = a02 * b00 + a12 * b01 + a22 * b02;
            out[3] = a03 * b00 + a13 * b01 + a23 * b02;
            out[4] = a00 * b10 + a10 * b11 + a20 * b12;
            out[5] = a01 * b10 + a11 * b11 + a21 * b12;
            out[6] = a02 * b10 + a12 * b11 + a22 * b12;
            out[7] = a03 * b10 + a13 * b11 + a23 * b12;
            out[8] = a00 * b20 + a10 * b21 + a20 * b22;
            out[9] = a01 * b20 + a11 * b21 + a21 * b22;
            out[10] = a02 * b20 + a12 * b21 + a22 * b22;
            out[11] = a03 * b20 + a13 * b21 + a23 * b22;
            if (a !== out) {
                out[12] = a[12];
                out[13] = a[13];
                out[14] = a[14];
                out[15] = a[15];
            }
            return out;
        };
        mat4.rotateX = function (out, a, rad) {
            var s = Math.sin(rad), c = Math.cos(rad), a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
            if (a !== out) {
                out[0] = a[0];
                out[1] = a[1];
                out[2] = a[2];
                out[3] = a[3];
                out[12] = a[12];
                out[13] = a[13];
                out[14] = a[14];
                out[15] = a[15];
            }
            out[4] = a10 * c + a20 * s;
            out[5] = a11 * c + a21 * s;
            out[6] = a12 * c + a22 * s;
            out[7] = a13 * c + a23 * s;
            out[8] = a20 * c - a10 * s;
            out[9] = a21 * c - a11 * s;
            out[10] = a22 * c - a12 * s;
            out[11] = a23 * c - a13 * s;
            return out;
        };
        mat4.rotateY = function (out, a, rad) {
            var s = Math.sin(rad), c = Math.cos(rad), a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
            if (a !== out) {
                out[4] = a[4];
                out[5] = a[5];
                out[6] = a[6];
                out[7] = a[7];
                out[12] = a[12];
                out[13] = a[13];
                out[14] = a[14];
                out[15] = a[15];
            }
            out[0] = a00 * c - a20 * s;
            out[1] = a01 * c - a21 * s;
            out[2] = a02 * c - a22 * s;
            out[3] = a03 * c - a23 * s;
            out[8] = a00 * s + a20 * c;
            out[9] = a01 * s + a21 * c;
            out[10] = a02 * s + a22 * c;
            out[11] = a03 * s + a23 * c;
            return out;
        };
        mat4.rotateZ = function (out, a, rad) {
            var s = Math.sin(rad), c = Math.cos(rad), a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
            if (a !== out) {
                out[8] = a[8];
                out[9] = a[9];
                out[10] = a[10];
                out[11] = a[11];
                out[12] = a[12];
                out[13] = a[13];
                out[14] = a[14];
                out[15] = a[15];
            }
            out[0] = a00 * c + a10 * s;
            out[1] = a01 * c + a11 * s;
            out[2] = a02 * c + a12 * s;
            out[3] = a03 * c + a13 * s;
            out[4] = a10 * c - a00 * s;
            out[5] = a11 * c - a01 * s;
            out[6] = a12 * c - a02 * s;
            out[7] = a13 * c - a03 * s;
            return out;
        };
        mat4.fromRotationTranslation = function (out, q, v) {
            var x = q[0], y = q[1], z = q[2], w = q[3], x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
            out[0] = 1 - (yy + zz);
            out[1] = xy + wz;
            out[2] = xz - wy;
            out[3] = 0;
            out[4] = xy - wz;
            out[5] = 1 - (xx + zz);
            out[6] = yz + wx;
            out[7] = 0;
            out[8] = xz + wy;
            out[9] = yz - wx;
            out[10] = 1 - (xx + yy);
            out[11] = 0;
            out[12] = v[0];
            out[13] = v[1];
            out[14] = v[2];
            out[15] = 1;
            return out;
        };
        mat4.fromQuat = function (out, q) {
            var x = q[0], y = q[1], z = q[2], w = q[3], x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, yx = y * x2, yy = y * y2, zx = z * x2, zy = z * y2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
            out[0] = 1 - yy - zz;
            out[1] = yx + wz;
            out[2] = zx - wy;
            out[3] = 0;
            out[4] = yx - wz;
            out[5] = 1 - xx - zz;
            out[6] = zy + wx;
            out[7] = 0;
            out[8] = zx + wy;
            out[9] = zy - wx;
            out[10] = 1 - xx - yy;
            out[11] = 0;
            out[12] = 0;
            out[13] = 0;
            out[14] = 0;
            out[15] = 1;
            return out;
        };
        mat4.frustum = function (out, left, right, bottom, top, near, far) {
            var rl = 1 / (right - left), tb = 1 / (top - bottom), nf = 1 / (near - far);
            out[0] = near * 2 * rl;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            out[4] = 0;
            out[5] = near * 2 * tb;
            out[6] = 0;
            out[7] = 0;
            out[8] = (right + left) * rl;
            out[9] = (top + bottom) * tb;
            out[10] = (far + near) * nf;
            out[11] = -1;
            out[12] = 0;
            out[13] = 0;
            out[14] = far * near * 2 * nf;
            out[15] = 0;
            return out;
        };
        mat4.perspective = function (out, fovy, aspect, near, far) {
            var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
            out[0] = f / aspect;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            out[4] = 0;
            out[5] = f;
            out[6] = 0;
            out[7] = 0;
            out[8] = 0;
            out[9] = 0;
            out[10] = (far + near) * nf;
            out[11] = -1;
            out[12] = 0;
            out[13] = 0;
            out[14] = 2 * far * near * nf;
            out[15] = 0;
            return out;
        };
        mat4.ortho = function (out, left, right, bottom, top, near, far) {
            var lr = 1 / (left - right), bt = 1 / (bottom - top), nf = 1 / (near - far);
            out[0] = -2 * lr;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            out[4] = 0;
            out[5] = -2 * bt;
            out[6] = 0;
            out[7] = 0;
            out[8] = 0;
            out[9] = 0;
            out[10] = 2 * nf;
            out[11] = 0;
            out[12] = (left + right) * lr;
            out[13] = (top + bottom) * bt;
            out[14] = (far + near) * nf;
            out[15] = 1;
            return out;
        };
        mat4.lookAt = function (out, eye, center, up) {
            var x0, x1, x2, y0, y1, y2, z0, z1, z2, len, eyex = eye[0], eyey = eye[1], eyez = eye[2], upx = up[0], upy = up[1], upz = up[2], centerx = center[0], centery = center[1], centerz = center[2];
            if (Math.abs(eyex - centerx) < GLMAT_EPSILON && Math.abs(eyey - centery) < GLMAT_EPSILON && Math.abs(eyez - centerz) < GLMAT_EPSILON) {
                return mat4.identity(out);
            }
            z0 = eyex - centerx;
            z1 = eyey - centery;
            z2 = eyez - centerz;
            len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
            z0 *= len;
            z1 *= len;
            z2 *= len;
            x0 = upy * z2 - upz * z1;
            x1 = upz * z0 - upx * z2;
            x2 = upx * z1 - upy * z0;
            len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
            if (!len) {
                x0 = 0;
                x1 = 0;
                x2 = 0;
            } else {
                len = 1 / len;
                x0 *= len;
                x1 *= len;
                x2 *= len;
            }
            y0 = z1 * x2 - z2 * x1;
            y1 = z2 * x0 - z0 * x2;
            y2 = z0 * x1 - z1 * x0;
            len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
            if (!len) {
                y0 = 0;
                y1 = 0;
                y2 = 0;
            } else {
                len = 1 / len;
                y0 *= len;
                y1 *= len;
                y2 *= len;
            }
            out[0] = x0;
            out[1] = y0;
            out[2] = z0;
            out[3] = 0;
            out[4] = x1;
            out[5] = y1;
            out[6] = z1;
            out[7] = 0;
            out[8] = x2;
            out[9] = y2;
            out[10] = z2;
            out[11] = 0;
            out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
            out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
            out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
            out[15] = 1;
            return out;
        };
        mat4.str = function (a) {
            return 'mat4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' + a[4] + ', ' + a[5] + ', ' + a[6] + ', ' + a[7] + ', ' + a[8] + ', ' + a[9] + ', ' + a[10] + ', ' + a[11] + ', ' + a[12] + ', ' + a[13] + ', ' + a[14] + ', ' + a[15] + ')';
        };
        if (typeof exports !== 'undefined') {
            exports.mat4 = mat4;
        }
        ;
        var quat = {};
        quat.create = function () {
            var out = new GLMAT_ARRAY_TYPE(4);
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            out[3] = 1;
            return out;
        };
        quat.rotationTo = function () {
            var tmpvec3 = vec3.create();
            var xUnitVec3 = vec3.fromValues(1, 0, 0);
            var yUnitVec3 = vec3.fromValues(0, 1, 0);
            return function (out, a, b) {
                var dot = vec3.dot(a, b);
                if (dot < -0.999999) {
                    vec3.cross(tmpvec3, xUnitVec3, a);
                    if (vec3.length(tmpvec3) < 0.000001)
                        vec3.cross(tmpvec3, yUnitVec3, a);
                    vec3.normalize(tmpvec3, tmpvec3);
                    quat.setAxisAngle(out, tmpvec3, Math.PI);
                    return out;
                } else if (dot > 0.999999) {
                    out[0] = 0;
                    out[1] = 0;
                    out[2] = 0;
                    out[3] = 1;
                    return out;
                } else {
                    vec3.cross(tmpvec3, a, b);
                    out[0] = tmpvec3[0];
                    out[1] = tmpvec3[1];
                    out[2] = tmpvec3[2];
                    out[3] = 1 + dot;
                    return quat.normalize(out, out);
                }
            };
        }();
        quat.setAxes = function () {
            var matr = mat3.create();
            return function (out, view, right, up) {
                matr[0] = right[0];
                matr[3] = right[1];
                matr[6] = right[2];
                matr[1] = up[0];
                matr[4] = up[1];
                matr[7] = up[2];
                matr[2] = -view[0];
                matr[5] = -view[1];
                matr[8] = -view[2];
                return quat.normalize(out, quat.fromMat3(out, matr));
            };
        }();
        quat.clone = vec4.clone;
        quat.fromValues = vec4.fromValues;
        quat.copy = vec4.copy;
        quat.set = vec4.set;
        quat.identity = function (out) {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            out[3] = 1;
            return out;
        };
        quat.setAxisAngle = function (out, axis, rad) {
            rad = rad * 0.5;
            var s = Math.sin(rad);
            out[0] = s * axis[0];
            out[1] = s * axis[1];
            out[2] = s * axis[2];
            out[3] = Math.cos(rad);
            return out;
        };
        quat.add = vec4.add;
        quat.multiply = function (out, a, b) {
            var ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
            out[0] = ax * bw + aw * bx + ay * bz - az * by;
            out[1] = ay * bw + aw * by + az * bx - ax * bz;
            out[2] = az * bw + aw * bz + ax * by - ay * bx;
            out[3] = aw * bw - ax * bx - ay * by - az * bz;
            return out;
        };
        quat.mul = quat.multiply;
        quat.scale = vec4.scale;
        quat.rotateX = function (out, a, rad) {
            rad *= 0.5;
            var ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = Math.sin(rad), bw = Math.cos(rad);
            out[0] = ax * bw + aw * bx;
            out[1] = ay * bw + az * bx;
            out[2] = az * bw - ay * bx;
            out[3] = aw * bw - ax * bx;
            return out;
        };
        quat.rotateY = function (out, a, rad) {
            rad *= 0.5;
            var ax = a[0], ay = a[1], az = a[2], aw = a[3], by = Math.sin(rad), bw = Math.cos(rad);
            out[0] = ax * bw - az * by;
            out[1] = ay * bw + aw * by;
            out[2] = az * bw + ax * by;
            out[3] = aw * bw - ay * by;
            return out;
        };
        quat.rotateZ = function (out, a, rad) {
            rad *= 0.5;
            var ax = a[0], ay = a[1], az = a[2], aw = a[3], bz = Math.sin(rad), bw = Math.cos(rad);
            out[0] = ax * bw + ay * bz;
            out[1] = ay * bw - ax * bz;
            out[2] = az * bw + aw * bz;
            out[3] = aw * bw - az * bz;
            return out;
        };
        quat.calculateW = function (out, a) {
            var x = a[0], y = a[1], z = a[2];
            out[0] = x;
            out[1] = y;
            out[2] = z;
            out[3] = -Math.sqrt(Math.abs(1 - x * x - y * y - z * z));
            return out;
        };
        quat.dot = vec4.dot;
        quat.lerp = vec4.lerp;
        quat.slerp = function (out, a, b, t) {
            var ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
            var omega, cosom, sinom, scale0, scale1;
            cosom = ax * bx + ay * by + az * bz + aw * bw;
            if (cosom < 0) {
                cosom = -cosom;
                bx = -bx;
                by = -by;
                bz = -bz;
                bw = -bw;
            }
            if (1 - cosom > 0.000001) {
                omega = Math.acos(cosom);
                sinom = Math.sin(omega);
                scale0 = Math.sin((1 - t) * omega) / sinom;
                scale1 = Math.sin(t * omega) / sinom;
            } else {
                scale0 = 1 - t;
                scale1 = t;
            }
            out[0] = scale0 * ax + scale1 * bx;
            out[1] = scale0 * ay + scale1 * by;
            out[2] = scale0 * az + scale1 * bz;
            out[3] = scale0 * aw + scale1 * bw;
            return out;
        };
        quat.invert = function (out, a) {
            var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], dot = a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3, invDot = dot ? 1 / dot : 0;
            out[0] = -a0 * invDot;
            out[1] = -a1 * invDot;
            out[2] = -a2 * invDot;
            out[3] = a3 * invDot;
            return out;
        };
        quat.conjugate = function (out, a) {
            out[0] = -a[0];
            out[1] = -a[1];
            out[2] = -a[2];
            out[3] = a[3];
            return out;
        };
        quat.length = vec4.length;
        quat.len = quat.length;
        quat.squaredLength = vec4.squaredLength;
        quat.sqrLen = quat.squaredLength;
        quat.normalize = vec4.normalize;
        quat.fromMat3 = function (out, m) {
            var fTrace = m[0] + m[4] + m[8];
            var fRoot;
            if (fTrace > 0) {
                fRoot = Math.sqrt(fTrace + 1);
                out[3] = 0.5 * fRoot;
                fRoot = 0.5 / fRoot;
                out[0] = (m[7] - m[5]) * fRoot;
                out[1] = (m[2] - m[6]) * fRoot;
                out[2] = (m[3] - m[1]) * fRoot;
            } else {
                var i = 0;
                if (m[4] > m[0])
                    i = 1;
                if (m[8] > m[i * 3 + i])
                    i = 2;
                var j = (i + 1) % 3;
                var k = (i + 2) % 3;
                fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1);
                out[i] = 0.5 * fRoot;
                fRoot = 0.5 / fRoot;
                out[3] = (m[k * 3 + j] - m[j * 3 + k]) * fRoot;
                out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
                out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
            }
            return out;
        };
        quat.str = function (a) {
            return 'quat(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
        };
        if (typeof exports !== 'undefined') {
            exports.quat = quat;
        }
        ;
    }(shim.exports));
}(this));define('qtek/core/mixin/derive', ['require'], function (require) {
    'use strict';
    function derive(makeDefaultOpt, initialize, proto) {
        if (typeof initialize == 'object') {
            proto = initialize;
            initialize = null;
        }
        var _super = this;
        var propList;
        if (!(makeDefaultOpt instanceof Function)) {
            propList = [];
            for (var propName in makeDefaultOpt) {
                if (makeDefaultOpt.hasOwnProperty(propName)) {
                    propList.push(propName);
                }
            }
        }
        var sub = function (options) {
            _super.apply(this, arguments);
            if (makeDefaultOpt instanceof Function) {
                extend(this, makeDefaultOpt.call(this));
            } else {
                extendWithPropList(this, makeDefaultOpt, propList);
            }
            if (this.constructor === sub) {
                var initializers = sub.__initializers__;
                for (var i = 0; i < initializers.length; i++) {
                    initializers[i].apply(this, arguments);
                }
            }
        };
        sub.__super__ = _super;
        if (!_super.__initializers__) {
            sub.__initializers__ = [];
        } else {
            sub.__initializers__ = _super.__initializers__.slice();
        }
        if (initialize) {
            sub.__initializers__.push(initialize);
        }
        var Ctor = function () {
        };
        Ctor.prototype = _super.prototype;
        sub.prototype = new Ctor();
        sub.prototype.constructor = sub;
        extend(sub.prototype, proto);
        sub.derive = _super.derive;
        return sub;
    }
    function extend(target, source) {
        if (!source) {
            return;
        }
        for (var name in source) {
            if (source.hasOwnProperty(name)) {
                target[name] = source[name];
            }
        }
    }
    function extendWithPropList(target, source, propList) {
        for (var i = 0; i < propList.length; i++) {
            var propName = propList[i];
            target[propName] = source[propName];
        }
    }
    return { derive: derive };
});define('qtek/core/mixin/notifier', [], function () {
    function Handler(action, context) {
        this.action = action;
        this.context = context;
    }
    var notifier = {
        trigger: function (name) {
            if (!this.hasOwnProperty('__handlers__')) {
                return;
            }
            if (!this.__handlers__.hasOwnProperty(name)) {
                return;
            }
            var hdls = this.__handlers__[name];
            var l = hdls.length, i = -1, args = arguments;
            switch (args.length) {
            case 1:
                while (++i < l) {
                    hdls[i].action.call(hdls[i].context);
                }
                return;
            case 2:
                while (++i < l) {
                    hdls[i].action.call(hdls[i].context, args[1]);
                }
                return;
            case 3:
                while (++i < l) {
                    hdls[i].action.call(hdls[i].context, args[1], args[2]);
                }
                return;
            case 4:
                while (++i < l) {
                    hdls[i].action.call(hdls[i].context, args[1], args[2], args[3]);
                }
                return;
            case 5:
                while (++i < l) {
                    hdls[i].action.call(hdls[i].context, args[1], args[2], args[3], args[4]);
                }
                return;
            default:
                while (++i < l) {
                    hdls[i].action.apply(hdls[i].context, Array.prototype.slice.call(args, 1));
                }
                return;
            }
        },
        on: function (name, action, context) {
            if (!name || !action) {
                return;
            }
            var handlers = this.__handlers__ || (this.__handlers__ = {});
            if (!handlers[name]) {
                handlers[name] = [];
            } else {
                if (this.has(name, action)) {
                    return;
                }
            }
            var handler = new Handler(action, context || this);
            handlers[name].push(handler);
            return this;
        },
        once: function (name, action, context) {
            if (!name || !action) {
                return;
            }
            var self = this;
            function wrapper() {
                self.off(name, wrapper);
                action.apply(this, arguments);
            }
            return this.on(name, wrapper, context);
        },
        before: function (name, action, context) {
            if (!name || !action) {
                return;
            }
            name = 'before' + name;
            return this.on(name, action, context);
        },
        after: function (name, action, context) {
            if (!name || !action) {
                return;
            }
            name = 'after' + name;
            return this.on(name, action, context);
        },
        success: function (action, context) {
            return this.once('success', action, context);
        },
        error: function (action, context) {
            return this.once('error', action, context);
        },
        off: function (name, action) {
            var handlers = this.__handlers__ || (this.__handlers__ = {});
            if (!action) {
                handlers[name] = [];
                return;
            }
            if (handlers[name]) {
                var hdls = handlers[name];
                var retains = [];
                for (var i = 0; i < hdls.length; i++) {
                    if (action && hdls[i].action !== action) {
                        retains.push(hdls[i]);
                    }
                }
                handlers[name] = retains;
            }
            return this;
        },
        has: function (name, action) {
            var handlers = this.__handlers__;
            if (!handlers || !handlers[name]) {
                return false;
            }
            var hdls = handlers[name];
            for (var i = 0; i < hdls.length; i++) {
                if (hdls[i].action === action) {
                    return true;
                }
            }
        }
    };
    return notifier;
});define('qtek/core/util', ['require'], function (require) {
    'use strict';
    var guid = 0;
    var util = {
        genGUID: function () {
            return ++guid;
        },
        relative2absolute: function (path, basePath) {
            if (!basePath || path.match(/^\//)) {
                return path;
            }
            var pathParts = path.split('/');
            var basePathParts = basePath.split('/');
            var item = pathParts[0];
            while (item === '.' || item === '..') {
                if (item === '..') {
                    basePathParts.pop();
                }
                pathParts.shift();
                item = pathParts[0];
            }
            return basePathParts.join('/') + '/' + pathParts.join('/');
        },
        extend: function (target, source) {
            if (source) {
                for (var name in source) {
                    if (source.hasOwnProperty(name)) {
                        target[name] = source[name];
                    }
                }
            }
            return target;
        },
        defaults: function (target, source) {
            if (source) {
                for (var propName in source) {
                    if (target[propName] === undefined) {
                        target[propName] = source[propName];
                    }
                }
            }
            return target;
        },
        extendWithPropList: function (target, source, propList) {
            if (source) {
                for (var i = 0; i < propList.length; i++) {
                    var propName = propList[i];
                    target[propName] = source[propName];
                }
            }
            return target;
        },
        defaultsWithPropList: function (target, source, propList) {
            if (source) {
                for (var i = 0; i < propList.length; i++) {
                    var propName = propList[i];
                    if (target[propName] === undefined) {
                        target[propName] = source[propName];
                    }
                }
            }
            return target;
        },
        each: function (obj, iterator, context) {
            if (!(obj && iterator)) {
                return;
            }
            if (obj.forEach) {
                obj.forEach(iterator, context);
            } else if (obj.length === +obj.length) {
                for (var i = 0, len = obj.length; i < len; i++) {
                    iterator.call(context, obj[i], i, obj);
                }
            } else {
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        iterator.call(context, obj[key], key, obj);
                    }
                }
            }
        },
        isObject: function (obj) {
            return obj === Object(obj);
        },
        isArray: function (obj) {
            return obj instanceof Array;
        },
        isArrayLike: function (obj) {
            if (!obj) {
                return false;
            } else {
                return obj.length === +obj.length;
            }
        },
        clone: function (obj) {
            if (!util.isObject(obj)) {
                return obj;
            } else if (util.isArray(obj)) {
                return obj.slice();
            } else if (util.isArrayLike(obj)) {
                var ret = new obj.constructor(obj.length);
                for (var i = 0; i < obj.length; i++) {
                    ret[i] = obj[i];
                }
                return ret;
            } else {
                return util.extend({}, obj);
            }
        }
    };
    return util;
});define('qtek/Renderable', [
    'require',
    './Node',
    './core/glenum',
    './core/glinfo',
    './DynamicGeometry'
], function (require) {
    'use strict';
    var Node = require('./Node');
    var glenum = require('./core/glenum');
    var glinfo = require('./core/glinfo');
    var DynamicGeometry = require('./DynamicGeometry');
    var prevDrawID = 0;
    var prevDrawIndicesBuffer = null;
    var prevDrawIsUseFace = true;
    var currentDrawID;
    var RenderInfo = function () {
        this.faceNumber = 0;
        this.vertexNumber = 0;
        this.drawCallNumber = 0;
    };
    function VertexArrayObject(availableAttributes, availableAttributeSymbols, indicesBuffer) {
        this.availableAttributes = availableAttributes;
        this.availableAttributeSymbols = availableAttributeSymbols;
        this.indicesBuffer = indicesBuffer;
        this.vao = null;
    }
    var Renderable = Node.derive({
        material: null,
        geometry: null,
        mode: glenum.TRIANGLES,
        _drawCache: null,
        _renderInfo: null
    }, function () {
        this._drawCache = {};
        this._renderInfo = new RenderInfo();
    }, {
        lineWidth: 1,
        culling: true,
        cullFace: glenum.BACK,
        frontFace: glenum.CCW,
        frustumCulling: true,
        receiveShadow: true,
        castShadow: true,
        ignorePicking: false,
        isRenderable: function () {
            return this.geometry && this.material && this.material.shader && this.visible;
        },
        render: function (_gl, globalMaterial) {
            var material = globalMaterial || this.material;
            var shader = material.shader;
            var geometry = this.geometry;
            var glDrawMode = this.mode;
            var nVertex = geometry.getVertexNumber();
            var isUseFace = geometry.isUseFace();
            var uintExt = glinfo.getExtension(_gl, 'OES_element_index_uint');
            var useUintExt = uintExt && nVertex > 65535;
            var indicesType = useUintExt ? _gl.UNSIGNED_INT : _gl.UNSIGNED_SHORT;
            var vaoExt = glinfo.getExtension(_gl, 'OES_vertex_array_object');
            var isStatic = !geometry.dynamic;
            var renderInfo = this._renderInfo;
            renderInfo.vertexNumber = nVertex;
            renderInfo.faceNumber = 0;
            renderInfo.drawCallNumber = 0;
            var drawHashChanged = false;
            currentDrawID = _gl.__GLID__ + '-' + geometry.__GUID__ + '-' + shader.__GUID__;
            if (currentDrawID !== prevDrawID) {
                drawHashChanged = true;
            } else {
                if (geometry instanceof DynamicGeometry && (nVertex > 65535 && !uintExt) && isUseFace || vaoExt && isStatic || geometry._cache.isDirty()) {
                    drawHashChanged = true;
                }
            }
            prevDrawID = currentDrawID;
            if (!drawHashChanged) {
                if (prevDrawIsUseFace) {
                    _gl.drawElements(glDrawMode, prevDrawIndicesBuffer.count, indicesType, 0);
                    renderInfo.faceNumber = prevDrawIndicesBuffer.count / 3;
                } else {
                    _gl.drawArrays(glDrawMode, 0, nVertex);
                }
                renderInfo.drawCallNumber = 1;
            } else {
                var vaoList = this._drawCache[currentDrawID];
                if (!vaoList) {
                    var chunks = geometry.getBufferChunks(_gl);
                    if (!chunks) {
                        return;
                    }
                    vaoList = [];
                    for (var c = 0; c < chunks.length; c++) {
                        var chunk = chunks[c];
                        var attributeBuffers = chunk.attributeBuffers;
                        var indicesBuffer = chunk.indicesBuffer;
                        var availableAttributes = [];
                        var availableAttributeSymbols = [];
                        for (var a = 0; a < attributeBuffers.length; a++) {
                            var attributeBufferInfo = attributeBuffers[a];
                            var name = attributeBufferInfo.name;
                            var semantic = attributeBufferInfo.semantic;
                            var symbol;
                            if (semantic) {
                                var semanticInfo = shader.attribSemantics[semantic];
                                symbol = semanticInfo && semanticInfo.symbol;
                            } else {
                                symbol = name;
                            }
                            if (symbol && shader.attributeTemplates[symbol]) {
                                availableAttributes.push(attributeBufferInfo);
                                availableAttributeSymbols.push(symbol);
                            }
                        }
                        var vao = new VertexArrayObject(availableAttributes, availableAttributeSymbols, indicesBuffer);
                        vaoList.push(vao);
                    }
                    if (isStatic) {
                        this._drawCache[currentDrawID] = vaoList;
                    }
                }
                for (var i = 0; i < vaoList.length; i++) {
                    var vao = vaoList[i];
                    var needsBindAttributes = true;
                    if (vaoExt && isStatic) {
                        if (vao.vao == null) {
                            vao.vao = vaoExt.createVertexArrayOES();
                        } else {
                            needsBindAttributes = false;
                        }
                        vaoExt.bindVertexArrayOES(vao.vao);
                    }
                    var availableAttributes = vao.availableAttributes;
                    var indicesBuffer = vao.indicesBuffer;
                    if (needsBindAttributes) {
                        var locationList = shader.enableAttributes(_gl, vao.availableAttributeSymbols, vaoExt && isStatic && vao.vao);
                        for (var a = 0; a < availableAttributes.length; a++) {
                            var location = locationList[a];
                            if (location === -1) {
                                continue;
                            }
                            var attributeBufferInfo = availableAttributes[a];
                            var buffer = attributeBufferInfo.buffer;
                            var size = attributeBufferInfo.size;
                            var glType;
                            switch (attributeBufferInfo.type) {
                            case 'float':
                                glType = _gl.FLOAT;
                                break;
                            case 'byte':
                                glType = _gl.BYTE;
                                break;
                            case 'ubyte':
                                glType = _gl.UNSIGNED_BYTE;
                                break;
                            case 'short':
                                glType = _gl.SHORT;
                                break;
                            case 'ushort':
                                glType = _gl.UNSIGNED_SHORT;
                                break;
                            default:
                                glType = _gl.FLOAT;
                                break;
                            }
                            _gl.bindBuffer(_gl.ARRAY_BUFFER, buffer);
                            _gl.vertexAttribPointer(location, size, glType, false, 0, 0);
                        }
                    }
                    if (glDrawMode == glenum.LINES || glDrawMode == glenum.LINE_STRIP || glDrawMode == glenum.LINE_LOOP) {
                        _gl.lineWidth(this.lineWidth);
                    }
                    prevDrawIndicesBuffer = indicesBuffer;
                    prevDrawIsUseFace = geometry.isUseFace();
                    if (prevDrawIsUseFace) {
                        if (needsBindAttributes) {
                            _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer);
                        }
                        _gl.drawElements(glDrawMode, indicesBuffer.count, indicesType, 0);
                        renderInfo.faceNumber += indicesBuffer.count / 3;
                    } else {
                        _gl.drawArrays(glDrawMode, 0, nVertex);
                    }
                    if (vaoExt && isStatic) {
                        vaoExt.bindVertexArrayOES(null);
                    }
                    renderInfo.drawCallNumber++;
                }
            }
            return renderInfo;
        },
        clone: function () {
            var properties = [
                'castShadow',
                'receiveShadow',
                'mode',
                'culling',
                'cullFace',
                'frontFace',
                'frustumCulling'
            ];
            return function () {
                var renderable = Node.prototype.clone.call(this);
                renderable.geometry = this.geometry;
                renderable.material = this.material;
                for (var i = 0; i < properties.length; i++) {
                    var name = properties[i];
                    if (renderable[name] !== this[name]) {
                        renderable[name] = this[name];
                    }
                }
                return renderable;
            };
        }()
    });
    Renderable.beforeFrame = function () {
        prevDrawID = 0;
    };
    Renderable.POINTS = glenum.POINTS;
    Renderable.LINES = glenum.LINES;
    Renderable.LINE_LOOP = glenum.LINE_LOOP;
    Renderable.LINE_STRIP = glenum.LINE_STRIP;
    Renderable.TRIANGLES = glenum.TRIANGLES;
    Renderable.TRIANGLE_STRIP = glenum.TRIANGLE_STRIP;
    Renderable.TRIANGLE_FAN = glenum.TRIANGLE_FAN;
    Renderable.BACK = glenum.BACK;
    Renderable.FRONT = glenum.FRONT;
    Renderable.FRONT_AND_BACK = glenum.FRONT_AND_BACK;
    Renderable.CW = glenum.CW;
    Renderable.CCW = glenum.CCW;
    Renderable.RenderInfo = RenderInfo;
    return Renderable;
});define('qtek/core/glinfo', [], function () {
    'use strict';
    var EXTENSION_LIST = [
        'OES_texture_float',
        'OES_texture_half_float',
        'OES_texture_float_linear',
        'OES_texture_half_float_linear',
        'OES_standard_derivatives',
        'OES_vertex_array_object',
        'OES_element_index_uint',
        'WEBGL_compressed_texture_s3tc',
        'WEBGL_depth_texture',
        'EXT_texture_filter_anisotropic',
        'EXT_shader_texture_lod',
        'WEBGL_draw_buffers'
    ];
    var PARAMETER_NAMES = [
        'MAX_TEXTURE_SIZE',
        'MAX_CUBE_MAP_TEXTURE_SIZE'
    ];
    var extensions = {};
    var parameters = {};
    var glinfo = {
        initialize: function (_gl) {
            var glid = _gl.__GLID__;
            if (extensions[glid]) {
                return;
            }
            extensions[glid] = {};
            parameters[glid] = {};
            for (var i = 0; i < EXTENSION_LIST.length; i++) {
                var extName = EXTENSION_LIST[i];
                this._createExtension(_gl, extName);
            }
            for (var i = 0; i < PARAMETER_NAMES.length; i++) {
                var name = PARAMETER_NAMES[i];
                parameters[glid][name] = _gl.getParameter(_gl[name]);
            }
        },
        getExtension: function (_gl, name) {
            var glid = _gl.__GLID__;
            if (extensions[glid]) {
                if (typeof extensions[glid][name] == 'undefined') {
                    this._createExtension(_gl, name);
                }
                return extensions[glid][name];
            }
        },
        getParameter: function (_gl, name) {
            var glid = _gl.__GLID__;
            if (parameters[glid]) {
                return parameters[glid][name];
            }
        },
        dispose: function (_gl) {
            delete extensions[_gl.__GLID__];
            delete parameters[_gl.__GLID__];
        },
        _createExtension: function (_gl, name) {
            var ext = _gl.getExtension(name);
            if (!ext) {
                ext = _gl.getExtension('MOZ_' + name);
            }
            if (!ext) {
                ext = _gl.getExtension('WEBKIT_' + name);
            }
            extensions[_gl.__GLID__][name] = ext;
        }
    };
    return glinfo;
});define('qtek/DynamicGeometry', [
    'require',
    './Geometry',
    './math/BoundingBox',
    './core/glenum',
    './core/glinfo',
    './dep/glmatrix'
], function (require) {
    'use strict';
    var Geometry = require('./Geometry');
    var BoundingBox = require('./math/BoundingBox');
    var glenum = require('./core/glenum');
    var glinfo = require('./core/glinfo');
    var glMatrix = require('./dep/glmatrix');
    var vec3 = glMatrix.vec3;
    var mat4 = glMatrix.mat4;
    var arrSlice = Array.prototype.slice;
    var DynamicGeometry = Geometry.derive(function () {
        return {
            attributes: {
                position: new Geometry.Attribute('position', 'float', 3, 'POSITION', true),
                texcoord0: new Geometry.Attribute('texcoord0', 'float', 2, 'TEXCOORD_0', true),
                texcoord1: new Geometry.Attribute('texcoord1', 'float', 2, 'TEXCOORD_1', true),
                normal: new Geometry.Attribute('normal', 'float', 3, 'NORMAL', true),
                tangent: new Geometry.Attribute('tangent', 'float', 4, 'TANGENT', true),
                color: new Geometry.Attribute('color', 'float', 4, 'COLOR', true),
                weight: new Geometry.Attribute('weight', 'float', 3, 'WEIGHT', true),
                joint: new Geometry.Attribute('joint', 'float', 4, 'JOINT', true),
                barycentric: new Geometry.Attribute('barycentric', 'float', 3, null, true)
            },
            dynamic: true,
            hint: glenum.DYNAMIC_DRAW,
            faces: [],
            _enabledAttributes: null,
            _arrayChunks: []
        };
    }, {
        updateBoundingBox: function () {
            if (!this.boundingBox) {
                this.boundingBox = new BoundingBox();
            }
            this.boundingBox.updateFromVertices(this.attributes.position.value);
        },
        dirty: function (field) {
            if (!field) {
                this.dirty('indices');
                for (var name in this.attributes) {
                    this.dirty(name);
                }
                return;
            }
            this._cache.dirtyAll(field);
            this._cache.dirtyAll();
            this._enabledAttributes = null;
        },
        getVertexNumber: function () {
            var mainAttribute = this.attributes[this.mainAttribute];
            if (!mainAttribute || !mainAttribute.value) {
                return 0;
            }
            return mainAttribute.value.length;
        },
        getFaceNumber: function () {
            return this.faces.length;
        },
        getFace: function (idx, out) {
            if (idx < this.getFaceNumber() && idx >= 0) {
                if (!out) {
                    out = vec3.create();
                }
                vec3.copy(out, this.faces[idx]);
                return out;
            }
        },
        isUseFace: function () {
            return this.useFace && this.faces.length > 0;
        },
        isSplitted: function () {
            return this.getVertexNumber() > 65535;
        },
        createAttribute: function (name, type, size, semantic) {
            var attrib = new Geometry.Attribute(name, type, size, semantic, true);
            this.attributes[name] = attrib;
            this._attributeList.push(name);
            return attrib;
        },
        removeAttribute: function (name) {
            var idx = this._attributeList.indexOf(name);
            if (idx >= 0) {
                this._attributeList.splice(idx, 1);
                delete this.attributes[name];
                return true;
            }
            return false;
        },
        getEnabledAttributes: function () {
            if (this._enabledAttributes) {
                return this._enabledAttributes;
            }
            var result = {};
            var nVertex = this.getVertexNumber();
            for (var i = 0; i < this._attributeList.length; i++) {
                var name = this._attributeList[i];
                var attrib = this.attributes[name];
                if (attrib.value.length) {
                    if (attrib.value.length === nVertex) {
                        result[name] = attrib;
                    }
                }
            }
            this._enabledAttributes = result;
            return result;
        },
        _getDirtyAttributes: function () {
            var attributes = this.getEnabledAttributes();
            if (this._cache.miss('chunks')) {
                return attributes;
            } else {
                var result = {};
                var noDirtyAttributes = true;
                for (var name in attributes) {
                    if (this._cache.isDirty(name)) {
                        result[name] = attributes[name];
                        noDirtyAttributes = false;
                    }
                }
                if (!noDirtyAttributes) {
                    return result;
                }
            }
        },
        getChunkNumber: function () {
            return this._arrayChunks.length;
        },
        getBufferChunks: function (_gl) {
            this._cache.use(_gl.__GLID__);
            if (this._cache.isDirty()) {
                var dirtyAttributes = this._getDirtyAttributes();
                var isFacesDirty = this._cache.isDirty('indices');
                isFacesDirty = isFacesDirty && this.isUseFace();
                if (dirtyAttributes) {
                    this._updateAttributesAndIndicesArrays(dirtyAttributes, isFacesDirty, glinfo.getExtension(_gl, 'OES_element_index_uint') != null);
                    this._updateBuffer(_gl, dirtyAttributes, isFacesDirty);
                    for (var name in dirtyAttributes) {
                        this._cache.fresh(name);
                    }
                    this._cache.fresh('indices');
                    this._cache.fresh();
                }
            }
            return this._cache.get('chunks');
        },
        _updateAttributesAndIndicesArrays: function (attributes, isFacesDirty, useUintExtension) {
            var self = this;
            var nVertex = this.getVertexNumber();
            var verticesReorganizedMap = [];
            var reorganizedFaces = [];
            var ArrayConstructors = {};
            for (var name in attributes) {
                switch (type) {
                case 'byte':
                    ArrayConstructors[name] = Int8Array;
                    break;
                case 'ubyte':
                    ArrayConstructors[name] = Uint8Array;
                    break;
                case 'short':
                    ArrayConstructors[name] = Int16Array;
                    break;
                case 'ushort':
                    ArrayConstructors[name] = Uint16Array;
                    break;
                default:
                    ArrayConstructors[name] = Float32Array;
                    break;
                }
            }
            var newChunk = function (chunkIdx) {
                if (self._arrayChunks[chunkIdx]) {
                    return self._arrayChunks[chunkIdx];
                }
                var chunk = {
                    attributeArrays: {},
                    indicesArray: null
                };
                for (var name in attributes) {
                    chunk.attributeArrays[name] = null;
                }
                for (var i = 0; i < nVertex; i++) {
                    verticesReorganizedMap[i] = -1;
                }
                self._arrayChunks.push(chunk);
                return chunk;
            };
            var attribNameList = Object.keys(attributes);
            if (nVertex > 65535 && this.isUseFace() && !useUintExtension) {
                var chunkIdx = 0;
                var currentChunk;
                var chunkFaceStart = [0];
                var vertexUseCount = [];
                for (i = 0; i < nVertex; i++) {
                    vertexUseCount[i] = -1;
                    verticesReorganizedMap[i] = -1;
                }
                if (isFacesDirty) {
                    for (i = 0; i < this.faces.length; i++) {
                        reorganizedFaces[i] = [
                            0,
                            0,
                            0
                        ];
                    }
                }
                currentChunk = newChunk(chunkIdx);
                var vertexCount = 0;
                for (var i = 0; i < this.faces.length; i++) {
                    var face = this.faces[i];
                    var reorganizedFace = reorganizedFaces[i];
                    if (vertexCount + 3 > 65535) {
                        chunkIdx++;
                        chunkFaceStart[chunkIdx] = i;
                        vertexCount = 0;
                        currentChunk = newChunk(chunkIdx);
                    }
                    for (var f = 0; f < 3; f++) {
                        var ii = face[f];
                        var isNew = verticesReorganizedMap[ii] === -1;
                        for (var k = 0; k < attribNameList.length; k++) {
                            var name = attribNameList[k];
                            var attribArray = currentChunk.attributeArrays[name];
                            var values = attributes[name].value;
                            var size = attributes[name].size;
                            if (!attribArray) {
                                attribArray = currentChunk.attributeArrays[name] = [];
                            }
                            if (isNew) {
                                if (size === 1) {
                                    attribArray[vertexCount] = values[ii];
                                }
                                for (var j = 0; j < size; j++) {
                                    attribArray[vertexCount * size + j] = values[ii][j];
                                }
                            }
                        }
                        if (isNew) {
                            verticesReorganizedMap[ii] = vertexCount;
                            reorganizedFace[f] = vertexCount;
                            vertexCount++;
                        } else {
                            reorganizedFace[f] = verticesReorganizedMap[ii];
                        }
                    }
                }
                for (var c = 0; c < this._arrayChunks.length; c++) {
                    var chunk = this._arrayChunks[c];
                    for (var name in chunk.attributeArrays) {
                        var array = chunk.attributeArrays[name];
                        if (array instanceof Array) {
                            chunk.attributeArrays[name] = new ArrayConstructors[name](array);
                        }
                    }
                }
                if (isFacesDirty) {
                    var chunkStart, chunkEnd, cursor, chunk;
                    for (var c = 0; c < this._arrayChunks.length; c++) {
                        chunkStart = chunkFaceStart[c];
                        chunkEnd = chunkFaceStart[c + 1] || this.faces.length;
                        cursor = 0;
                        chunk = this._arrayChunks[c];
                        var indicesArray = chunk.indicesArray;
                        if (!indicesArray) {
                            indicesArray = chunk.indicesArray = new Uint16Array((chunkEnd - chunkStart) * 3);
                        }
                        for (var i = chunkStart; i < chunkEnd; i++) {
                            indicesArray[cursor++] = reorganizedFaces[i][0];
                            indicesArray[cursor++] = reorganizedFaces[i][1];
                            indicesArray[cursor++] = reorganizedFaces[i][2];
                        }
                    }
                }
            } else {
                var chunk = newChunk(0);
                if (isFacesDirty) {
                    var indicesArray = chunk.indicesArray;
                    var nFace = this.faces.length;
                    if (!indicesArray || nFace * 3 !== indicesArray.length) {
                        var ArrayCtor = nVertex > 65535 ? Uint32Array : Uint16Array;
                        indicesArray = chunk.indicesArray = new ArrayCtor(this.faces.length * 3);
                    }
                    var cursor = 0;
                    for (var i = 0; i < nFace; i++) {
                        indicesArray[cursor++] = this.faces[i][0];
                        indicesArray[cursor++] = this.faces[i][1];
                        indicesArray[cursor++] = this.faces[i][2];
                    }
                }
                for (var name in attributes) {
                    var values = attributes[name].value;
                    var type = attributes[name].type;
                    var size = attributes[name].size;
                    var attribArray = chunk.attributeArrays[name];
                    var arrSize = nVertex * size;
                    if (!attribArray || attribArray.length !== arrSize) {
                        attribArray = new ArrayConstructors[name](arrSize);
                        chunk.attributeArrays[name] = attribArray;
                    }
                    if (size === 1) {
                        for (var i = 0; i < values.length; i++) {
                            attribArray[i] = values[i];
                        }
                    } else {
                        var cursor = 0;
                        for (var i = 0; i < values.length; i++) {
                            for (var j = 0; j < size; j++) {
                                attribArray[cursor++] = values[i][j];
                            }
                        }
                    }
                }
            }
        },
        _updateBuffer: function (_gl, dirtyAttributes, isFacesDirty) {
            var chunks = this._cache.get('chunks');
            var firstUpdate = false;
            if (!chunks) {
                chunks = [];
                for (var i = 0; i < this._arrayChunks.length; i++) {
                    chunks[i] = {
                        attributeBuffers: [],
                        indicesBuffer: null
                    };
                }
                this._cache.put('chunks', chunks);
                firstUpdate = true;
            }
            for (var cc = 0; cc < this._arrayChunks.length; cc++) {
                var chunk = chunks[cc];
                if (!chunk) {
                    chunk = chunks[cc] = {
                        attributeBuffers: [],
                        indicesBuffer: null
                    };
                }
                var attributeBuffers = chunk.attributeBuffers;
                var indicesBuffer = chunk.indicesBuffer;
                var arrayChunk = this._arrayChunks[cc];
                var attributeArrays = arrayChunk.attributeArrays;
                var indicesArray = arrayChunk.indicesArray;
                var count = 0;
                var prevSearchIdx = 0;
                for (var name in dirtyAttributes) {
                    var attribute = dirtyAttributes[name];
                    var type = attribute.type;
                    var semantic = attribute.semantic;
                    var size = attribute.size;
                    var bufferInfo;
                    if (!firstUpdate) {
                        for (var i = prevSearchIdx; i < attributeBuffers.length; i++) {
                            if (attributeBuffers[i].name === name) {
                                bufferInfo = attributeBuffers[i];
                                prevSearchIdx = i + 1;
                                break;
                            }
                        }
                        if (!bufferInfo) {
                            for (var i = prevSearchIdx - 1; i >= 0; i--) {
                                if (attributeBuffers[i].name === name) {
                                    bufferInfo = attributeBuffers[i];
                                    prevSearchIdx = i;
                                    break;
                                }
                            }
                        }
                    }
                    var buffer;
                    if (bufferInfo) {
                        buffer = bufferInfo.buffer;
                    } else {
                        buffer = _gl.createBuffer();
                    }
                    _gl.bindBuffer(_gl.ARRAY_BUFFER, buffer);
                    _gl.bufferData(_gl.ARRAY_BUFFER, attributeArrays[name], this.hint);
                    attributeBuffers[count++] = new Geometry.AttributeBuffer(name, type, buffer, size, semantic);
                }
                attributeBuffers.length = count;
                if (isFacesDirty) {
                    if (!indicesBuffer) {
                        indicesBuffer = new Geometry.IndicesBuffer(_gl.createBuffer());
                        chunk.indicesBuffer = indicesBuffer;
                    }
                    indicesBuffer.count = indicesArray.length;
                    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer);
                    _gl.bufferData(_gl.ELEMENT_ARRAY_BUFFER, indicesArray, this.hint);
                }
            }
        },
        generateVertexNormals: function () {
            var faces = this.faces;
            var len = faces.length;
            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;
            var normal = vec3.create();
            var v21 = vec3.create(), v32 = vec3.create();
            for (var i = 0; i < normals.length; i++) {
                vec3.set(normals[i], 0, 0, 0);
            }
            for (var i = normals.length; i < positions.length; i++) {
                normals[i] = [
                    0,
                    0,
                    0
                ];
            }
            for (var f = 0; f < len; f++) {
                var face = faces[f];
                var i1 = face[0];
                var i2 = face[1];
                var i3 = face[2];
                var p1 = positions[i1];
                var p2 = positions[i2];
                var p3 = positions[i3];
                vec3.sub(v21, p1, p2);
                vec3.sub(v32, p2, p3);
                vec3.cross(normal, v21, v32);
                vec3.add(normals[i1], normals[i1], normal);
                vec3.add(normals[i2], normals[i2], normal);
                vec3.add(normals[i3], normals[i3], normal);
            }
            for (var i = 0; i < normals.length; i++) {
                vec3.normalize(normals[i], normals[i]);
            }
        },
        generateFaceNormals: function () {
            if (!this.isUniqueVertex()) {
                this.generateUniqueVertex();
            }
            var faces = this.faces;
            var len = faces.length;
            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;
            var normal = vec3.create();
            var v21 = vec3.create(), v32 = vec3.create();
            var isCopy = normals.length === positions.length;
            for (var i = 0; i < len; i++) {
                var face = faces[i];
                var i1 = face[0];
                var i2 = face[1];
                var i3 = face[2];
                var p1 = positions[i1];
                var p2 = positions[i2];
                var p3 = positions[i3];
                vec3.sub(v21, p1, p2);
                vec3.sub(v32, p2, p3);
                vec3.cross(normal, v21, v32);
                if (isCopy) {
                    vec3.copy(normals[i1], normal);
                    vec3.copy(normals[i2], normal);
                    vec3.copy(normals[i3], normal);
                } else {
                    normals[i1] = normals[i2] = normals[i3] = arrSlice.call(normal);
                }
            }
        },
        generateTangents: function () {
            var texcoords = this.attributes.texcoord0.value;
            var positions = this.attributes.position.value;
            var tangents = this.attributes.tangent.value;
            var normals = this.attributes.normal.value;
            var tan1 = [];
            var tan2 = [];
            var nVertex = this.getVertexNumber();
            for (var i = 0; i < nVertex; i++) {
                tan1[i] = [
                    0,
                    0,
                    0
                ];
                tan2[i] = [
                    0,
                    0,
                    0
                ];
            }
            var sdir = [
                0,
                0,
                0
            ];
            var tdir = [
                0,
                0,
                0
            ];
            for (var i = 0; i < this.faces.length; i++) {
                var face = this.faces[i], i1 = face[0], i2 = face[1], i3 = face[2], st1 = texcoords[i1], st2 = texcoords[i2], st3 = texcoords[i3], p1 = positions[i1], p2 = positions[i2], p3 = positions[i3];
                var x1 = p2[0] - p1[0], x2 = p3[0] - p1[0], y1 = p2[1] - p1[1], y2 = p3[1] - p1[1], z1 = p2[2] - p1[2], z2 = p3[2] - p1[2];
                var s1 = st2[0] - st1[0], s2 = st3[0] - st1[0], t1 = st2[1] - st1[1], t2 = st3[1] - st1[1];
                var r = 1 / (s1 * t2 - t1 * s2);
                sdir[0] = (t2 * x1 - t1 * x2) * r;
                sdir[1] = (t2 * y1 - t1 * y2) * r;
                sdir[2] = (t2 * z1 - t1 * z2) * r;
                tdir[0] = (s1 * x2 - s2 * x1) * r;
                tdir[1] = (s1 * y2 - s2 * y1) * r;
                tdir[2] = (s1 * z2 - s2 * z1) * r;
                vec3.add(tan1[i1], tan1[i1], sdir);
                vec3.add(tan1[i2], tan1[i2], sdir);
                vec3.add(tan1[i3], tan1[i3], sdir);
                vec3.add(tan2[i1], tan2[i1], tdir);
                vec3.add(tan2[i2], tan2[i2], tdir);
                vec3.add(tan2[i3], tan2[i3], tdir);
            }
            var tmp = [
                0,
                0,
                0,
                0
            ];
            var nCrossT = [
                0,
                0,
                0
            ];
            for (var i = 0; i < nVertex; i++) {
                var n = normals[i];
                var t = tan1[i];
                vec3.scale(tmp, n, vec3.dot(n, t));
                vec3.sub(tmp, t, tmp);
                vec3.normalize(tmp, tmp);
                vec3.cross(nCrossT, n, t);
                tmp[3] = vec3.dot(nCrossT, tan2[i]) < 0 ? -1 : 1;
                tangents[i] = tmp.slice();
            }
        },
        isUniqueVertex: function () {
            if (this.isUseFace()) {
                return this.getVertexNumber() === this.faces.length * 3;
            } else {
                return true;
            }
        },
        generateUniqueVertex: function () {
            var vertexUseCount = [];
            for (var i = 0; i < this.getVertexNumber(); i++) {
                vertexUseCount[i] = 0;
            }
            var cursor = this.getVertexNumber();
            var attributes = this.getEnabledAttributes();
            var faces = this.faces;
            var attributeNameList = Object.keys(attributes);
            for (var i = 0; i < faces.length; i++) {
                var face = faces[i];
                for (var j = 0; j < 3; j++) {
                    var ii = face[j];
                    if (vertexUseCount[ii] > 0) {
                        for (var a = 0; a < attributeNameList.length; a++) {
                            var name = attributeNameList[a];
                            var array = attributes[name].value;
                            var size = attributes[name].size;
                            if (size === 1) {
                                array.push(array[ii]);
                            } else {
                                array.push(arrSlice.call(array[ii]));
                            }
                        }
                        face[j] = cursor;
                        cursor++;
                    }
                    vertexUseCount[ii]++;
                }
            }
            this.dirty();
        },
        generateBarycentric: function () {
            var a = [
                1,
                0,
                0
            ];
            var b = [
                0,
                0,
                1
            ];
            var c = [
                0,
                1,
                0
            ];
            return function () {
                if (!this.isUniqueVertex()) {
                    this.generateUniqueVertex();
                }
                var array = this.attributes.barycentric.value;
                if (array.length == this.faces.length * 3) {
                    return;
                }
                var i1, i2, i3, face;
                for (var i = 0; i < this.faces.length; i++) {
                    face = this.faces[i];
                    i1 = face[0];
                    i2 = face[1];
                    i3 = face[2];
                    array[i1] = a;
                    array[i2] = b;
                    array[i3] = c;
                }
            };
        }(),
        convertToStatic: function (geometry, useUintExtension) {
            this._updateAttributesAndIndicesArrays(this.getEnabledAttributes(), true, useUintExtension);
            if (this._arrayChunks.length > 1) {
                console.warn('Large geometry will discard chunks when convert to StaticGeometry');
            } else if (this._arrayChunks.length === 0) {
                return geometry;
            }
            var chunk = this._arrayChunks[0];
            var attributes = this.getEnabledAttributes();
            for (var name in attributes) {
                var attrib = attributes[name];
                var geoAttrib = geometry.attributes[name];
                if (!geoAttrib) {
                    geoAttrib = geometry.attributes[name] = {
                        type: attrib.type,
                        size: attrib.size,
                        value: null
                    };
                    if (attrib.semantic) {
                        geoAttrib.semantic = attrib.semantic;
                    }
                }
                geoAttrib.value = chunk.attributeArrays[name];
            }
            geometry.faces = chunk.indicesArray;
            if (this.boundingBox) {
                geometry.boundingBox = new BoundingBox();
                geometry.boundingBox.min.copy(this.boundingBox.min);
                geometry.boundingBox.max.copy(this.boundingBox.max);
            }
            return geometry;
        },
        applyTransform: function (matrix) {
            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;
            var tangents = this.attributes.tangent.value;
            matrix = matrix._array;
            for (var i = 0; i < positions.length; i++) {
                vec3.transformMat4(positions[i], positions[i], matrix);
            }
            var inverseTransposeMatrix = mat4.create();
            mat4.invert(inverseTransposeMatrix, matrix);
            mat4.transpose(inverseTransposeMatrix, inverseTransposeMatrix);
            for (var i = 0; i < normals.length; i++) {
                vec3.transformMat4(normals[i], normals[i], inverseTransposeMatrix);
            }
            for (var i = 0; i < tangents.length; i++) {
                vec3.transformMat4(tangents[i], tangents[i], inverseTransposeMatrix);
            }
            if (this.boundingBox) {
                this.updateBoundingBox();
            }
        },
        dispose: function (_gl) {
            this._cache.use(_gl.__GLID__);
            var chunks = this._cache.get('chunks');
            if (chunks) {
                for (var c = 0; c < chunks.length; c++) {
                    var chunk = chunks[c];
                    for (var k = 0; k < chunk.attributeBuffers.length; k++) {
                        var attribs = chunk.attributeBuffers[k];
                        _gl.deleteBuffer(attribs.buffer);
                    }
                }
            }
            this._cache.deleteContext(_gl.__GLID__);
        }
    });
    return DynamicGeometry;
});define('qtek/Geometry', [
    'require',
    './core/Base',
    './core/glenum',
    './core/Cache',
    './dep/glmatrix'
], function (require) {
    'use strict';
    var Base = require('./core/Base');
    var glenum = require('./core/glenum');
    var Cache = require('./core/Cache');
    var glmatrix = require('./dep/glmatrix');
    var vec2 = glmatrix.vec2;
    var vec3 = glmatrix.vec3;
    var vec4 = glmatrix.vec4;
    function Attribute(name, type, size, semantic, isDynamic) {
        this.name = name;
        this.type = type;
        this.size = size;
        if (semantic) {
            this.semantic = semantic;
        }
        if (isDynamic) {
            this._isDynamic = true;
            this.value = [];
        } else {
            this._isDynamic = false;
            this.value = null;
        }
        switch (size) {
        case 1:
            this.get = function (idx) {
                return this.value[idx];
            };
            this.set = function (idx, value) {
                this.value[idx] = value;
            };
            break;
        case 2:
            if (isDynamic) {
                this.get = function (idx, out) {
                    out = out._array || out;
                    var item = this.value[idx];
                    if (item) {
                        vec2.copy(out, item);
                    }
                    return out;
                };
                this.set = function (idx, val) {
                    val = val._array || val;
                    var item = this.value[idx];
                    if (!item) {
                        item = this.value[idx] = vec2.create();
                    }
                    vec2.copy(item, val);
                };
            } else {
                this.get = function (idx, out) {
                    out = out._array || out;
                    out[0] = this.value[idx * 2];
                    out[1] = this.value[idx * 2 + 1];
                    return out;
                };
                this.set = function (idx, val) {
                    val = val._array || val;
                    this.value[idx * 2] = val[0];
                    this.value[idx * 2 + 1] = val[1];
                };
            }
            break;
        case 3:
            if (isDynamic) {
                this.get = function (idx, out) {
                    out = out._array || out;
                    var item = this.value[idx];
                    if (item) {
                        vec3.copy(out, item);
                    }
                    return out;
                };
                this.set = function (idx, val) {
                    val = val._array || val;
                    var item = this.value[idx];
                    if (!item) {
                        item = this.value[idx] = vec3.create();
                    }
                    vec3.copy(item, val);
                };
            } else {
                this.get = function (idx, out) {
                    out = out._array || out;
                    out[0] = this.value[idx * 3];
                    out[1] = this.value[idx * 3 + 1];
                    out[2] = this.value[idx * 3 + 2];
                    return out;
                };
                this.set = function (idx, val) {
                    val = val._array || val;
                    this.value[idx * 3] = val[0];
                    this.value[idx * 3 + 1] = val[1];
                    this.value[idx * 3 + 2] = val[2];
                };
            }
            break;
        case 4:
            if (isDynamic) {
                this.get = function (idx, out) {
                    out = out._array || out;
                    var item = this.value[idx];
                    if (item) {
                        vec4.copy(out, item);
                    }
                    return out;
                };
                this.set = function (idx, val) {
                    val = val._array || val;
                    var item = this.value[idx];
                    if (!item) {
                        item = this.value[idx] = vec4.create();
                    }
                    vec4.copy(item, val);
                };
            } else {
                this.get = function (idx, out) {
                    out = out._array || out;
                    out[0] = this.value[idx * 4];
                    out[1] = this.value[idx * 4 + 1];
                    out[2] = this.value[idx * 4 + 2];
                    out[3] = this.value[idx * 4 + 3];
                    return out;
                };
                this.set = function (idx, val) {
                    val = val._array || val;
                    this.value[idx * 4] = val[0];
                    this.value[idx * 4 + 1] = val[1];
                    this.value[idx * 4 + 2] = val[2];
                    this.value[idx * 4 + 3] = val[3];
                };
            }
            break;
        }
    }
    Attribute.prototype.init = function (nVertex) {
        if (!this._isDynamic) {
            if (!this.value || this.value.length != nVertex * this.size) {
                var ArrayConstructor;
                switch (this.type) {
                case 'byte':
                    ArrayConstructor = Int8Array;
                    break;
                case 'ubyte':
                    ArrayConstructor = Uint8Array;
                    break;
                case 'short':
                    ArrayConstructor = Int16Array;
                    break;
                case 'ushort':
                    ArrayConstructor = Uint16Array;
                    break;
                default:
                    ArrayConstructor = Float32Array;
                    break;
                }
                this.value = new ArrayConstructor(nVertex * this.size);
            }
        } else {
            console.warn('Dynamic geometry not support init method');
        }
    };
    Attribute.prototype.clone = function (copyValue) {
        var ret = new Attribute(this.name, this.type, this.size, this.semantic, this._isDynamic);
        if (copyValue) {
            console.warn('todo');
        }
        return ret;
    };
    function AttributeBuffer(name, type, buffer, size, semantic) {
        this.name = name;
        this.type = type;
        this.buffer = buffer;
        this.size = size;
        this.semantic = semantic;
        this.symbol = '';
    }
    function IndicesBuffer(buffer) {
        this.buffer = buffer;
        this.count = 0;
    }
    function notImplementedWarn() {
        console.warn('Geometry doesn\'t implement this method, use DynamicGeometry or StaticGeometry instead');
    }
    var Geometry = Base.derive({
        boundingBox: null,
        attributes: {},
        faces: null,
        dynamic: false,
        useFace: true
    }, function () {
        this._cache = new Cache();
        this._attributeList = Object.keys(this.attributes);
    }, {
        pickByRay: null,
        mainAttribute: 'position',
        dirty: notImplementedWarn,
        createAttribute: notImplementedWarn,
        removeAttribute: notImplementedWarn,
        getVertexNumber: notImplementedWarn,
        getFaceNumber: notImplementedWarn,
        getFace: notImplementedWarn,
        isUseFace: notImplementedWarn,
        getEnabledAttributes: notImplementedWarn,
        getBufferChunks: notImplementedWarn,
        generateVertexNormals: notImplementedWarn,
        generateFaceNormals: notImplementedWarn,
        isUniqueVertex: notImplementedWarn,
        generateUniqueVertex: notImplementedWarn,
        generateTangents: notImplementedWarn,
        generateBarycentric: notImplementedWarn,
        applyTransform: notImplementedWarn,
        dispose: notImplementedWarn
    });
    Geometry.STATIC_DRAW = glenum.STATIC_DRAW;
    Geometry.DYNAMIC_DRAW = glenum.DYNAMIC_DRAW;
    Geometry.STREAM_DRAW = glenum.STREAM_DRAW;
    Geometry.AttributeBuffer = AttributeBuffer;
    Geometry.IndicesBuffer = IndicesBuffer;
    Geometry.Attribute = Attribute;
    return Geometry;
});define('qtek/math/BoundingBox', [
    'require',
    './Vector3',
    '../dep/glmatrix'
], function (require) {
    'use strict';
    var Vector3 = require('./Vector3');
    var glMatrix = require('../dep/glmatrix');
    var vec3 = glMatrix.vec3;
    var vec3TransformMat4 = vec3.transformMat4;
    var vec3Copy = vec3.copy;
    var vec3Set = vec3.set;
    var BoundingBox = function (min, max) {
        this.min = min || new Vector3(Infinity, Infinity, Infinity);
        this.max = max || new Vector3(-Infinity, -Infinity, -Infinity);
        var vertices = [];
        for (var i = 0; i < 8; i++) {
            vertices[i] = vec3.fromValues(0, 0, 0);
        }
        this.vertices = vertices;
    };
    BoundingBox.prototype = {
        constructor: BoundingBox,
        updateFromVertices: function (vertices) {
            if (vertices.length > 0) {
                var _min = this.min._array;
                var _max = this.max._array;
                vec3Copy(_min, vertices[0]);
                vec3Copy(_max, vertices[0]);
                for (var i = 1; i < vertices.length; i++) {
                    var vertex = vertices[i];
                    if (vertex[0] < _min[0]) {
                        _min[0] = vertex[0];
                    }
                    if (vertex[1] < _min[1]) {
                        _min[1] = vertex[1];
                    }
                    if (vertex[2] < _min[2]) {
                        _min[2] = vertex[2];
                    }
                    if (vertex[0] > _max[0]) {
                        _max[0] = vertex[0];
                    }
                    if (vertex[1] > _max[1]) {
                        _max[1] = vertex[1];
                    }
                    if (vertex[2] > _max[2]) {
                        _max[2] = vertex[2];
                    }
                }
                this.min._dirty = true;
                this.max._dirty = true;
            }
        },
        union: function (bbox) {
            vec3.min(this.min._array, this.min._array, bbox.min._array);
            vec3.max(this.max._array, this.max._array, bbox.max._array);
            this.min._dirty = true;
            this.max._dirty = true;
        },
        intersectBoundingBox: function (bbox) {
            var _min = this.min._array;
            var _max = this.max._array;
            var _min2 = bbox.min._array;
            var _max2 = bbox.max._array;
            return !(_min[0] > _max2[0] || _min[1] > _max2[1] || _min[2] > _max2[2] || _max[0] < _min2[0] || _max[1] < _min2[1] || _max[2] < _min2[2]);
        },
        applyTransform: function (matrix) {
            if (this.min._dirty || this.max._dirty) {
                this.updateVertices();
                this.min._dirty = false;
                this.max._dirty = false;
            }
            var m4 = matrix._array;
            var _min = this.min._array;
            var _max = this.max._array;
            var vertices = this.vertices;
            var v = vertices[0];
            vec3TransformMat4(v, v, m4);
            vec3Copy(_min, v);
            vec3Copy(_max, v);
            for (var i = 1; i < 8; i++) {
                v = vertices[i];
                vec3TransformMat4(v, v, m4);
                if (v[0] < _min[0]) {
                    _min[0] = v[0];
                }
                if (v[1] < _min[1]) {
                    _min[1] = v[1];
                }
                if (v[2] < _min[2]) {
                    _min[2] = v[2];
                }
                if (v[0] > _max[0]) {
                    _max[0] = v[0];
                }
                if (v[1] > _max[1]) {
                    _max[1] = v[1];
                }
                if (v[2] > _max[2]) {
                    _max[2] = v[2];
                }
            }
            this.min._dirty = true;
            this.max._dirty = true;
        },
        applyProjection: function (matrix) {
            if (this.min._dirty || this.max._dirty) {
                this.updateVertices();
                this.min._dirty = false;
                this.max._dirty = false;
            }
            var m = matrix._array;
            var v1 = this.vertices[0];
            var v2 = this.vertices[3];
            var v3 = this.vertices[7];
            var _min = this.min._array;
            var _max = this.max._array;
            if (m[15] === 1) {
                _min[0] = m[0] * v1[0] + m[12];
                _min[1] = m[5] * v1[1] + m[13];
                _max[2] = m[10] * v1[2] + m[14];
                _max[0] = m[0] * v3[0] + m[12];
                _max[1] = m[5] * v3[1] + m[13];
                _min[2] = m[10] * v3[2] + m[14];
            } else {
                var w = -1 / v1[2];
                _min[0] = m[0] * v1[0] * w;
                _min[1] = m[5] * v1[1] * w;
                _max[2] = (m[10] * v1[2] + m[14]) * w;
                w = -1 / v2[2];
                _max[0] = m[0] * v2[0] * w;
                _max[1] = m[5] * v2[1] * w;
                w = -1 / v3[2];
                _min[2] = (m[10] * v3[2] + m[14]) * w;
            }
            this.min._dirty = true;
            this.max._dirty = true;
        },
        updateVertices: function () {
            var min = this.min._array;
            var max = this.max._array;
            var vertices = this.vertices;
            vec3Set(vertices[0], min[0], min[1], min[2]);
            vec3Set(vertices[1], min[0], max[1], min[2]);
            vec3Set(vertices[2], max[0], min[1], min[2]);
            vec3Set(vertices[3], max[0], max[1], min[2]);
            vec3Set(vertices[4], min[0], min[1], max[2]);
            vec3Set(vertices[5], min[0], max[1], max[2]);
            vec3Set(vertices[6], max[0], min[1], max[2]);
            vec3Set(vertices[7], max[0], max[1], max[2]);
        },
        copy: function (bbox) {
            vec3Copy(this.min._array, bbox.min._array);
            vec3Copy(this.max._array, bbox.max._array);
            this.min._dirty = true;
            this.max._dirty = true;
        },
        clone: function () {
            var boundingBox = new BoundingBox();
            boundingBox.copy(this);
            return boundingBox;
        }
    };
    return BoundingBox;
});define('qtek/core/Cache', [], function () {
    'use strict';
    var Cache = function () {
        this._contextId = 0;
        this._caches = [];
        this._context = {};
    };
    Cache.prototype = {
        use: function (contextId, documentSchema) {
            if (!this._caches[contextId]) {
                this._caches[contextId] = {};
                if (documentSchema) {
                    this._caches[contextId] = documentSchema();
                }
            }
            this._contextId = contextId;
            this._context = this._caches[contextId];
        },
        put: function (key, value) {
            this._context[key] = value;
        },
        get: function (key) {
            return this._context[key];
        },
        dirty: function (field) {
            field = field || '';
            var key = '__dirty__' + field;
            this.put(key, true);
        },
        dirtyAll: function (field) {
            field = field || '';
            var key = '__dirty__' + field;
            for (var i = 0; i < this._caches.length; i++) {
                if (this._caches[i]) {
                    this._caches[i][key] = true;
                }
            }
        },
        fresh: function (field) {
            field = field || '';
            var key = '__dirty__' + field;
            this.put(key, false);
        },
        freshAll: function (field) {
            field = field || '';
            var key = '__dirty__' + field;
            for (var i = 0; i < this._caches.length; i++) {
                if (this._caches[i]) {
                    this._caches[i][key] = false;
                }
            }
        },
        isDirty: function (field) {
            field = field || '';
            var key = '__dirty__' + field;
            return !this._context.hasOwnProperty(key) || this._context[key] === true;
        },
        deleteContext: function (contextId) {
            delete this._caches[contextId];
            this._context = {};
        },
        'delete': function (key) {
            delete this._context[key];
        },
        clearAll: function () {
            this._caches = {};
        },
        getContext: function () {
            return this._context;
        },
        miss: function (key) {
            return !this._context.hasOwnProperty(key);
        }
    };
    Cache.prototype.constructor = Cache;
    return Cache;
});define('qtek/Texture', [
    'require',
    './core/Base',
    './core/glenum',
    './core/Cache'
], function (require) {
    'use strict';
    var Base = require('./core/Base');
    var glenum = require('./core/glenum');
    var Cache = require('./core/Cache');
    var Texture = Base.derive({
        width: 512,
        height: 512,
        type: glenum.UNSIGNED_BYTE,
        format: glenum.RGBA,
        wrapS: glenum.CLAMP_TO_EDGE,
        wrapT: glenum.CLAMP_TO_EDGE,
        minFilter: glenum.LINEAR_MIPMAP_LINEAR,
        magFilter: glenum.LINEAR,
        useMipmap: true,
        anisotropic: 1,
        flipY: true,
        unpackAlignment: 4,
        premultiplyAlpha: false,
        dynamic: false,
        NPOT: false
    }, function () {
        this._cache = new Cache();
    }, {
        getWebGLTexture: function (_gl) {
            var cache = this._cache;
            cache.use(_gl.__GLID__);
            if (cache.miss('webgl_texture')) {
                cache.put('webgl_texture', _gl.createTexture());
            }
            if (this.dynamic) {
                this.update(_gl);
            } else if (cache.isDirty()) {
                this.update(_gl);
                cache.fresh();
            }
            return cache.get('webgl_texture');
        },
        bind: function () {
        },
        unbind: function () {
        },
        dirty: function () {
            this._cache.dirtyAll();
        },
        update: function (_gl) {
        },
        beforeUpdate: function (_gl) {
            _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, this.flipY);
            _gl.pixelStorei(_gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiplyAlpha);
            _gl.pixelStorei(_gl.UNPACK_ALIGNMENT, this.unpackAlignment);
            this.fallBack();
        },
        fallBack: function () {
            var isPowerOfTwo = this.isPowerOfTwo();
            if (this.format === glenum.DEPTH_COMPONENT) {
                this.useMipmap = false;
            }
            if (!isPowerOfTwo || !this.useMipmap) {
                this.NPOT = true;
                this._minFilterOriginal = this.minFilter;
                this._magFilterOriginal = this.magFilter;
                this._wrapSOriginal = this.wrapS;
                this._wrapTOriginal = this.wrapT;
                if (this.minFilter == glenum.NEAREST_MIPMAP_NEAREST || this.minFilter == glenum.NEAREST_MIPMAP_LINEAR) {
                    this.minFilter = glenum.NEAREST;
                } else if (this.minFilter == glenum.LINEAR_MIPMAP_LINEAR || this.minFilter == glenum.LINEAR_MIPMAP_NEAREST) {
                    this.minFilter = glenum.LINEAR;
                }
                this.wrapS = glenum.CLAMP_TO_EDGE;
                this.wrapT = glenum.CLAMP_TO_EDGE;
            } else {
                this.NPOT = false;
                if (this._minFilterOriginal) {
                    this.minFilter = this._minFilterOriginal;
                }
                if (this._magFilterOriginal) {
                    this.magFilter = this._magFilterOriginal;
                }
                if (this._wrapSOriginal) {
                    this.wrapS = this._wrapSOriginal;
                }
                if (this._wrapTOriginal) {
                    this.wrapT = this._wrapTOriginal;
                }
            }
        },
        nextHighestPowerOfTwo: function (x) {
            --x;
            for (var i = 1; i < 32; i <<= 1) {
                x = x | x >> i;
            }
            return x + 1;
        },
        dispose: function (_gl) {
            var cache = this._cache;
            cache.use(_gl.__GLID__);
            var webglTexture = cache.get('webgl_texture');
            if (webglTexture) {
                _gl.deleteTexture(webglTexture);
            }
            cache.deleteContext(_gl.__GLID__);
        },
        isRenderable: function () {
        },
        isPowerOfTwo: function () {
        }
    });
    Texture.BYTE = glenum.BYTE;
    Texture.UNSIGNED_BYTE = glenum.UNSIGNED_BYTE;
    Texture.SHORT = glenum.SHORT;
    Texture.UNSIGNED_SHORT = glenum.UNSIGNED_SHORT;
    Texture.INT = glenum.INT;
    Texture.UNSIGNED_INT = glenum.UNSIGNED_INT;
    Texture.FLOAT = glenum.FLOAT;
    Texture.HALF_FLOAT = 36193;
    Texture.DEPTH_COMPONENT = glenum.DEPTH_COMPONENT;
    Texture.ALPHA = glenum.ALPHA;
    Texture.RGB = glenum.RGB;
    Texture.RGBA = glenum.RGBA;
    Texture.LUMINANCE = glenum.LUMINANCE;
    Texture.LUMINANCE_ALPHA = glenum.LUMINANCE_ALPHA;
    Texture.COMPRESSED_RGB_S3TC_DXT1_EXT = 33776;
    Texture.COMPRESSED_RGBA_S3TC_DXT1_EXT = 33777;
    Texture.COMPRESSED_RGBA_S3TC_DXT3_EXT = 33778;
    Texture.COMPRESSED_RGBA_S3TC_DXT5_EXT = 33779;
    Texture.NEAREST = glenum.NEAREST;
    Texture.LINEAR = glenum.LINEAR;
    Texture.NEAREST_MIPMAP_NEAREST = glenum.NEAREST_MIPMAP_NEAREST;
    Texture.LINEAR_MIPMAP_NEAREST = glenum.LINEAR_MIPMAP_NEAREST;
    Texture.NEAREST_MIPMAP_LINEAR = glenum.NEAREST_MIPMAP_LINEAR;
    Texture.LINEAR_MIPMAP_LINEAR = glenum.LINEAR_MIPMAP_LINEAR;
    Texture.TEXTURE_MAG_FILTER = glenum.TEXTURE_MAG_FILTER;
    Texture.TEXTURE_MIN_FILTER = glenum.TEXTURE_MIN_FILTER;
    Texture.REPEAT = glenum.REPEAT;
    Texture.CLAMP_TO_EDGE = glenum.CLAMP_TO_EDGE;
    Texture.MIRRORED_REPEAT = glenum.MIRRORED_REPEAT;
    return Texture;
});