define('echarts-x', ['echarts-x/echarts-x'], function (main) {return main;});
define('echarts-x/echarts-x', [
    'require',
    'echarts/config',
    './config',
    'zrender/tool/util',
    'qtek/Shader',
    './util/shader/albedo.essl',
    './util/shader/points.essl',
    './util/shader/curveAnimatingPoints.essl',
    './util/shader/vectorFieldParticle.essl',
    './util/shader/motionBlur.essl'
], function (require) {
    var ecConfig = require('echarts/config');
    var ecxConfig = require('./config');
    var zrUtil = require('zrender/tool/util');
    zrUtil.merge(ecConfig, ecxConfig, true);
    var Shader = require('qtek/Shader');
    Shader['import'](require('./util/shader/albedo.essl'));
    Shader['import'](require('./util/shader/points.essl'));
    Shader['import'](require('./util/shader/curveAnimatingPoints.essl'));
    Shader['import'](require('./util/shader/vectorFieldParticle.essl'));
    Shader['import'](require('./util/shader/motionBlur.essl'));
});define('echarts-x/config', [], {
    CHART_TYPE_MAP3D: 'map3d',
    map3d: {
        zlevel: -1,
        mapType: 'world',
        mapLocation: {
            x: 0,
            y: 0,
            width: '100%',
            height: '100%'
        },
        baseLayer: {
            backgroundColor: 'black',
            backgroundImage: '',
            quality: 'medium'
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
        autoRotate: true
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
    }
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
});;
define('echarts-x/util/shader/albedo.essl', function() { return '@export ecx.albedo.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 position: POSITION;\n\n#ifdef VERTEX_COLOR\nattribute vec4 a_Color : COLOR;\nvarying vec4 v_Color;\n#endif\n\nvarying vec2 v_Texcoord;\n\nvoid main()\n{\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n    v_Texcoord = texcoord;\n\n    #ifdef VERTEX_COLOR\n    v_Color = a_Color;\n    #endif\n}\n\n@end\n\n@export ecx.albedo.fragment\n\nuniform sampler2D diffuseMap;\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\n#ifdef VERTEX_COLOR\nvarying vec4 v_Color;\n#endif\n\nvarying vec2 v_Texcoord;\n\nvoid main()\n{\n    gl_FragColor = vec4(color, alpha);\n    \n    #ifdef VERTEX_COLOR\n        gl_FragColor *= v_Color;\n    #endif\n    #ifdef DIFFUSEMAP_ENABLED\n        vec4 tex = texture2D(diffuseMap, v_Texcoord);\n        // Premultiplied alpha\n        #ifdef PREMULTIPLIED_ALPHA\n        tex.rgb /= tex.a;\n        #endif\n        gl_FragColor *= tex;\n    #endif\n}\n@end'});
;
define('echarts-x/util/shader/points.essl', function() { return '@export ecx.points.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform float elapsedTime : 0;\n\nattribute vec3 position : POSITION;\nattribute vec4 color : COLOR;\nattribute float size;\n\n#ifdef ANIMATING\nattribute float delay;\n#endif\n\nvarying vec4 v_Color;\n\nvoid main()\n{\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n\n    #ifdef ANIMATING\n        gl_PointSize = size * (sin((elapsedTime + delay) * 3.14) * 0.5 + 1.0);\n    #else\n        gl_PointSize = size;\n    #endif\n\n    v_Color = color;\n}\n\n@end\n\n@export ecx.points.fragment\n\nvarying vec4 v_Color;\nuniform sampler2D sprite;\n\nvoid main()\n{\n    vec4 color = v_Color;\n\n    #ifdef SPRITE_ENABLED\n        color *= texture2D(sprite, gl_PointCoord);\n    #endif\n\n    gl_FragColor = color;\n}\n@end'});
;
define('echarts-x/util/shader/curveAnimatingPoints.essl', function() { return '@export ecx.curveAnimatingPoints.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform float percent : 0.0;\nuniform float pointSize : 2.0;\n\nattribute vec3 p0;\nattribute vec3 p1;\nattribute vec3 p2;\nattribute vec3 p3;\nattribute vec4 color : COLOR;\n\nattribute float offset;\nattribute float size;\n\nvarying vec4 v_Color;\n\nvoid main()\n{\n    float t = mod(offset + percent, 1.0);\n    float onet = 1.0 - t;\n    vec3 position = onet * onet * (onet * p0 + 3.0 * t * p1)\n        + t * t * (t * p3 + 3.0 * onet * p2);\n\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n\n    gl_PointSize = pointSize * size;\n\n    v_Color = color;\n}\n\n@end\n\n@export ecx.curveAnimatingPoints.fragment\n\nvarying vec4 v_Color;\n\nvoid main()\n{\n    gl_FragColor = v_Color;\n}\n@end'});
;
define('echarts-x/util/shader/vectorFieldParticle.essl', function() { return '@export ecx.vfParticle.particle.fragment\n\nuniform sampler2D particleTexture;\nuniform sampler2D spawnTexture;\nuniform sampler2D velocityTexture;\n\nuniform float deltaTime;\nuniform float elapsedTime;\n\nuniform float speedScaling : 1.0;\n\nvarying vec2 v_Texcoord;\n\nvoid main()\n{\n    vec4 p = texture2D(particleTexture, v_Texcoord);\n    if (p.w > 0.0) {\n        vec4 vTex = texture2D(velocityTexture, p.xy);\n        vec2 v = vTex.xy;\n        p.z = length(v);\n        v = (v - 0.5) * 2.0;\n        p.xy += v * deltaTime / 50.0 * speedScaling;\n        // Make the particle surface seamless \n        p.xy = fract(p.xy);\n        p.w -= deltaTime;\n    }\n    else {\n        p = texture2D(spawnTexture, fract(v_Texcoord + elapsedTime / 10.0));\n    }\n    gl_FragColor = p;\n}\n@end\n\n@export ecx.vfParticle.renderPoints.vertex\n\n#define PI 3.1415926\n\nattribute vec2 texcoord : TEXCOORD_0;\n\nuniform float radius: 100;\nuniform sampler2D particleTexture;\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nuniform float sizeScaling : 1.0;\n\nvoid main()\n{\n    vec4 p = texture2D(particleTexture, texcoord);\n\n    gl_Position = worldViewProjection * vec4(p.xy * 2.0 - 1.0, 0.0, 1.0);\n\n    gl_PointSize = sizeScaling * p.z;\n}\n\n@end\n\n@export ecx.vfParticle.renderPoints.fragment\n\nuniform sampler2D spriteTexture;\nuniform vec4 color : [1.0, 1.0, 1.0, 1.0];\n\nvoid main()\n{\n    gl_FragColor = color * texture2D(spriteTexture, gl_PointCoord);\n}\n\n@end\n'});
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
});